"use client";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  getLineup, setLineup, clearLineup,
  type FixtureLineup, type SideSheet, type SquadEntry,
} from "@/lib/api";
import {
  FORMATIONS, FORMATION_NAMES, normalizePosGroup, POS_GROUP_LABELS, type PosGroup,
} from "@/lib/formations";

export default function TeamSheet({ fixtureId, homeName, awayName }: {
  fixtureId: string; homeName: string; awayName: string;
}) {
  const [data, setData] = useState<FixtureLineup | null>(null);
  const [side, setSide] = useState<"home" | "away">("home");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [formation, setFormation] = useState<string>("4-3-3");
  // slotIndex (0..10) -> player_id
  const [slotMap, setSlotMap] = useState<Record<number, string>>({});
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [shirts, setShirts] = useState<Record<string, number | null>>({});

  const load = useCallback(() => {
    getLineup(fixtureId)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [fixtureId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    const s = data.lineups[side];
    const fName = s.formation && FORMATIONS[s.formation] ? s.formation : "4-3-3";
    const slots = FORMATIONS[fName];

    const nextSlots: Record<number, string> = {};
    const used = new Set<string>();
    const sh: Record<string, number | null> = {};

    // Match saved starters into matching role/group slots
    s.starters.forEach((st, idx) => {
      sh[st.player_id] = st.shirt_number;
      let targetIdx = slots.findIndex(
        (sl) => !nextSlots[sl.index] && sl.role.toLowerCase() === (st.position || "").toLowerCase()
      );
      if (targetIdx === -1) {
        const grp = normalizePosGroup(st.position);
        targetIdx = slots.findIndex((sl) => !nextSlots[sl.index] && sl.group === grp);
      }
      if (targetIdx === -1) {
        targetIdx = slots.findIndex((sl) => !nextSlots[sl.index]);
      }
      if (targetIdx !== -1 && !used.has(st.player_id)) {
        nextSlots[targetIdx] = st.player_id;
        used.add(st.player_id);
      } else if (idx < 11 && !used.has(st.player_id)) {
        nextSlots[idx] = st.player_id;
        used.add(st.player_id);
      }
    });

    const nextBench: string[] = [];
    for (const sub of s.substitutes) {
      sh[sub.player_id] = sub.shirt_number;
      if (!used.has(sub.player_id)) nextBench.push(sub.player_id);
    }

    setFormation(fName);
    setSlotMap(nextSlots);
    setBenchIds(nextBench);
    setShirts(sh);
    setSaved(false);
  }, [data, side]);

  if (error && !data) return <p className="text-red2 text-sm font-semibold">{error}</p>;
  if (!data) return <p className="text-mt text-sm">Loading team sheet...</p>;

  const sheet: SideSheet = data.lineups[side];
  const squad = sheet.squad;
  const slots = FORMATIONS[formation] || FORMATIONS["4-3-3"];

  const starterIdToRole = new Map<string, string>();
  Object.entries(slotMap).forEach(([idxStr, pid]) => {
    if (pid) {
      const sl = slots.find((x) => x.index === Number(idxStr));
      starterIdToRole.set(pid, sl?.role ?? "XI");
    }
  });

  const assignSlot = (slotIdx: number, pid: string) => {
    setSaved(false);
    setSlotMap((prev) => {
      const next = { ...prev };
      // Remove pid from any other slot first
      for (const k of Object.keys(next)) {
        if (next[Number(k)] === pid) delete next[Number(k)];
      }
      if (pid) next[slotIdx] = pid;
      else delete next[slotIdx];
      return next;
    });
    if (pid) {
      setBenchIds((prev) => prev.filter((x) => x !== pid));
    }
  };

  const quickAssignToXI = (r: SquadEntry) => {
    const pid = r.players?.id;
    if (!pid) return;
    if (starterIdToRole.has(pid)) {
      // Remove from XI
      setSaved(false);
      setSlotMap((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[Number(k)] === pid) delete next[Number(k)];
        }
        return next;
      });
      return;
    }
    const grp = normalizePosGroup(r.position || (r.players as any)?.position);
    let openSlot = slots.find((sl) => !slotMap[sl.index] && sl.group === grp);
    if (!openSlot) openSlot = slots.find((sl) => !slotMap[sl.index]);
    if (openSlot) {
      assignSlot(openSlot.index, pid);
    } else {
      // XI full -> place on bench
      toggleBench(pid);
    }
  };

  const toggleBench = (pid: string) => {
    setSaved(false);
    // Remove from XI if currently starting
    setSlotMap((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[Number(k)] === pid) delete next[Number(k)];
      }
      return next;
    });
    setBenchIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
    );
  };

  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const starters = slots
        .filter((sl) => Boolean(slotMap[sl.index]))
        .map((sl) => {
          const pid = slotMap[sl.index];
          const reg = squad.find((r) => r.players?.id === pid);
          return {
            player_id: pid,
            shirt_number: shirts[pid] ?? reg?.jersey_number ?? null,
            position: sl.role,
          };
        });

      const substitutes = benchIds.map((pid) => {
        const reg = squad.find((r) => r.players?.id === pid);
        return {
          player_id: pid,
          shirt_number: shirts[pid] ?? reg?.jersey_number ?? null,
          position: reg?.position ?? null,
        };
      });

      await setLineup(fixtureId, {
        tournament_team_id: sheet.tournament_team_id,
        formation,
        starters,
        substitutes,
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

  const starterCount = Object.values(slotMap).filter(Boolean).length;
  const groups: PosGroup[] = ["GK", "DEF", "MID", "FWD"];

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="section-label">Matchday Team Sheet</p>
            <p className="text-mt text-xs mt-0.5">
              Choose the formation, match players to their positions, and set the bench.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className={starterCount === 11 ? "text-grn font-bold" : "text-amber font-bold"}>
              {starterCount}/11 Starting
            </span>
            <span className="text-mt">{benchIds.length} Bench</span>
          </div>
        </div>

        {/* Team Switcher */}
        <div className="flex gap-2">
          {(["home", "away"] as const).map((x) => (
            <button key={x} onClick={() => setSide(x)}
                    className={clsx("tab-pill flex-1 truncate",
                      side === x ? "tab-pill-active" : "tab-pill-inactive")}>
              {x === "home" ? homeName : awayName}
            </button>
          ))}
        </div>

        {/* Formation Selector */}
        <div>
          <span className="block text-mt text-[11px] font-mono uppercase tracking-wider mb-1.5">
            1. Select Formation
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FORMATION_NAMES.map((f) => (
              <button key={f} type="button"
                      onClick={() => { setFormation(f); setSaved(false); }}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                        formation === f ? "bg-volt text-bg" : "bg-sur2 text-mt hover:text-white"
                      )}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* 11 Tactical Position Slots grouped by line */}
        {squad.length === 0 ? (
          <p className="text-mt text-sm py-4">
            No players registered to this team yet. Register players under the Players tab first.
          </p>
        ) : (
          <div className="space-y-3 pt-2 border-t border-bd">
            <span className="block text-mt text-[11px] font-mono uppercase tracking-wider">
              2. Starting XI Position Assignments ({formation})
            </span>

            {groups.map((grp) => {
              const lineSlots = slots.filter((sl) => sl.group === grp);
              return (
                <div key={grp} className="bg-sur2/50 border border-bd/60 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-volt">
                    {POS_GROUP_LABELS[grp]}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lineSlots.map((sl) => {
                      const assignedPid = slotMap[sl.index] ?? "";
                      // Sort squad so matching position players appear first
                      const sortedSquad = [...squad].sort((a, b) => {
                        const aMatch = normalizePosGroup(a.position || (a.players as any)?.position) === grp ? 0 : 1;
                        const bMatch = normalizePosGroup(b.position || (b.players as any)?.position) === grp ? 0 : 1;
                        return aMatch - bMatch;
                      });

                      return (
                        <div key={sl.index} className="flex items-center gap-2">
                          <span className="w-12 text-center font-mono text-xs font-bold py-2 rounded-lg bg-bg border border-bd text-volt shrink-0">
                            {sl.role}
                          </span>
                          <select
                            value={assignedPid}
                            onChange={(e) => assignSlot(sl.index, e.target.value)}
                            className="input-select text-xs flex-1"
                          >
                            <option value="">— Select {sl.role} —</option>
                            {sortedSquad.map((r) => {
                              const pid = r.players?.id ?? "";
                              const posTag = (r.position || (r.players as any)?.position || "").toUpperCase();
                              const takenElsewhere = starterIdToRole.has(pid) && assignedPid !== pid;
                              return (
                                <option key={pid} value={pid} disabled={takenElsewhere}>
                                  {r.jersey_number != null ? `#${r.jersey_number} ` : ""}
                                  {r.players?.first_name} {r.players?.last_name}
                                  {posTag ? ` (${posTag})` : ""}
                                  {takenElsewhere ? ` [In ${starterIdToRole.get(pid)}]` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Squad Grouped by Position (Quick Toggle XI / Bench + Shirt #) */}
      {squad.length > 0 && (
        <div className="card space-y-4">
          <div>
            <p className="section-label">3. Full Squad by Position &amp; Substitutes</p>
            <p className="text-mt text-xs mt-0.5">
              Tap XI to auto-place into an open matching slot, or Bench to add to substitutes.
            </p>
          </div>

          {groups.map((grp) => {
            const members = squad.filter(
              (r) => normalizePosGroup(r.position || (r.players as any)?.position) === grp
            );
            if (members.length === 0) return null;
            return (
              <div key={grp} className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-mt border-b border-bd/50 pb-1">
                  {POS_GROUP_LABELS[grp]} ({members.length})
                </p>
                <div className="divide-y divide-bd/40">
                  {members.map((r) => {
                    const pid = r.players?.id ?? "";
                    const assignedRole = starterIdToRole.get(pid);
                    const isBench = benchIds.includes(pid);
                    return (
                      <div key={r.id} className="flex items-center gap-2.5 py-2">
                        <button
                          type="button"
                          onClick={() => quickAssignToXI(r)}
                          className={clsx(
                            "px-2.5 py-1.5 rounded-md text-[10px] font-bold shrink-0 transition-colors",
                            assignedRole
                              ? "bg-volt text-bg"
                              : "bg-sur2 text-mt hover:text-white"
                          )}
                        >
                          {assignedRole ? `XI • ${assignedRole}` : "+ XI"}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleBench(pid)}
                          className={clsx(
                            "px-2.5 py-1.5 rounded-md text-[10px] font-bold shrink-0 transition-colors",
                            isBench
                              ? "bg-cyan/20 text-cyan border border-cyan/40"
                              : "bg-sur2 text-mt hover:text-white"
                          )}
                        >
                          BENCH
                        </button>

                        <span className="text-white text-sm flex-1 truncate">
                          {r.players?.first_name} {r.players?.last_name}
                        </span>

                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={shirts[pid] ?? r.jersey_number ?? ""}
                          onChange={(e) => {
                            setSaved(false);
                            setShirts({
                              ...shirts,
                              [pid]: e.target.value === "" ? null : Number(e.target.value),
                            });
                          }}
                          placeholder="#"
                          className="w-14 bg-sur2 border border-bd rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-volt"
                        />
                      </div>
                    );
                  })}
                </div>
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