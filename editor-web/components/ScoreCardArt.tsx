"use client";

/**
 * An original match card, in the product's own styling.
 *
 * Deliberately generic sides and an invented scoreline: putting a real
 * club and a real result on a marketing page states something untrue,
 * and the badge would not be ours to use. This shows the shape of the
 * thing, not a fixture.
 *
 * The score sits right next to the team name rather than pushed to the
 * far edge. On a wide card a flex-1 name leaves the number stranded and
 * the pair stops reading as one row.
 */
export default function ScoreCardArt({
  home, away, hs, as: awayScore, minute, label = "Group A", tilt = 0, className = "",
}: {
  home: string; away: string; hs: number; as: number;
  minute?: string; label?: string; tilt?: number; className?: string;
}) {
  const initials = (n: string) =>
    n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div
      className={`bg-sur/95 border border-bd rounded-xl px-4 py-3.5
                  shadow-2xl backdrop-blur-sm ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="font-mono text-[9px] tracking-[0.2em] text-volt uppercase">
          {label}
        </span>
        <span className="font-mono text-[9px] text-mt">
          {minute ? (
            <span className="flex items-center gap-1.5 text-red2">
              <span className="w-1.5 h-1.5 rounded-full bg-red2 animate-pulse" />
              {minute}
            </span>
          ) : (
            "FT"
          )}
        </span>
      </div>

      {[[home, hs], [away, awayScore]].map(([name, score], i) => (
        <div key={i} className="flex items-center gap-2.5 py-1">
          <span className="w-5 h-5 rounded-full bg-sur2 text-mt text-[8px] font-bold
                           flex items-center justify-center shrink-0">
            {initials(String(name))}
          </span>
          <span className="text-white text-[13px] truncate">{name}</span>
          <span className="font-display font-black text-base text-white ml-auto pl-3">
            {score}
          </span>
        </div>
      ))}
    </div>
  );
}
