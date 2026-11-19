// src/services/api.ts - Tactica Scout Mobile API client
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

// Types
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
  round?: string | null;
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
  goals?: number | null;
  assists?: number | null;
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

export type RatingSource = 'bsd' | 'local';

export type PlayerSearchResult = {
  id: number;
  name: string;
  position: string;
  current_team: string | null;
  nationality: string;
  rating: number | null;
};

export type PlayerCareerSeason = {
  season?: string | null;
  season_name?: string | null;
  team_name?: string | null;
  team_id?: number | null;
  league_name?: string | null;
  appearances?: number | null;
  goals?: number | null;
  assists?: number | null;
  minutes_played?: number | null;
  [k: string]: any;
};

export type PlayerTransfer = {
  date?: string | null;
  transfer_date?: string | null;
  from_team_name?: string | null;
  to_team_name?: string | null;
  from_team_id?: number | null;
  to_team_id?: number | null;
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

export type PlayerSeasons = {
  player_id: number;
  total_matches_available: number;
  team_blocks: { team_id: number; match_count: number }[];
  note: string;
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
  event_id: number | string;
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
  unavailable_reason?: string;
};

export type MatchRatings = {
  source: string;
  match_ref: string | number;
  window: { open: boolean; closes_at: string | null; reason?: string | null };
  min_votes: number;
  players: {
    player_ref: string;
    player_name: string;
    team_ref: string;
    team_name: string;
    position: string;
    shirt_number: number | null;
    rating: number | null;
    average?: number | null;
    enough_votes?: boolean;
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

// Local Tournament Types
export type TournamentSummary = {
  id: string;
  name: string;
  organizing_body: string;
  country: string;
  format: string;
  start_date: string | null;
  end_date: string | null;
};

export type TournamentFixture = {
  id: string;
  group_name: string | null;
  round: string | null;
  home_team: string | null;
  home_team_id?: string | null;
  home_crest: string | null;
  away_team: string | null;
  away_team_id?: string | null;
  away_crest: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff_at: string | null;
  venue?: string | null;
};

export type TournamentStanding = {
  position: number;
  team_id: string;
  name: string;
  crest_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goal_difference: number;
  points: number;
};

export type TournamentDetail = {
  tournament: TournamentSummary;
  fixtures: TournamentFixture[];
  standings?: TournamentStanding[];
  group_tables?: Record<string, TournamentStanding[]>;
  teams: {
    team_id: string;
    name: string;
    crest_url: string | null;
    group_name?: string | null;
    manager?: string | null;
    stadium?: string | null;
    players?: any[];
  }[];
  top_scorers?: { player_id: string; player_name: string; team_name: string; value: number }[];
  top_assists?: { player_id: string; player_name: string; team_name: string; value: number }[];
  points_rules?: { win: number; draw: number; loss: number };
};

export type TournamentSheetPlayer = {
  player_id: string;
  name: string;
  shirt_number: number | null;
  photo_url: string | null;
  position?: string | null;
};

export type TournamentSheet = {
  formation: string | null;
  starters: TournamentSheetPlayer[];
  substitutes: TournamentSheetPlayer[];
};

export type TournamentMatchEvent = {
  id: string;
  type: string;
  minute: number | null;
  side: 'home' | 'away';
  players?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  } | null;
  related_player?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  } | null;
};

export type TournamentMatchModel = {
  home_win_prob?: number | null;
  draw_prob?: number | null;
  away_win_prob?: number | null;
  home_attack?: number | null;
  home_defence?: number | null;
  away_attack?: number | null;
  away_defence?: number | null;
  home?: { attack?: number | null; defence?: number | null; win_prob?: number | null } | null;
  away?: { attack?: number | null; defence?: number | null; win_prob?: number | null } | null;
};

export type TournamentMatch = {
  fixture: TournamentFixture;
  lineup_status: string;
  lineups: {
    home: TournamentSheet;
    away: TournamentSheet;
  };
  events: TournamentMatchEvent[];
  facts?: TournamentMatchModel | null;
  prediction?: TournamentMatchModel | null;
  model?: TournamentMatchModel | null;
  pre_match_model?: TournamentMatchModel | null;
};

export type TournamentPlayer = {
  player: {
    id: string;
    name: string;
    position: string | null;
    nationality: string | null;
    photo_url: string | null;
    shirt_number: number | null;
  };
  team: {
    id?: string;
    name: string;
    crest_url: string | null;
  };
  stats: {
    appearances: number;
    starts: number;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
  };
};

// Auth Export
export { isSignedIn, signOut } from './auth';

// API Methods

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

export async function getTournaments(): Promise<{ tournaments: TournamentSummary[] }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/tournaments`);
  if (!res.ok) return { tournaments: [] };
  const data = await res.json();
  if (Array.isArray(data)) return { tournaments: data };
  return { tournaments: Array.isArray(data?.tournaments) ? data.tournaments : [] };
}

export async function getTournament(tournamentId: string): Promise<TournamentDetail> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/tournaments/${tournamentId}`);
  if (!res.ok) throw new Error(`tournament failed: ${res.status}`);
  return res.json();
}

export async function getTournamentMatch(
  tournamentId: string,
  fixtureId: string
): Promise<TournamentMatch> {
  const res = await fetch(
    `${PRODUCTION_API_URL}/api/tournaments/${tournamentId}/fixtures/${fixtureId}`
  );
  if (res.ok) return res.json();
  const fallback = await fetch(
    `${PRODUCTION_API_URL}/api/tournaments/${tournamentId}/matches/${fixtureId}`
  );
  if (!fallback.ok) throw new Error(`tournament match failed: ${fallback.status}`);
  return fallback.json();
}

export async function getTournamentMatchFacts(
  tournamentId: string,
  fixtureId: string
): Promise<TournamentMatchModel | null> {
  const urls = [
    `${PRODUCTION_API_URL}/api/tournaments/${tournamentId}/fixtures/${fixtureId}/facts`,
    `${PRODUCTION_API_URL}/api/tournaments/${tournamentId}/matches/${fixtureId}/facts`,
    `${PRODUCTION_API_URL}/api/tournaments/${tournamentId}/fixtures/${fixtureId}/prediction`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { }
  }
  return null;
}

export async function getTournamentTeam(
  tournamentId: string,
  teamId: string
): Promise<any | null> {
  try {
    const res = await fetch(
      `${PRODUCTION_API_URL}/api/tournaments/${tournamentId}/teams/${teamId}`
    );
    if (res.ok) return await res.json();
  } catch { }
  return null;
}

export async function getTournamentPlayer(
  tournamentId: string,
  playerId: string
): Promise<TournamentPlayer> {
  const res = await fetch(
    `${PRODUCTION_API_URL}/api/tournaments/${tournamentId}/players/${playerId}`
  );
  if (!res.ok) throw new Error(`tournament player failed: ${res.status}`);
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

export async function searchPlayers(name: string): Promise<{ results: PlayerSearchResult[] }> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/players/search?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`player search failed: ${res.status}`);
  return res.json();
}

export async function getPlayerProfile(playerId: number): Promise<PlayerDetail> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/players/${playerId}/profile`);
  if (!res.ok) throw new Error(`player profile failed: ${res.status}`);
  return res.json();
}

export async function getPlayerDetail(playerId: number): Promise<PlayerDetail> {
  return getPlayerProfile(playerId);
}

export async function getPlayerSeasons(playerId: number): Promise<PlayerSeasons> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/players/${playerId}/seasons`);
  if (!res.ok) throw new Error(`player seasons failed: ${res.status}`);
  return res.json();
}

export async function getPlayerRadar(
  playerId: number,
  teamId?: number,
  limit = 15
): Promise<{ radar: RadarAxes; matches_used: number }> {
  const apiBase = await getApiBase();
  const params = new URLSearchParams({ limit: String(limit) });
  if (teamId !== undefined) params.set('team_id', String(teamId));
  const res = await fetch(`${apiBase}/api/players/${playerId}/radar?${params}`);
  if (!res.ok) throw new Error(`player radar failed: ${res.status}`);
  return res.json();
}

async function playerSub<T>(playerId: number, path: string, label: string): Promise<T> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/players/${playerId}/${path}`);
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

export function formatFee(fee: number | null | undefined): string {
  if (fee == null) return 'Undisclosed';
  if (fee === 0) return 'Free';
  if (fee >= 1_000_000) return `€${(fee / 1_000_000).toFixed(fee >= 10_000_000 ? 0 : 1)}m`;
  if (fee >= 1_000) return `€${Math.round(fee / 1_000)}k`;
  return `€${fee}`;
}

export async function globalSearch(q: string): Promise<{
  teams?: any[];
  players?: any[];
  leagues?: any[];
  tournaments?: any[];
  matches?: any[];
}> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getNews(): Promise<{ items: NewsItem[]; news: NewsItem[]; sources?: any }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/news`);
  if (!res.ok) throw new Error(`news failed: ${res.status}`);
  const data = await res.json();
  const list = data.items || data.news || [];
  return { items: list, news: list, sources: data.sources };
}

export async function getMe(): Promise<{ user: ScoutUser }> {
  const res = await fetch(`${PRODUCTION_API_URL}/api/auth/me`, {
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  return res.json();
}

export async function updateFollowedTeams(followedTeams: string[]): Promise<void> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${PRODUCTION_API_URL}/api/me/follows`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ followed_teams: followedTeams }),
  });
  if (res.ok) return;

  const fallback = await fetch(`${PRODUCTION_API_URL}/api/me/settings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ followed_teams: followedTeams }),
  });
  if (!fallback.ok) {
    throw new Error(`follow update failed: ${fallback.status}`);
  }
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