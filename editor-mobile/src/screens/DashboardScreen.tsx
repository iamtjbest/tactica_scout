import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import Crest from "../components/Crest";
import TabBar from "../components/TabBar";
import { S, Empty, Loading } from "../sections/kit";
import { getDashboard, type Dashboard, type DashFixture } from "../services/api";

/**
 * The screen after sign-in, matching the web dashboard.
 *
 * A list of competitions was the wrong landing: it answers "what do I
 * have" when the question on opening the app is "what is happening and
 * what needs me". One request, assembled server-side, because a round
 * trip per competition on mobile data is the organiser's airtime.
 */
export default function DashboardScreen({ navigation }: any) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getDashboard().then((x) => { setD(x); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={COLORS.volt}
                          onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {error ? <Text style={S.error}>{error}</Text> : null}
        {!d && !error ? <Loading /> : null}

        {d && d.total === 0 ? (
          <Empty title="Nothing running yet"
                 body="Create a competition, or join one with a code an organiser sent you." />
        ) : null}

        {d && d.total > 0 ? (
          <>
            <View style={st.stats}>
              <Stat label="Live" value={d.counts.approved ?? 0} tone={COLORS.volt} />
              <Stat label="In review" value={d.counts.pending ?? 0} />
              <Stat label="Drafts" value={d.counts.draft ?? 0} />
              <Stat label="Requests" value={d.open_requests}
                    tone={d.open_requests > 0 ? "#00E5FF" : undefined} />
            </View>

            {d.live.length > 0 ? (
              <Section title="PLAYING NOW">
                {d.live.map((fx) => (
                  <Row key={fx.id} fx={fx} live navigation={navigation} />
                ))}
              </Section>
            ) : null}

            {d.needs_attention.length > 0 ? (
              <Section title="NEEDS YOU">
                {d.needs_attention.map((n) => (
                  <TouchableOpacity key={n.tournament_id} style={S.card}
                    onPress={() => navigation.navigate("TournamentDetail",
                      { id: n.tournament_id, name: n.name })}>
                    <Text style={S.title}>{n.name}</Text>
                    <Text style={S.muted}>{n.detail}</Text>
                  </TouchableOpacity>
                ))}
              </Section>
            ) : null}

            {d.upcoming.length > 0 ? (
              <Section title="COMING UP">
                {d.upcoming.map((fx) => <Row key={fx.id} fx={fx} navigation={navigation} />)}
              </Section>
            ) : null}

            {d.recent.length > 0 ? (
              <Section title="LATEST RESULTS">
                {d.recent.map((fx) => <Row key={fx.id} fx={fx} navigation={navigation} />)}
              </Section>
            ) : null}

            {d.live.length === 0 && d.upcoming.length === 0 && d.recent.length === 0 ? (
              <Empty title="No matches in the next fortnight"
                     body="Fixtures appear here once they're generated or uploaded." />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <TabBar active="Dashboard" navigation={navigation} badge={d?.open_requests} />
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View style={st.stat}>
      <Text style={[st.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={S.dim}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={S.label}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ fx, live, navigation }: {
  fx: DashFixture; live?: boolean; navigation: any;
}) {
  const when = new Date(fx.kickoff_at).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <TouchableOpacity style={S.card}
      onPress={() => navigation.navigate("Live",
        { tournamentId: fx.tournament_id, fixtureId: fx.id })}>
      <View style={S.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Crest url={fx.home.crest_url} name={fx.home.name} size={16} />
            <Text style={[S.body, { flexShrink: 1 }]} numberOfLines={1}>{fx.home.name}</Text>
            <Text style={S.dim}>v</Text>
            <Crest url={fx.away.crest_url} name={fx.away.name} size={16} />
            <Text style={[S.body, { flexShrink: 1 }]} numberOfLines={1}>{fx.away.name}</Text>
          </View>
          <Text style={S.dim} numberOfLines={1}>
            {fx.tournament_name} • {when}{fx.venue ? ` • ${fx.venue}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={st.score}>
            {fx.home_score ?? "–"}:{fx.away_score ?? "–"}
          </Text>
          <Text style={[S.dim, live ? { color: "#FF4444" } : null]}>
            {live ? "LIVE" : String(fx.status).toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 2,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  score: { color: COLORS.volt, fontSize: 16, fontWeight: "900" },
});
