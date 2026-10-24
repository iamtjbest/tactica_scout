// src/services/api.ts — the editor's client for the Scout backend.
//
// Mirrors editor-web/lib/api.ts endpoint for endpoint, so the two
// editors can never drift into disagreeing about the API. The only
// difference is that the base URL is resolved per request (getApiBase),
// because the mobile app lets you repoint it at a local backend at
// runtime.
//
// Authorization is enforced server-side in app/routers/editor.py.
// Hiding a button here is a courtesy, never a security boundary.
import { authHeaders } from "./auth";
import { getApiBase } from "./base";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = await getApiBase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as any)?.detail || `Request failed (${res.status})`);
  }
  return body as T;
}

// ── types ─────────────────────────────────────────────────────────────
export type TournamentStatus =
  | "draft" | "pending" | "approved" | "rejected" | "unpublished";

export type Tournament = {
  id: string;
  name: string;
  level: string;
  gender: string;
  country: string;
  start_date: string;
  end_date: string;
  format: "league" | "knockout" | "groups_knockout";
  organizing_body: string;
  organizer_phone: string;
  status: TournamentStatus;
  crest_url: string | null;
  contact_email: string | null;
  tiebreakers: string[] | null;
  points_rules: PointsRules | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  created_at: string;
};

export type Club = {
  id: string; name: string; short_name: string | null;
  crest_url: string | null; institution: string | null;
};

export type TeamRow = {
  id: string; club_id: string; group_name: string | null;
  home_color: string | null; away_color: string | null;
  clubs: Club | null;
};

export type Fixture = {
  id: string; round: string | null; group_name: string | null;
  home_team_id: string; away_team_id: string;
  kickoff_at: string; venue: string | null;
  status: "scheduled" | "live" | "ht" | "ft" | "postponed" | "cancelled";
  home_score: number | null; away_score: number | null;
  ht_home_score: number | null; ht_away_score: number | null;
};

export type Proof = {
  id: string; type: "link" | "document" | "screenshot";
  url: string; note: string | null;
};

export type Readiness = {
  ready: boolean;
  missing: string[];
  counts: { teams: number; fixtures: number; proofs: number };
};

export type MatchEvent = {
  id: string; type: string; minute: number | null;
  tournament_team_id: string;
  players?: { id: string; first_name: string; last_name: string } | null;
};

export type Billing = {
  plan: string;
  image_quota: number | null;
  images_used: number | null;
  remaining: number | null;
  unlimited: boolean;
  plans: { id: string; naira: number; images: number | null; label: string }[];
};

// ── tournaments ───────────────────────────────────────────────────────
export const listTournaments = () =>
  req<{ count: number; tournaments: Tournament[] }>("/api/editor/tournaments");

export const createTournament = (body: Record<string, unknown>) =>
  req<Tournament>("/api/editor/tournaments", {
    method: "POST", body: JSON.stringify(body),
  });

export const getTournament = (id: string) =>
  req<{
    tournament: Tournament; teams: TeamRow[];
    proofs: Proof[]; fixtures: Fixture[];
    counts: { teams: number; fixtures: number };
  }>(`/api/editor/tournaments/${id}`);

export const updateTournament = (id: string, body: Record<string, unknown>) =>
  req<Tournament>(`/api/editor/tournaments/${id}`, {
    method: "PATCH", body: JSON.stringify(body),
  });

export const deleteTournament = (id: string) =>
  req<void>(`/api/editor/tournaments/${id}`, { method: "DELETE" });

// ── teams & players ───────────────────────────────────────────────────
export const searchClubs = (q: string) =>
  req<{ clubs: Club[] }>(`/api/editor/clubs?q=${encodeURIComponent(q)}`);

export const addTeam = (tid: string, body: Record<string, unknown>) =>
  req<TeamRow>(`/api/editor/tournaments/${tid}/teams`, {
    method: "POST", body: JSON.stringify(body),
  });

export const removeTeam = (tid: string, teamId: string) =>
  req<void>(`/api/editor/tournaments/${tid}/teams/${teamId}`, { method: "DELETE" });

export const searchPlayers = (q: string) =>
  req<{ players: any[] }>(`/api/editor/players?q=${encodeURIComponent(q)}`);

export const listSquad = (teamId: string) =>
  req<{ count: number; squad: any[] }>(`/api/editor/teams/${teamId}/players`);

export const registerPlayer = (teamId: string, body: Record<string, unknown>) =>
  req<any>(`/api/editor/teams/${teamId}/players`, {
    method: "POST", body: JSON.stringify(body),
  });

export const unregisterPlayer = (teamId: string, regId: string) =>
  req<void>(`/api/editor/teams/${teamId}/players/${regId}`, { method: "DELETE" });

// ── fixtures ──────────────────────────────────────────────────────────
export const generateFixtures = (tid: string, body: Record<string, unknown>) =>
  req<{ created: number; fixtures: Fixture[]; notes: string[] }>(
    `/api/editor/tournaments/${tid}/fixtures/generate`,
    { method: "POST", body: JSON.stringify(body) }
  );

export const clearFixtures = (tid: string) =>
  req<{ cleared: boolean }>(`/api/editor/tournaments/${tid}/fixtures`, {
    method: "DELETE",
  });

export const addFixture = (tid: string, body: Record<string, unknown>) =>
  req<Fixture>(`/api/editor/tournaments/${tid}/fixtures`, {
    method: "POST", body: JSON.stringify(body),
  });

export const updateFixture = (fid: string, body: Record<string, unknown>) =>
  req<Fixture>(`/api/editor/fixtures/${fid}`, {
    method: "PATCH", body: JSON.stringify(body),
  });

export const setScore = (fid: string, body: Record<string, unknown>) =>
  req<Fixture>(`/api/editor/fixtures/${fid}/score`, {
    method: "PATCH", body: JSON.stringify(body),
  });

export const listEvents = (fid: string) =>
  req<{ count: number; events: MatchEvent[] }>(`/api/editor/fixtures/${fid}/events`);

export const addEvent = (fid: string, body: Record<string, unknown>) =>
  req<{
    event: MatchEvent;
    score_from_events: { home: number; away: number };
    scoreboard: { home: number | null; away: number | null };
  }>(`/api/editor/fixtures/${fid}/events`, {
    method: "POST", body: JSON.stringify(body),
  });

export const deleteEvent = (fid: string, eid: string) =>
  req<void>(`/api/editor/fixtures/${fid}/events/${eid}`, { method: "DELETE" });

// ── review ────────────────────────────────────────────────────────────
export const listProofs = (tid: string) =>
  req<{ proofs: Proof[] }>(`/api/editor/tournaments/${tid}/proofs`);

export const addProof = (tid: string, body: Record<string, unknown>) =>
  req<Proof>(`/api/editor/tournaments/${tid}/proofs`, {
    method: "POST", body: JSON.stringify(body),
  });

export const deleteProof = (tid: string, pid: string) =>
  req<void>(`/api/editor/tournaments/${tid}/proofs/${pid}`, { method: "DELETE" });

export const getReadiness = (tid: string) =>
  req<Readiness>(`/api/editor/tournaments/${tid}/readiness`);

export const submitForReview = (tid: string) =>
  req<Tournament>(`/api/editor/tournaments/${tid}/submit`, { method: "POST" });

export const unpublish = (tid: string) =>
  req<Tournament>(`/api/editor/tournaments/${tid}/unpublish`, { method: "POST" });

// ── admin ─────────────────────────────────────────────────────────────
export const reviewQueue = (status = "pending") =>
  req<{ count: number; tournaments: any[] }>(
    `/api/editor/admin/review-queue?status=${status}`
  );

export const reviewTournament = (tid: string, approve: boolean, reason?: string) =>
  req<Tournament>(`/api/editor/admin/tournaments/${tid}/review`, {
    method: "POST", body: JSON.stringify({ approve, reason }),
  });

// ── billing ───────────────────────────────────────────────────────────
export const getBilling = () => req<Billing>("/api/billing/me");

export const startCheckout = (plan: string) =>
  req<{ authorization_url: string; reference: string; amount_naira: number }>(
    "/api/billing/checkout",
    { method: "POST", body: JSON.stringify({ plan }) }
  );

export const verifyPayment = (reference: string) =>
  req<{ paid: boolean; applied?: boolean; plan?: string }>(
    `/api/billing/verify/${reference}`, { method: "POST" }
  );

export const canGenerate = () =>
  req<{ allowed: boolean; remaining: number | null; unlimited: boolean }>(
    "/api/billing/can-generate"
  );

// ── standings and round ordering ──────────────────────────────────────
// Crest UPLOAD is deliberately web-only: setting a club up is desk
// work, and the mobile editor is for running the match. Mobile still
// renders whatever crest the web editor set.

export type StandingRow = {
  team_id: string; name: string; crest_url: string | null;
  position: number; played: number; won: number; drawn: number; lost: number;
  goals_for: number; goals_against: number; goal_difference: number;
  points: number; form: string[];
};

export const getStandings = (tid: string) =>
  req<{
    grouped: boolean;
    standings?: StandingRow[];
    group_tables?: Record<string, StandingRow[]>;
  }>(`/api/editor/tournaments/${tid}/standings`);

/** Knockout rounds biggest-first, so rounds read in playing order.
 *  Must match editor-web's list exactly: the two editors showing a
 *  bracket in different orders would be its own bug. */
export const KNOCKOUT_ORDER = [
  "Round of 64", "Round of 32", "Round of 16",
  "Quarter-final", "Semi-final", "Final",
];

export function sortRounds(rounds: string[]): string[] {
  const known = KNOCKOUT_ORDER.filter((r) => rounds.includes(r));
  const rest = rounds
    .filter((r) => !KNOCKOUT_ORDER.includes(r))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] ?? NaN);
      const nb = Number(b.match(/\d+/)?.[0] ?? NaN);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  return [...rest, ...known];
}

// ── joining someone else's tournament ─────────────────────────────────
// Mobile is where a match commissioner lives, so redeeming a code is
// here. Creating and managing codes is web-only: that's the owner at a
// desk, not someone at the side of a pitch.

export type TRole = "owner" | "editor";

export const joinWithCode = (code: string) =>
  req<{
    joined: boolean; already: boolean;
    tournament_id: string; tournament_name: string; role: TRole;
  }>("/api/editor/join", { method: "POST", body: JSON.stringify({ code }) });

export type Member = {
  id: string; user_id: string; role: TRole;
  profiles: { id: string; email: string | null; display_name: string | null } | null;
};

export const listMembers = (tid: string) =>
  req<{ count: number; members: Member[] }>(`/api/editor/tournaments/${tid}/members`);

// ── parity with the web editor ────────────────────────────────────────
// Everything below mirrors editor-web/lib/api.ts one for one. Same
// names, same shapes: if the two drift, the mobile app quietly stops
// showing something the web app has.

export type PointsRules = { win: number; draw: number; loss: number };

export const TIEBREAKERS: { id: string; label: string; implemented: boolean }[] = [
  { id: "goal_difference", label: "Goal difference", implemented: true },
  { id: "goals_scored",    label: "Goals scored",    implemented: true },
  { id: "wins",            label: "Wins",            implemented: true },
  { id: "head_to_head",    label: "Head to head",    implemented: false },
];

export type Venue = {
  id: string; tournament_id: string; name: string;
  address: string | null; city: string | null; capacity: number | null;
};

export type SubCompKind = "league" | "group" | "knockout" | "playoff";

export type SubCompetition = {
  id: string; tournament_id: string; name: string;
  kind: SubCompKind; sort_order: number; teams: TeamRow[];
};

export type Suspension = {
  id: string; tournament_id: string; tournament_team_id: string;
  player_id: string; matches: number; start_date: string;
  reason: string | null; active: boolean;
  players: { id: string; first_name: string; last_name: string } | null;
  tournament_teams: { id: string; clubs: Club | null } | null;
};

export const SUB_KINDS: { id: SubCompKind; label: string }[] = [
  { id: "group",    label: "Group" },
  { id: "league",   label: "League" },
  { id: "knockout", label: "Knockout" },
  { id: "playoff",  label: "Playoff" },
];

export const listVenues = (tid: string) =>
  req<{ count: number; venues: Venue[] }>(`/api/editor/tournaments/${tid}/venues`);

export const addVenue = (tid: string, body: Record<string, unknown>) =>
  req<Venue>(`/api/editor/tournaments/${tid}/venues`, {
    method: "POST", body: JSON.stringify(body),
  });

export const updateVenue = (tid: string, venueId: string, body: Record<string, unknown>) =>
  req<Venue>(`/api/editor/tournaments/${tid}/venues/${venueId}`, {
    method: "PATCH", body: JSON.stringify(body),
  });

export const deleteVenue = (tid: string, venueId: string) =>
  req<void>(`/api/editor/tournaments/${tid}/venues/${venueId}`, { method: "DELETE" });

export const listSubCompetitions = (tid: string) =>
  req<{ count: number; sub_competitions: SubCompetition[]; unassigned: TeamRow[] }>(
    `/api/editor/tournaments/${tid}/sub-competitions`);

export const addSubCompetition = (tid: string, body: Record<string, unknown>) =>
  req<SubCompetition>(`/api/editor/tournaments/${tid}/sub-competitions`, {
    method: "POST", body: JSON.stringify(body),
  });

export const deleteSubCompetition = (tid: string, subId: string) =>
  req<void>(`/api/editor/tournaments/${tid}/sub-competitions/${subId}`, { method: "DELETE" });

export const assignTeams = (tid: string, subId: string, teamIds: string[]) =>
  req<{ assigned: number }>(`/api/editor/tournaments/${tid}/sub-competitions/${subId}/teams`, {
    method: "POST", body: JSON.stringify({ team_ids: teamIds }),
  });

export const unassignTeam = (tid: string, teamId: string) =>
  req<TeamRow>(`/api/editor/tournaments/${tid}/teams/${teamId}/sub-competition`,
    { method: "DELETE" });

export const listSuspensions = (tid: string, includeServed = false) =>
  req<{ count: number; suspensions: Suspension[] }>(
    `/api/editor/tournaments/${tid}/suspensions?include_served=${includeServed}`);

export const addSuspension = (tid: string, body: Record<string, unknown>) =>
  req<Suspension>(`/api/editor/tournaments/${tid}/suspensions`, {
    method: "POST", body: JSON.stringify(body),
  });

export const markServed = (tid: string, sid: string) =>
  req<Suspension>(`/api/editor/tournaments/${tid}/suspensions/${sid}/served`,
    { method: "POST" });

export const deleteSuspension = (tid: string, sid: string) =>
  req<void>(`/api/editor/tournaments/${tid}/suspensions/${sid}`, { method: "DELETE" });

export type Invite = {
  id: string; code: string; role: TRole; uses: number;
  max_uses: number | null; expires_at: string | null; revoked: boolean;
};

export type AccessRequest = {
  id: string; user_id: string; message: string | null;
  role_requested: TRole; status: string;
  profiles?: { email?: string; full_name?: string } | null;
};

export const listInvites = (tid: string) =>
  req<{ invites: Invite[] }>(`/api/editor/tournaments/${tid}/invites`);

export const createInvite = (tid: string, role: TRole = "editor") =>
  req<Invite>(`/api/editor/tournaments/${tid}/invites`, {
    method: "POST", body: JSON.stringify({ role }),
  });

export const revokeInvite = (tid: string, inviteId: string) =>
  req<Invite>(`/api/editor/tournaments/${tid}/invites/${inviteId}/revoke`,
    { method: "POST" });

export const listRequests = (tid: string, status = "pending") =>
  req<{ requests: AccessRequest[] }>(
    `/api/editor/tournaments/${tid}/requests?status=${status}`);

export const decideRequest = (tid: string, reqId: string, approve: boolean) =>
  req<AccessRequest>(`/api/editor/tournaments/${tid}/requests/${reqId}/decide`, {
    method: "POST", body: JSON.stringify({ approve }),
  });

export const removeMember = (tid: string, memberId: string) =>
  req<void>(`/api/editor/tournaments/${tid}/members/${memberId}`, { method: "DELETE" });

// ── dashboard & inbox ─────────────────────────────────────────────────

export type DashFixture = {
  id: string; tournament_id: string; tournament_name: string | null;
  round: string | null; group_name: string | null;
  kickoff_at: string; venue: string | null; status: string;
  home_score: number | null; away_score: number | null;
  home: { name: string; crest_url: string | null };
  away: { name: string; crest_url: string | null };
};

export type Dashboard = {
  counts: Record<string, number>;
  total: number;
  live: DashFixture[];
  upcoming: DashFixture[];
  recent: DashFixture[];
  needs_attention: {
    tournament_id: string; name: string; kind: string; detail: string;
  }[];
  open_requests: number;
};

export type InboxData = {
  requests: (AccessRequest & { tournament_name: string | null })[];
  decisions: {
    tournament_id: string; tournament_name: string;
    status: string; reviewed_at: string | null; reason: string | null;
  }[];
  unread: number;
};

export const getDashboard = () => req<Dashboard>("/api/editor/dashboard");
export const getInbox = () => req<InboxData>("/api/editor/inbox");

// ── team sheets ───────────────────────────────────────────────────────
// Who actually played in a fixture. Mirrors editor-web/lib/api.ts. The
// sheet is what Scout rates: before it existed the only rateable
// players were the ones who picked up a goal or a card.

export type SheetEntry = {
  id: string;
  player_id: string;
  tournament_team_id: string;
  role: 'starter' | 'substitute';
  shirt_number: number | null;
  position: string | null;
  players: { id: string; first_name: string; last_name: string } | null;
};

export type SquadEntry = {
  id: string;
  jersey_number: number | null;
  position: string | null;
  players: { id: string; first_name: string; last_name: string } | null;
};

export type SideSheet = {
  tournament_team_id: string;
  formation: string | null;
  starters: SheetEntry[];
  substitutes: SheetEntry[];
  squad: SquadEntry[];
};

export type FixtureLineup = {
  fixture: Fixture;
  lineups: { home: SideSheet; away: SideSheet };
};

export const getLineup = (fixtureId: string) =>
  req<FixtureLineup>(`/api/editor/fixtures/${fixtureId}/lineup`);

export const setLineup = (fixtureId: string, body: {
  tournament_team_id: string;
  formation?: string | null;
  starters: { player_id: string; shirt_number?: number | null; position?: string | null }[];
  substitutes: { player_id: string; shirt_number?: number | null; position?: string | null }[];
}) =>
  req<FixtureLineup>(`/api/editor/fixtures/${fixtureId}/lineup`, {
    method: 'PUT', body: JSON.stringify(body),
  });

export const clearLineup = (fixtureId: string, teamId: string) =>
  req<void>(`/api/editor/fixtures/${fixtureId}/lineup/${teamId}`, { method: 'DELETE' });
