import { Component, ComponentInstance, Schema, SchemaFromComponent, SYMBOLS } from '@sweet-ecs/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useWorld } from '../world/use-world';

export function useComponent<T extends Component, TSchema extends Schema = SchemaFromComponent<T>>(
	component: T,
	initialValue:
		| Partial<ComponentInstance<TSchema>>
		| (() => Partial<ComponentInstance<TSchema>>) = {}
) {
	const world = useWorld();
	const [, rerender] = useState(0);
	const store = useMemo(() => world.get(component), [world, component]);

	const ref = useRef(
		(() => {
			const instance = component[SYMBOLS.$createInstance]() as ComponentInstance<TSchema>;

			// Initialize the component with the initial state.
			if (typeof initialValue === 'function') {
				Object.assign(instance, initialValue());
			} else {
				Object.assign(instance, initialValue);
			}

			return instance;
		})()
	);

	const set = useCallback((value: Partial<ComponentInstance<TSchema>>, isSilent = false) => {
		// Merge values.
		Object.assign(ref.current, value);

		// Set store then notify changed.
		const c = ref.current;
		if (c[SYMBOLS.$entity] !== null) {
			for (const key in value) {
				store[key][c[SYMBOLS.$entity]!] = c[key];
			}

			world.changed(c[SYMBOLS.$entity]!, c[SYMBOLS.$component]);
		}

		// Force React to rerender.
		if (!isSilent) rerender((v) => v + 1);
	}, []);

	return [ref.current, set] as const;
}
