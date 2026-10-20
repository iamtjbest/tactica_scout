import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import Crest from "../components/Crest";
import {
  getTournament, getReadiness, submitForReview, sortRounds,
  type Tournament, type TeamRow, type Fixture, type Readiness,
} from "../services/api";
import { LockedNote } from "../sections/kit";
import { Venues, Structure, Suspensions } from "../sections/Structure";
import {
  Standings, Teams, Players, Info, Regulations, ProofSection, Collaborators,
} from "../sections/Manage";

/**
 * The competition workspace, with the same sections as the web editor:
 * Run (matches, standings, brackets), Build (teams, players, venues,
 * format) and Settings (info, regulations, suspensions, proof,
 * collaborators).
 *
 * On a phone the web sidebar becomes a horizontal strip of pills, kept
 * in the same order and grouping so the two apps teach the same shape.
 * Matches opens first, because that is what someone standing at a pitch
 * came for.
 */

type Section =
  | "matches" | "standings" | "teams" | "players" | "venues"
  | "structure" | "info" | "regulations" | "suspensions"
  | "proof" | "collaborators";

const SECTIONS: { id: Section; label: string; group: string }[] = [
  { id: "matches",       label: "Matches",       group: "Run" },
  { id: "standings",     label: "Standings",     group: "Run" },
  { id: "teams",         label: "Teams",         group: "Build" },
  { id: "players",       label: "Players",       group: "Build" },
  { id: "venues",        label: "Venues",        group: "Build" },
  { id: "structure",     label: "Format",        group: "Build" },
  { id: "info",          label: "Info",          group: "Settings" },
  { id: "regulations",   label: "Regulations",   group: "Settings" },
  { id: "suspensions",   label: "Suspensions",   group: "Settings" },
  { id: "proof",         label: "Proof",         group: "Settings" },
  { id: "collaborators", label: "Collaborators", group: "Settings" },
];
export default function TournamentDetailScreen({ route, navigation }: any) {
  const { id, name } = route.params;
  const [t, setT] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>("matches");

  const load = useCallback(() => {
    getTournament(id)
      .then((d) => {
        setT(d.tournament); setTeams(d.teams); setFixtures(d.fixtures); setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
    getReadiness(id).then(setReady).catch(() => setReady(null));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: name || "Tournament" });
  }, [navigation, name]);

  const info = (tid: string) => {
    const t = teams.find((x) => x.id === tid);
    return { name: t?.clubs?.name ?? "Unknown", crest: t?.clubs?.crest_url ?? null };
  };

  const submit = async () => {
    setBusy(true); setError(null);
    try { await submitForReview(id); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (error && !t) return <Text style={s.error}>{error}</Text>;
  if (!t) return <Text style={s.muted}>Loading...</Text>;

  // Mirrors FROZEN_STATUSES on the backend and the web editor: review is
  // the only thing that locks a competition, and it unlocks whichever way
  // the decision goes.
  const role = (t as any)._role ?? "owner";
  const editable = t.status !== "pending" && (role === "owner" || role === "editor");
  const isOwner = role === "owner";

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={COLORS.volt}
                        onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      {t.status === "rejected" && t.rejection_reason ? (
        <View style={[s.card, { borderColor: "rgba(255,68,68,0.4)" }]}>
          <Text style={s.label}>CHANGES NEEDED</Text>
          <Text style={s.body}>{t.rejection_reason}</Text>
        </View>
      ) : null}

      <LockedNote status={t.status} />

      {isOwner && (t.status === "draft" || t.status === "rejected") ? (
        <View style={s.card}>
          <Text style={s.label}>BEFORE IT CAN GO LIVE</Text>
          {ready?.ready ? (
            <Text style={[s.body, { color: "#00E676" }]}>Everything&apos;s in place.</Text>
          ) : (
            (ready?.missing ?? []).map((m) => (
              <Text key={m} style={s.muted}>Still needs {m}</Text>
            ))
          )}
          <TouchableOpacity
            style={[s.btn, (!ready?.ready || busy) && { opacity: 0.5 }]}
            disabled={!ready?.ready || busy}
            onPress={submit}
          >
            <Text style={s.btnText}>{busy ? "Sending..." : "Submit for review"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}

      {/* The web sidebar, flattened. Same order and grouping so the two
          apps teach the same shape. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
        style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
      >
        {SECTIONS.map((x) => {
          const on = x.id === section;
          return (
            <TouchableOpacity key={x.id} onPress={() => setSection(x.id)}
                              style={[s.pill, on && s.pillOn]}>
              <Text style={[s.pillText, on && s.pillTextOn]}>{x.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ gap: 10 }}>
        {section === "matches" ? (
          <>
            <Text style={s.label}>FIXTURES ({fixtures.length})</Text>
            {fixtures.length === 0 ? (
              <Text style={s.muted}>
                No fixtures yet. Generate them, or enter your own draw, in the
                web editor.
              </Text>
            ) : (
              // Grouped by round or group, same ordering rule as the web
              // editor. A flat list of 30 league fixtures is unusable on a
              // phone, and the round is what tells you where you are.
              groupFixtures(fixtures).map(([heading, list]) => (
                <View key={heading} style={{ gap: 8 }}>
                  <Text style={s.round}>{heading}</Text>
                  {list.map((fx) => {
                    const h = info(fx.home_team_id), a = info(fx.away_team_id);
                    return (
                      <TouchableOpacity
                        key={fx.id} style={s.card}
                        onPress={() => navigation.navigate("Live", {
                          tournamentId: id, fixtureId: fx.id,
                        })}
                      >
                        <View style={s.rowTop}>
                          <View style={s.teamsLine}>
                            <Crest url={h.crest} name={h.name} size={18} />
                            <Text style={s.title} numberOfLines={1}>{h.name}</Text>
                            <Text style={s.vs}>v</Text>
                            <Crest url={a.crest} name={a.name} size={18} />
                            <Text style={s.title} numberOfLines={1}>{a.name}</Text>
                          </View>
                          <Text style={s.score}>
                            {fx.home_score ?? "-"}:{fx.away_score ?? "-"}
                          </Text>
                        </View>
                        <Text style={s.mono}>
                          {new Date(fx.kickoff_at).toLocaleString("en-GB", {
                            day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })}
                          {"  \u2022  "}{String(fx.status).toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </>
        ) : null}

        {section === "standings" ? <Standings tid={id} /> : null}
        {section === "teams" ? <Teams teams={teams} /> : null}
        {section === "players" ? <Players teams={teams} /> : null}
        {section === "venues" ? <Venues tid={id} editable={editable && isOwner} /> : null}
        {section === "structure" ? (
          <Structure tid={id} editable={editable && isOwner} onChanged={load} />
        ) : null}
        {section === "info" ? (
          <Info t={t} editable={editable && isOwner} onChanged={load} />
        ) : null}
        {section === "regulations" ? (
          <Regulations t={t} editable={editable && isOwner} onChanged={load} />
        ) : null}
        {section === "suspensions" ? (
          <Suspensions tid={id} teams={teams} editable={editable} />
        ) : null}
        {section === "proof" ? (
          <ProofSection tid={id}
                        editable={isOwner && (t.status === "draft" || t.status === "rejected")} />
        ) : null}
        {section === "collaborators" ? <Collaborators tid={id} isOwner={isOwner} /> : null}
      </View>
    </ScrollView>
  );
}

/** Group by group name first, then round. Returns entries already in
 *  playing order so the caller just maps over them. */
function groupFixtures(fixtures: Fixture[]): [string, Fixture[]][] {
  const grouped: Record<string, Fixture[]> = {};
  for (const fx of fixtures) {
    const key = fx.group_name ? `Group ${fx.group_name}` : (fx.round || "Fixtures");
    (grouped[key] ||= []).push(fx);
  }
  return sortRounds(Object.keys(grouped)).map((k) => [
    k,
    grouped[k].slice().sort((a, b) =>
      (a.kickoff_at || "").localeCompare(b.kickoff_at || "")),
  ]);
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 4,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: COLORS.text, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  teamsLine: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  vs: { color: COLORS.textDim, fontSize: 11 },
  round: { color: COLORS.volt, fontSize: 10, fontWeight: "800", letterSpacing: 1.6, marginTop: 10 },
  score: { color: COLORS.volt, fontSize: 16, fontWeight: "900" },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  body: { color: COLORS.text, fontSize: 14, marginTop: 4 },
  muted: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  mono: { color: COLORS.textDim, fontSize: 11, marginTop: 4 },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600", padding: 16 },
  btn: {
    backgroundColor: COLORS.volt, borderRadius: 10, paddingVertical: 12,
    alignItems: "center", marginTop: 12,
  },
  btnText: { color: COLORS.bg, fontWeight: "800", fontSize: 14 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  pillOn: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  pillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
  pillTextOn: { color: COLORS.volt, fontWeight: "800" },
});
