"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import Guard from "@/components/Guard";
import StatusPill from "@/components/StatusPill";
import Crest from "@/components/Crest";
import Bracket from "@/components/Bracket";
import StandingsTable from "@/components/StandingsTable";
import AccessTab from "@/components/AccessTab";
import {
  getTournament, getReadiness, submitForReview, unpublish, updateTournament,
  deleteTournament, uploadTournamentCrest, removeTournamentCrest, TIEBREAKERS,
  listVenues, addVenue, updateVenue, deleteVenue,
  listSubCompetitions, addSubCompetition, updateSubCompetition,
  deleteSubCompetition, assignTeams, unassignTeam, SUB_KINDS,
  listSuspensions, addSuspension, markServed, deleteSuspension, listSquad as squadOf,
  type Venue, type SubCompetition, type SubCompKind, type Suspension,
  searchClubs, addTeam, removeTeam,
  generateFixtures, clearFixtures, setScore,
  addProof, deleteProof,
  listSquad, registerPlayer, unregisterPlayer, searchPlayers,
  uploadCrest, removeCrest, bulkFixtures, getStandings, sortRounds,
  type Tournament, type TeamRow, type Fixture, type Proof, type Readiness,
  type StandingRow,
} from "@/lib/api";

/**
 * The competition workspace is organised the way Torneo organises
 * theirs, because that grouping is right: what you do during the
 * competition, what you set up before it, and what you configure once.
 *
 * RUN      Matches, Standings, Brackets
 * BUILD    Teams, Players, Format & structure
 * SETTINGS Info, Proof, Collaborators
 *
 * Torneo also has Venues, Regulations and Suspensions. Those are not
 * here because nothing in our schema backs them yet: there is no
 * venues table (a fixture carries a free-text venue), no regulations
 * document, and no disciplinary record. Drawing the menu items would
 * promise screens that cannot save anything, so they arrive when the
 * tables do.
 */
type Section =
  | "matches" | "standings" | "brackets"
  | "teams" | "players" | "venues" | "structure"
  | "info" | "regulations" | "suspensions" | "proof" | "collaborators";

const NAV: { group: string; items: { id: Section; label: string; icon: () => JSX.Element }[] }[] = [
  {
    group: "Run",
    items: [
      { id: "matches",   label: "Matches",   icon: IconMatches },
      { id: "standings", label: "Standings", icon: IconStandings },
      { id: "brackets",  label: "Brackets",  icon: IconBrackets },
    ],
  },
  {
    group: "Build",
    items: [
      { id: "teams",     label: "Teams",             icon: IconTeams },
      { id: "players",   label: "Players",           icon: IconPlayers },
      { id: "venues",    label: "Venues",            icon: IconVenues },
      { id: "structure", label: "Format & structure", icon: IconStructure },
    ],
  },
  {
    group: "Settings",
    items: [
      { id: "info",          label: "Info",          icon: IconInfo },
      { id: "regulations",   label: "Regulations",   icon: IconRules },
      { id: "suspensions",   label: "Suspensions",   icon: IconBan },
      { id: "proof",         label: "Proof",         icon: IconProof },
      { id: "collaborators", label: "Collaborators", icon: IconPeople },
    ],
  },
];

const TITLES: Record<Section, string> = {
  matches: "Matches", standings: "Standings", brackets: "Brackets",
  teams: "Teams", players: "Players", venues: "Venues",
  structure: "Format & structure", suspensions: "Suspensions",
  info: "Info", regulations: "Regulations",
  proof: "Proof", collaborators: "Collaborators",
};

export default function Page() {
  return <Guard><Detail /></Guard>;
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    tournament: Tournament; teams: TeamRow[]; proofs: Proof[]; fixtures: Fixture[];
  } | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [section, setSection] = useState<Section>("matches");
  const [navOpen, setNavOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getTournament(id)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
    getReadiness(id).then(setReady).catch(() => setReady(null));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-red2 text-sm font-semibold">{error}</p>;
  if (!data) return <p className="text-mt text-sm">Loading...</p>;

  const t = data.tournament;
  // The backend attaches the caller's role. A scorer sees the same
  // screens but the controls they can't use aren't drawn.
  const role = (t as any)._role ?? "owner";
  // Mirrors FROZEN_STATUSES on the backend: review is the only thing
  // that locks a competition, and it unlocks again whichever way the
  // decision goes. Hiding the controls is a courtesy; the server
  // refuses the write regardless.
  const editable =
    t.status !== "pending" && (role === "owner" || role === "editor");

  // Proof is narrower. It is the evidence a decision was made on, so it
  // is only editable while that decision is still outstanding -- which
  // matches add_proof/delete_proof in editor_review.py. Drawing proof
  // controls on an approved competition would offer a button the server
  // rejects.
  const proofEditable =
    (t.status === "draft" || t.status === "rejected") && role === "owner";

  const counts: Partial<Record<Section, number>> = {
    matches: data.fixtures.length,
    teams:   data.teams.length,
    proof:   data.proofs.length,
  };

  const nav = (
    <CompetitionNav
      t={t} ready={ready} role={role} editable={editable} counts={counts}
      active={section}
      onPick={(x) => { setSection(x); setNavOpen(false); }}
      onChanged={load}
    />
  );

  return (
    <div className="lg:flex lg:items-start">
      {/* ── competition menu ───────────────────────────────── */}
      <div className="hidden lg:block w-64 shrink-0 border-r border-bd min-h-screen">
        {nav}
      </div>

      {/* phone: the same menu behind a disclosure, so the content
          still starts at the top of the screen */}
      <div className="lg:hidden border-b border-bd">
        <button
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <span className="min-w-0">
            <span className="block text-white font-semibold truncate">{t.name}</span>
            <span className="block text-mt text-xs">{TITLES[section]}</span>
          </span>
          <span className={clsx("text-mt transition-transform", navOpen && "rotate-180")}>
            ▾
          </span>
        </button>
        {navOpen && <div className="border-t border-bd">{nav}</div>}
      </div>

      {/* ── content ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 py-6">
        <nav className="text-xs text-mt mb-5" aria-label="Breadcrumb">
          <Link href="/competitions" className="hover:text-white transition-colors">
            My competitions
          </Link>
          <span className="mx-1.5 text-mt2">/</span>
          <span className="text-mt">{t.name}</span>
          <span className="mx-1.5 text-mt2">/</span>
          <span className="text-white font-semibold">{TITLES[section]}</span>
        </nav>

        {t.status === "rejected" && t.rejection_reason && (
          <div className="card border-red2/40 mb-6">
            <p className="section-label mb-2">Changes needed</p>
            <p className="text-white text-sm">{t.rejection_reason}</p>
            <p className="text-mt text-xs mt-2">Fix these and submit again.</p>
          </div>
        )}

        {t.status === "pending" && (
          <div className="card border-cyan/30 mb-6">
            <p className="text-white text-sm">Locked while we review it.</p>
            <p className="text-mt text-xs mt-1">
              What gets reviewed is what gets published, so nothing can change
              until we decide. It unlocks either way.
            </p>
          </div>
        )}

        <header className="mb-5">
          <h1 className="font-display font-black text-2xl text-white">
            {TITLES[section]}
          </h1>
          <p className="text-mt text-sm mt-1">{BLURBS[section]}</p>
        </header>

        {section === "matches" && (
          <FixturesTab tid={id} teams={data.teams} fixtures={data.fixtures}
                       format={t.format} editable={editable} onChanged={load} />
        )}
        {section === "standings" && <TableTab tid={id} />}
        {section === "brackets" && (
          <BracketsSection fixtures={data.fixtures} teams={data.teams} />
        )}
        {section === "teams" && (
          <TeamsTab tid={id} teams={data.teams} editable={editable} onChanged={load} />
        )}
        {section === "players" && (
          <PlayersSection teams={data.teams} editable={editable} />
        )}
        {section === "venues" && (
          <VenuesSection tid={id} editable={editable && role === "owner"} />
        )}
        {section === "structure" && (
          <StructureSection tid={id} t={t} teams={data.teams} fixtures={data.fixtures}
                            editable={editable && role === "owner"} onChanged={load} />
        )}
        {section === "suspensions" && (
          <SuspensionsSection tid={id} teams={data.teams} editable={editable} />
        )}
        {section === "info" && (
          <InfoSection t={t} editable={editable && role === "owner"} onChanged={load} />
        )}
        {section === "regulations" && (
          <RegulationsSection t={t} editable={editable && role === "owner"}
                              onChanged={load} />
        )}
        {section === "proof" && (
          <ProofTab tid={id} proofs={data.proofs} editable={proofEditable} onChanged={load} />
        )}
        {section === "collaborators" && (
          <AccessTab tid={id} isOwner={role === "owner"} />
        )}
      </div>
    </div>
  );
}

/** One line under each section heading, so a screen is never just a title. */
const BLURBS: Record<Section, string> = {
  matches:       "The full schedule and results for this competition.",
  standings:     "Worked out from finished matches every time this loads.",
  brackets:      "The knockout draw, round by round.",
  teams:         "Every team taking part.",
  players:       "Every registered player, by team.",
  venues:        "The grounds your matches are played at.",
  structure:     "The named parts this competition is divided into.",
  suspensions:   "Players serving a ban, and what they were banned for.",
  info:          "Name, logo, organiser, country and dates.",
  regulations:   "What a result is worth, and how level teams are separated.",
  proof:         "Evidence this competition is real. We read this before approving.",
  collaborators: "The people who can edit this competition.",
};

/* ── publish state ───────────────────────────────────────────────────
   Lives at the top of the competition menu, so it is a narrow column,
   not a full-width bar. Everything here stacks and the button is full
   width; the earlier side-by-side version burst out of the menu and
   sat on top of the page heading. */
function SubmitBar({ t, ready, editable, onChanged }: {
  t: Tournament; ready: Readiness | null; editable: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (t.status === "pending") {
    return (
      <div className="card py-3">
        <StatusPill status={t.status} />
        <p className="text-mt text-xs mt-2 leading-relaxed">
          With us for review. Locked until we decide.
        </p>
      </div>
    );
  }

  if (t.status === "approved") {
    return (
      <div className="card py-3">
        <StatusPill status={t.status} />
        <p className="text-mt text-xs mt-2 leading-relaxed">
          Fans can follow it on Scout.
        </p>
        <button className="text-mt hover:text-red2 text-xs font-semibold mt-2"
                disabled={busy} onClick={() => act(() => unpublish(t.id))}>
          {busy ? "Working..." : "Unpublish"}
        </button>
        {error && <p className="text-red2 text-xs font-semibold mt-2">{error}</p>}
      </div>
    );
  }

  if (!editable) {
    return (
      <div className="card py-3">
        <StatusPill status={t.status} />
      </div>
    );
  }

  return (
    <div className="card py-3">
      <StatusPill status={t.status} />

      {ready?.ready ? (
        <p className="text-grn text-xs mt-2.5">Ready to submit.</p>
      ) : (
        <div className="mt-2.5">
          <p className="text-mt text-xs mb-1.5">Still needs</p>
          <ul className="space-y-1">
            {(ready?.missing || []).map((m) => (
              <li key={m} className="text-mt text-xs leading-snug flex gap-1.5">
                <span className="text-mt2">•</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="btn-volt w-full mt-3 text-[13px] px-3 py-2
                   disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={busy || !ready?.ready}
        onClick={() => act(() => submitForReview(t.id))}
      >
        {busy ? "Sending..." : "Submit for review"}
      </button>

      {error && <p className="text-red2 text-xs font-semibold mt-2">{error}</p>}
    </div>
  );
}

// ── teams ─────────────────────────────────────────────────────────────
function TeamsTab({ tid, teams, editable, onChanged }: {
  tid: string; teams: TeamRow[]; editable: boolean; onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [group, setGroup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openSquad, setOpenSquad] = useState<string | null>(null);

  // Search before create, always. Clubs are global, so a duplicate
  // splits one squad's career history across two rows.
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const timer = setTimeout(() => {
      searchClubs(q.trim()).then((d) => setHits(d.clubs)).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const add = async (body: Record<string, unknown>) => {
    setError(null);
    try { await addTeam(tid, { ...body, group_name: group || null }); setQ(""); onChanged(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      {editable && (
        <div className="card space-y-3">
          <p className="section-label">Add a team</p>
          <input className="input-select" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search existing clubs, or type a new name" />
          <input className="input-select" value={group} onChange={(e) => setGroup(e.target.value)}
                 placeholder="Group (only for groups + knockout)" />

          {hits.length > 0 && (
            <div className="space-y-1">
              <p className="text-mt text-xs">Existing clubs, pick one to keep its history:</p>
              {hits.map((c) => (
                <button key={c.id} onClick={() => add({ club_id: c.id })}
                        className="w-full text-left px-3 py-2 rounded-lg bg-sur2 hover:bg-bd text-sm text-white">
                  {c.name}{c.institution ? ` — ${c.institution}` : ""}
                </button>
              ))}
            </div>
          )}

          {q.trim().length >= 2 && (
            <button className="text-volt2 text-sm font-semibold"
                    onClick={() => add({ club_name: q.trim() })}>
              Create &quot;{q.trim()}&quot; as a new club
            </button>
          )}
          {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
        </div>
      )}

      {teams.length === 0 ? (
        <p className="text-mt text-sm">No teams yet.</p>
      ) : (
        <div className="space-y-2">
          {teams.map((tm) => (
            <div key={tm.id} className="card">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <CrestUpload club={tm.clubs} onChanged={onChanged} />
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{tm.clubs?.name ?? "Unknown club"}</p>
                    {tm.group_name && <p className="text-mt text-xs mt-0.5">Group {tm.group_name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button className="text-volt2 text-sm"
                          onClick={() => setOpenSquad(openSquad === tm.id ? null : tm.id)}>
                    Squad
                  </button>
                  {editable && (
                    <button className="text-mt hover:text-red2 text-sm"
                            onClick={async () => {
                              try { await removeTeam(tid, tm.id); onChanged(); }
                              catch (e: any) { setError(e.message); }
                            }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {openSquad === tm.id && <Squad teamId={tm.id} editable={editable} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Squad({ teamId, editable }: { teamId: string; editable: boolean }) {
  const [squad, setSquad] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ first_name: "", last_name: "", dob: "", jersey_number: "" });

  const load = useCallback(() => {
    listSquad(teamId).then((d) => setSquad(d.squad)).catch((e) => setError(e.message));
  }, [teamId]);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await registerPlayer(teamId, {
        first_name: f.first_name, last_name: f.last_name, dob: f.dob,
        jersey_number: f.jersey_number ? Number(f.jersey_number) : null,
      });
      setF({ first_name: "", last_name: "", dob: "", jersey_number: "" });
      load();
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="mt-4 pt-4 border-t border-bd space-y-3">
      {squad === null ? <p className="text-mt text-sm">Loading squad...</p> :
       squad.length === 0 ? <p className="text-mt text-sm">Nobody registered yet.</p> : (
        <div className="space-y-1">
          {squad.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/90">
                {r.jersey_number != null && (
                  <span className="text-mt font-mono mr-2">#{r.jersey_number}</span>
                )}
                {r.players?.first_name} {r.players?.last_name}
              </span>
              {editable && (
                <button className="text-mt hover:text-red2 text-xs"
                        onClick={async () => {
                          try { await unregisterPlayer(teamId, r.id); load(); }
                          catch (e: any) { setError(e.message); }
                        }}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input className="input-select" placeholder="First name" required
                 value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          <input className="input-select" placeholder="Last name" required
                 value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          {/* dob is required by the schema on purpose: it's how the same
              student is recognised next season instead of getting a new
              record and losing his career stats. */}
          <input className="input-select" type="date" required title="Date of birth"
                 value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
          <div className="flex gap-2">
            <input className="input-select" placeholder="#" type="number" min={1} max={99}
                   value={f.jersey_number}
                   onChange={(e) => setF({ ...f, jersey_number: e.target.value })} />
            <button className="btn-volt px-3">Add</button>
          </div>
        </form>
      )}
      {error && <p className="text-red2 text-xs font-semibold">{error}</p>}
    </div>
  );
}

// ── fixtures ──────────────────────────────────────────────────────────
function FixturesTab({ tid, teams, fixtures, format, editable, onChanged }: {
  tid: string; teams: TeamRow[]; fixtures: Fixture[];
  format: string; editable: boolean; onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Two ways in. An organiser who already has a draw from a ceremony
  // shouldn't have to let a generator overwrite it.
  const [mode, setMode] = useState<"generate" | "own">("generate");
  const [opts, setOpts] = useState({
    first_kickoff: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    minutes_between: "120", matches_per_day: "4", venue: "", double_round: false,
  });

  const info = (teamId: string) => {
    const t = teams.find((x) => x.id === teamId);
    return { name: t?.clubs?.name ?? "Unknown", crest_url: t?.clubs?.crest_url ?? null };
  };
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, info(t.id)]));

  const generate = async () => {
    setBusy(true); setError(null); setNotes([]);
    try {
      const r = await generateFixtures(tid, {
        first_kickoff: new Date(opts.first_kickoff).toISOString(),
        minutes_between: Number(opts.minutes_between),
        matches_per_day: Number(opts.matches_per_day),
        venue: opts.venue || null,
        double_round: opts.double_round,
      });
      setNotes(r.notes || []);
      onChanged();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const isKnockout = format === "knockout";

  return (
    <div className="space-y-4">
      {editable && fixtures.length === 0 && (
        <>
          <div className="flex gap-2">
            <button onClick={() => setMode("generate")}
              className={clsx("tab-pill", mode === "generate" ? "tab-pill-active" : "tab-pill-inactive")}>
              Generate for me
            </button>
            <button onClick={() => setMode("own")}
              className={clsx("tab-pill", mode === "own" ? "tab-pill-active" : "tab-pill-inactive")}>
              I already have the draw
            </button>
          </div>

          {mode === "generate" ? (
            <div className="card space-y-3">
              <p className="section-label">Generate the fixture list</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-mt text-xs uppercase tracking-wide">First kickoff</span>
                  <input type="datetime-local" className="input-select mt-1" value={opts.first_kickoff}
                         onChange={(e) => setOpts({ ...opts, first_kickoff: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-mt text-xs uppercase tracking-wide">Venue</span>
                  <input className="input-select mt-1" value={opts.venue} placeholder="Main pitch"
                         onChange={(e) => setOpts({ ...opts, venue: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-mt text-xs uppercase tracking-wide">Minutes between</span>
                  <input type="number" className="input-select mt-1" value={opts.minutes_between}
                         onChange={(e) => setOpts({ ...opts, minutes_between: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-mt text-xs uppercase tracking-wide">Matches per day</span>
                  <input type="number" className="input-select mt-1" value={opts.matches_per_day}
                         onChange={(e) => setOpts({ ...opts, matches_per_day: e.target.value })} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-mt">
                <input type="checkbox" checked={opts.double_round}
                       onChange={(e) => setOpts({ ...opts, double_round: e.target.checked })} />
                Home and away (league only)
              </label>
              <p className="text-mt2 text-xs">
                Kickoffs go on a simple grid. Move any of them afterwards.
              </p>
              <button className="btn-volt" disabled={busy} onClick={generate}>
                {busy ? "Generating..." : "Generate"}
              </button>
            </div>
          ) : (
            <OwnDraw tid={tid} teams={teams} onChanged={onChanged} />
          )}
        </>
      )}

      {notes.map((n) => <p key={n} className="text-amber text-sm">{n}</p>)}
      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      {fixtures.length > 0 && editable && (
        <div className="flex items-center gap-4">
          <button className="text-mt hover:text-red2 text-sm font-semibold"
                  onClick={async () => {
                    setError(null);
                    try { await clearFixtures(tid); onChanged(); }
                    catch (e: any) { setError(e.message); }
                  }}>
            Clear all fixtures
          </button>
          <AddOne tid={tid} teams={teams} onChanged={onChanged} />
        </div>
      )}

      {/* A knockout reads as a bracket; everything else reads as
          matchdays. Same data, different shape, because a list of 30
          league fixtures with no grouping is unusable. */}
      {fixtures.length > 0 && (
        isKnockout
          ? <Bracket fixtures={fixtures} teams={teamMap} />
          : <ByRound fixtures={fixtures} tid={tid} info={info} />
      )}
    </div>
  );
}

function ByRound({ fixtures, tid, info }: {
  fixtures: Fixture[]; tid: string;
  info: (id: string) => { name: string; crest_url: string | null };
}) {
  const grouped: Record<string, Fixture[]> = {};
  for (const fx of fixtures) {
    const key = fx.group_name ? `Group ${fx.group_name}` : (fx.round || "Fixtures");
    (grouped[key] ||= []).push(fx);
  }
  const keys = sortRounds(Object.keys(grouped));

  return (
    <div className="space-y-6">
      {keys.map((k) => (
        <div key={k}>
          <p className="section-label mb-3">{k}</p>
          <div className="space-y-2">
            {grouped[k]
              .slice()
              .sort((a, b) => (a.kickoff_at || "").localeCompare(b.kickoff_at || ""))
              .map((fx) => {
                const h = info(fx.home_team_id), a = info(fx.away_team_id);
                return (
                  <div key={fx.id} className="card flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Crest url={h.crest_url} name={h.name} size={18} />
                        <span className="text-white text-sm truncate">{h.name}</span>
                        <span className="text-mt2 text-xs">v</span>
                        <Crest url={a.crest_url} name={a.name} size={18} />
                        <span className="text-white text-sm truncate">{a.name}</span>
                      </div>
                      <p className="text-mt text-xs mt-1 font-mono">
                        {new Date(fx.kickoff_at).toLocaleString("en-GB", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                        {fx.venue ? ` • ${fx.venue}` : ""}
                        {` • ${String(fx.status).toUpperCase()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-white">
                        {fx.home_score ?? "-"}:{fx.away_score ?? "-"}
                      </span>
                      <Link href={`/t/${tid}/live/${fx.id}`} className="text-volt2 text-sm font-semibold">
                        {fx.status === "ft" ? "Edit" : "Go live"}
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Enter a draw you already have, one row at a time, then save as a
 *  set. Validated server-side as a whole: a typo in row four fails the
 *  lot rather than importing three and leaving you to work out which. */
function OwnDraw({ tid, teams, onChanged }: {
  tid: string; teams: TeamRow[]; onChanged: () => void;
}) {
  type Row = {
    home_team_id: string; away_team_id: string;
    kickoff_at: string; round: string; group_name: string; venue: string;
  };
  const blank = (): Row => ({
    home_team_id: "", away_team_id: "",
    kickoff_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    round: "", group_name: "", venue: "",
  });
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (i: number, k: keyof Row, v: string) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const complete = rows.filter((r) => r.home_team_id && r.away_team_id);
      if (complete.length === 0) throw new Error("Fill in at least one fixture.");
      await bulkFixtures(tid, complete.map((r) => ({
        home_team_id: r.home_team_id,
        away_team_id: r.away_team_id,
        kickoff_at: new Date(r.kickoff_at).toISOString(),
        round: r.round || null,
        group_name: r.group_name || null,
        venue: r.venue || null,
      })));
      setRows([blank()]);
      onChanged();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (teams.length < 2) {
    return <p className="text-mt text-sm">Add at least two teams first.</p>;
  }

  return (
    <div className="card space-y-3">
      <p className="section-label">Enter your draw</p>
      <p className="text-mt2 text-xs">
        Round is free text, so use whatever your draw calls it: Matchday 1,
        Quarter-final, Group A.
      </p>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <select className="input-select" value={r.home_team_id}
                  onChange={(e) => set(i, "home_team_id", e.target.value)}>
            <option value="">Home</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.clubs?.name}</option>)}
          </select>
          <select className="input-select" value={r.away_team_id}
                  onChange={(e) => set(i, "away_team_id", e.target.value)}>
            <option value="">Away</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.clubs?.name}</option>)}
          </select>
          <input type="datetime-local" className="input-select" value={r.kickoff_at}
                 onChange={(e) => set(i, "kickoff_at", e.target.value)} />
          <input className="input-select" placeholder="Round" value={r.round}
                 onChange={(e) => set(i, "round", e.target.value)} />
          <input className="input-select" placeholder="Group" value={r.group_name}
                 onChange={(e) => set(i, "group_name", e.target.value)} />
          <input className="input-select" placeholder="Venue" value={r.venue}
                 onChange={(e) => set(i, "venue", e.target.value)} />
        </div>
      ))}
      <div className="flex items-center gap-4">
        <button className="text-volt2 text-sm font-semibold"
                onClick={() => setRows([...rows, blank()])}>
          Add another fixture
        </button>
        {rows.length > 1 && (
          <button className="text-mt hover:text-red2 text-sm"
                  onClick={() => setRows(rows.slice(0, -1))}>
            Remove last
          </button>
        )}
      </div>
      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
      <button className="btn-volt" disabled={busy} onClick={save}>
        {busy ? "Saving..." : `Save ${rows.filter((r) => r.home_team_id && r.away_team_id).length} fixture(s)`}
      </button>
    </div>
  );
}

/** Add one fixture to an existing list. This is also how knockout
 *  rounds after the first get created, once you know who advanced. */
function AddOne({ tid, teams, onChanged }: {
  tid: string; teams: TeamRow[]; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="text-volt2 text-sm font-semibold" onClick={() => setOpen(true)}>
        Add a fixture
      </button>
    );
  }
  return (
    <div className="w-full">
      <OwnDraw tid={tid} teams={teams} onChanged={() => { setOpen(false); onChanged(); }} />
    </div>
  );
}

// ── table ─────────────────────────────────────────────────────────────
function TableTab({ tid }: { tid: string }) {
  const [data, setData] = useState<{
    grouped: boolean;
    standings?: StandingRow[];
    group_tables?: Record<string, StandingRow[]>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStandings(tid).then(setData).catch((e) => setError(e.message));
  }, [tid]);

  if (error) return <p className="text-red2 text-sm font-semibold">{error}</p>;
  if (!data) return <p className="text-mt text-sm">Loading...</p>;

  return (
    <div className="space-y-6">
      <p className="text-mt2 text-xs">
        Built from finished matches only. A live or postponed match counts
        for nothing until it has a final score.
      </p>
      {data.grouped
        ? Object.keys(data.group_tables || {}).sort().map((g) => (
            <div key={g}>
              <p className="section-label mb-3">Group {g}</p>
              <div className="card">
                <StandingsTable rows={data.group_tables![g]} />
              </div>
            </div>
          ))
        : <div className="card"><StandingsTable rows={data.standings || []} /></div>}
    </div>
  );
}

// ── proof ─────────────────────────────────────────────────────────────
function ProofTab({ tid, proofs, editable, onChanged }: {
  tid: string; proofs: Proof[]; editable: boolean; onChanged: () => void;
}) {
  const [f, setF] = useState({ type: "link", url: "", note: "" });
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try { await addProof(tid, f); setF({ type: "link", url: "", note: "" }); onChanged(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="section-label mb-2">Why we ask</p>
        <p className="text-mt text-sm">
          Anyone can type a tournament into an app. Proof is how we tell a real
          competition from one, before it shows up next to live football on
          Scout. A letter from the sports department, the fixture poster, or the
          organising body&apos;s page all work.
        </p>
      </div>

      {editable && (
        <form onSubmit={add} className="card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className="input-select" value={f.type}
                    onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="link">Link</option>
              <option value="document">Document</option>
              <option value="screenshot">Screenshot</option>
            </select>
            <input className="input-select sm:col-span-2" required placeholder="URL"
                   value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          </div>
          <input className="input-select" placeholder="Note (optional)"
                 value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <button className="btn-volt">Add proof</button>
          {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
        </form>
      )}

      {proofs.length === 0 ? (
        <p className="text-mt text-sm">Nothing attached yet.</p>
      ) : (
        <div className="space-y-2">
          {proofs.map((p) => (
            <div key={p.id} className="card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm truncate">{p.url}</p>
                <p className="text-mt text-xs mt-0.5">
                  {p.type}{p.note ? ` • ${p.note}` : ""}
                </p>
              </div>
              {editable && (
                <button className="text-mt hover:text-red2 text-sm shrink-0"
                        onClick={async () => {
                          try { await deleteProof(tid, p.id); onChanged(); }
                          catch (e: any) { setError(e.message); }
                        }}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/** Crest, click to replace.
 *
 * The file goes to our backend, which writes it to Supabase Storage
 * with the service role key. It never goes browser-to-bucket, because
 * that key cannot be in a browser and the bucket has no policies.
 *
 * Clubs are global, so this crest follows the club into every future
 * tournament, which is the point: the department side keeps its badge.
 */
function CrestUpload({ club, onChanged }: {
  club: { id: string; name: string; crest_url: string | null } | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!club) return <Crest size={36} />;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try { await uploadCrest(club.id, file); onChanged(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); e.target.value = ""; }
  };

  return (
    <div className="shrink-0">
      <label className="cursor-pointer block" title="Upload a crest">
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp"
               className="hidden" onChange={pick} disabled={busy} />
        <span className={busy ? "opacity-50 block" : "block"}>
          <Crest url={club.crest_url} name={club.name} size={36} />
        </span>
      </label>
      {club.crest_url && (
        <button className="text-mt2 hover:text-red2 text-[10px] mt-1 block"
                onClick={async () => {
                  try { await removeCrest(club.id); onChanged(); }
                  catch (e: any) { setError(e.message); }
                }}>
          clear
        </button>
      )}
      {error && <p className="text-red2 text-[10px] mt-1 max-w-[120px]">{error}</p>}
    </div>
  );
}

/* ── competition menu ───────────────────────────────────────────────
   Crest and name, the publish state and its one action, then the three
   groups. The state sits at the top rather than buried in a tab,
   because "is this live yet" is the question an organiser has every
   time they open the page. */
function CompetitionNav({
  t, ready, role, editable, counts, active, onPick, onChanged,
}: {
  t: Tournament;
  ready: Readiness | null;
  role: string;
  editable: boolean;
  counts: Partial<Record<Section, number>>;
  active: Section;
  onPick: (s: Section) => void;
  onChanged: () => void;
}) {
  return (
    <div className="px-3 py-5">
      <div className="flex items-center gap-3 px-2 mb-4">
        <Crest url={t.crest_url} name={t.name} size={34} />
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{t.name}</p>
          <p className="text-mt text-xs truncate">{t.organizing_body}</p>
        </div>
      </div>

      <div className="mb-5">
        {role === "owner" ? (
          <SubmitBar t={t} ready={ready} editable={editable} onChanged={onChanged} />
        ) : (
          <div className="card py-3">
            <StatusPill status={t.status} />
            <p className="text-mt text-xs mt-2 leading-relaxed">
              You&apos;re an {role} here. You can update matches and scores.
            </p>
          </div>
        )}
      </div>

      {NAV.map(({ group, items }) => (
        <div key={group} className="mb-5">
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase
                        text-mt2 px-3 mb-2">
            {group}
          </p>
          <nav className="space-y-0.5">
            {items.map(({ id, label, icon: Icon }) => {
              const n = counts[id];
              return (
                <button
                  key={id}
                  onClick={() => onPick(id)}
                  aria-current={active === id ? "page" : undefined}
                  className={clsx(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left",
                    "transition-colors",
                    active === id
                      ? "bg-volt/10 text-volt"
                      : "text-mt hover:text-white hover:bg-sur2"
                  )}
                >
                  <Icon />
                  <span className="flex-1 truncate">{label}</span>
                  {typeof n === "number" && n > 0 && (
                    <span className="font-mono text-[10px] text-mt2">{n}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

/* ── brackets ───────────────────────────────────────────────────── */
function BracketsSection({ fixtures, teams }: { fixtures: Fixture[]; teams: TeamRow[] }) {
  const teamMap: Record<string, { name: string; crest_url: string | null }> = {};
  for (const tm of teams) {
    teamMap[tm.id] = {
      name: tm.clubs?.name ?? "Unknown",
      crest_url: tm.clubs?.crest_url ?? null,
    };
  }

  // A league has no bracket. Saying so is better than an empty frame
  // that looks like something failed to load.
  if (!fixtures.length) {
    return (
      <div className="card">
        <p className="text-white font-semibold">No fixtures yet</p>
        <p className="text-mt text-sm mt-1">
          Generate or upload the fixtures first, under Matches.
        </p>
      </div>
    );
  }

  return <div className="card overflow-x-auto"><Bracket fixtures={fixtures} teams={teamMap} /></div>;
}

/* ── players ────────────────────────────────────────────────────────
   Every squad in one place. Torneo has this as its own screen and it
   is right: once there are twelve teams, finding one player by opening
   twelve team rows is not a way to work. */
function PlayersSection({ teams, editable }: { teams: TeamRow[]; editable: boolean }) {
  const [open, setOpen] = useState<string | null>(teams[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<string>("");

  if (!teams.length) {
    return (
      <div className="card">
        <p className="text-white font-semibold">No teams yet</p>
        <p className="text-mt text-sm mt-1">
          Players are registered to a team, so add the teams first.
        </p>
      </div>
    );
  }

  const term = q.trim().toLowerCase();
  const shown = teams.filter((tm) => {
    if (only && tm.id !== only) return false;
    if (!term) return true;
    return (tm.clubs?.name ?? "").toLowerCase().includes(term);
  });

  return (
    <div className="space-y-2">
      {teams.length > 3 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input className="input-select flex-1 min-w-[200px]" value={q}
                 onChange={(e) => setQ(e.target.value)}
                 placeholder="Search teams" />
          <select className="input-select w-auto" value={only}
                  onChange={(e) => setOnly(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.clubs?.name ?? "Unknown"}</option>
            ))}
          </select>
        </div>
      )}

      {shown.length === 0 && (
        <p className="text-mt text-sm">No team matches that.</p>
      )}

      {shown.map((tm) => (
        <div key={tm.id} className="card p-0 overflow-hidden">
          <button
            onClick={() => setOpen(open === tm.id ? null : tm.id)}
            aria-expanded={open === tm.id}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-sur2
                       transition-colors"
          >
            <Crest url={tm.clubs?.crest_url} name={tm.clubs?.name} size={24} />
            <span className="text-white text-sm font-semibold flex-1 truncate">
              {tm.clubs?.name ?? "Unknown"}
            </span>
            {tm.group_name && (
              <span className="font-mono text-[10px] text-mt2">Group {tm.group_name}</span>
            )}
            <span className={clsx("text-mt transition-transform", open === tm.id && "rotate-180")}>
              ▾
            </span>
          </button>
          {open === tm.id && (
            <div className="px-4 pb-4 border-t border-bd pt-4">
              <Squad teamId={tm.id} editable={editable} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── format & structure ─────────────────────────────────────────── */
function StructureSection({ tid, t, teams, fixtures, editable, onChanged }: {
  tid: string; t: Tournament; teams: TeamRow[]; fixtures: Fixture[];
  editable: boolean; onChanged: () => void;
}) {
  const groups = Array.from(
    new Set(teams.map((x) => x.group_name).filter(Boolean))
  ).sort() as string[];

  const rounds = sortRounds(
    Array.from(new Set(fixtures.map((f) => f.round).filter(Boolean))) as string[]
  );

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="section-label mb-4">Shape</p>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label="Format" value={t.format.replace("_", " + ")} />
          <Field label="Teams" value={String(teams.length)} />
          <Field label="Groups" value={groups.length ? groups.join(", ") : "None"} />
          <Field label="Fixtures" value={String(fixtures.length)} />
        </dl>
      </div>

      {rounds.length > 0 && (
        <div className="card">
          <p className="section-label mb-3">Rounds</p>
          <div className="flex flex-wrap gap-2">
            {rounds.map((r) => (
              <span key={r} className="bg-sur2 border border-bd rounded-lg px-3 py-1.5
                                       text-mt text-xs">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      <SubCompetitions tid={tid} editable={editable} onChanged={onChanged} />

      <p className="text-mt2 text-xs">
        The format is fixed once the competition is created, because changing
        it would invalidate fixtures that already exist. Clear the fixtures
        under Matches to redraw them. Points and tiebreakers are under
        Regulations.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-mt text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-white mt-1">{value}</dd>
    </div>
  );
}

/* ── info ───────────────────────────────────────────────────────────
   The competition's own details, editable in place. Torneo splits this
   into General and Season tabs; with our smaller field set one form is
   clearer than two. */
function InfoSection({ t, editable, onChanged }: {
  t: Tournament; editable: boolean; onChanged: () => void;
}) {
  const [f, setF] = useState({
    name: t.name,
    organizing_body: t.organizing_body || "",
    country: t.country || "",
    contact_email: t.contact_email || "",
    organizer_phone: t.organizer_phone || "",
    start_date: t.start_date || "",
    end_date: t.end_date || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value }); setSaved(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try {
      await updateTournament(t.id, f);
      setSaved(true);
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <div className="card">
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label="Name" value={t.name} />
          <Field label="Organising body" value={t.organizing_body || "—"} />
          <Field label="Country" value={t.country || "—"} />
          <Field label="Level" value={t.level} />
          <Field label="Starts" value={t.start_date} />
          <Field label="Ends" value={t.end_date} />
        </dl>
        <p className="text-mt2 text-xs mt-5">
          {t.status === "pending"
            ? "Locked while we review it."
            : "Only the owner can change these."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <TournamentLogo t={t} onChanged={onChanged} />

    <form onSubmit={save} className="card space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Name" value={f.name} onChange={set("name")} required />
        <Input label="Organising body" value={f.organizing_body}
               onChange={set("organizing_body")} required />
        <Input label="Country" value={f.country} onChange={set("country")} required />
        <Input label="Contact email" type="email" value={f.contact_email}
               onChange={set("contact_email")} required />
        <Input label="Contact phone" value={f.organizer_phone}
               onChange={set("organizer_phone")} />
        <div />
        <Input label="Starts" type="date" value={f.start_date}
               onChange={set("start_date")} required />
        <Input label="Ends" type="date" value={f.end_date}
               onChange={set("end_date")} required />
      </div>

      <p className="text-mt2 text-xs">
        Level and format are fixed after creation. Both change what has
        already been generated or reviewed.
      </p>

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
      {saved && !error && <p className="text-grn text-sm font-semibold">Saved.</p>}

      <button className="btn-volt" disabled={busy}>
        {busy ? "Saving..." : "Save changes"}
      </button>
    </form>

      <DangerZone t={t} />
    </div>
  );
}

/* ── competition logo ───────────────────────────────────────────── */
function TournamentLogo({ t, onChanged }: { t: Tournament; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try { await uploadTournamentCrest(t.id, file); onChanged(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); e.target.value = ""; }
  };

  const clear = async () => {
    setBusy(true); setError(null);
    try { await removeTournamentCrest(t.id); onChanged(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <p className="section-label mb-4">Competition logo</p>
      <div className="flex items-center gap-4">
        <Crest url={t.crest_url} name={t.name} size={56} />
        <div className="min-w-0">
          <label className="inline-block">
            <span className="border border-bd2 text-white text-sm font-semibold
                             px-4 py-2 rounded-lg cursor-pointer inline-block
                             hover:border-volt hover:text-volt transition-colors">
              {busy ? "Uploading..." : t.crest_url ? "Replace" : "Add logo"}
            </span>
            <input type="file" accept="image/*" className="hidden"
                   disabled={busy} onChange={pick} />
          </label>
          {t.crest_url && (
            <button type="button" onClick={clear} disabled={busy}
                    className="text-mt hover:text-red2 text-sm font-semibold ml-3">
              Remove
            </button>
          )}
          <p className="text-mt2 text-xs mt-2">
            PNG, JPG, GIF or WebP, under 1 MB. It renders small, so a tight
            square crop reads best.
          </p>
        </div>
      </div>
      {error && <p className="text-red2 text-sm font-semibold mt-3">{error}</p>}
    </div>
  );
}

/* ── danger zone ────────────────────────────────────────────────────
   Deleting takes the teams, fixtures and every result with it, so it
   asks the organiser to type the name. A confirm dialog is one careless
   click; typing the name is not something you do by accident. */
function DangerZone({ t }: { t: Tournament }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim() === t.name.trim();

  const go = async () => {
    if (!matches) return;
    setBusy(true); setError(null);
    try {
      await deleteTournament(t.id);
      router.replace("/competitions");
    } catch (e: any) {
      setError(e.message); setBusy(false);
    }
  };

  return (
    <div className="card border-red2/30">
      <p className="font-mono text-[11px] font-bold tracking-[0.22em] uppercase
                    text-red2 mb-3">
        Danger zone
      </p>
      <p className="text-white text-sm font-semibold">Delete this competition</p>
      <p className="text-mt text-sm mt-1">
        Takes the teams, the fixtures and every result with it. Nothing about
        this can be undone.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)}
                className="mt-4 border border-red2/40 text-red2 font-semibold text-sm
                           px-4 py-2 rounded-lg hover:bg-red2 hover:text-bg
                           transition-colors">
          Delete competition
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-mt text-xs">
              Type <span className="text-white font-semibold">{t.name}</span> to confirm
            </span>
            <input className="input-select mt-1.5" value={typed} autoFocus
                   onChange={(e) => setTyped(e.target.value)} />
          </label>
          {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={go} disabled={!matches || busy}
                    className="bg-red2 text-bg font-bold text-sm px-4 py-2 rounded-lg
                               disabled:opacity-30 disabled:cursor-not-allowed">
              {busy ? "Deleting..." : "Delete for good"}
            </button>
            <button onClick={() => { setOpen(false); setTyped(""); setError(null); }}
                    className="text-mt hover:text-white text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-mt text-xs uppercase tracking-wide">{label}</span>
      <input {...rest} className="input-select mt-1.5" />
    </label>
  );
}

/* ── menu icons ─────────────────────────────────────────────────────
   Inline rather than an icon package: nine glyphs are not worth a
   dependency the organiser downloads on mobile data. */
const ico = {
  width: 15, height: 15, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  className: "shrink-0",
};
function IconMatches() {
  return <svg {...ico}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
}
function IconStandings() {
  return <svg {...ico}><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
}
function IconBrackets() {
  return <svg {...ico}><path d="M4 5h5v5H4zM4 14h5v5H4zM15 9h5v6h-5zM9 7.5h3v9h3" /></svg>;
}
function IconTeams() {
  return <svg {...ico}><path d="M12 3l7 3v5c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6l7-3Z" /></svg>;
}
function IconPlayers() {
  return <svg {...ico}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /></svg>;
}
function IconStructure() {
  return <svg {...ico}><path d="M12 3l9 5-9 5-9-5 9-5Z" /><path d="M3 13l9 5 9-5" /></svg>;
}
function IconVenues() {
  return <svg {...ico}><path d="M3 20h18M5 20V9l7-5 7 5v11" /><path d="M9 20v-6h6v6" /></svg>;
}
function IconBan() {
  return <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>;
}
function IconRules() {
  return <svg {...ico}><path d="M4 5h16M4 10h10M4 15h16M4 20h10" /></svg>;
}
function IconInfo() {
  return <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}
function IconProof() {
  return <svg {...ico}><path d="M6 3h8l4 4v14H6zM14 3v4h4" /><path d="M9 13l2 2 4-4" /></svg>;
}
function IconPeople() {
  return <svg {...ico}><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6M18 19c0-2-.8-3.6-2-4.5" /></svg>;
}

/* ── regulations ────────────────────────────────────────────────────
   What a result is worth, and the order level teams are separated in.
   Both are stored per competition, so neither is a constant anywhere in
   the standings calculation. */
function RegulationsSection({ t, editable, onChanged }: {
  t: Tournament; editable: boolean; onChanged: () => void;
}) {
  const [pts, setPts] = useState({
    win:  t.points_rules?.win  ?? 3,
    draw: t.points_rules?.draw ?? 1,
    loss: t.points_rules?.loss ?? 0,
  });

  // Selected keeps its order, because the order IS the rule. Anything
  // not selected sits in the available list.
  const [selected, setSelected] = useState<string[]>(
    (t.tiebreakers || []).filter((x) => TIEBREAKERS.some((o) => o.id === x))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const available = TIEBREAKERS.filter((o) => !selected.includes(o.id));
  const labelOf = (id: string) => TIEBREAKERS.find((o) => o.id === id)?.label ?? id;
  const isLive = (id: string) => TIEBREAKERS.find((o) => o.id === id)?.implemented ?? false;

  const move = (i: number, by: number) => {
    const next = [...selected];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next); setSaved(false);
  };

  const num = (k: keyof typeof pts) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === "" ? 0 : Number(e.target.value);
    setPts({ ...pts, [k]: Number.isFinite(v) ? v : 0 });
    setSaved(false);
  };

  // Checked here as well as on the server, so the organiser is told
  // before the round trip rather than after it.
  const localProblem =
    pts.win < pts.draw ? "A win can't be worth less than a draw."
    : pts.draw < pts.loss ? "A draw can't be worth less than a loss."
    : [pts.win, pts.draw, pts.loss].some((v) => v < 0 || v > 10)
      ? "Points must be between 0 and 10."
      : null;

  const save = async () => {
    if (localProblem) { setError(localProblem); return; }
    setBusy(true); setError(null); setSaved(false);
    try {
      await updateTournament(t.id, { points_rules: pts, tiebreakers: selected });
      setSaved(true);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* points */}
      <div className="card">
        <p className="section-label mb-1">Points system</p>
        <p className="text-mt text-xs mb-4">
          Applied to every result as the table is built. Change it and the
          table recalculates, including matches already played.
        </p>
        <div className="flex flex-wrap gap-4">
          {([["win", "Win"], ["draw", "Draw"], ["loss", "Loss"]] as const).map(([k, label]) => (
            <label key={k} className="block">
              {/* block, not inline: a w-24 input stays on the same line as
                  an inline label and the pair reads as one run of text. */}
              <span className="block text-mt text-xs uppercase tracking-wide">{label}</span>
              <input
                type="number" min={0} max={10} disabled={!editable}
                value={pts[k]} onChange={num(k)}
                className="input-select mt-1.5 w-24 disabled:opacity-50"
              />
            </label>
          ))}
        </div>
      </div>

      {/* tiebreakers */}
      <div className="card">
        <p className="section-label mb-1">Tiebreakers</p>
        <p className="text-mt text-xs mb-4">
          When teams are level on points, these are applied in order, top
          first.
        </p>

        {selected.length === 0 ? (
          <p className="text-mt text-sm mb-4">
            None chosen. Teams level on points are ordered by name.
          </p>
        ) : (
          <ol className="space-y-2 mb-4">
            {selected.map((id, i) => (
              <li key={id}
                  className="flex items-center gap-3 bg-sur2 border border-bd
                             rounded-lg px-3 py-2">
                <span className="font-mono text-[11px] text-mt2 w-4">{i + 1}</span>
                <span className="text-white text-sm flex-1">{labelOf(id)}</span>
                {!isLive(id) && (
                  <span className="font-mono text-[10px] text-amber">not applied yet</span>
                )}
                {editable && (
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                            aria-label={`Move ${labelOf(id)} up`}
                            className="text-mt hover:text-white disabled:opacity-25 px-1">
                      ↑
                    </button>
                    <button type="button" onClick={() => move(i, 1)}
                            disabled={i === selected.length - 1}
                            aria-label={`Move ${labelOf(id)} down`}
                            className="text-mt hover:text-white disabled:opacity-25 px-1">
                      ↓
                    </button>
                    <button type="button"
                            onClick={() => { setSelected(selected.filter((x) => x !== id)); setSaved(false); }}
                            aria-label={`Remove ${labelOf(id)}`}
                            className="text-mt hover:text-red2 px-1">
                      ×
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {editable && available.length > 0 && (
          <>
            <p className="text-mt text-xs mb-2">Available</p>
            <div className="flex flex-wrap gap-2">
              {available.map((o) => (
                <button
                  key={o.id} type="button"
                  onClick={() => { setSelected([...selected, o.id]); setSaved(false); }}
                  className="border border-bd text-mt hover:text-volt hover:border-volt/40
                             rounded-lg px-3 py-1.5 text-xs transition-colors"
                >
                  + {o.label}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="text-mt2 text-xs mt-4">
          Head to head is stored but not applied yet. Doing it properly means
          building a mini table among only the tied teams, and the pairwise
          shortcut gives the wrong answer for a three-way tie, so it is left
          out rather than approximated.
        </p>
      </div>

      {(localProblem || error) && (
        <p className="text-red2 text-sm font-semibold">{localProblem || error}</p>
      )}
      {saved && !error && !localProblem && (
        <p className="text-grn text-sm font-semibold">Saved. The table has recalculated.</p>
      )}

      {editable ? (
        <button className="btn-volt" disabled={busy || Boolean(localProblem)} onClick={save}>
          {busy ? "Saving..." : "Save regulations"}
        </button>
      ) : (
        <p className="text-mt2 text-xs">
          {t.status === "pending"
            ? "Locked while we review it."
            : "Only the owner can change these."}
        </p>
      )}
    </div>
  );
}

/* ── venues ─────────────────────────────────────────────────────────
   Per competition, not global: the same pitch is "Main Bowl" to one
   organiser and "ABU Sports Complex Pitch 1" to another, and a shared
   list would have them renaming each other's grounds. */
function VenuesSection({ tid, editable }: { tid: string; editable: boolean }) {
  const [rows, setRows] = useState<Venue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const blank = { name: "", city: "", address: "", capacity: "" };
  const [f, setF] = useState(blank);

  const load = useCallback(() => {
    listVenues(tid).then((d) => { setRows(d.venues); setError(null); })
      .catch((e) => setError(e.message));
  }, [tid]);
  useEffect(() => { load(); }, [load]);

  const body = () => ({
    name: f.name.trim(),
    city: f.city.trim() || null,
    address: f.address.trim() || null,
    capacity: f.capacity.trim() === "" ? null : Number(f.capacity),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true); setError(null);
    try {
      if (editing) await updateVenue(tid, editing, body());
      else await addVenue(tid, body());
      setF(blank); setEditing(null); load();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const edit = (v: Venue) => {
    setEditing(v.id);
    setF({
      name: v.name, city: v.city || "", address: v.address || "",
      capacity: v.capacity == null ? "" : String(v.capacity),
    });
  };

  const remove = async (v: Venue) => {
    setBusy(true); setError(null);
    try { await deleteVenue(tid, v.id); load(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (rows === null && !error) return <p className="text-mt text-sm">Loading...</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      {rows && rows.length === 0 && (
        <div className="card">
          <p className="text-white font-semibold">No venues yet</p>
          <p className="text-mt text-sm mt-1">
            Add the grounds your matches are played at, then pick one per
            fixture instead of typing it every time.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(rows || []).map((v) => (
          <div key={v.id} className="card flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white font-semibold truncate">{v.name}</p>
              <p className="text-mt text-xs mt-1">
                {[v.city, v.address].filter(Boolean).join(" • ") || "No address"}
                {v.capacity != null && ` • holds ${v.capacity.toLocaleString()}`}
              </p>
            </div>
            {editable && (
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => edit(v)}
                        className="text-mt hover:text-volt text-sm font-semibold">
                  Edit
                </button>
                <button onClick={() => remove(v)} disabled={busy}
                        className="text-mt hover:text-red2 text-sm font-semibold">
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editable && (
        <form onSubmit={submit} className="card space-y-3">
          <p className="section-label">{editing ? "Edit venue" : "Add a venue"}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Name" value={f.name} required
                   onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Input label="City" value={f.city}
                   onChange={(e) => setF({ ...f, city: e.target.value })} />
            <Input label="Address" value={f.address}
                   onChange={(e) => setF({ ...f, address: e.target.value })} />
            <Input label="Capacity" type="number" min={0} value={f.capacity}
                   onChange={(e) => setF({ ...f, capacity: e.target.value })} />
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-volt" disabled={busy || !f.name.trim()}>
              {busy ? "Saving..." : editing ? "Save venue" : "Add venue"}
            </button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setF(blank); }}
                      className="text-mt hover:text-white text-sm font-semibold">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <p className="text-mt2 text-xs">
        Removing a venue leaves the name on fixtures already played there.
        Deleting a ground should not erase where matches happened.
      </p>
    </div>
  );
}

/* ── sub-competitions ───────────────────────────────────────────────
   The named parts a competition divides into. The backend keeps
   tournament_teams.group_name equal to the part's name, because that
   column is what standings and fixture generation read. */
function SubCompetitions({ tid, editable, onChanged }: {
  tid: string; editable: boolean; onChanged: () => void;
}) {
  const [subs, setSubs] = useState<SubCompetition[] | null>(null);
  const [loose, setLoose] = useState<TeamRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SubCompKind>("group");
  const [target, setTarget] = useState<string>("");

  const load = useCallback(() => {
    listSubCompetitions(tid)
      .then((d) => { setSubs(d.sub_competitions); setLoose(d.unassigned); setError(null); })
      .catch((e) => setError(e.message));
  }, [tid]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); load(); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (subs === null && !error) return <p className="text-mt text-sm">Loading...</p>;

  return (
    <div className="card space-y-4">
      <div>
        <p className="section-label mb-1">Parts of this competition</p>
        <p className="text-mt text-xs">
          Groups, a league phase, a knockout. A team in a part appears in that
          part&apos;s table.
        </p>
      </div>

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      <div className="space-y-2">
        {(subs || []).map((sc) => (
          <div key={sc.id} className="bg-sur2 border border-bd rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">{sc.name}</p>
                <p className="text-mt text-xs mt-0.5 capitalize">
                  {sc.kind} • {sc.teams.length} {sc.teams.length === 1 ? "team" : "teams"}
                </p>
              </div>
              {editable && (
                <button disabled={busy}
                        onClick={() => run(() => deleteSubCompetition(tid, sc.id))}
                        className="text-mt hover:text-red2 text-xs font-semibold shrink-0">
                  Remove
                </button>
              )}
            </div>

            {sc.teams.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {sc.teams.map((tm) => (
                  <span key={tm.id}
                        className="inline-flex items-center gap-1.5 bg-sur border border-bd
                                   rounded-md px-2 py-1 text-xs text-mt">
                    {tm.clubs?.name ?? "Unknown"}
                    {editable && (
                      <button disabled={busy}
                              onClick={() => run(() => unassignTeam(tid, tm.id))}
                              aria-label={`Remove ${tm.clubs?.name} from ${sc.name}`}
                              className="hover:text-red2">
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {loose.length > 0 && (
        <div className="border-t border-bd pt-4">
          <p className="text-mt text-xs mb-2">
            Not placed yet ({loose.length}). These sit outside every table until
            they are put somewhere.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {loose.map((tm) => (
              <span key={tm.id}
                    className="bg-sur2 border border-amber/30 rounded-md px-2 py-1
                               text-xs text-amber">
                {tm.clubs?.name ?? "Unknown"}
              </span>
            ))}
          </div>

          {editable && (subs || []).length > 0 && (
            <div className="flex flex-wrap items-end gap-2 mt-3">
              <label className="block">
                <span className="block text-mt text-xs uppercase tracking-wide">Place all in</span>
                <select className="input-select mt-1.5 w-auto" value={target}
                        onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Choose...</option>
                  {(subs || []).map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </label>
              <button disabled={busy || !target}
                      onClick={() => run(() => assignTeams(tid, target, loose.map((x) => x.id)))}
                      className="btn-volt text-[13px] px-4 py-2 disabled:opacity-40">
                Place {loose.length}
              </button>
            </div>
          )}
        </div>
      )}

      {editable && (
        <form className="border-t border-bd pt-4 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                run(async () => {
                  await addSubCompetition(tid, {
                    name: name.trim(), kind, sort_order: (subs || []).length,
                  });
                  setName("");
                });
              }}>
          <label className="block flex-1 min-w-[160px]">
            <span className="block text-mt text-xs uppercase tracking-wide">Name</span>
            <input className="input-select mt-1.5" value={name} placeholder="Group A"
                   onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-mt text-xs uppercase tracking-wide">Kind</span>
            <select className="input-select mt-1.5 w-auto" value={kind}
                    onChange={(e) => setKind(e.target.value as SubCompKind)}>
              {SUB_KINDS.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
          </label>
          <button className="btn-volt text-[13px] px-4 py-2"
                  disabled={busy || !name.trim()}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}

/* ── suspensions ────────────────────────────────────────────────────
   A ban is a record with a start date, not a countdown: a countdown has
   to be decremented by something, and nothing reliably runs between
   matches. The organiser closes it out when it is served. */
function SuspensionsSection({ tid, teams, editable }: {
  tid: string; teams: TeamRow[]; editable: boolean;
}) {
  const [rows, setRows] = useState<Suspension[] | null>(null);
  const [served, setServed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const [teamId, setTeamId] = useState("");
  const [squad, setSquad] = useState<any[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [matches, setMatches] = useState("1");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    listSuspensions(tid, served)
      .then((d) => { setRows(d.suspensions); setError(null); })
      .catch((e) => setError(e.message));
  }, [tid, served]);
  useEffect(() => { load(); }, [load]);

  // The player list follows the team, because a ban is always against a
  // player registered to that team in this competition.
  useEffect(() => {
    if (!teamId) { setSquad([]); setPlayerId(""); return; }
    squadOf(teamId).then((d: any) => setSquad(d.squad || [])).catch(() => setSquad([]));
  }, [teamId]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !playerId) return;
    run(async () => {
      await addSuspension(tid, {
        tournament_team_id: teamId, player_id: playerId,
        matches: Number(matches) || 1, start_date: startDate,
        reason: reason.trim() || null,
      });
      setOpen(false); setTeamId(""); setPlayerId(""); setMatches("1"); setReason("");
    });
  };

  if (rows === null && !error) return <p className="text-mt text-sm">Loading...</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-mt text-sm">
          <input type="checkbox" checked={served}
                 onChange={(e) => setServed(e.target.checked)} />
          Include bans already served
        </label>
        {editable && !open && (
          <button className="btn-volt text-[13px] px-4 py-2" onClick={() => setOpen(true)}>
            Add suspension
          </button>
        )}
      </div>

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      {editable && open && (
        <form onSubmit={submit} className="card space-y-3">
          <p className="section-label">Add suspension</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-mt text-xs uppercase tracking-wide">Team</span>
              <select className="input-select mt-1.5" value={teamId} required
                      onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Choose a team</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>{tm.clubs?.name ?? "Unknown"}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-mt text-xs uppercase tracking-wide">Player</span>
              <select className="input-select mt-1.5" value={playerId} required
                      disabled={!teamId} onChange={(e) => setPlayerId(e.target.value)}>
                <option value="">
                  {!teamId ? "Pick a team first"
                    : squad.length ? "Choose a player" : "Nobody registered yet"}
                </option>
                {squad.map((r: any) => (
                  <option key={r.players?.id ?? r.id} value={r.players?.id ?? ""}>
                    {r.jersey_number ? `#${r.jersey_number} ` : ""}
                    {r.players?.first_name} {r.players?.last_name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Matches" type="number" min={1} max={50} value={matches}
                   onChange={(e) => setMatches(e.target.value)} />
            <Input label="Starts" type="date" value={startDate}
                   onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <Input label="Reason" value={reason} placeholder="Violent conduct, 78'"
                 onChange={(e) => setReason(e.target.value)} />
          <div className="flex items-center gap-3">
            <button className="btn-volt" disabled={busy || !teamId || !playerId}>
              {busy ? "Saving..." : "Add suspension"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
                    className="text-mt hover:text-white text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      {rows && rows.length === 0 && (
        <div className="card">
          <p className="text-white font-semibold">Nobody suspended</p>
          <p className="text-mt text-sm mt-1">
            Bans logged here show against the player for the rest of the
            competition.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(rows || []).map((sp) => (
          <div key={sp.id} className="card flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={clsx("font-semibold truncate",
                                 sp.active ? "text-white" : "text-mt line-through")}>
                {sp.players?.first_name} {sp.players?.last_name}
              </p>
              <p className="text-mt text-xs mt-1">
                {sp.tournament_teams?.clubs?.name ?? "Unknown team"} •{" "}
                {sp.matches} {sp.matches === 1 ? "match" : "matches"} • from{" "}
                <span className="font-mono">{sp.start_date}</span>
              </p>
              {sp.reason && <p className="text-mt text-sm mt-2">{sp.reason}</p>}
            </div>
            {editable && (
              <div className="flex items-center gap-3 shrink-0">
                {sp.active && (
                  <button disabled={busy} onClick={() => run(() => markServed(tid, sp.id))}
                          className="text-mt hover:text-grn text-sm font-semibold">
                    Mark served
                  </button>
                )}
                <button disabled={busy} onClick={() => run(() => deleteSuspension(tid, sp.id))}
                        className="text-mt hover:text-red2 text-sm font-semibold">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-mt2 text-xs">
        Nothing expires a ban automatically. Mark it served when it has been,
        which keeps the disciplinary record of the competition intact rather
        than deleting it.
      </p>
    </div>
  );
}
