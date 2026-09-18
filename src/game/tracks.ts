import { CatmullRomCurve3, Vector3 } from 'three';

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
  pads: number[];
}
export const TRACKS: TrackDefinition[] = [
  {
    id: 0,
    name: 'サンシャイン・コースト',
    subtitle: 'SUNSHINE COAST',
    tag: '01 / COAST',
    description: '潮風とヤシの木。冒険はこの島から。',
    color: '#3eae9f',
    sky: '#b9e6e8',
    ground: '#80bd8a',
    road: '#737b79',
    difficulty: '★☆☆',
    width: 13,
    points: [
      [0, 2, 66],
      [54, 2, 57],
      [86, 3, 10],
      [58, 6, -51],
      [4, 3, -67],
      [-51, 2, -48],
      [-84, 2, -4],
      [-50, 3, 51],
    ],
    boxes: [0.15, 0.49, 0.77],
    pads: [0.31, 0.87],
  },
  {
    id: 1,
    name: 'メープル・ハイランド',
    subtitle: 'MAPLE HIGHLAND',
    tag: '02 / HIGHLAND',
    description: '森を抜け、橋を渡り、空へ駆け上がる。',
    color: '#c7804b',
    sky: '#f4dbb9',
    ground: '#b2b075',
    road: '#827970',
    difficulty: '★★☆',
    width: 12,
    points: [
      [0, 4, 73],
      [62, 9, 58],
      [83, 16, 13],
      [35, 19, -14],
      [59, 10, -59],
      [7, 5, -83],
      [-57, 4, -67],
      [-81, 11, -18],
      [-43, 14, 19],
      [-56, 6, 59],
    ],
    boxes: [0.12, 0.4, 0.7],
    pads: [0.25, 0.57, 0.86],
  },
  {
    id: 2,
    name: 'スターライト・シティ',
    subtitle: 'STARLIGHT CITY',
    tag: '03 / NIGHT',
    description: 'ネオンを追い越す、眠らないサーキット。',
    color: '#8f84d4',
    sky: '#192c49',
    ground: '#34485c',
    road: '#465168',
    difficulty: '★★★',
    width: 12,
    points: [
      [0, 7, 79],
      [58, 7, 76],
      [83, 8, 32],
      [52, 13, 2],
      [82, 17, -41],
      [40, 14, -76],
      [-24, 7, -67],
      [-76, 7, -70],
      [-83, 11, -13],
      [-40, 14, 20],
      [-63, 8, 60],
    ],
    boxes: [0.13, 0.43, 0.74],
    pads: [0.27, 0.6, 0.89],
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
  const curve = new CatmullRomCurve3(
    definition.points.map((p) => new Vector3(p[0], p[1], p[2])),
    true,
    'catmullrom',
    0.45,
  );
  curve.arcLengthDivisions = 2400;
  const length = curve.getLength();
  const samples: TrackSample[] = [];
  for (let i = 0; i < 1000; i++) {
    const t = i / 1000;
    const p = curve.getPointAt(t),
      tangent = curve.getTangentAt(t).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);
    const next = curve.getTangentAt((t + 0.001) % 1);
    const curvature =
      angle(Math.atan2(next.x, next.z) - heading) / (length / 1000);
    samples.push({
      x: p.x,
      y: p.y,
      z: p.z,
      tx: tangent.x,
      tz: tangent.z,
      nx: tangent.z,
      nz: -tangent.x,
      heading,
      curvature,
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
  };
}
export function position(track: Track, s: number, offset: number) {
  const p = sample(track, s);
  return {
    x: p.x + p.nx * offset,
    y: p.y,
    z: p.z + p.nz * offset,
    heading: p.heading,
  };
}
