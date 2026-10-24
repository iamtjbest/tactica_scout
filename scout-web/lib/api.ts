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
  /** "local" marks a competition run in Scout Editor. It groups in the
   *  feed exactly like a BSD league; this only changes where a tap goes
   *  and whether the heading links to a BSD league page. */
  source?: "local";
  tournament_id?: string;
};

export type MatchSummary = {
  /** BSD event id (number) or, for a local competition, the fixture
   *  uuid (string). The `source` field says which. */
  event_id: number | string | null;
  /** "local" for a competition run in Scout Editor; absent for BSD. */
  source?: "local";
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
  /** Opponent's team id, for the crest. Null where BSD didn't give one. */
  opponent_id: number | null;
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
  /** Facts live at their own endpoint; see getMatchFacts. */
  facts_url?: string;
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

export type NewsSources = {
  medium: { handle: string; count: number; error: string | null };
  x: { count: number; error: string | null };
};

export async function getNews(): Promise<{
  count: number;
  items: NewsItem[];
  sources?: NewsSources;
}> {
  // Render's free tier sleeps when idle and takes roughly a minute to
  // wake. Without a timeout the News tab sat on "Loading news..."
  // indefinitely with no way to tell a cold start from a dead backend.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 75_000);
  try {
    const res = await fetch(`${API_BASE}/api/news`, {
      cache: "no-store",
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`news failed: ${res.status}`);
    return await res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(
        "The backend didn't respond in time. It may be waking up from idle, try again in a minute."
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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

// ── Player career / transfers / international / season totals ─────────
// Wrappers for the four endpoints added to players.py. Each one can come
// back `degraded: true`, which means BSD gave us nothing on this request
// -- distinct from a genuinely empty record. The UI must tell those apart
// so a player page never claims a 15-year veteran has no career just
// because one fetch failed.

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
  // null means undisclosed, NOT free. BSD is explicit that a move with
  // no published figure is not a fee of zero.
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
  const res = await fetch(`${API_BASE}/api/players/${playerId}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
  return res.json();
}

export function getPlayerCareer(
  playerId: number
): Promise<{ seasons: PlayerCareerSeason[]; degraded: boolean }> {
  return playerSub(playerId, "career", "player career");
}

export function getPlayerTransfers(
  playerId: number
): Promise<{ transfers: PlayerTransfer[]; degraded: boolean }> {
  return playerSub(playerId, "transfers", "player transfers");
}

export function getPlayerNationalTeam(
  playerId: number
): Promise<{ teams: any[]; summary: any | null; degraded: boolean }> {
  return playerSub(playerId, "national-team", "player national team");
}

export function getPlayerSeasonStats(
  playerId: number,
  season?: string
): Promise<PlayerSeasonStats> {
  const q = season ? `season-stats?season=${encodeURIComponent(season)}` : "season-stats";
  return playerSub(playerId, q, "player season stats");
}

/** Format a transfer fee. Undisclosed is not zero -- see PlayerTransfer. */
export function formatFee(fee: number | null | undefined): string {
  if (fee == null) return "Undisclosed";
  if (fee === 0) return "Free";
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
  const res = await fetch(`${API_BASE}/api/matches/${eventId}/facts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`match facts failed: ${res.status}`);
  return res.json();
}

// ── Crowd ratings & Man of the Match ─────────────────────────────────
// Works for BSD matches and for local tournaments run in the editor.
// `source` is the discriminator: 'bsd' match refs are the numeric event
// id, 'local' ones are the fixture uuid.

export type RatingSource = "bsd" | "local";

export type RatingWindow = {
  open: boolean;
  reason: string | null;
  opens_at_minute?: number;
  closes_at?: string | null;
};

export type PlayerRating = {
  player_ref: string;
  votes: number;
  /** Withheld until `min_votes` people have rated, so one person can't
   *  publish a number against a named player on their own. */
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
  const res = await fetch(`${API_BASE}/api/ratings/${source}/${matchRef}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseErr(res, `ratings failed: ${res.status}`));
  return res.json();
}

export async function getMyVotes(
  source: RatingSource, matchRef: string | number
): Promise<MyVotes> {
  const res = await fetch(`${API_BASE}/api/ratings/${source}/${matchRef}/mine`, {
    cache: "no-store",
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(await parseErr(res, `my votes failed: ${res.status}`));
  return res.json();
}

export async function ratePlayer(
  source: RatingSource, matchRef: string | number, playerRef: string | number, score: number
): Promise<unknown> {
  const res = await fetch(
    `${API_BASE}/api/ratings/${source}/${matchRef}/players/${playerRef}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ score }),
    }
  );
  if (!res.ok) throw new Error(await parseErr(res, `rating failed: ${res.status}`));
  return res.json();
}

export async function voteMotm(
  source: RatingSource, matchRef: string | number, playerRef: string | number
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/ratings/${source}/${matchRef}/motm`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ player_ref: String(playerRef) }),
  });
  if (!res.ok) throw new Error(await parseErr(res, `MOTM vote failed: ${res.status}`));
  return res.json();
}

// ── Local tournaments ────────────────────────────────────────────────
// Competitions run in Scout Editor and approved for publication. Served
// by tournaments_public.py, which only ever returns approved ones.

export type TournamentSummary = {
  id: string;
  name: string;
  level: string;
  gender: string;
  country: string;
  start_date: string;
  end_date: string;
  format: "league" | "knockout" | "groups_knockout";
  organizing_body: string;
};

export type TournamentTeam = {
  team_id: string;
  club_id: string | null;
  name: string;
  short_name: string | null;
  crest_url: string | null;
  group_name: string | null;
};

export type TournamentFixture = {
  id: string;
  round: string | null;
  group_name: string | null;
  kickoff_at: string;
  venue: string | null;
  status: string;
  home_team: string | null;
  home_crest: string | null;
  home_team_id: string;
  away_team: string | null;
  away_crest: string | null;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

export type TournamentStanding = {
  team_id: string;
  name: string;
  short_name: string | null;
  crest_url: string | null;
  group_name: string | null;
  played: number; won: number; drawn: number; lost: number;
  goals_for: number; goals_against: number; goal_difference: number;
  points: number; form: string[]; position: number;
};

export type TournamentDetail = {
  tournament: TournamentSummary & { tiebreakers?: string[] | null };
  teams: TournamentTeam[];
  fixtures: TournamentFixture[];
  standings: TournamentStanding[] | null;
  group_tables: Record<string, TournamentStanding[]> | null;
  tiebreakers_applied: string[];
  points_rules?: { win: number; draw: number; loss: number };
};

export type TournamentMatchEvent = {
  id: string;
  type: string;
  minute: number | null;
  tournament_team_id: string;
  side: "home" | "away";
  players: { id: string; first_name: string; last_name: string } | null;
};

export type TournamentSheetPlayer = {
  player_id: string;
  name: string;
  shirt_number: number | null;
  position: string | null;
};

export type TournamentSheet = {
  formation: string | null;
  starters: TournamentSheetPlayer[];
  substitutes: TournamentSheetPlayer[];
};

export type TournamentMatch = {
  fixture: TournamentFixture & { tournament_id: string };
  /** The team sheet the organiser entered. Empty arrays when they
   *  haven't entered one yet; `lineup_status` says which. */
  lineups: { home: TournamentSheet; away: TournamentSheet };
  lineup_status: "confirmed" | "unavailable";
  events: TournamentMatchEvent[];
};

export async function getTournaments(
  opts: { country?: string; level?: string } = {}
): Promise<{ count: number; tournaments: TournamentSummary[] }> {
  const q = new URLSearchParams();
  if (opts.country) q.set("country", opts.country);
  if (opts.level) q.set("level", opts.level);
  const qs = q.toString();
  const res = await fetch(`${API_BASE}/api/tournaments${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseErr(res, `tournaments failed: ${res.status}`));
  return res.json();
}

export async function getTournament(id: string): Promise<TournamentDetail> {
  const res = await fetch(`${API_BASE}/api/tournaments/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseErr(res, `tournament failed: ${res.status}`));
  return res.json();
}

export async function getTournamentMatch(
  tournamentId: string, fixtureId: string
): Promise<TournamentMatch> {
  const res = await fetch(
    `${API_BASE}/api/tournaments/${tournamentId}/fixtures/${fixtureId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(await parseErr(res, `fixture failed: ${res.status}`));
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
  const res = await fetch(
    `${API_BASE}/api/tournaments/${tournamentId}/players/${playerId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(await parseErr(res, `player failed: ${res.status}`));
  return res.json();
}
