import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RouteMap } from "@/components/RouteMap";
import { useColors } from "@/hooks/useColors";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useRideRecorder } from "@/hooks/useRideRecorder";
import { toLatLon, type LatLon } from "@/lib/geo";
import { hasMapbox } from "@/lib/mapbox";
import { useSaveRide } from "@/lib/routes-api";

function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// A default, honest ride name derived from the moment the ride is saved. The
// backend still stores it as a real GPX; nothing here is fabricated.
function defaultRideName(): string {
  const now = new Date();
  const hh = now.getHours();
  const part =
    hh < 6 ? "Nachtrit" : hh < 12 ? "Ochtendrit" : hh < 18 ? "Middagrit" : "Avondrit";
  return part;
}

/**
 * Standalone "vrije rit" recorder — no saved route required. Reuses the exact
 * same recording (`useRideRecorder`) and save (`useSaveRide`) path as the
 * turn-by-turn navigate screen, so a spontaneous ride flows through the SAME
 * `/api/activity-imports` GPX ingest and becomes a real training session.
 * Honest at every step: recording is blocked without location permission (no
 * fabricated track) and a too-short track is rejected by the save client.
 */
export default function RecordScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { location, permission, error: locError } = useLiveLocation(true);
  const recorder = useRideRecorder(location);
  const saveRide = useSaveRide();
  const [saved, setSaved] = useState<null | { sessionId: number | null }>(null);
  const [following, setFollowing] = useState(true);

  // The live track being recorded, so the rider sees their real trail draw on
  // the map as they move (no planned line exists for a free ride).
  const path: LatLon[] = useMemo(
    () => recorder.points.map((p) => toLatLon([p.latitude, p.longitude])),
    [recorder.points],
  );

  const permissionDenied = permission === "denied" || !!locError;
  const showMap =
    Platform.OS !== "web" && hasMapbox && (path.length >= 2 || !!location);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const onStart = () => {
    setSaved(null);
    saveRide.reset();
    recorder.start();
  };

  const onStop = async () => {
    recorder.stop();
    try {
      const res = await saveRide.mutateAsync({
        points: recorder.points,
        name: defaultRideName(),
      });
      setSaved({ sessionId: res.sessionId });
      recorder.reset();
    } catch {
      // Error surfaced via saveRide.error; track kept so the rider can retry.
    }
  };

  const saveError = saveRide.error
    ? String((saveRide.error as Error).message)
    : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      {/* ---------- Map / backdrop ---------- */}
      {showMap ? (
        <RouteMap
          path={path.length >= 2 ? path : []}
          location={location}
          following={following}
          onUserPan={() => setFollowing(false)}
          primary={c.primary}
          background={c.background}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center, { padding: 32 }]}>
          <Ionicons name="bicycle-outline" size={44} color={c.mutedForeground} />
          <Text style={[styles.stateTitle, { color: c.foreground }]}>Vrije rit</Text>
          <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
            {Platform.OS === "web"
              ? "Ritregistratie werkt in de Sparki-app op je telefoon (Expo Go). Start hier je rit; je afgelegde weg wordt echt vastgelegd."
              : !hasMapbox
                ? "De kaart is nog niet gekoppeld — de Mapbox-sleutel ontbreekt. Je rit wordt wel echt opgenomen; alleen de kaartweergave ontbreekt."
                : "Wachten op je locatie…"}
          </Text>
        </View>
      )}

      {/* ---------- Top: back + title ---------- */}
      <View style={[styles.topWrap, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={[styles.backBtn, { backgroundColor: c.card, borderColor: c.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={c.foreground} />
        </Pressable>
        <View style={[styles.titlePill, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="radio-button-on" size={16} color={c.primary} />
          <Text style={[styles.titlePillText, { color: c.foreground }]}>Vrije rit</Text>
        </View>
      </View>

      {/* ---------- Location permission notice ---------- */}
      {permissionDenied && (
        <View style={[styles.locNotice, { top: insets.top + 66, backgroundColor: c.card, borderColor: c.destructive }]}>
          <Ionicons name="location-outline" size={18} color={c.destructive} />
          <Text style={[styles.locNoticeText, { color: c.mutedForeground }]}>
            {locError ?? "Geen toegang tot je locatie."}
          </Text>
        </View>
      )}

      {/* ---------- Live stats while recording ---------- */}
      {recorder.recording && (
        <View style={[styles.bottomStats, { bottom: insets.bottom + 96 }]} pointerEvents="box-none">
          {!following && showMap && path.length >= 2 && (
            <Pressable
              onPress={() => setFollowing(true)}
              style={[styles.recenter, { backgroundColor: c.primary }]}
            >
              <Ionicons name="locate" size={20} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
                Centreer
              </Text>
            </Pressable>
          )}
          <View style={[styles.progressBar, { backgroundColor: c.card, borderColor: c.border }]}>
            <Metric label="Tijd" value={fmtElapsed(recorder.elapsedSec)} c={c} />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <Metric label="Afstand" value={`${recorder.distanceKm.toFixed(1)} km`} c={c} />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <Metric
              label="Snelheid"
              value={
                location?.speedMps != null
                  ? `${Math.round(location.speedMps * 3.6)} km/u`
                  : "—"
              }
              c={c}
            />
          </View>
        </View>
      )}

      {/* ---------- Bottom: recorder controls ---------- */}
      <View style={[styles.recWrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
        {saved ? (
          <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.primary }]}>
            <Ionicons name="checkmark-circle" size={22} color={c.primary} />
            <Text style={[styles.recSavedText, { color: c.foreground }]}>
              {saved.sessionId != null
                ? "Rit opgeslagen in je trainingen."
                : "Rit opgeslagen."}
            </Text>
            <Pressable onPress={() => setSaved(null)} hitSlop={10}>
              <Ionicons name="close" size={20} color={c.mutedForeground} />
            </Pressable>
          </View>
        ) : recorder.recording ? (
          <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.recLive}>
              <View style={[styles.recDot, { backgroundColor: c.destructive }]} />
              <Text style={[styles.recLiveLabel, { color: c.destructive }]}>Bezig</Text>
            </View>
            {!location && (
              <Text style={[styles.recNote, { color: c.mutedForeground, flex: 1 }]}>
                Wachten op je locatie…
              </Text>
            )}
            <Pressable
              onPress={onStop}
              disabled={saveRide.isPending}
              style={[
                styles.recBtn,
                { backgroundColor: c.primary, opacity: saveRide.isPending ? 0.6 : 1 },
              ]}
            >
              {saveRide.isPending ? (
                <ActivityIndicator color={c.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="stop" size={18} color={c.primaryForeground} />
                  <Text style={[styles.recBtnText, { color: c.primaryForeground }]}>
                    Stop &amp; opslaan
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <>
            {saveError && (
              <View style={[styles.recErr, { backgroundColor: c.card, borderColor: c.destructive }]}>
                <Ionicons name="alert-circle-outline" size={18} color={c.destructive} />
                <Text style={[styles.recNote, { color: c.mutedForeground, flex: 1 }]}>
                  {saveError}
                </Text>
              </View>
            )}
            {permissionDenied ? (
              <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="location-outline" size={18} color={c.mutedForeground} />
                <Text style={[styles.recNote, { color: c.mutedForeground, flex: 1 }]}>
                  Sta locatie toe om een rit op te nemen.
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={onStart}
                style={[styles.recStartBtn, { backgroundColor: c.primary }]}
              >
                <Ionicons name="play" size={20} color={c.primaryForeground} />
                <Text style={[styles.recBtnText, { color: c.primaryForeground }]}>
                  Start rit
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: c.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: c.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  stateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  stateBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  topWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  titlePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titlePillText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  locNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locNoticeText: { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 },
  bottomStats: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 12,
    alignItems: "center",
  },
  recenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metric: { alignItems: "center", flex: 1 },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  metricLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 2 },
  divider: { width: StyleSheet.hairlineWidth, height: 30 },
  recWrap: { position: "absolute", left: 16, right: 16, gap: 10 },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recErr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recLive: { flexDirection: "row", alignItems: "center", gap: 6 },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  recLiveLabel: { fontFamily: "Inter_700Bold", fontSize: 13 },
  recNote: { fontFamily: "Inter_400Regular", fontSize: 13 },
  recSavedText: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  recBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  recStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
  },
  recBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
