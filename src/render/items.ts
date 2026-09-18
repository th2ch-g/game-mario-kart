import * as THREE from 'three';
import type { Hazard } from '../game/types';
import { batchStatic, cylinder, mesh, sphere } from './primitives';

export function makeHazard(kind: Hazard['kind']) {
  const group = new THREE.Group();
  if (kind === 'mine') {
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const points = [
        new THREE.Vector3(0, 1.1, 0),
        new THREE.Vector3(Math.sin(angle) * 0.3, 0.5, Math.cos(angle) * 0.3),
        new THREE.Vector3(Math.sin(angle), 0.12, Math.cos(angle)),
      ];
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          10,
          0.18,
          6,
          false,
        ),
        '#ffda45',
        group,
      );
    }
    cylinder(group, '#91683a', 0.08, 0.13, 0.3, [0, 1.25, 0], 6);
    for (const x of [-0.12, 0.12])
      sphere(group, '#483a2e', 0.07, [x, 0.85, 0.21], 1);
  } else {
    const color =
      kind === 'rocket' ? '#df4e48' : kind === 'blue' ? '#4c80ec' : '#38af76';
    const shell = sphere(group, color, 0.82, [0, 0.45, 0], 2);
    shell.scale.y = 0.66;
    cylinder(group, '#fff0d1', 0.86, 0.86, 0.19, [0, 0.3, 0], 16);
    cylinder(group, '#635d46', 0.6, 0.6, 0.16, [0, 0.16, 0], 12);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const edge = mesh(
        new THREE.TorusGeometry(0.25, 0.025, 4, 6),
        '#31534b',
        group,
        Math.sin(angle) * 0.46,
        0.75,
        Math.cos(angle) * 0.46,
      );
      edge.rotation.x = -Math.PI / 2;
      if (kind === 'blue')
        cylinder(
          group,
          '#fff3d9',
          0,
          0.15,
          0.65,
          [Math.sin(angle) * 0.56, 0.86, Math.cos(angle) * 0.56],
          6,
        );
    }
    if (kind === 'blue')
      cylinder(group, '#fff3d9', 0, 0.2, 0.8, [0, 1.15, 0], 6);
  }
  batchStatic(group);
  return group;
}
