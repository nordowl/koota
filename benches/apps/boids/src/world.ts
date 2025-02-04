import { createWorld } from 'koota';
import { SpatialHashMap, Time, BoidsConfig } from './traits';
import { SpatialHashMap as SpatialHashMapImpl } from './utils/spatial-hash';

export const world = createWorld(
	Time,
	SpatialHashMap({ value: new SpatialHashMapImpl(5) }),
	BoidsConfig({
		count: 1000,
		maxVelocity: 6,
		separationFactor: 16,
		alignmentFactor: 0.5,
		coherenceFactor: 0.5,
		avoidEdgesFactor: 5,
		avoidEdgesMaxDistance: 15,
		neighborSearchRadius: 3,
	})
);
