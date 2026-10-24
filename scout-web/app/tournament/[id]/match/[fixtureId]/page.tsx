"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  getTournamentMatch, getMatchRatings, getMyVotes, ratePlayer, voteMotm,
  type TournamentMatch, type TournamentMatchEvent, type TournamentSheet,
  type MatchRatings, type MyVotes,
} from "@/lib/api";

type Tab = "lineups" | "timeline" | "ratings";

/**
 * One match in a local competition.
 *
 * This is the page the ratings feature needed and didn't have: the
 * backend has accepted source="local" since it was written, but there
 * was nowhere in Scout to show a local fixture at all.
 */
export default function TournamentMatchPage() {
  const { id, fixtureId } = useParams<{ id: string; fixtureId: string }>();
  const [d, setD] = useState<TournamentMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Opens on Lineups when there is a team sheet, because that is the
  // thing people check before kickoff; otherwise the timeline.
  const [tab, setTab] = useState<Tab>("timeline");
  const [tabPicked, setTabPicked] = useState(false);

  useEffect(() => {
    getTournamentMatch(id, fixtureId)
      .then((x) => {
        setD(x); setError(null);
        if (!tabPicked && x.lineup_status === "confirmed") setTab("lineups");
      })
      .catch((e) => setError(e.message));
  }, [id, fixtureId, tabPicked]);

  if (error) {
    return (
      <main className="max-w-screen-md mx-auto px-4 pt-6 pb-24">
        <p className="text-red2 text-sm font-semibold">{error}</p>
      </main>
    );
  }
  if (!d) return <main className="px-4 pt-6"><p className="text-mt text-sm">Loading...</p></main>;

  const fx = d.fixture;
  const live = ["live", "ht"].includes(String(fx.status).toLowerCase());

  return (
    <main className="max-w-screen-md mx-auto px-4 pt-4 pb-24">
      <Link href={`/tournament/${id}`} className="text-mt text-xs hover:text-white">
        ← Competition
      </Link>

      <div className="card mt-3">
        <div className="flex items-center justify-between gap-4">
          <TeamLine name={fx.home_team} crest={fx.home_crest} />
          <div className="text-center shrink-0">
            <p className="font-display font-black text-2xl text-white">
              {fx.home_score ?? "–"} : {fx.away_score ?? "–"}
            </p>
            <p className={clsx("font-mono text-[10px] mt-0.5",
                               live ? "text-red2" : "text-mt2")}>
              {live ? "LIVE" : String(fx.status).toUpperCase()}
            </p>
          </div>
          <TeamLine name={fx.away_team} crest={fx.away_crest} align="right" />
        </div>
        <p className="text-mt2 text-[11px] font-mono text-center mt-3">
          {fx.kickoff_at
            ? new Date(fx.kickoff_at).toLocaleString("en-GB", {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit",
              })
            : ""}
          {fx.venue ? ` • ${fx.venue}` : ""}
          {fx.round ? ` • ${fx.round}` : ""}
        </p>
      </div>

      <div className="flex gap-2 mt-4">
        {(["lineups", "timeline", "ratings"] as Tab[]).map((x) => (
          <button key={x} onClick={() => { setTab(x); setTabPicked(true); }}
                  className={clsx("tab-pill capitalize",
                    tab === x ? "tab-pill-active" : "tab-pill-inactive")}>
            {x}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "lineups" && (
          <Lineups d={d} homeLabel={fx.home_team ?? "Home"}
                   awayLabel={fx.away_team ?? "Away"} tournamentId={id} />
        )}
        {tab === "timeline" && (
          <Timeline events={d.events} fx={fx} tournamentId={id} />
        )}
        {tab === "ratings" && (
          <LocalRatings matchRef={fixtureId} match={d} tournamentId={id}
                        homeLabel={fx.home_team ?? "Home"}
                        awayLabel={fx.away_team ?? "Away"} />
        )}
      </div>
    </main>
  );
}

function TeamLine({ name, crest, align = "left" }: {
  name: string | null; crest: string | null; align?: "left" | "right";
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join("");
  return (
    <div className={clsx("flex items-center gap-2 min-w-0 flex-1",
                         align === "right" && "flex-row-reverse text-right")}>
      {crest && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crest} alt="" onError={() => setFailed(true)}
             className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-7 h-7 rounded-full bg-sur2 border border-bd text-mt text-[10px]
                         font-bold flex items-center justify-center shrink-0">
          {initials}
        </span>
      )}
      <span className="text-white text-sm font-semibold truncate">{name ?? "Unknown"}</span>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  goal: "Goal", own_goal: "Own goal", penalty: "Penalty",
  penalty_missed: "Penalty missed", yellow_card: "Yellow",
  red_card: "Red", substitution: "Sub", assist: "Assist",
};

/**
 * The event_type enum is 'yellow' / 'red' / 'second_yellow', not
 * 'yellow_card' / 'red_card'. Matching on the long names meant every
 * tag fell through to the volt accent, so a booking looked like a goal.
 */
function eventTone(type: string): string {
  const t = String(type).toLowerCase();
  if (t === "red" || t === "red_card" || t.includes("second_yellow")) {
    return "bg-red2/15 text-red2";
  }
  if (t.includes("yellow")) return "bg-amber/15 text-amber";
  if (t.includes("miss")) return "bg-white/5 text-mt";
  return "bg-volt/10 text-volt";
}

function Timeline({ events, fx, tournamentId }: {
  events: TournamentMatchEvent[]; fx: any; tournamentId: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-mt text-sm">
        Nothing logged yet. The organiser adds goals and cards as they happen.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {events
        .slice()
        .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
        .map((e) => (
          <div key={e.id} className="card flex items-center gap-3">
            <span className="font-mono text-[11px] text-mt w-9 shrink-0">
              {e.minute != null ? `${e.minute}'` : "--"}
            </span>
            <span className={clsx(
              "text-[10px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0",
              eventTone(e.type)
            )}>
              {EVENT_LABEL[e.type] ?? e.type}
            </span>
            {e.players ? (
              <Link
                href={`/tournament/${tournamentId}/player/${e.players.id}`}
                className="text-white text-sm truncate flex-1 hover:text-volt"
              >
                {`${e.players.first_name} ${e.players.last_name}`.trim()}
              </Link>
            ) : (
              <span className="text-white text-sm truncate flex-1">—</span>
            )}
            <span className="text-mt2 text-[11px] truncate shrink-0 max-w-[40%]">
              {e.side === "home" ? fx.home_team : fx.away_team}
            </span>
          </div>
        ))}
    </div>
  );
}

/* Halves only, same as the BSD ratings tab and the backend. */
const STEPS = [4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];

/**
 * Ratings for a local fixture.
 *
 * The rateable list comes from the match events rather than a lineup,
 * because a local competition has no published XI: who actually played
 * is whoever the organiser logged. That means only players involved in
 * an incident can be rated, which is the honest limit of what we know.
 */
function LocalRatings({ matchRef, match, homeLabel, awayLabel, tournamentId }: {
  matchRef: string; match: TournamentMatch;
  homeLabel: string; awayLabel: string; tournamentId: string;
}) {
  const [data, setData] = useState<MatchRatings | null>(null);
  const [mine, setMine] = useState<MyVotes | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getMatchRatings("local", matchRef)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
    getMyVotes("local", matchRef)
      .then((m) => { setMine(m); setSignedIn(true); })
      .catch(() => { setMine(null); setSignedIn(false); });
  }, [matchRef]);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (!data && !error) return <p className="text-mt text-sm">Loading ratings...</p>;
  if (!data) return <p className="text-red2 text-sm font-semibold">{error}</p>;

  // Everyone on the team sheet, starters and bench. This is the whole
  // point of the organiser entering one: before it existed, only
  // players who picked up a goal or a card could be rated, so someone
  // could have the game of his life and be unratable.
  const seen = new Map<string, { name: string; side: "home" | "away" }>();
  for (const side of ["home", "away"] as const) {
    const sheet = match.lineups?.[side];
    for (const p of [...(sheet?.starters ?? []), ...(sheet?.substitutes ?? [])]) {
      seen.set(p.player_id, { name: p.name, side });
    }
  }

  // No sheet entered: fall back to whoever appears in the events, so
  // the tab still works for an organiser who never filled one in.
  if (seen.size === 0) {
    for (const e of match.events) {
      if (!e.players) continue;
      seen.set(e.players.id, {
        name: `${e.players.first_name} ${e.players.last_name}`,
        side: e.side,
      });
    }
  }
  const byRef = new Map(data.players.map((p) => [p.player_ref, p]));
  const open = data.window.open;

  // Array.from, not a spread: this project targets ES5, where
  // spreading a Map needs downlevelIteration and won't compile.
  const entries = Array.from(seen.entries());
  const sides: { label: string; refs: string[] }[] = [
    { label: homeLabel, refs: entries.filter(([, v]) => v.side === "home").map(([k]) => k) },
    { label: awayLabel, refs: entries.filter(([, v]) => v.side === "away").map(([k]) => k) },
  ];

  return (
    <div className="space-y-4">
      <div className={clsx("card", open && "border-volt/35")}>
        <p className="text-white text-sm font-semibold">
          {open ? "Voting is open" : "Voting is closed"}
        </p>
        <p className="text-mt text-xs mt-1">
          {open
            ? "Rate the players and pick your Man of the Match. Closes 30 minutes after full time."
            : data.window.reason}
        </p>
        {signedIn === false && (
          <p className="text-mt text-xs mt-2">
            <Link href="/signin" className="text-volt font-semibold hover:underline">
              Sign in
            </Link>{" "}
            to vote.
          </p>
        )}
      </div>

      {data.motm.total_votes > 0 && (
        <div className="card">
          <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-3">
            Man of the Match · {data.motm.total_votes}{" "}
            {data.motm.total_votes === 1 ? "vote" : "votes"}
          </p>
          <div className="space-y-2">
            {data.motm.leaders.map((m) => (
              <div key={m.player_ref} className="flex items-center gap-3">
                <span className="text-white text-xs w-28 truncate">
                  {seen.get(m.player_ref)?.name ?? "Player"}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-sur2 overflow-hidden">
                  <div className="h-full bg-volt rounded-full" style={{ width: `${m.share}%` }} />
                </div>
                <span className="text-mt font-mono text-[11px] w-9 text-right">{m.share}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      {seen.size === 0 && (
        <p className="text-mt text-sm">
          Nobody to rate yet. The organiser hasn&apos;t entered a team sheet,
          and nobody has been logged in the match yet.
        </p>
      )}

      {sides.map((side) =>
        side.refs.length === 0 ? null : (
          <div key={side.label} className="card">
            <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-2">
              {side.label}
            </p>
            <div className="divide-y divide-bd/40">
              {side.refs.map((ref) => {
                const agg = byRef.get(ref);
                const my = mine?.ratings?.[ref];
                const isMotm = mine?.motm === ref;
                const canVote = open && signedIn === true;

                return (
                  <div key={ref} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/tournament/${tournamentId}/player/${ref}`}
                          className="text-white text-sm truncate block hover:text-volt"
                        >
                          {seen.get(ref)?.name}
                        </Link>
                        <p className="text-mt text-[11px]">
                          {agg?.enough_votes
                            // The average is already the big number beside it.
                            ? `${agg.votes} ${agg.votes === 1 ? "vote" : "votes"}`
                            : agg
                              ? `${agg.votes} of ${data.min_votes} votes needed`
                              : "No votes yet"}
                          {my != null && ` · you gave ${my}`}
                        </p>
                      </div>
                      {agg?.enough_votes && (
                        <span className="font-display font-black text-white text-base">
                          {agg.average}
                        </span>
                      )}
                      {canVote && (
                        <button
                          onClick={() => act(`motm-${ref}`, () => voteMotm("local", matchRef, ref))}
                          disabled={busy != null}
                          className={clsx(
                            "text-xs font-bold px-2 py-1 rounded-md border transition-colors shrink-0",
                            isMotm
                              ? "border-volt text-volt bg-volt/10"
                              : "border-bd text-mt hover:text-volt hover:border-volt/40"
                          )}
                        >
                          MOTM
                        </button>
                      )}
                    </div>

                    {canVote && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {STEPS.map((v) => (
                          <button
                            key={v}
                            onClick={() => act(`${ref}-${v}`,
                              () => ratePlayer("local", matchRef, ref, v))}
                            disabled={busy != null}
                            className={clsx(
                              "w-9 h-7 rounded-md text-[11px] font-bold transition-colors",
                              my === v ? "bg-volt text-bg" : "bg-sur2 text-mt hover:text-white"
                            )}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      <p className="text-mt2 text-xs">
        An average appears once {data.min_votes} people have rated a player, so
        one person can&apos;t publish a score against someone on their own.
      </p>
    </div>
  );
}

/* ── team sheets ────────────────────────────────────────────────────
   The XI on a pitch, laid out from the formation the organiser entered,
   with the bench underneath. Same layout rule as the BSD lineups: the
   formation drives the rows, because bucketing by position string turns
   a 4-2-3-1 into a 4-5-1. */
function parseFormation(formation: unknown): number[] | null {
  const raw = String(formation ?? "").trim();
  if (!raw) return null;
  const parts = raw.includes("-") ? raw.split("-") : raw.split("");
  const rows = parts.map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
  if (rows.length < 2) return null;
  if (rows.reduce((a, b) => a + b, 0) !== 10) return null;
  return rows;
}

const POS_RANK = (p: any) => {
  const pos = String(p?.position ?? "").toUpperCase();
  if (pos.startsWith("G")) return 0;
  if (pos.startsWith("D")) return 1;
  if (pos.startsWith("M")) return 2;
  return 3;
};

/** Narrow rows stay central: a two-man pivot spread full width ends up
 *  standing where the full-backs should be. */
const ROW_WIDTH: Record<number, string> = {
  1: "42%", 2: "60%", 3: "84%", 4: "100%", 5: "100%",
};

function Lineups({ d, homeLabel, awayLabel, tournamentId }: {
  d: TournamentMatch; homeLabel: string; awayLabel: string; tournamentId: string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");

  if (d.lineup_status !== "confirmed") {
    return (
      <div className="card text-center py-10">
        <p className="text-white font-semibold">No team sheet yet</p>
        <p className="text-mt text-sm mt-1 max-w-sm mx-auto">
          The organiser enters the starting XI and the bench from the editor.
          Once they do, it shows here and everyone on it can be rated.
        </p>
      </div>
    );
  }

  const sheet = d.lineups[side];
  const starters = sheet.starters;
  const ordered = starters.slice().sort((a, b) => POS_RANK(a) - POS_RANK(b));
  const shape = parseFormation(sheet.formation);

  let rows: typeof ordered[] = [];
  if (shape && ordered.length === 11) {
    rows = [[ordered[0]]];
    let i = 1;
    for (const n of shape) { rows.push(ordered.slice(i, i + n)); i += n; }
  } else {
    const buckets: typeof ordered[] = [[], [], [], []];
    for (const p of ordered) buckets[POS_RANK(p)].push(p);
    rows = buckets.filter((r) => r.length > 0);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["home", "away"] as const).map((x) => (
          <button key={x} onClick={() => setSide(x)}
                  className={clsx("tab-pill flex-1 truncate",
                    side === x ? "tab-pill-active" : "tab-pill-inactive")}>
            {x === "home" ? homeLabel : awayLabel}
          </button>
        ))}
      </div>

      <p className="text-center text-mt text-xs font-mono">
        {sheet.formation ?? "—"}
      </p>

      <div className="relative bg-[#0F1A14] border border-bd rounded-xl overflow-hidden
                      mx-auto w-full max-w-[340px]" style={{ aspectRatio: "3 / 4" }}>
        <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />
        <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2
                        rounded-full border border-white/10" />
        <div className="absolute left-1/2 bottom-0 w-[55%] h-[16%] -translate-x-1/2
                        border-x border-t border-white/10" />
        <div className="absolute left-1/2 top-0 w-[55%] h-[16%] -translate-x-1/2
                        border-x border-b border-white/10" />

        <div className="absolute inset-0 flex flex-col-reverse justify-around py-3">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-around items-start mx-auto"
                 style={{ width: ROW_WIDTH[row.length] ?? "100%" }}>
              {row.map((p) => (
                <Link
                  key={p.player_id}
                  href={`/tournament/${tournamentId}/player/${p.player_id}`}
                  className="flex flex-col items-center w-14 shrink-0 group"
                >
                  <span className="w-8 h-8 rounded-full bg-sur2 border border-bd
                                   flex items-center justify-center
                                   group-hover:border-volt transition-colors">
                    <span className="text-volt text-[11px] font-bold">
                      {p.shirt_number ?? ""}
                    </span>
                  </span>
                  <span className="text-white text-[10px] font-semibold text-center
                                   mt-1 leading-tight truncate w-full
                                   group-hover:text-volt transition-colors">
                    {p.name}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-2">
          Substitutes
        </p>
        {sheet.substitutes.length === 0 ? (
          <p className="text-mt text-xs">None named.</p>
        ) : (
          <div className="divide-y divide-bd/40">
            {sheet.substitutes.map((p) => (
              <Link
                key={p.player_id}
                href={`/tournament/${tournamentId}/player/${p.player_id}`}
                className="flex items-center gap-3 py-1.5 hover:text-volt"
              >
                <span className="font-mono text-[11px] text-mt w-7">
                  {p.shirt_number != null ? `#${p.shirt_number}` : ""}
                </span>
                <span className="text-white text-xs flex-1 truncate
                                 hover:text-volt">{p.name}</span>
                {p.position && (
                  <span className="text-mt text-[10px] font-mono uppercase">{p.position}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
