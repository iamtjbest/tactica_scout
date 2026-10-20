/**
 * src/components/TabBar.tsx
 *
 * The four top-level destinations, mirroring the web sidebar:
 * Dashboard, My competitions, Inbox, Settings.
 *
 * Hand-rolled rather than @react-navigation/bottom-tabs. The tab bar is
 * four buttons and a route name; pulling in a navigator for that means
 * a dependency to install and keep in step with the Expo SDK, for
 * something this file does in sixty lines.
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../theme";

export type TabName = "Dashboard" | "Tournaments" | "Inbox" | "Settings";

const TABS: { name: TabName; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: "Dashboard",   label: "Home",         icon: "grid-outline" },
  { name: "Tournaments", label: "Competitions", icon: "trophy-outline" },
  { name: "Inbox",       label: "Inbox",        icon: "mail-outline" },
  { name: "Settings",    label: "Settings",     icon: "settings-outline" },
];

export default function TabBar({ active, navigation, badge }: {
  active: TabName;
  navigation: any;
  /** Unread count on Inbox. Hidden at zero rather than showing a 0. */
  badge?: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((t) => {
        const on = t.name === active;
        return (
          <TouchableOpacity
            key={t.name}
            style={s.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) navigation.navigate(t.name); }}
          >
            <View>
              <Ionicons name={t.icon} size={21}
                        color={on ? COLORS.volt : COLORS.textDim} />
              {t.name === "Inbox" && badge ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.label, on && { color: COLORS.volt, fontWeight: "800" }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row", backgroundColor: COLORS.card,
    borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  label: { color: COLORS.textDim, fontSize: 10, fontWeight: "600" },
  badge: {
    position: "absolute", top: -4, right: -8, minWidth: 15, height: 15,
    borderRadius: 999, backgroundColor: "#FF4444",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
