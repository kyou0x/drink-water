import { useEffect, useState } from "react";

/** Interior outline of the bottle (neck → shoulders → body), viewBox 0 0 200 300. */
const BOTTLE_PATH =
  "M78 30 L78 52 C78 72 28 80 28 110 L28 272 Q28 294 50 294 L150 294 Q172 294 172 272 L172 110 C172 80 122 72 122 52 L122 30 Z";
const BOTTOM = 294;
/** Level of a 99.9% full bottle: the top of the body, just under the shoulders. */
const FULL_LEVEL = 104;
const TOP = 30;

/** One wavelength = 100 units; the path is 4 wavelengths wide so translating -100 loops seamlessly. */
const WAVE = "M0 0 Q25 -5 50 0 T100 0 T150 0 T200 0 T250 0 T300 0 T350 0 T400 0 V320 H0 Z";

function liquidLevel(fill: number) {
  if (fill <= 0) return BOTTOM + 8; // fully hidden (wave crest below the floor)
  if (fill >= 1) return TOP - 10; // at 100% the shoulders and neck fill too: completely full
  return BOTTOM - fill * (BOTTOM - FULL_LEVEL);
}

function ticks(goalMl: number) {
  const step = goalMl <= 6000 ? 1000 : goalMl <= 12000 ? 2000 : 5000;
  const out: { y: number; label: string }[] = [];
  for (let ml = step; ml < goalMl; ml += step) {
    out.push({ y: BOTTOM - (ml / goalMl) * (BOTTOM - FULL_LEVEL), label: `${ml / 1000}L` });
  }
  return out;
}

interface Props {
  fill: number;
  goalMl: number;
  /** Changes when the goal is crossed; triggers the celebration animation. */
  celebrate: number;
  /** Accessible description, e.g. "Bottle 42% full". */
  label: string;
}

export function Bottle({ fill, goalMl, celebrate, label }: Props) {
  // Celebrate while the latest token hasn't been marked as finished.
  const [finished, setFinished] = useState(0);
  const celebrating = celebrate > 0 && finished !== celebrate;

  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setFinished(celebrate), 2600);
    return () => clearTimeout(t);
  }, [celebrate]);

  const level = liquidLevel(fill);
  const levelStyle = {
    transform: `translateY(${level}px)`,
    transition: "transform 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return (
    <svg
      viewBox="0 0 200 300"
      className={`h-full w-auto overflow-visible ${celebrating ? "celebrate" : ""}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id="bottle-inside">
          <path d={BOTTLE_PATH} />
        </clipPath>
        <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6cc0f2" />
          <stop offset="1" stopColor="#2a6fc6" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9ccff5" stopOpacity="0.07" />
          <stop offset="0.5" stopColor="#9ccff5" stopOpacity="0.02" />
          <stop offset="1" stopColor="#9ccff5" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* glass body */}
      <path d={BOTTLE_PATH} fill="url(#glass)" />

      {/* liquid */}
      <g clipPath="url(#bottle-inside)">
        <g style={levelStyle}>
          <g className="wave-back">
            <path d={WAVE} transform="translate(-30 -2)" fill="#4f9fe0" opacity="0.45" />
          </g>
          <g className="wave-front">
            <path d={WAVE} fill="url(#liquid)" />
          </g>
        </g>
        {celebrating &&
          [44, 70, 98, 124, 150, 84].map((x, i) => (
            <circle
              key={i}
              className="bubble"
              cx={x}
              cy={286}
              r={2 + (i % 3)}
              fill="#d6ecfb"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
      </g>

      {/* volume marks */}
      {ticks(goalMl).map((t) => (
        <g key={t.label}>
          <line x1={152} x2={166} y1={t.y} y2={t.y} stroke="#cfe6f8" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
          <text x={147} y={t.y + 3} textAnchor="end" fontSize="9" fontWeight="500" fill="#cfe6f8" fillOpacity="0.5">
            {t.label}
          </text>
        </g>
      ))}

      {/* glass highlight + outline */}
      <path d="M40 134 L40 250" stroke="#ffffff" strokeOpacity="0.045" strokeWidth="3" strokeLinecap="round" />
      <path d={BOTTLE_PATH} fill="none" stroke="#8ec5f0" strokeOpacity="0.6" strokeWidth="2.5" strokeLinejoin="round" />

      {/* cap */}
      <rect x="72" y="6" width="56" height="22" rx="5" fill="#1d2a38" stroke="#8ec5f0" strokeOpacity="0.6" strokeWidth="2" />
      <line x1="80" x2="120" y1="13" y2="13" stroke="#8ec5f0" strokeOpacity="0.18" strokeWidth="1.5" />
      <line x1="80" x2="120" y1="20" y2="20" stroke="#8ec5f0" strokeOpacity="0.18" strokeWidth="1.5" />
    </svg>
  );
}
