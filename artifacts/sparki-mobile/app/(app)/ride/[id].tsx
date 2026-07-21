import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrackMap } from "@/components/TrackMap";
import { useColors } from "@/hooks/useColors";
import type { LatLon } from "@/lib/geo";
import { hasMapbox } from "@/lib/mapbox";
import { useSession } from "@/lib/sessions-api";

const SOURCE_LABEL: Record<string, string> = {
  file: "Opgenomen rit",
  manual: "Handmatig",
  strava: "Strava",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDuration(min: number | null): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
}

function fmtNum(v: string | number | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Detail of one saved ride: the REAL ridden track on the map (when the
 * activity import stored one) plus every measured value and the athlete's own
 * note. Rides without a stored track say so honestly — never a fabricated
 * line, never zeros for missing sensor values.
 */
export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, error, refetch } = useSession(
    Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null,
  );

  const path: LatLon[] = useMemo(
    () =>
      (data?.track ?? []).map(([lat, lon]) => ({
        latitude: lat,
        longitude: lon,
      })),
    [data?.track],
  );

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/rides");

  const session = data?.session ?? null;
  const hasTrack = path.length >= 2;
  const showMap = Platform.OS !== "web" && hasMapbox && hasTrack;

  // Every measured value the session really carries — absent values are simply
  // not listed (never zeros or dashes).
  const metrics: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] =
    [];
  if (session) {
    const distance = fmtNum(session.distanceKm);
    if (distance != null)
      metrics.push({ icon: "navigate-outline", label: "Afstand", value: `${distance.toFixed(1)} km` });
    const duration = fmtDuration(session.durationMin);
    if (duration)
      metrics.push({ icon: "time-outline", label: "Duur", value: duration });
    const speed = fmtNum(session.avgSpeedKph);
    if (speed != null)
      metrics.push({ icon: "speedometer-outline", label: "Gem. snelheid", value: `${speed.toFixed(1)} km/u` });
    if (session.elevationM != null)
      metrics.push({ icon: "trending-up-outline", label: "Hoogtemeters", value: `${session.elevationM} m` });
    if (session.avgPower != null)
      metrics.push({ icon: "flash-outline", label: "Gem. vermogen", value: `${session.avgPower} W` });
    if (session.normalizedPower != null)
      metrics.push({ icon: "flash-outline", label: "Genormaliseerd vermogen", value: `${session.normalizedPower} W` });
    if (session.avgHR != null)
      metrics.push({ icon: "heart-outline", label: "Gem. hartslag", value: `${session.avgHR}` });
    if (session.maxHR != null)
      metrics.push({ icon: "heart-outline", label: "Max. hartslag", value: `${session.maxHR}` });
    if (session.avgCadence != null)
      metrics.push({ icon: "sync-outline", label: "Gem. cadans", value: `${session.avgCadence} rpm` });
    if (session.tss != null)
      metrics.push({ icon: "barbell-outline", label: "Belastingscore", value: `${session.tss}` });
    if (session.feelScore != null)
      metrics.push({ icon: "happy-outline", label: "Gevoel", value: `${session.feelScore}/10` });
  }

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
          <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
            {session?.title?.trim() || "Rit"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : isError || !session ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={c.mutedForeground} />
          <Text style={[styles.stateTitle, { color: c.foreground }]}>
            Rit laden lukt niet
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
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
            gap: 14,
          }}
        >
          <View style={styles.metaRow}>
            <Text style={[styles.date, { color: c.mutedForeground }]}>
              {fmtDate(session.sessionDate)}
            </Text>
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Text style={[styles.badgeText, { color: c.accentForeground }]}>
                {SOURCE_LABEL[session.source] ?? session.source}
              </Text>
            </View>
          </View>

          {/* ---------- Map: the real ridden track, or an honest fallback ---------- */}
          {showMap ? (
            <View
              style={[
                styles.mapBox,
                { borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <TrackMap path={path} primary={c.primary} background={c.background} />
            </View>
          ) : (
            <View
              style={[
                styles.noMap,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Ionicons name="map-outline" size={26} color={c.mutedForeground} />
              <Text style={[styles.noMapText, { color: c.mutedForeground }]}>
                {!hasTrack
                  ? "Geen kaartdata bij deze rit — er is geen GPS-track opgeslagen."
                  : Platform.OS === "web"
                    ? "De kaart werkt in de Sparki-app op je telefoon (Expo Go)."
                    : "De kaart is nog niet gekoppeld — de Mapbox-sleutel ontbreekt."}
              </Text>
            </View>
          )}

          {/* ---------- Measured values ---------- */}
          {metrics.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Gemeten waarden
              </Text>
              {metrics.map((m) => (
                <View key={m.label} style={styles.metricRow}>
                  <Ionicons name={m.icon} size={16} color={c.primary} />
                  <Text style={[styles.metricLabel, { color: c.mutedForeground }]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.metricValue, { color: c.foreground }]}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.noMapText, { color: c.mutedForeground }]}>
                Geen gemeten waarden bij deze rit.
              </Text>
            </View>
          )}

          {/* ---------- Note ---------- */}
          {session.notes?.trim() ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Notitie</Text>
              <Text style={[styles.noteText, { color: c.foreground }]}>
                {session.notes.trim()}
              </Text>
            </View>
          ) : null}
        </ScrollView>
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
  eyebrow: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 2 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  date: { fontFamily: "Inter_500Medium", fontSize: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  mapBox: {
    height: 280,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  noMap: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 8,
  },
  noMapText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  metricValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  noteText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
});
