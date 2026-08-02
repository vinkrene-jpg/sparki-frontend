// MOBIEL_ROLLEN_01 F1 — de brug naar de gedeelde webschil.
//
// Dit scherm toont de bestaande webapplicatie (artifacts/sparki) ín de app,
// ingelogd met dezelfde Clerk-sessie via een kortlevend, éénmalig
// sign-in-ticket dat de server voor de eigen gebruiker munt
// (POST /api/mobile-web/session). Rolschermen bestaan daardoor maar één keer:
// in de webcodebasis. Zie docs/besluiten/MOBIEL_ROLLEN_01_F0_SAMENVOEGROUTE_2026-08-02.md.
//
// Eerlijkheidsregels:
// - Mislukt de brug (geen ticket, geen netwerk), dan een duidelijke foutkaart
//   met opnieuw-proberen — nooit een leeg scherm of stille terugval.
// - Het ticket staat alleen in de eerste laad-URL en wordt nergens bewaard of
//   gelogd; Clerk maakt het éénmalig en kort geldig.

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ApiError, customFetch } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

const domain = process.env.EXPO_PUBLIC_DOMAIN;

type BridgeState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

export default function WebBridgeScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ path?: string }>();
  // Doelpad binnen de webapp; alleen interne paden toegestaan.
  const rawPath = typeof params.path === "string" ? params.path : "/";
  const targetPath = rawPath.startsWith("/") && !rawPath.startsWith("//") ? rawPath : "/";

  const [state, setState] = useState<BridgeState>({ status: "loading" });

  const start = useCallback(async () => {
    setState({ status: "loading" });
    if (!domain) {
      setState({
        status: "error",
        message: "Het webadres van de omgeving is niet ingesteld (EXPO_PUBLIC_DOMAIN).",
      });
      return;
    }
    try {
      const data = await customFetch<{ ticket: string }>("/api/mobile-web/session", {
        method: "POST",
      });
      const base = `https://${domain}`;
      const url =
        `${base}/sign-in?__clerk_ticket=${encodeURIComponent(data.ticket)}` +
        `&redirect_url=${encodeURIComponent(targetPath)}`;
      setState({ status: "ready", url });
    } catch (err) {
      const message =
        err instanceof ApiError && typeof (err.data as { error?: string } | null)?.error === "string"
          ? (err.data as { error: string }).error
          : "De webomgeving kon niet worden aangemeld. Controleer je verbinding en probeer het opnieuw.";
      setState({ status: "error", message });
    }
  }, [targetPath]);

  useEffect(() => {
    void start();
  }, [start]);

  return (
    <View style={[styles.fill, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: c.foreground }]}>Volledige omgeving</Text>
      </View>

      {state.status === "loading" && (
        <View style={[styles.fill, styles.center]}>
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.note, { color: c.mutedForeground }]}>
            Je wordt aangemeld…
          </Text>
        </View>
      )}

      {state.status === "error" && (
        <View style={[styles.fill, styles.center, { padding: 24 }]}>
          <Ionicons name="cloud-offline-outline" size={36} color={c.mutedForeground} />
          <Text style={[styles.note, { color: c.mutedForeground, textAlign: "center" }]}>
            {state.message}
          </Text>
          <Pressable
            onPress={() => void start()}
            style={[styles.retryBtn, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.retryText, { color: c.primaryForeground }]}>
              Opnieuw proberen
            </Text>
          </Pressable>
        </View>
      )}

      {state.status === "ready" && (
        <WebView
          source={{ uri: state.url }}
          style={styles.fill}
          // Cookies zijn nodig voor de Clerk-websessie binnen deze weergave.
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.background }]}>
              <ActivityIndicator color={c.primary} />
            </View>
          )}
          onError={() =>
            setState({
              status: "error",
              message:
                "De webomgeving kon niet worden geladen. Controleer je verbinding en probeer het opnieuw.",
            })
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  note: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: { fontFamily: "Inter_700Bold", fontSize: 15 },
});
