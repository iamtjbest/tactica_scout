import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import TabBar from "../components/TabBar";
import { S, Empty, Loading } from "../sections/kit";
import { getInbox, decideRequest, type InboxData } from "../services/api";

/**
 * Things that arrived: people asking to help run a competition you own,
 * and the review decision on one you submitted. Same two lists as the
 * web inbox.
 */
export default function InboxScreen({ navigation }: any) {
  const [d, setD] = useState<InboxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getInbox().then((x) => { setD(x); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (tid: string, reqId: string, approve: boolean) => {
    setBusy(reqId); setError(null);
    try { await decideRequest(tid, reqId, approve); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const nothing = d && d.requests.length === 0 && d.decisions.length === 0;

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

        {nothing ? (
          <Empty title="Nothing waiting"
                 body="When someone asks to help run one of your competitions, or we make a decision on one you submitted, it shows up here." />
        ) : null}

        {d && d.requests.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={S.label}>ASKING FOR ACCESS ({d.requests.length})</Text>
            {d.requests.map((r: any) => (
              <View key={r.id} style={S.card}>
                <Text style={S.title}>
                  {r.profiles?.display_name || r.profiles?.email || "Someone"}
                </Text>
                <Text style={S.dim}>
                  wants to be an {r.role_requested} on {r.tournament_name}
                </Text>
                {r.message ? (
                  <Text style={[S.muted, { marginTop: 6 }]}>{r.message}</Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 18, marginTop: 12 }}>
                  <TouchableOpacity disabled={busy === r.id}
                                    onPress={() => decide(r.tournament_id, r.id, true)}>
                    <Text style={[S.link, { color: COLORS.win }]}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={busy === r.id}
                                    onPress={() => decide(r.tournament_id, r.id, false)}>
                    <Text style={S.danger}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {d && d.decisions.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={S.label}>REVIEW DECISIONS</Text>
            {d.decisions.map((x) => (
              <TouchableOpacity key={x.tournament_id} style={S.card}
                onPress={() => navigation.navigate("TournamentDetail",
                  { id: x.tournament_id, name: x.tournament_name })}>
                <Text style={S.title}>{x.tournament_name}</Text>
                <Text style={S.dim}>
                  {x.status === "approved"
                    ? "Approved and live on Scout."
                    : "Sent back for changes."}
                  {x.reviewed_at
                    ? ` • ${new Date(x.reviewed_at).toLocaleDateString("en-GB",
                        { day: "numeric", month: "short", year: "numeric" })}`
                    : ""}
                </Text>
                {x.reason ? (
                  <Text style={[S.error, { marginTop: 6 }]}>{x.reason}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <TabBar active="Inbox" navigation={navigation} badge={d?.unread} />
    </View>
  );
}
