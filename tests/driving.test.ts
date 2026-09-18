import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { createRace, STEP, stepRace } from '../src/game/engine';
import { getTrack, position, sample } from '../src/game/tracks';
import { EMPTY_INPUT } from '../src/game/types';

describe('driver-relative steering', () => {
  for (const assist of [false, true])
    for (const trackId of [0, 1, 2])
      for (const direction of [-1, 1])
        it(`moves ${direction < 0 ? 'left' : 'right'} on screen on course ${trackId}, assist ${assist}`, () => {
          const track = getTrack(trackId);
          const drive = (steer: number) => {
            const race = createRace(
              {
                track: trackId,
                laps: 1,
                difficulty: 1,
                mode: 'time',
                assist,
                seed: 42,
              },
              [{ id: 'driver', name: 'Driver', kart: 0, cpu: false }],
            );
            race.phase = 'racing';
            Object.assign(race.racers[0], { s: 0, offset: 0, speed: 24 });
            for (let i = 0; i < 18; i++)
              stepRace(
                race,
                { driver: { ...EMPTY_INPUT, throttle: 1, steer } },
                STEP,
              );
            const r = race.racers[0];
            const p = position(track, r.s, r.offset);
            return new Vector3(p.x, p.y + 1, p.z);
          };
          const p = sample(track, 0);
          const camera = new PerspectiveCamera(65, 16 / 9, 0.1, 500);
          camera.position.set(p.x - p.tx * 9, p.y + 5, p.z - p.tz * 9);
          camera.lookAt(p.x + p.tx * 15, p.y + 1, p.z + p.tz * 15);
          camera.updateMatrixWorld(true);
          const neutral = drive(0).project(camera).x;
          const steered = drive(direction).project(camera).x;
          expect((steered - neutral) * direction).toBeGreaterThan(0.015);
        });
});
