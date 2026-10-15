"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getStandings, type StandingsRow, type StandingsGroup } from "@/lib/api";
import Link from "next/link";
import clsx from "clsx";
import FollowButton from "@/components/FollowButton";

import StandingsTable from "@/components/StandingsTable";

export default function LeaguePage() {
  const params = useParams();
  const id = Number(params.id);
  const [rows, setRows] = useState<StandingsRow[] | null>(null);
  const [groups, setGroups] = useState<StandingsGroup[] | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"standings" | "matches" | "stats">("standings");
  const [season, setSeason] = useState("2023-2024");

  useEffect(() => {
    if (isNaN(id)) return;
    setLoading(true);
    getStandings(id)
      .then((d) => {
        setRows(d.standings);
        setGroups(d.groups);
        setLeagueName(d.league);
        setError(null);
      })
      .catch((e) => setError(e.message || "Failed to load league."))
      .finally(() => setLoading(false));
  }, [id]);

  const isEmpty = !rows?.length && !groups?.length;

  if (loading) return <p className="text-mt text-sm p-4">Loading league...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="font-display font-black text-2xl text-white">{leagueName}</h1>
          <FollowButton entityType="league" entityId={id} entityName={leagueName} />
        </div>
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="bg-bg text-white border border-bd rounded-md px-3 py-1.5 text-sm outline-none focus:border-volt2"
        >
          <option value="2023-2024">2023/2024 (Current)</option>
          <option value="2022-2023">2022/2023</option>
          <option value="2021-2022">2021/2022</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-bd/50">
        <button
          onClick={() => setActiveTab("standings")}
          className={clsx("pb-2 text-sm font-semibold transition-colors", activeTab === "standings" ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white")}
        >
          Standings
        </button>
        <button
          onClick={() => setActiveTab("matches")}
          className={clsx("pb-2 text-sm font-semibold transition-colors", activeTab === "matches" ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white")}
        >
          Matches
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={clsx("pb-2 text-sm font-semibold transition-colors", activeTab === "stats" ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white")}
        >
          Stats
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "standings" && (
        <>
          {groups && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.group} className="card overflow-x-auto">
              <p className="text-mt text-xs uppercase tracking-wide mb-2">{g.group}</p>
              <StandingsTable rows={g.standings} />
            </div>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="card overflow-x-auto">
          <p className="section-label mb-3">{leagueName}</p>
          <StandingsTable rows={rows} />
        </div>
      )}

      {isEmpty && (
        <p className="text-mt text-sm">No standings for this competition yet.</p>
      )}
      </>
      )}

      {activeTab === "matches" && (
        <LeagueMatchesTab leagueId={id} />
      )}

      {activeTab === "stats" && (
        <LeagueStatsTab leagueId={id} />
      )}
    </div>
  );
}

function LeagueStatsTab({ leagueId }: { leagueId: number }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/api").then(({ getLeagueTopStats }) => {
      getLeagueTopStats(leagueId)
        .then(setStats)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [leagueId]);

  if (loading) return <p className="text-mt text-sm p-4">Loading stats...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {stats.scorers.length > 0 && (
        <div className="card overflow-x-auto">
          <p className="section-label mb-3">Top Scorers</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-mt text-xs uppercase tracking-wide border-b border-bd">
                <th className="py-2 pr-2 text-left font-semibold">Rank</th>
                <th className="py-2 pr-2 text-left font-semibold">Player</th>
                <th className="py-2 pr-2 text-left font-semibold">Team</th>
                <th className="py-2 pr-2 text-right font-semibold">Goals</th>
              </tr>
            </thead>
            <tbody>
              {stats.scorers.map((p: any) => (
                <tr key={p.player_id} className="border-b border-bd/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-2 pr-2 text-mt w-8">{p.rank}</td>
                  <td className="py-2 pr-2">
                    <Link href={`/player/${p.player_id}`} className="text-white font-semibold hover:text-volt2 transition-colors">{p.player_name}</Link>
                  </td>
                  <td className="py-2 pr-2">
                    <Link href={`/team/${p.team_id}`} className="text-mt hover:text-white transition-colors">{p.team_name}</Link>
                  </td>
                  <td className="py-2 pr-2 text-right text-volt2 font-bold">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats.assists.length > 0 && (
        <div className="card overflow-x-auto">
          <p className="section-label mb-3">Top Assists</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-mt text-xs uppercase tracking-wide border-b border-bd">
                <th className="py-2 pr-2 text-left font-semibold">Rank</th>
                <th className="py-2 pr-2 text-left font-semibold">Player</th>
                <th className="py-2 pr-2 text-left font-semibold">Team</th>
                <th className="py-2 pr-2 text-right font-semibold">Assists</th>
              </tr>
            </thead>
            <tbody>
              {stats.assists.map((p: any) => (
                <tr key={p.player_id} className="border-b border-bd/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-2 pr-2 text-mt w-8">{p.rank}</td>
                  <td className="py-2 pr-2">
                    <Link href={`/player/${p.player_id}`} className="text-white font-semibold hover:text-volt2 transition-colors">{p.player_name}</Link>
                  </td>
                  <td className="py-2 pr-2">
                    <Link href={`/team/${p.team_id}`} className="text-mt hover:text-white transition-colors">{p.team_name}</Link>
                  </td>
                  <td className="py-2 pr-2 text-right text-volt2 font-bold">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats.scorers.length === 0 && stats.assists.length === 0 && (
        <p className="text-mt text-sm p-4">No top stats available.</p>
      )}
    </div>
  );
}

function LeagueMatchesTab({ leagueId }: { leagueId: number }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/api").then(({ getLeagueFixtures }) => {
      getLeagueFixtures(leagueId)
        .then((data) => setMatches(data.matches))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [leagueId]);

  if (loading) return <p className="text-mt text-sm p-4">Loading matches...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (matches.length === 0) return <p className="text-mt text-sm p-4">No matches found.</p>;

  // Group matches by month
  const grouped: Record<string, any[]> = {};
  matches.forEach(m => {
    const d = new Date(m.kickoff || m.event_date);
    if (isNaN(d.getTime())) return;
    const month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(m);
  });

  return (
    <div className="space-y-6">
      {Object.keys(grouped).map(month => (
        <div key={month}>
          <h3 className="section-label mb-3 sticky top-0 bg-bg/90 py-2 backdrop-blur-sm z-10">{month}</h3>
          <div className="space-y-2">
            {grouped[month].map((m) => (
              <MatchCardWrapper key={m.event_id} match={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCardWrapper({ match }: { match: any }) {
  const [MatchCard, setMatchCard] = useState<any>(null);
  useEffect(() => {
    import("@/components/MatchCard").then((mod) => setMatchCard(() => mod.default));
  }, []);
  if (!MatchCard) return null;
  return <MatchCard match={match} />;
}
