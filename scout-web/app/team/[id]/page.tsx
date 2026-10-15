"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTeamDetail, type TeamDetail, getTeamFixtures, getStandings, getLeagueTopStats, playerImageUrl, BSD_IMG_BASE } from "@/lib/api";
import clsx from "clsx";
import Link from "next/link";
import { Star, MapPin, ChevronRight, Trophy } from "lucide-react";
import FollowButton from "@/components/FollowButton";
import StandingsTable from "@/components/StandingsTable";

export default function TeamPage() {
  const params = useParams();
  const id = Number(params.id);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [topStats, setTopStats] = useState<{ scorers: any[], assists: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "table" | "matches" | "squad">("overview");

  useEffect(() => {
    if (isNaN(id)) return;
    setLoading(true);
    Promise.all([
      getTeamDetail(id),
      getTeamFixtures(id).catch(() => ({ matches: [] }))
    ])
      .then(async ([teamData, fixturesData]) => {
        setTeam(teamData);
        setFixtures(fixturesData.matches || []);
        
        // Fetch standings and top stats based on primary_league_id
        const leagueIdToUse = teamData.primary_league_id || fixturesData.matches?.find((m: any) => m.status === "notstarted" || m.status === "inprogress")?.league_id;
        
        if (leagueIdToUse) {
           getStandings(leagueIdToUse)
             .then(data => setStandings(data.standings || []))
             .catch(() => {});
             
           getLeagueTopStats(leagueIdToUse)
             .then(data => setTopStats(data))
             .catch(() => {});
        }
        
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load team."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-mt text-sm p-4">Loading team...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (!team) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative border border-bd/30 shadow-2xl bg-gradient-to-br from-sur to-bg">
        <div className="flex items-center gap-5">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <img
              src={`${BSD_IMG_BASE}/img/team/${team.id}/?sor=true&bg=transparent`}
              alt={team.name}
              className="w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-2xl"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-tight flex items-center gap-2">
              {team.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-mt text-xs sm:text-sm mt-2 font-medium">
              <span className="flex items-center gap-1 text-white"><MapPin size={14} className="text-volt2" /> {team.country}</span>
              {team.venue && (
                <>
                  <span className="text-bd">•</span>
                  <span>{team.venue} {team.venue_capacity ? `(${team.venue_capacity.toLocaleString()})` : ""}</span>
                </>
              )}
            </div>
            {team.primary_league_id && team.primary_league_name && (
              <div className="flex items-center gap-2 mt-3 text-white text-sm font-semibold bg-white/5 rounded-full px-3 py-1.5 w-fit border border-white/10 shadow-lg">
                <img src={`${BSD_IMG_BASE}/img/league/${team.primary_league_id}/?sor=true&bg=transparent`} className="w-5 h-5 object-contain" alt="" />
                <span>{team.primary_league_name}</span>
                {team.position && (
                  <>
                    <span className="text-bd">•</span>
                    <span className="text-volt2">{team.position}{team.position === 1 ? "st" : team.position === 2 ? "nd" : team.position === 3 ? "rd" : "th"} Place</span>
                  </>
                )}
              </div>
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
        <button
          onClick={() => setActiveTab("overview")}
          className={clsx("pb-2 text-sm font-semibold transition-colors", activeTab === "overview" ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white")}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("table")}
          className={clsx("pb-2 text-sm font-semibold transition-colors", activeTab === "table" ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white")}
        >
          Table
        </button>
        <button
          onClick={() => setActiveTab("matches")}
          className={clsx("pb-2 text-sm font-semibold transition-colors", activeTab === "matches" ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white")}
        >
          Matches
        </button>
        <button
          onClick={() => setActiveTab("squad")}
          className={clsx("pb-2 text-sm font-semibold transition-colors", activeTab === "squad" ? "text-volt2 border-b-2 border-volt2" : "text-mt hover:text-white")}
        >
          Squad
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          
          {/* A. Next / Live Match Hero Card */}
          {(() => {
            const nextMatch = fixtures.find(m => m.status === "notstarted" || m.status === "inprogress");
            if (!nextMatch) return null;
            return (
              <div className="card border border-volt2/30 bg-gradient-to-r from-bg2 to-sur p-0 overflow-hidden">
                <div className="bg-volt2/10 px-4 py-2 border-b border-volt2/20 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-volt2">
                  <span>{nextMatch.competition || "Next Match"}</span>
                  {nextMatch.status === "inprogress" ? (
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-volt2 animate-pulse" /> Live</span>
                  ) : (
                    <span>{new Date(nextMatch.kickoff).toLocaleString()}</span>
                  )}
                </div>
                <Link href={`/match/${nextMatch.event_id}`} className="block p-6 hover:bg-white/5 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <img src={`${BSD_IMG_BASE}/img/team/${nextMatch.home_team_id}/?sor=true&bg=transparent`} alt="" className="w-16 h-16 object-contain drop-shadow-lg" />
                      <span className="font-semibold text-center text-sm">{nextMatch.home_team}</span>
                    </div>
                    <div className="flex flex-col items-center w-1/3">
                      {nextMatch.status === "inprogress" ? (
                        <span className="text-3xl font-black text-volt2">{nextMatch.home_score} - {nextMatch.away_score}</span>
                      ) : (
                        <span className="text-2xl font-black text-white/50">VS</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <img src={`${BSD_IMG_BASE}/img/team/${nextMatch.away_team_id}/?sor=true&bg=transparent`} alt="" className="w-16 h-16 object-contain drop-shadow-lg" />
                      <span className="font-semibold text-center text-sm">{nextMatch.away_team}</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })()}

          {/* A2. Upcoming Fixtures list (excludes whatever is already shown as the hero above) */}
          {(() => {
            const heroMatch = fixtures.find(m => m.status === "notstarted" || m.status === "inprogress");
            const upcomingList = fixtures
              .filter(m => m.status !== "finished" && m.event_id !== heroMatch?.event_id)
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
                  {upcomingList.map(m => (
                    <Link
                      key={m.event_id}
                      href={`/match/${m.event_id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-bd/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={`${BSD_IMG_BASE}/img/team/${m.home_team_id}/?sor=true&bg=transparent`} alt="" className="w-5 h-5 object-contain shrink-0" />
                        <span className="text-white text-sm truncate max-w-[90px]">{m.home_team}</span>
                        <span className="text-mt text-xs">vs</span>
                        <span className="text-white text-sm truncate max-w-[90px]">{m.away_team}</span>
                        <img src={`${BSD_IMG_BASE}/img/team/${m.away_team_id}/?sor=true&bg=transparent`} alt="" className="w-5 h-5 object-contain shrink-0" />
                      </div>
                      <span className="text-mt text-xs shrink-0 ml-2">
                        {m.kickoff ? new Date(m.kickoff).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* B. Recent Form Indicator & C. Mini Table */}
            <div className="space-y-4">
              {/* Recent Form */}
              <div className="card">
                <h2 className="section-label mb-4">Recent Form</h2>
                <div className="flex items-center gap-3">
                  {(() => {
                    const pastMatches = [...fixtures].filter(m => m.status === "finished").reverse().slice(0, 5).reverse();
                    if (pastMatches.length === 0) return <span className="text-mt text-sm">No recent matches.</span>;
                    return pastMatches.map(m => {
                      const isHome = m.home_team_id === team.id;
                      const ourScore = isHome ? m.home_score : m.away_score;
                      const theirScore = isHome ? m.away_score : m.home_score;
                      let res = "D"; let color = "bg-mt";
                      if (ourScore > theirScore) { res = "W"; color = "bg-volt2 text-bg"; }
                      else if (ourScore < theirScore) { res = "L"; color = "bg-red2 text-white"; }
                      
                      return (
                        <Link key={m.event_id} href={`/match/${m.event_id}`} title={`${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`}>
                          <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border border-white/10 hover:scale-110 transition-transform", color)}>
                            {res}
                          </div>
                        </Link>
                      );
                    });
                  })()}
                </div>
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
                          const ourIndex = standings.findIndex(s => s.team_id === team.id);
                          if (ourIndex === -1) return null;
                          const start = Math.max(0, ourIndex - 2);
                          const end = Math.min(standings.length, ourIndex + 3);
                          const slice = standings.slice(start, end);
                          
                          return slice.map(row => (
                            <tr key={row.team_id} className={clsx("border-b border-bd/30 last:border-0", row.team_id === team.id ? "bg-volt2/10 font-bold" : "text-mt")}>
                              <td className="py-2.5 w-6">{row.position}</td>
                              <td className="py-2.5 flex items-center gap-2">
                                <img src={`${BSD_IMG_BASE}/img/team/${row.team_id}/?sor=true&bg=transparent`} className="w-5 h-5 object-contain" />
                                <span className={row.team_id === team.id ? "text-volt2 truncate max-w-[100px]" : "truncate max-w-[100px]"}>{row.team_name}</span>
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
            
            {/* Extended Info Card & Season Stats Card */}
            <div className="space-y-4">
              <div className="card border border-volt2/20 bg-gradient-to-br from-sur to-bg">
                <h2 className="section-label mb-4 text-volt2">Key Squad Leaders</h2>
                <div className="space-y-4 text-sm">
                  {/* Top Scorer */}
                  <div className="flex items-center justify-between border-b border-bd/50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-volt2/10 flex items-center justify-center text-volt2 font-black text-xs">⚽</div>
                      <div>
                        <p className="text-mt text-xs uppercase tracking-wider font-semibold">Top Scorer</p>
                        <p className="text-white font-medium">
                          {topStats ? (topStats.scorers.find((s: any) => s.team_id === team.id)?.player_name || "N/A") : "Loading..."}
                        </p>
                      </div>
                    </div>
                    <span className="text-volt2 font-black text-lg">
                      {topStats ? (topStats.scorers.find((s: any) => s.team_id === team.id)?.value || "-") : "-"}
                    </span>
                  </div>
                  {/* Top Assists */}
                  <div className="flex items-center justify-between border-b border-bd/50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-volt2/10 flex items-center justify-center text-volt2 font-black text-xs">🎯</div>
                      <div>
                        <p className="text-mt text-xs uppercase tracking-wider font-semibold">Most Assists</p>
                        <p className="text-white font-medium">
                          {topStats ? (topStats.assists.find((s: any) => s.team_id === team.id)?.player_name || "N/A") : "Loading..."}
                        </p>
                      </div>
                    </div>
                    <span className="text-volt2 font-black text-lg">
                      {topStats ? (topStats.assists.find((s: any) => s.team_id === team.id)?.value || "-") : "-"}
                    </span>
                  </div>
                  {/* Highest Rated Mock */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-volt2/10 flex items-center justify-center text-volt2 font-black text-xs">⭐</div>
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
                    <span className="text-white font-medium text-right">{team.manager_name || "Unknown"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-bd/50 pb-2">
                    <span className="text-mt uppercase text-xs font-semibold tracking-wider">Stadium</span>
                    <span className="text-white font-medium text-right">{team.venue || "Unknown"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mt uppercase text-xs font-semibold tracking-wider">Country</span>
                    <span className="text-white font-medium text-right">{team.country}</span>
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
              <StandingsTable rows={standings} highlightTeamId={team.id} />
            </div>
          )}
        </div>
      )}

      {activeTab === "squad" && (
        <div className="space-y-6">
          {team.squad.length === 0 ? (
            <p className="text-mt text-sm">No squad information available.</p>
          ) : (
            ["Goalkeeper", "Defender", "Midfielder", "Forward"].map((posGroup) => {
              const playersInGroup = team.squad.filter(p => {
                const pos = (p.position || "").toLowerCase();
                if (posGroup === "Goalkeeper") return pos.includes("goalkeeper") || pos === "g";
                if (posGroup === "Defender") return pos.includes("defender") || pos === "d";
                if (posGroup === "Midfielder") return pos.includes("midfielder") || pos === "m";
                if (posGroup === "Forward") return pos.includes("forward") || pos.includes("striker") || pos.includes("attacker") || pos === "f" || pos === "a";
                return false;
              });

              if (playersInGroup.length === 0) return null;

              return (
                <div key={posGroup} className="card overflow-x-auto">
                  <h2 className="section-label mb-3">{posGroup}s</h2>
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
                      {playersInGroup.map((player) => {
                        const scorerData = topStats?.scorers?.find((s: any) => s.player_id === player.id);
                        const assistData = topStats?.assists?.find((s: any) => s.player_id === player.id);
                        const apps = scorerData?.matches || assistData?.matches || "-";
                        const goals = scorerData?.value || "-";
                        const assists = assistData?.value || "-";
                        
                        return (
                        <tr key={player.id} className="border-b border-bd/50 last:border-0 hover:bg-white/5 transition-colors">
                          <td className="py-2 pr-2 text-mt w-8">{player.jersey_number || "-"}</td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={playerImageUrl(player.id) || ""}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover bg-bg2"
                                onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%232C2C2C"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4 4-7 8-7s8 3 8 7"/></svg>'; }}
                              />
                              <div>
                                <Link href={`/player/${player.id}`} className="text-white font-semibold truncate max-w-[160px] hover:text-volt2 transition-colors">{player.name}</Link>
                                <p className="text-mt text-[10px] uppercase tracking-wide">
                                  {player.nationality}
                                  {player.injury_type && <span className="ml-2 text-red2 font-semibold flex items-center gap-1 inline-flex">✚ Injured</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-white font-mono">{player.position}</td>
                          <td className="py-2 pr-2 text-mt text-center">{apps}</td>
                          <td className="py-2 pr-2 text-mt text-center">{goals}</td>
                          <td className="py-2 pr-2 text-mt text-center">{assists}</td>
                          <td className="py-2 pr-2 text-mt">
                            {player.date_of_birth ? Math.floor((new Date().getTime() - new Date(player.date_of_birth).getTime()) / 31557600000) : "-"}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}
      {activeTab === "matches" && (
        <TeamMatchesTab teamId={team.id} matches={fixtures} />
      )}
    </div>
  );
}

function TeamMatchesTab({ teamId, matches }: { teamId: number, matches: any[] }) {
  if (!matches || matches.length === 0) return <p className="text-mt text-sm p-4">No matches found.</p>;

  // Group matches by past and upcoming
  const past = matches.filter((m) => m.status === "finished");
  const upcoming = matches.filter((m) => m.status !== "finished");

  const groupMatches = (list: any[]) => {
    const grouped: Record<string, any[]> = {};
    list.forEach(m => {
      const d = new Date(m.kickoff || m.event_date);
      if (isNaN(d.getTime())) return;
      const month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(m);
    });
    return grouped;
  };

  const pastGrouped = groupMatches(past.reverse());
  const upcomingGrouped = groupMatches(upcoming);

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-black text-white mb-4">Upcoming Fixtures</h2>
          <div className="space-y-6">
            {Object.keys(upcomingGrouped).map(month => (
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
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-black text-white mb-4">Past Results</h2>
          <div className="space-y-6">
            {Object.keys(pastGrouped).map(month => (
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
        </div>
      )}
    </div>
  );
}

// Wrapper to dynamically load MatchCard to avoid top-level import bloat, or we can just import it.
function MatchCardWrapper({ match, teamId }: { match: any, teamId?: number }) {
  const [MatchCard, setMatchCard] = useState<any>(null);
  useEffect(() => {
    import("@/components/MatchCard").then((mod) => setMatchCard(() => mod.default));
  }, []);
  if (!MatchCard) return null;
  return <MatchCard match={match} targetTeamId={teamId} showCompetition={true} />;
}
