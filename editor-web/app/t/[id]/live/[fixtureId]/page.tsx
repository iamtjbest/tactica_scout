"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import Guard from "@/components/Guard";
import {
  getTournament, setScore, listEvents, addEvent, deleteEvent,
  listSquad, type Fixture, type TeamRow, type MatchEvent,
} from "@/lib/api";

/**
 * Pitchside screen. Big targets, few taps, works on a phone.
 *
 * The scoreboard and the event log are separate on purpose, the same
 * way the backend keeps them apart. A scorer needs to put 1-0 up the
 * second it goes in, and fill in who scored whenever there's a moment.
 * Forcing both at once is how you end up with neither.
 */
const EVENTS = [
  { id: "goal",            label: "Goal" },
  { id: "penalty_scored",  label: "Pen scored" },
  { id: "penalty_missed",  label: "Pen missed" },
  { id: "own_goal",        label: "Own goal" },
  { id: "yellow",          label: "Yellow" },
  { id: "second_yellow",   label: "2nd yellow" },
  { id: "red",             label: "Red" },
];

export default function Page() {
  return <Guard><Live /></Guard>;
}

function Live() {
  const { id, fixtureId } = useParams<{ id: string; fixtureId: string }>();
  const [fx, setFx] = useState<Fixture | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [implied, setImplied] = useState<{ home: number; away: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [minute, setMinute] = useState("");

  const load = useCallback(() => {
    getTournament(id).then((d) => {
      setTeams(d.teams);
      setFx(d.fixtures.find((f) => f.id === fixtureId) ?? null);
    }).catch((e) => setError(e.message));
    listEvents(fixtureId).then((d) => setEvents(d.events)).catch(() => {});
  }, [id, fixtureId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-red2 text-sm font-semibold">{error}</p>;
  if (!fx) return <p className="text-mt text-sm">Loading...</p>;

  const name = (tid: string) => teams.find((t) => t.id === tid)?.clubs?.name ?? "Unknown";
  const home = fx.home_score ?? 0;
  const away = fx.away_score ?? 0;

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

  const log = async (teamId: string, type: string) => {
    setError(null);
    try {
      const r = await addEvent(fixtureId, {
        tournament_team_id: teamId,
        type,
        // Minute comes from the field above, not a browser prompt: a
        // modal blocks the whole screen and is miserable one-handed at
        // the side of a pitch. Blank is allowed, the minute can be
        // filled in later.
        minute: minute.trim() === "" ? null : Number(minute),
      });
      setImplied(r.score_from_events);
      setMinute("");
      load();
    } catch (e: any) { setError(e.message); }
  };

  const mismatch =
    implied && (implied.home !== home || implied.away !== away);

  return (
    <div className="space-y-5">
      <Link href={`/t/${id}`} className="text-mt text-sm hover:text-white">
        &larr; Back to tournament
      </Link>

      {/* scoreboard */}
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
        {/* The backend refuses ft without both scores, so this says why
            before the user taps it rather than after. */}
        {(fx.home_score == null || fx.away_score == null) && (
          <p className="text-mt2 text-xs text-center mt-3">
            Set both scores before marking the match finished.
          </p>
        )}
        {error && <p className="text-red2 text-sm font-semibold text-center mt-3">{error}</p>}
      </div>

      {/* events say one thing, scoreboard says another */}
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

      {/* event entry */}
      <div className="card">
        <label className="flex items-center gap-3">
          <span className="text-mt text-xs uppercase tracking-wide shrink-0">Minute</span>
          <input
            type="number" min={0} max={130} inputMode="numeric"
            className="input-select" value={minute}
            onChange={(e) => setMinute(e.target.value)}
            placeholder="Leave blank if you're not sure"
          />
        </label>
        <p className="text-mt2 text-xs mt-2">
          Applies to the next event you log, then clears.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[fx.home_team_id, fx.away_team_id].map((teamId) => (
          <div key={teamId} className="card">
            <p className="text-white text-sm font-semibold truncate mb-3">{name(teamId)}</p>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map((e) => (
                <button key={e.id} onClick={() => log(teamId, e.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-sur2 hover:bg-bd text-xs text-white">
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* timeline */}
      <div className="card">
        <p className="section-label mb-3">Timeline</p>
        {events.length === 0 ? (
          <p className="text-mt text-sm">Nothing logged yet.</p>
        ) : (
          <div className="space-y-1">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1">
                <span className="text-white/90">
                  <span className="text-mt font-mono mr-2">
                    {e.minute != null ? `${e.minute}'` : "--"}
                  </span>
                  {e.type.replace("_", " ")}
                  {e.players ? ` — ${e.players.first_name} ${e.players.last_name}` : ""}
                  <span className="text-mt2 ml-2">{name(e.tournament_team_id)}</span>
                </span>
                <button className="text-mt hover:text-red2 text-xs"
                        onClick={async () => {
                          try { await deleteEvent(fixtureId, e.id); load(); }
                          catch (err: any) { setError(err.message); }
                        }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Side({ label, score, busy, onUp, onDown }: {
  label: string; score: number; busy: boolean;
  onUp: () => void; onDown: () => void;
}) {
  return (
    <div className="text-center">
      <p className="text-white text-sm truncate mb-2">{label}</p>
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
