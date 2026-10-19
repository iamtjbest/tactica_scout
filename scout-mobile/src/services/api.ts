// src/services/api.ts — Tactica Scout Mobile API client
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_API_URL = 'tactica_mobile_api_url';

// Default fallback depending on platform / env:
// Android Emulator uses 10.0.2.2 to reach host machine, iOS simulator can use localhost
const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

let activeApiBase: string | null = null;

export async function getApiBase(): Promise<string> {
  if (activeApiBase) return activeApiBase;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
    if (saved && saved.trim().length > 0) {
      activeApiBase = saved.trim();
      return activeApiBase;
    }
  } catch {}
  activeApiBase = DEFAULT_URL;
  return activeApiBase || DEFAULT_URL;
}

export async function setApiBase(url: string): Promise<void> {
  activeApiBase = url.trim();
  await AsyncStorage.setItem(STORAGE_KEY_API_URL, activeApiBase);
}

export async function resetApiBase(): Promise<void> {
  activeApiBase = DEFAULT_URL;
  await AsyncStorage.removeItem(STORAGE_KEY_API_URL);
}

export const BSD_IMG_BASE = 'https://sports.bzzoiro.com';

export function playerImageUrl(playerId: number | null | undefined): string | null {
  if (playerId == null) return null;
  return `${BSD_IMG_BASE}/img/player/${playerId}/?sor=true&bg=transparent`;
}

export function teamLogoUrl(teamId: number | null | undefined): string | null {
  if (teamId == null) return null;
  return `${BSD_IMG_BASE}/img/team/${teamId}/`;
}

// ── Types ─────────────────────────────────────────────────────────────
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
  kickoff?: string;
  competition?: string;
  league_id?: number;
};

export type LeagueMatches = {
  league_id?: number | null;
  league: string;
  matches: MatchSummary[];
};

export type TeamFormResult = {
  event_id: number | null;
  opponent: string;
  /** Opponent's team id, for the crest. Null where BSD didn't give one. */
  opponent_id: number | null;
  own_score: number | null;
  opp_score: number | null;
  is_home: boolean;
  result: 'W' | 'D' | 'L' | null;
  date: string;
};

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
  home_form: TeamFormResult[];
  away_form: TeamFormResult[];
  lineup_status: string;
  lineups: Record<string, any>;
  h2h: { summary: H2HSummary | null; recent_matches: H2HMatch[] };
  goalscorers: { minute: number | string | null; player: string | null; side: 'home' | 'away' | null }[];
  incidents: any[];
  stats: any;
  availability: Record<string, boolean>;
  /** Facts live at their own endpoint; see getMatchFacts. */
  facts_url?: string;
};

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

export type RadarAxes = {
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  creativity: number;
  physical: number;
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

export type NewsItem = {
  source: 'medium' | 'x';
  title: string;
  url: string;
  excerpt: string;
  published: string;
};

export type ScoutUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'user' | 'admin';
  followed_teams: string[];
  language: string;
};

// ── Auth ──────────────────────────────────────────────────────────────
// Sessions live in Supabase (AsyncStorage-backed) and refresh
// themselves. Nothing stores a token by hand any more -- the old
// `scout_token` key is gone. See src/services/auth.ts.
export { isSignedIn, signOut } from './auth';
import { authHeaders } from './auth';

// ── API Methods ───────────────────────────────────────────────────────

export async function getLiveScores(): Promise<{ count: number; leagues: LeagueMatches[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/live-scores`);
  if (!res.ok) throw new Error(`live-scores failed: ${res.status}`);
  return res.json();
}

export async function getMatchesByDate(date: string): Promise<{ date: string; count: number; leagues: LeagueMatches[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/matches-by-date?date=${date}`);
  if (!res.ok) throw new Error(`matches-by-date failed: ${res.status}`);
  return res.json();
}

export async function getMatchDetail(eventId: number): Promise<MatchDetail> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/matches/${eventId}`);
  if (!res.ok) throw new Error(`match detail failed: ${res.status}`);
  return res.json();
}

export async function getLeagues(): Promise<{ leagues: { league_id: number; name: string }[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/leagues`);
  if (!res.ok) throw new Error(`leagues failed: ${res.status}`);
  return res.json();
}

export async function getStandings(leagueId: number): Promise<{
  league_id: number;
  league: string;
  standings: StandingsRow[] | null;
  groups: StandingsGroup[] | null;
}> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/standings?league_id=${leagueId}`);
  if (!res.ok) throw new Error(`standings failed: ${res.status}`);
  return res.json();
}

export async function getLeagueFixtures(leagueId: number): Promise<{ league_id: number; matches: MatchSummary[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/leagues/${leagueId}/fixtures`);
  if (!res.ok) throw new Error(`league fixtures failed: ${res.status}`);
  return res.json();
}

export async function getLeagueTopStats(leagueId: number): Promise<{ league_id: number; scorers: TopStatPlayer[]; assists: TopStatPlayer[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/leagues/${leagueId}/top-stats`);
  if (!res.ok) throw new Error(`top stats failed: ${res.status}`);
  return res.json();
}

export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/teams/${teamId}`);
  if (!res.ok) throw new Error(`team detail failed: ${res.status}`);
  return res.json();
}

export async function getTeamFixtures(teamId: number): Promise<{
  team_id: number;
  recent: MatchSummary[];
  upcoming: MatchSummary[];
  matches: MatchSummary[];
}> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/teams/${teamId}/fixtures`);
  if (!res.ok) throw new Error(`team fixtures failed: ${res.status}`);
  return res.json();
}

export async function searchPlayers(name: string): Promise<{ results: any[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/players/search?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`search players failed: ${res.status}`);
  return res.json();
}

export async function getPlayerProfile(playerId: number): Promise<PlayerDetail> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/players/${playerId}/profile`);
  if (!res.ok) throw new Error(`player profile failed: ${res.status}`);
  return res.json();
}

export async function getPlayerRadar(playerId: number, teamId?: number, limit = 15): Promise<{ radar: RadarAxes; matches_used: number }> {
  const base = await getApiBase();
  const params = new URLSearchParams({ limit: String(limit) });
  if (teamId !== undefined) params.set('team_id', String(teamId));
  const res = await fetch(`${base}/api/players/${playerId}/radar?${params}`);
  if (!res.ok) throw new Error(`player radar failed: ${res.status}`);
  return res.json();
}

export async function getNews(): Promise<{ count: number; items: NewsItem[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/news`);
  if (!res.ok) throw new Error(`news failed: ${res.status}`);
  return res.json();
}

export async function globalSearch(q: string): Promise<any> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`global search failed: ${res.status}`);
  return res.json();
}



export async function getMe(): Promise<{ user: ScoutUser }> {
  const base = await getApiBase();
  const headers = await authHeaders();
  const res = await fetch(`${base}/api/auth/me`, { headers });
  if (!res.ok) throw new Error(`Failed to get user profile: ${res.status}`);
  return res.json();
}

export async function updateFollowedTeams(teams: string[]): Promise<{ user: ScoutUser }> {
  const base = await getApiBase();
  const headers = await authHeaders();
  const res = await fetch(`${base}/api/me/followed-teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ teams }),
  });
  if (!res.ok) throw new Error(`Failed to update followed teams: ${res.status}`);
  return res.json();
}

export async function updateLanguage(language: string): Promise<{ user: ScoutUser }> {
  const base = await getApiBase();
  const headers = await authHeaders();
  const res = await fetch(`${base}/api/me/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) throw new Error(`Failed to update language: ${res.status}`);
  return res.json();
}

// ── Player career / transfers / international / season totals ─────────
// Mirrors scout-web/lib/api.ts. Each can return degraded: true, meaning
// the fetch came back with nothing -- distinct from a genuinely empty
// record, so the UI never claims a veteran has no career because one
// request failed.

export type PlayerCareerSeason = {
  season?: string | null;
  season_name?: string | null;
  team_name?: string | null;
  team_id?: number | null;
  league_name?: string | null;
  appearances?: number | null;
  goals?: number | null;
  assists?: number | null;
  [k: string]: any;
};

export type PlayerTransfer = {
  date?: string | null;
  transfer_date?: string | null;
  from_team_name?: string | null;
  to_team_name?: string | null;
  from_team_id?: number | null;
  to_team_id?: number | null;
  /** null means undisclosed, NOT free. */
  fee_eur?: number | null;
  transfer_type?: string | null;
  [k: string]: any;
};

export type PlayerSeasonStats = {
  player_id: number;
  season: string | null;
  seasons_available: string[];
  grouped_by: string;
  record_keys: string[];
  totals: Record<string, number | null>;
  recent_matches: any[];
  degraded: boolean;
};

async function playerSub<T>(playerId: number, path: string, label: string): Promise<T> {
  // Base is resolved per request here (not a module constant) because the
  // app lets you point it at a different backend at runtime.
  const base = await getApiBase();
  const res = await fetch(`${base}/api/players/${playerId}/${path}`);
  if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
  return res.json();
}

export function getPlayerCareer(
  playerId: number
): Promise<{ seasons: PlayerCareerSeason[]; degraded: boolean }> {
  return playerSub(playerId, 'career', 'player career');
}

export function getPlayerTransfers(
  playerId: number
): Promise<{ transfers: PlayerTransfer[]; degraded: boolean }> {
  return playerSub(playerId, 'transfers', 'player transfers');
}

export function getPlayerNationalTeam(
  playerId: number
): Promise<{ teams: any[]; summary: any | null; degraded: boolean }> {
  return playerSub(playerId, 'national-team', 'player national team');
}

export function getPlayerSeasonStats(
  playerId: number,
  season?: string
): Promise<PlayerSeasonStats> {
  const q = season ? `season-stats?season=${encodeURIComponent(season)}` : 'season-stats';
  return playerSub(playerId, q, 'player season stats');
}

/** Format a transfer fee. Undisclosed is not zero -- BSD's docs are
 *  explicit that a move with no published figure is not a fee of nothing. */
export function formatFee(fee: number | null | undefined): string {
  if (fee == null) return 'Undisclosed';
  if (fee === 0) return 'Free';
  if (fee >= 1_000_000) return `€${(fee / 1_000_000).toFixed(fee >= 10_000_000 ? 0 : 1)}m`;
  if (fee >= 1_000) return `€${Math.round(fee / 1_000)}k`;
  return `€${fee}`;
}


// ── Tactica facts ─────────────────────────────────────────────────────
// Fetched separately from match detail: Tactica's backend sleeps on
// Render's free tier, and a ~50s cold start must not block the match page.
export type MatchFacts = {
  home: { attack: number | null; defence: number | null; win_prob: number | null; live_rating: boolean };
  away: { attack: number | null; defence: number | null; win_prob: number | null; live_rating: boolean };
  draw_prob: number | null;
  best_formation: string | null;
  away_best_formation: string | null;
  degraded: boolean;
  /** Non-null when a team name resolved to the wrong club upstream. */
  name_mismatch: string[] | null;
};

export async function getMatchFacts(eventId: number): Promise<MatchFacts> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/matches/${eventId}/facts`);
  if (!res.ok) throw new Error(`match facts failed: ${res.status}`);
  return res.json();
}
