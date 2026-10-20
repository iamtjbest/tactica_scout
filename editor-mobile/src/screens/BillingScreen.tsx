import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import { getBilling, startCheckout, type Billing } from "../services/api";

/**
 * Checkout opens Paystack in the system browser. The card form is
 * theirs; nothing in this app ever sees a card number.
 *
 * The plan is applied by the Paystack webhook hitting the backend, not
 * by the user returning here. Coming back to the app proves nothing.
 */
export default function BillingScreen() {
  const [b, setB] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getBilling().then(setB).catch((e) => setError(e.message));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buy = async (plan: string) => {
    setBusy(plan); setError(null);
    try {
      const r = await startCheckout(plan);
      await Linking.openURL(r.authorization_url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (error && !b) return <Text style={s.error}>{error}</Text>;
  if (!b) return <Text style={s.muted}>Loading...</Text>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={s.card}>
        <Text style={s.label}>YOUR PLAN</Text>
        <Text style={s.plan}>{b.plan}</Text>
        <Text style={s.muted}>
          {b.unlimited
            ? "Unlimited images"
            : `${b.remaining} of ${b.image_quota} images left`}
        </Text>
        <Text style={s.muted}>
          Hosting tournaments is free with no limit. Images are the paid part.
        </Text>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {b.plans.map((p) => (
        <View key={p.id} style={s.card}>
          <Text style={s.planName}>{p.id}</Text>
          <Text style={s.price}>₦{p.naira.toLocaleString()}</Text>
          <Text style={s.muted}>{p.label}</Text>
          <TouchableOpacity
            style={[s.btn, (busy === p.id || b.plan === p.id) && { opacity: 0.5 }]}
            disabled={busy === p.id || b.plan === p.id}
            onPress={() => buy(p.id)}
          >
            <Text style={s.btnText}>
              {b.plan === p.id ? "Current plan"
                : busy === p.id ? "Opening Paystack..."
                : "Choose"}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={s.fine}>
        Payment happens on Paystack&apos;s own page. Card details never reach
        Tactica. Once it goes through, pull down to refresh.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 4,
  },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  plan: { color: COLORS.volt, fontSize: 28, fontWeight: "900", textTransform: "capitalize" },
  planName: { color: COLORS.text, fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
  price: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 4 },
  muted: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  fine: { color: COLORS.textDim, fontSize: 11, marginTop: 4 },
  btn: { backgroundColor: COLORS.volt, borderRadius: 10, paddingVertical: 12,
         alignItems: "center", marginTop: 12 },
  btnText: { color: COLORS.bg, fontWeight: "800", fontSize: 14 },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600", padding: 16 },
});
