import { KARTS } from './catalog';
import {
  angle,
  getTrack,
  position,
  sample,
  sectionAt,
  wrap,
  type Track,
} from './tracks';
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
export const DRIFT_LEVELS = [0.7, 1.6, 2.7];
export function driftStage(charge: number) {
  return DRIFT_LEVELS.filter((level) => charge >= level).length;
}
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
      steer: 0,
      lift: 0,
      verticalSpeed: 0,
      trick: false,
      lastJump: -1,
      driftDirection: 0,
      driftPressed: false,
      hop: 0,
      trickWindow: 0,
      trickProgress: 0,
      star: 0,
      shrink: 0,
      bullet: 0,
      itemCharges: 0,
      roulette: 0,
      itemHold: 0,
      defending: false,
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
    racer.rank <= 2
      ? ['mine', 'mine', 'green', 'green', 'shield', 'pulse', 'boost']
      : racer.rank <= 5
        ? [
            'rocket',
            'rocket',
            'green',
            'boost',
            'boost',
            'triple',
            'star',
            'shield',
          ]
        : [
            'triple',
            'triple',
            'star',
            'star',
            'rocket',
            'blue',
            'lightning',
            'bullet',
          ];
  return pool[Math.floor(random(state) * pool.length)];
}
function hit(state: RaceState, racer: Racer) {
  if (racer.star > 0 || racer.bullet > 0) return;
  if (racer.shield > 0) {
    racer.shield = 0;
    return;
  }
  if (racer.spin > 0 || racer.finished) return;
  racer.spin = 1.05;
  racer.speed *= 0.45;
  racer.coins = Math.max(0, racer.coins - 3);
  racer.driftCharge = 0;
  racer.drifting = false;
  racer.driftDirection = 0;
  racer.boost = 0;
  event(state, 'hit', racer.id);
}
export function useItem(state: RaceState, racer: Racer, backwards = false) {
  if (!racer.item || racer.finished || racer.spin > 0 || racer.roulette > 0)
    return;
  const kind = racer.item;
  if (kind === 'triple' && racer.itemCharges > 1) racer.itemCharges--;
  else {
    racer.item = null;
    racer.itemCharges = 0;
  }
  racer.defending = false;
  racer.itemCooldown = 0.3;
  if (kind === 'boost' || kind === 'triple') {
    racer.boost = 3;
    event(state, 'boost', racer.id);
  } else if (kind === 'shield') racer.shield = 8;
  else if (kind === 'star') {
    racer.star = 7;
    racer.spin = 0;
    racer.shrink = 0;
    event(state, 'star', racer.id);
  } else if (kind === 'bullet') {
    racer.bullet = 5;
    racer.spin = 0;
    racer.shrink = 0;
    event(state, 'boost', racer.id);
  } else if (kind === 'lightning') {
    for (const rival of state.racers) {
      if (
        rival.id === racer.id ||
        rival.star > 0 ||
        rival.bullet > 0 ||
        rival.finished
      )
        continue;
      const protectedByShield = rival.shield > 0;
      hit(state, rival);
      if (!protectedByShield) rival.shrink = 5;
    }
    event(state, 'lightning', racer.id);
  } else if (kind === 'pulse') {
    for (const rival of state.racers)
      if (rival.id !== racer.id && Math.abs(rival.s - racer.s) < 16)
        hit(state, rival);
    const length = getTrack(state.config.track).length;
    state.hazards = state.hazards.filter(
      (h) =>
        Math.abs(wrap(h.s - racer.s + length / 2, length) - length / 2) > 18,
    );
  } else
    state.hazards.push({
      id: state.nextHazard++,
      kind,
      s: racer.s + (kind === 'mine' || backwards ? -4 : 4),
      offset: racer.offset,
      owner: racer.id,
      life: kind === 'mine' ? 28 : kind === 'blue' ? 18 : 8,
      yaw: racer.yaw,
      direction: kind === 'mine' || backwards ? -1 : 1,
    });
}
export function aiInput(
  state: RaceState,
  racer: Racer,
  track = getTrack(state.config.track),
): Input {
  const p = sample(track, racer.s + 7);
  let targetOffset =
    Math.sin(racer.s / 59 + state.racers.indexOf(racer) * 1.8) * 1.7;
  for (const obstacle of track.definition.obstacles) {
    const distance = wrap(obstacle.at * track.length - racer.s, track.length);
    if (
      distance < 26 &&
      Math.abs(targetOffset - obstacle.offset) < obstacle.radius + 2.5
    )
      targetOffset = obstacle.offset > 0 ? -1.8 : 1.8;
  }
  const desiredYaw = clamp((targetOffset - racer.offset) * 0.1, -0.4, 0.4);
  const drifting = Math.abs(p.curvature) > 0.018 && racer.speed > 20;
  const turnRate = 1.55 * KARTS[racer.kart].handling * (drifting ? 1.08 : 1);
  const steer = clamp(
    (p.curvature * racer.speed + (desiredYaw - racer.yaw) * 4) / turnRate,
    -1,
    1,
  );
  return {
    throttle: 1,
    brake: Math.abs(p.curvature) * racer.speed > turnRate * 0.85 ? 0.7 : 0,
    steer,
    drift: drifting,
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
  r.star = Math.max(0, r.star - dt);
  r.shrink = Math.max(0, r.shrink - dt);
  r.bullet = Math.max(0, r.bullet - dt);
  r.roulette = Math.max(0, r.roulette - dt);
  r.hop = Math.max(0, r.hop - dt);
  r.trickWindow = Math.max(0, r.trickWindow - dt);
  if (r.trick) r.trickProgress = Math.min(1, r.trickProgress + dt * 1.6);
  r.itemCooldown = Math.max(0, r.itemCooldown - dt);
  const cpu = r.cpu || r.disconnected || r.finished || r.bullet > 0;
  const oldY = position(track, r.s, r.offset).y;
  const offroad = Math.abs(r.offset) > p.width / 2;
  const maxSpeed =
    36 *
    stats.speed *
    (1 + r.coins * 0.007) *
    (cpu ? [0.85, 0.96, 1.05][state.config.difficulty] : 1) *
    (r.bullet > 0 ? 1.85 : r.boost > 0 ? 1.48 : r.star > 0 ? 1.22 : 1) *
    (r.shrink > 0 ? 0.58 : 1) *
    (offroad && r.boost <= 0 && r.star <= 0 && r.bullet <= 0 ? 0.5 : 1) *
    (r.spin > 0 ? 0.25 : 1);
  const acceleration =
    input.throttle * 21 * stats.acceleration +
    (r.boost > 0 || r.star > 0 || r.bullet > 0 ? 35 : 0) -
    input.brake * 46 -
    (input.throttle ? 2.6 : 10);
  r.speed = clamp(
    r.speed + acceleration * dt,
    0,
    maxSpeed > r.speed ? maxSpeed : Math.max(maxSpeed, r.speed - dt * 29),
  );
  if (input.drift && !r.driftPressed && r.spin <= 0) {
    r.trickWindow = 0.22;
    if (r.lift <= 0 && r.speed > 8) r.hop = 0.3;
  }
  r.driftPressed = input.drift;
  if (input.drift && r.driftDirection === 0 && Math.abs(input.steer) > 0.15)
    r.driftDirection = Math.sign(input.steer);
  const drifting =
    input.drift &&
    r.driftDirection !== 0 &&
    r.speed > 14 &&
    r.spin <= 0 &&
    r.lift <= 0;
  r.steer += (input.steer - r.steer) * Math.min(1, dt * 14);
  if (r.lift > 0 && r.trickWindow > 0 && !r.trick) {
    r.trick = true;
    r.trickProgress = 0;
    event(state, 'trick', r.id);
  }
  if (drifting)
    r.driftCharge +=
      dt * (1.1 + Math.abs(input.steer) * 0.7) * (offroad ? 0.5 : 1);
  if (!drifting && r.drifting && driftStage(r.driftCharge) > 0) {
    r.boost = Math.max(r.boost, [0, 0.8, 1.6, 2.5][driftStage(r.driftCharge)]);
    event(state, 'boost', r.id);
  }
  if (!drifting) {
    r.driftCharge = 0;
    if (!input.drift) r.driftDirection = 0;
  }
  r.drifting = drifting;
  const turnRate =
    1.55 * stats.handling * clamp(r.speed / 12, 0, 1) * (drifting ? 1.08 : 1);
  const ds =
    (r.speed * Math.cos(r.yaw) * dt) /
    clamp(1 - p.curvature * r.offset, 0.65, 1.4);
  const steer = drifting
    ? r.driftDirection * (0.42 + 0.29 * (input.steer * r.driftDirection + 1))
    : input.steer;
  let steering = steer * turnRate;
  if (!cpu && state.config.assist) {
    steering += p.curvature * r.speed * (1 - Math.abs(input.steer) * 0.6);
    steering += (-r.yaw * 2.8 - r.offset * 0.1) * (1 - Math.abs(input.steer));
    if (Math.abs(r.offset) > p.width * 0.43)
      steering -= Math.sign(r.offset) * 0.9;
  }
  if (r.spin > 0) steering = -r.yaw * 3 + p.curvature * r.speed;
  if (r.bullet > 0)
    steering = p.curvature * r.speed - r.yaw * 6 - r.offset * 0.4;
  r.yaw = clamp(angle(r.yaw + steering * dt - p.curvature * ds), -1.15, 1.15);
  r.offset += Math.sin(r.yaw) * r.speed * dt;
  const section = sectionAt(track, r.s);
  const boundary =
    p.width / 2 +
    (section.kind === 'bridge' || section.kind === 'boardwalk' ? 0.3 : 4);
  if (Math.abs(r.offset) > boundary) {
    r.offset = clamp(r.offset, -boundary, boundary);
    r.yaw *= 0.75;
    r.speed *= 0.97;
  }
  r.s += ds;
  r.distance += ds;
  if (r.lift > 0) {
    r.verticalSpeed -= 21 * dt;
    r.lift = Math.max(
      0,
      r.lift + r.verticalSpeed * dt - (position(track, r.s, r.offset).y - oldY),
    );
    if (r.lift === 0) {
      r.verticalSpeed = 0;
      if (r.trick) {
        r.boost = Math.max(r.boost, 0.9);
        event(state, 'boost', r.id);
      }
      r.trick = false;
      r.trickProgress = 0;
    }
  }
  const lapNumber = Math.floor(r.s / track.length);
  for (let i = 0; i < track.definition.jumps.length; i++) {
    const ramp = track.definition.jumps[i],
      jumpS = (lapNumber + ramp.at) * track.length,
      key = lapNumber * 10 + i;
    if (
      oldS < jumpS &&
      r.s >= jumpS &&
      r.lastJump !== key &&
      Math.abs(r.offset - ramp.offset) < ramp.width / 2 &&
      r.lift <= 0
    ) {
      r.lastJump = key;
      r.lift = ramp.height;
      r.verticalSpeed = 4.5 + r.speed * 0.12;
      r.trick = r.trickWindow > 0;
      r.trickProgress = 0;
      if (r.trick) event(state, 'trick', r.id);
    }
  }
  if (r.lift < 1.2)
    for (const obstacle of track.definition.obstacles) {
      const obstacleS = (lapNumber + obstacle.at) * track.length;
      if (
        Math.abs(r.s - obstacleS) < obstacle.radius + 1.2 &&
        Math.abs(r.offset - obstacle.offset) < obstacle.radius + 0.9
      )
        hit(state, r);
    }
  for (let i = 0; i < track.definition.pads.length; i++) {
    const pad = track.definition.pads[i],
      padS = (lapNumber + pad.at) * track.length,
      key = lapNumber * 10 + i;
    if (
      oldS < padS &&
      r.s >= padS &&
      Math.abs(r.offset - pad.offset) < pad.width / 2 &&
      r.lift < 0.5 &&
      r.lastPad !== key
    ) {
      r.boost = Math.max(r.boost, 1.25);
      r.lastPad = key;
      event(state, 'boost', r.id);
    }
  }
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
      r.itemCharges = r.item === 'triple' ? 3 : 1;
      r.roulette = 0.75;
      r.lastBox = key;
      event(state, 'item', r.id);
    }
  }
  const coinIndex = Math.floor(r.s / (track.length / 18));
  if (coinIndex !== r.lastCoin && r.s > 0 && Math.abs(r.offset) < 4) {
    r.coins = Math.min(10, r.coins + 1);
    r.lastCoin = coinIndex;
  }
  const canHold =
    r.item && ['mine', 'rocket', 'green'].includes(r.item) && r.roulette <= 0;
  if (canHold) {
    if (input.item) {
      r.itemHold += dt;
      r.defending = r.itemHold > 0.12;
    } else if (r.itemPressed) {
      useItem(state, r, input.brake > 0.5);
      r.itemHold = 0;
    }
  } else {
    r.itemHold = 0;
    r.defending = false;
    if (input.item && !r.itemPressed) useItem(state, r, input.brake > 0.5);
  }
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
      racer.cpu || racer.finished || racer.disconnected || racer.bullet > 0
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
      if (
        Math.abs(separation) < 3.4 &&
        Math.abs(a.offset - b.offset) < 2.7 &&
        Math.abs(a.lift - b.lift) < 1.4
      ) {
        const push = (2.7 - Math.abs(a.offset - b.offset)) * 0.5,
          direction = a.offset >= b.offset ? 1 : -1;
        a.offset += push * direction;
        b.offset -= push * direction;
        if (a.star > 0 || a.bullet > 0) hit(state, b);
        if (b.star > 0 || b.bullet > 0) hit(state, a);
        if (separation > 0) b.speed = Math.min(b.speed, a.speed + 1);
        else a.speed = Math.min(a.speed, b.speed + 1);
      }
    }
  for (const h of state.hazards) {
    h.life -= dt;
    if (h.kind === 'rocket' || h.kind === 'blue') {
      const leader = state.racers
        .filter((r) => !r.finished)
        .sort((a, b) => a.rank - b.rank)[0];
      const target =
        h.kind === 'blue'
          ? leader
          : state.racers
              .filter((r) => r.id !== h.owner && !r.finished)
              .map((r) => ({ r, d: wrap(r.s - h.s, track.length) }))
              .filter((v) => v.d < 120)
              .sort((a, b) => a.d - b.d)[0]?.r;
      h.s += (h.kind === 'blue' ? 78 : 59) * dt * h.direction;
      if (target)
        h.offset += clamp(target.offset - h.offset, -dt * 16, dt * 16);
    } else if (h.kind === 'green') {
      const p = sample(track, h.s),
        ds = Math.cos(h.yaw) * 62 * dt * h.direction;
      h.s += ds;
      h.offset += Math.sin(h.yaw) * 62 * dt * h.direction;
      h.yaw = angle(h.yaw - p.curvature * ds);
      if (Math.abs(h.offset) > p.width / 2 - 0.6) {
        h.offset = clamp(h.offset, -p.width / 2 + 0.6, p.width / 2 - 0.6);
        h.yaw = -h.yaw;
      }
    }
    for (const r of state.racers)
      if (
        (r.id !== h.owner || h.kind === 'blue') &&
        !r.finished &&
        (h.kind === 'blue'
          ? r.id ===
            state.racers
              .filter((racer) => !racer.finished)
              .sort((a, b) => a.rank - b.rank)[0]?.id
          : r.lift < 2) &&
        Math.abs(
          wrap(r.s - h.s + track.length / 2, track.length) - track.length / 2,
        ) < 2 &&
        Math.abs(r.offset - h.offset) < 1.9
      ) {
        if (h.kind === 'blue') {
          for (const rival of state.racers)
            if (
              Math.abs(
                wrap(rival.s - h.s + track.length / 2, track.length) -
                  track.length / 2,
              ) < 9
            )
              hit(state, rival);
        } else if (
          r.defending &&
          r.item &&
          ['mine', 'rocket', 'green'].includes(r.item)
        ) {
          r.item = null;
          r.itemCharges = 0;
          r.defending = false;
        } else hit(state, r);
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
    (humans.every((r) => r.finished) && state.endTimer > 20) ||
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
