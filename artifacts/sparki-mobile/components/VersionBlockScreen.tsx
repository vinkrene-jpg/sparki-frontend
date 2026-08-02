// Golf 14 — blokkeerscherm wanneer de server 426 antwoordt (appversie te oud).
// Ligt over de hele app heen; er is bewust geen sluitknop: doorwerken met een
// verouderde versie is niet veilig. De enige weg verder is updaten.

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import colors from "@/constants/colors";
import { APP_VERSION } from "@/lib/release";

// LICHT_THEMA_01: één licht thema, centraal palet (geen eigen kleuren meer).
const c = colors.light;

export function VersionBlockScreen({ message }: { message: string }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Update nodig</Text>
        <Text style={styles.body}>{message}</Text>
        <Text style={styles.meta}>Huidige appversie: {APP_VERSION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 1000,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    padding: 24,
    gap: 12,
  },
  title: {
    color: c.tint,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  body: {
    color: c.foreground,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  meta: {
    color: c.mutedForeground,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
