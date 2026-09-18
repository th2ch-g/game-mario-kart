import { KARTS } from '../game/catalog';
export function KartArt({ kart = 0 }: { kart?: number }) {
  const k = KARTS[kart];
  return (
    <svg viewBox="0 0 240 160" className="kart-art" aria-hidden="true">
      <ellipse cx="122" cy="134" rx="85" ry="12" fill="#173d37" opacity=".08" />
      <path d="M45 100l55-28 99 27-59 34z" fill="#2e4546" />
      <g fill="#293e40">
        <rect
          x="43"
          y="87"
          width="27"
          height="36"
          rx="10"
          transform="rotate(-12 43 87)"
        />
        <rect
          x="162"
          y="92"
          width="28"
          height="38"
          rx="10"
          transform="rotate(-12 162 92)"
        />
        <rect x="94" y="67" width="23" height="31" rx="9" />
        <rect x="195" y="83" width="23" height="34" rx="9" />
      </g>
      <path d="M59 92l47-26 85 20 1 24-55 24-76-22z" fill={k.color} />
      <path d="M61 93l47-22 82 17-54 26z" fill={k.secondary} />
      <path d="M66 94l34-14 38 10-32 15z" fill={k.color} />
      <path d="M137 114l55-25v20l-54 24z" fill={k.color} />
      <path d="M156 99l-2-16 25-12 1 18" fill="#314344" />
      <path d="M179 77l-4-22-49-13-14 7 44 14 4 20" fill={k.color} />
      <path d="M133 88l-18-6-4-25 22 4z" fill="#384c4a" />
      <ellipse cx="121" cy="54" rx="21" ry="23" fill={k.color} />
      <path d="M101 47q14-9 33 2l3 11q-18 8-35-2z" fill="#2c5960" />
      <path
        d="M106 49l11-1"
        stroke="#dfffee"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M96 79l-16 12 7 6 20-12" fill={k.secondary} />
      <path d="M64 108l72 19v9l-72-18z" fill={k.color} />
      <path
        d="M74 110l44 12"
        stroke="#fff2d3"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="57" cy="110" r="7" fill="#b3c4be" />
      <circle cx="177" cy="115" r="7" fill="#b3c4be" />
    </svg>
  );
}
