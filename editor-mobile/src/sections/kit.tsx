import React from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { COLORS } from "../theme";

export const S = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 10,
  },
  label: { color: COLORS.volt, fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  body:  { color: COLORS.text, fontSize: 14 },
  muted: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  dim:   { color: COLORS.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600" },
  ok:    { color: COLORS.win, fontSize: 13, fontWeight: "600" },
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    backgroundColor: COLORS.cardElevated, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.cardBorder, paddingHorizontal: 14, paddingVertical: 12,
    color: COLORS.text, fontSize: 14, marginTop: 6,
  },
  btn: {
    backgroundColor: COLORS.volt, borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 18, alignItems: "center",
  },
  btnText: { color: COLORS.bg, fontWeight: "900", fontSize: 14 },
  chip: {
    backgroundColor: COLORS.cardElevated, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.cardBorder, paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  danger: { color: "#FF4444", fontSize: 13, fontWeight: "700" },
  link:   { color: COLORS.volt, fontSize: 13, fontWeight: "800" },
});

export function Field({ label, ...rest }: any) {
  return (
    <View style={{ flex: 1, minWidth: 140 }}>
      <Text style={S.dim}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={COLORS.textDim}
        style={S.input}
        {...rest}
      />
    </View>
  );
}

export function Btn({ label, onPress, disabled, busy, tone = "volt" }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean;
  tone?: "volt" | "ghost" | "danger";
}) {
  const base =
    tone === "volt" ? { backgroundColor: COLORS.volt }
    : tone === "danger" ? { backgroundColor: "transparent", borderWidth: 1, borderColor: "#FF4444" }
    : { backgroundColor: COLORS.cardElevated, borderWidth: 1, borderColor: COLORS.cardBorder };
  const text =
    tone === "volt" ? { color: COLORS.bg }
    : tone === "danger" ? { color: "#FF4444" }
    : { color: COLORS.textSecondary };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={[S.btn, base, (disabled || busy) && { opacity: 0.45 }]}
    >
      <Text style={[S.btnText, text]}>{busy ? "Working..." : label}</Text>
    </TouchableOpacity>
  );
}

export function Choice<T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={S.wrapRow}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <TouchableOpacity
            key={o.id} onPress={() => onChange(o.id)}
            style={[S.chip, on && {
              borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted,
            }]}
          >
            <Text style={[S.chipText, on && { color: COLORS.volt, fontWeight: "800" }]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={S.card}>
      <Text style={S.title}>{title}</Text>
      <Text style={S.muted}>{body}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={[S.card, { paddingVertical: 28, alignItems: "center", gap: 10 }]}>
      <ActivityIndicator size="large" color={COLORS.volt} />
      <Text style={S.dim}>Loading live data...</Text>
    </View>
  );
}

export function LockedNote({ status }: { status: string }) {
  if (status !== "pending") return null;
  return (
    <View style={[S.card, { borderColor: "rgba(0,229,255,0.3)" }]}>
      <Text style={S.body}>Locked while we review it.</Text>
      <Text style={S.muted}>
        What gets reviewed is what gets published. It unlocks either way.
      </Text>
    </View>
  );
}