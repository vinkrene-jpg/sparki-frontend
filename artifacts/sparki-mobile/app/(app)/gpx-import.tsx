import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useImportGpx, type RouteSummary } from "@/lib/routes-api";

// Haal een leesbare bestandsnaam uit een file:// of content:// URI. Wordt
// gebruikt als voorstel voor de routenaam (zonder .gpx-extensie).
function bestandsnaamUit(uri: string): string | null {
  try {
    const last = decodeURIComponent(uri).split(/[\\/]/).pop() ?? "";
    const zonderExt = last.replace(/\.gpx$/i, "").trim();
    return zonderExt.length > 0 ? zonderExt : null;
  } catch {
    return null;
  }
}

/**
 * Scherm dat opent wanneer iemand een .gpx-bestand met Sparki opent of deelt
 * (Android ACTION_VIEW/ACTION_SEND, iOS "Openen met"). De URI komt binnen via
 * expo-linking. LET OP: dit werkt NIET in Expo Go — inkomende bestands-URI's
 * vereisen een echte build (de intent filters / document types uit app.json
 * bestaan alleen in de gecompileerde app). In Expo Go blijft dit scherm dus op
 * "geen bestand gevonden" staan; dat is een eerlijke beperking, geen bug.
 *
 * De GPX-inhoud wordt gelezen en naar hetzelfde /api/routes-eindpunt gestuurd
 * dat de webapp gebruikt. De server parse't en ontdubbelt; fouten tonen we
 * onveranderd. Daarna: "Opslaan" (route staat in de lijst) of "Navigeren".
 */
export default function GpxImportScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const importGpx = useImportGpx();

  // De URI kan op twee manieren binnenkomen: als openings-URL (koude start /
  // achtergrond) via Linking, of — voor de zekerheid — als query-parameter.
  const params = useLocalSearchParams<{ uri?: string }>();
  const initialUrl = Linking.useURL();

  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState(true);
  // Voorkom dat dezelfde URI twee keer wordt geïmporteerd (Linking kan de URL
  // meermaals leveren tijdens re-renders).
  const verwerkteUri = useRef<string | null>(null);

  useEffect(() => {
    const uri = params.uri ?? initialUrl ?? null;
    if (!uri) {
      // Nog geen URI bekend. Geef Linking even de tijd; blijft het leeg, dan
      // is dit scherm buiten de bestand-openen-flow geopend.
      const t = setTimeout(() => setBezig(false), 400);
      return () => clearTimeout(t);
    }
    // Alleen echte bestands-URI's zijn interessant (file:// of content://).
    // Een gewone deeplink (sparki://...) negeren we hier.
    if (!/^(file|content):/i.test(uri)) {
      setBezig(false);
      return;
    }
    if (verwerkteUri.current === uri) return;
    verwerkteUri.current = uri;

    let alive = true;
    void (async () => {
      setBezig(true);
      setFoutmelding(null);
      try {
        const content = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (!content.trim()) {
          throw new Error("Het gekozen bestand is leeg.");
        }
        const naam = bestandsnaamUit(uri) ?? undefined;
        const opgeslagen = await importGpx.mutateAsync({ content, name: naam });
        if (alive) setRoute(opgeslagen);
      } catch (err) {
        if (alive) {
          setFoutmelding(
            err instanceof Error && err.message
              ? err.message
              : "Dit GPX-bestand kon niet worden geïmporteerd.",
          );
        }
      } finally {
        if (alive) setBezig(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.uri, initialUrl]);

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => router.replace("/")}
          hitSlop={12}
          style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: c.foreground }]}>GPX importeren</Text>
      </View>

      <View style={styles.body}>
        {bezig ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
            <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
              Bezig met inlezen…
            </Text>
          </View>
        ) : foutmelding ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={44} color={c.mutedForeground} />
            <Text style={[styles.stateTitle, { color: c.foreground }]}>
              Importeren lukt niet
            </Text>
            <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
              {foutmelding}
            </Text>
            <Pressable
              onPress={() => router.replace("/")}
              style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.card }]}
            >
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>
                Terug naar routes
              </Text>
            </Pressable>
          </View>
        ) : route ? (
          <View style={{ flex: 1 }}>
            <View style={[styles.previewCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.previewHead}>
                <Ionicons name="checkmark-circle" size={22} color={c.primary} />
                <Text style={[styles.previewTitle, { color: c.foreground }]} numberOfLines={2}>
                  {route.name}
                </Text>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Afstand</Text>
                  <Text style={[styles.statValue, { color: c.foreground }]}>
                    {route.distanceKm != null
                      ? `${route.distanceKm.toFixed(1)} km`
                      : "onbekend"}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Hoogtemeters</Text>
                  <Text style={[styles.statValue, { color: c.foreground }]}>
                    {route.elevationGainM != null
                      ? `${Math.round(route.elevationGainM)} m`
                      : "onbekend"}
                  </Text>
                </View>
              </View>
              <Text style={[styles.stateBody, { color: c.mutedForeground, textAlign: "left" }]}>
                De route is opgeslagen en staat nu in je lijst.
              </Text>
            </View>

            <View style={{ flex: 1 }} />

            <View style={{ gap: 12, paddingBottom: insets.bottom + 16 }}>
              <Pressable
                onPress={() => router.replace(`/navigate/${route.id}`)}
                style={[styles.primaryBtn, { backgroundColor: c.primary }]}
              >
                <Ionicons name="navigate" size={20} color={c.primaryForeground} />
                <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
                  Navigeren
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace("/")}
                style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.card }]}
              >
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>
                  Opslaan en sluiten
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.center}>
            <Ionicons name="document-outline" size={44} color={c.mutedForeground} />
            <Text style={[styles.stateTitle, { color: c.foreground }]}>
              Geen GPX-bestand gevonden
            </Text>
            <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
              Open een .gpx-bestand met Sparki vanuit een e-mail, chat of je
              bestanden — dan verschijnt het hier om op te slaan en te navigeren.
            </Text>
            <Pressable
              onPress={() => router.replace("/")}
              style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.card }]}
            >
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>
                Terug naar routes
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.5 },
  body: { flex: 1, paddingHorizontal: 20 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  stateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, marginTop: 4 },
  stateBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  previewCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewTitle: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 18 },
  statRow: { flexDirection: "row", gap: 24 },
  stat: { gap: 4 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  statValue: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
