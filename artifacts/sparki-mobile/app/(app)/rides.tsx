import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionCard } from "@/components/SessionCard";
import { useColors } from "@/hooks/useColors";
import { useSessions } from "@/lib/sessions-api";

/**
 * The athlete's saved rides, straight from the backend training sessions —
 * including the REAL measured sensor values (wattage / hartslag / cadans)
 * where they exist. Rides without sensor data honestly show none.
 */
export default function RidesScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: sessions, isLoading, isError, error, refetch, isRefetching } =
    useSessions();

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Ionicons name="chevron-back" size={22} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: c.primary }]}>SPARKI</Text>
          <Text style={[styles.title, { color: c.foreground }]}>Mijn ritten</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={c.mutedForeground} />
          <Text style={[styles.stateTitle, { color: c.foreground }]}>
            Ritten laden lukt niet
          </Text>
          <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
            {(error as Error)?.message ??
              "Controleer je verbinding en probeer opnieuw."}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retry, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>
              Opnieuw proberen
            </Text>
          </Pressable>
        </View>
      ) : !sessions || sessions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bicycle-outline" size={40} color={c.mutedForeground} />
          <Text style={[styles.stateTitle, { color: c.foreground }]}>
            Nog geen ritten
          </Text>
          <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
            Neem een rit op met "Start vrije rit" of navigeer een route — je
            opgeslagen ritten verschijnen hier met de gemeten waarden.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
            gap: 14,
          }}
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              onPress={() => router.push(`/ride/${item.id}`)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={c.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 12,
  },
  eyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 2,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  stateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, marginTop: 4 },
  stateBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  retry: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
