import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { COLORS } from "../theme";
import { signInWithEmail } from "../services/auth";

export default function SignInScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await signInWithEmail(email.trim(), password);
      navigation.replace("Dashboard");
    } catch (e: any) {
      setError(e.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.badge}>
        <Text style={s.badgeText}>TACTICA ENGINE</Text>
      </View>
      <Text style={s.brand}>Tactica <Text style={{ color: COLORS.volt }}>Editor</Text></Text>
      <Text style={s.sub}>Same account as Scout. Sign in to manage your competitions pitchside.</Text>

      <TextInput style={s.input} placeholder="Email" placeholderTextColor={COLORS.textDim}
                 autoCapitalize="none" keyboardType="email-address"
                 value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" placeholderTextColor={COLORS.textDim}
                 secureTextEntry value={password} onChangeText={setPassword} />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={s.btnText}>{busy ? "Signing in..." : "Sign in to Dashboard"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: "center" },
  badge: {
    alignSelf: "flex-start", backgroundColor: COLORS.voltMuted,
    borderWidth: 1, borderColor: COLORS.cardBorderActive,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 14,
  },
  badgeText: { color: COLORS.volt, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  brand: { color: COLORS.text, fontSize: 32, fontWeight: "900" },
  sub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6, marginBottom: 24, lineHeight: 18 },
  input: {
    backgroundColor: COLORS.cardElevated, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, color: COLORS.text, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder, fontSize: 14,
  },
  error: { color: "#ff6b6b", fontSize: 13, marginBottom: 12, fontWeight: "600" },
  btn: {
    backgroundColor: COLORS.volt, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4,
  },
  btnText: { color: COLORS.bg, fontWeight: "900", fontSize: 15 },
});