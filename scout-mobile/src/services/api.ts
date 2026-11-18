// src/services/api.ts — Tactica Scout Mobile API client
import { authHeaders } from './auth';

const PRODUCTION_API_URL = 'https://tactica-scout-api.onrender.com';

export async function getApiBase(): Promise<string> {
  return PRODUCTION_API_URL;
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
  event_id: number | string | null;
  source?: 'local';
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
  source?: 'local';
  tournament_id?: string;
};

export type TeamFormResult = {
  event_id: number | null;
  opponent: string;
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

export type LeagueSeason = {
  id: number | null;
  label: string;
  is_current: boolean;
  winner_name: string | null;
  winner_id: number | null;
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

export type MatchFacts = {
  event_id: number;
  home_team: string;
  away_team: string;
  home: { attack: number | null; defence: number | null; win_prob: number | null; live_rating?: boolean } | null;
  away: { attack: number | null; defence: number | null; win_prob: number | null; live_rating?: boolean } | null;
  draw_prob: number | null;
  best_formation: string | null;
  away_best_formation: string | null;
  degraded: boolean;
  frozen?: boolean;
  provisional?: boolean;
  computed_at?: string;
};

export type MatchRatings = {
  source: string;
  match_ref: string | number;
  window: { open: boolean; closes_at: string | null };
  min_votes: number;
  players: {
    player_ref: string;
    player_name: string;
    team_ref: string;
    team_name: string;
    position: string;
    shirt_number: number | null;
    rating: number | null;
    votes: number;
  }[];
  motm: {
    total_votes: number;
    leaders: { player_ref: string; votes: number; share: number }[];
  };
};

export type MyVotes = {
  ratings: Record<string, number>;
  motm: string | null;
};

// ── Auth Export ───────────────────────────────────────────────────────
export { isSignedIn, signOut } from './auth';

// ── API Methods ───────────────────────────────────────────────────────

export async function getLiveScores(): Promise<{ count: number; leagues: LeagueMatches[] }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/live-scores`);
  if (!res.ok) throw new Error(`live-scores failed: ${res.status}`);
  return res.json();
}

export async function getMatchesByDate(date: string): Promise<{ date: string; count: number; leagues: LeagueMatches[] }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/matches-by-date?date=${date}`);
  if (!res.ok) throw new Error(`matches-by-date failed: ${res.status}`);
  return res.json();
}

export async function getMatchDetail(eventId: number): Promise<MatchDetail> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/matches/${eventId}`);
  if (!res.ok) throw new Error(`match detail failed: ${res.status}`);
  return res.json();
}

export async function getMatchFacts(eventId: number): Promise<MatchFacts> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/matches/${eventId}/facts`);
  if (!res.ok) throw new Error(`match facts failed: ${res.status}`);
  return res.json();
}

export async function getLeagues(): Promise<{ leagues: { league_id: number; name: string }[] }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/leagues`);
  if (!res.ok) throw new Error(`leagues failed: ${res.status}`);
  return res.json();
}

export async function getLeagueSeasons(leagueId: number): Promise<{
  league_id: number;
  league: string;
  country: string;
  seasons: LeagueSeason[];
}> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/leagues/${leagueId}/seasons`);
  if (!res.ok) throw new Error(`seasons failed: ${res.status}`);
  return res.json();
}

export async function getStandings(
  leagueId: number,
  seasonId?: number | null
): Promise<{
  league_id: number;
  league: string;
  country?: string;
  standings: StandingsRow[] | null;
  groups: StandingsGroup[] | null;
}> {
  const qs = seasonId != null ? `&season_id=${seasonId}` : '';
  const res = await fetch(`${PRODUCTION_API_URL}/api/standings?league_id=${leagueId}${qs}`);
  if (!res.ok) throw new Error(`standings failed: ${res.status}`);
  return res.json();
}

export async function getLeagueFixtures(
  leagueId: number,
  seasonId?: number | null
): Promise<{ league_id: number; matches: MatchSummary[] }> {
  const qs = seasonId != null ? `?season_id=${seasonId}` : '';
  const res = await fetch(`${PRODUCTION_API_URL}/api/leagues/${leagueId}/fixtures${qs}`);
  if (!res.ok) throw new Error(`league fixtures failed: ${res.status}`);
  return res.json();
}

export async function getLeagueTopStats(
  leagueId: number,
  seasonId?: number | null
): Promise<{
  league_id: number;
  scorers: TopStatPlayer[];
  assists: TopStatPlayer[];
  ratings: TopStatPlayer[];
  cards: TopStatPlayer[];
}> {
  const qs = seasonId != null ? `?season_id=${seasonId}` : '';
  const res = await fetch(`${PRODUCTION_API_URL}/api/leagues/${leagueId}/top-stats${qs}`);
  if (!res.ok) throw new Error(`top stats failed: ${res.status}`);
  return res.json();
}

export async function getLeagueTeamStats(
  leagueId: number,
  seasonId?: number | null
): Promise<{
  league_id: number;
  goals_per_match: any[];
  conceded_per_match: any[];
  clean_sheets: any[];
  win_rate: any[];
  possession: any[];
}> {
  const qs = seasonId != null ? `?season_id=${seasonId}` : '';
  const res = await fetch(`${PRODUCTION_API_URL}/api/leagues/${leagueId}/team-stats${qs}`);
  if (!res.ok) throw new Error(`team stats failed: ${res.status}`);
  return res.json();
}

export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/teams/${teamId}`);
  if (!res.ok) throw new Error(`team detail failed: ${res.status}`);
  return res.json();
}

export async function getTeamFixtures(teamId: number): Promise<{
  team_id: number;
  recent: MatchSummary[];
  upcoming: MatchSummary[];
  matches: MatchSummary[];
}> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/teams/${teamId}/fixtures`);
  if (!res.ok) throw new Error(`team fixtures failed: ${res.status}`);
  return res.json();
}

export async function getPlayerDetail(playerId: number): Promise<PlayerDetail> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/players/${playerId}/profile`);
  if (!res.ok) throw new Error(`player detail failed: ${res.status}`);
  return res.json();
}

export async function getNews(): Promise<{ news: NewsItem[] }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/news`);
  if (!res.ok) throw new Error(`news failed: ${res.status}`);
  return res.json();
}

export async function getMe(): Promise<{ user: ScoutUser }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/auth/me`, {
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  return res.json();
}

export async function updateLanguage(language: string): Promise<void> {
  await fetch(`${PRODUCTION_API_URL}/api/me/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ language }),
  });
}

export async function getMatchRatings(
  source: 'bsd' | 'local', matchRef: string | number
): Promise<MatchRatings> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/ratings/${source}/${matchRef}`);
  if (!res.ok) throw new Error(`ratings failed: ${res.status}`);
  return res.json();
}

export async function getMyVotes(
  source: 'bsd' | 'local', matchRef: string | number
): Promise<MyVotes> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/ratings/${source}/${matchRef}/mine`, {
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`my votes failed: ${res.status}`);
  return res.json();
}

export async function ratePlayer(
  source: 'bsd' | 'local', matchRef: string | number, playerRef: string | number, score: number
): Promise<unknown> {
  const res = await fetch(
    `${PRODUCTION_API_URL}/api/ratings/${source}/${matchRef}/players/${playerRef}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ score }),
    }
  );
  if (!res.ok) throw new Error(`rating failed: ${res.status}`);
  return res.json();
}

export async function voteMotm(
  source: 'bsd' | 'local', matchRef: string | number, playerRef: string
): Promise<unknown> {
  const res = await fetch(
    `${PRODUCTION_API_URL}/api/ratings/${source}/${matchRef}/motm`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ player_ref: playerRef }),
    }
  );
  if (!res.ok) throw new Error(`motm vote failed: ${res.status}`);
  return res.json();
}

export async function registerPushToken(
  expoPushToken: string,
  followedMatches?: string[]
): Promise<void> {
  await fetch(`${PRODUCTION_API_URL}/api/me/push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      expo_push_token: expoPushToken,
      ...(followedMatches ? { followed_matches: followedMatches } : {}),
    }),
  });
}