import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { COLORS } from "../theme";
import { joinWithCode } from "../services/api";

/**
 * Redeem an invite code.
 *
 * This is how a match commissioner gets in: the organiser reads out an
 * eight-character code at the pitch and they type it here. The code
 * alphabet has no O/0 or I/1/L for exactly that reason.
 */
export default function JoinScreen({ navigation }: any) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!code.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await joinWithCode(code.trim());
      navigation.replace("TournamentDetail", {
        id: r.tournament_id, name: r.tournament_name,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={s.title}>Join a tournament</Text>
      <Text style={s.sub}>Enter the code the organiser gave you.</Text>

      <TextInput
        style={s.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        placeholder="XXXXXXXX"
        placeholderTextColor={COLORS.textDim}
        onSubmitEditing={go}
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[s.btn, (busy || !code.trim()) && { opacity: 0.5 }]}
        disabled={busy || !code.trim()}
        onPress={go}
      >
        <Text style={s.btnText}>{busy ? "Joining..." : "Join"}</Text>
      </TouchableOpacity>

      <Text style={s.fine}>
        Codes are handed out by the organiser. If you don&apos;t have one, ask
        them to send you a join link.
      </Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: "center" },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6, marginBottom: 22 },
  input: {
    backgroundColor: COLORS.cardElevated, borderRadius: 12, paddingVertical: 18,
    color: COLORS.volt, fontSize: 24, fontWeight: "800", letterSpacing: 6,
    textAlign: "center", borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600", marginTop: 12 },
  btn: { backgroundColor: COLORS.volt, borderRadius: 12, paddingVertical: 15,
         alignItems: "center", marginTop: 16 },
  btnText: { color: COLORS.bg, fontWeight: "800", fontSize: 15 },
  fine: { color: COLORS.textDim, fontSize: 12, marginTop: 20, lineHeight: 18 },
});
