"use client";

/**
 * A passing move, looping, on half a pitch.
 *
 * Pure SVG + CSS. No library, no canvas, no JS animation loop: this is
 * the first screen anyone sees and it should not cost a frame of the
 * form's responsiveness, or a second of load on a phone in Zaria.
 *
 * `prefers-reduced-motion` stops the ball and the pulses. The layout
 * is unchanged, so nothing jumps.
 */
export default function PitchAnimation() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-bg2">
      <svg viewBox="0 0 400 600" className="w-full h-full" preserveAspectRatio="xMidYMid slice"
           aria-hidden="true">
        <defs>
          <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D1317" />
            <stop offset="100%" stopColor="#0A0F13" />
          </linearGradient>
        </defs>

        <rect width="400" height="600" fill="url(#turf)" />

        {/* markings */}
        <g stroke="#1E2A33" strokeWidth="1.5" fill="none">
          <rect x="30" y="30" width="340" height="540" />
          <line x1="30" y1="300" x2="370" y2="300" />
          <circle cx="200" cy="300" r="60" />
          <circle cx="200" cy="300" r="2.5" fill="#1E2A33" />
          <rect x="120" y="30" width="160" height="70" />
          <rect x="120" y="500" width="160" height="70" />
          <rect x="165" y="30" width="70" height="28" />
          <rect x="165" y="542" width="70" height="28" />
        </g>

        {/* the move: four players, three passes */}
        <g>
          {[
            { cx: 200, cy: 500, d: "0s" },
            { cx: 110, cy: 380, d: "1.1s" },
            { cx: 270, cy: 250, d: "2.2s" },
            { cx: 200, cy: 120, d: "3.3s" },
          ].map((p, i) => (
            <g key={i}>
              <circle cx={p.cx} cy={p.cy} r="9" fill="#151E25" stroke="#CCFF00" strokeWidth="1.5" />
              <circle cx={p.cx} cy={p.cy} r="9" fill="none" stroke="#CCFF00" strokeWidth="1.5"
                      className="pulse" style={{ animationDelay: p.d }} />
            </g>
          ))}

          {/* pass lines, drawn as the ball travels them */}
          <g stroke="#CCFF00" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.4" fill="none">
            <path d="M200 500 L110 380" />
            <path d="M110 380 L270 250" />
            <path d="M270 250 L200 120" />
          </g>

          {/* the ball */}
          <circle r="5" fill="#CCFF00" className="ball">
            <animateMotion dur="4.4s" repeatCount="indefinite" keyPoints="0;0.33;0.66;1"
                           keyTimes="0;0.33;0.66;1" calcMode="linear"
                           path="M200 500 L110 380 L270 250 L200 120" />
          </circle>
        </g>

        {/* goal */}
        <rect x="170" y="26" width="60" height="5" fill="#00E5FF" opacity="0.7" />
      </svg>

      <style jsx>{`
        .pulse {
          transform-origin: center;
          animation: ring 4.4s ease-out infinite;
          opacity: 0;
        }
        @keyframes ring {
          0%   { transform: scale(1);   opacity: 0.9; }
          12%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        /* Honour the system setting. Someone who gets motion sick from a
           looping animation should not have to leave the sign-in page. */
        @media (prefers-reduced-motion: reduce) {
          .pulse { animation: none; opacity: 0; }
          :global(.ball) { display: none; }
        }
      `}</style>
    </div>
  );
}
