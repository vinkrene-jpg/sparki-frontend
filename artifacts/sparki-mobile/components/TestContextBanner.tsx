// Permanente contextmarkering (mobiel): in elke niet-productiebuild staat
// bovenin onmiskenbaar WIE er is ingelogd en dat dit een TESTOMGEVING is.
// In een echte productiebuild (__DEV__ === false) rendert dit niets — de
// markering kan een winkel-build dus nooit vervuilen.
//
// Reden (02-08): testers stopten met telefoontests omdat nergens zichtbaar
// was in welke omgeving en onder welke identiteit ze keken.

import { useUser } from "@clerk/expo";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TestContextBanner() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  if (!__DEV__) return null;
  const identiteit =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "identiteit onbekend";
  return (
    <View style={[styles.banner, { paddingTop: Math.max(insets.top, 6) }]}>
      <View style={styles.dot} />
      <Text style={styles.text} numberOfLines={1}>
        TESTOMGEVING · {identiteit}
      </Text>
    </View>
  );
}

// LICHT_THEMA_01: waarschuwings-/testmarkering op het lichte thema — zacht
// amber vlak met donkeramber tekst/rand (dezelfde logica als de web-warning:
// donker-op-licht i.p.v. licht-op-donker). --color-warning ≈ #a96b00.
const WARN = "#a96b00";
const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fbf3e0", // zacht amber vlak (licht)
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(169,107,0,0.45)",
    paddingHorizontal: 12,
    paddingBottom: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WARN,
  },
  text: {
    color: WARN,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    flexShrink: 1,
  },
});
