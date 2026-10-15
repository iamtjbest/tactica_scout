"use client";
import { useState } from "react";
import PlayerPicker, { type SelectedPlayer } from "@/components/PlayerPicker";
import RadarChart from "@/components/RadarChart";

export default function ComparePage() {
  const [playerA, setPlayerA] = useState<SelectedPlayer | null>(null);
  const [playerB, setPlayerB] = useState<SelectedPlayer | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Compare Players</h1>
        <p className="text-mt text-sm mt-1">
          Search two players, pick a club spell for each, see how they stack up.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PlayerPicker accent="volt" onSelect={setPlayerA} />
        <PlayerPicker accent="cyan" onSelect={setPlayerB} />
      </div>

      {(playerA || playerB) && (
        <div className="card flex justify-center py-6">
          <RadarChart
            playerA={playerA ? { name: playerA.name, values: playerA.values } : null}
            playerB={playerB ? { name: playerB.name, values: playerB.values } : null}
          />
        </div>
      )}

      {playerA && playerB && <StatTable playerA={playerA} playerB={playerB} />}
    </div>
  );
}

function StatTable({ playerA, playerB }: { playerA: SelectedPlayer; playerB: SelectedPlayer }) {
  const rows: { label: string; key: keyof SelectedPlayer["values"] }[] = [
    { label: "Shooting",   key: "shooting" },
    { label: "Creativity", key: "creativity" },
    { label: "Passing",    key: "passing" },
    { label: "Defending",  key: "defending" },
    { label: "Dribbling",  key: "dribbling" },
    { label: "Physical",   key: "physical" },
  ];

  return (
    <div className="card">
      <p className="section-label mb-3">Breakdown</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-mt text-xs">
            <td className="py-1">Axis</td>
            <td className="py-1 text-right text-volt">{playerA.name}</td>
            <td className="py-1 text-right text-cyan">{playerB.name}</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-bd">
              <td className="py-2 text-white">{r.label}</td>
              <td className="py-2 text-right text-white font-mono">{playerA.values[r.key]}</td>
              <td className="py-2 text-right text-white font-mono">{playerB.values[r.key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
