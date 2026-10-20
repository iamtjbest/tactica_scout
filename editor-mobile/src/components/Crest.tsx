import React, { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { COLORS } from "../theme";

/**
 * A club crest, or initials.
 *
 * Most department sides have no badge, and a broken image placeholder
 * next to every fixture is worse than none. Initials on a tinted
 * circle stay readable at 18px and keep rows aligned either way.
 */
export default function Crest({
  url, name, size = 20,
}: {
  url?: string | null; name?: string | null; size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join("");

  const box = {
    width: size, height: size, borderRadius: size / 2,
    backgroundColor: COLORS.cardElevated,
  };

  if (!url || failed) {
    return (
      <View style={[box, s.center]}>
        <Text style={{ color: COLORS.textSecondary, fontSize: Math.max(7, size * 0.4),
                       fontWeight: "700" }}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image source={{ uri: url }} style={box} resizeMode="contain"
           onError={() => setFailed(true)} />
  );
}

const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
