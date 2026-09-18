import { describe, expect, it } from 'vitest';
import {
  aiInput,
  createRace,
  driftStage,
  STEP,
  stepRace,
  useItem,
} from '../src/game/engine';
import { getTrack, sample } from '../src/game/tracks';
import { EMPTY_INPUT, type Input, type Item } from '../src/game/types';

function race(track = 0, mode: 'race' | 'time' = 'race', count = 1) {
  const state = createRace(
    { track, laps: 3, difficulty: 1, mode, assist: true, seed: 731 },
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: `Driver ${i}`,
      kart: 0,
      cpu: false,
    })),
  );
  state.phase = 'racing';
  state.racers.forEach((r, i) =>
    Object.assign(r, { s: 20 - i * 10, offset: 0, speed: 30 }),
  );
  return state;
}
function run(
  state: ReturnType<typeof race>,
  seconds: number,
  input: Partial<Input> = {},
) {
  for (let i = 0; i < seconds / STEP; i++)
    stepRace(state, { p0: { ...EMPTY_INPUT, throttle: 1, ...input } });
}

describe('jump actions and mini turbos', () => {
  for (const trackId of [0, 1, 2])
    it(`takes off, performs an airborne trick and earns a landing boost on course ${trackId}`, () => {
      const state = race(trackId, 'time'),
        track = getTrack(trackId),
        ramp = track.definition.jumps[0],
        r = state.racers[0];
      r.s = ramp.at * track.length - 0.2;
      r.offset = ramp.offset;
      run(state, STEP);
      expect(r.lift).toBeGreaterThan(1);
      run(state, STEP, { drift: true });
      expect(r.trick).toBe(true);
      expect(state.events.some((event) => event.type === 'trick')).toBe(true);
      let peak = r.lift;
      for (let i = 0; i < 240 && r.lift > 0; i++) {
        run(state, STEP);
        peak = Math.max(peak, r.lift);
      }
      expect(peak).toBeGreaterThan(ramp.height + 0.5);
      expect(r.lift).toBe(0);
      expect(r.boost).toBeGreaterThan(0.7);
      expect(r.trick).toBe(false);
    });
  it('does not grant a trick just for holding drift throughout the approach', () => {
    const state = race(0, 'time'),
      track = getTrack(0),
      ramp = track.definition.jumps[0],
      r = state.racers[0];
    Object.assign(r, {
      s: ramp.at * track.length - 0.2,
      offset: ramp.offset,
      driftPressed: true,
    });
    run(state, STEP, { drift: true });
    expect(r.lift).toBeGreaterThan(0);
    expect(r.trick).toBe(false);
  });
  it('allows the jump ramp to be bypassed in the other lane', () => {
    const state = race(0, 'time'),
      track = getTrack(0),
      ramp = track.definition.jumps[0],
      r = state.racers[0];
    Object.assign(r, { s: ramp.at * track.length - 0.2, offset: 4.8 });
    run(state, STEP);
    expect(r.lift).toBe(0);
  });
  it('hops into a drift and keeps the chosen direction under countersteering', () => {
    const state = race(0, 'time'),
      r = state.racers[0];
    run(state, 0.1, { steer: -1, drift: true });
    expect(r.hop).toBeGreaterThan(0);
    expect(r.drifting).toBe(true);
    expect(r.driftDirection).toBe(-1);
    run(state, 0.2, { steer: 1, drift: true });
    expect(r.driftDirection).toBe(-1);
    expect(r.driftCharge).toBeGreaterThan(0.4);
  });
  it('cannot charge a drift by holding the button without steering', () => {
    const state = race(0, 'time');
    run(state, 1, { drift: true });
    expect(state.racers[0].driftCharge).toBe(0);
  });
  for (const [charge, minimum, level] of [
    [0.8, 0.7, 1],
    [1.8, 1.5, 2],
    [3, 2.4, 3],
  ])
    it(`releases level ${level} turbo with its own duration`, () => {
      const state = race(0, 'time'),
        r = state.racers[0];
      Object.assign(r, {
        drifting: true,
        driftCharge: charge,
        driftDirection: 1,
      });
      expect(driftStage(charge)).toBe(level);
      run(state, STEP);
      expect(r.boost).toBeGreaterThan(minimum);
      expect(r.driftCharge).toBe(0);
      expect(r.driftDirection).toBe(0);
    });
  it('rewards a tighter racing line with more progress at equal speed', () => {
    const track = getTrack(0),
      curve = track.samples.findIndex((p) => p.curvature > 0.03);
    const inside = race(0, 'time'),
      outside = race(0, 'time');
    for (const [state, offset] of [
      [inside, 2],
      [outside, -2],
    ] as const) {
      Object.assign(state.racers[0], {
        s: (curve / track.samples.length) * track.length,
        offset,
      });
      run(state, STEP);
    }
    expect(inside.racers[0].s).toBeGreaterThan(outside.racers[0].s);
  });
});

describe('item strategy and combat', () => {
  it('consumes three mushrooms on three separate taps', () => {
    const state = race(),
      r = state.racers[0];
    r.item = 'triple';
    r.itemCharges = 3;
    for (const remaining of [2, 1, 0]) {
      useItem(state, r);
      expect(r.itemCharges).toBe(remaining);
      expect(r.boost).toBe(3);
      expect(r.item).toBe(remaining ? 'triple' : null);
    }
  });
  it('rejects using an item until the roulette has finished', () => {
    const state = race(),
      r = state.racers[0];
    r.item = 'boost';
    r.roulette = 0.7;
    useItem(state, r);
    expect(r.item).toBe('boost');
    expect(r.boost).toBe(0);
    run(state, 0.8);
    useItem(state, r);
    expect(r.boost).toBe(3);
  });
  it('a star prevents shell damage and lightning shrink', () => {
    const state = race(0, 'race', 2),
      [r, enemy] = state.racers;
    r.item = 'star';
    useItem(state, r);
    enemy.item = 'lightning';
    useItem(state, enemy);
    expect(r.shrink).toBe(0);
    expect(r.spin).toBe(0);
    enemy.item = 'pulse';
    useItem(state, enemy);
    expect(r.spin).toBe(0);
    expect(r.star).toBe(7);
  });
  it('lightning slows and shrinks opponents and they recover', () => {
    const state = race(0, 'race', 2),
      [r, enemy] = state.racers;
    r.item = 'lightning';
    useItem(state, r);
    expect(enemy.shrink).toBe(5);
    expect(enemy.spin).toBeGreaterThan(0);
    run(state, 5.2);
    expect(enemy.shrink).toBe(0);
  });
  it('the automatic rocket drives without throttle and expires', () => {
    const state = race(),
      r = state.racers[0];
    r.item = 'bullet';
    useItem(state, r);
    run(state, 2, { throttle: 0, steer: -1, brake: 1 });
    expect(r.s).toBeGreaterThan(100);
    expect(r.speed).toBeGreaterThan(40);
    expect(Math.abs(r.offset)).toBeLessThan(4);
    run(state, 3.2);
    expect(r.bullet).toBe(0);
  });
  it('green shells reflect at the roadside instead of homing', () => {
    const state = race(),
      r = state.racers[0],
      track = getTrack(0);
    r.item = 'green';
    r.yaw = 0.7;
    r.offset = 5.5;
    useItem(state, r);
    const h = state.hazards[0];
    run(state, 0.15);
    expect(h.yaw).toBeLessThan(0);
    expect(Math.abs(h.offset)).toBeLessThan(sample(track, h.s).width / 2);
  });
  it('holding a banana blocks an incoming red shell and consumes both', () => {
    const state = race(0, 'race', 2),
      [r, enemy] = state.racers;
    r.item = 'mine';
    run(state, 0.2, { item: true });
    expect(r.defending).toBe(true);
    enemy.item = 'rocket';
    useItem(state, enemy);
    Object.assign(state.hazards[0], { s: r.s - 0.5, offset: r.offset });
    run(state, STEP, { item: true });
    expect(r.spin).toBe(0);
    expect(r.item).toBeNull();
    expect(state.hazards).toHaveLength(0);
  });
  it('releasing a held shell with brake throws it backwards', () => {
    const state = race(),
      r = state.racers[0];
    r.item = 'green';
    run(state, 0.2, { item: true });
    run(state, STEP, { brake: 1 });
    expect(r.item).toBeNull();
    expect(state.hazards[0].direction).toBe(-1);
    expect(state.hazards[0].s).toBeLessThan(r.s);
  });
  it('a blue shell skips trailing racers and strikes the leader', () => {
    const state = race(0, 'race', 3),
      [r, leader, middle] = state.racers;
    Object.assign(r, { s: 10, rank: 3 });
    Object.assign(leader, { s: 60, rank: 1 });
    Object.assign(middle, { s: 32, rank: 2 });
    r.item = 'blue';
    useItem(state, r);
    run(state, 1.4, { throttle: 0 });
    expect(
      state.events.some((e) => e.type === 'hit' && e.racer === leader.id),
    ).toBe(true);
    expect(
      state.events.some((e) => e.type === 'hit' && e.racer === middle.id),
    ).toBe(false);
  });
  it('the horn destroys a nearby blue shell', () => {
    const state = race(0, 'race', 2),
      [r, enemy] = state.racers;
    enemy.item = 'blue';
    useItem(state, enemy);
    state.hazards[0].s = r.s - 6;
    r.item = 'pulse';
    useItem(state, r);
    expect(state.hazards).toHaveLength(0);
    expect(r.spin).toBe(0);
  });
  it('position-weighted boxes reserve comeback items for trailing racers', () => {
    const first = new Set<Item>(),
      last = new Set<Item>(),
      track = getTrack(0);
    for (let seed = 1; seed < 90; seed++)
      for (const [rank, pool] of [
        [1, first],
        [8, last],
      ] as const) {
        const state = race(),
          r = state.racers[0];
        state.rng = seed * 104729;
        Object.assign(r, {
          s: track.definition.boxes[0] * track.length - 0.2,
          rank,
        });
        run(state, STEP);
        if (r.item) pool.add(r.item);
      }
    expect(
      first.has('bullet') || first.has('blue') || first.has('lightning'),
    ).toBe(false);
    for (const kind of ['bullet', 'blue', 'lightning'] as Item[])
      expect(last.has(kind)).toBe(true);
  });
  it('the CPU negotiates the redesigned course with manual steering', () => {
    const state = race(2),
      r = state.racers[0];
    state.config.assist = false;
    state.config.laps = 1;
    for (let i = 0; i < 100 / STEP && !r.finished; i++)
      stepRace(state, { p0: aiInput(state, r) });
    expect(r.finished).toBe(true);
  });
});
