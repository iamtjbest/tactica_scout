import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import TabBar from "../components/TabBar";
import { Loading } from "../sections/kit";
import { listTournaments, type Tournament, type TournamentStatus } from "../services/api";

const TONE: Record<TournamentStatus, { bg: string; fg: string; label: string }> = {
  draft:       { bg: "rgba(255,255,255,0.06)", fg: COLORS.textSecondary, label: "Draft" },
  pending:     { bg: "rgba(255,184,48,0.12)",  fg: "#FFB830",            label: "In review" },
  approved:    { bg: "rgba(0,230,118,0.12)",   fg: "#00E676",            label: "Live on Scout" },
  rejected:    { bg: "rgba(255,68,68,0.12)",   fg: "#FF4444",            label: "Changes needed" },
  unpublished: { bg: "rgba(255,255,255,0.06)", fg: COLORS.textDim,       label: "Unpublished" },
};

export default function TournamentsScreen({ navigation }: any) {
  const [rows, setRows] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    listTournaments()
      .then((d) => { setRows(d.tournaments || []); setError(null); })
      .catch((e) => { setError(e.message); setRows([]); })
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.wrap}>
      {error ? <Text style={s.error}>{error}</Text> : null}

      {rows === null ? (
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <Loading />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={COLORS.volt}
                            onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={
            <View style={s.card}>
              <Text style={s.title}>No competitions yet.</Text>
              <Text style={s.muted}>
                Create one in the web editor, then run it from here pitchside.
                If someone gave you a code, tap Join with a code above.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const tone = TONE[item.status] || TONE.draft;
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate("TournamentDetail", {
                  id: item.id, name: item.name,
                })}
              >
                <View style={s.rowTop}>
                  <Text style={s.title} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.pill, { backgroundColor: tone.bg }]}>
                    <Text style={[s.pillText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                </View>
                <Text style={s.muted} numberOfLines={1}>
                  {item.organizing_body} • {item.level}
                  {(item as any)._role && (item as any)._role !== "owner"
                    ? `  •  you're a ${(item as any)._role}`
                    : ""}
                </Text>
                <Text style={s.mono}>{item.start_date} to {item.end_date}</Text>
                {item.status === "rejected" && item.rejection_reason ? (
                  <Text style={s.reject}>{item.rejection_reason}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
        />
      )}
      <TabBar active="Tournaments" navigation={navigation} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 6,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  muted: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  mono: { color: COLORS.textDim, fontSize: 11, marginTop: 4, fontWeight: "600" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: "900" },
  reject: { color: "#FF4444", fontSize: 12, marginTop: 8, fontWeight: "600" },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600", padding: 16 },
});