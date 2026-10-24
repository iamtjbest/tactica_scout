"use client";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  getLineup, setLineup, clearLineup,
  type FixtureLineup, type SideSheet, type SquadEntry,
} from "@/lib/api";

/**
 * Team sheet entry, pitchside.
 *
 * Tap a name once to put him in the XI, again to move him to the bench,
 * again to take him out. One target per player, no drag, no dropdowns:
 * this gets filled in on a phone, standing up, often on a bad
 * connection, from a piece of paper a captain just handed over.
 *
 * The sheet is what Scout rates. Before it existed the only rateable
 * players were the ones who picked up a goal or a card, so someone
 * could have the game of his life and be unratable.
 */
type Pick = "none" | "starter" | "substitute";

const FORMATIONS = [
  "4-4-2", "4-3-3", "4-2-3-1", "4-1-4-1", "3-5-2", "3-4-3", "5-3-2", "4-5-1",
];

export default function TeamSheet({ fixtureId, homeName, awayName }: {
  fixtureId: string; homeName: string; awayName: string;
}) {
  const [data, setData] = useState<FixtureLineup | null>(null);
  const [side, setSide] = useState<"home" | "away">("home");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local edits, keyed by player. Held until Save so a half-filled sheet
  // on a dropping connection isn't written a row at a time.
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [shirts, setShirts] = useState<Record<string, number | null>>({});
  const [formation, setFormation] = useState<string>("");

  const load = useCallback(() => {
    getLineup(fixtureId)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [fixtureId]);

  useEffect(() => { load(); }, [load]);

  // Reset the working copy whenever the side or the server data changes,
  // so switching tabs never carries one team's picks onto the other.
  useEffect(() => {
    if (!data) return;
    const s = data.lineups[side];
    const p: Record<string, Pick> = {};
    const sh: Record<string, number | null> = {};
    for (const r of s.starters) { p[r.player_id] = "starter"; sh[r.player_id] = r.shirt_number; }
    for (const r of s.substitutes) { p[r.player_id] = "substitute"; sh[r.player_id] = r.shirt_number; }
    setPicks(p); setShirts(sh); setFormation(s.formation ?? ""); setSaved(false);
  }, [data, side]);

  if (error && !data) return <p className="text-red2 text-sm font-semibold">{error}</p>;
  if (!data) return <p className="text-mt text-sm">Loading team sheet...</p>;

  const sheet: SideSheet = data.lineups[side];
  const squad = sheet.squad;

  const starters = squad.filter((r) => picks[r.players?.id ?? ""] === "starter");
  const subs = squad.filter((r) => picks[r.players?.id ?? ""] === "substitute");

  const cycle = (pid: string) => {
    setSaved(false);
    setPicks((prev) => {
      const now = prev[pid] ?? "none";
      // Eleven is eleven. Rather than silently refusing the tap, the
      // twelfth goes to the bench, which is almost always what was meant.
      const next: Pick =
        now === "none"
          ? (starters.length >= 11 ? "substitute" : "starter")
          : now === "starter" ? "substitute" : "none";
      return { ...prev, [pid]: next };
    });
  };

  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const pack = (role: Pick) =>
        squad
          .filter((r) => picks[r.players?.id ?? ""] === role)
          .map((r) => ({
            player_id: r.players!.id,
            shirt_number: shirts[r.players!.id] ?? r.jersey_number ?? null,
            position: r.position ?? null,
          }));

      await setLineup(fixtureId, {
        tournament_team_id: sheet.tournament_team_id,
        formation: formation || null,
        starters: pack("starter"),
        substitutes: pack("substitute"),
      });
      setSaved(true);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    setBusy(true); setError(null);
    try { await clearLineup(fixtureId, sheet.tournament_team_id); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card space-y-4">
      <div>
        <p className="section-label mb-1">Team sheet</p>
        <p className="text-mt text-xs">
          Tap a name: once for the XI, again for the bench, again to remove.
          Everyone named here can be rated by fans in Scout.
        </p>
      </div>

      <div className="flex gap-2">
        {(["home", "away"] as const).map((x) => (
          <button key={x} onClick={() => setSide(x)}
                  className={clsx("tab-pill flex-1 truncate",
                    side === x ? "tab-pill-active" : "tab-pill-inactive")}>
            {x === "home" ? homeName : awayName}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={clsx("font-mono text-xs",
                              starters.length === 11 ? "text-grn" : "text-amber")}>
          {starters.length}/11 starting
        </span>
        <span className="font-mono text-xs text-mt">{subs.length} on the bench</span>
      </div>

      <label className="block">
        <span className="block text-mt text-xs uppercase tracking-wide">Formation</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {FORMATIONS.map((f) => (
            <button key={f} onClick={() => { setFormation(f === formation ? "" : f); setSaved(false); }}
                    className={clsx(
                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                      formation === f ? "bg-volt text-bg" : "bg-sur2 text-mt hover:text-white"
                    )}>
              {f}
            </button>
          ))}
        </div>
      </label>

      {squad.length === 0 ? (
        <p className="text-mt text-sm">
          Nobody registered to this team yet. Add players under Players first.
        </p>
      ) : (
        <div className="divide-y divide-bd/40">
          {squad.map((r: SquadEntry) => {
            const pid = r.players?.id ?? "";
            const pick = picks[pid] ?? "none";
            return (
              <div key={r.id} className="flex items-center gap-3 py-2">
                <button
                  onClick={() => cycle(pid)}
                  className={clsx(
                    "w-16 shrink-0 text-[10px] font-bold py-1.5 rounded-md transition-colors",
                    pick === "starter" ? "bg-volt text-bg"
                      : pick === "substitute" ? "bg-cyan/15 text-cyan border border-cyan/30"
                      : "bg-sur2 text-mt hover:text-white"
                  )}
                >
                  {pick === "starter" ? "XI" : pick === "substitute" ? "BENCH" : "OUT"}
                </button>
                <span className="text-white text-sm flex-1 truncate">
                  {r.players?.first_name} {r.players?.last_name}
                </span>
                <input
                  type="number" min={1} max={99}
                  value={shirts[pid] ?? r.jersey_number ?? ""}
                  onChange={(e) => {
                    setSaved(false);
                    setShirts({ ...shirts, [pid]: e.target.value === "" ? null : Number(e.target.value) });
                  }}
                  placeholder="#"
                  className="w-14 bg-sur2 border border-bd rounded-lg px-2 py-1 text-white
                             text-xs text-center focus:outline-none focus:border-volt"
                />
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
      {saved && !error && <p className="text-grn text-sm font-semibold">Team sheet saved.</p>}

      <div className="flex items-center gap-4">
        <button className="btn-volt" disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save team sheet"}
        </button>
        {(sheet.starters.length > 0 || sheet.substitutes.length > 0) && (
          <button onClick={wipe} disabled={busy}
                  className="text-mt hover:text-red2 text-sm font-semibold">
            Clear this side
          </button>
        )}
      </div>
    </div>
  );
}
