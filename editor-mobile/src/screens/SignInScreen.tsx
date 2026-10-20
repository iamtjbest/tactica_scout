import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { COLORS } from "../theme";
import { signInWithEmail } from "../services/auth";

/** One account across Scout and the editor: same Supabase project.
 *  Signing up happens in Scout, so this is sign-in only. */
export default function SignInScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await signInWithEmail(email.trim(), password);
      navigation.replace("Tournaments");
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
      <Text style={s.brand}>Tactica <Text style={{ color: COLORS.volt }}>Editor</Text></Text>
      <Text style={s.sub}>Same account as Scout.</Text>

      <TextInput style={s.input} placeholder="Email" placeholderTextColor={COLORS.textDim}
                 autoCapitalize="none" keyboardType="email-address"
                 value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" placeholderTextColor={COLORS.textDim}
                 secureTextEntry value={password} onChangeText={setPassword} />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={s.btnText}>{busy ? "Signing in..." : "Sign in"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: "center" },
  brand: { color: COLORS.text, fontSize: 28, fontWeight: "900" },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6, marginBottom: 24 },
  input: {
    backgroundColor: COLORS.cardElevated, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, color: COLORS.text, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  error: { color: "#ff6b6b", fontSize: 13, marginBottom: 12, fontWeight: "600" },
  btn: {
    backgroundColor: COLORS.volt, borderRadius: 12, paddingVertical: 15, alignItems: "center",
  },
  btnText: { color: COLORS.bg, fontWeight: "800", fontSize: 15 },
});
