// lib/api.ts — Tactica Pulse API client
// Points at the Pulse backend (separate service from the main Tactica
// engine backend). Swap NEXT_PUBLIC_API_URL once it's deployed.

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// BSD's image CDN -- confirmed from the Teams/players/transfers docs:
// badges and photos come from ids with no extra API call needed,
// served straight off the root domain, not under /api/v2. Used
// directly as an <img src>, so it never goes through our backend.
export const BSD_IMG_BASE = "https://sports.bzzoiro.com";

export function playerImageUrl(playerId: number | null | undefined): string | null {
  if (playerId == null) return null;
  return `${BSD_IMG_BASE}/img/player/${playerId}/?sor=true&bg=transparent`;
}

export type LeagueMatches = {
  league_id?: number | null;
  league: string;
  matches: MatchSummary[];
};

export type MatchSummary = {
  event_id: number | null;
  home_team: string;
  home_team_id?: number | null;
  away_team: string;
  away_team_id?: number | null;
  home_score: number;
  away_score: number;
  minute: number;
  status: string;
  last_updated?: string;
  // Only set by /matches-by-date, used for not-yet-started matches so
  // the card can show a kickoff time instead of "notstarted".
  kickoff?: string;
  competition?: string;
  league_id?: number;
};

export async function getLiveScores(): Promise<{ count: number; leagues: LeagueMatches[] }> {
  const res = await fetch(`${API_BASE}/api/live-scores`, { cache: "no-store" });
  if (!res.ok) throw new Error(`live-scores failed: ${res.status}`);
  return res.json();
}

// date must be "YYYY-MM-DD". Backing the Matches tab's day-by-day
// browsing (back/next arrows + calendar jump) — returns every match for
// that one day, played, live, and upcoming, across every league.
export async function getMatchesByDate(date: string): Promise<{ date: string; count: number; leagues: LeagueMatches[] }> {
  const res = await fetch(`${API_BASE}/api/matches-by-date?date=${date}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`matches-by-date failed: ${res.status}`);
  return res.json();
}

export type H2HMatch = {
  event_id: number | null;
  date: string;
  home_team: string;
  away_team: string;
  home_team_id?: number | null;
  away_team_id?: number | null;
  home_score: number | null;
  away_score: number | null;
  league_id?: number | null;
  league_name?: string | null;
};

export type H2HSummary = {
  total_matches: number | null;
  home_wins: number | null;
  draws: number | null;
  away_wins: number | null;
  home_goals: number | null;
  away_goals: number | null;
};

export type TeamFormResult = {
  event_id: number | null;
  opponent: string;
  own_score: number | null;
  opp_score: number | null;
  is_home: boolean;
  result: "W" | "D" | "L" | null;
  date: string;
};

export type MatchDetail = {
  event_id: number;
  home_team: string;
  home_team_id: number | null;
  away_team: string;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  minute: number | null;
  event_date: string;
  competition: string;
  venue: string | null;
  referee: string | null;
  round: string | null;
  home_coach: string | null;
  away_coach: string | null;
  // Last 5 finished results for each side, independent of each other
  // -- same idea as FotMob's "Team form" strip on the match overview.
  home_form: TeamFormResult[];
  away_form: TeamFormResult[];
  lineup_status: string;
  lineups: Record<string, any>;
  // From /events/{id}/h2h/ — a real BSD endpoint, not a guess.
  h2h: { summary: H2HSummary | null; recent_matches: H2HMatch[] };
  // From /events/{id}/incidents/, filtered to goal-type entries.
  goalscorers: { minute: number | string | null; player: string | null; side: "home" | "away" | null }[];
  incidents: any[];
  // Raw BSD passthrough from /events/{id}/stats/, rendered defensively
  // by the Stats tab.
  stats: any;
  // From /events/{id}/availability/ — which sub-resources this match
  // actually has data for (stats, lineups, incidents, odds, etc.), so
  // the UI can show an accurate "not published yet" instead of
  // guessing from an empty response.
  availability: Record<string, boolean>;
  facts: {
    tactica_atk_rating: number | null;
    tactica_def_rating: number | null;
    tactica_win_prob: Record<string, number> | null;
  };
};

export async function getMatchDetail(eventId: number): Promise<MatchDetail> {
  const res = await fetch(`${API_BASE}/api/matches/${eventId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`match detail failed: ${res.status}`);
  return res.json();
}

export type PlayerSearchResult = {
  id: number;
  name: string;
  short_name: string;
  position: string;
  current_team: string | null;
  nationality: string;
  rating: number | null;
};

export async function searchPlayers(name: string): Promise<{ results: PlayerSearchResult[] }> {
  const res = await fetch(`${API_BASE}/api/players/search?name=${encodeURIComponent(name)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`player search failed: ${res.status}`);
  return res.json();
}

export type PlayerSeasons = {
  player_id: number;
  total_matches_available: number;
  team_blocks: { team_id: number; match_count: number }[];
  note: string;
};

export type PlayerDetail = {
  id: number;
  name: string;
  short_name: string;
  position: string;
  jersey_number: number | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  preferred_foot: string | null;
  nationality: string | null;
  current_team_id: number | null;
  current_team: { name: string; id: number } | null;
  market_value_eur: number | null;
  contract_until: string | null;
  rating: number | null;
};

export async function getPlayerProfile(playerId: number): Promise<PlayerDetail> {
  const res = await fetch(`${API_BASE}/api/players/${playerId}/profile`, { cache: "no-store" });
  if (!res.ok) throw new Error(`player profile failed: ${res.status}`);
  return res.json();
}

export async function getPlayerSeasons(playerId: number): Promise<PlayerSeasons> {
  const res = await fetch(`${API_BASE}/api/players/${playerId}/seasons`, { cache: "no-store" });
  if (!res.ok) throw new Error(`player seasons failed: ${res.status}`);
  return res.json();
}

export type RadarAxes = {
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  creativity: number;
  physical: number;
};

export async function getPlayerRadar(playerId: number, teamId?: number, limit = 15): Promise<{ radar: RadarAxes; matches_used: number }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (teamId !== undefined) params.set("team_id", String(teamId));
  const res = await fetch(`${API_BASE}/api/players/${playerId}/radar?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`player radar failed: ${res.status}`);
  return res.json();
}

// ── Leagues tab ──────────────────────────────────────────────────────
export type LeagueOption = { league_id: number; name: string };

export async function getLeagues(): Promise<{ leagues: LeagueOption[] }> {
  const res = await fetch(`${API_BASE}/api/leagues`, { cache: "no-store" });
  if (!res.ok) throw new Error(`leagues failed: ${res.status}`);
  return res.json();
}

export type StandingsRow = {
  position: number | null;
  team: string;
  team_id: number | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  zone: { key?: string; label?: string; type?: string } | null;
};

export type StandingsGroup = { group: string; standings: StandingsRow[] };

export async function getStandings(leagueId: number): Promise<{
  league_id: number;
  league: string;
  standings: StandingsRow[] | null;
  groups: StandingsGroup[] | null;
}> {
  const res = await fetch(`${API_BASE}/api/standings?league_id=${leagueId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`standings failed: ${res.status}`);
  return res.json();
}

export async function getLeagueFixtures(leagueId: number): Promise<{ league_id: number; matches: MatchSummary[] }> {
  const res = await fetch(`${API_BASE}/api/leagues/${leagueId}/fixtures`, { cache: "no-store" });
  if (!res.ok) throw new Error(`league fixtures failed: ${res.status}`);
  return res.json();
}

export type TopStatPlayer = {
  rank: number;
  player_id: number;
  player_name: string;
  position: string;
  team_id: number;
  team_name: string;
  value: number;
  matches: number;
};

export async function getLeagueTopStats(leagueId: number): Promise<{ league_id: number; scorers: TopStatPlayer[]; assists: TopStatPlayer[] }> {
  const res = await fetch(`${API_BASE}/api/leagues/${leagueId}/top-stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`league top stats failed: ${res.status}`);
  return res.json();
}

// ── News tab ─────────────────────────────────────────────────────────
export type NewsItem = {
  source: "medium" | "x";
  title: string;
  url: string;
  excerpt: string;
  published: string;
};

export async function getNews(): Promise<{ count: number; items: NewsItem[] }> {
  const res = await fetch(`${API_BASE}/api/news`, { cache: "no-store" });
  if (!res.ok) throw new Error(`news failed: ${res.status}`);
  return res.json();
}

// ── Auth / settings ──────────────────────────────────────────────────
// Signup, sign-in, verification codes and password resets all live in
// lib/auth.ts and talk to Supabase directly. This backend never sees a
// password. Everything below just needs a bearer token on the request.
export type ScoutUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "admin";
  followed_teams: string[];
  language: string;
};

export { isSignedIn, signOut } from "./auth";
import { authHeaders } from "./auth";

async function parseErr(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function getMe(): Promise<{ user: ScoutUser }> {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { ...(await authHeaders()) } });
  if (!res.ok) throw new Error(await parseErr(res, `me failed: ${res.status}`));
  return res.json();
}

export async function updateFollowedTeams(teams: string[]): Promise<{ user: ScoutUser }> {
  const res = await fetch(`${API_BASE}/api/me/followed-teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ teams }),
  });
  if (!res.ok) throw new Error(await parseErr(res, `update followed teams failed: ${res.status}`));
  return res.json();
}

export async function updateLanguage(language: string): Promise<{ user: ScoutUser }> {
  const res = await fetch(`${API_BASE}/api/me/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) throw new Error(await parseErr(res, `update settings failed: ${res.status}`));
  return res.json();
}

// ── Teams ────────────────────────────────────────────────────────────
export type PlayerSummary = {
  id: number;
  name: string;
  short_name: string;
  position: string;
  jersey_number: number | null;
  nationality: string;
  date_of_birth: string | null;
  availability: string;
  injury_type: string | null;
};

export type TeamDetail = {
  id: number;
  name: string;
  short_name: string;
  country: string;
  venue: string | null;
  venue_capacity: number | null;
  manager_name: string | null;
  manager_stats?: {
    avg_possession: number | null;
    avg_goals_scored: number | null;
    avg_goals_conceded: number | null;
  } | null;
  primary_league_id?: number | null;
  primary_league_name?: string | null;
  position?: number | null;
  squad: PlayerSummary[];
};

// `degraded` is true when a BSD sub-call came back empty, so missing
// fields mean "we couldn't fetch this", not "this doesn't exist".
export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  const res = await fetch(`${API_BASE}/api/teams/${teamId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`team detail failed: ${res.status}`);
  return res.json();
}

export async function getTeamFixtures(teamId: number): Promise<{
  team_id: number;
  // The backend already splits these correctly. BSD reports a finished
  // match as any of finished/ended/played/ft, so never re-filter
  // `matches` on a single status string here -- use `recent`.
  recent: MatchSummary[];
  upcoming: MatchSummary[];
  matches: MatchSummary[];
  degraded?: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/teams/${teamId}/fixtures`, { cache: "no-store" });
  if (!res.ok) throw new Error(`team fixtures failed: ${res.status}`);
  return res.json();
}

export async function globalSearch(q: string) {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}
