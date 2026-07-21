import { useAuth } from "@clerk/expo";
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

import { RouteCard } from "@/components/RouteCard";
import { useColors } from "@/hooks/useColors";
import { useRoutes } from "@/lib/routes-api";

export default function RouteListScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data: routes, isLoading, isError, error, refetch, isRefetching } =
    useRoutes();

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: c.primary }]}>SPARKI</Text>
          <Text style={[styles.title, { color: c.foreground }]}>Kies je route</Text>
        </View>
        <Pressable
          onPress={() => signOut()}
          hitSlop={12}
          style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Ionicons name="log-out-outline" size={20} color={c.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.recordRow}>
        <Pressable
          onPress={() => router.push("/record")}
          style={[styles.recordBtn, { backgroundColor: c.primary }]}
        >
          <Ionicons name="play" size={20} color={c.primaryForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.recordTitle, { color: c.primaryForeground }]}>
              Start vrije rit
            </Text>
            <Text style={[styles.recordSub, { color: c.primaryForeground }]}>
              Neem een rit op zonder route te kiezen
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push("/rides")}
          style={[
            styles.ridesBtn,
            { backgroundColor: c.card, borderColor: c.border },
          ]}
        >
          <Ionicons name="bicycle-outline" size={20} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.ridesTitle, { color: c.foreground }]}>
              Mijn ritten
            </Text>
            <Text style={[styles.ridesSub, { color: c.mutedForeground }]}>
              Opgeslagen ritten met gemeten waarden
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={c.mutedForeground} />
          <Text style={[styles.stateTitle, { color: c.foreground }]}>
            Routes laden lukt niet
          </Text>
          <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
            {(error as Error)?.message ?? "Controleer je verbinding en probeer opnieuw."}
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
      ) : !routes || routes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={40} color={c.mutedForeground} />
          <Text style={[styles.stateTitle, { color: c.foreground }]}>
            Nog geen routes
          </Text>
          <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
            Je hebt nog geen opgeslagen routes. Maak of importeer een route in Sparki
            op het web — daarna verschijnt hij hier om te navigeren.
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
            gap: 14,
          }}
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              onPress={() => router.push(`/navigate/${item.id}`)}
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
  recordRow: { paddingHorizontal: 20, paddingBottom: 18, gap: 12 },
  ridesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ridesTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  ridesSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  recordTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  recordSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2, opacity: 0.85 },
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
