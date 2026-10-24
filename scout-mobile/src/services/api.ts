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
  /** BSD event id (number) or, for a local competition, the fixture
   *  uuid (string). `source` says which. */
  event_id: number | string | null;
  /** "local" for a competition run in Scout Editor; absent for BSD. */
  source?: 'local';
  /** Set only when source is "local", for routing to its match page. */
  tournament_id?: string;
  home_crest?: string | null;
  away_crest?: string | null;
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
  /** "local" marks a competition run in Scout Editor. It groups in the
   *  feed exactly like a BSD league; this only changes where a tap
   *  goes. */
  source?: 'local';
  tournament_id?: string;
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

  // ── Frozen pre-match snapshot ──────────────────────────────────────
  /** True when these are the saved pre-match numbers, read from
   *  match_predictions and never recalculated. */
  frozen?: boolean;
  /** True when the numbers are live but NOT yet saved, because kickoff
   *  is further out than the freeze window. They can still move. */
  provisional?: boolean;
  computed_at?: string | null;
  formula_version?: string | null;
  /** Set when there is nothing to show and never will be, e.g.
   *  "no_prematch_snapshot" for a match that kicked off without one.
   *  Distinct from `degraded`, which means "try again later". */
  unavailable_reason?: string | null;
};

export async function getMatchFacts(eventId: number): Promise<MatchFacts> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/matches/${eventId}/facts`);
  if (!res.ok) throw new Error(`match facts failed: ${res.status}`);
  return res.json();
}

// ── Crowd ratings & Man of the Match ─────────────────────────────────
// Mirrors scout-web/lib/api.ts one for one. `source` discriminates BSD
// matches (numeric event id) from local tournament fixtures (uuid).

export type RatingSource = 'bsd' | 'local';

export type RatingWindow = {
  open: boolean;
  reason: string | null;
  opens_at_minute?: number;
  closes_at?: string | null;
};

export type PlayerRating = {
  player_ref: string;
  votes: number;
  /** Withheld until min_votes people have rated. */
  average: number | null;
  enough_votes: boolean;
};

export type MatchRatings = {
  source: RatingSource;
  match_ref: string;
  window: RatingWindow;
  min_votes: number;
  players: PlayerRating[];
  motm: {
    total_votes: number;
    leaders: { player_ref: string; votes: number; share: number }[];
  };
};

export type MyVotes = {
  ratings: Record<string, number>;
  motm: string | null;
};

export async function getMatchRatings(
  source: RatingSource, matchRef: string | number
): Promise<MatchRatings> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/ratings/${source}/${matchRef}`);
  if (!res.ok) throw new Error(`ratings failed: ${res.status}`);
  return res.json();
}

export async function getMyVotes(
  source: RatingSource, matchRef: string | number
): Promise<MyVotes> {
  const base = await getApiBase();
  const headers = await authHeaders();
  const res = await fetch(`${base}/api/ratings/${source}/${matchRef}/mine`, { headers });
  if (!res.ok) throw new Error(`my votes failed: ${res.status}`);
  return res.json();
}

async function putJson(path: string, body: unknown) {
  const base = await getApiBase();
  const headers = await authHeaders();
  const res = await fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try { detail = (await res.json())?.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const ratePlayer = (
  source: RatingSource, matchRef: string | number,
  playerRef: string | number, score: number
) => putJson(`/api/ratings/${source}/${matchRef}/players/${playerRef}`, { score });

export const voteMotm = (
  source: RatingSource, matchRef: string | number, playerRef: string | number
) => putJson(`/api/ratings/${source}/${matchRef}/motm`, { player_ref: String(playerRef) });

// ── Local tournaments ────────────────────────────────────────────────
// Mirrors scout-web/lib/api.ts. Competitions run in Scout Editor and
// approved for publication.

export type TournamentSummary = {
  id: string; name: string; level: string; gender: string; country: string;
  start_date: string; end_date: string;
  format: 'league' | 'knockout' | 'groups_knockout';
  organizing_body: string;
};

export type TournamentTeam = {
  team_id: string; club_id: string | null; name: string;
  short_name: string | null; crest_url: string | null; group_name: string | null;
};

export type TournamentFixture = {
  id: string; round: string | null; group_name: string | null;
  kickoff_at: string; venue: string | null; status: string;
  home_team: string | null; home_crest: string | null; home_team_id: string;
  away_team: string | null; away_crest: string | null; away_team_id: string;
  home_score: number | null; away_score: number | null;
};

export type TournamentStanding = {
  team_id: string; name: string; short_name: string | null;
  crest_url: string | null; group_name: string | null;
  played: number; won: number; drawn: number; lost: number;
  goals_for: number; goals_against: number; goal_difference: number;
  points: number; form: string[]; position: number;
};

export type TournamentDetail = {
  tournament: TournamentSummary;
  teams: TournamentTeam[];
  fixtures: TournamentFixture[];
  standings: TournamentStanding[] | null;
  group_tables: Record<string, TournamentStanding[]> | null;
  points_rules?: { win: number; draw: number; loss: number };
};

export type TournamentMatchEvent = {
  id: string; type: string; minute: number | null;
  tournament_team_id: string; side: 'home' | 'away';
  players: { id: string; first_name: string; last_name: string } | null;
};

export type TournamentSheetPlayer = {
  player_id: string; name: string;
  shirt_number: number | null; position: string | null;
};

export type TournamentSheet = {
  formation: string | null;
  starters: TournamentSheetPlayer[];
  substitutes: TournamentSheetPlayer[];
};

export type TournamentMatch = {
  fixture: TournamentFixture & { tournament_id: string };
  lineups: { home: TournamentSheet; away: TournamentSheet };
  lineup_status: 'confirmed' | 'unavailable';
  events: TournamentMatchEvent[];
};

export async function getTournaments(): Promise<{ count: number; tournaments: TournamentSummary[] }> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/tournaments`);
  if (!res.ok) throw new Error(`tournaments failed: ${res.status}`);
  return res.json();
}

export async function getTournament(id: string): Promise<TournamentDetail> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/tournaments/${id}`);
  if (!res.ok) throw new Error(`tournament failed: ${res.status}`);
  return res.json();
}

export async function getTournamentMatch(
  tournamentId: string, fixtureId: string
): Promise<TournamentMatch> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/tournaments/${tournamentId}/fixtures/${fixtureId}`);
  if (!res.ok) throw new Error(`fixture failed: ${res.status}`);
  return res.json();
}

export type TournamentPlayer = {
  player: {
    id: string; name: string; first_name: string | null; last_name: string | null;
    position: string | null; photo_url: string | null;
    nationality: string | null; shirt_number: number | null;
  };
  team: {
    team_id: string; name: string; short_name: string | null;
    crest_url: string | null; group_name: string | null;
  };
  tournament_id: string;
  stats: {
    appearances: number; starts: number; goals: number;
    assists: number; yellow_cards: number; red_cards: number;
  };
};

export async function getTournamentPlayer(
  tournamentId: string, playerId: string
): Promise<TournamentPlayer> {
  const base = await getApiBase();
  const res = await fetch(
    `${base}/api/tournaments/${tournamentId}/players/${playerId}`
  );
  if (!res.ok) throw new Error(`player failed: ${res.status}`);
  return res.json();
}
