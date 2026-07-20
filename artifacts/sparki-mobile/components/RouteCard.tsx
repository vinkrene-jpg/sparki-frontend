import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { RouteSummary } from "@/lib/routes-api";

function fmtDistance(km: number | null): string {
  if (km == null) return "— km";
  return `${km.toFixed(1)} km`;
}

function fmtElevation(m: number | null): string {
  if (m == null) return "— hm";
  return `${Math.round(m)} hm`;
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h}u ${m}m`;
  return `${m}m`;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Handmatig",
  generated: "Voorgesteld",
  file: "Geïmporteerd",
  gpx: "GPX-import",
};

export function RouteCard({
  route,
  onPress,
}: {
  route: RouteSummary;
  onPress: () => void;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderRadius: c.radius,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
          {route.name}
        </Text>
        <View
          style={[styles.badge, { backgroundColor: c.accent, borderRadius: 999 }]}
        >
          <Text style={[styles.badgeText, { color: c.accentForeground }]}>
            {SOURCE_LABEL[route.source] ?? route.source}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="navigate-outline" text={fmtDistance(route.distanceKm)} c={c} />
        <Stat icon="trending-up-outline" text={fmtElevation(route.elevationGainM)} c={c} />
        <Stat icon="time-outline" text={fmtDuration(route.durationSec)} c={c} />
      </View>

      <View style={styles.cta}>
        <Ionicons name="play" size={16} color={c.primary} />
        <Text style={[styles.ctaText, { color: c.primary }]}>Navigeer</Text>
      </View>
    </Pressable>
  );
}

function Stat({
  icon,
  text,
  c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={15} color={c.mutedForeground} />
      <Text style={[styles.statText, { color: c.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  name: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  stats: {
    flexDirection: "row",
    gap: 18,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
