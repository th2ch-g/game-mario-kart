import { getTrack, position } from '../game/tracks';
import { KARTS } from '../game/catalog';
import type { RaceState } from '../game/types';

export function TrackMap({
  track,
  race,
  player,
  className = '',
}: {
  track: number;
  race?: RaceState;
  player?: string;
  className?: string;
}) {
  const t = getTrack(track),
    xs = t.samples.map((p) => p.x),
    zs = t.samples.map((p) => p.z),
    minX = Math.min(...xs),
    minZ = Math.min(...zs),
    scale = 184 / Math.max(Math.max(...xs) - minX, Math.max(...zs) - minZ),
    mapX = (x: number) => 18 + (x - minX) * scale,
    mapZ = (z: number) => 18 + (z - minZ) * scale,
    points = t.samples
      .filter((_, i) => i % 8 === 0)
      .map((p) => `${mapX(p.x)},${mapZ(p.z)}`)
      .concat(`${mapX(t.samples[0].x)},${mapZ(t.samples[0].z)}`)
      .join(' ');
  return (
    <svg
      viewBox="0 0 220 220"
      className={className}
      aria-label={`${t.definition.name}のコース図`}
      role="img"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={race ? 9 : 13}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity=".2"
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={race ? 3 : 4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {race?.racers.map((r) => {
        const p = position(t, r.s, 0);
        return (
          <circle
            key={r.id}
            cx={mapX(p.x)}
            cy={mapZ(p.z)}
            r={r.id === player ? 7 : 4.5}
            fill={KARTS[r.kart].color}
            stroke={r.id === player ? 'white' : '#193d37'}
            strokeWidth="2"
          />
        );
      })}
      <rect
        x={mapX(t.samples[0].x) - 4}
        y={mapZ(t.samples[0].z) - 7}
        width="8"
        height="14"
        rx="2"
        fill="currentColor"
      />
    </svg>
  );
}
