import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveSensorsPanel } from "@/components/LiveSensorsPanel";
import { RouteMap } from "@/components/RouteMap";
import { useColors } from "@/hooks/useColors";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useGarageSensors, useLiveSensors } from "@/hooks/useLiveSensors";
import { useRideRecorder } from "@/hooks/useRideRecorder";
import {
  cumulativeKm,
  nearestPointIndex,
  toLatLon,
  type LatLon,
} from "@/lib/geo";
import { hasMapbox } from "@/lib/mapbox";
import {
  useRoute,
  useRouteRoadObjects,
  useSaveRide,
  type RouteStep,
} from "@/lib/routes-api";

const OFF_ROUTE_METERS = 60;

// Hoog-contrast HUD-kleuren voor bovenop de kaart: vrijwel dekkend donker met
// felle tekst, zodat cijfers en de richtingpijl in vol daglicht leesbaar zijn.
const HUD_BG = "rgba(4, 7, 14, 0.94)";
const HUD_TEXT = "#ffffff";
const HUD_MUTED = "rgba(255,255,255,0.72)";

// Map a routing "dir" token to a Dutch label + arrow icon. Tolerant: unknown
// values fall back to the raw dir + a generic arrow (never fabricated).
function describeDir(dir: string): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
} {
  const d = (dir || "").toLowerCase();
  if (d.includes("uturn") || d.includes("keer")) return { icon: "return-down-back", label: "Keren" };
  if (d.includes("sharp-left")) return { icon: "arrow-back", label: "Scherp links" };
  if (d.includes("sharp-right")) return { icon: "arrow-forward", label: "Scherp rechts" };
  if (d.includes("slight-left")) return { icon: "arrow-up", label: "Flauw links" };
  if (d.includes("slight-right")) return { icon: "arrow-up", label: "Flauw rechts" };
  if (d.includes("left")) return { icon: "arrow-back", label: "Links" };
  if (d.includes("right")) return { icon: "arrow-forward", label: "Rechts" };
  if (d.includes("straight") || d.includes("continue") || d.includes("rechtdoor"))
    return { icon: "arrow-up", label: "Rechtdoor" };
  if (d.includes("arrive") || d.includes("finish") || d.includes("aankomst"))
    return { icon: "flag", label: "Aankomst" };
  if (d.includes("depart") || d.includes("start")) return { icon: "arrow-up", label: "Start" };
  return { icon: "arrow-up", label: dir || "Volg de route" };
}

function fmtMeters(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function NavigateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = Number(id);
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: route, isLoading, isError, error } = useRoute(
    Number.isInteger(routeId) ? routeId : null,
  );
  const { location, permission, error: locError } = useLiveLocation(true);
  // Live Bluetooth sensors (wattage / hartslag / cadans) from the Fietsengarage.
  const sensors = useGarageSensors();
  const live = useLiveSensors();
  // Ref-backed reader so the recorder's 1s sampler always sees the CURRENT
  // sensor values without re-subscribing on every reading.
  const liveValuesRef = useRef(live.values);
  liveValuesRef.current = live.values;
  const getSensorValues = useCallback(() => liveValuesRef.current, []);
  const recorder = useRideRecorder(location, getSensorValues);
  const saveRide = useSaveRide();
  const [saved, setSaved] = useState<null | { sessionId: number | null }>(null);
  // Name/notitie editor for a RECOVERED (crash-survived) ride — same review
  // step as a normal stop-and-save flow. Cancelling keeps the recoverable ride
  // (the "Onafgemaakte rit gevonden" card returns); only a successful save
  // clears the persisted recovery store.
  const [recoveredReview, setRecoveredReview] = useState<null | {
    name: string;
    note: string;
  }>(null);

  const [following, setFollowing] = useState(true);
  const [showSensors, setShowSensors] = useState(false);

  const path: LatLon[] = useMemo(
    () => (route?.geometry ?? []).map(toLatLon),
    [route?.geometry],
  );
  const cumKm = useMemo(() => cumulativeKm(path), [path]);

  // Derive progress + next turn from the athlete's real position along the path.
  const progress = useMemo(() => {
    if (!location || path.length === 0) return null;
    const { index, distanceMeters } = nearestPointIndex(path, location);
    const traveledKm = cumKm[index] ?? 0;
    const totalKm = cumKm[cumKm.length - 1] ?? 0;
    const remainingKm = Math.max(0, totalKm - traveledKm);
    return {
      traveledKm,
      remainingKm,
      offRoute: distanceMeters > OFF_ROUTE_METERS,
      offBy: distanceMeters,
    };
  }, [location, path, cumKm]);

  const nextStep: RouteStep | null = useMemo(() => {
    if (!route?.nav || route.nav.length === 0 || !progress) return null;
    const ahead = route.nav.find((s) => s.km > progress.traveledKm + 0.015);
    return ahead ?? route.nav[route.nav.length - 1] ?? null;
  }, [route?.nav, progress]);

  const distanceToTurn =
    nextStep && progress
      ? Math.max(0, (nextStep.km - progress.traveledKm) * 1000)
      : null;

  // Verkeerslichten langs de route uit de Sparki Traffic Database (echte
  // OSM- en detectiedata). Best-effort: zonder data geen regel in de HUD.
  const { data: roadObjects } = useRouteRoadObjects(
    Number.isInteger(routeId) ? routeId : null,
  );
  const nextSignal = useMemo(() => {
    const objs = roadObjects?.objects;
    if (!objs || objs.length === 0 || !progress) return null;
    const ahead = objs.filter(
      (o) =>
        o.kind === "traffic_signal" &&
        o.routeKm >= progress.traveledKm - 0.02,
    );
    if (ahead.length === 0) return null;
    return {
      distanceM: Math.max(
        0,
        Math.round((ahead[0].routeKm - progress.traveledKm) * 1000),
      ),
      remaining: ahead.length,
    };
  }, [roadObjects?.objects, progress]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  // ---------- Loading / error ----------
  if (isLoading) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  if (isError || !route) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.background, padding: 32 }]}>
        <Ionicons name="alert-circle-outline" size={40} color={c.mutedForeground} />
        <Text style={[styles.stateTitle, { color: c.foreground }]}>Route niet geladen</Text>
        <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
          {(error as Error)?.message ?? "Deze route kon niet worden geopend."}
        </Text>
        <Pressable onPress={goBack} style={[styles.backPill, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>Terug</Text>
        </Pressable>
      </View>
    );
  }

  const hasGeometry = path.length >= 2;
  const hasNav = !!route.nav && route.nav.length > 0;
  const showMap = Platform.OS !== "web" && hasMapbox && hasGeometry;

  return (
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      {/* ---------- Map ---------- */}
      {showMap ? (
        <RouteMap
          path={path}
          location={location}
          following={following}
          onUserPan={() => setFollowing(false)}
          primary={c.primary}
          background={c.background}
        />
      ) : (
        <MapFallback
          c={c}
          reason={
            Platform.OS === "web"
              ? "Live kaartnavigatie werkt in de Sparki-app op je telefoon (Expo Go). Hieronder zie je de route en de afslagen."
              : !hasMapbox
                ? "De kaart is nog niet gekoppeld — de Mapbox-sleutel ontbreekt. De route en afslagen staan hieronder."
                : "Deze route heeft geen kaartlijn (geometrie). De afslagen staan hieronder."
          }
          route={route}
          insets={insets}
          nextStepAbsent={!hasNav}
        />
      )}

      {/* ---------- Top: back + next instruction ---------- */}
      <View style={[styles.topWrap, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={[styles.backBtn, { backgroundColor: c.card, borderColor: c.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={c.foreground} />
        </Pressable>

        {hasNav ? (
          progress?.offRoute ? (
            <View style={[styles.instruction, { backgroundColor: c.card, borderColor: c.destructive }]}>
              <Ionicons name="warning-outline" size={26} color={c.destructive} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.instrLabel, { color: c.destructive }]}>Van de route</Text>
                <Text style={[styles.instrNote, { color: c.mutedForeground }]} numberOfLines={2}>
                  Je bent {fmtMeters(progress.offBy)} van de route. Keer terug naar de lijn.
                </Text>
              </View>
            </View>
          ) : nextStep ? (
            <View style={[styles.instruction, { backgroundColor: HUD_BG, borderColor: c.primary }]}>
              <View style={[styles.dirCircleBig, { backgroundColor: c.primary }]}>
                <Ionicons
                  name={describeDir(nextStep.dir).icon}
                  size={36}
                  color={c.primaryForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.instrTop}>
                  <Text style={[styles.instrLabelBig, { color: HUD_TEXT }]}>
                    {describeDir(nextStep.dir).label}
                  </Text>
                  {distanceToTurn != null && (
                    <Text style={[styles.instrDistBig, { color: c.primary }]}>
                      {fmtMeters(distanceToTurn)}
                    </Text>
                  )}
                </View>
                {!!nextStep.note && (
                  <Text style={[styles.instrNote, { color: HUD_MUTED }]} numberOfLines={2}>
                    {nextStep.note}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.instruction, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="navigate-outline" size={24} color={c.primary} />
              <Text style={[styles.instrNote, { color: c.mutedForeground, flex: 1 }]}>
                {location ? "Volg de route." : "Wachten op je locatie…"}
              </Text>
            </View>
          )
        ) : (
          <View style={[styles.instruction, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="information-circle-outline" size={24} color={c.mutedForeground} />
            <Text style={[styles.instrNote, { color: c.mutedForeground, flex: 1 }]}>
              Deze route heeft geen afslag-aanwijzingen. De lijn wordt wel getoond.
            </Text>
          </View>
        )}

        {nextSignal && !progress?.offRoute && (
          <View
            style={[
              styles.signalPill,
              { backgroundColor: HUD_BG, borderColor: c.border },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color="#facc15" />
            <Text style={[styles.signalText, { color: HUD_TEXT }]}>
              Nog {fmtMeters(nextSignal.distanceM)} tot verkeerslicht
              {nextSignal.remaining > 1
                ? ` · ${nextSignal.remaining} op de rest van je route`
                : ""}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => setShowSensors((s) => !s)}
          hitSlop={12}
          style={[
            styles.backBtn,
            {
              backgroundColor: c.card,
              borderColor: live.anyConnected ? c.primary : c.border,
            },
          ]}
        >
          <Ionicons
            name="bluetooth"
            size={20}
            color={live.anyConnected ? c.primary : c.mutedForeground}
          />
        </Pressable>
      </View>

      {/* ---------- Sensor panel (saved sensors from the Fietsengarage) ---------- */}
      {showSensors && (
        <View style={[styles.sensorsWrap, { top: insets.top + (hasNav ? 118 : 90) }]}>
          <LiveSensorsPanel
            c={c}
            sensors={sensors.data}
            sensorsLoading={sensors.isLoading}
            sensorsError={sensors.isError}
            support={live.support}
            connections={live.connections}
            onConnect={live.connect}
            onDisconnect={live.disconnect}
            onClose={() => setShowSensors(false)}
          />
        </View>
      )}

      {/* ---------- Location permission notice ---------- */}
      {(permission === "denied" || locError) && (
        <View style={[styles.locNotice, { top: insets.top + (hasNav ? 118 : 90), backgroundColor: c.card, borderColor: c.destructive }]}>
          <Ionicons name="location-outline" size={18} color={c.destructive} />
          <Text style={[styles.locNoticeText, { color: c.mutedForeground }]}>
            {locError ?? "Geen toegang tot je locatie."}
          </Text>
        </View>
      )}

      {/* ---------- Bottom: progress + recenter ---------- */}
      {Platform.OS !== "web" && hasMapbox && hasGeometry && (
        <View style={[styles.bottom, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          {!following && (
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
          <View style={[styles.progressBar, { backgroundColor: HUD_BG, borderColor: c.border }]}>
            <Metric
              label="Snelheid"
              value={
                location?.speedMps != null
                  ? `${Math.round(location.speedMps * 3.6)}`
                  : "—"
              }
              unit="km/u"
              highlight
              c={c}
            />
            <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
            <Metric
              label="Resterend"
              value={progress ? progress.remainingKm.toFixed(1) : "—"}
              unit="km"
              c={c}
            />
            <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
            <Metric
              label="Totaal"
              value={route.distanceKm != null ? route.distanceKm.toFixed(1) : "—"}
              unit="km"
              c={c}
            />
          </View>
          {live.anyConnected && (
            <View style={[styles.progressBar, { backgroundColor: HUD_BG, borderColor: c.border }]}>
              <Metric
                label="Vermogen"
                value={live.values.watts != null ? `${live.values.watts}` : "—"}
                unit="W"
                highlight
                c={c}
              />
              <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
              <Metric
                label="Hartslag"
                value={
                  live.values.heartRate != null ? `${live.values.heartRate}` : "—"
                }
                unit="spm"
                c={c}
              />
              <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
              <Metric
                label="Cadans"
                value={live.values.cadence != null ? `${live.values.cadence}` : "—"}
                unit="rpm"
                c={c}
              />
            </View>
          )}
        </View>
      )}

      {/* ---------- Ride recording ---------- */}
      <RideRecorderBar
        c={c}
        insets={insets}
        recorder={recorder}
        location={location}
        permissionDenied={permission === "denied" || !!locError}
        saving={saveRide.isPending}
        saveError={saveRide.error ? String((saveRide.error as Error).message) : null}
        saved={saved}
        onStart={() => {
          setSaved(null);
          saveRide.reset();
          recorder.start();
        }}
        onStop={async () => {
          recorder.stop();
          try {
            const res = await saveRide.mutateAsync({
              points: recorder.points,
              name: route.name,
              // Real Bluetooth readings logged this ride — written into the
              // GPX so the saved training carries measured watts/hartslag/cadans.
              sensorSamples: recorder.getSensorSamples(),
            });
            setSaved({ sessionId: res.sessionId });
            recorder.reset();
          } catch {
            // Error surfaced via saveRide.error; track kept so the rider can retry.
          }
        }}
        onDismissSaved={() => setSaved(null)}
        recoveredReview={recoveredReview}
        onChangeRecoveredReview={(patch) =>
          setRecoveredReview((r) => (r ? { ...r, ...patch } : r))
        }
        onSaveRecovered={() => {
          // Same naam/notitie-check as a normal stop: open the editor first.
          // The recoverable ride stays persisted until the save succeeds.
          if (!recorder.recoverable) return;
          setSaved(null);
          saveRide.reset();
          setRecoveredReview({ name: route.name, note: "" });
        }}
        onSaveRecoveredReview={async () => {
          if (!recorder.recoverable || !recoveredReview) return;
          try {
            const res = await saveRide.mutateAsync({
              points: recorder.recoverable.points,
              name: recoveredReview.name.trim() || route.name,
              note: recoveredReview.note,
              // Sensor readings persisted before the crash — the recovered
              // ride keeps the measured watts/hartslag/cadans up to the kill.
              sensorSamples: recorder.recoverable.sensorSamples,
            });
            setSaved({ sessionId: res.sessionId });
            setRecoveredReview(null);
            recorder.reset();
          } catch {
            // Error surfaced via saveRide.error; recovered track kept so it can retry.
          }
        }}
        onCancelRecoveredReview={() => {
          // Cancel keeps the recoverable ride — the found-ride card returns.
          setRecoveredReview(null);
          saveRide.reset();
        }}
        onDiscardRecovered={recorder.discardRecovered}
      />
    </View>
  );
}

function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// The "Start rit" recorder. Honest at every step: recording is blocked when
// there is no location permission (no fabricated track), a too-short ride is
// rejected by the save client, and save failures are shown with a retry path.
function RideRecorderBar({
  c,
  insets,
  recorder,
  location,
  permissionDenied,
  saving,
  saveError,
  saved,
  onStart,
  onStop,
  onDismissSaved,
  recoveredReview,
  onChangeRecoveredReview,
  onSaveRecovered,
  onSaveRecoveredReview,
  onCancelRecoveredReview,
  onDiscardRecovered,
}: {
  c: ReturnType<typeof useColors>;
  insets: { bottom: number };
  recorder: ReturnType<typeof useRideRecorder>;
  location: ReturnType<typeof useLiveLocation>["location"];
  permissionDenied: boolean;
  saving: boolean;
  saveError: string | null;
  saved: null | { sessionId: number | null };
  onStart: () => void;
  onStop: () => void;
  onDismissSaved: () => void;
  recoveredReview: null | { name: string; note: string };
  onChangeRecoveredReview: (patch: Partial<{ name: string; note: string }>) => void;
  onSaveRecovered: () => void;
  onSaveRecoveredReview: () => void;
  onCancelRecoveredReview: () => void;
  onDiscardRecovered: () => void;
}) {
  const bottom = insets.bottom + 16;

  if (saved) {
    return (
      <View style={[styles.recWrap, { bottom }]} pointerEvents="box-none">
        <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.primary }]}>
          <Ionicons name="checkmark-circle" size={22} color={c.primary} />
          <Text style={[styles.recSavedText, { color: c.foreground }]}>
            {saved.sessionId != null
              ? "Rit opgeslagen in je trainingen."
              : "Rit opgeslagen."}
          </Text>
          <Pressable onPress={onDismissSaved} hitSlop={10}>
            <Ionicons name="close" size={20} color={c.mutedForeground} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (recorder.recording) {
    return (
      <View style={[styles.recWrap, { bottom }]} pointerEvents="box-none">
        <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.recStatsRow}>
              <View style={styles.recLive}>
                <View style={[styles.recDot, { backgroundColor: c.destructive }]} />
                <Text style={[styles.recLiveLabel, { color: c.destructive }]}>Bezig</Text>
              </View>
              <Text style={[styles.recStat, { color: c.foreground }]}>
                {fmtElapsed(recorder.elapsedSec)}
              </Text>
              <Text style={[styles.recStat, { color: c.foreground }]}>
                {recorder.distanceKm.toFixed(1)} km
              </Text>
            </View>
            {!location && (
              <Text style={[styles.recNote, { color: c.mutedForeground }]}>
                Wachten op je locatie…
              </Text>
            )}
            {recorder.backgroundActive ? (
              <Text style={[styles.recNote, { color: c.mutedForeground }]}>
                Opname loopt door als je scherm op slot gaat.
              </Text>
            ) : recorder.backgroundDenied ? (
              <Text style={[styles.recNote, { color: c.mutedForeground }]}>
                Alleen opname met scherm aan. Sta locatie op de achtergrond toe
                om ook met vergrendeld scherm op te nemen.
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onStop}
            disabled={saving}
            style={[styles.recBtn, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}
          >
            {saving ? (
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
      </View>
    );
  }

  // Name/notitie review for a recovered ride — the SAME check a normal stop
  // goes through before saving. Cancel keeps the recoverable ride.
  if (recoveredReview && recorder.recoverable) {
    return (
      <View style={[styles.recWrap, { bottom }]} pointerEvents="box-none">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.reviewTitle, { color: c.foreground }]}>Rit opslaan</Text>
            <Text style={[styles.reviewSub, { color: c.mutedForeground }]}>
              {`Herstelde rit van ${recorder.recoverable.distanceKm.toFixed(1)} km`}
            </Text>

            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Naam</Text>
            <TextInput
              value={recoveredReview.name}
              onChangeText={(name) => onChangeRecoveredReview({ name })}
              placeholderTextColor={c.mutedForeground}
              style={[
                styles.input,
                { color: c.foreground, borderColor: c.border, backgroundColor: c.background },
              ]}
              maxLength={80}
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
              Notitie (optioneel)
            </Text>
            <TextInput
              value={recoveredReview.note}
              onChangeText={(note) => onChangeRecoveredReview({ note })}
              placeholder="Hoe voelde de rit?"
              placeholderTextColor={c.mutedForeground}
              style={[
                styles.input,
                styles.inputMultiline,
                { color: c.foreground, borderColor: c.border, backgroundColor: c.background },
              ]}
              multiline
              maxLength={500}
            />

            {saveError && (
              <View style={styles.reviewErr}>
                <Ionicons name="alert-circle-outline" size={16} color={c.destructive} />
                <Text style={[styles.recNote, { color: c.mutedForeground, flex: 1 }]}>
                  {saveError}
                </Text>
              </View>
            )}

            <View style={styles.reviewActions}>
              <Pressable
                onPress={onCancelRecoveredReview}
                disabled={saving}
                style={[styles.reviewCancel, { borderColor: c.border }]}
              >
                <Text style={[styles.reviewCancelText, { color: c.mutedForeground }]}>
                  Annuleren
                </Text>
              </Pressable>
              <Pressable
                onPress={onSaveRecoveredReview}
                disabled={saving}
                style={[
                  styles.reviewSave,
                  { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={c.primaryForeground} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={c.primaryForeground} />
                    <Text style={[styles.recBtnText, { color: c.primaryForeground }]}>
                      Opslaan
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={[styles.recWrap, { bottom }]} pointerEvents="box-none">
      {saveError && (
        <View style={[styles.recErr, { backgroundColor: c.card, borderColor: c.destructive }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.destructive} />
          <Text style={[styles.recNote, { color: c.mutedForeground, flex: 1 }]}>{saveError}</Text>
        </View>
      )}
      {recorder.recoverable && (
        <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.primary, flexWrap: "wrap" }]}>
          <Ionicons name="save-outline" size={20} color={c.primary} />
          <Text style={[styles.recNote, { color: c.foreground, flex: 1 }]}>
            Onafgemaakte rit gevonden ({recorder.recoverable.distanceKm.toFixed(1)} km).
            De opname stopte onverwacht — je kunt hem alsnog opslaan.
          </Text>
          <View style={styles.recoverActions}>
            <Pressable
              onPress={onDiscardRecovered}
              disabled={saving}
              hitSlop={8}
              style={[styles.recoverGhost, { borderColor: c.border }]}
            >
              <Text style={[styles.recNote, { color: c.mutedForeground }]}>
                Verwijderen
              </Text>
            </Pressable>
            <Pressable
              onPress={onSaveRecovered}
              disabled={saving}
              style={[styles.recoverSave, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color={c.primaryForeground} />
              ) : (
                <Text style={[styles.recBtnText, { color: c.primaryForeground, fontSize: 14 }]}>
                  Opslaan
                </Text>
              )}
            </Pressable>
          </View>
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
          <Text style={[styles.recBtnText, { color: c.primaryForeground }]}>Start rit</Text>
        </Pressable>
      )}
    </View>
  );
}

function Metric({
  label,
  value,
  unit,
  highlight,
  c,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricValueRow}>
        <Text
          style={[styles.metricValue, { color: highlight ? c.primary : HUD_TEXT }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={[styles.metricUnit, { color: highlight ? c.primary : HUD_MUTED }]}>
            {unit}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.metricLabel, { color: HUD_MUTED }]}>{label}</Text>
    </View>
  );
}

// Honest fallback when the live map can't render (web preview, no token, or no
// geometry): show the route facts + full turn list so it's never a dead-end.
function MapFallback({
  c,
  reason,
  route,
  insets,
  nextStepAbsent,
}: {
  c: ReturnType<typeof useColors>;
  reason: string;
  route: ReturnType<typeof useRoute>["data"];
  insets: { top: number; bottom: number };
  nextStepAbsent: boolean;
}) {
  if (!route) return null;
  return (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={{
        paddingTop: insets.top + 90,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
        gap: 16,
      }}
    >
      <View style={[styles.fbNotice, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name="phone-portrait-outline" size={20} color={c.primary} />
        <Text style={[styles.fbNoticeText, { color: c.mutedForeground }]}>{reason}</Text>
      </View>

      <Text style={[styles.fbTitle, { color: c.foreground }]}>{route.name}</Text>
      <View style={styles.fbStats}>
        <Text style={[styles.fbStat, { color: c.mutedForeground }]}>
          {route.distanceKm != null ? `${route.distanceKm.toFixed(1)} km` : "— km"}
        </Text>
        <Text style={[styles.fbStat, { color: c.mutedForeground }]}>
          {route.elevationGainM != null ? `${Math.round(route.elevationGainM)} hm` : "— hm"}
        </Text>
      </View>

      {nextStepAbsent ? (
        <View style={[styles.fbNotice, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.fbNoticeText, { color: c.mutedForeground }]}>
            Deze route heeft geen opgeslagen afslag-aanwijzingen.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {route.nav!.map((s, i) => {
            const d = describeDir(s.dir);
            return (
              <View
                key={i}
                style={[styles.fbStep, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <View style={[styles.dirCircle, { backgroundColor: c.accent }]}>
                  <Ionicons name={d.icon} size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.instrTop}>
                    <Text style={[styles.instrLabel, { color: c.foreground }]}>{d.label}</Text>
                    <Text style={[styles.instrDist, { color: c.primary }]}>
                      {s.km.toFixed(1)} km
                    </Text>
                  </View>
                  {!!s.note && (
                    <Text style={[styles.instrNote, { color: c.mutedForeground }]}>{s.note}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  stateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  stateBody: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 },
  backPill: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-start",
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
  instruction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dirCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  dirCircleBig: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  instrTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  instrLabel: { fontFamily: "Inter_700Bold", fontSize: 17 },
  instrLabelBig: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.3 },
  instrDist: { fontFamily: "Inter_700Bold", fontSize: 16 },
  instrDistBig: { fontFamily: "Inter_700Bold", fontSize: 21 },
  instrNote: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  signalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  signalText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
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
  sensorsWrap: { position: "absolute", left: 16, right: 16, zIndex: 10 },
  bottom: { position: "absolute", left: 16, right: 16, gap: 12, alignItems: "center" },
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
  metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  metricUnit: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  metricLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  divider: { width: StyleSheet.hairlineWidth, height: 40 },
  fbNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fbNoticeText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 19 },
  fbTitle: { fontFamily: "Inter_700Bold", fontSize: 24, letterSpacing: -0.4 },
  fbStats: { flexDirection: "row", gap: 16 },
  fbStat: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  fbStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recWrap: { position: "absolute", left: 16, right: 16, gap: 8 },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recErr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recStatsRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  recLive: { flexDirection: "row", alignItems: "center", gap: 6 },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  recLiveLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  recStat: { fontFamily: "Inter_700Bold", fontSize: 18 },
  recNote: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  recSavedText: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  recBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  recStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
  },
  recBtnText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  recoverActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    alignSelf: "stretch",
    justifyContent: "flex-end",
  },
  recoverGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recoverSave: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  reviewTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  reviewSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 4 },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: "top" },
  reviewErr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  reviewActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  reviewCancel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  reviewSave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
});
