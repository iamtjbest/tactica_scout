"use client";
import Crest from "./Crest";
import type { StandingRow } from "@/lib/api";

const FORM_TONE: Record<string, string> = {
  W: "bg-grn/15 text-grn",
  D: "bg-white/5 text-mt",
  L: "bg-red2/15 text-red2",
};

export default function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) return <p className="text-mt text-sm">No teams yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-mt text-[10px] uppercase tracking-wider">
            <th className="text-left font-semibold pb-2 pl-1">#</th>
            <th className="text-left font-semibold pb-2">Team</th>
            <th className="text-right font-semibold pb-2">P</th>
            <th className="text-right font-semibold pb-2">W</th>
            <th className="text-right font-semibold pb-2">D</th>
            <th className="text-right font-semibold pb-2">L</th>
            <th className="text-right font-semibold pb-2">GD</th>
            <th className="text-right font-semibold pb-2 pr-1">Pts</th>
            <th className="text-right font-semibold pb-2">Form</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_id} className="border-t border-bd">
              <td className="py-2 pl-1 text-mt font-mono text-xs">{r.position}</td>
              <td className="py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Crest url={r.crest_url} name={r.name} size={18} />
                  <span className="text-white truncate">{r.name}</span>
                </div>
              </td>
              <td className="py-2 text-right text-white/80 font-mono text-xs">{r.played}</td>
              <td className="py-2 text-right text-white/80 font-mono text-xs">{r.won}</td>
              <td className="py-2 text-right text-white/80 font-mono text-xs">{r.drawn}</td>
              <td className="py-2 text-right text-white/80 font-mono text-xs">{r.lost}</td>
              <td className="py-2 text-right text-white/80 font-mono text-xs">
                {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
              </td>
              <td className="py-2 text-right pr-1 text-volt font-mono font-bold text-xs">
                {r.points}
              </td>
              <td className="py-2 text-right">
                <div className="flex gap-1 justify-end">
                  {r.form.map((f, i) => (
                    <span key={i}
                      className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${FORM_TONE[f] || ""}`}>
                      {f}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
