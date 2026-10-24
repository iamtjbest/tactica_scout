import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TeamSheet from "../components/TeamSheet";
import { COLORS } from "../theme";
import {
  getTournament, setScore, listEvents, addEvent, deleteEvent,
  type Fixture, type TeamRow, type MatchEvent,
} from "../services/api";

/**
 * The reason the mobile editor exists. One thumb, at the side of a
 * pitch, in the sun.
 *
 * Scoreboard and event log stay separate, same as the backend: the
 * score goes up the instant the ball crosses the line, and who scored
 * gets filled in when there's a gap in play. Tying them together means
 * neither gets recorded.
 */
const EVENTS = [
  { id: "goal",           label: "Goal" },
  { id: "penalty_scored", label: "Pen" },
  { id: "own_goal",       label: "OG" },
  { id: "yellow",         label: "Yellow" },
  { id: "second_yellow",  label: "2nd Y" },
  { id: "red",            label: "Red" },
];

const STATUSES = ["live", "ht", "ft", "postponed"];

export default function LiveScreen({ route }: any) {
  const { tournamentId, fixtureId } = route.params;
  const [fx, setFx] = useState<Fixture | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [implied, setImplied] = useState<{ home: number; away: number } | null>(null);
  const [minute, setMinute] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Score and events first: that is what someone at the pitch needs in
  // the second after a goal. The sheet is filled in before kickoff.
  const [pane, setPane] = useState<"match" | "sheet">("match");

  const load = useCallback(() => {
    getTournament(tournamentId).then((d) => {
      setTeams(d.teams);
      setFx(d.fixtures.find((f) => f.id === fixtureId) ?? null);
    }).catch((e) => setError(e.message));
    listEvents(fixtureId).then((d) => setEvents(d.events)).catch(() => {});
  }, [tournamentId, fixtureId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error && !fx) return <Text style={s.error}>{error}</Text>;
  if (!fx) return <Text style={s.muted}>Loading...</Text>;

  const name = (tid: string) => teams.find((t) => t.id === tid)?.clubs?.name ?? "Unknown";
  const home = fx.home_score ?? 0;
  const away = fx.away_score ?? 0;
  const noScores = fx.home_score == null || fx.away_score == null;

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
        minute: minute.trim() === "" ? null : Number(minute),
      });
      setImplied(r.score_from_events);
      setMinute("");
      load();
    } catch (e: any) { setError(e.message); }
  };

  const mismatch = implied && (implied.home !== home || implied.away !== away);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={s.paneTabs}>
        {([["match", "Score & events"], ["sheet", "Team sheet"]] as const).map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setPane(k)}
                            style={[s.panePill, { flex: 1 }, pane === k && s.panePillOn]}>
            <Text style={[s.panePillText, pane === k && { color: COLORS.volt }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {pane === "sheet" ? (
        <TeamSheet
          fixtureId={fixtureId}
          homeName={name(fx.home_team_id)}
          awayName={name(fx.away_team_id)}
        />
      ) : (
      <>
      <View style={s.card}>
        <View style={s.board}>
          <Side label={name(fx.home_team_id)} score={home} busy={busy}
                onUp={() => bump("home", 1)} onDown={() => bump("home", -1)} />
          <Text style={s.status}>{String(fx.status).toUpperCase()}</Text>
          <Side label={name(fx.away_team_id)} score={away} busy={busy}
                onUp={() => bump("away", 1)} onDown={() => bump("away", -1)} />
        </View>

        <View style={s.statusRow}>
          {STATUSES.map((st) => (
            <TouchableOpacity key={st} disabled={busy} onPress={() => push({ status: st })}
              style={[s.chip, fx.status === st && s.chipOn]}>
              <Text style={[s.chipText, fx.status === st && { color: COLORS.volt }]}>
                {st.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* The backend refuses ft without both scores. Say so before
            the tap, not after it fails. */}
        {noScores ? (
          <Text style={s.hint}>Set both scores before marking the match finished.</Text>
        ) : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>

      {mismatch ? (
        <View style={[s.card, { borderColor: "rgba(255,184,48,0.4)" }]}>
          <Text style={{ color: "#FFB830", fontSize: 13 }}>
            Events add up to {implied!.home}-{implied!.away}, scoreboard says {home}-{away}.
          </Text>
          <Text style={s.muted}>Nothing is changed automatically. Fix whichever is wrong.</Text>
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.label}>MINUTE</Text>
        <TextInput
          style={s.input} value={minute} onChangeText={setMinute}
          keyboardType="number-pad" placeholder="Blank if you're not sure"
          placeholderTextColor={COLORS.textDim}
        />
        <Text style={s.muted}>Applies to the next event, then clears.</Text>
      </View>

      {[fx.home_team_id, fx.away_team_id].map((teamId) => (
        <View key={teamId} style={s.card}>
          <Text style={s.title} numberOfLines={1}>{name(teamId)}</Text>
          <View style={s.eventRow}>
            {EVENTS.map((e) => (
              <TouchableOpacity key={e.id} style={s.eventBtn} onPress={() => log(teamId, e.id)}>
                <Text style={s.eventText}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View style={s.card}>
        <Text style={s.label}>TIMELINE</Text>
        {events.length === 0 ? (
          <Text style={s.muted}>Nothing logged yet.</Text>
        ) : events.map((e) => (
          <View key={e.id} style={s.timelineRow}>
            <Text style={s.timelineText} numberOfLines={1}>
              <Text style={s.mono}>{e.minute != null ? `${e.minute}'  ` : "--  "}</Text>
              {String(e.type).replace("_", " ")}
              {e.players ? ` — ${e.players.first_name} ${e.players.last_name}` : ""}
            </Text>
            <TouchableOpacity onPress={async () => {
              try { await deleteEvent(fixtureId, e.id); load(); }
              catch (err: any) { setError(err.message); }
            }}>
              <Text style={s.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      </>
      )}
    </ScrollView>
  );
}

function Side({ label, score, busy, onUp, onDown }: {
  label: string; score: number; busy: boolean; onUp: () => void; onDown: () => void;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={s.sideName} numberOfLines={1}>{label}</Text>
      <Text style={s.score}>{score}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TouchableOpacity disabled={busy} onPress={onDown} style={s.minus}>
          <Text style={s.minusText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={onUp} style={s.plus}>
          <Text style={s.plusText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  paneTabs: { flexDirection: "row", gap: 6 },
  panePill: {
    paddingVertical: 9, borderRadius: 999, borderWidth: 1,
    borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
    alignItems: "center",
  },
  panePillOn: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  panePillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },

  wrap: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 6,
  },
  board: { flexDirection: "row", alignItems: "center", gap: 8 },
  sideName: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  score: { color: COLORS.volt, fontSize: 48, fontWeight: "900", marginTop: 4 },
  status: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "700", width: 54, textAlign: "center" },
  // 48pt targets: this is used one-handed, outdoors, in a hurry.
  plus: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.volt,
          alignItems: "center", justifyContent: "center" },
  plusText: { color: COLORS.bg, fontSize: 24, fontWeight: "900" },
  minus: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.cardElevated,
           alignItems: "center", justifyContent: "center" },
  minusText: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, justifyContent: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
          borderWidth: 1, borderColor: COLORS.cardBorder },
  chipOn: { backgroundColor: COLORS.voltMuted, borderColor: COLORS.cardBorderActive },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "800" },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  eventRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  eventBtn: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
              backgroundColor: COLORS.cardElevated },
  eventText: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  input: { backgroundColor: COLORS.cardElevated, borderRadius: 10, paddingHorizontal: 14,
           paddingVertical: 12, color: COLORS.text, borderWidth: 1, borderColor: COLORS.cardBorder },
  timelineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                 gap: 10, paddingVertical: 6 },
  timelineText: { color: COLORS.text, fontSize: 13, flexShrink: 1 },
  mono: { color: COLORS.textSecondary, fontSize: 12 },
  remove: { color: COLORS.textDim, fontSize: 11 },
  muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  hint: { color: COLORS.textDim, fontSize: 11, textAlign: "center", marginTop: 10 },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600", marginTop: 8 },
});
