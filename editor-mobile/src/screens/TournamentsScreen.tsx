import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import TabBar from "../components/TabBar";
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
      .then((d) => { setRows(d.tournaments); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, []);

  // useFocusEffect alone, no extra useEffect: it already fires on mount,
  // and adding one means two requests every time the screen opens.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.wrap}>


      {error ? <Text style={s.error}>{error}</Text> : null}

      <FlatList
        data={rows ?? []}
        keyExtractor={(t) => t.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={COLORS.volt}
                          onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListEmptyComponent={
          rows === null
            ? <Text style={s.muted}>Loading...</Text>
            : (
              <View style={s.card}>
                <Text style={s.title}>No tournaments yet.</Text>
                <Text style={s.muted}>
                  Create one in the web editor, then run it from here pitchside.
                  If someone gave you a code, tap Join with a code above.
                </Text>
              </View>
            )
        }
        renderItem={({ item }) => {
          const tone = TONE[item.status];
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
        contentContainerStyle={{ padding: 16, gap: 10 }}
      />
      <TabBar active="Tournaments" navigation={navigation} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  mono: { color: COLORS.textDim, fontSize: 11, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: "800" },
  reject: { color: "#FF4444", fontSize: 12, marginTop: 8 },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600", padding: 16 },
});
