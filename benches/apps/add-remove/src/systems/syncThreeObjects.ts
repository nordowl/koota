import { Circle, Color, Position } from '@sim/add-remove';
import { createRemoved } from 'koota';
import { Points } from '../components/Points';

const normalize = (x: number, min: number, max: number) => (x - min) / (max - min);
const Removed = createRemoved();

export const syncThreeObjects = ({ world }: { world: Koota.World }) => {
	const eids = world.query(Position, Circle, Color);
	const exitEids = world.query(Removed(Position, Circle, Color));

	console.log(exitEids.length);

	const particlesId = world.query(Points)[0];
	const particles = world.get(Points).object[particlesId];

	if (!particles) return;

	const positions = particles.geometry.attributes.position.array;
	const colors = particles.geometry.attributes.color.array;
	const sizes = particles.geometry.attributes.size.array;

	const [position, circle, color] = world.get(Position, Circle, Color);

	for (let i = 0; i < eids.length; i++) {
		const eid = eids[i];

		// Update positions
		positions[eid * 3] = position.x[eid];
		positions[eid * 3 + 1] = position.y[eid];
		positions[eid * 3 + 2] = position.z[eid];

		// Update sizes
		sizes[eid] = circle.radius[eid] * 0.3;

		// Update colors
		const r = normalize(color.r[eid], 0, 255);
		const g = normalize(color.g[eid], 0, 255);
		const b = normalize(color.b[eid], 0, 255);
		colors[eid * 3] = r;
		colors[eid * 3 + 1] = g;
		colors[eid * 3 + 2] = b;
	}

	for (let i = 0; i < exitEids.length; i++) {
		const eid = exitEids[i];
		sizes[eid] = 0;
	}

	particles.geometry.attributes.position.needsUpdate = true;
	particles.geometry.attributes.color.needsUpdate = true;
	particles.geometry.attributes.size.needsUpdate = true;
};