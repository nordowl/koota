import { Entity } from '../entity/types';
import { getRelationTargets, Pair, Wildcard } from '../relation/relation';
import { $exclusiveRelation } from '../relation/symbols';
import { $internal } from '../world/symbols';
import { incrementWorldBitflag } from '../world/utils/increment-world-bit-flag';
import { World } from '../world/world';
import { TraitData } from './trait-data';
import {
	ConfigurableTrait,
	Norm,
	Schema,
	Store,
	ExtractStore,
	StoreFromComponents,
	Trait,
} from './types';
import {
	createFastSetFunction,
	createGetFunction,
	createSetFunction,
} from './utils/create-accessors';
import { createStore } from './utils/create-store';

let traitId = 0;

function defineTrait<S extends Schema = {}>(schema: S = {} as S): Trait<Norm<S>> {
	const Trait = Object.assign(
		function (params: Partial<Norm<S>>) {
			return [Trait, params];
		},
		{
			schema: schema as Norm<S>,
			[$internal]: {
				set: createSetFunction(schema),
				fastSet: createFastSetFunction(schema),
				get: createGetFunction(schema),
				stores: [] as Store<S>[],
				id: traitId++,
				createStore: () => createStore(schema as Norm<S>),
				isPairTrait: false,
				relation: null,
				pairTarget: null,
				isTag: Object.keys(schema).length === 0,
			},
		}
	) as Trait<Norm<S>>;

	return Trait;
}

export const trait = defineTrait;

export function registerTrait(world: World, trait: Trait) {
	const ctx = world[$internal];
	const data = new TraitData(world, trait);

	// Add trait to the world.
	ctx.traitData.set(trait, data);
	world.traits.add(trait);

	// Increment the world bitflag.
	incrementWorldBitflag(world);
}

export function addTrait(world: World, entity: Entity, ...traits: ConfigurableTrait[]) {
	const ctx = world[$internal];

	for (let i = 0; i < traits.length; i++) {
		// Get trait and params.
		let trait: Trait;
		let params: Record<string, any> | undefined;

		if (Array.isArray(traits[i])) {
			[trait, params] = traits[i] as [Trait, Record<string, any>];
		} else {
			trait = traits[i] as Trait;
		}

		// Exit early if the entity already has the trait.
		if (entity.has(trait)) return;

		const traitCtx = trait[$internal];

		// Register the trait if it's not already registered.
		if (!ctx.traitData.has(trait)) registerTrait(world, trait);

		const data = ctx.traitData.get(trait)!;
		const { generationId, bitflag, queries } = data;

		// Add bitflag to entity bitmask.
		ctx.entityMasks[generationId][entity] |= bitflag;

		// Set the entity as dirty.
		for (const dirtyMask of ctx.dirtyMasks.values()) {
			if (!dirtyMask[generationId]) dirtyMask[generationId] = [];
			dirtyMask[generationId][entity] |= bitflag;
		}

		// Update queries.
		for (const query of queries) {
			// Remove this entity from toRemove if it exists in this query.
			query.toRemove.remove(entity);

			// Check if the entity matches the query.
			let match = query.check(world, entity, { type: 'add', traitData: data });

			if (match) query.add(entity);
			else query.remove(world, entity);
		}

		// Add trait to entity internally.
		ctx.entityTraits.get(entity)!.add(trait);

		const relation = traitCtx.relation;
		const target = traitCtx.pairTarget;

		// Add relation target entity.
		if (traitCtx.isPairTrait && relation !== null && target !== null) {
			// Mark entity as a relation target.
			ctx.relationTargetEntities.add(target);

			// Add wildcard relation traits.
			entity.add(Pair(Wildcard, target));
			entity.add(Pair(relation, Wildcard));

			// If it's an exclusive relation, remove the old target.
			if (relation[$exclusiveRelation] === true && target !== Wildcard) {
				const oldTarget = getRelationTargets(world, relation, entity)[0];

				if (oldTarget !== null && oldTarget !== undefined && oldTarget !== target) {
					removeTrait(world, entity, relation(oldTarget));
				}
			}
		}

		// Set default values or override with provided params.
		const defaults = data.schema;
		// Execute any functions in the defaults.
		for (const key in defaults) {
			if (typeof defaults[key] === 'function') {
				defaults[key] = defaults[key]();
			}
		}

		entity.set(trait, { ...defaults, ...params }, false);
	}
}

export function removeTrait(world: World, entity: Entity, ...traits: Trait[]) {
	const ctx = world[$internal];

	for (let i = 0; i < traits.length; i++) {
		const trait = traits[i];
		const traitCtx = trait[$internal];

		// Exit early if the entity doesn't have the trait.
		if (!entity.has(trait)) return;

		const data = ctx.traitData.get(trait)!;
		const { generationId, bitflag, queries } = data;

		// Remove bitflag from entity bitmask.
		ctx.entityMasks[generationId][entity] &= ~bitflag;

		// Set the entity as dirty.
		for (const dirtyMask of ctx.dirtyMasks.values()) {
			dirtyMask[generationId][entity] |= bitflag;
		}

		// Update queries.
		for (const query of queries) {
			// Check if the entity matches the query.
			let match = query.check(world, entity, { type: 'remove', traitData: data });

			if (match) query.add(entity);
			else query.remove(world, entity);
		}

		// Remove trait from entity internally.
		ctx.entityTraits.get(entity)!.delete(trait);

		// Remove wildcard relations if it is a Pair trait.
		if (traitCtx.isPairTrait) {
			// Check if entity is still a subject of any relation or not.
			if (world.query(Wildcard(entity)).length === 0) {
				ctx.relationTargetEntities.delete(entity);

				// TODO: cleanup query by hash
				// removeQueryByHash(world, [Wildcard(eid)])
			}

			// Remove wildcard to this target for this entity.
			const target = traitCtx.pairTarget!;
			removeTrait(world, entity, Pair(Wildcard, target));

			// Remove wildcard relation if the entity has no other relations.
			const relation = traitCtx.relation!;
			const otherTargets = getRelationTargets(world, relation, entity);

			if (otherTargets.length === 0) {
				removeTrait(world, entity, Pair(relation, Wildcard));
			}
		}
	}
}

export function hasTrait(world: World, entity: Entity, trait: Trait): boolean {
	const ctx = world[$internal];
	const data = ctx.traitData.get(trait);
	if (!data) return false;

	const { generationId, bitflag } = data;
	const mask = ctx.entityMasks[generationId][entity];

	return (mask & bitflag) === bitflag;
}

export function getStore<C extends Trait = Trait>(world: World, trait: C): ExtractStore<C> {
	const ctx = world[$internal];
	// Need this for relation traits. There might be a better way to handle this.
	if (!ctx.traitData.has(trait)) registerTrait(world, trait);

	const data = ctx.traitData.get(trait)!;
	const store = data.store as ExtractStore<C>;

	return store;
}

export function getStores<T extends [Trait, ...Trait[]]>(
	world: World,
	...traits: T
): StoreFromComponents<T> {
	const stores = traits.map((trait) => getStore(world, trait));
	return (traits.length === 1 ? stores[0] : stores) as StoreFromComponents<T>;
}