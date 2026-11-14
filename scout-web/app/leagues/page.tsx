"use client";
import { useEffect, useState } from "react";
import { getLeagues, getStandings, type LeagueOption, type StandingsRow, type StandingsGroup } from "@/lib/api";
import clsx from "clsx";
import Link from "next/link";
import StandingsTable from "@/components/StandingsTable";

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [rows, setRows] = useState<StandingsRow[] | null>(null);
  const [groups, setGroups] = useState<StandingsGroup[] | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLeagues()
      .then((d) => {
        setLeagues(d.leagues);
        if (d.leagues.length > 0) setSelected(d.leagues[0].league_id);
      })
      .catch((e) => setError(e.message || "Failed to load leagues."))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    if (selected == null) return;
    setLoadingTable(true);
    setError(null);
    getStandings(selected)
      .then((d) => {
        setRows(d.standings);
        setGroups(d.groups);
        setLeagueName(d.league);
      })
      .catch((e) => setError(e.message || "Failed to load standings."))
      .finally(() => setLoadingTable(false));
  }, [selected]);

  const isEmpty = !rows?.length && !groups?.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Leagues</h1>
        <p className="text-mt text-sm mt-1">Tables for every competition we track.</p>
      </div>

      {/* Local competitions are the thing Scout has that the big
          livescore apps don't, so they get a door on this page rather
          than being buried. */}
      <Link
        href="/tournaments"
        className="card block hover:border-volt/40 transition-colors"
      >
        <p className="text-white font-semibold">Local competitions</p>
        <p className="text-mt text-sm mt-1">
          University, school and community football. Tables, fixtures and player
          ratings, same as the leagues above.
        </p>
      </Link>

      {loadingList && <p className="text-mt text-sm">Loading leagues...</p>}

      {!loadingList && leagues.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {leagues.map((lg) => (
            <button
              key={lg.league_id}
              onClick={() => setSelected(lg.league_id)}
              className={clsx("tab-pill shrink-0", lg.league_id === selected ? "tab-pill-active" : "tab-pill-inactive")}
            >
              {lg.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="card border-red2/40">
          <p className="text-red2 text-sm font-semibold">{error}</p>
          <p className="text-mt text-xs mt-1">
            Make sure the backend is running and NEXT_PUBLIC_API_URL points at it.
          </p>
        </div>
      )}

      {loadingTable && <p className="text-mt text-sm">Loading table...</p>}

      {!loadingTable && !error && groups && groups.length > 0 && (
        <div className="space-y-4">
          {selected !== null && (
            <Link href={`/league/${selected}`} className="section-label hover:text-volt">
              {leagueName}
            </Link>
          )}
          {groups.map((g) => (
            <div key={g.group} className="card overflow-x-auto">
              <p className="text-mt text-xs uppercase tracking-wide mb-2">{g.group}</p>
              <StandingsTable rows={g.standings} />
            </div>
          ))}
        </div>
      )}

      {!loadingTable && !error && rows && rows.length > 0 && (
        <div className="card overflow-x-auto">
          {selected !== null && (
            <Link href={`/league/${selected}`} className="section-label mb-3 block hover:text-volt">
              {leagueName}
            </Link>
          )}
          <StandingsTable rows={rows} />
        </div>
      )}

      {!loadingTable && !error && isEmpty && !loadingList && (
        <p className="text-mt text-sm">No standings for this competition yet.</p>
      )}
    </div>
  );
}
