import { describe, expect, it } from 'vitest';
import {
  aiInput,
  cleanInput,
  createRace,
  formatTime,
  STEP,
  stepRace,
  useItem,
} from '../src/game/engine';
import { getTrack, position, sample } from '../src/game/tracks';
import {
  EMPTY_INPUT,
  type Input,
  type RaceConfig,
  type RacerSpec,
  type RaceState,
} from '../src/game/types';
const cfg: RaceConfig = {
  track: 0,
  laps: 1,
  difficulty: 1,
  mode: 'race',
  assist: true,
  seed: 12345,
};
const specs: RacerSpec[] = [
  { id: 'human', name: 'Player', kart: 0, cpu: false },
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `cpu-${i}`,
    name: `CPU ${i}`,
    kart: i % 6,
    cpu: true,
  })),
];
function run(
  state: RaceState,
  seconds: number,
  input: Input = { ...EMPTY_INPUT, throttle: 1 },
) {
  for (let i = 0; i < seconds / STEP; i++) stepRace(state, { human: input });
}
describe('race simulation', () => {
  it('keeps all karts still until the countdown ends', () => {
    const s = createRace(cfg, specs);
    const start = s.racers[0].s;
    run(s, 3);
    expect(s.phase).toBe('countdown');
    expect(s.racers[0].s).toBe(start);
    run(s, 1);
    expect(s.phase).toBe('racing');
    expect(s.racers[0].s).toBeGreaterThan(start);
  });
  for (const track of [0, 1, 2])
    for (const difficulty of [0, 1, 2])
      it(`finishes every kart on course ${track} at difficulty ${difficulty}`, () => {
        const s = createRace({ ...cfg, track, difficulty }, specs);
        run(s, 110);
        expect(s.phase).toBe('finished');
        expect(s.racers[0].finished).toBe(true);
        expect(s.racers.filter((r) => r.finished).length).toBe(8);
        expect(new Set(s.racers.map((r) => r.rank)).size).toBe(8);
        for (const r of s.racers) expect(r.laps).toHaveLength(1);
      });
  it('finishes an unassisted three-lap race with steering and correct checkpoints', () => {
    const s = createRace({ ...cfg, track: 1, assist: false, laps: 3 }, specs);
    for (let i = 0; i < 130 / STEP; i++)
      stepRace(s, { human: aiInput(s, s.racers[0]) });
    expect(s.phase).toBe('finished');
    expect(s.racers[0].laps).toHaveLength(3);
    expect(s.racers[0].checkpoint).toBeGreaterThanOrEqual(12);
    expect(s.racers[0].finishTime).toBeGreaterThan(30);
  });
  it('produces identical results for identical inputs and seed', () => {
    const a = createRace(cfg, specs),
      b = createRace(cfg, specs);
    run(a, 40);
    run(b, 40);
    expect(a).toEqual(b);
  });
  it('brakes and penalizes offroad driving', () => {
    const a = createRace(cfg, specs.slice(0, 1));
    run(a, 8);
    const speed = a.racers[0].speed;
    run(a, 1, { ...EMPTY_INPUT, brake: 1 });
    expect(a.racers[0].speed).toBeLessThan(speed * 0.3);
    const b = createRace({ ...cfg, assist: false }, specs.slice(0, 1));
    b.phase = 'racing';
    b.racers[0].offset = 9;
    run(b, 4);
    expect(b.racers[0].speed).toBeLessThan(24);
  });
  it('charges and releases a drift turbo', () => {
    const s = createRace(cfg, specs.slice(0, 1));
    run(s, 6);
    run(s, 1.3, { ...EMPTY_INPUT, throttle: 1, steer: 0.3, drift: true });
    expect(s.racers[0].driftCharge).toBeGreaterThan(0.65);
    stepRace(s, { human: { ...EMPTY_INPUT, throttle: 1 } });
    expect(s.racers[0].boost).toBeGreaterThan(0);
    expect(s.racers[0].driftCharge).toBe(0);
  });
  it('collects items and caps coins at ten', () => {
    const s = createRace(cfg, specs.slice(0, 1));
    run(s, 13);
    expect(s.racers[0].item).not.toBeNull();
    expect(s.racers[0].coins).toBeLessThanOrEqual(10);
  });
  it('time attack excludes items, rivals and coins', () => {
    const s = createRace({ ...cfg, mode: 'time', laps: 3 }, specs.slice(0, 1));
    run(s, 120);
    expect(s.racers[0].coins).toBe(0);
    expect(s.racers[0].item).toBeNull();
    expect(s.phase).toBe('finished');
  });
  it('applies turbo and consumes the held item', () => {
    const s = createRace(cfg, specs);
    s.racers[0].item = 'boost';
    useItem(s, s.racers[0]);
    expect(s.racers[0].boost).toBe(3);
    expect(s.racers[0].item).toBeNull();
  });
  it('shield blocks a pulse exactly once', () => {
    const s = createRace(cfg, specs);
    const a = s.racers[0],
      b = s.racers[1];
    b.shield = 8;
    a.item = 'pulse';
    useItem(s, a);
    expect(b.spin).toBe(0);
    expect(b.shield).toBe(0);
    a.item = 'pulse';
    useItem(s, a);
    expect(b.spin).toBeGreaterThan(0);
  });
  it('rockets hit a rival and expire', () => {
    const s = createRace(cfg, specs.slice(0, 2));
    s.phase = 'racing';
    s.racers[0].s = 0;
    s.racers[1].s = 12;
    s.racers[1].offset = s.racers[0].offset;
    s.racers[0].item = 'rocket';
    useItem(s, s.racers[0]);
    run(s, 1);
    expect(
      s.events.some((e) => e.type === 'hit' && e.racer === s.racers[1].id),
    ).toBe(true);
    run(s, 9);
    expect(s.hazards.some((h) => h.owner === 'human')).toBe(false);
  });
  it('mines are placed behind the owner', () => {
    const s = createRace(cfg, specs);
    s.racers[0].item = 'mine';
    useItem(s, s.racers[0]);
    expect(s.hazards[0].s).toBe(s.racers[0].s - 4);
    expect(s.hazards[0].owner).toBe('human');
  });
  it('disconnected players are driven by the CPU', () => {
    const s = createRace(cfg, specs);
    s.racers[0].disconnected = true;
    run(s, 8, EMPTY_INPUT);
    expect(s.racers[0].distance).toBeGreaterThan(75);
  });
  it('a held item button never repeatedly consumes new items', () => {
    const s = createRace(cfg, specs);
    s.phase = 'racing';
    const r = s.racers[0];
    r.item = 'boost';
    stepRace(s, { human: { ...EMPTY_INPUT, item: true } });
    r.item = 'shield';
    stepRace(s, { human: { ...EMPTY_INPUT, item: true } });
    expect(r.item).toBe('shield');
    stepRace(s, { human: EMPTY_INPUT });
    stepRace(s, { human: { ...EMPTY_INPUT, item: true } });
    expect(r.shield).toBeGreaterThan(0);
  });
  it('does not award a lap from crossing the starting grid', () => {
    const s = createRace(cfg, specs.slice(0, 1));
    run(s, 7);
    expect(s.racers[0].lap).toBe(1);
    expect(s.racers[0].laps).toEqual([]);
  });
  it('stops finished state mutation', () => {
    const s = createRace(cfg, specs);
    run(s, 100);
    const before = JSON.stringify(s);
    run(s, 10);
    expect(JSON.stringify(s)).toBe(before);
  });
});
describe('input boundaries and course geometry', () => {
  it('rejects nonfinite and malformed network input', () => {
    expect(cleanInput(null)).toEqual(EMPTY_INPUT);
    expect(
      cleanInput({
        throttle: Infinity,
        steer: NaN,
        brake: -1,
        drift: 'true',
        item: 1,
      }),
    ).toEqual(EMPTY_INPUT);
    expect(cleanInput({ throttle: 10, steer: -20, brake: 3 })).toEqual({
      ...EMPTY_INPUT,
      throttle: 1,
      steer: -1,
      brake: 1,
    });
  });
  for (const id of [0, 1, 2])
    it(`closes course ${id} with consistent normals and a smooth seam`, () => {
      const t = getTrack(id);
      expect(t.length).toBeGreaterThan(350);
      expect(position(t, 0, 0)).toEqual(position(t, t.length, 0));
      const p = sample(t, 12);
      expect(Math.abs(p.nx * p.tx + p.nz * p.tz)).toBeLessThan(0.001);
      for (const point of t.samples)
        expect(Number.isFinite(point.curvature)).toBe(true);
    });
  it('formats race times and invalid values', () => {
    expect(formatTime(65.123)).toBe('01:05.123');
    expect(formatTime(NaN)).toBe('--:--.---');
  });
});
