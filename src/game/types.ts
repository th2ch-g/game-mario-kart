export type Mode = 'race' | 'cup' | 'time' | 'local' | 'online';
export type Item =
  | 'boost'
  | 'triple'
  | 'rocket'
  | 'green'
  | 'mine'
  | 'shield'
  | 'pulse'
  | 'star'
  | 'lightning'
  | 'blue'
  | 'bullet';
export type Phase = 'countdown' | 'racing' | 'finished';
export interface Input {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  item: boolean;
}
export const EMPTY_INPUT: Input = {
  throttle: 0,
  brake: 0,
  steer: 0,
  drift: false,
  item: false,
};
export interface RacerSpec {
  id: string;
  name: string;
  kart: number;
  cpu: boolean;
}
export interface Racer extends RacerSpec {
  s: number;
  offset: number;
  yaw: number;
  speed: number;
  steer: number;
  lift: number;
  verticalSpeed: number;
  trick: boolean;
  lastJump: number;
  driftDirection: number;
  driftPressed: boolean;
  hop: number;
  trickWindow: number;
  trickProgress: number;
  star: number;
  shrink: number;
  bullet: number;
  itemCharges: number;
  roulette: number;
  itemHold: number;
  defending: boolean;
  rank: number;
  lap: number;
  lapStart: number;
  laps: number[];
  finishTime: number | null;
  finished: boolean;
  boost: number;
  shield: number;
  spin: number;
  driftCharge: number;
  drifting: boolean;
  coins: number;
  item: Item | null;
  itemCooldown: number;
  itemPressed: boolean;
  checkpoint: number;
  lastBox: number;
  lastCoin: number;
  lastPad: number;
  distance: number;
  disconnected: boolean;
}
export interface Hazard {
  id: number;
  kind: 'rocket' | 'green' | 'mine' | 'blue';
  s: number;
  offset: number;
  owner: string;
  life: number;
  yaw: number;
  direction: number;
}
export interface RaceConfig {
  track: number;
  laps: number;
  difficulty: number;
  mode: Mode;
  assist: boolean;
  seed: number;
}
export interface RaceState {
  config: RaceConfig;
  phase: Phase;
  time: number;
  countdown: number;
  racers: Racer[];
  hazards: Hazard[];
  rng: number;
  nextHazard: number;
  endTimer: number;
  events: GameEvent[];
}
export interface GameEvent {
  id: number;
  type:
    | 'item'
    | 'boost'
    | 'hit'
    | 'lap'
    | 'finish'
    | 'go'
    | 'trick'
    | 'star'
    | 'lightning';
  racer: string;
}
export interface GhostPoint {
  t: number;
  s: number;
  offset: number;
  yaw: number;
  lift?: number;
}
export interface RecordEntry {
  track: number;
  time: number;
  date: string;
  ghost: GhostPoint[];
}
export interface Settings {
  name: string;
  kart: number;
  sound: boolean;
  volume: number;
  quality: 'auto' | 'high' | 'low';
  autoAccelerate: boolean;
  assist: boolean;
  vibration: boolean;
}
