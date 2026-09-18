import { expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { getTrack } from '../src/game/tracks';
import { animateKart, makeKart } from '../src/render/kart';

for (const id of [0, 1, 2])
  it(`course ${id} has varied bends without folded road edges`, () => {
    const track = getTrack(id);
    expect(track.length).toBeGreaterThan(750);
    expect(track.samples.some((p) => p.curvature > 0.025)).toBe(true);
    expect(track.samples.some((p) => p.curvature < -0.025)).toBe(true);
    expect(
      Math.max(
        ...track.samples.map(
          (p) => Math.abs(p.curvature) * (p.width / 2 + 1.4),
        ),
      ),
    ).toBeLessThan(1);
    const sampled = track.samples.filter((_, i) => i % 5 === 0);
    let crossings = 0;
    for (let i = 0; i < sampled.length; i++)
      for (let j = i + 1; j < sampled.length; j++) {
        const separation =
          (Math.min(j - i, sampled.length - j + i) * track.length) /
          sampled.length;
        if (separation < 40) continue;
        const a = sampled[i],
          b = sampled[j];
        if (Math.hypot(a.x - b.x, a.z - b.z) < (a.width + b.width) / 2) {
          expect(
            Math.abs(a.y - b.y),
            `road overlap at ${i} and ${j}`,
          ).toBeGreaterThan(7);
          crossings++;
        }
      }
    if (id === 2) expect(crossings).toBeGreaterThan(0);
  });

it('uses four correctly oriented tires and turns only the front pair', () => {
  const kart = makeKart(0),
    front = kart.children.filter((part) => part.name === 'front-wheel'),
    rear = kart.children.filter((part) => part.name === 'rear-wheel');
  expect(front).toHaveLength(2);
  expect(rear).toHaveLength(2);
  for (const wheel of [...front, ...rear]) {
    const size = new Box3().setFromObject(wheel).getSize(new Vector3());
    expect(size.x).toBeLessThan(size.y * 0.7);
    expect(Math.abs(size.y - size.z)).toBeLessThan(0.03);
  }
  animateKart(kart, 24, 1, false, 0.1);
  for (const wheel of front) {
    const forward = new Vector3(0, 0, 1).applyQuaternion(wheel.quaternion);
    const driverRight = new Vector3(-1, 0, 0);
    expect(forward.dot(driverRight)).toBeGreaterThan(0.2);
    expect(wheel.getObjectByName('tire-roll')!.rotation.x).toBeGreaterThan(4);
  }
  for (const wheel of rear) expect(wheel.rotation.y).toBe(0);
});
