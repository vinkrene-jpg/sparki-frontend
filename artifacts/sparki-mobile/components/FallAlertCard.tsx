import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { useColors } from "@/hooks/useColors";
import type { FallAlert } from "@/hooks/useFallDetection";

// Val-alarm overlay: "Alles oké?" met aftelling. Eerlijk over wat er gebeurt:
// meldingen worden KLAARGEZET voor gekoppelde coach/ouders (0 is 0) — nooit
// een belofte dat iemand ze al gezien heeft. 112 bellen doet de renner zelf
// via de grote belknop; de app kan dat niet automatisch.
export function FallAlertCard({
  c,
  alert,
  onOk,
  onSendNow,
  onClose,
}: {
  c: ReturnType<typeof useColors>;
  alert: FallAlert;
  onOk: () => void;
  onSendNow: () => void;
  onClose: () => void;
}) {
  return (
    // LICHT_THEMA_01: scrim dimt met de donkere voorgrond i.p.v. zwart
    // (gelijk aan de web-aanpak bg-foreground/NN).
    <View style={[styles.wrap, { backgroundColor: "rgba(22,24,29,0.6)" }]}>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.destructive }]}>
        {alert.phase === "asking" ? (
          <>
            <Ionicons name="warning" size={40} color={c.destructive} />
            <Text style={[styles.title, { color: c.foreground }]}>Alles oké?</Text>
            <Text style={[styles.body, { color: c.mutedForeground }]}>
              Het lijkt erop dat je plotseling bent gestopt. Reageer binnen{" "}
              {alert.secondsLeft} seconden, anders worden meldingen met je
              locatie klaargezet voor je gekoppelde coach en ouders.
            </Text>
            <Pressable onPress={onOk} style={[styles.okBtn, { backgroundColor: c.primary }]}>
              <Text style={[styles.okText, { color: c.primaryForeground }]}>
                Ik ben oké
              </Text>
            </Pressable>
            <View style={styles.row}>
              <Pressable
                onPress={onSendNow}
                style={[styles.smallBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.smallText, { color: c.foreground }]}>
                  Waarschuw nu
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void Linking.openURL("tel:112")}
                style={[styles.smallBtn, { borderColor: c.destructive }]}
              >
                <Ionicons name="call" size={16} color={c.destructive} />
                <Text style={[styles.smallText, { color: c.destructive }]}>
                  Bel 112
                </Text>
              </Pressable>
            </View>
          </>
        ) : alert.phase === "sending" ? (
          <>
            <Ionicons name="paper-plane-outline" size={36} color={c.primary} />
            <Text style={[styles.title, { color: c.foreground }]}>
              Meldingen worden klaargezet…
            </Text>
          </>
        ) : alert.phase === "sent" ? (
          <>
            <Ionicons name="checkmark-circle" size={36} color={c.primary} />
            <Text style={[styles.title, { color: c.foreground }]}>
              {alert.notified > 0
                ? `Melding klaargezet voor ${alert.notified} ${alert.notified === 1 ? "persoon" : "personen"}`
                : "Geen gekoppelde coach of ouders gevonden"}
            </Text>
            <Text style={[styles.body, { color: c.mutedForeground }]}>
              {alert.notified > 0
                ? "Je locatie is meegestuurd. Bel bij nood zelf 112."
                : "Er kon niemand worden gewaarschuwd. Bel bij nood zelf 112."}
            </Text>
            <Pressable
              onPress={() => void Linking.openURL("tel:112")}
              style={[styles.okBtn, { backgroundColor: c.destructive }]}
            >
              <Ionicons name="call" size={18} color={c.destructiveForeground} />
              <Text style={[styles.okText, { color: c.destructiveForeground }]}>Bel 112</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.smallBtn, { borderColor: c.border }]}>
              <Text style={[styles.smallText, { color: c.mutedForeground }]}>Sluiten</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle-outline" size={36} color={c.destructive} />
            <Text style={[styles.title, { color: c.foreground }]}>
              Melding niet klaargezet
            </Text>
            <Text style={[styles.body, { color: c.mutedForeground }]}>
              {alert.message} Bel bij nood zelf 112.
            </Text>
            <View style={styles.row}>
              <Pressable onPress={onSendNow} style={[styles.smallBtn, { borderColor: c.border }]}>
                <Text style={[styles.smallText, { color: c.foreground }]}>
                  Opnieuw proberen
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void Linking.openURL("tel:112")}
                style={[styles.smallBtn, { borderColor: c.destructive }]}
              >
                <Ionicons name="call" size={16} color={c.destructive} />
                <Text style={[styles.smallText, { color: c.destructive }]}>Bel 112</Text>
              </Pressable>
              <Pressable onPress={onClose} style={[styles.smallBtn, { borderColor: c.border }]}>
                <Text style={[styles.smallText, { color: c.mutedForeground }]}>Sluiten</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textAlign: "center",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  okBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  okText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  row: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center" },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  smallText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
