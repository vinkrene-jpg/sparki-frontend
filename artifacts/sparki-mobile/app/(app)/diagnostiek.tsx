import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useUploadQueue } from "@/hooks/useUploadQueue";

function fmtWhen(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Diagnostiek: eerlijk overzicht van ritten die nog op je telefoon staan te
 * wachten op uploaden. Toont per rit de laatste foutmelding en het aantal
 * pogingen; "Nu opnieuw proberen" negeert de wachttijd. Weggooien kan alleen
 * bewust, met bevestiging — een rit die hier staat is nergens anders bewaard.
 */
export default function DiagnostiekScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { queue, processing, retryNow, discard } = useUploadQueue();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const onRetry = async () => {
    setLastResult(null);
    const result = await retryNow();
    const ok = result.uploaded.length;
    const failed = result.failed.length;
    setLastResult(
      ok === 0 && failed === 0
        ? "Niets te uploaden."
        : [
            ok > 0 ? `${ok} rit${ok === 1 ? "" : "ten"} geüpload.` : null,
            failed > 0
              ? `${failed} rit${failed === 1 ? "" : "ten"} nog niet gelukt.`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
    );
  };

  const onDiscard = (localId: string, name: string) => {
    const doDiscard = () => void discard(localId);
    if (Platform.OS === "web") {
      doDiscard();
      return;
    }
    Alert.alert(
      "Rit weggooien?",
      `"${name}" is nog niet geüpload en is nergens anders bewaard. Weggooien kan niet ongedaan worden gemaakt.`,
      [
        { text: "Annuleren", style: "cancel" },
        { text: "Weggooien", style: "destructive", onPress: doDiscard },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={12}
          style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.foreground }]}>Diagnostiek</Text>
          <Text style={[styles.sub, { color: c.mutedForeground }]}>
            Ritten die wachten op uploaden
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
          gap: 12,
        }}
      >
        {queue.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="checkmark-circle-outline" size={32} color={c.primary} />
            <Text style={[styles.emptyTitle, { color: c.foreground }]}>
              Alles gesynchroniseerd
            </Text>
            <Text style={[styles.emptyBody, { color: c.mutedForeground }]}>
              Er staan geen ritten meer in de wachtrij op je telefoon.
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => void onRetry()}
              disabled={processing}
              style={[
                styles.retryBtn,
                { backgroundColor: c.primary, opacity: processing ? 0.6 : 1 },
              ]}
            >
              {processing ? (
                <ActivityIndicator color={c.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color={c.primaryForeground} />
                  <Text style={[styles.retryText, { color: c.primaryForeground }]}>
                    Nu opnieuw proberen
                  </Text>
                </>
              )}
            </Pressable>
            {lastResult && (
              <Text style={[styles.resultLine, { color: c.mutedForeground }]}>
                {lastResult}
              </Text>
            )}
            {queue.map((item) => (
              <View
                key={item.localId}
                style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, { color: c.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() => onDiscard(item.localId, item.name)}
                  >
                    <Ionicons name="trash-outline" size={18} color={c.mutedForeground} />
                  </Pressable>
                </View>
                <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                  Opgeslagen {fmtWhen(item.createdAt)}
                  {item.attempts > 0
                    ? ` · ${item.attempts} poging${item.attempts === 1 ? "" : "en"}`
                    : ""}
                </Text>
                {item.lastError && (
                  <Text style={[styles.cardErr, { color: c.destructive }]}>
                    {item.lastError}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
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
  title: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    padding: 26,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  resultLine: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  cardMeta: { fontFamily: "Inter_400Regular", fontSize: 12 },
  cardErr: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
});
