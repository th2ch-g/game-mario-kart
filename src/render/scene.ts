import * as THREE from 'three';
import { getTrack, position, sample, type Track } from '../game/tracks';
import type { GhostPoint, RaceState, Settings } from '../game/types';
import {
  batchStatic,
  box,
  cylinder,
  materials,
  material,
  sphere,
  textSign,
} from './primitives';
import { animateKart, makeKart } from './kart';
import { buildCourseFeatures, buildRoadFoundation } from './features';
import { makeHazard } from './items';
import { driftStage } from '../game/engine';

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
      const lane = (offset * p.width) / track.definition.width;
      points.push(
        p.x + p.nx * lane,
        p.y - Math.tan(p.bank) * lane + height,
        p.z + p.nz * lane,
      );
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
      183,
      188,
      5,
      [0, -4, 0],
      64,
    );
    const island = cylinder(
      this.world,
      def.ground,
      177,
      183,
      4,
      [0, -0.9, 0],
      64,
    );
    island.rotation.y = 0.04;
    const w = def.width / 2;
    buildRoadFoundation(this.world, t);
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
    }
    for (let s = 9; s < t.length; s += 11)
      for (const side of [-1, 1]) {
        const p = position(t, s, (sample(t, s).width / 2 + 1.4) * side);
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
    for (const pad of def.pads) {
      const p = position(t, pad.at * t.length, pad.offset),
        group = new THREE.Group();
      group.position.set(p.x, p.y + 0.09, p.z);
      group.rotation.y = p.heading;
      group.rotation.x = -p.slope;
      group.rotation.z = p.bank;
      box(group, '#e8c44f', [pad.width, 0.08, 5], [0, 0, 0]);
      for (const z of [-1, 0, 1]) {
        const arrow = textSign(
          '› › ›',
          '#e8c44f',
          '#fffce0',
          pad.width * 0.85,
          0.7,
        );
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
    for (let i = 0; i < 330; i++) {
      const x = (rand() - 0.5) * 340,
        z = (rand() - 0.5) * 320;
      if (
        x * x + z * z > 174 * 174 ||
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
      } else if (id === 0) {
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
      [16, 47, 13, 23],
      [48, -53, 12, 20],
      [-68, 6, 9, 13],
    ]) {
      if (
        t.samples.some(
          (p, i) => i % 4 === 0 && Math.hypot(p.x - x, p.z - z) < r + 12,
        )
      )
        continue;
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
    buildCourseFeatures(this.world, t);
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
    speed = 16,
    steer = 0,
    lift = 0,
    verticalSpeed = 0,
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
      target = new THREE.Vector3(p.x, p.y + 0.05 + lift, p.z);
    if (smooth && car.userData.ready)
      car.position.lerp(target, Math.min(1, dt * 18));
    else car.position.copy(target);
    const heading = p.heading - yaw + (spin > 0 ? spin * 15 : 0);
    car.rotation.y +=
      THREE.MathUtils.euclideanModulo(
        heading - car.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    car.rotation.x =
      lift > 0
        ? -Math.atan2(verticalSpeed, Math.max(12, speed)) * 0.55
        : -p.slope;
    car.rotation.z = p.bank + steer * (charge > 0 ? 0.07 : 0.025);
    animateKart(car, speed, steer, charge > 0, dt);
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
        const car = this.updateCar(
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
          r.speed,
          r.steer,
          r.lift + Math.sin((r.hop / 0.3) * Math.PI) * 0.45,
          r.verticalSpeed,
        );
        car.scale.setScalar(r.shrink > 0 ? 0.62 : 1);
        if (r.trick)
          car.rotation.y +=
            Math.PI *
            2 *
            (r.trickProgress * r.trickProgress * (3 - 2 * r.trickProgress));
        for (const part of car.children) {
          if (part.name === 'star-ring') {
            part.visible = r.star > 0;
            part.rotation.y = time * 5;
          }
          if (part.name === 'bullet-body') part.visible = r.bullet > 0;
          if (['chassis', 'front-wheel', 'rear-wheel'].includes(part.name))
            part.visible = r.bullet <= 0;
          if (part.name === 'flame') part.visible = r.boost > 0 || r.bullet > 0;
          if (part.name === 'spark' && part instanceof THREE.Mesh) {
            part.visible = driftStage(r.driftCharge) > 0;
            const color = ['#ffd158', '#61d4ff', '#ff9c43', '#cc77ff'][
              driftStage(r.driftCharge)
            ];
            (part.material as THREE.MeshStandardMaterial).color.set(color);
            part.scale.setScalar(
              0.8 +
                Math.sin(time * 35) * 0.35 +
                driftStage(r.driftCharge) * 0.25,
            );
          }
        }
        let guard = car.getObjectByName('guard');
        if (guard && guard.userData.kind !== r.item) {
          guard.removeFromParent();
          this.disposeGroup(guard);
          guard = undefined;
        }
        if (
          r.defending &&
          !guard &&
          r.item &&
          ['mine', 'green', 'rocket'].includes(r.item)
        ) {
          guard = makeHazard(r.item as 'mine' | 'green' | 'rocket');
          guard.name = 'guard';
          guard.userData.kind = r.item;
          guard.position.set(0, 0, -2.8);
          car.add(guard);
        }
        if (guard) guard.visible = r.defending;
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
    this.pads.forEach((p) => (p.visible = true));
    const hazardIds = new Set<number>();
    for (const h of state?.hazards ?? []) {
      hazardIds.add(h.id);
      let object = this.hazards.get(h.id);
      if (!object) {
        object = makeHazard(h.kind);
        this.scene.add(object);
        this.hazards.set(h.id, object);
      }
      const p = position(this.track, h.s, h.offset);
      object.position.set(p.x, p.y + (h.kind === 'blue' ? 1.7 : 0.05), p.z);
      object.rotation.y = p.heading + (h.kind === 'mine' ? 0 : time * 8);
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
      this.ghost.position.set(
        p.x,
        p.y + 0.05 + (a.lift ?? 0) * (1 - f) + (b.lift ?? 0) * f,
        p.z,
      );
      this.ghost.rotation.y = p.heading - a.yaw;
      this.ghost.rotation.x = -p.slope;
      this.ghost.rotation.z = p.bank;
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
        Math.sin(0.72 + orbit) * 365,
        250,
        Math.cos(0.72 + orbit) * 365,
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
          ahead = sample(this.track, r.s + 12),
          heading = p.heading - r.yaw * 0.35,
          distance = r.boost > 0 ? 10.8 : 9.8;
        const wanted = new THREE.Vector3(
          p.x - Math.sin(heading) * distance,
          p.y + 4.5 + r.lift * 0.65,
          p.z - Math.cos(heading) * distance,
        );
        if (this.cameraReady)
          camera.position.lerp(wanted, 1 - Math.exp(-dt * 7));
        else camera.position.copy(wanted);
        camera.lookAt(
          p.x + Math.sin(heading) * 15,
          ahead.y + 1.3 + r.lift * 0.4,
          p.z + Math.cos(heading) * 15,
        );
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
