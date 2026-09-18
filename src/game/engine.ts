import { KARTS } from './catalog';
import { angle, getTrack, sample, wrap, type Track } from './tracks';
import {
  EMPTY_INPUT,
  type Input,
  type Item,
  type RaceConfig,
  type Racer,
  type RacerSpec,
  type RaceState,
} from './types';

export const STEP = 1 / 60;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export function cleanInput(value: unknown): Input {
  if (!value || typeof value !== 'object') return { ...EMPTY_INPUT };
  const v = value as Record<string, unknown>;
  const n = (key: string, min: number) =>
    typeof v[key] === 'number' && Number.isFinite(v[key])
      ? clamp(v[key] as number, min, 1)
      : 0;
  return {
    throttle: n('throttle', 0),
    brake: n('brake', 0),
    steer: n('steer', -1),
    drift: v.drift === true,
    item: v.item === true,
  };
}
export function createRace(config: RaceConfig, specs: RacerSpec[]): RaceState {
  return {
    config: { ...config },
    phase: 'countdown',
    countdown: 3.5,
    time: 0,
    rng: config.seed || 12345,
    nextHazard: 1,
    hazards: [],
    events: [],
    endTimer: 0,
    racers: specs.map((spec, i) => ({
      ...spec,
      s: -4 - Math.floor(i / 2) * 5,
      offset: (i % 2 ? 1 : -1) * 2.7,
      yaw: 0,
      speed: 0,
      rank: i + 1,
      lap: 1,
      lapStart: 0,
      laps: [],
      finishTime: null,
      finished: false,
      boost: 0,
      shield: 0,
      spin: 0,
      driftCharge: 0,
      drifting: false,
      coins: 0,
      item: null,
      itemCooldown: 0,
      itemPressed: false,
      checkpoint: 0,
      lastBox: -1,
      lastCoin: -1,
      lastPad: -1,
      distance: 0,
      disconnected: false,
    })),
  };
}
function random(state: RaceState) {
  state.rng ^= state.rng << 13;
  state.rng ^= state.rng >>> 17;
  state.rng ^= state.rng << 5;
  return (state.rng >>> 0) / 4294967296;
}
function event(
  state: RaceState,
  type: RaceState['events'][number]['type'],
  racer: string,
) {
  state.events.push({ id: state.nextHazard++, type, racer });
  if (state.events.length > 16) state.events.shift();
}
function giveItem(state: RaceState, racer: Racer): Item {
  const pool: Item[] =
    racer.rank > 4
      ? ['boost', 'boost', 'rocket', 'pulse', 'shield']
      : ['mine', 'rocket', 'shield', 'boost'];
  return pool[Math.floor(random(state) * pool.length)];
}
function hit(state: RaceState, racer: Racer) {
  if (racer.shield > 0) {
    racer.shield = 0;
    return;
  }
  if (racer.spin > 0 || racer.finished) return;
  racer.spin = 1.05;
  racer.speed *= 0.45;
  racer.coins = Math.max(0, racer.coins - 3);
  racer.driftCharge = 0;
  event(state, 'hit', racer.id);
}
export function useItem(state: RaceState, racer: Racer) {
  if (!racer.item || racer.finished || racer.spin > 0) return;
  const kind = racer.item;
  racer.item = null;
  racer.itemCooldown = 1;
  if (kind === 'boost') {
    racer.boost = 3;
    event(state, 'boost', racer.id);
  } else if (kind === 'shield') racer.shield = 8;
  else if (kind === 'pulse') {
    for (const rival of state.racers)
      if (rival.id !== racer.id && Math.abs(rival.s - racer.s) < 34)
        hit(state, rival);
  } else
    state.hazards.push({
      id: state.nextHazard++,
      kind,
      s: racer.s + (kind === 'rocket' ? 4 : -4),
      offset: racer.offset,
      owner: racer.id,
      life: kind === 'rocket' ? 7 : 24,
    });
}
export function aiInput(
  state: RaceState,
  racer: Racer,
  track = getTrack(state.config.track),
): Input {
  const p = sample(track, racer.s + 6);
  const targetOffset =
    Math.sin(racer.s / 39 + state.racers.indexOf(racer) * 1.8) * 2.3;
  const desiredYaw = clamp((targetOffset - racer.offset) * 0.1, -0.4, 0.4);
  const turnRate = 1.55 * KARTS[racer.kart].handling;
  const steer = clamp(
    (p.curvature * racer.speed + (desiredYaw - racer.yaw) * 4) / turnRate,
    -1,
    1,
  );
  return {
    throttle: 1,
    brake: Math.abs(p.curvature) > 0.045 && racer.speed > 28 ? 0.22 : 0,
    steer,
    drift: Math.abs(p.curvature) > 0.018 && racer.speed > 20,
    item:
      !!racer.item &&
      Math.floor(state.time * 2 + state.racers.indexOf(racer)) % 5 === 0,
  };
}
function advanceRacer(
  state: RaceState,
  r: Racer,
  input: Input,
  dt: number,
  track: Track,
) {
  const stats = KARTS[r.kart],
    p = sample(track, r.s),
    oldS = r.s;
  r.boost = Math.max(0, r.boost - dt);
  r.shield = Math.max(0, r.shield - dt);
  r.spin = Math.max(0, r.spin - dt);
  r.itemCooldown = Math.max(0, r.itemCooldown - dt);
  const cpu = r.cpu || r.disconnected || r.finished;
  const offroad = Math.abs(r.offset) > track.definition.width / 2;
  const maxSpeed =
    36 *
    stats.speed *
    (1 + r.coins * 0.007) *
    (cpu ? [0.85, 0.96, 1.05][state.config.difficulty] : 1) *
    (r.boost > 0 ? 1.48 : 1) *
    (offroad && r.boost <= 0 ? 0.5 : 1) *
    (r.spin > 0 ? 0.25 : 1);
  const acceleration =
    input.throttle * 21 * stats.acceleration +
    (r.boost > 0 ? 27 : 0) -
    input.brake * 46 -
    (input.throttle ? 2.6 : 10);
  r.speed = clamp(
    r.speed + acceleration * dt,
    0,
    maxSpeed > r.speed ? maxSpeed : Math.max(maxSpeed, r.speed - dt * 29),
  );
  const drifting = input.drift && r.speed > 14 && r.spin <= 0;
  if (drifting) r.driftCharge += dt * (0.4 + Math.abs(input.steer));
  if (!drifting && r.drifting && r.driftCharge >= 0.65) {
    r.boost = Math.max(
      r.boost,
      r.driftCharge >= 2 ? 2.2 : r.driftCharge >= 1.2 ? 1.5 : 0.8,
    );
    event(state, 'boost', r.id);
  }
  if (!drifting) r.driftCharge = 0;
  r.drifting = drifting;
  const turnRate =
    1.55 * stats.handling * clamp(r.speed / 12, 0, 1) * (drifting ? 1.08 : 1);
  const ds = r.speed * Math.cos(r.yaw) * dt;
  let steering = input.steer * turnRate;
  if (!cpu && state.config.assist) {
    steering += p.curvature * r.speed * (1 - Math.abs(input.steer) * 0.6);
    steering += (-r.yaw * 2.8 - r.offset * 0.1) * (1 - Math.abs(input.steer));
    if (Math.abs(r.offset) > track.definition.width * 0.43)
      steering -= Math.sign(r.offset) * 0.9;
  }
  if (r.spin > 0) steering = -r.yaw * 3 + p.curvature * r.speed;
  r.yaw = clamp(angle(r.yaw + steering * dt - p.curvature * ds), -1.15, 1.15);
  r.offset += Math.sin(r.yaw) * r.speed * dt;
  const boundary = track.definition.width / 2 + 5;
  if (Math.abs(r.offset) > boundary) {
    r.offset = clamp(r.offset, -boundary, boundary);
    r.yaw *= 0.75;
    r.speed *= 0.97;
  }
  r.s += ds;
  r.distance += ds;
  const checkpoint = Math.floor(Math.max(0, r.s) / (track.length / 4));
  if (checkpoint === r.checkpoint + 1) r.checkpoint = checkpoint;
  if (
    !r.finished &&
    Math.floor(Math.max(0, r.s) / track.length) >
      Math.floor(Math.max(0, oldS) / track.length) &&
    r.checkpoint >= r.lap * 4
  ) {
    r.laps.push(state.time - r.lapStart);
    r.lapStart = state.time;
    if (r.lap === state.config.laps) {
      r.finished = true;
      r.finishTime = state.time;
      event(state, 'finish', r.id);
    } else {
      r.lap++;
      event(state, 'lap', r.id);
    }
  }
  if (state.config.mode === 'time' || r.finished) return;
  const lapNumber = Math.floor(r.s / track.length);
  for (let i = 0; i < track.definition.boxes.length; i++) {
    const boxS =
        track.definition.boxes[i] * track.length + lapNumber * track.length,
      key = lapNumber * 10 + i;
    if (
      oldS < boxS &&
      r.s >= boxS &&
      Math.abs(r.offset) < track.definition.width * 0.43 &&
      r.lastBox !== key &&
      !r.item &&
      !r.itemCooldown
    ) {
      r.item = giveItem(state, r);
      r.lastBox = key;
      event(state, 'item', r.id);
    }
  }
  const coinIndex = Math.floor(r.s / (track.length / 18));
  if (coinIndex !== r.lastCoin && r.s > 0 && Math.abs(r.offset) < 4) {
    r.coins = Math.min(10, r.coins + 1);
    r.lastCoin = coinIndex;
  }
  for (let i = 0; i < track.definition.pads.length; i++) {
    const padS = (lapNumber + track.definition.pads[i]) * track.length,
      key = lapNumber * 10 + i;
    if (
      oldS < padS &&
      r.s >= padS &&
      Math.abs(r.offset) < 3.6 &&
      r.lastPad !== key
    ) {
      r.boost = Math.max(r.boost, 1.25);
      r.lastPad = key;
      event(state, 'boost', r.id);
    }
  }
  if (input.item && !r.itemPressed) useItem(state, r);
  r.itemPressed = input.item;
}
export function stepRace(
  state: RaceState,
  inputs: Record<string, Input>,
  dt = STEP,
) {
  if (state.phase === 'finished') return;
  dt = clamp(dt, 0, 0.05);
  if (state.phase === 'countdown') {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.phase = 'racing';
      state.countdown = 0;
      event(state, 'go', 'all');
    }
    return;
  }
  state.time += dt;
  const track = getTrack(state.config.track);
  for (const racer of state.racers)
    advanceRacer(
      state,
      racer,
      racer.cpu || racer.finished || racer.disconnected
        ? aiInput(state, racer, track)
        : cleanInput(inputs[racer.id]),
      dt,
      track,
    );
  for (let i = 0; i < state.racers.length; i++)
    for (let j = i + 1; j < state.racers.length; j++) {
      const a = state.racers[i],
        b = state.racers[j];
      if (a.finished || b.finished) continue;
      const separation =
        wrap(a.s - b.s + track.length / 2, track.length) - track.length / 2;
      if (Math.abs(separation) < 3.4 && Math.abs(a.offset - b.offset) < 2.7) {
        const push = (2.7 - Math.abs(a.offset - b.offset)) * 0.5,
          direction = a.offset >= b.offset ? 1 : -1;
        a.offset += push * direction;
        b.offset -= push * direction;
        if (separation > 0) b.speed = Math.min(b.speed, a.speed + 1);
        else a.speed = Math.min(a.speed, b.speed + 1);
      }
    }
  for (const h of state.hazards) {
    h.life -= dt;
    if (h.kind === 'rocket') {
      h.s += 59 * dt;
      const target = state.racers
        .filter((r) => r.id !== h.owner && !r.finished)
        .map((r) => ({ r, d: wrap(r.s - h.s, track.length) }))
        .filter((v) => v.d < 60)
        .sort((a, b) => a.d - b.d)[0];
      if (target)
        h.offset += clamp(target.r.offset - h.offset, -dt * 14, dt * 14);
    }
    for (const r of state.racers)
      if (
        r.id !== h.owner &&
        !r.finished &&
        Math.abs(
          wrap(r.s - h.s + track.length / 2, track.length) - track.length / 2,
        ) < 2 &&
        Math.abs(r.offset - h.offset) < 1.9
      ) {
        hit(state, r);
        h.life = 0;
        break;
      }
  }
  state.hazards = state.hazards.filter((h) => h.life > 0).slice(-48);
  const ranked = [...state.racers].sort((a, b) =>
    a.finished && b.finished
      ? a.finishTime! - b.finishTime!
      : a.finished
        ? -1
        : b.finished
          ? 1
          : b.s - a.s,
  );
  ranked.forEach((r, i) => (r.rank = i + 1));
  const humans = state.racers.filter((r) => !r.cpu);
  if (humans.some((r) => r.finished)) state.endTimer += dt;
  if (
    state.racers.every((r) => r.finished) ||
    (humans.every((r) => r.finished) && state.endTimer > 8) ||
    state.endTimer > 30 ||
    state.time > 360
  ) {
    state.phase = 'finished';
  }
}
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.---';
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}
