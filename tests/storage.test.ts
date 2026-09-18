import { beforeEach, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  readRecords,
  readSettings,
  saveRecord,
  saveSettings,
} from '../src/lib/storage';
beforeEach(() => {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
  });
});
it('falls back safely for broken JSON and null settings', () => {
  localStorage.setItem('kartline.settings.v1', '{');
  expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  localStorage.setItem('kartline.settings.v1', 'null');
  expect(readSettings()).toEqual(DEFAULT_SETTINGS);
});
it('validates every stored preference', () => {
  localStorage.setItem(
    'kartline.settings.v1',
    JSON.stringify({
      kart: 50,
      volume: 90,
      quality: 'ultra',
      assist: 0,
      name: 'A'.repeat(99),
    }),
  );
  const s = readSettings();
  expect(s.kart).toBe(0);
  expect(s.volume).toBe(1);
  expect(s.quality).toBe('auto');
  expect(s.assist).toBe(true);
  expect(s.name).toHaveLength(16);
});
it('retains preferences across reloads', () => {
  saveSettings({ ...DEFAULT_SETTINGS, quality: 'low', sound: false, kart: 3 });
  expect(readSettings()).toMatchObject({
    quality: 'low',
    sound: false,
    kart: 3,
  });
});
it('replaces records only when a completed attempt is faster', () => {
  const record = {
    track: 0,
    time: 60,
    date: '2026-01-01',
    ghost: [{ t: 1, s: 5, offset: 0, yaw: 0 }],
  };
  expect(saveRecord(record)).toBe(true);
  expect(saveRecord({ ...record, time: 70 })).toBe(false);
  expect(saveRecord({ ...record, time: 50 })).toBe(true);
  expect(readRecords()).toHaveLength(1);
  expect(readRecords()[0].time).toBe(50);
});
it('ignores malformed ghost data', () => {
  localStorage.setItem(
    'kartline.records.v1',
    JSON.stringify([
      {
        track: 0,
        time: 10,
        date: 'x',
        ghost: [{ t: 1, s: 'bad', offset: 0, yaw: 0 }],
      },
    ]),
  );
  expect(readRecords()).toEqual([]);
});
it('keeps functioning when browser storage is unavailable', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw Error('blocked');
    },
    setItem: () => {
      throw Error('blocked');
    },
  });
  expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  expect(readRecords()).toEqual([]);
  expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  expect(saveRecord({ track: 0, time: 5, date: 'x', ghost: [] })).toBe(false);
});
