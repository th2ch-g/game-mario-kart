import type { RecordEntry, Settings } from '../game/types';
const SETTINGS_KEY = 'kartline.settings.v1',
  RECORDS_KEY = 'kartline.records.v2';
export const DEFAULT_SETTINGS: Settings = {
  name: 'Player',
  kart: 0,
  sound: true,
  volume: 0.35,
  quality: 'auto',
  autoAccelerate: true,
  assist: true,
  vibration: true,
};
export function readSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (!v || typeof v !== 'object') return { ...DEFAULT_SETTINGS };
    return {
      name:
        typeof v.name === 'string'
          ? v.name.trim().slice(0, 16) || 'Player'
          : 'Player',
      kart: Number.isInteger(v.kart) && v.kart >= 0 && v.kart < 6 ? v.kart : 0,
      sound: typeof v.sound === 'boolean' ? v.sound : true,
      volume: Number.isFinite(v.volume)
        ? Math.min(1, Math.max(0, v.volume))
        : 0.35,
      quality: ['auto', 'high', 'low'].includes(v.quality) ? v.quality : 'auto',
      autoAccelerate:
        typeof v.autoAccelerate === 'boolean' ? v.autoAccelerate : true,
      assist: typeof v.assist === 'boolean' ? v.assist : true,
      vibration: typeof v.vibration === 'boolean' ? v.vibration : true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Storage is optional. */
  }
}
export function readRecords(): RecordEntry[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (r) =>
          r &&
          Number.isInteger(r.track) &&
          r.track >= 0 &&
          r.track < 3 &&
          Number.isFinite(r.time) &&
          r.time > 0 &&
          typeof r.date === 'string' &&
          Array.isArray(r.ghost) &&
          r.ghost.length <= 4000 &&
          r.ghost.every(
            (p: Record<string, unknown>) =>
              p &&
              ['t', 's', 'offset', 'yaw'].every(
                (k) => typeof p[k] === 'number' && Number.isFinite(p[k]),
              ) &&
              (p.lift === undefined ||
                (typeof p.lift === 'number' &&
                  Number.isFinite(p.lift) &&
                  p.lift >= 0)),
          ),
      )
      .slice(0, 3);
  } catch {
    return [];
  }
}
export function saveRecord(record: RecordEntry): boolean {
  const records = readRecords(),
    previous = records.find((r) => r.track === record.track);
  if (previous && previous.time <= record.time) return false;
  try {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify([
        ...records.filter((r) => r.track !== record.track),
        record,
      ]),
    );
    return true;
  } catch {
    return false;
  }
}
