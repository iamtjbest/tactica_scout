import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator,
} from "react-native";
import { COLORS } from "../theme";
import {
  getLineup, setLineup, clearLineup,
  type FixtureLineup, type SideSheet, type SquadEntry,
} from "../services/api";
import {
  FORMATIONS, FORMATION_NAMES, normalizePosGroup, POS_GROUP_LABELS, type PosGroup,
} from "../lib/formations";

export default function TeamSheet({ fixtureId, homeName, awayName }: {
  fixtureId: string; homeName: string; awayName: string;
}) {
  const [data, setData] = useState<FixtureLineup | null>(null);
  const [side, setSide] = useState<"home" | "away">("home");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [formation, setFormation] = useState("4-3-3");
  const [slotMap, setSlotMap] = useState<Record<number, string>>({});
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
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
    const sh0 = data.lineups[side];
    const fName = sh0.formation && FORMATIONS[sh0.formation] ? sh0.formation : "4-3-3";
    const slots = FORMATIONS[fName];

    const nextSlots: Record<number, string> = {};
    const used = new Set<string>();
    const sh: Record<string, number | null> = {};

    sh0.starters.forEach((st, idx) => {
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
    for (const sub of sh0.substitutes) {
      sh[sub.player_id] = sub.shirt_number;
      if (!used.has(sub.player_id)) nextBench.push(sub.player_id);
    }

    setFormation(fName);
    setSlotMap(nextSlots);
    setBenchIds(nextBench);
    setShirts(sh);
    setActiveSlotIdx(null);
    setSaved(false);
  }, [data, side]);

  if (error && !data) return <Text style={s.error}>{error}</Text>;
  if (!data) return <ActivityIndicator color={COLORS.volt} style={{ marginTop: 20 }} />;

  const sheet: SideSheet = data.lineups[side];
  const squad = sheet.squad;
  const slots = FORMATIONS[formation] || FORMATIONS["4-3-3"];

  const starterIdToRole = new Map<string, string>();
  Object.entries(slotMap).forEach(([k, pid]) => {
    if (pid) {
      const sl = slots.find((x) => x.index === Number(k));
      starterIdToRole.set(pid, sl?.role ?? "XI");
    }
  });

  const assignSlot = (slotIdx: number, pid: string) => {
    setSaved(false);
    setSlotMap((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[Number(k)] === pid) delete next[Number(k)];
      }
      if (pid) next[slotIdx] = pid;
      else delete next[slotIdx];
      return next;
    });
    if (pid) setBenchIds((prev) => prev.filter((x) => x !== pid));
    setActiveSlotIdx(null);
  };

  const quickAssignToXI = (r: SquadEntry) => {
    const pid = r.players?.id;
    if (!pid) return;
    if (activeSlotIdx !== null) {
      assignSlot(activeSlotIdx, pid);
      return;
    }
    if (starterIdToRole.has(pid)) {
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
    if (openSlot) assignSlot(openSlot.index, pid);
    else toggleBench(pid);
  };

  const toggleBench = (pid: string) => {
    setSaved(false);
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
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
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
    <View style={{ gap: 12 }}>
      <View style={s.tabs}>
        {(["home", "away"] as const).map((x) => (
          <TouchableOpacity key={x} onPress={() => setSide(x)}
                            style={[s.pill, { flex: 1 }, side === x && s.pillOn]}>
            <Text style={[s.pillText, side === x && s.pillTextOn]} numberOfLines={1}>
              {x === "home" ? homeName : awayName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.row}>
        <Text style={[s.count, starterCount === 11 ? { color: COLORS.win } : { color: "#FFB830" }]}>
          {starterCount}/11 Starting
        </Text>
        <Text style={s.mono}>{benchIds.length} on bench</Text>
      </View>

      {/* Formation Selector */}
      <View style={s.card}>
        <Text style={s.label}>1. FORMATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingTop: 6 }}>
          {FORMATION_NAMES.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => { setFormation(f); setSaved(false); }}
              style={[s.fPill, formation === f && s.fPillOn]}
            >
              <Text style={[s.fText, formation === f && { color: COLORS.bg }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 11 Formation Position Slots */}
      {squad.length > 0 ? (
        <View style={s.card}>
          <Text style={s.label}>2. STARTING XI SLOTS ({formation})</Text>
          <Text style={s.muted}>
            {activeSlotIdx !== null
              ? `Tap a player below to assign into ${slots[activeSlotIdx]?.role}`
              : "Tap a position slot below, then tap a player from the squad list."}
          </Text>
          <View style={s.wrapRow}>
            {slots.map((sl) => {
              const pid = slotMap[sl.index];
              const reg = pid ? squad.find((r) => r.players?.id === pid) : null;
              const selected = activeSlotIdx === sl.index;
              return (
                <TouchableOpacity
                  key={sl.index}
                  onPress={() => setActiveSlotIdx(selected ? null : sl.index)}
                  onLongPress={() => pid && assignSlot(sl.index, "")}
                  style={[
                    s.slotBox,
                    pid && s.slotFilled,
                    selected && { borderColor: COLORS.volt, borderWidth: 2 },
                  ]}
                >
                  <Text style={s.slotRole}>{sl.role}</Text>
                  <Text style={s.slotPlayer} numberOfLines={1}>
                    {reg ? `${reg.players?.last_name || reg.players?.first_name}` : "Empty"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Squad Grouped by Position */}
      {squad.length === 0 ? (
        <Text style={s.muted}>Nobody registered to this team yet.</Text>
      ) : (
        groups.map((grp) => {
          const members = squad.filter(
            (r) => normalizePosGroup(r.position || (r.players as any)?.position) === grp
          );
          if (members.length === 0) return null;
          return (
            <View key={grp} style={s.card}>
              <Text style={s.label}>{POS_GROUP_LABELS[grp].toUpperCase()} ({members.length})</Text>
              {members.map((r: SquadEntry) => {
                const pid = r.players?.id ?? "";
                const assignedRole = starterIdToRole.get(pid);
                const isBench = benchIds.includes(pid);
                return (
                  <View key={r.id} style={s.playerRow}>
                    <TouchableOpacity
                      onPress={() => quickAssignToXI(r)}
                      style={[s.pickBtn, assignedRole ? s.pickXI : s.pickOut]}
                    >
                      <Text style={[s.pickText, assignedRole ? { color: COLORS.bg } : { color: COLORS.textSecondary }]}>
                        {assignedRole ? `XI•${assignedRole}` : "+ XI"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleBench(pid)}
                      style={[s.pickBtn, { width: 54 }, isBench ? s.pickBench : s.pickOut]}
                    >
                      <Text style={[s.pickText, isBench ? { color: "#00E5FF" } : { color: COLORS.textSecondary }]}>
                        BENCH
                      </Text>
                    </TouchableOpacity>
                    <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>
                      {r.players?.first_name} {r.players?.last_name}
                    </Text>
                    <TextInput
                      value={String(shirts[pid] ?? r.jersey_number ?? "")}
                      onChangeText={(v) => {
                        setSaved(false);
                        setShirts({ ...shirts, [pid]: v === "" ? null : Number(v) });
                      }}
                      keyboardType="number-pad"
                      placeholder="#"
                      placeholderTextColor={COLORS.textDim}
                      style={s.shirtInput}
                    />
                  </View>
                );
              })}
            </View>
          );
        })
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
      {saved && !error ? <Text style={[s.body, { color: COLORS.win }]}>Team sheet saved.</Text> : null}

      <TouchableOpacity style={[s.btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={save}>
        <Text style={s.btnText}>{busy ? "Saving..." : "Save team sheet"}</Text>
      </TouchableOpacity>

      {sheet.starters.length > 0 || sheet.substitutes.length > 0 ? (
        <TouchableOpacity disabled={busy} onPress={wipe}>
          <Text style={s.danger}>Clear this side</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  body: { color: COLORS.text, fontSize: 13 },
  muted: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  mono: { color: COLORS.textDim, fontSize: 10 },
  count: { fontSize: 12, fontWeight: "800" },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600" },
  danger: { color: "#FF4444", fontSize: 13, fontWeight: "700", textAlign: "center" },
  tabs: { flexDirection: "row", gap: 6 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
    borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, alignItems: "center",
  },
  pillOn: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  pillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  pillTextOn: { color: COLORS.volt },
  fPill: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
  },
  fPillOn: { backgroundColor: COLORS.volt },
  fText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800" },
  slotBox: {
    width: "31%", padding: 8, borderRadius: 8,
    backgroundColor: COLORS.cardElevated, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  slotFilled: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  slotRole: { color: COLORS.volt, fontSize: 10, fontWeight: "800" },
  slotPlayer: { color: COLORS.text, fontSize: 12, fontWeight: "600", marginTop: 2 },
  playerRow: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
  },
  pickBtn: { width: 58, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  pickXI: { backgroundColor: COLORS.volt },
  pickBench: { backgroundColor: "rgba(0,229,255,0.12)", borderWidth: 1, borderColor: "rgba(0,229,255,0.3)" },
  pickOut: { backgroundColor: COLORS.cardElevated },
  pickText: { fontSize: 10, fontWeight: "800" },
  shirtInput: {
    width: 42, backgroundColor: COLORS.cardElevated, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.cardBorder, paddingVertical: 6,
    color: COLORS.text, fontSize: 12, textAlign: "center",
  },
  btn: {
    backgroundColor: COLORS.volt, borderRadius: 10, paddingVertical: 13, alignItems: "center",
  },
  btnText: { color: COLORS.bg, fontWeight: "800", fontSize: 14 },
});