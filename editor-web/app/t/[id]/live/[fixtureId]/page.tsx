"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import Guard from "@/components/Guard";
import TeamSheet from "@/components/TeamSheet";
import {
  getTournament, getLineup, setScore, listEvents, addEvent, deleteEvent,
  type Fixture, type TeamRow, type MatchEvent, type FixtureLineup,
} from "@/lib/api";

type PrimaryEvent = "goal" | "penalty" | "own_goal" | "yellow" | "second_yellow" | "red" | "substitution";
type PenaltyOutcome = "penalty_scored" | "penalty_saved" | "penalty_missed";

const PRIMARY_EVENTS: { id: PrimaryEvent; label: string }[] = [
  { id: "goal",          label: "Goal" },
  { id: "penalty",       label: "Penalty" },
  { id: "own_goal",      label: "Own Goal" },
  { id: "yellow",        label: "Yellow Card" },
  { id: "second_yellow", label: "2nd Yellow" },
  { id: "red",           label: "Red Card" },
  { id: "substitution",  label: "Substitution" },
];

const PENALTY_OUTCOMES: { id: PenaltyOutcome; label: string }[] = [
  { id: "penalty_scored", label: "Penalty Scored" },
  { id: "penalty_saved",  label: "Penalty Saved" },
  { id: "penalty_missed", label: "Penalty Missed" },
];

export default function Page() {
  return <Guard><Live /></Guard>;
}

function Live() {
  const { id, fixtureId } = useParams<{ id: string; fixtureId: string }>();
  const [fx, setFx] = useState<Fixture | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [lineupData, setLineupData] = useState<FixtureLineup | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [implied, setImplied] = useState<{ home: number; away: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pane, setPane] = useState<"match" | "sheet">("match");

  // Structured Event Form State
  const [teamSide, setTeamSide] = useState<"home" | "away">("home");
  const [primaryType, setPrimaryType] = useState<PrimaryEvent>("goal");
  const [penaltyOutcome, setPenaltyOutcome] = useState<PenaltyOutcome>("penalty_scored");
  const [minute, setMinute] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [relatedPlayerId, setRelatedPlayerId] = useState("");
  const [syncScore, setSyncScore] = useState(true);

  const load = useCallback(() => {
    getTournament(id).then((d) => {
      setTeams(d.teams);
      setFx(d.fixtures.find((f) => f.id === fixtureId) ?? null);
    }).catch((e) => setError(e.message));
    getLineup(fixtureId).then(setLineupData).catch(() => {});
    listEvents(fixtureId).then((d) => setEvents(d.events)).catch(() => {});
  }, [id, fixtureId]);

  useEffect(() => { load(); }, [load]);

  if (error && !fx) return <p className="text-red2 text-sm font-semibold">{error}</p>;
  if (!fx) return <p className="text-mt text-sm">Loading...</p>;

  const name = (tid: string) => teams.find((t) => t.id === tid)?.clubs?.name ?? "Unknown";
  const home = fx.home_score ?? 0;
  const away = fx.away_score ?? 0;

  const activeTeamId = teamSide === "home" ? fx.home_team_id : fx.away_team_id;
  const opposingTeamId = teamSide === "home" ? fx.away_team_id : fx.home_team_id;

  const teamPlayers = (tid: string) => {
    if (!lineupData) return [];
    const sideObj = tid === fx.home_team_id ? lineupData.lineups.home : lineupData.lineups.away;
    return (sideObj?.squad ?? [])
      .filter((r) => r.players?.id)
      .map((r) => ({
        id: r.players!.id,
        pos: (r.position || "").toUpperCase(),
        label: `${r.jersey_number != null ? `#${r.jersey_number} ` : ""}${r.players!.first_name} ${r.players!.last_name}`.trim(),
      }));
  };

  const activeSquad = teamPlayers(activeTeamId);
  const opposingSquad = [...teamPlayers(opposingTeamId)].sort((a, b) =>
    (a.pos.startsWith("G") ? 0 : 1) - (b.pos.startsWith("G") ? 0 : 1)
  );

  const resolvedEventType = primaryType === "penalty" ? penaltyOutcome : primaryType;
  const isScoringEvent = resolvedEventType === "goal" || resolvedEventType === "penalty_scored";
  const isOwnGoal = resolvedEventType === "own_goal";

  const push = async (patch: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try { setFx(await setScore(fixtureId, patch)); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const bump = (side: "home" | "away", by: number) =>
    push({
      [`${side}_score`]: Math.max(0, (side === "home" ? home : away) + by),
      ...(fx.status === "scheduled" ? { status: "live" } : {}),
    });

  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await addEvent(fixtureId, {
        tournament_team_id: activeTeamId,
        type: resolvedEventType,
        player_id: playerId || null,
        related_player_id: relatedPlayerId || null,
        minute: minute.trim() === "" ? null : Number(minute),
      });
      setImplied(r.score_from_events);

      // Automatically update scoreboard when logging Goal, Penalty Scored, or Own Goal
      if (syncScore && (isScoringEvent || isOwnGoal)) {
        const creditSide: "home" | "away" = isOwnGoal
          ? (teamSide === "home" ? "away" : "home")
          : teamSide;
        const nextHome = creditSide === "home" ? home + 1 : home;
        const nextAway = creditSide === "away" ? away + 1 : away;
        await setScore(fixtureId, {
          home_score: nextHome,
          away_score: nextAway,
          ...(fx.status === "scheduled" ? { status: "live" } : {}),
        });
      }

      setMinute("");
      setPlayerId("");
      setRelatedPlayerId("");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const mismatch = implied && (implied.home !== home || implied.away !== away);

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-5">
      <Link href={`/t/${id}`} className="text-mt text-sm hover:text-white">
        &larr; Back to tournament
      </Link>

      <div className="flex gap-2">
        {([["match", "Score & events"], ["sheet", "Team sheet"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setPane(k)}
                  className={clsx("tab-pill",
                    pane === k ? "tab-pill-active" : "tab-pill-inactive")}>
            {label}
          </button>
        ))}
      </div>

      {pane === "sheet" && (
        <TeamSheet
          fixtureId={fixtureId}
          homeName={name(fx.home_team_id)}
          awayName={name(fx.away_team_id)}
        />
      )}

      {pane === "match" && (
        <>
          {/* Scoreboard */}
          <div className="card">
            <div className="grid grid-cols-3 items-center gap-2">
              <Side label={name(fx.home_team_id)} score={home} busy={busy}
                    onUp={() => bump("home", 1)} onDown={() => bump("home", -1)} />
              <p className="text-center text-mt text-xs font-mono uppercase">
                {fx.status}
              </p>
              <Side label={name(fx.away_team_id)} score={away} busy={busy}
                    onUp={() => bump("away", 1)} onDown={() => bump("away", -1)} />
            </div>

            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              {["live", "ht", "ft", "postponed"].map((s) => (
                <button key={s} disabled={busy}
                        onClick={() => push({ status: s })}
                        className={clsx("tab-pill",
                          fx.status === s ? "tab-pill-active" : "tab-pill-inactive")}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
            {(fx.home_score == null || fx.away_score == null) && (
              <p className="text-mt2 text-xs text-center mt-3">
                Set both scores before marking the match finished.
              </p>
            )}
          </div>

          {mismatch && (
            <div className="card border-amber/40">
              <p className="text-amber text-sm">
                The event log adds up to {implied!.home}-{implied!.away}, the
                scoreboard says {home}-{away}.
              </p>
              <p className="text-mt text-xs mt-1">
                Neither is changed automatically. Fix whichever is wrong.
              </p>
            </div>
          )}

          {/* Structured Match Event Builder */}
          <form onSubmit={submitEvent} className="card space-y-4">
            <p className="section-label">Log Match Event</p>

            {/* Step 1: Team */}
            <div>
              <span className="block text-mt text-[11px] font-mono uppercase tracking-wider mb-1.5">
                1. Team
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(["home", "away"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => { setTeamSide(s); setPlayerId(""); setRelatedPlayerId(""); }}
                    className={clsx(
                      "py-2.5 px-3 rounded-lg text-sm font-bold border truncate transition-colors",
                      teamSide === s
                        ? "bg-volt/15 border-volt text-volt"
                        : "bg-sur2 border-bd text-mt hover:text-white"
                    )}
                  >
                    {s === "home" ? name(fx.home_team_id) : name(fx.away_team_id)}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Event Type */}
            <div>
              <span className="block text-mt text-[11px] font-mono uppercase tracking-wider mb-1.5">
                2. Event Type
              </span>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_EVENTS.map((ev) => (
                  <button
                    type="button"
                    key={ev.id}
                    onClick={() => { setPrimaryType(ev.id); setRelatedPlayerId(""); }}
                    className={clsx(
                      "px-3 py-2 rounded-lg text-xs font-bold transition-colors",
                      primaryType === ev.id
                        ? "bg-volt text-bg"
                        : "bg-sur2 text-white hover:bg-bd"
                    )}
                  >
                    {ev.label}
                  </button>
                ))}
              </div>

              {/* Conditional Penalty Outcome Sub-selector */}
              {primaryType === "penalty" && (
                <div className="mt-3 p-3 rounded-xl bg-sur2/70 border border-volt/30 space-y-2">
                  <span className="block text-volt text-[10px] font-mono uppercase tracking-wider">
                    Penalty Outcome
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PENALTY_OUTCOMES.map((po) => (
                      <button
                        type="button"
                        key={po.id}
                        onClick={() => { setPenaltyOutcome(po.id); setRelatedPlayerId(""); }}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                          penaltyOutcome === po.id
                            ? "bg-volt text-bg border-volt"
                            : "bg-bg border-bd text-mt hover:text-white"
                        )}
                      >
                        {po.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Minute + Player(s) Affected */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-mt text-[11px] uppercase tracking-wide">
                  3. Minute (0–130)
                </span>
                <input
                  type="number"
                  min={0}
                  max={130}
                  inputMode="numeric"
                  className="input-select mt-1"
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  placeholder="e.g. 42"
                />
              </label>

              <label className="block">
                <span className="text-mt text-[11px] uppercase tracking-wide">
                  {primaryType === "substitution"
                    ? "4. Player Off"
                    : primaryType === "penalty"
                    ? "4. Penalty Taker"
                    : primaryType === "goal"
                    ? "4. Goal Scorer"
                    : "4. Player Affected"}
                </span>
                <select
                  className="input-select mt-1"
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                >
                  <option value="">Select player...</option>
                  {activeSquad.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{p.pos ? ` (${p.pos})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {/* Conditional 2nd Player Field: Assist / Goalkeeper Save / Sub On */}
              {primaryType === "goal" && (
                <label className="block">
                  <span className="text-mt text-[11px] uppercase tracking-wide">
                    5. Assist By (Optional)
                  </span>
                  <select
                    className="input-select mt-1"
                    value={relatedPlayerId}
                    onChange={(e) => setRelatedPlayerId(e.target.value)}
                  >
                    <option value="">No assist / Solo goal</option>
                    {activeSquad
                      .filter((p) => p.id !== playerId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}{p.pos ? ` (${p.pos})` : ""}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {resolvedEventType === "penalty_saved" && (
                <label className="block">
                  <span className="text-volt text-[11px] uppercase tracking-wide">
                    5. Saved By ({teamSide === "home" ? name(fx.away_team_id) : name(fx.home_team_id)})
                  </span>
                  <select
                    className="input-select mt-1"
                    value={relatedPlayerId}
                    onChange={(e) => setRelatedPlayerId(e.target.value)}
                  >
                    <option value="">Select Goalkeeper...</option>
                    {opposingSquad.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}{p.pos ? ` (${p.pos})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {primaryType === "substitution" && (
                <label className="block">
                  <span className="text-mt text-[11px] uppercase tracking-wide">
                    5. Player Coming On
                  </span>
                  <select
                    className="input-select mt-1"
                    value={relatedPlayerId}
                    onChange={(e) => setRelatedPlayerId(e.target.value)}
                  >
                    <option value="">Select substitute...</option>
                    {activeSquad
                      .filter((p) => p.id !== playerId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}{p.pos ? ` (${p.pos})` : ""}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>

            {(isScoringEvent || isOwnGoal) && (
              <label className="flex items-center gap-2 text-xs text-mt cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncScore}
                  onChange={(e) => setSyncScore(e.target.checked)}
                />
                Also add +1 to {isOwnGoal ? (teamSide === "home" ? name(fx.away_team_id) : name(fx.home_team_id)) : name(activeTeamId)}&apos;s scoreboard
              </label>
            )}

            {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

            <button type="submit" disabled={busy} className="btn-volt w-full sm:w-auto">
              {busy ? "Recording..." : "Record Event"}
            </button>
          </form>

          {/* Tactica Player of the Match (POTM) */}
          <div className="card space-y-2">
            <p className="section-label">Tactica Player of the Match (POTM)</p>
            <select
              disabled={busy}
              value={(fx as any).official_motm_player_id ?? ""}
              onChange={(e) => push({ official_motm_player_id: e.target.value || null })}
              className="input-select text-sm"
            >
              <option value="">None selected yet</option>
              {[fx.home_team_id, fx.away_team_id].map((tid) => (
                <optgroup key={tid} label={name(tid)}>
                  {teamPlayers(tid).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{p.pos ? ` (${p.pos})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Live Timeline */}
          <div className="card">
            <p className="section-label mb-3">Match Timeline</p>
            {events.length === 0 ? (
              <p className="text-mt text-sm">Nothing logged yet.</p>
            ) : (
              <div className="divide-y divide-bd/40">
                {events.map((e) => {
                  const mainName = e.players
                    ? `${e.players.first_name} ${e.players.last_name}`.trim()
                    : "";
                  const relName = e.related_player
                    ? `${e.related_player.first_name} ${e.related_player.last_name}`.trim()
                    : "";
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-2">
                      <div className="min-w-0">
                        <span className="text-volt font-mono mr-2 font-bold">
                          {e.minute != null ? `${e.minute}'` : "--"}
                        </span>
                        <span className="text-white font-semibold capitalize">
                          {e.type.replace(/_/g, " ")}
                        </span>
                        {mainName && <span className="text-white/90"> — {mainName}</span>}
                        {relName && (
                          <span className="text-mt text-xs ml-1.5">
                            {e.type === "goal"
                              ? `(Assist: ${relName})`
                              : e.type === "penalty_saved"
                              ? `(Saved by: ${relName})`
                              : e.type === "substitution"
                              ? `→ In: ${relName}`
                              : `(${relName})`}
                          </span>
                        )}
                        <span className="text-mt2 text-xs ml-2">{name(e.tournament_team_id)}</span>
                      </div>
                      <button
                        className="text-mt hover:text-red2 text-xs shrink-0"
                        onClick={async () => {
                          try { await deleteEvent(fixtureId, e.id); load(); }
                          catch (err: any) { setError(err.message); }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Side({ label, score, busy, onUp, onDown }: {
  label: string; score: number; busy: boolean;
  onUp: () => void; onDown: () => void;
}) {
  return (
    <div className="text-center">
      <p className="text-white text-sm font-semibold truncate mb-2">{label}</p>
      <p className="font-display font-black text-5xl text-volt leading-none">{score}</p>
      <div className="flex justify-center gap-2 mt-3">
        <button disabled={busy} onClick={onDown}
                className="w-11 h-11 rounded-lg bg-sur2 hover:bg-bd text-white text-xl">
          &minus;
        </button>
        <button disabled={busy} onClick={onUp}
                className="w-11 h-11 rounded-lg bg-volt text-bg font-bold text-xl">
          +
        </button>
      </div>
    </div>
  );
}