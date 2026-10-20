// lib/api.ts — the editor's client for the Scout backend.
//
// Same backend and same Supabase project as Scout. Every call here is
// authenticated: the editor has no anonymous surface, because every
// endpoint behind it either reads or changes a tournament somebody
// owns.
//
// Authorization is enforced server-side in app/routers/editor.py, not
// here. Hiding a button is a courtesy to the user, never a security
// boundary.
import { authHeaders } from "./auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI puts the useful message in `detail`. Surfacing it beats a
    // bare status code, because most failures here are rules the user
    // can actually fix: wrong status, duplicate shirt number, not ready
    // to submit.
    throw new Error(
      (body as any)?.detail || `Request failed (${res.status})`
    );
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
  contact_email: string | null;
  start_date: string;
  end_date: string;
  format: "league" | "knockout" | "groups_knockout";
  organizing_body: string;
  organizer_phone: string;
  status: TournamentStatus;
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

// ── crests, bulk draws, standings ─────────────────────────────────────

/** Upload goes through our backend, not straight to Supabase Storage:
 *  the bucket is written with the service role key, which must never
 *  reach a browser. */
export async function uploadCrest(clubId: string, file: File) {
  const { authHeaders } = await import("./auth");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/editor/clubs/${clubId}/crest`, {
    method: "POST",
    // No Content-Type header: the browser must set the multipart
    // boundary itself, and setting it by hand breaks the upload.
    headers: { ...(await authHeaders()) },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.detail || `Upload failed (${res.status})`);
  return body as { crest_url: string };
}

export const removeCrest = (clubId: string) =>
  req<{ club: Club }>(`/api/editor/clubs/${clubId}/crest`, { method: "DELETE" });

export const bulkFixtures = (
  tid: string,
  fixtures: Record<string, unknown>[],
  replace = false
) =>
  req<{ created: number; fixtures: Fixture[] }>(
    `/api/editor/tournaments/${tid}/fixtures/bulk`,
    { method: "POST", body: JSON.stringify({ fixtures, replace }) }
  );

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

/** Knockout rounds, biggest first, so a bracket draws left to right.
 *  Anything unrecognised keeps its own order at the end rather than
 *  being dropped. */
export const KNOCKOUT_ORDER = [
  "Round of 64", "Round of 32", "Round of 16",
  "Quarter-final", "Semi-final", "Final",
];

export function sortRounds(rounds: string[]): string[] {
  const known = KNOCKOUT_ORDER.filter((r) => rounds.includes(r));
  const rest = rounds
    .filter((r) => !KNOCKOUT_ORDER.includes(r))
    .sort((a, b) => {
      // "Matchday 2" before "Matchday 10": numeric, not lexical.
      const na = Number(a.match(/\d+/)?.[0] ?? NaN);
      const nb = Number(b.match(/\d+/)?.[0] ?? NaN);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  return [...rest, ...known];
}

// ── members, invites, access requests ─────────────────────────────────
// A tournament isn't one person's any more: two or three concurrent
// matches need a commissioner on each. Two roles:
//   editor  match details only - scoreline, goalscorers, assists,
//           cards, substitutions. The match commissioner.
//   owner   the tournament itself, plus everything an editor can do.

export type TRole = "owner" | "editor";

export type Member = {
  id: string; user_id: string; role: TRole; created_at: string;
  profiles: { id: string; email: string | null; display_name: string | null } | null;
};

export type Invite = {
  id: string; code: string; role: TRole; join_url: string;
  expires_at: string | null; max_uses: number | null; uses: number;
  revoked: boolean; created_at: string;
};

export type AccessRequest = {
  id: string; user_id: string; message: string | null;
  role_requested: TRole; status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles: { id: string; email: string | null; display_name: string | null } | null;
};

export const listMembers = (tid: string) =>
  req<{ count: number; members: Member[] }>(`/api/editor/tournaments/${tid}/members`);

export const changeMemberRole = (tid: string, memberId: string, role: TRole) =>
  req<Member>(`/api/editor/tournaments/${tid}/members/${memberId}`, {
    method: "PATCH", body: JSON.stringify({ role }),
  });

export const removeMember = (tid: string, memberId: string) =>
  req<void>(`/api/editor/tournaments/${tid}/members/${memberId}`, { method: "DELETE" });

export const listInvites = (tid: string) =>
  req<{ count: number; invites: Invite[] }>(`/api/editor/tournaments/${tid}/invites`);

export const createInvite = (
  tid: string,
  body: { role: TRole; expires_in_hours?: number | null; max_uses?: number | null }
) =>
  req<{ invite: Invite; code: string; join_url: string }>(
    `/api/editor/tournaments/${tid}/invites`,
    { method: "POST", body: JSON.stringify(body) }
  );

export const revokeInvite = (tid: string, inviteId: string) =>
  req<{ revoked: boolean }>(`/api/editor/tournaments/${tid}/invites/${inviteId}`, {
    method: "DELETE",
  });

export const joinWithCode = (code: string) =>
  req<{
    joined: boolean; already: boolean;
    tournament_id: string; tournament_name: string; role: TRole;
  }>("/api/editor/join", { method: "POST", body: JSON.stringify({ code }) });

export const listRequests = (tid: string, status = "pending") =>
  req<{ count: number; requests: AccessRequest[] }>(
    `/api/editor/tournaments/${tid}/requests?status=${status}`
  );

export const decideRequest = (
  tid: string, requestId: string, approve: boolean, role?: TRole
) =>
  req<{ request: AccessRequest; granted_role: TRole | null }>(
    `/api/editor/tournaments/${tid}/requests/${requestId}`,
    { method: "POST", body: JSON.stringify({ approve, role }) }
  );

export const requestAccess = (tid: string, message?: string, role_requested: TRole = "editor") =>
  req<{ requested: boolean; already: boolean; owner_emailed?: boolean }>(
    `/api/editor/tournaments/${tid}/request-access`,
    { method: "POST", body: JSON.stringify({ message, role_requested }) }
  );
