import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { KARTS } from '../game/catalog';
import { batchStatic, box, cylinder, mesh, sphere } from './primitives';

function rounded(
  parent: THREE.Object3D,
  color: string,
  size: number[],
  at: number[],
  radius = 0.1,
) {
  return mesh(
    new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius),
    color,
    parent,
    at[0],
    at[1],
    at[2],
  );
}
function rod(
  parent: THREE.Object3D,
  color: string,
  a: number[],
  b: number[],
  radius: number,
) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b),
    delta = end.clone().sub(start);
  const part = cylinder(
    parent,
    color,
    radius,
    radius,
    delta.length(),
    start.clone().add(end).multiplyScalar(0.5).toArray(),
    8,
  );
  part.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  return part;
}

export function makeKart(index: number, ghost = false): THREE.Group {
  const kart = KARTS[index % KARTS.length],
    group = new THREE.Group();
  group.name = 'kart';
  group.rotation.order = 'YXZ';
  const chassis = new THREE.Group();
  chassis.name = 'chassis';
  group.add(chassis);
  rounded(chassis, '#253440', [2.05, 0.19, 3.2], [0, 0.48, 0], 0.08);
  for (const x of [-0.84, 0.84]) {
    rod(chassis, '#b9c8ca', [x, 0.5, -1.1], [x, 0.5, 1.38], 0.085);
    rounded(chassis, kart.color, [0.48, 0.48, 1.85], [x, 0.72, -0.06], 0.14);
    rounded(
      chassis,
      kart.secondary,
      [0.5, 0.08, 1.15],
      [x, 0.97, -0.12],
      0.035,
    );
  }
  rounded(chassis, kart.color, [1.22, 0.42, 1.35], [0, 0.7, 1.05], 0.18);
  const nose = rounded(
    chassis,
    kart.secondary,
    [0.64, 0.14, 1.18],
    [0, 0.96, 1.1],
    0.06,
  );
  nose.rotation.x = -0.12;
  rounded(chassis, kart.color, [2.28, 0.3, 0.46], [0, 0.54, 1.68], 0.13);
  for (const x of [-0.81, 0.81]) {
    rounded(chassis, '#fff5ca', [0.38, 0.12, 0.08], [x, 0.64, 1.93], 0.035);
    rounded(chassis, '#ea5049', [0.28, 0.12, 0.1], [x, 0.72, -1.58], 0.03);
  }
  rounded(chassis, '#283441', [1.03, 0.22, 1.1], [0, 0.72, -0.3], 0.1);
  const seat = rounded(
    chassis,
    '#263441',
    [1.1, 0.85, 0.28],
    [0, 1.05, -0.8],
    0.12,
  );
  seat.rotation.x = -0.17;
  rounded(chassis, '#374d55', [0.85, 0.52, 0.72], [0, 0.82, -1.27], 0.06);
  for (const x of [-0.3, 0, 0.3])
    box(chassis, '#9bafb3', [0.08, 0.1, 0.55], [x, 1.1, -1.28]);
  for (const x of [-0.55, 0.55]) {
    const exhaust = cylinder(
      chassis,
      '#84969d',
      0.15,
      0.18,
      0.45,
      [x, 0.63, -1.68],
      12,
    );
    exhaust.rotation.x = Math.PI / 2;
    const opening = cylinder(
      chassis,
      '#15252e',
      0.105,
      0.105,
      0.02,
      [x, 0.63, -1.91],
      12,
    );
    opening.rotation.x = Math.PI / 2;
  }
  const wingHeight = index === 2 || index === 5 ? 1.42 : 1.25;
  for (const x of [-0.67, 0.67])
    rod(chassis, '#303e48', [x, 0.65, -1.4], [x, wingHeight, -1.53], 0.075);
  rounded(
    chassis,
    kart.color,
    [2.24, 0.12, 0.5],
    [0, wingHeight, -1.55],
    0.035,
  );
  for (const x of [-1.07, 1.07])
    rounded(
      chassis,
      kart.secondary,
      [0.09, 0.32, 0.55],
      [x, wingHeight, -1.55],
      0.035,
    );

  for (const x of [-1.15, 1.15])
    for (const z of [-1.02, 1.08]) {
      const front = z > 0,
        radius = front ? 0.46 : 0.53;
      const steering = new THREE.Group();
      steering.name = front ? 'front-wheel' : 'rear-wheel';
      steering.position.set(x, radius, z);
      group.add(steering);
      const rolling = new THREE.Group();
      rolling.name = 'tire-roll';
      rolling.userData.radius = radius;
      steering.add(rolling);
      const tire = cylinder(
        rolling,
        '#20282f',
        radius,
        radius,
        front ? 0.42 : 0.54,
        [0, 0, 0],
        20,
      );
      tire.rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) {
        const rim = cylinder(
          rolling,
          '#c4d1ce',
          radius * 0.58,
          radius * 0.58,
          0.03,
          [side * (front ? 0.22 : 0.28), 0, 0],
          12,
        );
        rim.rotation.z = Math.PI / 2;
        const center = cylinder(
          rolling,
          '#42555e',
          0.12,
          0.12,
          0.045,
          [side * (front ? 0.24 : 0.3), 0, 0],
          8,
        );
        center.rotation.z = Math.PI / 2;
        for (let i = 0; i < 5; i++) {
          const spoke = box(
            rolling,
            '#687c83',
            [0.035, radius * 0.8, 0.055],
            [side * (front ? 0.24 : 0.3), 0, 0],
          );
          spoke.rotation.x = (i * Math.PI) / 5;
        }
      }
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const tread = box(
          rolling,
          '#344048',
          [front ? 0.36 : 0.48, 0.025, 0.045],
          [0, Math.cos(a) * radius, Math.sin(a) * radius],
        );
        tread.rotation.x = a;
      }
      batchStatic(rolling);
      rod(chassis, '#536770', [0, radius, z], [x, radius, z], 0.09);
    }

  const driver = new THREE.Group();
  driver.name = 'driver';
  chassis.add(driver);
  rounded(driver, kart.color, [0.72, 0.69, 0.53], [0, 1.26, -0.27], 0.2);
  rounded(driver, kart.secondary, [0.19, 0.55, 0.055], [0, 1.3, 0.015], 0.03);
  for (const side of [-1, 1]) {
    rod(
      driver,
      kart.color,
      [side * 0.28, 0.94, -0.22],
      [side * 0.33, 0.68, 0.53],
      0.17,
    );
    rounded(
      driver,
      '#30434c',
      [0.3, 0.22, 0.5],
      [side * 0.34, 0.62, 0.81],
      0.08,
    );
    rod(
      driver,
      kart.color,
      [side * 0.38, 1.45, -0.2],
      [side * 0.48, 1.18, 0.12],
      0.14,
    );
    rod(
      driver,
      kart.color,
      [side * 0.48, 1.18, 0.12],
      [side * 0.3, 1.29, 0.45],
      0.13,
    );
    sphere(driver, '#f3ead6', 0.16, [side * 0.3, 1.29, 0.45], 1);
  }
  const helmet = sphere(driver, kart.color, 0.51, [0, 1.92, -0.22], 2);
  helmet.scale.set(1, 1.05, 0.95);
  const stripe = sphere(driver, kart.secondary, 0.515, [0, 1.925, -0.22], 2);
  stripe.scale.set(0.18, 1.05, 0.96);
  const visor = sphere(driver, '#132f42', 0.45, [0, 1.97, 0.01], 2);
  visor.scale.set(1.02, 0.42, 0.72);
  const glint = sphere(driver, '#8fc9d7', 0.29, [-0.14, 2.055, 0.22], 1);
  glint.scale.set(0.72, 0.13, 0.13);
  const steeringWheel = mesh(
    new THREE.TorusGeometry(0.3, 0.045, 6, 16),
    '#182e36',
    chassis,
    0,
    1.31,
    0.5,
  );
  steeringWheel.rotation.x = -0.5;
  rod(chassis, '#75868a', [0, 0.6, 0.75], [0, 1.28, 0.49], 0.055);

  for (const x of [-0.55, 0.55]) {
    const flame = mesh(
      new THREE.ConeGeometry(0.22, 1.4, 8),
      '#79e5ff',
      group,
      x,
      0.64,
      -2.45,
    );
    flame.rotation.x = -Math.PI / 2;
    flame.name = 'flame';
    flame.visible = false;
    const spark = sphere(group, '#ffd158', 0.18, [x * 2.2, 0.15, -1.55]);
    spark.material = spark.material.clone();
    spark.name = 'spark';
    spark.visible = false;
  }
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 20, 12),
    new THREE.MeshBasicMaterial({
      color: '#8dffe6',
      transparent: true,
      opacity: 0.12,
      wireframe: true,
    }),
  );
  shield.position.y = 1;
  shield.name = 'shield';
  shield.visible = false;
  group.add(shield);
  const stars = new THREE.Group();
  stars.name = 'star-ring';
  for (let i = 0; i < 5; i++) {
    const star = sphere(stars, '#ffe778', 0.17, [
      Math.sin(i * Math.PI * 0.4) * 1.85,
      1.2 + Math.cos(i * 2) * 0.8,
      Math.cos(i * Math.PI * 0.4) * 1.85,
    ]);
    star.material.emissive.set('#ffcf39');
    star.material.emissiveIntensity = 0.8;
  }
  stars.visible = false;
  group.add(stars);
  const rocket = new THREE.Group();
  rocket.name = 'bullet-body';
  const shell = sphere(rocket, '#283545', 1, [0, 1, 0], 2);
  shell.scale.set(1.2, 0.9, 2.4);
  for (const x of [-0.65, 0.65]) {
    const eye = sphere(rocket, '#f9f1d6', 0.3, [x, 1.4, 1.5], 1);
    eye.scale.set(0.8, 0.65, 0.3);
  }
  rocket.visible = false;
  group.add(rocket);
  batchStatic(chassis, new Set([driver]));
  batchStatic(driver);
  if (ghost)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const faded = (child.material as THREE.Material).clone();
        faded.transparent = true;
        faded.opacity = 0.25;
        child.material = faded;
        child.castShadow = false;
      }
    });
  return group;
}

export function animateKart(
  group: THREE.Group,
  speed: number,
  steer: number,
  drift: boolean,
  dt: number,
) {
  for (const wheel of group.children) {
    if (wheel.name === 'front-wheel')
      wheel.rotation.y = -steer * (drift ? 0.4 : 0.3);
    const rolling = wheel.getObjectByName('tire-roll');
    if (rolling) rolling.rotation.x += (speed * dt) / rolling.userData.radius;
  }
  const driver = group.getObjectByName('driver');
  if (driver) {
    driver.rotation.z = steer * (drift ? 0.14 : 0.07);
    driver.rotation.y = -steer * 0.12;
  }
  const chassis = group.getObjectByName('chassis');
  if (chassis)
    chassis.position.y =
      Math.sin(performance.now() * 0.025) * Math.min(0.015, speed * 0.0005);
  // The tire axle is local X; forward travel along local +Z rolls about +X.
  group.userData.speed = speed;
}
