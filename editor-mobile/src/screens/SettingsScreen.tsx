import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { COLORS } from "../theme";
import TabBar from "../components/TabBar";
import { S, Btn } from "../sections/kit";
import { signOut } from "../services/auth";
import { supabase } from "../services/supabase";

/**
 * Account settings.
 *
 * Billing lives here rather than in the tab bar. It is somewhere you go
 * when a payment is due, not somewhere you work, and four tabs is
 * already the most a phone should carry.
 */
export default function SettingsScreen({ navigation }: any) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase().auth.getUser()
      .then(({ data }: any) => setEmail(data?.user?.email || ""))
      .catch(() => {});
  }, []);

  const out = async () => {
    try { await signOut(); } catch { /* sign out locally regardless */ }
    navigation.reset({ index: 0, routes: [{ name: "SignIn" }] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <View style={S.card}>
          <Text style={S.label}>ACCOUNT</Text>
          <Text style={S.dim}>SIGNED IN AS</Text>
          <Text style={S.body}>{email || "Loading..."}</Text>
          <Text style={[S.dim, { marginTop: 8 }]}>
            One account works across Scout and the editor. Your email and
            password are changed in Scout.
          </Text>
        </View>

        <TouchableOpacity style={S.card} onPress={() => navigation.navigate("Billing")}>
          <Text style={S.title}>Billing</Text>
          <Text style={S.muted}>
            Your plan and generated-image quota. Hosting competitions is free.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.card} onPress={() => navigation.navigate("Join")}>
          <Text style={S.title}>Join a competition</Text>
          <Text style={S.muted}>
            Got an invite code from an organiser? Enter it here.
          </Text>
        </TouchableOpacity>

        <View style={{ marginTop: 6 }}>
          <Btn label="Sign out" tone="danger" onPress={out} />
        </View>
      </ScrollView>

      <TabBar active="Settings" navigation={navigation} />
    </View>
  );
}
