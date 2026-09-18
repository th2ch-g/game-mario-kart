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
    points = t.samples
      .filter((_, i) => i % 8 === 0)
      .map((p) => `${p.x + 110},${p.z + 110}`)
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
            cx={p.x + 110}
            cy={p.z + 110}
            r={r.id === player ? 7 : 4.5}
            fill={KARTS[r.kart].color}
            stroke={r.id === player ? 'white' : '#193d37'}
            strokeWidth="2"
          />
        );
      })}
      <rect
        x={t.samples[0].x + 106}
        y={t.samples[0].z + 103}
        width="8"
        height="14"
        rx="2"
        fill="currentColor"
      />
    </svg>
  );
}
