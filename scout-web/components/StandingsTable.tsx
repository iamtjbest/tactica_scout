"use client";
import { useState } from "react";
import Link from "next/link";
import { BSD_IMG_BASE, type StandingsRow } from "@/lib/api";
import clsx from "clsx";

function ClubBadge({
  teamId,
  crestUrl,
  name,
}: {
  teamId: number | string | null;
  crestUrl?: string | null;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  const isLocal = typeof teamId === "string" && !/^\d+$/.test(teamId);
  const src = isLocal
    ? crestUrl || ""
    : teamId != null
      ? `${BSD_IMG_BASE}/img/team/${teamId}/?sor=true&bg=transparent`
      : "";

  if (!src || failed) {
    return (
      <span className="w-5 h-5 rounded-full bg-sur2 border border-bd text-mt text-[8px] font-bold flex items-center justify-center shrink-0">
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="w-5 h-5 object-contain shrink-0"
    />
  );
}

export default function StandingsTable({
  rows,
  highlightTeamId,
}: {
  rows: StandingsRow[];
  highlightTeamId?: number | string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-mt text-xs uppercase tracking-wide border-b border-bd">
          <th className="text-left font-semibold py-2 pl-2 pr-2">#</th>
          <th className="text-left font-semibold py-2 pr-2">Team</th>
          <th className="text-center font-semibold py-2 px-1">P</th>
          <th className="text-center font-semibold py-2 px-1">W</th>
          <th className="text-center font-semibold py-2 px-1">D</th>
          <th className="text-center font-semibold py-2 px-1">L</th>
          <th className="text-center font-semibold py-2 px-1 hidden sm:table-cell">GF:GA</th>
          <th className="text-center font-semibold py-2 px-1">GD</th>
          <th className="text-center font-semibold py-2 px-1">Pts</th>
          <th className="text-right font-semibold py-2 pr-2 hidden md:table-cell">Form</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isHighlighted = highlightTeamId != null && r.team_id === highlightTeamId;
          const form = (r as any).form as string[] | undefined;
          return (
            <tr
              key={r.team_id ?? `${r.team}-${i}`}
              className={clsx(
                "border-b border-bd/50 last:border-0 transition-colors",
                isHighlighted ? "bg-volt2/10 border-l-2 border-l-volt2" : "hover:bg-white/5"
              )}
            >
              <td className="py-2.5 pr-2 text-mt pl-2 font-mono text-xs">
                {r.position ?? i + 1}
              </td>
              <td className="py-2.5 pr-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ClubBadge teamId={r.team_id} crestUrl={r.crest_url} name={r.team} />
                  {r.team_id ? (
                    <Link
                      href={`/team/${r.team_id}`}
                      className={clsx(
                        "font-semibold truncate max-w-[160px] sm:max-w-[220px] hover:text-volt2 transition-colors",
                        isHighlighted ? "text-volt2" : "text-white"
                      )}
                    >
                      {r.team}
                    </Link>
                  ) : (
                    <span
                      className={clsx(
                        "font-semibold truncate max-w-[160px]",
                        isHighlighted ? "text-volt2" : "text-white"
                      )}
                    >
                      {r.team}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-1 text-center text-mt">{r.played}</td>
              <td className="py-2.5 px-1 text-center text-mt">{r.won}</td>
              <td className="py-2.5 px-1 text-center text-mt">{r.drawn}</td>
              <td className="py-2.5 px-1 text-center text-mt">{r.lost}</td>
              <td className="py-2.5 px-1 text-center text-mt2 text-xs font-mono hidden sm:table-cell">
                {r.goals_for}:{r.goals_against}
              </td>
              <td className="py-2.5 px-1 text-center text-mt font-mono text-xs">
                {r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}
              </td>
              <td className="py-2.5 px-1 text-center font-bold text-white">{r.points}</td>
              <td className="py-2.5 pr-2 hidden md:table-cell">
                <div className="flex items-center justify-end gap-1">
                  {(form || []).map((res, idx) => (
                    <span
                      key={idx}
                      className={clsx(
                        "w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center",
                        res === "W"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : res === "L"
                            ? "bg-red2/20 text-red2"
                            : "bg-white/10 text-mt"
                      )}
                    >
                      {res}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}