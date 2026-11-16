"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  getTeamDetail,
  type TeamDetail,
  getTeamFixtures,
  getStandings,
  getLeagueTopStats,
  playerImageUrl,
  BSD_IMG_BASE,
} from "@/lib/api";
import clsx from "clsx";
import Link from "next/link";
import { MapPin, ChevronRight, Trophy } from "lucide-react";
import FollowButton from "@/components/FollowButton";
import StandingsTable from "@/components/StandingsTable";

function TeamCrest({
  teamId,
  crestUrl,
  name,
  isLocal,
  className = "w-6 h-6 object-contain",
}: {
  teamId?: number | string | null;
  crestUrl?: string | null;
  name?: string;
  isLocal: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = isLocal
    ? crestUrl || ""
    : teamId
      ? `${BSD_IMG_BASE}/img/team/${teamId}/?sor=true&bg=transparent`
      : "";

  if (!src || failed) {
    const initials = (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("");
    return (
      <span
        className={clsx(
          "rounded-full bg-sur2 border border-bd text-mt text-[10px] font-bold flex items-center justify-center shrink-0",
          className
        )}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name || ""}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export default function TeamPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = String(params.id || "");
  const isLocal = !/^\d+$/.test(rawId);
  const id: number | string = isLocal ? rawId : Number(rawId);
  const tournamentId = searchParams.get("tournamentId");

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [topStats, setTopStats] = useState<{ scorers: any[]; assists: any[] } | null>(null);
  const [recent, setRecent] = useState<any[] | null>(null);
  const [upcoming, setUpcoming] = useState<any[] | null>(null);
  const [topStatsFailed, setTopStatsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "table" | "matches" | "squad">("overview");

  useEffect(() => {
    if (!rawId) return;
    setLoading(true);
    Promise.all([
      getTeamDetail(id, tournamentId),
      getTeamFixtures(id, tournamentId).catch(() => ({ matches: [], recent: [], upcoming: [] })),
    ])
      .then(async ([teamData, fixturesData]) => {
        setTeam(teamData);
        setFixtures(fixturesData.matches || []);
        setRecent(fixturesData.recent || []);
        setUpcoming(fixturesData.upcoming || []);

        if (isLocal || teamData.source === "local") {
          setStandings(teamData.standings || []);
          if (teamData.top_stats) {
            setTopStats(teamData.top_stats);
          } else {
            setTopStatsFailed(true);
          }
        } else {
          const rawLeagueId =
            teamData.primary_league_id ||
            fixturesData.matches?.find((m: any) => m.status === "notstarted" || m.status === "inprogress")?.league_id;
          const leagueIdToUse = Number(rawLeagueId);

          if (!leagueIdToUse || Number.isNaN(leagueIdToUse)) {
            setTopStatsFailed(true);
          } else {
            getStandings(leagueIdToUse)
              .then((data) => setStandings(data.standings || []))
              .catch(() => { });

            getLeagueTopStats(leagueIdToUse)
              .then((data) => setTopStats(data))
              .catch(() => setTopStatsFailed(true));
          }
        }

        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load team."))
      .finally(() => setLoading(false));
  }, [rawId, id, isLocal, tournamentId]);

  if (loading) return <p className="text-mt text-sm p-4">Loading team...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (!team) return null;

  const matchHref = (m: any) =>
    isLocal || m.source === "local"
      ? `/tournament/${m.tournament_id || team.primary_league_id}/match/${m.event_id}`
      : `/match/${m.event_id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative border border-bd/30 shadow-2xl bg-gradient-to-br from-sur to-bg">
        <div className="flex items-center gap-5">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <TeamCrest
              teamId={team.id}
              crestUrl={team.crest_url}
              name={team.name}
              isLocal={isLocal}
              className="w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-2xl"
            />
          </div>
          <div>
            {isLocal && team.primary_league_id && (
              <Link
                href={`/tournament/${team.primary_league_id}`}
                className="text-mt text-xs hover:text-white inline-block mb-1"
              >
                ← Back to competition
              </Link>
            )}
            <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-tight flex items-center gap-2">
              {team.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-mt text-xs sm:text-sm mt-2 font-medium">
              <span className="flex items-center gap-1 text-white">
                <MapPin size={14} className="text-volt2" /> {team.country}
              </span>
              {team.venue && (
                <>
                  <span className="text-bd">•</span>
                  <span>
                    {team.venue} {team.venue_capacity ? `(${team.venue_capacity.toLocaleString()})` : ""}
                  </span>
                </>
              )}
            </div>
            {team.primary_league_id && team.primary_league_name && (
              <Link
                href={isLocal ? `/tournament/${team.primary_league_id}` : `/league/${team.primary_league_id}`}
                className="flex items-center gap-2 mt-3 text-white text-sm font-semibold bg-white/5 hover:border-volt2/50 rounded-full px-3 py-1.5 w-fit border border-white/10 shadow-lg transition-colors"
              >
                {!isLocal ? (
                  <img
                    src={`${BSD_IMG_BASE}/img/league/${team.primary_league_id}/?sor=true&bg=transparent`}
                    className="w-5 h-5 object-contain"
                    alt=""
                  />
                ) : (
                  <Trophy size={15} className="text-volt2" />
                )}
                <span>{team.primary_league_name}</span>
                {team.position && (
                  <>
                    <span className="text-bd">•</span>
                    <span className="text-volt2">
                      {team.position}
                      {team.position === 1 ? "st" : team.position === 2 ? "nd" : team.position === 3 ? "rd" : "th"} Place
                    </span>
                  </>
                )}
              </Link>
            )}
          </div>
        </div>
        <FollowButton
          entityType="team"
          entityId={team.id}
          entityName={team.name}
          className="absolute top-4 right-4 sm:static"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-bd/50">
        {(["overview", "table", "matches", "squad"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={clsx(
              "pb-2 text-sm font-semibold transition-colors capitalize",
              activeTab === tabKey ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white"
            )}
          >
            {tabKey}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* A. Next / Live Match Hero Card */}
          {(() => {
            const nextMatch = fixtures.find((m) => m.status === "notstarted" || m.status === "inprogress");
            if (!nextMatch) return null;
            return (
              <div className="card border border-volt2/30 bg-gradient-to-r from-bg2 to-sur p-0 overflow-hidden">
                <div className="bg-volt2/10 px-4 py-2 border-b border-volt2/20 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-volt2">
                  <span>{nextMatch.competition || "Next Match"}</span>
                  {nextMatch.status === "inprogress" ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-volt2 animate-pulse" /> Live
                    </span>
                  ) : (
                    <span>
                      {nextMatch.kickoff
                        ? new Date(nextMatch.kickoff).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "TBD"}
                    </span>
                  )}
                </div>
                <Link href={matchHref(nextMatch)} className="block p-6 hover:bg-white/5 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <TeamCrest
                        teamId={nextMatch.home_team_id}
                        crestUrl={nextMatch.home_crest}
                        name={nextMatch.home_team}
                        isLocal={isLocal}
                        className="w-16 h-16 object-contain drop-shadow-lg"
                      />
                      <span className="font-semibold text-center text-sm">{nextMatch.home_team}</span>
                    </div>
                    <div className="flex flex-col items-center w-1/3">
                      {nextMatch.status === "inprogress" ? (
                        <span className="text-3xl font-black text-volt2">
                          {nextMatch.home_score} - {nextMatch.away_score}
                        </span>
                      ) : (
                        <span className="text-2xl font-black text-white/50">VS</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <TeamCrest
                        teamId={nextMatch.away_team_id}
                        crestUrl={nextMatch.away_crest}
                        name={nextMatch.away_team}
                        isLocal={isLocal}
                        className="w-16 h-16 object-contain drop-shadow-lg"
                      />
                      <span className="font-semibold text-center text-sm">{nextMatch.away_team}</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })()}

          {/* A2. Upcoming Fixtures list */}
          {(() => {
            const heroMatch = fixtures.find((m) => m.status === "notstarted" || m.status === "inprogress");
            const upcomingList = (upcoming || [])
              .filter((m: any) => m.event_id !== heroMatch?.event_id)
              .slice(0, 6);
            if (upcomingList.length === 0) return null;
            return (
              <div className="card">
                <h2 className="section-label mb-4 flex items-center justify-between">
                  <span>Upcoming Fixtures</span>
                  <button
                    onClick={() => setActiveTab("matches")}
                    className="text-xs font-semibold text-volt2 hover:text-white transition-colors flex items-center gap-1"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </h2>
                <div className="space-y-2">
                  {upcomingList.map((m) => (
                    <Link
                      key={m.event_id}
                      href={matchHref(m)}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-bd/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamCrest
                          teamId={m.home_team_id}
                          crestUrl={m.home_crest}
                          name={m.home_team}
                          isLocal={isLocal}
                          className="w-5 h-5 object-contain shrink-0"
                        />
                        <span className="text-white text-sm truncate max-w-[90px]">{m.home_team}</span>
                        <span className="text-mt text-xs">vs</span>
                        <span className="text-white text-sm truncate max-w-[90px]">{m.away_team}</span>
                        <TeamCrest
                          teamId={m.away_team_id}
                          crestUrl={m.away_crest}
                          name={m.away_team}
                          isLocal={isLocal}
                          className="w-5 h-5 object-contain shrink-0"
                        />
                      </div>
                      <span className="text-mt text-xs shrink-0 ml-2 font-mono">
                        {m.kickoff
                          ? new Date(m.kickoff).toLocaleString("en-GB", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* B. Recent Form & C. Standings Snapshot */}
            <div className="space-y-4">
              <div className="card">
                <h2 className="section-label mb-4">Recent Form</h2>
                {(() => {
                  if (recent === null) return <span className="text-mt text-sm">Loading...</span>;
                  const pastMatches = recent.slice(0, 5);
                  if (pastMatches.length === 0) return <span className="text-mt text-sm">No recent matches.</span>;
                  return (
                    <div className="space-y-2">
                      {pastMatches.map((m: any) => {
                        const isHome = m.home_team_id === team.id;
                        const ourScore = isHome ? m.home_score : m.away_score;
                        const theirScore = isHome ? m.away_score : m.home_score;
                        const oppName = isHome ? m.away_team : m.home_team;
                        const oppId = isHome ? m.away_team_id : m.home_team_id;
                        const oppCrest = isHome ? m.away_crest : m.home_crest;
                        let res = "D";
                        let color = "bg-mt text-bg";
                        if (ourScore > theirScore) {
                          res = "W";
                          color = "bg-volt2 text-bg";
                        } else if (ourScore < theirScore) {
                          res = "L";
                          color = "bg-red2 text-white";
                        }

                        return (
                          <Link
                            key={m.event_id}
                            href={matchHref(m)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg/40 border border-bd/50 hover:border-volt2/50 transition-colors"
                            title={`${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`}
                          >
                            <span
                              className={clsx(
                                "w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-bold text-[11px]",
                                color
                              )}
                            >
                              {res}
                            </span>
                            <TeamCrest
                              teamId={oppId}
                              crestUrl={oppCrest}
                              name={oppName}
                              isLocal={isLocal}
                              className="w-5 h-5 shrink-0 object-contain"
                            />
                            <span className="flex-1 min-w-0 truncate text-white text-sm">{oppName}</span>
                            <span className="text-mt text-[11px] shrink-0">{isHome ? "H" : "A"}</span>
                            <span className="font-mono text-sm text-white shrink-0 tabular-nums">
                              {ourScore}-{theirScore}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Standings Snapshot */}
              {standings.length > 0 && (
                <div className="card">
                  <h2 className="section-label mb-4 flex items-center justify-between">
                    <span>Standings Snapshot</span>
                    <Trophy size={14} className="text-volt2" />
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-mt text-xs uppercase tracking-wide border-b border-bd/50 text-left">
                          <th className="pb-2 font-semibold">#</th>
                          <th className="pb-2 font-semibold">Team</th>
                          <th className="pb-2 font-semibold text-center">P</th>
                          <th className="pb-2 font-semibold text-center">GD</th>
                          <th className="pb-2 font-semibold text-center">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const ourIndex = standings.findIndex((s) => s.team_id === team.id);
                          const start = ourIndex === -1 ? 0 : Math.max(0, ourIndex - 2);
                          const end = ourIndex === -1 ? Math.min(standings.length, 6) : Math.min(standings.length, ourIndex + 3);
                          const slice = standings.slice(start, end);

                          return slice.map((row) => (
                            <tr
                              key={row.team_id}
                              className={clsx(
                                "border-b border-bd/30 last:border-0",
                                row.team_id === team.id ? "bg-volt2/10 font-bold" : "text-mt"
                              )}
                            >
                              <td className="py-2.5 w-6">{row.position}</td>
                              <td className="py-2.5 flex items-center gap-2">
                                <TeamCrest
                                  teamId={row.team_id}
                                  crestUrl={row.crest_url}
                                  name={row.team_name || row.team}
                                  isLocal={isLocal}
                                  className="w-5 h-5 object-contain"
                                />
                                <span
                                  className={
                                    row.team_id === team.id
                                      ? "text-volt2 truncate max-w-[110px]"
                                      : "truncate max-w-[110px]"
                                  }
                                >
                                  {row.team_name || row.team}
                                </span>
                              </td>
                              <td className="py-2.5 text-center">{row.played}</td>
                              <td className="py-2.5 text-center">{row.goals_for - row.goals_against}</td>
                              <td className="py-2.5 text-center text-white">{row.points}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Key Squad Leaders & Club Information */}
            <div className="space-y-4">
              <div className="card border border-volt2/20 bg-gradient-to-br from-sur to-bg">
                <h2 className="section-label mb-4 text-volt2">Key Squad Leaders</h2>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between border-b border-bd/50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-volt2/10 flex items-center justify-center text-volt2 font-black text-xs">
                        ⚽
                      </div>
                      <div>
                        <p className="text-mt text-xs uppercase tracking-wider font-semibold">Top Scorer</p>
                        <p className="text-white font-medium">
                          {topStats
                            ? topStats.scorers.find((s: any) => s.team_id === team.id)?.player_name || "N/A"
                            : topStatsFailed
                              ? "N/A"
                              : "Loading..."}
                        </p>
                      </div>
                    </div>
                    <span className="text-volt2 font-black text-lg">
                      {topStats ? topStats.scorers.find((s: any) => s.team_id === team.id)?.value || "-" : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-bd/50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-volt2/10 flex items-center justify-center text-volt2 font-black text-xs">
                        🎯
                      </div>
                      <div>
                        <p className="text-mt text-xs uppercase tracking-wider font-semibold">Most Assists</p>
                        <p className="text-white font-medium">
                          {topStats
                            ? topStats.assists.find((s: any) => s.team_id === team.id)?.player_name || "N/A"
                            : topStatsFailed
                              ? "N/A"
                              : "Loading..."}
                        </p>
                      </div>
                    </div>
                    <span className="text-volt2 font-black text-lg">
                      {topStats ? topStats.assists.find((s: any) => s.team_id === team.id)?.value || "-" : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-volt2/10 flex items-center justify-center text-volt2 font-black text-xs">
                        ⭐
                      </div>
                      <div>
                        <p className="text-mt text-xs uppercase tracking-wider font-semibold">Highest Rated</p>
                        <p className="text-white font-medium">N/A</p>
                      </div>
                    </div>
                    <span className="text-volt2 font-black text-lg">-</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="section-label mb-4">Club Information</h2>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between border-b border-bd/50 pb-2">
                    <span className="text-mt uppercase text-xs font-semibold tracking-wider">Full Name</span>
                    <span className="text-white font-medium text-right">{team.name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-bd/50 pb-2">
                    <span className="text-mt uppercase text-xs font-semibold tracking-wider">Manager</span>
                    <span className="text-white font-medium text-right">
                      {team.manager_name || <span className="text-mt">Not available</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-bd/50 pb-2">
                    <span className="text-mt uppercase text-xs font-semibold tracking-wider">Stadium</span>
                    <span className="text-white font-medium text-right">
                      {team.venue || <span className="text-mt">Not available</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mt uppercase text-xs font-semibold tracking-wider">Country</span>
                    <span className="text-white font-medium text-right">
                      {team.country || <span className="text-mt">Not available</span>}
                    </span>
                  </div>
                </div>
              </div>

              {team.manager_stats && (
                <div className="card border border-volt2/20 bg-gradient-to-br from-sur to-bg">
                  <h2 className="section-label mb-4 text-volt2">Season Averages</h2>
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between border-b border-bd/50 pb-2">
                      <span className="text-mt uppercase text-xs font-semibold tracking-wider">Avg Possession</span>
                      <span className="text-white font-medium">{team.manager_stats.avg_possession}%</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-bd/50 pb-2">
                      <span className="text-mt uppercase text-xs font-semibold tracking-wider">Goals Scored (Per Match)</span>
                      <span className="text-volt2 font-black text-lg">{team.manager_stats.avg_goals_scored}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-mt uppercase text-xs font-semibold tracking-wider">Goals Conceded (Per Match)</span>
                      <span className="text-red2 font-black text-lg">{team.manager_stats.avg_goals_conceded}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "table" && (
        <div className="space-y-6">
          {standings.length === 0 ? (
            <p className="text-mt text-sm p-4">No table data available.</p>
          ) : (
            <div className="card overflow-x-auto">
              <h2 className="section-label mb-4">{team.primary_league_name || "League Table"}</h2>
              <StandingsTable rows={standings} highlightTeamId={team.id as any} />
            </div>
          )}
        </div>
      )}

      {activeTab === "squad" && (
        <div className="space-y-6">
          {team.squad.length === 0 ? (
            <p className="text-mt text-sm">No squad information available.</p>
          ) : (
            (() => {
              const groups = [
                { label: "Goalkeepers", match: (pos: string) => pos.includes("goalkeeper") || pos === "g" || pos === "gk" },
                { label: "Defenders", match: (pos: string) => pos.includes("defender") || pos === "d" || ["cb", "lb", "rb", "lwb", "rwb"].includes(pos) },
                { label: "Midfielders", match: (pos: string) => pos.includes("midfielder") || pos === "m" || ["cm", "cdm", "cam", "lm", "rm"].includes(pos) },
                { label: "Forwards", match: (pos: string) => pos.includes("forward") || pos.includes("striker") || pos.includes("attacker") || pos === "f" || pos === "a" || ["st", "cf", "lw", "rw"].includes(pos) },
              ];

              const categorizedIds = new Set<string | number>();
              const renderedGroups = groups.map((g) => {
                const playersInGroup = team.squad.filter((p) => {
                  const ok = g.match((p.position || "").toLowerCase().trim());
                  if (ok) categorizedIds.add(p.id);
                  return ok;
                });
                return { label: g.label, players: playersInGroup };
              });

              const uncategorized = team.squad.filter((p) => !categorizedIds.has(p.id));
              if (uncategorized.length > 0) {
                renderedGroups.push({ label: "Squad Players", players: uncategorized });
              }

              return renderedGroups.map(({ label, players }) => {
                if (players.length === 0) return null;
                return (
                  <div key={label} className="card overflow-x-auto">
                    <h2 className="section-label mb-3">{label}</h2>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-mt text-xs uppercase tracking-wide border-b border-bd text-left">
                          <th className="py-2 pr-2 font-semibold">#</th>
                          <th className="py-2 pr-2 font-semibold">Player</th>
                          <th className="py-2 pr-2 font-semibold">Pos</th>
                          <th className="py-2 pr-2 font-semibold text-center" title="Appearances">App</th>
                          <th className="py-2 pr-2 font-semibold text-center" title="Goals">G</th>
                          <th className="py-2 pr-2 font-semibold text-center" title="Assists">A</th>
                          <th className="py-2 pr-2 font-semibold">Age</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((player) => {
                          const scorerData = topStats?.scorers?.find((s: any) => s.player_id === player.id);
                          const assistData = topStats?.assists?.find((s: any) => s.player_id === player.id);
                          const apps = scorerData?.matches || assistData?.matches || "-";
                          const goals = player.goals || scorerData?.value || "-";
                          const assists = player.assists || assistData?.value || "-";
                          const avatarSrc = isLocal
                            ? player.photo_url || ""
                            : playerImageUrl(Number(player.id)) || "";
                          const playerLink = isLocal
                            ? `/tournament/${team.primary_league_id}/player/${player.id}`
                            : `/player/${player.id}`;

                          return (
                            <tr key={player.id} className="border-b border-bd/50 last:border-0 hover:bg-white/5 transition-colors">
                              <td className="py-2 pr-2 text-mt w-8">{player.jersey_number || "-"}</td>
                              <td className="py-2 pr-2">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={
                                      avatarSrc ||
                                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%232C2C2C"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4 4-7 8-7s8 3 8 7"/></svg>'
                                    }
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover bg-bg2"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%232C2C2C"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4 4-7 8-7s8 3 8 7"/></svg>';
                                    }}
                                  />
                                  <div>
                                    <Link
                                      href={playerLink}
                                      className="text-white font-semibold truncate max-w-[160px] hover:text-volt2 transition-colors"
                                    >
                                      {player.name}
                                    </Link>
                                    <p className="text-mt text-[10px] uppercase tracking-wide">
                                      {player.nationality}
                                      {player.injury_type && (
                                        <span className="ml-2 text-red2 font-semibold inline-flex items-center gap-1">
                                          ✚ Injured
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 pr-2 text-white font-mono">{player.position}</td>
                              <td className="py-2 pr-2 text-mt text-center">{apps}</td>
                              <td className="py-2 pr-2 text-mt text-center">{goals}</td>
                              <td className="py-2 pr-2 text-mt text-center">{assists}</td>
                              <td className="py-2 pr-2 text-mt">
                                {player.date_of_birth
                                  ? Math.floor(
                                    (new Date().getTime() - new Date(player.date_of_birth).getTime()) / 31557600000
                                  )
                                  : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              });
            })()
          )}
        </div>
      )}

      {activeTab === "matches" && (
        <TeamMatchesTab teamId={team.id} recent={recent} upcoming={upcoming} />
      )}
    </div>
  );
}

function TeamMatchesTab({
  teamId,
  recent,
  upcoming,
}: {
  teamId: number | string;
  recent: any[] | null;
  upcoming: any[] | null;
}) {
  const INITIAL = 10;
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  if (recent === null || upcoming === null) {
    return <p className="text-mt text-sm p-4">Loading...</p>;
  }
  if (recent.length === 0 && upcoming.length === 0) {
    return <p className="text-mt text-sm p-4">No matches found.</p>;
  }

  const shownUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, INITIAL);
  const shownPast = showAllPast ? recent : recent.slice(0, INITIAL);

  const groupMatches = (list: any[]) => {
    const grouped: Record<string, any[]> = {};
    list.forEach((m) => {
      const d = new Date(m.kickoff || m.event_date);
      const month = isNaN(d.getTime())
        ? "Scheduled Fixtures"
        : d.toLocaleString("default", { month: "long", year: "numeric" });
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(m);
    });
    return grouped;
  };

  const upcomingGrouped = groupMatches(shownUpcoming);
  const pastGrouped = groupMatches(shownPast);

  const ToggleButton = ({
    expanded,
    total,
    onClick,
    label,
  }: {
    expanded: boolean;
    total: number;
    onClick: () => void;
    label: string;
  }) => (
    <button
      onClick={onClick}
      className="w-full mt-3 py-2.5 rounded-lg border border-bd hover:border-volt2/50 text-sm font-semibold text-volt2 transition-colors"
    >
      {expanded ? "Show less" : `View all ${total} ${label}`}
    </button>
  );

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-black text-white mb-4">Upcoming Fixtures</h2>
          <div className="space-y-6">
            {Object.keys(upcomingGrouped).map((month) => (
              <div key={month}>
                <h3 className="section-label mb-3 sticky top-0 bg-bg/90 py-2 backdrop-blur-sm z-10">{month}</h3>
                <div className="space-y-2">
                  {upcomingGrouped[month].map((m) => (
                    <MatchCardWrapper key={m.event_id} match={m} teamId={teamId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {upcoming.length > INITIAL && (
            <ToggleButton
              expanded={showAllUpcoming}
              total={upcoming.length}
              onClick={() => setShowAllUpcoming((v) => !v)}
              label="fixtures"
            />
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-black text-white mb-4">Past Results</h2>
          <div className="space-y-6">
            {Object.keys(pastGrouped).map((month) => (
              <div key={month}>
                <h3 className="section-label mb-3 sticky top-0 bg-bg/90 py-2 backdrop-blur-sm z-10">{month}</h3>
                <div className="space-y-2">
                  {pastGrouped[month].map((m) => (
                    <MatchCardWrapper key={m.event_id} match={m} teamId={teamId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {recent.length > INITIAL && (
            <ToggleButton
              expanded={showAllPast}
              total={recent.length}
              onClick={() => setShowAllPast((v) => !v)}
              label="results"
            />
          )}
        </div>
      )}
    </div>
  );
}

function MatchCardWrapper({ match, teamId }: { match: any; teamId?: number | string }) {
  const [MatchCard, setMatchCard] = useState<any>(null);
  useEffect(() => {
    import("@/components/MatchCard").then((mod) => setMatchCard(() => mod.default));
  }, []);
  if (!MatchCard) return null;
  return <MatchCard match={match} targetTeamId={teamId} showCompetition={true} />;
}