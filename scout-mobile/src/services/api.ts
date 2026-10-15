// src/services/api.ts — Tactica Scout Mobile API client
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_API_URL = 'tactica_mobile_api_url';
const STORAGE_KEY_TOKEN = 'scout_token';

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
  facts: {
    tactica_atk_rating: number | null;
    tactica_def_rating: number | null;
    tactica_win_prob: Record<string, number> | null;
  };
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
  username: string;
  followed_teams: string[];
  language: string;
};

// ── Auth Storage Helpers ──────────────────────────────────────────────
export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export async function signUp(username: string, password: string): Promise<{ token: string; user: ScoutUser }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Sign up failed: ${res.status}`);
  }
  const result = await res.json();
  if (result.token) await setAuthToken(result.token);
  return result;
}

export async function signIn(username: string, password: string): Promise<{ token: string; user: ScoutUser }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Sign in failed: ${res.status}`);
  }
  const result = await res.json();
  if (result.token) await setAuthToken(result.token);
  return result;
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
