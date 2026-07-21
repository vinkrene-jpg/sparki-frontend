import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { SessionSummary } from "@/lib/sessions-api";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtDuration(min: number | null): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
}

function fmtDistance(km: string | null): string | null {
  if (km == null) return null;
  const n = Number(km);
  if (!Number.isFinite(n)) return null;
  return `${n.toFixed(1)} km`;
}

const SOURCE_LABEL: Record<string, string> = {
  file: "Opgenomen rit",
  manual: "Handmatig",
  strava: "Strava",
};

/**
 * One saved ride from the backend. Sensor values (wattage / hartslag /
 * cadans) are shown ONLY when the session really carries them — a ride
 * without sensors simply has no sensor row, never zeros or dashes.
 */
export function SessionCard({ session }: { session: SessionSummary }) {
  const c = useColors();

  const duration = fmtDuration(session.durationMin);
  const distance = fmtDistance(session.distanceKm);

  const sensorStats: { icon: keyof typeof Ionicons.glyphMap; text: string }[] =
    [];
  if (session.avgPower != null)
    sensorStats.push({ icon: "flash-outline", text: `${session.avgPower} W gem.` });
  if (session.avgHR != null)
    sensorStats.push({
      icon: "heart-outline",
      text:
        session.maxHR != null
          ? `${session.avgHR} gem. · ${session.maxHR} max`
          : `${session.avgHR} gem.`,
    });
  if (session.avgCadence != null)
    sensorStats.push({
      icon: "sync-outline",
      text: `${session.avgCadence} rpm`,
    });

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
          {session.title?.trim() || "Rit"}
        </Text>
        <View style={[styles.badge, { backgroundColor: c.accent, borderRadius: 999 }]}>
          <Text style={[styles.badgeText, { color: c.accentForeground }]}>
            {SOURCE_LABEL[session.source] ?? session.source}
          </Text>
        </View>
      </View>

      <Text style={[styles.date, { color: c.mutedForeground }]}>
        {fmtDate(session.sessionDate)}
      </Text>

      {(distance || duration) && (
        <View style={styles.stats}>
          {distance && <Stat icon="navigate-outline" text={distance} c={c} />}
          {duration && <Stat icon="time-outline" text={duration} c={c} />}
        </View>
      )}

      {sensorStats.length > 0 ? (
        <View style={[styles.sensorRow, { borderTopColor: c.border }]}>
          {sensorStats.map((s) => (
            <View key={s.icon} style={styles.stat}>
              <Ionicons name={s.icon} size={15} color={c.primary} />
              <Text style={[styles.sensorText, { color: c.foreground }]}>
                {s.text}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.noSensors, { color: c.mutedForeground }]}>
          Geen sensorwaarden bij deze rit
        </Text>
      )}
    </View>
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
    gap: 8,
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
  date: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
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
  sensorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  sensorText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  noSensors: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
