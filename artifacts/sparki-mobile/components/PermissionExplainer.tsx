import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { useColors } from "@/hooks/useColors";
import {
  PERMISSIE_UITLEG,
  batterijHint,
  openAppInstellingen,
  type PermissionKey,
} from "@/lib/permissions";

/**
 * Golf 28 — uitlegkaart die VÓÓR de systeemvraag toont waarom Sparki een
 * machtiging nodig heeft, wat weigeren betekent en hoe je het later wijzigt.
 * "Ga verder" start pas daarna de echte systeemvraag; "Niet nu" sluit de kaart
 * zonder iets te vragen — de app blijft bruikbaar.
 */
export function PermissionExplainer({
  c,
  permission,
  extraKeys = [],
  onContinue,
  onDismiss,
  showBatterijHint = false,
}: {
  c: ReturnType<typeof useColors>;
  permission: PermissionKey;
  // Extra machtigingen die in dezelfde stap meekomen (bijv. achtergrondlocatie
  // direct na locatie) zodat de renner niet wordt verrast door een tweede vraag.
  extraKeys?: PermissionKey[];
  onContinue: () => void;
  onDismiss: () => void;
  showBatterijHint?: boolean;
}) {
  const uitleg = PERMISSIE_UITLEG[permission];
  const extras = extraKeys.map((k) => PERMISSIE_UITLEG[k]);
  const hint = showBatterijHint ? batterijHint() : null;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark-outline" size={18} color={c.primary} />
        <Text style={[styles.title, { color: c.foreground }]}>{uitleg.titel}</Text>
      </View>
      <Text style={[styles.body, { color: c.foreground }]}>{uitleg.doel}</Text>
      {extras.map((e) => (
        <Text key={e.key} style={[styles.body, { color: c.foreground }]}>
          {e.titel}: {e.doel}
        </Text>
      ))}
      <Text style={[styles.note, { color: c.mutedForeground }]}>
        {uitleg.gevolgWeigeren} {uitleg.wijzigen}
      </Text>
      {hint && <Text style={[styles.note, { color: c.mutedForeground }]}>{hint}</Text>}
      <View style={styles.actions}>
        <Pressable onPress={onDismiss} style={[styles.btn, { borderColor: c.border }]}>
          <Text style={[styles.btnText, { color: c.mutedForeground }]}>Niet nu</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          style={[styles.btnPrimary, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.btnText, { color: c.primaryForeground }]}>Ga verder</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Melding voor een eerder geweigerde machtiging: eerlijk wat er niet werkt,
 * met een knop rechtstreeks naar de systeeminstellingen.
 */
export function PermissionDeniedNotice({
  c,
  permission,
  message,
}: {
  c: ReturnType<typeof useColors>;
  permission: PermissionKey;
  message?: string | null;
}) {
  const uitleg = PERMISSIE_UITLEG[permission];
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.destructive }]}>
      <View style={styles.head}>
        <Ionicons name="alert-circle-outline" size={18} color={c.destructive} />
        <Text style={[styles.title, { color: c.foreground }]}>{uitleg.titel}</Text>
      </View>
      <Text style={[styles.note, { color: c.mutedForeground }]}>
        {message ?? uitleg.gevolgWeigeren} {uitleg.wijzigen}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            openAppInstellingen();
          }}
          style={[styles.btnPrimary, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.btnText, { color: c.primaryForeground }]}>
            Open instellingen
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  body: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnPrimary: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  btnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
