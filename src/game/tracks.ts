import { CatmullRomCurve3, Vector3 } from 'three';

export interface TrackSection {
  from: number;
  to: number;
  name: string;
  kind: 'road' | 'bridge' | 'tunnel' | 'boardwalk';
  width?: number;
}
export interface TrackJump {
  at: number;
  length: number;
  height: number;
  offset: number;
  width: number;
}
export interface TrackObstacle {
  at: number;
  offset: number;
  radius: number;
  kind: 'barrels' | 'rocks' | 'barrier';
}
export interface BoostPad {
  at: number;
  offset: number;
  width: number;
}
export interface TrackDefinition {
  id: number;
  name: string;
  subtitle: string;
  tag: string;
  description: string;
  color: string;
  sky: string;
  ground: string;
  road: string;
  difficulty: string;
  points: number[][];
  width: number;
  boxes: number[];
  pads: BoostPad[];
  sections: TrackSection[];
  jumps: TrackJump[];
  obstacles: TrackObstacle[];
}
export const TRACKS: TrackDefinition[] = [
  {
    id: 0,
    name: 'サンシャイン・コースト',
    subtitle: 'SUNSHINE COAST',
    tag: '01 / COAST',
    description: '港のS字、灯台ヘアピン、桟橋からの大ジャンプ。',
    color: '#3eae9f',
    sky: '#b9e6e8',
    ground: '#80bd8a',
    road: '#737b79',
    difficulty: '★☆☆',
    width: 15,
    points: [
      [-20, 3, 105],
      [42, 3, 105],
      [82, 4, 88],
      [99, 5, 53],
      [76, 5, 29],
      [88, 7, -5],
      [112, 9, -29],
      [103, 10, -65],
      [61, 8, -90],
      [10, 5, -93],
      [-19, 4, -61],
      [-9, 4, -20],
      [-36, 4, 0],
      [-66, 4, -21],
      [-64, 3, -60],
      [-103, 3, -75],
      [-130, 3, -48],
      [-121, 3, 4],
      [-98, 3, 42],
      [-103, 3, 77],
      [-67, 3, 101],
    ],
    boxes: [0.09, 0.38, 0.67, 0.9],
    pads: [
      { at: 0.25, offset: -2.5, width: 5 },
      { at: 0.61, offset: 3.3, width: 4 },
      { at: 0.92, offset: 0, width: 6 },
    ],
    sections: [
      { from: 0, to: 0.14, name: 'マリーナ・ストレート', kind: 'road' },
      { from: 0.14, to: 0.26, name: 'ハーバーS字', kind: 'road' },
      {
        from: 0.26,
        to: 0.35,
        name: 'ピア・ジャンプ',
        kind: 'boardwalk',
        width: 12,
      },
      { from: 0.35, to: 0.48, name: 'シーブリーズ', kind: 'road' },
      { from: 0.48, to: 0.7, name: '灯台ヘアピン', kind: 'road' },
      { from: 0.7, to: 0.87, name: 'ビーチサイド', kind: 'road', width: 17 },
      { from: 0.87, to: 1, name: 'フィニッシュ・カーブ', kind: 'road' },
    ],
    jumps: [{ at: 0.29, length: 12, height: 2.2, offset: -2, width: 7 }],
    obstacles: [
      { at: 0.18, offset: 4, radius: 1.2, kind: 'barrels' },
      { at: 0.78, offset: -4.8, radius: 1.4, kind: 'barrels' },
    ],
  },
  {
    id: 1,
    name: 'メープル・ハイランド',
    subtitle: 'MAPLE HIGHLAND',
    tag: '02 / HIGHLAND',
    description: '連続つづら折り。渓谷の吊り橋と岩山トンネルへ。',
    color: '#c7804b',
    sky: '#f4dbb9',
    ground: '#b2b075',
    road: '#827970',
    difficulty: '★★☆',
    width: 14,
    points: [
      [0, 4, 106],
      [56, 5, 106],
      [103, 10, 82],
      [107, 16, 40],
      [67, 21, 16],
      [27, 23, 32],
      [0, 25, 6],
      [29, 28, -23],
      [67, 28, -23],
      [98, 25, -54],
      [77, 20, -95],
      [21, 14, -106],
      [-30, 12, -87],
      [-16, 17, -50],
      [-36, 20, -19],
      [-71, 18, -36],
      [-103, 11, -70],
      [-134, 7, -38],
      [-119, 6, 13],
      [-77, 6, 41],
      [-85, 4, 84],
      [-43, 4, 105],
    ],
    boxes: [0.08, 0.31, 0.6, 0.89],
    pads: [
      { at: 0.24, offset: -3, width: 4 },
      { at: 0.49, offset: 2.5, width: 4 },
      { at: 0.82, offset: 0, width: 6 },
    ],
    sections: [
      { from: 0, to: 0.18, name: 'リッジ・クライム', kind: 'road' },
      { from: 0.18, to: 0.3, name: '天空ヘアピン', kind: 'road' },
      {
        from: 0.3,
        to: 0.36,
        name: 'メープル吊り橋',
        kind: 'bridge',
        width: 10.5,
      },
      { from: 0.36, to: 0.47, name: 'サミット・ターン', kind: 'road' },
      { from: 0.47, to: 0.56, name: 'ロックトンネル', kind: 'tunnel' },
      { from: 0.56, to: 0.79, name: 'ダブル・スイッチバック', kind: 'road' },
      { from: 0.79, to: 1, name: 'フォレスト・ダウンヒル', kind: 'road' },
    ],
    jumps: [{ at: 0.84, length: 10, height: 2.6, offset: 0, width: 8 }],
    obstacles: [
      { at: 0.59, offset: -4.5, radius: 1.3, kind: 'rocks' },
      { at: 0.74, offset: 4.5, radius: 1.4, kind: 'rocks' },
    ],
  },
  {
    id: 2,
    name: 'スターライト・シティ',
    subtitle: 'STARLIGHT CITY',
    tag: '03 / NIGHT',
    description: '立体交差の8の字。ネオンの高速橋から市街地へ。',
    color: '#8f84d4',
    sky: '#192c49',
    ground: '#34485c',
    road: '#465168',
    difficulty: '★★★',
    width: 14,
    points: [
      [0, 4, 100],
      [55, 4, 100],
      [102, 6, 80],
      [115, 9, 36],
      [78, 14, 4],
      [20, 19, -7],
      [-42, 20, 15],
      [-100, 18, 34],
      [-134, 12, 4],
      [-122, 9, -48],
      [-74, 6, -83],
      [-24, 4, -84],
      [2, 3, -47],
      [0, 3, 0],
      [0, 3, 39],
      [-43, 3, 53],
      [-63, 4, 78],
      [-37, 4, 100],
    ],
    boxes: [0.07, 0.28, 0.54, 0.8],
    pads: [
      { at: 0.27, offset: -3, width: 4 },
      { at: 0.36, offset: 3, width: 4 },
      { at: 0.71, offset: 0, width: 5 },
    ],
    sections: [
      {
        from: 0,
        to: 0.16,
        name: 'ネオン・ブールバード',
        kind: 'road',
        width: 17,
      },
      { from: 0.16, to: 0.24, name: 'ライト・トンネル', kind: 'tunnel' },
      { from: 0.24, to: 0.43, name: 'スカイライン立体交差', kind: 'bridge' },
      { from: 0.43, to: 0.6, name: 'ミッドナイト・ループ', kind: 'road' },
      { from: 0.6, to: 0.79, name: 'アンダーパス', kind: 'road' },
      { from: 0.79, to: 1, name: 'ダウンタウン・シケイン', kind: 'road' },
    ],
    jumps: [{ at: 0.72, length: 11, height: 2, offset: 0, width: 7 }],
    obstacles: [
      { at: 0.84, offset: 4.3, radius: 1.5, kind: 'barrier' },
      { at: 0.91, offset: -4.3, radius: 1.5, kind: 'barrier' },
    ],
  },
];
export interface TrackSample {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  heading: number;
  curvature: number;
  slope: number;
  bank: number;
  width: number;
}
export interface Track {
  definition: TrackDefinition;
  length: number;
  samples: TrackSample[];
}
const cache = new Map<number, Track>();
export function getTrack(id: number): Track {
  if (cache.has(id)) return cache.get(id)!;
  const definition = TRACKS[id] ?? TRACKS[0];
  const controls = definition.points.map((p) => new Vector3(p[0], p[1], p[2]));
  const rounded: Vector3[] = [];
  // A periodic cubic B-spline keeps the inside edge of a wide hairpin from folding.
  for (let i = 0; i < controls.length; i++)
    for (let step = 0; step < 8; step++) {
      const t = step / 8,
        t2 = t * t,
        t3 = t2 * t;
      const weights = [
        (1 - t) ** 3,
        3 * t3 - 6 * t2 + 4,
        -3 * t3 + 3 * t2 + 3 * t + 1,
        t3,
      ];
      const point = new Vector3();
      for (let k = 0; k < 4; k++)
        point.addScaledVector(
          controls[wrap(i + k - 1, controls.length)],
          weights[k] / 6,
        );
      rounded.push(point);
    }
  const curve = new CatmullRomCurve3(rounded, true, 'centripetal');
  curve.arcLengthDivisions = 2400;
  const length = curve.getLength();
  const samples: TrackSample[] = [];
  for (let i = 0; i < 1000; i++) {
    const t = i / 1000;
    const p = curve.getPointAt(t),
      tangent = curve.getTangentAt(t).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);
    const horizontal = Math.hypot(tangent.x, tangent.z);
    const next = curve.getTangentAt((t + 0.001) % 1);
    const curvature =
      -angle(Math.atan2(next.x, next.z) - heading) / (length / 1000);
    let width = definition.width;
    for (const section of definition.sections) {
      if (t >= section.from && t <= section.to && section.width) {
        const edge = Math.min(
          1,
          (t - section.from) / 0.015,
          (section.to - t) / 0.015,
        );
        width += (section.width - definition.width) * Math.max(0, edge);
      }
    }
    samples.push({
      x: p.x,
      y: p.y,
      z: p.z,
      tx: tangent.x / horizontal,
      tz: tangent.z / horizontal,
      nx: -tangent.z / horizontal,
      nz: tangent.x / horizontal,
      heading,
      curvature,
      slope: Math.atan2(tangent.y, horizontal),
      bank: Math.max(-0.14, Math.min(0.14, curvature * 2.2)),
      width,
    });
  }
  const track = { definition, length, samples };
  cache.set(id, track);
  return track;
}
export function wrap(n: number, max: number) {
  return ((n % max) + max) % max;
}
export function angle(n: number) {
  return wrap(n + Math.PI, Math.PI * 2) - Math.PI;
}
export function sample(track: Track, s: number): TrackSample {
  const index = (wrap(s, track.length) / track.length) * track.samples.length;
  const a = track.samples[Math.floor(index)],
    b = track.samples[(Math.floor(index) + 1) % track.samples.length],
    f = index % 1;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
    tx: a.tx + (b.tx - a.tx) * f,
    tz: a.tz + (b.tz - a.tz) * f,
    nx: a.nx + (b.nx - a.nx) * f,
    nz: a.nz + (b.nz - a.nz) * f,
    heading: a.heading + angle(b.heading - a.heading) * f,
    curvature: a.curvature + (b.curvature - a.curvature) * f,
    slope: a.slope + (b.slope - a.slope) * f,
    bank: a.bank + (b.bank - a.bank) * f,
    width: a.width + (b.width - a.width) * f,
  };
}
export function position(track: Track, s: number, offset: number) {
  const p = sample(track, s);
  const ramp = rampSurface(track, s, offset);
  return {
    x: p.x + p.nx * offset,
    y: p.y - Math.tan(p.bank) * offset + ramp.height,
    z: p.z + p.nz * offset,
    heading: p.heading,
    slope: Math.atan(Math.tan(p.slope) + ramp.gradient),
    bank: p.bank,
  };
}

function rampSurface(track: Track, s: number, offset: number) {
  const progress = wrap(s, track.length);
  for (const ramp of track.definition.jumps) {
    const start = ramp.at * track.length - ramp.length;
    if (
      progress >= start &&
      progress < start + ramp.length &&
      Math.abs(offset - ramp.offset) < ramp.width / 2
    )
      return {
        height: ramp.height * ((progress - start) / ramp.length) ** 1.4,
        gradient:
          ((1.4 * ramp.height) / ramp.length) *
          ((progress - start) / ramp.length) ** 0.4,
      };
  }
  return { height: 0, gradient: 0 };
}

export function sectionAt(track: Track, s: number) {
  const fraction = wrap(s, track.length) / track.length;
  return track.definition.sections.find(
    (section) => fraction >= section.from && fraction < section.to,
  )!;
}
