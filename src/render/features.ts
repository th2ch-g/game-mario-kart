import * as THREE from 'three';
import { position, sample, sectionAt, type Track } from '../game/tracks';
import { box, cylinder, mesh, sphere, textSign } from './primitives';

function beam(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  color: string,
  radius: number,
) {
  const delta = b.clone().sub(a);
  const pole = cylinder(
    parent,
    color,
    radius,
    radius,
    delta.length(),
    a.clone().add(b).multiplyScalar(0.5).toArray(),
    6,
  );
  pole.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
}

export function buildRoadFoundation(world: THREE.Group, track: Track) {
  const vertices: number[] = [];
  for (let s = 0; s < track.length; s += 2) {
    const p = sample(track, s),
      next = sample(track, s + 2);
    const raised = ['bridge', 'boardwalk'].includes(sectionAt(track, s).kind);
    for (const side of [-1, 1]) {
      const a = p.width / 2 + 1.25,
        b = next.width / 2 + 1.25;
      const ax = p.x + p.nx * a * side,
        az = p.z + p.nz * a * side,
        ay = p.y - Math.tan(p.bank) * a * side;
      const bx = next.x + next.nx * b * side,
        bz = next.z + next.nz * b * side,
        by = next.y - Math.tan(next.bank) * b * side;
      const bottomA = raised ? ay - 0.7 : 1,
        bottomB = raised ? by - 0.7 : 1;
      vertices.push(
        ax,
        ay - 0.08,
        az,
        bx,
        by - 0.08,
        bz,
        ax,
        bottomA,
        az,
        bx,
        by - 0.08,
        bz,
        bx,
        bottomB,
        bz,
        ax,
        bottomA,
        az,
      );
    }
    if (raised && Math.floor(s) % 16 === 0) {
      const crossesRoad = track.samples.some(
        (other, i) =>
          i % 5 === 0 &&
          other.y < p.y - 5 &&
          Math.hypot(other.x - p.x, other.z - p.z) < 12,
      );
      if (!crossesRoad)
        for (const side of [-1, 1]) {
          const at = position(track, s, side * (p.width / 2 - 0.8));
          cylinder(
            world,
            track.definition.id === 1 ? '#775546' : '#7d8c97',
            0.6,
            0.9,
            at.y + 3,
            [at.x, (at.y - 3) / 2, at.z],
          );
        }
    }
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  walls.computeVertexNormals();
  const wall = new THREE.Mesh(
    walls,
    new THREE.MeshStandardMaterial({
      color: track.definition.id === 2 ? '#45556c' : '#9d9679',
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  wall.receiveShadow = true;
  world.add(wall);
}

function arch(
  world: THREE.Group,
  track: Track,
  start: number,
  end: number,
  color: string,
  solid: boolean,
) {
  const points: number[] = [],
    indices: number[] = [];
  const count = Math.max(2, Math.ceil((end - start) / 2)),
    segments = 16;
  for (let i = 0; i <= count; i++) {
    const p = sample(track, start + ((end - start) * i) / count);
    for (let j = 0; j <= segments; j++) {
      const theta = (j * Math.PI) / segments,
        inset = solid ? 0 : 0.08,
        offset = Math.cos(theta) * (p.width / 2 + 2.3 - inset);
      points.push(
        p.x + p.nx * offset,
        p.y + Math.sin(theta) * (9.5 - inset) + 0.05,
        p.z + p.nz * offset,
      );
      if (i < count && j < segments) {
        const n = i * (segments + 1) + j;
        indices.push(
          n,
          n + 1,
          n + segments + 1,
          n + 1,
          n + segments + 2,
          n + segments + 1,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const surface = new THREE.Mesh(
    geometry,
    solid
      ? new THREE.MeshStandardMaterial({
          color,
          side: THREE.DoubleSide,
          roughness: 0.9,
        })
      : new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );
  surface.castShadow = solid;
  surface.receiveShadow = solid;
  world.add(surface);
}

function sign(
  world: THREE.Group,
  track: Track,
  s: number,
  text: string,
  color: string,
) {
  const p = position(track, s, 0),
    width = sample(track, s).width;
  const frame = new THREE.Group();
  frame.position.set(p.x, p.y, p.z);
  frame.rotation.y = p.heading + Math.PI;
  for (const x of [-width / 2 - 1.5, width / 2 + 1.5])
    cylinder(frame, '#4f6771', 0.17, 0.17, 8.8, [x, 4.4, 0], 6);
  const panel = textSign(text, color, '#ffffff', width + 2, 1.5);
  panel.position.y = 8.1;
  frame.add(panel);
  world.add(frame);
}

export function buildCourseFeatures(world: THREE.Group, track: Track) {
  const def = track.definition;
  for (const section of def.sections) {
    const start = section.from * track.length,
      end = section.to * track.length;
    if (
      section.kind === 'boardwalk' ||
      (section.kind === 'bridge' && def.id === 1)
    ) {
      for (let s = start; s < end; s += 1.4) {
        const p = sample(track, s),
          w = sample(track, s).width;
        const plank = box(
          world,
          Math.floor(s / 1.4) % 3 ? '#b28459' : '#c99b69',
          [w, 0.12, 1.3],
          [p.x, p.y + 0.1, p.z],
        );
        plank.rotation.set(-p.slope, p.heading, p.bank, 'YXZ');
      }
    }
    if (section.kind === 'tunnel') {
      arch(
        world,
        track,
        start,
        end,
        def.id === 2 ? '#303d67' : '#7c756b',
        true,
      );
      for (let s = start; s <= end; s += 8)
        arch(
          world,
          track,
          s,
          s + 0.5,
          def.id === 2 ? '#bd87ff' : '#f3cc83',
          false,
        );
      sign(
        world,
        track,
        start - 12,
        def.id === 2 ? 'LIGHT TUNNEL' : 'ROCK TUNNEL',
        def.color,
      );
    }
    if (section.kind === 'bridge') {
      for (const side of [-1, 1]) {
        const anchors: THREE.Vector3[] = [];
        for (let s = start; s <= end; s += 3) {
          const p = position(
            track,
            s,
            side * (sample(track, s).width / 2 + 0.75),
          );
          const f = (s - start) / (end - start),
            h = 3.2 + 6 * (2 * f - 1) ** 2;
          anchors.push(new THREE.Vector3(p.x, p.y + h, p.z));
          if (Math.floor((s - start) / 3) % 2 === 0)
            beam(
              world,
              new THREE.Vector3(p.x, p.y + 0.3, p.z),
              new THREE.Vector3(p.x, p.y + h, p.z),
              def.id === 2 ? '#a9a1ea' : '#bca17d',
              0.075,
            );
        }
        mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(anchors),
            anchors.length * 2,
            0.14,
            6,
            false,
          ),
          def.id === 2 ? '#a39ae9' : '#725747',
          world,
        );
      }
      for (const s of [start + 1, end - 1]) {
        const p = position(track, s, 0),
          frame = new THREE.Group(),
          w = sample(track, s).width;
        frame.position.set(p.x, p.y, p.z);
        frame.rotation.y = p.heading;
        for (const side of [-1, 1])
          box(
            frame,
            def.id === 2 ? '#626db0' : '#bc774b',
            [0.8, 11, 0.8],
            [side * (w / 2 + 1.2), 5.5, 0],
          );
        box(
          frame,
          def.id === 2 ? '#626db0' : '#bc774b',
          [w + 3, 0.7, 0.8],
          [0, 10.6, 0],
        );
        world.add(frame);
      }
      sign(
        world,
        track,
        start - 14,
        def.id === 2 ? 'SKYLINE EXPRESS' : 'MAPLE BRIDGE',
        def.color,
      );
    }
  }
  for (const ramp of def.jumps) {
    const vertices: number[] = [],
      indices: number[] = [],
      start = ramp.at * track.length - ramp.length;
    for (let i = 0; i <= 16; i++) {
      const s = start + (ramp.length * i) / 16,
        p = sample(track, s);
      for (const offset of [
        ramp.offset - ramp.width / 2,
        ramp.offset + ramp.width / 2,
      ])
        vertices.push(
          p.x + p.nx * offset,
          p.y -
            Math.tan(p.bank) * offset +
            ramp.height * (i / 16) ** 1.4 +
            0.04,
          p.z + p.nz * offset,
        );
      if (i < 16) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const slope = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: '#ea9b42',
        side: THREE.DoubleSide,
      }),
    );
    slope.receiveShadow = true;
    world.add(slope);
    for (let i = 1; i < 6; i++) {
      const s = start + (ramp.length * i) / 6;
      const arrowPoints: number[] = [];
      for (const side of [-1, 1]) {
        const corners = [
          [side * ramp.width * 0.3, -0.4],
          [0, 0.6],
          [0, 1],
          [side * ramp.width * 0.3, 0],
        ];
        for (const j of [0, 1, 2, 0, 2, 3]) {
          const p = position(
            track,
            s + corners[j][1],
            ramp.offset + corners[j][0],
          );
          arrowPoints.push(p.x, p.y + 0.09, p.z);
        }
      }
      const arrowGeometry = new THREE.BufferGeometry();
      arrowGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(arrowPoints, 3),
      );
      world.add(
        new THREE.Mesh(
          arrowGeometry,
          new THREE.MeshBasicMaterial({
            color: '#fff4c5',
            side: THREE.DoubleSide,
          }),
        ),
      );
    }
    sign(world, track, start - 9, 'JUMP!  /  DRIFT = TRICK', '#c56b32');
  }
  for (const obstacle of def.obstacles) {
    const p = position(track, obstacle.at * track.length, obstacle.offset),
      group = new THREE.Group();
    group.position.set(p.x, p.y, p.z);
    group.rotation.y = p.heading;
    if (obstacle.kind === 'rocks') {
      const rock = sphere(group, '#8b8075', obstacle.radius, [
        0,
        obstacle.radius * 0.7,
        0,
      ]);
      rock.scale.y = 0.8;
      sphere(group, '#a59b88', obstacle.radius * 0.55, [0.7, 0.5, 0.6]);
    } else if (obstacle.kind === 'barrels') {
      for (const x of [-0.5, 0.5]) {
        cylinder(group, '#c88049', 0.5, 0.52, 1.6, [x, 0.8, 0], 10);
        for (const y of [0.35, 1.25])
          cylinder(group, '#6a7874', 0.53, 0.53, 0.14, [x, y, 0], 10);
      }
    } else {
      box(group, '#e9bc45', [2.8, 1.2, 0.75], [0, 0.6, 0]);
      for (const x of [-0.9, 0, 0.9]) {
        const stripe = box(group, '#344252', [0.3, 1.2, 0.77], [x, 0.6, 0]);
        stripe.rotation.z = -0.3;
      }
    }
    world.add(group);
  }
  let lastSign = -50;
  for (let s = 30; s < track.length - 20; s += 8) {
    const bend = sample(track, s + 10);
    if (Math.abs(bend.curvature) < 0.035 || s - lastSign < 34) continue;
    lastSign = s;
    const p = position(
      track,
      s,
      -Math.sign(bend.curvature) * (sample(track, s).width / 2 + 1.8),
    );
    const arrow = textSign(
      bend.curvature > 0 ? '› › ›' : '‹ ‹ ‹',
      '#203d45',
      '#ffe489',
      4.5,
      1.3,
    );
    arrow.position.set(p.x, p.y + 2.8, p.z);
    arrow.rotation.y = p.heading + Math.PI;
    world.add(arrow);
    cylinder(world, '#536c70', 0.12, 0.12, 2.8, [p.x, p.y + 1.4, p.z], 6);
  }
  if (def.id === 0) {
    const lighthouse = new THREE.Group();
    lighthouse.position.set(-37, 1, -36);
    cylinder(lighthouse, '#f3e8cf', 3.1, 4.5, 18, [0, 9, 0], 12);
    for (const y of [6, 12])
      cylinder(
        lighthouse,
        '#e47559',
        3.4 + (18 - y) * 0.055,
        3.5 + (18 - y) * 0.055,
        2.2,
        [0, y, 0],
        12,
      );
    cylinder(lighthouse, '#365866', 4, 4, 0.6, [0, 18, 0], 12);
    cylinder(lighthouse, '#ffdf85', 2.5, 2.5, 3.3, [0, 20, 0], 12);
    cylinder(lighthouse, '#df6e53', 0, 3.8, 3, [0, 23, 0], 12);
    world.add(lighthouse);
    for (const [x, z] of [
      [-80, 199],
      [-35, 208],
      [55, 195],
    ]) {
      const sailboat = new THREE.Group();
      sailboat.position.set(x, -5.2, z);
      const hull = sphere(sailboat, '#f7f0d3', 4, [0, 0, 0]);
      hull.scale.set(0.7, 0.35, 1.6);
      cylinder(sailboat, '#9a7955', 0.12, 0.12, 10, [0, 5, 0], 6);
      const sail = mesh(
        new THREE.ConeGeometry(3.5, 7, 3),
        '#fff2cf',
        sailboat,
        0,
        6,
        0,
      );
      sail.scale.z = 0.12;
      world.add(sailboat);
    }
    const lagoon = cylinder(
      world,
      '#59c2ce',
      40,
      40,
      0.12,
      [-110, 1.2, 105],
      48,
    );
    lagoon.scale.set(1.3, 1, 0.7);
  } else if (def.id === 1) {
    const river = box(world, '#69b6bc', [185, 0.12, 13], [-15, 1.2, -8]);
    river.rotation.y = -0.24;
    for (const x of [146, -156]) {
      cylinder(world, '#8a8f83', 0, 38, 68, [x, 27, -93], 7);
      cylinder(world, '#f2e8d2', 0, 12, 21, [x, 51, -93], 7);
    }
    const cabin = new THREE.Group();
    cabin.position.set(15, 1.1, 75);
    box(cabin, '#c49160', [10, 7, 8], [0, 3.5, 0]);
    const roof = cylinder(cabin, '#764f43', 0, 8.3, 5, [0, 9, 0], 4);
    roof.rotation.y = Math.PI / 4;
    box(cabin, '#ffd489', [2.2, 2.5, 0.12], [-2.4, 4.2, 4.05]);
    box(cabin, '#5b4a3f', [2.3, 4.5, 0.12], [1.7, 2.25, 4.05]);
    world.add(cabin);
  } else {
    for (let i = 0; i < 8; i++) {
      const x = -65 + i * 18,
        h = 24 + (i % 3) * 10;
      box(
        world,
        ['#303f68', '#404879', '#354a68'][i % 3],
        [11, h, 12],
        [x, h / 2, -135],
      );
      box(
        world,
        ['#b58afd', '#79deea', '#f2a4b6'][i % 3],
        [11.2, 0.5, 12.2],
        [x, h - 2, -135],
      );
    }
    const moon = new THREE.Mesh(
      new THREE.IcosahedronGeometry(11, 2),
      new THREE.MeshBasicMaterial({ color: '#fff0c3' }),
    );
    moon.position.set(-160, 100, -195);
    world.add(moon);
  }
}
