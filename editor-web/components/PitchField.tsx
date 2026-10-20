"use client";

/**
 * The hero backdrop: a pitch receding into the distance, with a move
 * playing across it on a loop.
 *
 * Drawn, not photographed. House rule is that images come from Figma or
 * are generated, never stock, and a drawn pitch is a few kilobytes where
 * a hero photo is a few megabytes, which on mobile data decides whether
 * the page opens at all.
 *
 * The perspective is built into the coordinates rather than applied as a
 * CSS rotateX. A rotated element pushes most of itself outside its own
 * box and gets clipped, which is why the first attempt read as a stray
 * ellipse instead of a pitch. Here every line is placed where it would
 * actually land: touchlines converging toward a vanishing point above
 * the far goal, and rows bunching up as they recede.
 */

const W = 1000;
const H = 560;

// Far edge and near edge of the pitch in screen coordinates. The near
// edge runs off both sides of the frame, which is what makes it feel
// like you are standing on the touchline rather than looking at a map.
const FAR_L = 352, FAR_R = 648, FAR_Y = 72;
const NEAR_L = -140, NEAR_R = 1140, NEAR_Y = 540;

/**
 * Depth along the pitch (0 = far goal, 1 = near goal) to screen
 * progress. Ground planes compress with distance, so this is non-linear:
 * the near half of the pitch takes up more of the frame than the far
 * half, exactly as it does when you stand at one end.
 */
const K = 2.3;
const t = (d: number) => (K * d) / (1 + (K - 1) * d);

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** A row across the pitch at depth d: its y, and its left and right x. */
function row(d: number) {
  const p = t(d);
  return {
    y: lerp(FAR_Y, NEAR_Y, p),
    l: lerp(FAR_L, NEAR_L, p),
    r: lerp(FAR_R, NEAR_R, p),
  };
}

/** A point at depth d, u across the width (0 = left touchline). */
function pt(d: number, u: number): [number, number] {
  const { y, l, r } = row(d);
  return [lerp(l, r, u), y];
}

/** A box on the ground: depths d0..d1, width u0..u1. */
function box(d0: number, d1: number, u0: number, u1: number) {
  const a = pt(d0, u0), b = pt(d0, u1), c = pt(d1, u1), e = pt(d1, u0);
  return `M${a} L${b} L${c} L${e} Z`;
}

export default function PitchField() {
  const half = row(0.5);
  // The centre circle sits on the ground, so it is an ellipse, squashed
  // by roughly the same factor the rows are.
  const cx = (half.l + half.r) / 2;
  const rx = (half.r - half.l) * 0.145;

  // Stripes across the grass. Drawn as rows rather than mown bands so
  // they stay cheap, and faint enough to be texture rather than pattern.
  const stripes = [0.08, 0.2, 0.33, 0.47, 0.62, 0.78, 0.92];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          {/* Lines fade out toward the horizon so the pitch dissolves
              into the background instead of stopping at a hard edge. */}
          <linearGradient id="pf-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#CCFF00" stopOpacity="0" />
            <stop offset="22%"  stopColor="#CCFF00" stopOpacity="0.32" />
            <stop offset="70%"  stopColor="#CCFF00" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#CCFF00" stopOpacity="0.16" />
          </linearGradient>
          <mask id="pf-mask">
            <rect width={W} height={H} fill="url(#pf-depth)" />
          </mask>
        </defs>

        <g mask="url(#pf-mask)" fill="none" stroke="#CCFF00" strokeWidth="1.4">
          {/* grass */}
          {stripes.map((d) => {
            const r = row(d);
            return (
              <line key={d} x1={r.l} y1={r.y} x2={r.r} y2={r.y}
                    strokeWidth="0.9" opacity="0.14" />
            );
          })}

          {/* touchlines and goal lines */}
          <path d={box(0, 1, 0, 1)} />

          {/* halfway */}
          <line x1={half.l} y1={half.y} x2={half.r} y2={half.y} />
          <ellipse cx={cx} cy={half.y} rx={rx} ry={rx * 0.3} />

          {/* penalty and six-yard areas, both ends */}
          <path d={box(0, 0.17, 0.2, 0.8)} />
          <path d={box(0, 0.06, 0.34, 0.66)} />
          <path d={box(0.83, 1, 0.2, 0.8)} />
          <path d={box(0.94, 1, 0.34, 0.66)} />
        </g>

        {/* A move, looping. Three passes and a run, which is as much
            story as a background should tell. */}
        <g mask="url(#pf-mask)">
          <path
            d={`M${pt(0.9, 0.18)} L${pt(0.62, 0.42)} L${pt(0.48, 0.74)} L${pt(0.2, 0.55)}`}
            stroke="#00E5FF" strokeWidth="2" strokeDasharray="7 9"
            fill="none" opacity="0.45"
          />
          <circle r="6.5" fill="#CCFF00" opacity="0.9">
            <animateMotion
              dur="6s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1"
              calcMode="linear"
              path={`M${pt(0.9, 0.18)} L${pt(0.62, 0.42)} L${pt(0.48, 0.74)} L${pt(0.2, 0.55)}`}
            />
          </circle>
        </g>
      </svg>

      {/* Grain, so the flat fill doesn't band on a cheap panel. */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* The type sits over the left half, so that side is darkened
          hard and the right is left to breathe. */}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-bg/30" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}
