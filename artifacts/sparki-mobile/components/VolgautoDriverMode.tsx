import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RouteMap } from "@/components/RouteMap";
import { useColors } from "@/hooks/useColors";
import type { LiveLocation } from "@/hooks/useLiveLocation";
import { cumulativeKm, toLatLon, type LatLon } from "@/lib/geo";
import { hasMapbox } from "@/lib/mapbox";
import {
  corridorMeters,
  createOffRouteState,
  matchToRoute,
  updateOffRoute,
  type MatchLatLon,
} from "@/lib/route-match";
import type { RouteStep } from "@/lib/routes-api";
import {
  postVolgautoPosition,
  useVolgautoPositions,
  useVolgautoRejoin,
  useVolgautoReport,
  VOLGAUTO_REPORT_KINDS,
  type VolgautoPlan,
  type VolgautoRejoinResult,
} from "@/lib/volgauto-api";
import {
  CAR_BLOCKED_NOTICE,
  createMeetChoiceState,
  estimateMeetEta,
  formatWaitLine,
  isPositionFresh,
  updateMeetChoice,
} from "@/lib/volgauto-meet";

// Volgauto-bestuurdersmodus (Opdracht 3). BEWUST een eigen scherm, los van de
// fietsnavigatie: grote knoppen/tekst (veiligheid in de auto), de aparte
// autoroute op de kaart, het actieve aansluitpunt met GESCHATTE wachttijd, en
// een eerlijke melding wanneer de fietslijn niet voor auto's bereikbaar is.
// De fietsroute en fietsflow blijven volledig onaangeraakt.

const HUD_BG = "rgba(4, 7, 14, 0.94)";
const HUD_TEXT = "#ffffff";
const HUD_MUTED = "rgba(255,255,255,0.72)";

function fmtMin(sec: number | null): string {
  if (sec == null) return "—";
  return `${Math.max(0, Math.round(sec / 60))} min`;
}

export function VolgautoDriverMode({
  routeId,
  plan,
  location,
  onExit,
}: {
  routeId: number;
  plan: VolgautoPlan;
  location: LiveLocation | null;
  onExit: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  const carPath: LatLon[] = useMemo(
    () => (plan.carGeometry ?? []).map(toLatLon),
    [plan.carGeometry],
  );
  const carCum = useMemo(() => cumulativeKm(carPath), [carPath]);
  const carMatchPath: MatchLatLon[] = useMemo(
    () => carPath.map((p) => ({ lat: p.latitude, lon: p.longitude })),
    [carPath],
  );

  const [following, setFollowing] = useState(true);

  // Positie op de AUTOroute matchen (zelfde bewezen engine als de fiets).
  const hintRef = useRef<number | null>(null);
  const match = useMemo(() => {
    if (!location || carMatchPath.length === 0) return null;
    return matchToRoute(
      carMatchPath,
      carCum,
      { lat: location.latitude, lon: location.longitude },
      hintRef.current,
    );
  }, [location, carMatchPath, carCum]);
  useEffect(() => {
    hintRef.current = match ? match.segIndex : null;
  }, [match]);

  const offRef = useRef(createOffRouteState());
  const [offRoute, setOffRoute] = useState(false);
  useEffect(() => {
    if (!location || !match) return;
    const upd = updateOffRoute(offRef.current, {
      lat: location.latitude,
      lon: location.longitude,
      timestampMs: Date.now(),
      distanceM: match.distanceM,
      alongKm: match.alongKm,
      accuracyM: location.accuracyM,
      speedMps: location.speedMps,
    });
    offRef.current = upd.state;
    if (upd.state.active !== offRoute) setOffRoute(upd.state.active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, match]);

  // Eigen positie delen (best-effort) + rennerpositie ophalen.
  useEffect(() => {
    if (!location) return;
    const send = () =>
      void postVolgautoPosition(routeId, {
        role: "volgauto",
        lat: location.latitude,
        lon: location.longitude,
        speedMps: location.speedMps ?? null,
      });
    send();
    const t = setInterval(send, 20_000);
    return () => clearInterval(t);
    // Alleen bij (de)activeren en route: de interval leest via closure de
    // laatst bekende locatie niet — daarom herstart bij elke nieuwe fix.
  }, [routeId, location]);
  const { data: riderPositions } = useVolgautoPositions(routeId, "renner", true);
  const rider = useMemo(() => {
    const p = riderPositions?.[0];
    if (!p) return null;
    if (!isPositionFresh(new Date(p.updatedAt).getTime(), Date.now())) return null;
    return p;
  }, [riderPositions]);

  // Renner-voortgang op de FIETSroute schatten via zijn gedeelde positie —
  // we projecteren op de fiets-km's van de aansluitpunten (bikeKm oplopend).
  const bikePathForRider: MatchLatLon[] | null = useMemo(() => null, []);
  void bikePathForRider;
  const riderBikeKm = useMemo(() => {
    if (!rider) return null;
    // Zonder de fietslijn hier opnieuw te laden: kies het aansluitpunt dat het
    // dichtst bij de rennerpositie ligt en gebruik de km-ligging daarvan als
    // eerlijke schatting van de voortgang.
    let bestKm: number | null = null;
    let bestD = Infinity;
    for (const m of plan.meetpoints) {
      const dLat = (m.lat - rider.lat) * 111_320;
      const dLon =
        (m.lon - rider.lon) * 111_320 * Math.cos((rider.lat * Math.PI) / 180);
      const d = Math.hypot(dLat, dLon);
      if (d < bestD) {
        bestD = d;
        bestKm = m.bikeKm;
      }
    }
    return bestKm;
  }, [rider, plan.meetpoints]);

  // Stabiel actief aansluitpunt.
  const meetRef = useRef(createMeetChoiceState());
  const [meetIdx, setMeetIdx] = useState<number | null>(null);
  const [switchedNotice, setSwitchedNotice] = useState(false);
  useEffect(() => {
    const upd = updateMeetChoice(meetRef.current, {
      meetpoints: plan.meetpoints,
      riderBikeKm: riderBikeKm ?? 0,
      nowMs: Date.now(),
    });
    meetRef.current = upd.state;
    if (upd.state.activeIndex !== meetIdx) setMeetIdx(upd.state.activeIndex);
    if (upd.switched) setSwitchedNotice(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.meetpoints, riderBikeKm]);
  const meet = meetIdx != null ? plan.meetpoints[meetIdx] ?? null : null;

  const eta = useMemo(() => {
    if (!meet) return null;
    return estimateMeetEta({
      meet,
      riderBikeKm: riderBikeKm ?? 0,
      riderSpeedMps: rider?.speedMps ?? null,
      carKm: match ? match.alongKm : null,
      carSpeedMps: location?.speedMps ?? null,
    });
  }, [meet, riderBikeKm, rider?.speedMps, match, location?.speedMps]);

  // Autoroute-herberekening (altijd autoprofiel) naar het aansluitpunt.
  const rejoin = useVolgautoRejoin(routeId);
  const [detour, setDetour] = useState<VolgautoRejoinResult | null>(null);
  const detourPath: LatLon[] = useMemo(
    () => (detour?.path ?? []).map(toLatLon),
    [detour?.path],
  );
  useEffect(() => {
    if (detour && !offRoute) setDetour(null);
  }, [detour, offRoute]);
  const lastRejoinRef = useRef(0);
  const requestCarRejoin = useCallback(() => {
    if (!location || rejoin.isPending) return;
    if (Date.now() - lastRejoinRef.current < 30_000) return;
    lastRejoinRef.current = Date.now();
    rejoin.mutate(
      {
        lat: location.latitude,
        lon: location.longitude,
        ...(meet ? { targetLat: meet.lat, targetLon: meet.lon } : {}),
      },
      { onSuccess: setDetour },
    );
  }, [location, rejoin, meet]);

  // Volgende autostap uit de autonavigatie.
  const nextStep: RouteStep | null = useMemo(() => {
    const steps = plan.carNav ?? [];
    if (steps.length === 0 || !match) return null;
    return (
      steps.find((s) => s.km > match.alongKm + 0.02) ??
      steps[steps.length - 1] ??
      null
    );
  }, [plan.carNav, match]);

  // Rit-afsluiting: meldingenpaneel (géén universele waarheid).
  const [showReports, setShowReports] = useState(false);
  const report = useVolgautoReport(routeId);
  const [reportDone, setReportDone] = useState<string | null>(null);

  const showMap = Platform.OS !== "web" && hasMapbox && carPath.length >= 2;
  const displayLocation = location;

  return (
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      {showMap ? (
        <RouteMap
          path={carPath}
          detourPath={detourPath.length >= 2 ? detourPath : undefined}
          location={displayLocation}
          following={following}
          onUserPan={() => setFollowing(false)}
          primary="#f59e0b"
          background={c.background}
        />
      ) : (
        <View style={[styles.fill, styles.center]}>
          <Ionicons name="car-outline" size={40} color={c.mutedForeground} />
          <Text style={{ color: c.mutedForeground, marginTop: 8, textAlign: "center", paddingHorizontal: 32 }}>
            {carPath.length < 2
              ? "Er is geen autoroute beschikbaar voor deze route."
              : "Kaart niet beschikbaar op dit apparaat."}
          </Text>
        </View>
      )}

      {/* Grote bovenbalk — veiligheid: één blik, grote cijfers. */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.rowBetween}>
          <Pressable onPress={onExit} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="close" size={28} color={HUD_TEXT} />
          </Pressable>
          <Text style={styles.modeLabel}>VOLGAUTO</Text>
          <Pressable
            onPress={() => setFollowing(true)}
            hitSlop={12}
            style={styles.iconBtn}
          >
            <Ionicons name="locate" size={26} color={following ? "#f59e0b" : HUD_TEXT} />
          </Pressable>
        </View>
        {nextStep && (
          <Text style={styles.bigStep} numberOfLines={2}>
            {nextStep.note || nextStep.dir}
          </Text>
        )}
        {offRoute && (
          <Pressable onPress={requestCarRejoin} style={styles.noticeBtn}>
            <Ionicons name="alert-circle" size={22} color="#0b0f16" />
            <Text style={styles.noticeBtnText}>
              {rejoin.isPending
                ? "Autoroute wordt herberekend…"
                : `${CAR_BLOCKED_NOTICE} Tik voor een nieuwe autoroute.`}
            </Text>
          </Pressable>
        )}
        {rejoin.isError && (
          <Text style={styles.errText}>
            {(rejoin.error as Error)?.message ?? "Herberekenen mislukt."}
          </Text>
        )}
      </View>

      {/* Aansluitpunt-paneel onderaan — grote tekst, geschatte tijden. */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
        {switchedNotice && (
          <Pressable onPress={() => setSwitchedNotice(false)} style={styles.switchNotice}>
            <Ionicons name="swap-horizontal" size={18} color="#f59e0b" />
            <Text style={styles.switchNoticeText}>
              Nieuw aansluitpunt gekozen — het vorige punt is gepasseerd of niet
              meer logisch. Tik om te sluiten.
            </Text>
          </Pressable>
        )}
        {meet ? (
          <>
            <Text style={styles.meetKicker}>Volgend aansluitpunt</Text>
            <Text style={styles.meetLabel} numberOfLines={2}>
              {meet.label}
            </Text>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.etaLabel}>Renner (geschat)</Text>
                <Text style={styles.etaValue}>{rider ? fmtMin(eta?.riderEtaSec ?? null) : "—"}</Text>
              </View>
              <View>
                <Text style={styles.etaLabel}>Jij (geschat)</Text>
                <Text style={styles.etaValue}>{fmtMin(eta?.carEtaSec ?? null)}</Text>
              </View>
            </View>
            <Text style={styles.waitLine}>
              {rider ? formatWaitLine(eta?.waitSec ?? null) : "Geen recente positie van de renner bekend."}
            </Text>
          </>
        ) : (
          <Text style={styles.waitLine}>
            Geen aansluitpunt meer vóór de renner — rijd naar de finish.
          </Text>
        )}
        <Text style={styles.disclaimer}>{plan.disclaimer}</Text>
        <Pressable onPress={() => setShowReports((v) => !v)} style={styles.reportToggle}>
          <Ionicons name="megaphone-outline" size={18} color={HUD_MUTED} />
          <Text style={styles.reportToggleText}>Iets melden over deze autoroute</Text>
        </Pressable>
        {showReports && (
          <ScrollView style={{ maxHeight: 200 }}>
            {reportDone ? (
              <Text style={styles.reportDone}>{reportDone}</Text>
            ) : (
              VOLGAUTO_REPORT_KINDS.map((k) => (
                <Pressable
                  key={k.kind}
                  disabled={report.isPending}
                  onPress={() =>
                    report.mutate(
                      {
                        kind: k.kind,
                        ...(location
                          ? { lat: location.latitude, lon: location.longitude }
                          : {}),
                      },
                      { onSuccess: (r) => setReportDone(r.uitleg) },
                    )
                  }
                  style={styles.reportBtn}
                >
                  <Text style={styles.reportBtnText}>{k.label}</Text>
                </Pressable>
              ))
            )}
            {report.isError && (
              <Text style={styles.errText}>
                {(report.error as Error)?.message ?? "Melden mislukt."}
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: HUD_BG,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  iconBtn: { padding: 4 },
  modeLabel: {
    color: "#f59e0b",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: 2,
  },
  bigStep: {
    color: HUD_TEXT,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 32,
  },
  noticeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    padding: 12,
  },
  noticeBtnText: {
    flex: 1,
    color: "#0b0f16",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 21,
  },
  errText: { color: "#fca5a5", fontSize: 14 },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: HUD_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    gap: 8,
  },
  switchNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: 12,
    padding: 10,
  },
  switchNoticeText: { flex: 1, color: "#fcd34d", fontSize: 14, lineHeight: 19 },
  meetKicker: {
    color: HUD_MUTED,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  meetLabel: { color: HUD_TEXT, fontFamily: "Inter_700Bold", fontSize: 22 },
  etaLabel: { color: HUD_MUTED, fontSize: 14 },
  etaValue: { color: HUD_TEXT, fontFamily: "Inter_700Bold", fontSize: 28 },
  waitLine: { color: HUD_TEXT, fontSize: 16, lineHeight: 22 },
  disclaimer: { color: HUD_MUTED, fontSize: 13, lineHeight: 18 },
  reportToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  reportToggleText: { color: HUD_MUTED, fontSize: 15 },
  reportBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  reportBtnText: { color: HUD_TEXT, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  reportDone: { color: "#86efac", fontSize: 15, lineHeight: 21, marginTop: 8 },
});
