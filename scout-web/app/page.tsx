"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { getMatchesByDate, getMe, type LeagueMatches, type MatchSummary } from "@/lib/api";
import { isSignedIn } from "@/lib/auth";
import MatchCard from "@/components/MatchCard";
import DateNav from "@/components/DateNav";

type StatusFilter = "all" | "following" | "live" | "upcoming" | "finished";
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "following", label: "Following" },
  { id: "live",     label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Finished" },
];

function isMatchFinished(s: string) {
  return ["finished", "ended", "played"].includes(s);
}

function isMatchLive(s: string) {
  return !isMatchFinished(s) && !["notstarted", "postponed", "cancelled", "delayed"].includes(s);
}

function matchPasses(m: MatchSummary, filter: StatusFilter): boolean {
  if (filter === "all" || filter === "following") return true;
  if (filter === "live") return isMatchLive(m.status);
  if (filter === "finished") return isMatchFinished(m.status);
  return !isMatchFinished(m.status) && !isMatchLive(m.status); // "upcoming"
}

function isFollowed(m: MatchSummary, leagueId: number | null | undefined, followedTokens: string[]): boolean {
  if (!followedTokens || followedTokens.length === 0) return false;
  return followedTokens.some(token => {
    const parts = token.split(':');
    if (parts.length >= 2) {
      const type = parts[0];
      const id = Number(parts[1]);
      if (type === "team" && (m.home_team_id === id || m.away_team_id === id)) return true;
      if (type === "league" && leagueId === id) return true;
    } else {
       // fallback to old plain text team names
       if (m.home_team.toLowerCase() === token.toLowerCase()) return true;
       if (m.away_team.toLowerCase() === token.toLowerCase()) return true;
    }
    return false;
  });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HomePage() {
  const [date, setDate] = useState(todayISO());
  const [leagues, setLeagues] = useState<LeagueMatches[]>([]);
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [followedTeams, setFollowedTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function toggleLeague(league: string) {
    setCollapsedLeagues((prev) => ({ ...prev, [league]: !prev[league] }));
  }

  async function load(selectedDate: string) {
    try {
      const data = await getMatchesByDate(selectedDate);
      setLeagues(data.leagues);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load matches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load(date);
    
    isSignedIn().then((signed) => {
      if (!signed) {
        setFollowedTeams([]);
        return;
      }
      getMe()
        .then(data => setFollowedTeams(data.user.followed_teams))
        .catch(() => {});
    });
    
    if (date !== todayISO()) return;
    const interval = setInterval(() => load(date), 30_000);
    return () => clearInterval(interval);
  }, [date]);

  // Status filter (Live/Upcoming/Finished) cuts across every league
  // group -- a league section disappears entirely for a given filter
  // once none of its matches pass it, rather than showing an empty
  // heading with nothing under it.
  const visibleLeagues = leagues
    .map((lg) => {
       if (statusFilter === "following" && followedTeams.length === 0) return { ...lg, matches: [] };
       
       let filteredMatches = lg.matches;
       if (statusFilter === "following") {
         filteredMatches = filteredMatches.filter(m => isFollowed(m, lg.league_id, followedTeams));
       } else {
         filteredMatches = filteredMatches.filter((m) => matchPasses(m, statusFilter));
       }
       return { ...lg, matches: filteredMatches };
    })
    .filter((lg) => lg.matches.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Matches</h1>
        <p className="text-mt text-sm mt-1">Played, live, and upcoming matches.</p>
      </div>

      <DateNav date={date} onChange={setDate} />

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={clsx("tab-pill shrink-0", statusFilter === f.id ? "tab-pill-active" : "tab-pill-inactive")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-mt text-sm">Loading matches...</p>}

      {error && (
        <div className="card border-red2/40">
          <p className="text-red2 text-sm font-semibold">{error}</p>
          <p className="text-mt text-xs mt-1">
            Make sure the backend is running and NEXT_PUBLIC_API_URL points at it.
          </p>
        </div>
      )}

      {!loading && !error && visibleLeagues.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-mt text-sm">No matches found for this filter.</p>
          {statusFilter === "following" && followedTeams.length === 0 && (
            <p className="text-mt text-xs mt-2">You aren't following any active teams or leagues yet.</p>
          )}
        </div>
      )}

      {visibleLeagues.map((lg) => (
        <div key={lg.league} className="space-y-2">
          <div className="flex items-center justify-between group">
            {/* A local competition's heading opens its own page, the
                same way a BSD league heading opens that league. */}
            {lg.source === "local" && lg.tournament_id ? (
              <a href={`/tournament/${lg.tournament_id}`}
                 className="section-label hover:text-volt2 transition-colors cursor-pointer
                            block py-1 flex items-center gap-2">
                {lg.league}
                <span className="font-mono text-[9px] text-cyan border border-cyan/30
                                 rounded px-1 py-px tracking-normal">
                  LOCAL
                </span>
              </a>
            ) : lg.league_id ? (
              <a href={`/league/${lg.league_id}`} className="section-label hover:text-volt2 transition-colors cursor-pointer block py-1">
                {lg.league}
              </a>
            ) : (
              <p className="section-label">{lg.league}</p>
            )}
            <div 
              className="cursor-pointer p-1 ml-auto"
              onClick={() => toggleLeague(lg.league)}
            >
            <svg
              className={clsx("w-4 h-4 text-mt transition-transform duration-200", collapsedLeagues[lg.league] && "-rotate-90")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            </div>
          </div>
          {!collapsedLeagues[lg.league] && (
            <div className="space-y-2">
              {lg.matches.map((m, i) => (
                <MatchCard key={String(m.event_id ?? `${lg.league}-${i}`)} match={m} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
