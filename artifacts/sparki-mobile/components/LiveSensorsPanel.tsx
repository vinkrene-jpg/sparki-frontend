import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { useColors } from "@/hooks/useColors";
import {
  isLiveKind,
  type GarageSensor,
  type SensorConnState,
} from "@/hooks/useLiveSensors";
import type { LiveSensorKind } from "@/lib/ble-sensors";
import { PERMISSIE_UITLEG } from "@/lib/permissions";

// Plain-Dutch labels per sensor kind — nav copy stays jargon-free.
const KIND_LABEL: Record<string, string> = {
  wattagemeter: "Wattagemeter",
  hartslagmeter: "Hartslagband",
  cadans_snelheid: "Cadans/snelheid",
  horloge: "Horloge",
  derailleur: "Derailleur",
};

function sensorTitle(s: GarageSensor): string {
  const name = [s.brand, s.model].filter(Boolean).join(" ").trim();
  return name || KIND_LABEL[s.kind] || s.kind;
}

/**
 * "Sensoren" panel for the ride screens: the saved sensors from the
 * Fietsengarage, each with a real connect/disconnect action. Watches and
 * electronic derailleurs are shown as registration-only (honest — their
 * protocols cannot be read). When Bluetooth is unavailable in this build the
 * reason is stated plainly instead of a dead button.
 */
export function LiveSensorsPanel({
  c,
  sensors,
  sensorsLoading,
  sensorsError,
  support,
  connections,
  onConnect,
  onDisconnect,
  onClose,
}: {
  c: ReturnType<typeof useColors>;
  sensors: GarageSensor[] | undefined;
  sensorsLoading: boolean;
  sensorsError: boolean;
  support: { available: boolean; reason: string | null };
  connections: Record<LiveSensorKind, SensorConnState>;
  onConnect: (kind: LiveSensorKind, preferredName: string | null) => void;
  onDisconnect: (kind: LiveSensorKind) => void;
  onClose: () => void;
}) {
  const pairable = (sensors ?? []).filter((s) => s.pairable && isLiveKind(s.kind));
  const registrationOnly = (sensors ?? []).filter((s) => !s.pairable);

  // One connect row per live kind: multiple saved sensors of the same kind
  // share one radio link, so the first of each kind represents that kind.
  const byKind = new Map<LiveSensorKind, GarageSensor>();
  for (const s of pairable) {
    const kind = s.kind as LiveSensorKind;
    if (!byKind.has(kind)) byKind.set(kind, s);
  }

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.head}>
        <Ionicons name="bluetooth" size={18} color={c.primary} />
        <Text style={[styles.title, { color: c.foreground }]}>Sensoren</Text>
        <Pressable onPress={onClose} hitSlop={10} style={{ marginLeft: "auto" }}>
          <Ionicons name="close" size={20} color={c.mutedForeground} />
        </Pressable>
      </View>

      {!support.available ? (
        <Text style={[styles.note, { color: c.mutedForeground }]}>
          {support.reason ?? "Bluetooth is niet beschikbaar op dit apparaat."}
        </Text>
      ) : sensorsLoading ? (
        <View style={styles.row}>
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.note, { color: c.mutedForeground }]}>
            Sensoren uit je Fietsengarage laden…
          </Text>
        </View>
      ) : sensorsError ? (
        <Text style={[styles.note, { color: c.mutedForeground }]}>
          Je sensoren konden niet worden geladen. Controleer je verbinding en
          probeer opnieuw.
        </Text>
      ) : byKind.size === 0 ? (
        <Text style={[styles.note, { color: c.mutedForeground }]}>
          Nog geen koppelbare sensoren in je Fietsengarage. Voeg ze eerst toe in
          de Sparki-webapp (Materiaal → Fietsengarage), dan verschijnen ze hier.
        </Text>
      ) : (
        <>
        {/* Golf 28 — uitleg vóór de eerste Bluetooth-systeemvraag: zolang nog
            geen sensor verbonden is, staat hier waarom Sparki dit vraagt en
            wat weigeren betekent. */}
        {Object.values(connections).every((s) => s.status !== "connected") && (
          <Text style={[styles.note, { color: c.mutedForeground }]}>
            {PERMISSIE_UITLEG.bluetooth.doel}{" "}
            {PERMISSIE_UITLEG.bluetooth.gevolgWeigeren}
          </Text>
        )}
        {[...byKind.entries()].map(([kind, sensor]) => {
          const conn = connections[kind];
          return (
            <View key={kind} style={styles.sensorRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sensorName, { color: c.foreground }]}>
                  {sensorTitle(sensor)}
                </Text>
                <Text style={[styles.sensorSub, { color: c.mutedForeground }]}>
                  {conn.status === "connected"
                    ? `Verbonden${conn.deviceName ? ` met ${conn.deviceName}` : ""}${
                        conn.batteryPercent != null
                          ? ` · batterij ${conn.batteryPercent}%`
                          : ""
                      }`
                    : conn.status === "connecting"
                      ? "Zoeken…"
                      : conn.status === "reconnecting"
                        ? "Verbinding weggevallen — opnieuw verbinden…"
                        : conn.status === "error"
                          ? conn.error ?? "Verbinden mislukt."
                          : KIND_LABEL[kind] ?? kind}
                </Text>
              </View>
              {conn.status === "connecting" || conn.status === "reconnecting" ? (
                <ActivityIndicator color={c.primary} />
              ) : conn.status === "connected" ? (
                <Pressable
                  onPress={() => onDisconnect(kind)}
                  style={[styles.btn, { borderColor: c.border }]}
                >
                  <Text style={[styles.btnText, { color: c.mutedForeground }]}>
                    Ontkoppel
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => onConnect(kind, sensor.deviceName)}
                  style={[styles.btnPrimary, { backgroundColor: c.primary }]}
                >
                  <Text style={[styles.btnText, { color: c.primaryForeground }]}>
                    {conn.status === "error" ? "Opnieuw" : "Verbind"}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
        </>
      )}

      {support.available && registrationOnly.length > 0 && (
        <Text style={[styles.note, { color: c.mutedForeground }]}>
          {registrationOnly
            .map((s) => sensorTitle(s))
            .join(", ")}{" "}
          {registrationOnly.length === 1 ? "is" : "zijn"} alleen geregistreerd —
          een horloge of derailleur kan niet live worden uitgelezen.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  note: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    flexShrink: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  sensorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sensorName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sensorSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnPrimary: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  btnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
