// Webvariant van de brug: in een browser draait de volledige omgeving al —
// een webview-in-web is zinloos. Eerlijke verwijzing in plaats van simulatie.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function WebBridgeScreen() {
  const c = useColors();
  const router = useRouter();
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: c.background, padding: 24 }]}>
      <Ionicons name="globe-outline" size={36} color={c.mutedForeground} />
      <Text style={[styles.note, { color: c.mutedForeground, textAlign: "center" }]}>
        Je gebruikt de app al in de browser — open de volledige omgeving
        gewoon in een nieuw tabblad via het webadres van de omgeving.
      </Text>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={[styles.note, { color: c.primary }]}>Terug</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  note: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
});
