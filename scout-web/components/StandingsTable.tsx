"use client";
import Link from "next/link";
import { type StandingsRow } from "@/lib/api";
import clsx from "clsx";

export default function StandingsTable({ rows, highlightTeamId }: { rows: StandingsRow[], highlightTeamId?: number }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-mt text-xs uppercase tracking-wide border-b border-bd">
          <th className="text-left font-semibold py-2 pr-2">#</th>
          <th className="text-left font-semibold py-2 pr-2">Team</th>
          <th className="text-center font-semibold py-2 px-1">P</th>
          <th className="text-center font-semibold py-2 px-1">W</th>
          <th className="text-center font-semibold py-2 px-1">D</th>
          <th className="text-center font-semibold py-2 px-1">L</th>
          <th className="text-center font-semibold py-2 px-1">GD</th>
          <th className="text-center font-semibold py-2 pl-1">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isHighlighted = highlightTeamId && r.team_id === highlightTeamId;
          return (
            <tr 
              key={r.team_id ?? `${r.team}-${i}`} 
              className={clsx(
                "border-b border-bd/50 last:border-0 transition-colors",
                isHighlighted ? "bg-volt2/10 border-l-2 border-l-volt2" : "hover:bg-white/5"
              )}
            >
              <td className="py-2 pr-2 text-mt pl-2">{r.position ?? i + 1}</td>
              <td className="py-2 pr-2">
                {r.team_id ? (
                  <Link href={`/team/${r.team_id}`} className={clsx("font-semibold truncate max-w-[140px] hover:text-volt2 transition-colors block", isHighlighted ? "text-volt2" : "text-white")}>
                    {r.team}
                  </Link>
                ) : (
                  <span className={clsx("font-semibold truncate max-w-[140px]", isHighlighted ? "text-volt2" : "text-white")}>{r.team}</span>
                )}
              </td>
              <td className="py-2 px-1 text-center text-mt">{r.played}</td>
              <td className="py-2 px-1 text-center text-mt">{r.won}</td>
              <td className="py-2 px-1 text-center text-mt">{r.drawn}</td>
              <td className="py-2 px-1 text-center text-mt">{r.lost}</td>
              <td className="py-2 px-1 text-center text-mt">{r.goal_diff}</td>
              <td className="py-2 pl-1 text-center font-bold text-white">{r.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
