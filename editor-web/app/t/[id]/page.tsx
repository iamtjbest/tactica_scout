"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import Guard from "@/components/Guard";
import StatusPill from "@/components/StatusPill";
import Crest from "@/components/Crest";
import Bracket from "@/components/Bracket";
import StandingsTable from "@/components/StandingsTable";
import AccessTab from "@/components/AccessTab";
import {
  getTournament, getReadiness, submitForReview, unpublish,
  searchClubs, addTeam, removeTeam,
  generateFixtures, clearFixtures, setScore,
  addProof, deleteProof,
  listSquad, registerPlayer, unregisterPlayer, searchPlayers,
  uploadCrest, removeCrest, bulkFixtures, getStandings, sortRounds,
  type Tournament, type TeamRow, type Fixture, type Proof, type Readiness,
  type StandingRow,
} from "@/lib/api";

type Tab = "teams" | "fixtures" | "table" | "proof" | "access";

export default function Page() {
  return <Guard><Detail /></Guard>;
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    tournament: Tournament; teams: TeamRow[]; proofs: Proof[]; fixtures: Fixture[];
  } | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [tab, setTab] = useState<Tab>("teams");
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
  // Mirrors EDITABLE_STATUSES on the backend. Hiding the controls is a
  // courtesy; the server refuses the write regardless.
  const editable =
    (t.status === "draft" || t.status === "rejected") &&
    (role === "owner" || role === "editor");

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display font-black text-2xl text-white truncate">{t.name}</h1>
          <p className="text-mt text-sm mt-1">
            {t.organizing_body} • {t.level} • {t.format.replace("_", " + ")}
          </p>
        </div>
        <StatusPill status={t.status} />
      </div>

      {t.status === "rejected" && t.rejection_reason && (
        <div className="card border-red2/40">
          <p className="section-label mb-2">Changes needed</p>
          <p className="text-white text-sm">{t.rejection_reason}</p>
          <p className="text-mt text-xs mt-2">Fix these and submit again.</p>
        </div>
      )}

      {role === "owner" && (
        <SubmitBar t={t} ready={ready} editable={editable} onChanged={load} />
      )}
      {role !== "owner" && (
        <p className="text-mt2 text-xs">
          You&apos;re a {role} on this tournament.
          {role === "scorer" && " You can update scores and log match events."}
        </p>
      )}

      <div className="flex gap-2">
        {(["teams", "fixtures", "table", "proof", "access"] as Tab[]).map((x) => (
          <button key={x} onClick={() => setTab(x)}
            className={clsx("tab-pill", tab === x ? "tab-pill-active" : "tab-pill-inactive")}>
            {x === "proof" ? "Proof" : x[0].toUpperCase() + x.slice(1)}
            {x !== "table" && x !== "access" && (
              <span className="ml-1.5 text-mt2">
                {x === "teams" ? data.teams.length
                  : x === "fixtures" ? data.fixtures.length
                  : data.proofs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "teams" && (
        <TeamsTab tid={id} teams={data.teams} editable={editable} onChanged={load} />
      )}
      {tab === "fixtures" && (
        <FixturesTab tid={id} teams={data.teams} fixtures={data.fixtures}
                     format={t.format} editable={editable} onChanged={load} />
      )}
      {tab === "table" && <TableTab tid={id} />}
      {tab === "access" && <AccessTab tid={id} isOwner={role === "owner"} />}
      {tab === "proof" && (
        <ProofTab tid={id} proofs={data.proofs} editable={editable} onChanged={load} />
      )}
    </div>
  );
}

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
      <div className="card">
        <p className="text-white text-sm">Submitted and waiting on review.</p>
        <p className="text-mt text-xs mt-1">
          Teams and fixtures are locked while we look at it, so what gets
          reviewed is what gets published.
        </p>
      </div>
    );
  }

  if (t.status === "approved") {
    return (
      <div className="card flex items-center justify-between gap-4">
        <div>
          <p className="text-white text-sm">Live on Scout.</p>
          <p className="text-mt text-xs mt-1">Fans can follow it and see the table.</p>
        </div>
        <button className="text-mt hover:text-red2 text-sm font-semibold"
                disabled={busy} onClick={() => act(() => unpublish(t.id))}>
          Unpublish
        </button>
      </div>
    );
  }

  if (!editable) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label mb-2">Before it can go live</p>
          {ready?.ready ? (
            <p className="text-grn text-sm">Everything's in place.</p>
          ) : (
            <ul className="space-y-1">
              {ready?.missing.map((m) => (
                <li key={m} className="text-mt text-sm">Still needs {m}</li>
              ))}
            </ul>
          )}
        </div>
        <button className="btn-volt shrink-0" disabled={busy || !ready?.ready}
                onClick={() => act(() => submitForReview(t.id))}>
          {busy ? "Sending..." : "Submit for review"}
        </button>
      </div>
      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
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
