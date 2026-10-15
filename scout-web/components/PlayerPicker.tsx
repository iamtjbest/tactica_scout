"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  searchPlayers,
  getPlayerSeasons,
  getPlayerRadar,
  type PlayerSearchResult,
  type RadarAxes,
} from "@/lib/api";

export type SelectedPlayer = {
  id: number;
  name: string;
  teamId: number | null;
  values: RadarAxes;
};

export default function PlayerPicker({
  accent,
  onSelect,
}: {
  accent: "volt" | "cyan";
  onSelect: (p: SelectedPlayer) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [chosen, setChosen] = useState<PlayerSearchResult | null>(null);
  const [teamBlocks, setTeamBlocks] = useState<{ team_id: number; match_count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doSearch() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchPlayers(query.trim());
      setResults(data.results);
    } catch (e: any) {
      setError(e.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function choosePlayer(p: PlayerSearchResult) {
    setChosen(p);
    setResults([]);
    setLoading(true);
    setError(null);
    try {
      const seasons = await getPlayerSeasons(p.id);
      setTeamBlocks(seasons.team_blocks);
      // Default to whichever spell has the most matches — usually current club
      const biggest = [...seasons.team_blocks].sort((a, b) => b.match_count - a.match_count)[0];
      if (biggest) await pickSpell(p, biggest.team_id);
    } catch (e: any) {
      setError(e.message || "Couldn't load this player's match history.");
    } finally {
      setLoading(false);
    }
  }

  async function pickSpell(p: PlayerSearchResult, teamId: number) {
    setLoading(true);
    try {
      const radar = await getPlayerRadar(p.id, teamId);
      onSelect({ id: p.id, name: p.short_name || p.name, teamId, values: radar.radar });
    } catch (e: any) {
      setError(e.message || "Couldn't build radar for this player.");
    } finally {
      setLoading(false);
    }
  }

  const accentClass = accent === "volt" ? "text-volt border-volt/30" : "text-cyan border-cyan/30";

  return (
    <div className="card space-y-3">
      <p className={`section-label ${accent === "volt" ? "text-volt" : "text-cyan"}`}>
        Player {accent === "volt" ? "A" : "B"}
      </p>

      {!chosen && (
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search a player..."
            className="flex-1 bg-sur2 border border-bd rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-volt"
          />
          <button onClick={doSearch} className="btn-volt px-3 py-2">
            <Search size={16} />
          </button>
        </div>
      )}

      {chosen && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">{chosen.name}</p>
            <p className="text-mt text-xs">{chosen.current_team ?? chosen.nationality}</p>
          </div>
          <button
            onClick={() => {
              setChosen(null);
              setTeamBlocks([]);
            }}
            className="text-mt text-xs underline"
          >
            Change
          </button>
        </div>
      )}

      {loading && <p className="text-mt text-xs">Loading...</p>}
      {error && <p className="text-red2 text-xs">{error}</p>}

      {!chosen && results.length > 0 && (
        <ul className="space-y-1 max-h-56 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => choosePlayer(p)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-sur2 transition-colors"
              >
                <span className="text-white text-sm">{p.name}</span>
                <span className="text-mt text-xs ml-2">
                  {p.position} · {p.current_team ?? p.nationality}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && teamBlocks.length > 1 && (
        <div>
          <p className="text-mt text-xs mb-1">
            Club spell (real season filtering isn&apos;t live yet, see backend notes):
          </p>
          <select
            className="input-select text-sm"
            onChange={(e) => pickSpell(chosen, Number(e.target.value))}
          >
            {teamBlocks.map((tb) => (
              <option key={tb.team_id} value={tb.team_id}>
                team_id {tb.team_id} ({tb.match_count} matches)
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
