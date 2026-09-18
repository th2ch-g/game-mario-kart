import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KARTS } from '../game/catalog';
import { getTrack, position, sample, type Track } from '../game/tracks';
import type { GhostPoint, RaceState, Settings } from '../game/types';

const materials = new Map<string, THREE.MeshStandardMaterial>();
function batchStatic(
  root: THREE.Object3D,
  skip: Set<THREE.Object3D> = new Set(),
) {
  root.updateMatrixWorld(true);
  const groups = new Map<
    string,
    { material: THREE.Material; meshes: THREE.Mesh[] }
  >();
  root.traverse((child) => {
    if (
      !(child instanceof THREE.Mesh) ||
      Array.isArray(child.material) ||
      child.name
    )
      return;
    for (
      let parent: THREE.Object3D | null = child;
      parent;
      parent = parent.parent
    )
      if (skip.has(parent)) return;
    const key =
      child.material.uuid +
      Object.keys(child.geometry.attributes).join(',') +
      String(!!child.geometry.index);
    if (!groups.has(key))
      groups.set(key, { material: child.material, meshes: [] });
    groups.get(key)!.meshes.push(child);
  });
  const inverse = root.matrixWorld.clone().invert();
  for (const group of groups.values())
    if (group.meshes.length > 1) {
      const geometries = group.meshes.map((m) =>
        m.geometry
          .clone()
          .applyMatrix4(inverse.clone().multiply(m.matrixWorld)),
      );
      const merged = mergeGeometries(geometries);
      if (merged) {
        const output = new THREE.Mesh(merged, group.material);
        output.castShadow = group.meshes.some((m) => m.castShadow);
        output.receiveShadow = true;
        root.add(output);
        for (const m of group.meshes) {
          m.removeFromParent();
          m.geometry.dispose();
        }
      }
      geometries.forEach((g) => g.dispose());
    }
}
function material(color: string, roughness = 0.78) {
  if (!materials.has(color))
    materials.set(color, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(color)!;
}
function mesh(
  geometry: THREE.BufferGeometry,
  color: string,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geometry, material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(
  parent: THREE.Object3D,
  color: string,
  size: number[],
  pos: number[],
) {
  return mesh(
    new THREE.BoxGeometry(...(size as [number, number, number])),
    color,
    parent,
    ...(pos as [number, number, number]),
  );
}
function cylinder(
  parent: THREE.Object3D,
  color: string,
  top: number,
  bottom: number,
  height: number,
  pos: number[],
  segments = 8,
) {
  return mesh(
    new THREE.CylinderGeometry(top, bottom, height, segments),
    color,
    parent,
    ...(pos as [number, number, number]),
  );
}
function sphere(
  parent: THREE.Object3D,
  color: string,
  radius: number,
  pos: number[],
  detail = 1,
) {
  return mesh(
    new THREE.IcosahedronGeometry(radius, detail),
    color,
    parent,
    ...(pos as [number, number, number]),
  );
}
function textSign(
  text: string,
  background: string,
  foreground: string,
  width = 11,
  height = 2.5,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 768, 192);
  ctx.fillStyle = foreground;
  ctx.font = '900 88px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 101);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  return sign;
}
export function makeKart(index: number, ghost = false): THREE.Group {
  const group = new THREE.Group(),
    kart = KARTS[index % KARTS.length];
  box(group, '#283b40', [2.35, 0.3, 3.5], [0, 0.65, 0]);
  const body = box(group, kart.color, [2.1, 0.65, 2.55], [0, 1, 0]);
  body.rotation.x = -0.04;
  box(group, kart.secondary, [1.8, 0.22, 1.05], [0, 1.22, 1.2]);
  box(group, kart.color, [2.65, 0.35, 0.55], [0, 0.72, 1.9]);
  box(group, '#f4f4df', [2.1, 0.13, 0.18], [0, 0.94, 2.19]);
  box(group, '#233940', [1.25, 0.8, 0.7], [0, 1.3, -0.55]);
  for (const x of [-1.32, 1.32])
    for (const z of [-1.12, 1.12]) {
      const wheel = cylinder(
        group,
        '#26333b',
        0.58,
        0.58,
        0.46,
        [x, 0.6, z],
        12,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.name = 'wheel';
      const hub = cylinder(group, '#c9d7d6', 0.26, 0.26, 0.48, [x, 0.6, z], 10);
      hub.rotation.z = Math.PI / 2;
    }
  cylinder(group, kart.secondary, 0.38, 0.45, 0.72, [0, 1.65, -0.18]);
  sphere(group, kart.color, 0.69, [0, 2.35, -0.22], 2);
  const visor = sphere(group, '#234b52', 0.55, [0, 2.38, 0.11], 2);
  visor.scale.set(1, 0.53, 0.75);
  sphere(group, '#effce7', 0.12, [-0.27, 2.52, 0.45]);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.055, 5, 12),
    material('#26333b'),
  );
  wheel.position.set(0, 1.62, 0.5);
  wheel.rotation.x = 0.7;
  group.add(wheel);
  for (const x of [-0.75, 0.75])
    box(group, '#26333b', [0.12, 0.7, 0.12], [x, 1.2, -1.55]);
  box(group, kart.color, [2.6, 0.15, 0.65], [0, 1.58, -1.65]);
  for (const x of [-0.6, 0.6]) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 1.5, 6),
      new THREE.MeshBasicMaterial({ color: '#8ef3ef' }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, 0.68, -2.5);
    flame.name = 'flame';
    flame.visible = false;
    group.add(flame);
    const spark = sphere(group, '#ffcb5a', 0.19, [x * 2, 0.3, -1.8]);
    spark.name = 'spark';
    spark.visible = false;
  }
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 16, 12),
    new THREE.MeshBasicMaterial({
      color: '#a6ffec',
      transparent: true,
      opacity: 0.16,
      wireframe: true,
    }),
  );
  shield.position.y = 1.1;
  shield.name = 'shield';
  shield.visible = false;
  group.add(shield);
  if (ghost)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = (child.material as THREE.Material).clone();
        (child.material as THREE.Material).transparent = true;
        (child.material as THREE.Material).opacity = 0.28;
        child.castShadow = false;
      }
    });
  batchStatic(group);
  return group;
}
function ribbon(
  track: Track,
  inner: number,
  outer: number,
  color: string,
  height: number,
  striped = false,
) {
  const points: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const count = 500,
    base = new THREE.Color(color),
    alternate = new THREE.Color('#f4f0dd');
  for (let i = 0; i <= count; i++) {
    const p = sample(track, (i / count) * track.length);
    for (const offset of [inner, outer]) {
      points.push(p.x + p.nx * offset, p.y + height, p.z + p.nz * offset);
      const c = striped && Math.floor(i / 4) % 2 === 0 ? alternate : base;
      colors.push(c.r, c.g, c.b);
    }
    if (i < count) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  road.receiveShadow = true;
  return road;
}
export class RaceScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.2, 1100);
  secondCamera = new THREE.PerspectiveCamera(65, 1, 0.2, 1100);
  world = new THREE.Group();
  track: Track = getTrack(0);
  private cars = new Map<string, THREE.Group>();
  private hazards = new Map<number, THREE.Object3D>();
  private boxes: THREE.Group[] = [];
  private coins: THREE.Object3D[] = [];
  private pads: THREE.Group[] = [];
  private ghost = makeKart(1, true);
  private observer: ResizeObserver;
  private width = 1;
  private height = 1;
  private cameraReady = false;
  private sceneTrack = -1;
  private low = false;
  private skyLight: THREE.HemisphereLight;
  private sunlight: THREE.DirectionalLight;
  private lost = false;
  private onLost: (e: Event) => void;
  private onRestored: () => void;
  constructor(
    private container: HTMLElement,
    quality: Settings['quality'],
    private onError: (message: string) => void,
  ) {
    this.low =
      quality === 'low' ||
      (quality === 'auto' &&
        (window.innerWidth < 700 ||
          matchMedia('(pointer: coarse)').matches ||
          navigator.hardwareConcurrency <= 4));
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.low,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.low ? 1.25 : 1.75),
    );
    this.renderer.shadowMap.enabled = !this.low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.setAttribute('aria-label', '3Dカートレース');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.dataset.renderer = 'three';
    container.appendChild(this.renderer.domElement);
    this.scene.add(this.world);
    this.scene.add(this.ghost);
    this.ghost.visible = false;
    this.skyLight = new THREE.HemisphereLight('#edffff', '#708b71', 2.8);
    this.scene.add(this.skyLight);
    this.sunlight = new THREE.DirectionalLight('#fff2ce', 3.5);
    this.sunlight.position.set(70, 140, 65);
    this.sunlight.castShadow = !this.low;
    this.sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sunlight.shadow.camera, {
      left: -130,
      right: 130,
      top: 130,
      bottom: -130,
      near: 1,
      far: 360,
    });
    this.sunlight.shadow.bias = -0.001;
    this.scene.add(this.sunlight);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.onLost = (e: Event) => {
      e.preventDefault();
      this.lost = true;
      this.onError(
        '3D描画が中断されました。再開できない場合は画質を「軽量」にして再読み込みしてください。',
      );
    };
    this.onRestored = () => {
      this.lost = false;
      this.onError('');
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onLost);
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.onRestored,
    );
    this.buildTrack(0);
  }
  private resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }
  buildTrack(id: number) {
    if (this.sceneTrack === id) return;
    this.sceneTrack = id;
    this.track = getTrack(id);
    this.cameraReady = false;
    this.disposeGroup(this.world);
    this.world.clear();
    this.boxes = [];
    this.coins = [];
    this.pads = [];
    const t = this.track,
      def = t.definition,
      night = id === 2;
    this.scene.background = new THREE.Color(def.sky);
    this.scene.fog = new THREE.Fog(def.sky, 170, 480);
    this.skyLight.intensity = 1.5;
    this.sunlight.intensity = night ? 1.3 : 2;
    cylinder(
      this.world,
      night ? '#213c57' : '#76cbd0',
      450,
      450,
      2,
      [0, -8, 0],
      96,
    );
    cylinder(
      this.world,
      night ? '#364d61' : '#e7d9a8',
      118,
      122,
      5,
      [0, -4, 0],
      64,
    );
    const island = cylinder(
      this.world,
      def.ground,
      113,
      117,
      4,
      [0, -0.9, 0],
      64,
    );
    island.rotation.y = 0.04;
    const w = def.width / 2;
    this.world.add(
      ribbon(t, -w - 1.4, w + 1.4, night ? '#ad90ef' : '#d8ccb3', -0.1),
    );
    this.world.add(ribbon(t, -w, w, def.road, 0.02));
    this.world.add(ribbon(t, -w - 0.65, -w + 0.04, def.color, 0.055, true));
    this.world.add(ribbon(t, w - 0.04, w + 0.65, def.color, 0.055, true));
    for (let s = 0; s < t.length; s += 7) {
      const p = position(t, s, 0),
        dash = box(
          this.world,
          '#ebe5d2',
          [0.17, 0.025, 2.3],
          [p.x, p.y + 0.06, p.z],
        );
      dash.rotation.y = p.heading;
      if (p.y > 6 && Math.floor(s / 7) % 3 === 0) {
        cylinder(this.world, night ? '#66768d' : '#c4b699', 1.2, 1.8, p.y, [
          p.x,
          p.y / 2 - 1,
          p.z,
        ]);
      }
    }
    for (let s = 9; s < t.length; s += 11)
      for (const side of [-1, 1]) {
        const p = position(t, s, (w + 1.4) * side);
        const rail = box(
          this.world,
          night ? '#b1a3f3' : '#f5edcf',
          [0.22, 0.45, 5],
          [p.x, p.y + 0.65, p.z],
        );
        rail.rotation.y = p.heading;
        if (Math.floor(s) % 3 === 0)
          cylinder(
            this.world,
            '#637f74',
            0.12,
            0.12,
            1.1,
            [p.x, p.y + 0.5, p.z],
            5,
          );
      }
    const start = position(t, 0, 0),
      gantry = new THREE.Group();
    gantry.position.set(start.x, start.y, start.z);
    gantry.rotation.y = start.heading;
    for (const x of [-w - 0.9, w + 0.9]) {
      box(gantry, night ? '#ba9de6' : '#f8f0d8', [0.55, 7, 0.65], [x, 3.5, 0]);
      box(gantry, def.color, [1, 1.7, 1], [x, 0.85, 0]);
    }
    box(gantry, def.color, [def.width + 2.6, 2.1, 0.7], [0, 7, 0]);
    const sign = textSign(
      'K A R T L I N E',
      def.color,
      '#ffffff',
      def.width + 1,
      1.8,
    );
    sign.position.set(0, 7, 0.37);
    gantry.add(sign);
    const rearSign = sign.clone();
    rearSign.position.z = -0.37;
    rearSign.rotation.y = Math.PI;
    gantry.add(rearSign);
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 2; j++)
        box(
          gantry,
          (i + j) % 2 ? '#fbf9ee' : '#30423d',
          [def.width / 12, 0.035, 0.7],
          [-w + def.width / 24 + (i * def.width) / 12, 0.07, -0.7 + j * 0.7],
        );
    this.world.add(gantry);
    for (const fraction of def.boxes)
      for (const offset of [-3.6, 0, 3.6]) {
        const p = position(t, fraction * t.length, offset),
          group = new THREE.Group();
        group.position.set(p.x, p.y + 1.7, p.z);
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(1.65, 1.65, 1.65),
          new THREE.MeshStandardMaterial({
            color: '#abefdb',
            emissive: '#38b89d',
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.85,
            roughness: 0.25,
          }),
        );
        cube.rotation.set(0.2, Math.PI / 4, 0.1);
        group.add(cube);
        const q = textSign('?', '#3fae9e', '#ffffff', 1.15, 1.15);
        for (let face = 0; face < 4; face++) {
          const label = face === 0 ? q : q.clone();
          const angle = (face * Math.PI) / 2;
          label.position.set(Math.sin(angle) * 0.84, 0, Math.cos(angle) * 0.84);
          label.rotation.y = angle;
          cube.add(label);
        }
        this.world.add(group);
        this.boxes.push(group);
      }
    for (const fraction of def.pads) {
      const p = position(t, fraction * t.length, 0),
        group = new THREE.Group();
      group.position.set(p.x, p.y + 0.09, p.z);
      group.rotation.y = p.heading;
      box(group, '#e8c44f', [6, 0.08, 4], [0, 0, 0]);
      for (const z of [-1, 0, 1]) {
        const arrow = textSign('› › ›', '#e8c44f', '#fffce0', 5.3, 0.7);
        arrow.rotation.x = -Math.PI / 2;
        arrow.rotation.z = Math.PI / 2;
        arrow.position.set(0, 0.06, z);
        group.add(arrow);
      }
      this.world.add(group);
      this.pads.push(group);
    }
    for (let i = 1; i < 18; i++) {
      const p = position(t, (i / 18) * t.length, 0),
        coin = cylinder(
          this.world,
          '#ffd65b',
          0.5,
          0.5,
          0.16,
          [p.x, p.y + 1.4, p.z],
          12,
        );
      coin.rotation.x = Math.PI / 2;
      this.coins.push(coin);
    }
    let seed = 98732;
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: '#fff2b8',
      emissive: '#ffd986',
      emissiveIntensity: 1.2,
    });
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 200; i++) {
      const x = (rand() - 0.5) * 220,
        z = (rand() - 0.5) * 210;
      if (
        x * x + z * z > 108 * 108 ||
        t.samples.some(
          (p, j) => j % 8 === 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < 230,
        )
      )
        continue;
      const h = 5 + rand() * 9,
        object = new THREE.Group();
      object.position.set(x, 1.1, z);
      if (night) {
        const buildingWidth = 3 + rand() * 5,
          buildingDepth = 4 + rand() * 4;
        box(
          object,
          ['#607086', '#596983', '#788093'][i % 3],
          [buildingWidth, h * 1.6, buildingDepth],
          [0, h * 0.8, 0],
        );
        for (let level = 2; level < h * 1.6; level += 2.7)
          for (const side of [-1, 1]) {
            const window = box(
              object,
              '#fff2b8',
              [buildingWidth * 0.22, 0.7, 0.08],
              [side * buildingWidth * 0.25, level, buildingDepth / 2 + 0.05],
            );
            window.material = windowMaterial;
          }
      } else if (id === 0 && i % 3 === 0) {
        const trunk = cylinder(
          object,
          '#bd9165',
          0.3,
          0.65,
          h,
          [0, h / 2, 0],
          6,
        );
        trunk.rotation.z = 0.08;
        for (let j = 0; j < 6; j++) {
          const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(1.2, 6, 3),
            material('#438f66'),
          );
          leaf.position.set(Math.sin(j) * 1.7, h, Math.cos(j) * 1.7);
          leaf.rotation.set(Math.cos(j) * 1.25, 0, Math.sin(j) * 1.25);
          object.add(leaf);
        }
      } else {
        cylinder(object, '#8f7756', 0.35, 0.55, h * 0.65, [0, h * 0.3, 0], 6);
        if (id === 1) {
          sphere(object, ['#deab53', '#d9844b', '#b56d4c'][i % 3], h * 0.37, [
            0,
            h * 0.77,
            0,
          ]);
          sphere(object, '#e4b45f', h * 0.27, [h * 0.22, h * 0.6, 0]);
        } else {
          cylinder(
            object,
            '#4a9c73',
            0,
            h * 0.35,
            h * 0.7,
            [0, h * 0.65, 0],
            7,
          );
          cylinder(
            object,
            '#65ae7c',
            0,
            h * 0.27,
            h * 0.6,
            [0, h * 0.95, 0],
            7,
          );
        }
      }
      this.world.add(object);
    }
    for (const [x, z, r, h] of [
      [-23, -13, 18, 29],
      [12, -25, 14, 22],
      [-16, 22, 11, 15],
    ]) {
      const peak = cylinder(
        this.world,
        night ? '#516581' : id === 1 ? '#a6987d' : '#91b392',
        0,
        r,
        h,
        [x, h / 2, z],
        5,
      );
      peak.rotation.y = 0.5;
      if (!night)
        cylinder(
          this.world,
          '#eee8d1',
          0,
          r * 0.28,
          h * 0.28,
          [x, h * 0.87, z],
          5,
        );
    }
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Group();
      cloud.position.set(
        Math.sin(i * 2.3) * 150,
        48 + (i % 3) * 10,
        Math.cos(i * 2.3) * 150,
      );
      for (let j = 0; j < 3; j++) {
        const puff = sphere(
          cloud,
          night ? '#7e8da7' : '#ffffff',
          5 + j,
          [j * 6, Math.sin(j) * 2, 0],
          1,
        );
        puff.scale.y = 0.55;
        puff.castShadow = false;
      }
      this.world.add(cloud);
    }
    for (let i = 0; i < 8; i++) {
      const p = position(t, ((i + 0.5) / 8) * t.length, w + 2.8),
        g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.heading;
      cylinder(g, '#4e6964', 0.1, 0.1, 5, [0, 2.5, 0], 5);
      const flag = box(
        g,
        i % 2 ? '#f2ca61' : '#f07659',
        [1.9, 1.5, 0.08],
        [0.85, 4.1, 0],
      );
      flag.rotation.y = 0.25;
      this.world.add(g);
    }
    batchStatic(
      this.world,
      new Set([...this.boxes, ...this.coins, ...this.pads]),
    );
  }
  private updateCar(
    id: string,
    kart: number,
    s: number,
    offset: number,
    yaw: number,
    boost: number,
    charge: number,
    shield: number,
    spin: number,
    dt: number,
    smooth: boolean,
  ) {
    let car = this.cars.get(id);
    if (!car || car.userData.kart !== kart) {
      if (car) {
        this.scene.remove(car);
        this.disposeGroup(car);
      }
      car = makeKart(kart);
      car.userData.kart = kart;
      this.cars.set(id, car);
      this.scene.add(car);
    }
    const p = position(this.track, s, offset),
      target = new THREE.Vector3(p.x, p.y + 0.12, p.z);
    if (smooth && car.userData.ready)
      car.position.lerp(target, Math.min(1, dt * 18));
    else car.position.copy(target);
    const heading = p.heading + yaw + (spin > 0 ? spin * 15 : 0);
    car.rotation.y +=
      THREE.MathUtils.euclideanModulo(
        heading - car.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    car.rotation.z = -yaw * 0.12;
    car.userData.ready = true;
    car.children.forEach((child) => {
      if (child.name === 'flame') {
        child.visible = boost > 0;
        child.scale.y = 0.8 + Math.sin(performance.now() * 0.04) * 0.3;
      }
      if (child.name === 'spark') child.visible = charge > 0.65;
      if (child.name === 'shield') child.visible = shield > 0;
    });
    return car;
  }
  render(
    state: RaceState | null,
    localIds: string[],
    dt: number,
    ghost: GhostPoint[] | null = null,
  ) {
    if (this.lost || !this.width || !this.height) return;
    const time = performance.now() / 1000,
      demo = !state;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = demo ? 470 : 170;
      this.scene.fog.far = demo ? 850 : 480;
    }
    if (state) this.buildTrack(state.config.track);
    const validIds = new Set<string>();
    if (demo) {
      for (const car of this.cars.values()) car.visible = true;
      for (let i = 0; i < 6; i++) {
        const id = `demo-${i}`;
        validIds.add(id);
        this.updateCar(
          id,
          i,
          time * 16 - i * 8,
          Math.sin(i * 2) * 2,
          0,
          0,
          0,
          0,
          0,
          dt,
          false,
        );
      }
    } else
      for (const r of state.racers) {
        validIds.add(r.id);
        this.updateCar(
          r.id,
          r.kart,
          r.s,
          r.offset,
          r.yaw,
          r.boost,
          r.driftCharge,
          r.shield,
          r.spin,
          dt,
          state.config.mode === 'online',
        );
      }
    for (const [id, car] of this.cars)
      if (!validIds.has(id)) {
        this.scene.remove(car);
        this.disposeGroup(car);
        this.cars.delete(id);
      }
    this.boxes.forEach((g, i) => {
      g.rotation.y = time * 0.7 + i;
      g.children[0].position.y = Math.sin(time * 2 + i) * 0.17;
      g.visible = state?.config.mode !== 'time';
    });
    this.coins.forEach((c) => {
      c.rotation.z = time * 2;
      c.visible = state?.config.mode !== 'time';
    });
    this.pads.forEach((p) => (p.visible = state?.config.mode !== 'time'));
    const hazardIds = new Set<number>();
    for (const h of state?.hazards ?? []) {
      hazardIds.add(h.id);
      let object = this.hazards.get(h.id);
      if (!object) {
        object = new THREE.Group();
        if (h.kind === 'mine') {
          cylinder(object, '#ffbb59', 0, 0.9, 1.4, [0, 0.6, 0], 4);
        } else {
          sphere(object, '#ec785e', 0.7, [0, 0.7, 0]);
        }
        this.scene.add(object);
        this.hazards.set(h.id, object);
      }
      const p = position(this.track, h.s, h.offset);
      object.position.set(p.x, p.y + 0.3, p.z);
      object.rotation.y = p.heading;
    }
    for (const [id, object] of this.hazards)
      if (!hazardIds.has(id)) {
        this.scene.remove(object);
        this.disposeGroup(object);
        this.hazards.delete(id);
      }
    this.ghost.visible = false;
    if (state && ghost?.length) {
      let i = ghost.findIndex((p) => p.t >= state.time);
      if (i < 0) i = ghost.length - 1;
      const a = ghost[Math.max(0, i - 1)],
        b = ghost[i],
        f =
          b.t === a.t
            ? 0
            : THREE.MathUtils.clamp((state.time - a.t) / (b.t - a.t), 0, 1);
      const p = position(
        this.track,
        a.s + (b.s - a.s) * f,
        a.offset + (b.offset - a.offset) * f,
      );
      this.ghost.position.set(p.x, p.y + 0.1, p.z);
      this.ghost.rotation.y = p.heading + a.yaw;
      this.ghost.visible = true;
    }
    const split = state?.config.mode === 'local' && localIds.length > 1;
    this.renderer.setScissorTest(!!split);
    if (demo) {
      this.camera.fov = 42;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      const orbit = time * 0.015;
      this.camera.position.set(
        Math.sin(0.72 + orbit) * 255,
        180,
        Math.cos(0.72 + orbit) * 255,
      );
      this.camera.lookAt(0, 0, 0);
      this.cameraReady = false;
      this.renderer.setViewport(0, 0, this.width, this.height);
      this.renderer.render(this.scene, this.camera);
    } else {
      const count = split ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const camera = i === 0 ? this.camera : this.secondCamera,
          r = state.racers.find((r) => r.id === localIds[i]) ?? state.racers[0];
        if (!r) continue;
        const p = position(this.track, r.s, r.offset),
          target = position(this.track, r.s + 15, r.offset * 0.7),
          behind = position(
            this.track,
            r.s - (r.boost > 0 ? 10.5 : 9),
            r.offset * 0.9,
          );
        const wanted = new THREE.Vector3(
          behind.x,
          Math.max(p.y + 5.5, behind.y + 4.7),
          behind.z,
        );
        if (this.cameraReady)
          camera.position.lerp(wanted, 1 - Math.exp(-dt * 7));
        else camera.position.copy(wanted);
        camera.lookAt(target.x, target.y + 1.6, target.z);
        camera.fov = r.boost > 0 ? 72 : 65;
        for (const [id, car] of this.cars)
          car.visible =
            id === r.id ||
            Math.hypot(
              car.position.x - camera.position.x,
              car.position.z - camera.position.z,
            ) > 7;
        const viewWidth = split ? this.width / 2 : this.width;
        camera.aspect = viewWidth / this.height;
        camera.updateProjectionMatrix();
        this.renderer.setViewport(i * viewWidth, 0, viewWidth, this.height);
        this.renderer.setScissor(i * viewWidth, 0, viewWidth, this.height);
        this.renderer.render(this.scene, camera);
      }
      this.cameraReady = true;
    }
    this.renderer.setScissorTest(false);
  }
  private disposeGroup(group: THREE.Object3D) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of mats)
          if (![...materials.values()].includes(mat)) {
            if ('map' in mat && mat.map) mat.map.dispose();
            mat.dispose();
          }
      }
    });
  }
  dispose() {
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.onLost,
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.onRestored,
    );
    this.disposeGroup(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
