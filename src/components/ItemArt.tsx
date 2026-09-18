import type { Item } from '../game/types';

export function ItemArt({ kind }: { kind: Item }) {
  const shell = kind === 'rocket' || kind === 'green' || kind === 'blue';
  const mushroom = (x: number, y: number, scale: number) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M-10 1h20v12c0 7-20 7-20 0z"
        fill="#fff1cd"
        stroke="#70472d"
        strokeWidth="2"
      />
      <path
        d="M-21 1a21 21 0 0 1 42 0q-21 8-42 0"
        fill="#ed6551"
        stroke="#70472d"
        strokeWidth="2"
      />
      <ellipse cx="0" cy="-9" rx="7" ry="8" fill="#fff3d4" />
      <path d="M-17-7q7 0 7 8h-11m38-8q-7 0-7 8h11" fill="#fff3d4" />
      <path
        d="M-4 7v4m8-4v4"
        stroke="#3d4944"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </g>
  );
  return (
    <svg viewBox="0 0 64 64" className="item-art" aria-hidden="true">
      {kind === 'boost' && mushroom(32, 34, 1.15)}
      {kind === 'triple' && (
        <>
          {mushroom(22, 24, 0.72)}
          {mushroom(46, 27, 0.68)}
          {mushroom(30, 45, 0.8)}
        </>
      )}
      {shell && (
        <>
          {kind === 'blue' && (
            <path
              d="M14 24 13 10 26 20 32 3 39 20 52 10 51 27"
              fill="#fff7dc"
              stroke="#46577c"
              strokeWidth="2"
            />
          )}
          <path
            d="M9 43C7 11 56 8 55 43z"
            fill={
              kind === 'green'
                ? '#3db17a'
                : kind === 'blue'
                  ? '#6484ea'
                  : '#e96457'
            }
            stroke="#314c50"
            strokeWidth="3"
          />
          <path
            d="M25 19 40 21 45 33 34 42 21 34zm0 0-9 7m24-5 9 4m-4 8 9 7m-33-6-11 6"
            fill="none"
            stroke="#314c50"
            strokeWidth="2"
            opacity=".8"
          />
          <ellipse
            cx="32"
            cy="44"
            rx="25"
            ry="8"
            fill="#fff0ce"
            stroke="#536467"
            strokeWidth="2"
          />
          <ellipse cx="32" cy="46" rx="11" ry="5" fill="#526060" />
        </>
      )}
      {kind === 'mine' && (
        <>
          <path
            d="m34 8-4 19q-5 20-22 22 14 8 26-8 7 14 24 9-18-8-21-21z"
            fill="#ffd84e"
            stroke="#99722b"
            strokeWidth="2"
          />
          <path
            d="M34 27q-5 15-4 29 10-1 12-9z"
            fill="#ffea78"
            stroke="#99722b"
            strokeWidth="2"
          />
          <path d="m34 8 3-6" stroke="#826339" strokeWidth="5" />
          <path
            d="M31 30v4m7-4v4"
            stroke="#534325"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'star' && (
        <path
          d="m32 5 8 17 19 3-14 14 3 19-16-9-17 9 3-19L4 25l20-3z"
          fill="#ffdc59"
          stroke="#a17a29"
          strokeWidth="2.5"
        />
      )}
      {kind === 'star' && (
        <path
          d="M27 28v10m10-10v10"
          stroke="#634f30"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
      {kind === 'lightning' && (
        <path
          d="M32 3 12 33h16l-5 28 29-37H35l10-21z"
          fill="#ffd657"
          stroke="#a77534"
          strokeWidth="2.5"
        />
      )}
      {kind === 'shield' && (
        <>
          <path
            d="m32 4 22 9v18c0 17-22 28-22 28S10 48 10 31V13z"
            fill="#82e2d4"
            stroke="#337e7c"
            strokeWidth="3"
          />
          <path
            d="m20 31 9 9 16-18"
            fill="none"
            stroke="#fcffea"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'pulse' && (
        <>
          <path
            d="M16 27h12L50 13v37L28 37H16z"
            fill="#efa84f"
            stroke="#805a33"
            strokeWidth="2.5"
          />
          <path d="m22 37 6 18h10l-9-18" fill="#785d45" />
          <path
            d="m56 22 5-4m-5 24 5 4m-4-14h6"
            stroke="#eea941"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'bullet' && (
        <>
          <path d="m18 37-13 15 16-3-3 11 16-16z" fill="#ffb74c" />
          <path
            d="M15 32Q28 3 56 8q2 29-25 43z"
            fill="#394e63"
            stroke="#1d3449"
            strokeWidth="2"
          />
          <path d="m33 20 13-4 4 11-9 8" fill="#fff5d8" />
          <path d="m42 21 4 5" stroke="#283d52" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
