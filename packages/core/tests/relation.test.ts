import { beforeEach, describe, expect, it } from 'vitest';
import { relation, Wildcard } from '../src/relation/relation';
import { createWorld } from '../src';

describe('Relation', () => {
	const world = createWorld();
	world.init();

	beforeEach(() => {
		world.reset();
	});

	it('should create a relation', () => {
		const Relation = relation();
		expect(Object.keys(Relation)).toEqual([]);
	});

	it('should create a unique relations per target by default', () => {
		const Targeting = relation();
		const Attacking = relation();

		const player = world.create();
		const guard = world.create();
		const goblin = world.create(Targeting(player), Attacking(guard), Targeting(guard));

		let targets = world.getTargets(Targeting, goblin);
		expect(targets.length).toBe(2);
		expect(targets).toContain(player);
		expect(targets).toContain(guard);

		targets = world.getTargets(Attacking, goblin);
		expect(targets.length).toBe(1);
		expect(targets).toContain(guard);
	});

	it('should maintain exclusive relations', () => {
		const Targeting = relation({ exclusive: true });

		const player = world.create();
		const guard = world.create();
		const goblin = world.create(Targeting(player));

		let targets = world.getTargets(Targeting, goblin);

		expect(targets.length).toBe(1);
		expect(targets[0]).toBe(player);
		expect(world.has(goblin, Targeting(player))).toBe(true);

		world.add(goblin, Targeting(guard));
		targets = world.getTargets(Targeting, goblin);

		expect(targets.length).toBe(1);
		expect(targets[0]).toBe(guard);
		expect(world.has(goblin, Targeting(player))).toBe(false);
		expect(world.has(goblin, Targeting(guard))).toBe(true);

		world.add(goblin, Targeting(player));
		targets = world.getTargets(Targeting, goblin);

		expect(targets.length).toBe(1);
		expect(targets[0]).toBe(player);
		expect(world.has(goblin, Targeting(player))).toBe(true);
		expect(world.has(goblin, Targeting(guard))).toBe(false);
	});

	it('should auto remove target and its descendants', () => {
		const ChildOf = relation({ autoRemoveTarget: true });

		const parent = world.create();
		const child = world.create(ChildOf(parent));

		const childChildA = world.create(ChildOf(child));
		const childChildB = world.create(ChildOf(child));
		const childChildC = world.create(ChildOf(childChildB));

		expect(world.has(parent)).toBe(true);
		expect(world.has(child)).toBe(true);
		expect(world.has(childChildA)).toBe(true);
		expect(world.has(childChildB)).toBe(true);
		expect(world.has(childChildC)).toBe(true);

		world.destroy(parent);

		expect(world.has(parent)).toBe(false);
		expect(world.has(child)).toBe(false);
		expect(world.has(childChildA)).toBe(false);
		expect(world.has(childChildB)).toBe(false);
		expect(world.has(childChildC)).toBe(false);
	});

	it('should create stores for relations', () => {
		const Contains = relation({ store: { amount: 0 } });

		const inventory = world.create();
		const gold = world.create();
		const silver = world.create();

		world.add(inventory, Contains(gold));
		const goldStore = world.get(Contains(gold));
		const silverStore = world.get(Contains(silver));
		goldStore.amount[inventory] = 5;

		world.add(inventory, Contains(silver));
		silverStore.amount[inventory] = 12;

		expect(Contains(gold)).not.toBe(Contains(silver));
		expect(goldStore.amount[inventory]).toBe(5);
		expect(silverStore.amount[inventory]).toBe(12);
		expect(world.get(Contains(gold)).amount[inventory]).toBe(5);
		expect(world.get(Contains(silver)).amount[inventory]).toBe(12);
	});

	it('should query all relations with a wildcard', () => {
		const Contains = relation();

		const inventory = world.create();
		const shop = world.create();
		const gold = world.create();
		const silver = world.create();

		world.add(inventory, Contains(gold));
		world.add(inventory, Contains(silver));

		let relations = world.query(Contains('*'));
		expect(relations.length).toBe(1);
		expect(relations).toContain(inventory);

		world.add(shop, Contains(gold));

		relations = world.query(Contains('*'));
		expect(relations.length).toBe(2);
		expect(relations).toContain(inventory);
		expect(relations).toContain(shop);
	});
});
