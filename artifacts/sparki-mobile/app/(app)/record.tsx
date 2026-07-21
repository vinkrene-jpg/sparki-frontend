import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {
  useRideRecorder,
  type RidePoint,
  type RideSensorSample,
} from "@/hooks/useRideRecorder";
import {
  formatRideSensorSummary,
  summarizeRideSensors,
} from "@/lib/ride-sensor-summary";
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
  const [following, setFollowing] = useState(true);
  const [showSensors, setShowSensors] = useState(false);
  // After stopping, the recorded track is snapshotted here so it is never lost —
  // not on review-cancel, not on a failed save. The rider can reopen the review
  // to save it, or explicitly discard it. Only an explicit discard drops it.
  const [stoppedPoints, setStoppedPoints] = useState<RidePoint[] | null>(null);
  // Sensor readings snapshotted alongside the stopped track, so a save after
  // review still carries the real measured watts/hartslag/cadans.
  const [stoppedSamples, setStoppedSamples] = useState<RideSensorSample[]>([]);
  // The name/note editor. Opened from the stopped state; cancelling it returns
  // to the stopped state (track kept), never discards.
  const [review, setReview] = useState<null | {
    name: string;
    note: string;
  }>(null);
  // True while the review editor holds a RECOVERED (crash-survived) track. On
  // save success the persisted recovery store is cleared; on cancel it is kept
  // so the "Onafgemaakte rit gevonden" card comes back — never silently lost.
  const [reviewFromRecovery, setReviewFromRecovery] = useState(false);

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
    setReview(null);
    setStoppedPoints(null);
    setStoppedSamples([]);
    setReviewFromRecovery(false);
    saveRide.reset();
    recorder.start();
  };

  // Stopping does NOT save yet. The recorded track is snapshotted into
  // `stoppedPoints` before the recorder resets, then the review editor opens so
  // the rider can name the ride and add a note. The snapshot keeps the track
  // alive across cancel/retry — nothing is lost.
  const onStop = () => {
    recorder.stop();
    setStoppedPoints(recorder.points);
    setStoppedSamples(recorder.getSensorSamples());
    setReview({ name: defaultRideName(), note: "" });
    recorder.reset();
  };

  // Reopen the name/note editor for an already-stopped (but unsaved) track.
  const onEditStopped = () => {
    setReview({ name: defaultRideName(), note: "" });
    saveRide.reset();
  };

  const onSaveReview = async () => {
    if (!review || !stoppedPoints) return;
    try {
      const res = await saveRide.mutateAsync({
        points: stoppedPoints,
        name: review.name.trim() || defaultRideName(),
        note: review.note,
        sensorSamples: stoppedSamples,
      });
      setSaved({ sessionId: res.sessionId });
      setReview(null);
      setStoppedPoints(null);
      setStoppedSamples([]);
      if (reviewFromRecovery) {
        // The recovered ride is now safely saved: clear the persisted
        // recovery store so it is never offered again.
        setReviewFromRecovery(false);
        recorder.reset();
      }
    } catch {
      // Error surfaced via saveRide.error; the review AND the stopped track are
      // kept so the rider can retry without losing anything.
    }
  };

  // A ride that survived an app kill/crash goes through the SAME name/notitie
  // review as a normal stop: pressing "Opslaan" opens the editor with the
  // recovered track snapshotted in. The persisted recovery store is only
  // cleared after a successful save — cancelling keeps the recoverable ride.
  const onSaveRecovered = () => {
    if (!recorder.recoverable) return;
    setSaved(null);
    saveRide.reset();
    setStoppedPoints(recorder.recoverable.points);
    // Sensor readings persisted before the crash — the recovered ride keeps
    // the measured watts/hartslag/cadans up to the kill.
    setStoppedSamples(recorder.recoverable.sensorSamples);
    setReviewFromRecovery(true);
    setReview({ name: defaultRideName(), note: "" });
  };

  // Cancelling the editor returns to the stopped state — the recorded track is
  // preserved so the rider can still save it later. It is NOT discarded here.
  // For a recovered ride, cancel returns to the "Onafgemaakte rit gevonden"
  // card instead: the persisted recoverable ride is kept untouched.
  const onCancelReview = () => {
    setReview(null);
    saveRide.reset();
    if (reviewFromRecovery) {
      setReviewFromRecovery(false);
      setStoppedPoints(null);
      setStoppedSamples([]);
    }
  };

  // Explicitly discard the recorded track (the rider chose not to keep it).
  const onDiscardStopped = () => {
    setReview(null);
    setStoppedPoints(null);
    setStoppedSamples([]);
    saveRide.reset();
  };

  // Real avg/max of the measured sensor readings — computed from the exact
  // point-matched values that go into the GPX file (same matching path as
  // buildRideGpx), so this line always matches the export.
  const sensorSummaryLine = useMemo(
    () =>
      formatRideSensorSummary(
        summarizeRideSensors(stoppedPoints, stoppedSamples),
      ),
    [stoppedPoints, stoppedSamples],
  );

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
        <Pressable
          onPress={() => setShowSensors((s) => !s)}
          hitSlop={12}
          style={[
            styles.backBtn,
            {
              backgroundColor: c.card,
              borderColor: live.anyConnected ? c.primary : c.border,
              marginLeft: "auto",
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
        <View style={[styles.sensorsWrap, { top: insets.top + 66 }]}>
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
          {live.anyConnected && (
            <View style={[styles.progressBar, { backgroundColor: c.card, borderColor: c.border }]}>
              <Metric
                label="Vermogen"
                value={live.values.watts != null ? `${live.values.watts} W` : "—"}
                c={c}
              />
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              <Metric
                label="Hartslag"
                value={
                  live.values.heartRate != null ? `${live.values.heartRate}` : "—"
                }
                c={c}
              />
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              <Metric
                label="Cadans"
                value={live.values.cadence != null ? `${live.values.cadence}` : "—"}
                c={c}
              />
            </View>
          )}
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
        ) : review ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.reviewTitle, { color: c.foreground }]}>
                Rit opslaan
              </Text>
              <Text style={[styles.reviewSub, { color: c.mutedForeground }]}>
                {`${stoppedPoints?.length ?? 0} punt${(stoppedPoints?.length ?? 0) === 1 ? "" : "en"} vastgelegd`}
              </Text>
              {sensorSummaryLine && (
                <Text style={[styles.reviewSub, { color: c.mutedForeground }]}>
                  {sensorSummaryLine}
                </Text>
              )}

              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                Naam
              </Text>
              <TextInput
                value={review.name}
                onChangeText={(name) =>
                  setReview((r) => (r ? { ...r, name } : r))
                }
                placeholder={defaultRideName()}
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
                value={review.note}
                onChangeText={(note) =>
                  setReview((r) => (r ? { ...r, note } : r))
                }
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
                  onPress={onCancelReview}
                  disabled={saveRide.isPending}
                  style={[styles.reviewCancel, { borderColor: c.border }]}
                >
                  <Text style={[styles.reviewCancelText, { color: c.mutedForeground }]}>
                    Annuleren
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onSaveReview}
                  disabled={saveRide.isPending}
                  style={[
                    styles.reviewSave,
                    { backgroundColor: c.primary, opacity: saveRide.isPending ? 0.6 : 1 },
                  ]}
                >
                  {saveRide.isPending ? (
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
        ) : stoppedPoints ? (
          <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.reviewTitle, { color: c.foreground }]}>
              Rit gestopt
            </Text>
            <Text style={[styles.reviewSub, { color: c.mutedForeground }]}>
              {`${stoppedPoints.length} punt${stoppedPoints.length === 1 ? "" : "en"} vastgelegd. Nog niet opgeslagen.`}
            </Text>
            {sensorSummaryLine && (
              <Text style={[styles.reviewSub, { color: c.mutedForeground }]}>
                {sensorSummaryLine}
              </Text>
            )}
            <View style={styles.reviewActions}>
              <Pressable
                onPress={onDiscardStopped}
                style={[styles.reviewCancel, { borderColor: c.border }]}
              >
                <Text style={[styles.reviewCancelText, { color: c.mutedForeground }]}>
                  Verwerpen
                </Text>
              </Pressable>
              <Pressable
                onPress={onEditStopped}
                style={[styles.reviewSave, { backgroundColor: c.primary }]}
              >
                <Ionicons name="checkmark" size={18} color={c.primaryForeground} />
                <Text style={[styles.recBtnText, { color: c.primaryForeground }]}>
                  Opslaan
                </Text>
              </Pressable>
            </View>
          </View>
        ) : recorder.recording ? (
          <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.recLive}>
                <View style={[styles.recDot, { backgroundColor: c.destructive }]} />
                <Text style={[styles.recLiveLabel, { color: c.destructive }]}>Bezig</Text>
              </View>
              {!location && (
                <Text style={[styles.recNote, { color: c.mutedForeground }]}>
                  Wachten op je locatie…
                </Text>
              )}
              {recorder.backgroundActive ? (
                <Text style={[styles.recNote, { color: c.mutedForeground }]}>
                  Opname loopt door als je scherm op slot gaat.
                  {live.values.watts != null ||
                  live.values.heartRate != null ||
                  live.values.cadence != null
                    ? " Sensorwaarden (wattage, hartslag, cadans) worden alleen vastgelegd zolang de app open is."
                    : ""}
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
            {recorder.recoverable && !saved && (
              <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.primary, flexWrap: "wrap" }]}>
                <Ionicons name="save-outline" size={20} color={c.primary} />
                <Text style={[styles.recNote, { color: c.foreground, flex: 1 }]}>
                  Onafgemaakte rit gevonden ({recorder.recoverable.distanceKm.toFixed(1)} km).
                  De opname stopte onverwacht — je kunt hem alsnog opslaan.
                </Text>
                <View style={styles.recoverActions}>
                  <Pressable
                    onPress={recorder.discardRecovered}
                    disabled={saveRide.isPending}
                    hitSlop={8}
                    style={[styles.recoverGhost, { borderColor: c.border }]}
                  >
                    <Text style={[styles.recNote, { color: c.mutedForeground }]}>
                      Verwijderen
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onSaveRecovered}
                    disabled={saveRide.isPending}
                    style={[styles.recoverSave, { backgroundColor: c.primary, opacity: saveRide.isPending ? 0.6 : 1 }]}
                  >
                    {saveRide.isPending ? (
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
  sensorsWrap: { position: "absolute", left: 16, right: 16, zIndex: 10 },
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
  recBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },
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
