import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Battery from "expo-battery";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FallAlertCard } from "@/components/FallAlertCard";
import { LiveSensorsPanel } from "@/components/LiveSensorsPanel";
import {
  PermissionDeniedNotice,
  PermissionExplainer,
} from "@/components/PermissionExplainer";
import { RouteMap } from "@/components/RouteMap";
import { useColors } from "@/hooks/useColors";
import { useFallDetection } from "@/hooks/useFallDetection";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useLocationConsent } from "@/hooks/useLocationConsent";
import { useGarageSensors, useLiveSensors } from "@/hooks/useLiveSensors";
import { useRideRecorder } from "@/hooks/useRideRecorder";
import {
  cumulativeKm,
  nearestPointIndex,
  toLatLon,
  type LatLon,
} from "@/lib/geo";
import {
  corridorMeters,
  createOffRouteState,
  displayPosition,
  matchToRoute,
  updateOffRoute,
  type MatchLatLon,
} from "@/lib/route-match";
import { hasMapbox } from "@/lib/mapbox";
import { openAppInstellingen } from "@/lib/permissions";
import {
  ageFriendsLocally,
  clusterFriendMarkers,
  decideUpdateIntervalMs,
  type FriendCluster,
} from "@/lib/live-share";
import {
  postLivePosition,
  stopLiveShareNow,
  useFriendLivePositions,
  useGroupRideOptions,
  useLiveShareSession,
  useShareableFriends,
  useStartLiveShare,
  useStopLiveShare,
} from "@/lib/live-share-api";
import {
  clearActiveNav,
  loadActiveNav,
  saveActiveNav,
} from "@/lib/active-nav";
import {
  createCueState,
  decideCues,
  sanitizeNavSteps,
  type CueEngineState,
} from "@/lib/nav-cues";
import {
  playCueSound,
  prepareNavAudio,
  releaseNavAudio,
  speakCue,
} from "@/lib/nav-audio";
import { useNavAudioPrefs } from "@/lib/nav-audio-settings";
import {
  chooseMetricLayout,
  metricContainerWidthPx,
} from "@/lib/hud-metrics";
import { computeNavLayout } from "@/lib/nav-layout";
import {
  buildClimbWindows,
  climbPhaseAt,
  climbProfileSlice,
  type ClimbPhase,
} from "@/lib/nav-climb";
import {
  allowNewRejoinRequest,
  createOffRoutePromptState,
  offRouteOptions,
  registerDismiss,
  shouldShowOffRoutePrompt,
  type RejoinRequestMark,
} from "@/lib/off-route-choice";
import {
  createRaceModeState,
  finishCueAllowed,
  nextRacePoint,
  updateRaceMode,
} from "@/lib/race-mode";
import {
  meldNavigatieStart,
  useRejoinRoute,
  useRoute,
  useRouteRoadObjects,
  useSaveRide,
  type RejoinResult,
  type RouteDetail,
  type RouteStep,
} from "@/lib/routes-api";
import { VolgautoDriverMode } from "@/components/VolgautoDriverMode";
import {
  postVolgautoPosition,
  useVolgautoPlan,
  volgautoPlanRouteId,
  volgautoRolkeuzeZichtbaar,
} from "@/lib/volgauto-api";

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

  const { data: fetchedRoute, isLoading, isError, error } = useRoute(
    Number.isInteger(routeId) ? routeId : null,
  );
  // Offline-bestendig: zodra de route binnen is wordt hij lokaal bewaard;
  // valt het netwerk daarna weg (of herstart de app), dan navigeren we door
  // op de bewaarde kopie van dezelfde echte routedata.
  const [offlineRoute, setOfflineRoute] = useState<RouteDetail | null>(null);
  // Fail-closed preflight (taak #505): een bewuste 409-weigering van de
  // backend (route hard geblokkeerd of niet controleerbaar) stopt de
  // navigatie — nooit navigeren op een geblokkeerde/ongecontroleerde route.
  // Een kale netwerkfout weigert NIET (offline doorgaan blijft mogelijk).
  const [navRefusal, setNavRefusal] = useState<null | {
    code: "ROUTE_BLOCKED" | "ROUTE_UNVERIFIABLE";
    message: string;
  }>(null);
  useEffect(() => {
    if (fetchedRoute && Number.isInteger(routeId)) {
      let alive = true;
      void meldNavigatieStart(routeId).then((r) => {
        if (!alive) return;
        if (r.ok === false) {
          setNavRefusal({ code: r.code, message: r.message });
          return;
        }
        setNavRefusal(null);
        // Alleen een niet-geweigerde route wordt lokaal bewaard voor
        // offline navigatie (Golf 19: versiegebruik idempotent gemeld).
        void saveActiveNav(routeId, fetchedRoute);
      });
      return () => {
        alive = false;
      };
    }
  }, [fetchedRoute, routeId]);
  useEffect(() => {
    if (!isError || !Number.isInteger(routeId)) return;
    let alive = true;
    void loadActiveNav().then((nav) => {
      if (alive && nav && nav.routeId === routeId) setOfflineRoute(nav.route);
    });
    return () => {
      alive = false;
    };
  }, [isError, routeId]);
  const route = fetchedRoute ?? offlineRoute;
  const usingOfflineRoute = !fetchedRoute && !!offlineRoute;
  // Golf 28 — de locatiestream (en dus de systeemvraag) start pas nadat de
  // toegang al verleend is óf de renner de uitlegkaart bewust heeft doorlopen.
  const locConsent = useLocationConsent();
  const { location, permission, error: locError } = useLiveLocation(
    locConsent.ready,
  );
  // Navigatie is expliciet GEPAUZEERD zodra de locatietoestemming wegvalt of
  // de positie faalt: geen nieuwe cues of off-route-episodes op een bevroren
  // laatst bekende positie. Herstelt de toestemming, dan hervat alles vanzelf
  // (useLiveLocation herstart de stream automatisch). De rit-opname houdt
  // alle eerder vastgelegde punten gewoon vast.
  const navPaused = locConsent.ready && (permission === "denied" || !!locError);
  // Live Bluetooth sensors (wattage / hartslag / cadans) from the Fietsengarage.
  const sensors = useGarageSensors();
  const live = useLiveSensors();
  // Ref-backed reader so the recorder's 1s sampler always sees the CURRENT
  // sensor values without re-subscribing on every reading.
  const liveValuesRef = useRef(live.values);
  liveValuesRef.current = live.values;
  const getSensorValues = useCallback(() => liveValuesRef.current, []);
  const recorder = useRideRecorder(location, getSensorValues);
  // Val-alarm: alleen actief tijdens een lopende opname.
  const fall = useFallDetection(location, recorder.recording);
  const saveRide = useSaveRide();
  const [saved, setSaved] = useState<null | {
    sessionId: number | null;
    synced: boolean;
    syncError: string | null;
  }>(null);
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

  // ---------- Volgauto (Opdracht 3) ----------
  // Alleen wanneer de route-instelling "Deze route wordt gevolgd door een
  // volgauto" AAN staat, krijgt de gebruiker vóór de start een rolkeuze.
  // "Ik fiets" verandert NIETS aan de fietsnavigatie (alleen best-effort
  // positie delen); "Ik bestuur de volgauto" opent een eigen automodus met de
  // aparte autoroute. Best-effort: zonder netwerk geen rolkeuze, gewoon fietsen.
  // Volgauto is uitsluitend een wedstrijdvoorziening: het plan wordt alleen
  // opgehaald (en de rolkeuze dus alleen getoond) op routes die expliciet als
  // wedstrijd gemarkeerd zijn — óók als een oud plan op een gewone route nog
  // enabled in de database staat (historische data van vóór de grendel).
  // Bugmelding René 30-07-2026.
  const { data: volgautoPlan } = useVolgautoPlan(
    volgautoPlanRouteId(routeId, route?.usageType),
  );
  const [volgautoRole, setVolgautoRole] = useState<"renner" | "volgauto" | null>(
    null,
  );
  // Eerlijke indicator: herhaald mislukt positie-delen naar de volgauto.
  const volgautoFailRef = useRef(0);
  const [volgautoShareFailing, setVolgautoShareFailing] = useState(false);
  useEffect(() => {
    // Renner deelt (met plan aan) elke ~20s zijn positie zodat de volgauto
    // een GESCHATTE wachttijd kan tonen. Mislukken blokkeert navigatie nooit.
    if (!volgautoPlan?.enabled || volgautoRole !== "renner") return;
    if (!location || !Number.isInteger(routeId)) return;
    const send = () =>
      void postVolgautoPosition(routeId, {
        role: "renner",
        lat: location.latitude,
        lon: location.longitude,
        speedMps: location.speedMps ?? null,
      }).then((ok) => {
        // Eerlijk: blijft delen mislukken, meld dat — de volgauto ziet je dan niet.
        volgautoFailRef.current = ok ? 0 : volgautoFailRef.current + 1;
        setVolgautoShareFailing(volgautoFailRef.current >= 2);
      });
    send();
    const t = setInterval(send, 20_000);
    return () => clearInterval(t);
  }, [volgautoPlan?.enabled, volgautoRole, location, routeId]);

  // ---------- Vrienden live op de kaart (Opdracht 4) ----------
  // Delen staat standaard UIT (keuze "niemand"). De renner kiest per
  // navigatiesessie expliciet vrienden of een groepsrit; stoppen kan altijd
  // direct en de sessie eindigt vanzelf bij het verlaten van dit scherm.
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const shareSession = useLiveShareSession(true);
  const sharing = !!shareSession.data;
  const startShare = useStartLiveShare();
  const stopShare = useStopLiveShare();
  const shareableFriends = useShareableFriends(shareOpen);
  const groupOptions = useGroupRideOptions(shareOpen);
  const startedShareHereRef = useRef(false);
  const shareOnlineRef = useRef(true);
  const [friendDetail, setFriendDetail] = useState<FriendCluster | null>(null);

  // Eigen positie versturen — adaptief interval (stilstand/scherm/netwerk).
  // Bij netwerkverlies wordt niets verstuurd of in een wachtrij gezet.
  const locationRef = useRef(location);
  locationRef.current = location;
  // Echte apparaat-invoer voor het adaptieve interval: schermstatus via
  // AppState, batterijniveau via expo-battery (best-effort; onbekend = niet
  // "bijna leeg" aannemen).
  const screenOnRef = useRef(AppState.currentState === "active");
  const batteryLowRef = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      screenOnRef.current = state === "active";
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!sharing) return;
    let alive = true;
    const readBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (alive && typeof level === "number" && level >= 0) {
          batteryLowRef.current = level <= 0.2;
        }
      } catch {
        // Onbekend batterijniveau: eerlijk niets aannemen.
      }
    };
    void readBattery();
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (typeof batteryLevel === "number" && batteryLevel >= 0) {
        batteryLowRef.current = batteryLevel <= 0.2;
      }
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [sharing]);
  useEffect(() => {
    if (!sharing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      const loc = locationRef.current;
      const interval = decideUpdateIntervalMs({
        speedMps: loc?.speedMps ?? null,
        screenOn: screenOnRef.current,
        batteryLow: batteryLowRef.current,
        online: shareOnlineRef.current,
      });
      if (loc && interval != null) {
        const ok = await postLivePosition({
          lat: loc.latitude,
          lon: loc.longitude,
          speedMps: loc.speedMps ?? null,
          headingDeg: loc.heading ?? null,
        });
        shareOnlineRef.current = ok;
      } else if (!shareOnlineRef.current) {
        // Voorzichtige herverbindingspoging zonder oude posities te sturen.
        shareOnlineRef.current = true;
      }
      timer = setTimeout(tick, interval ?? 30_000);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sharing]);

  // Auto-stop: scherm verlaten = delen stoppen (best-effort; de server laat
  // een stille sessie ook zelf verlopen).
  useEffect(() => {
    return () => {
      if (startedShareHereRef.current) void stopLiveShareNow();
    };
  }, []);

  // Vriendposities die IK mag zien; veroudering wordt lokaal eerlijk
  // doorgerekend wanneer de laatste poll ouder wordt.
  const friendPositions = useFriendLivePositions(true);
  const friendClusters = useMemo(() => {
    const raw = friendPositions.data ?? [];
    const msSinceFetch = friendPositions.dataUpdatedAt
      ? Date.now() - friendPositions.dataUpdatedAt
      : 0;
    return clusterFriendMarkers(ageFriendsLocally(raw, msSinceFetch));
  }, [friendPositions.data, friendPositions.dataUpdatedAt]);

  // Responsive lay-out: schermmaten + systeem-fontschaal voor de databalk
  // en de kaart/klimkaart-verdeling (geen vaste toestelhoogtes).
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();

  const path: LatLon[] = useMemo(
    () => (route?.geometry ?? []).map(toLatLon),
    [route?.geometry],
  );
  const cumKm = useMemo(() => cumulativeKm(path), [path]);

  // Map-matching: kaart, voortgang én afwijkingsdetectie gebruiken dezelfde
  // gematchte positie op hetzelfde routeSEGMENT (niet losse routepunten).
  const matchPath: MatchLatLon[] = useMemo(
    () => path.map((p) => ({ lat: p.latitude, lon: p.longitude })),
    [path],
  );
  const matchHintRef = useRef<number | null>(null);
  const match = useMemo(() => {
    if (!location || matchPath.length === 0) return null;
    return matchToRoute(
      matchPath,
      cumKm,
      { lat: location.latitude, lon: location.longitude },
      matchHintRef.current,
    );
  }, [location, matchPath, cumKm]);
  // Hint pas ná de commit bijwerken (geen ref-mutatie tijdens render).
  useEffect(() => {
    matchHintRef.current = match ? match.segIndex : null;
  }, [match]);

  // Afwijkingsdetectie met dynamische corridor (GPS-nauwkeurigheid +
  // snelheid), hysterese, meerdere opeenvolgende metingen, minimale duur,
  // GPS-sprongfilter en episode-onderdrukking. Eén meting is nooit genoeg;
  // terug op de route herstelt automatisch.
  const offRouteRef = useRef(createOffRouteState());
  const [offRouteActive, setOffRouteActive] = useState(false);
  const [offEpisode, setOffEpisode] = useState(0);
  // Keuzekaart-status: "negeren" sluit de kaart voor deze episode; hij komt
  // alleen terug bij een RELEVANT gegroeide afwijking of een nieuwe episode.
  const [offPrompt, setOffPrompt] = useState(createOffRoutePromptState);
  // Herberekenlus-beveiliging: nieuw rejoin-verzoek pas na afkoeltijd/verplaatsing.
  const rejoinMarkRef = useRef<RejoinRequestMark | null>(null);
  useEffect(() => {
    // Gepauzeerd (toestemming weg): geen nieuwe off-route-episodes op een
    // bevroren laatst bekende positie.
    if (navPaused) return;
    if (!location || !match) return;
    const upd = updateOffRoute(offRouteRef.current, {
      lat: location.latitude,
      lon: location.longitude,
      timestampMs: Date.now(),
      distanceM: match.distanceM,
      alongKm: match.alongKm,
      accuracyM: location.accuracyM,
      speedMps: location.speedMps,
    });
    offRouteRef.current = upd.state;
    if (upd.state.active !== offRouteActive) setOffRouteActive(upd.state.active);
    if (upd.state.episode !== offEpisode) setOffEpisode(upd.state.episode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, match, navPaused]);

  // Zelfde positiebron voor de kaart als voor voortgang/afwijking: op de
  // route gematcht zolang we binnen de corridor zitten, anders eerlijk de
  // ruwe GPS-positie.
  const displayLocation = useMemo(() => {
    if (!location) return location;
    const shown = displayPosition(
      { lat: location.latitude, lon: location.longitude },
      match,
      offRouteActive,
      corridorMeters(location.accuracyM, location.speedMps),
    );
    return { ...location, latitude: shown.lat, longitude: shown.lon };
  }, [location, match, offRouteActive]);

  // Derive progress + next turn from the map-matched position along the path.
  const progress = useMemo(() => {
    if (!match) return null;
    const traveledKm = match.alongKm;
    const totalKm = cumKm[cumKm.length - 1] ?? 0;
    const remainingKm = Math.max(0, totalKm - traveledKm);
    return {
      traveledKm,
      remainingKm,
      offRoute: offRouteActive,
      offBy: match.distanceM,
    };
  }, [match, cumKm, offRouteActive]);

  // ---------- Wedstrijdmodus ----------
  // Alleen actief bij usageType "wedstrijd" met een gekoppelde geplande
  // wedstrijd. De payload bevat UITSLUITEND door de renner bevestigde of
  // aangepaste punten — onbevestigde AI-voorstellen sturen de rit nooit.
  const race = route?.usageType === "wedstrijd" ? route.race ?? null : null;
  const [raceState, setRaceState] = useState(createRaceModeState);
  useEffect(() => {
    if (!race || !progress) return;
    const totalKm = cumKm[cumKm.length - 1] ?? 0;
    setRaceState((s) => {
      const r = updateRaceMode(s, {
        traveledKm: progress.traveledKm,
        totalKm,
        localLaps: race.localLaps ?? 1,
      });
      return r.state === s ? s : r.state;
    });
  }, [race, progress, cumKm]);
  // Finishcue-gate: bij lokale ronden pas in de laatste ronde.
  const finishAllowed = !race || finishCueAllowed(raceState, race.localLaps);

  // Waypoints zijn géén finish: de server schoont tussen-"Aankomst"-stappen al
  // op, maar oudere lokaal bewaarde kopieën lopen hier nogmaals door dezelfde
  // sanitizer zodat er nooit een finishvlag/-melding halverwege verschijnt.
  const navStepsAll: RouteStep[] = useMemo(
    () => (route?.nav ? sanitizeNavSteps(route.nav) : []),
    [route?.nav],
  );
  // Buiten de laatste ronde valt de "Aankomst"-slotstap weg zodat kaart,
  // HUD én audio geen finish laten zien op een doorkomst.
  const navSteps: RouteStep[] = useMemo(() => {
    if (finishAllowed) return navStepsAll;
    const last = navStepsAll[navStepsAll.length - 1];
    const lastIsArrive =
      !!last && /arrive|finish|aankomst/.test((last.dir || "").toLowerCase());
    return lastIsArrive ? navStepsAll.slice(0, -1) : navStepsAll;
  }, [navStepsAll, finishAllowed]);

  // Eerstvolgend wedstrijdpunt vóór de renner (sprint/bergprijs/laatste km…).
  const upcomingRacePoint = useMemo(() => {
    if (!race || !progress) return null;
    return nextRacePoint(race.points, progress.traveledKm, { finishAllowed });
  }, [race, progress, finishAllowed]);

  const nextStep: RouteStep | null = useMemo(() => {
    if (navSteps.length === 0 || !progress) return null;
    const ahead = navSteps.find((s) => s.km > progress.traveledKm + 0.015);
    return ahead ?? navSteps[navSteps.length - 1] ?? null;
  }, [navSteps, progress]);

  // ---------- Geluidssignalen + gesproken aanwijzingen ----------
  // Instellingen (persistent, zelfde bron als de webpagina Navigatie-
  // instellingen) + pure cue-engine; audio is best-effort en respecteert de
  // stilstand/het volume van de telefoon.
  const audioPrefs = useNavAudioPrefs();
  const cueStateRef = useRef<CueEngineState>(createCueState());
  const audioOn = audioPrefs.prefs.soundCues || audioPrefs.prefs.voiceCues;
  useEffect(() => {
    if (audioOn && Platform.OS !== "web") void prepareNavAudio();
    return () => {
      releaseNavAudio();
    };
  }, [audioOn]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    // Gepauzeerd (toestemming weg): geen nieuwe geluids-/spraakcues op een
    // bevroren positie.
    if (navPaused) return;
    if (!progress || navSteps.length === 0) return;
    if (!audioPrefs.prefs.soundCues && !audioPrefs.prefs.voiceCues) return;
    const { state, cues } = decideCues(cueStateRef.current, {
      steps: navSteps,
      traveledKm: progress.traveledKm,
      speedMps: location?.speedMps ?? null,
      offRoute: progress.offRoute,
    });
    cueStateRef.current = state;
    for (const cue of cues) {
      if (audioPrefs.prefs.soundCues) playCueSound(cue.sound);
      if (audioPrefs.prefs.voiceCues && cue.speech) speakCue(cue.speech);
    }
  }, [progress, navSteps, location?.speedMps, audioPrefs.prefs, navPaused]);

  // ---------- Herberekenen na afwijken (echte gerouteerde verbinding) ----------
  // Bij "van de route" kan de renner kiezen: terug naar de lijn of logisch
  // verder. Het verbindingsstuk komt ALTIJD van de routedienst (nooit een
  // rechte lijn) en verdwijnt vanzelf zodra de renner de lijn weer raakt.
  const rejoin = useRejoinRoute(Number.isInteger(routeId) ? routeId : null);
  const [detour, setDetour] = useState<RejoinResult | null>(null);
  const detourPath: LatLon[] = useMemo(
    () => (detour?.path ?? []).map(toLatLon),
    [detour?.path],
  );
  useEffect(() => {
    // Terug op de routelijn → verbindingsstuk opruimen.
    if (detour && progress && !progress.offRoute) setDetour(null);
  }, [detour, progress]);
  const detourNext = useMemo(() => {
    if (!detour || !location || detourPath.length === 0) return null;
    const { index } = nearestPointIndex(detourPath, location);
    const cum = cumulativeKm(detourPath);
    const traveled = cum[index] ?? 0;
    const step =
      detour.nav.find((s) => s.km > traveled + 0.015) ??
      detour.nav[detour.nav.length - 1] ??
      null;
    return step
      ? { step, distanceM: Math.max(0, (step.km - traveled) * 1000) }
      : null;
  }, [detour, location, detourPath]);
  const requestRejoin = useCallback(
    (mode: "terug" | "verder" | "bestemming") => {
      // Gepauzeerd (toestemming weg): geen nieuwe herberekeningen op een
      // bevroren laatst bekende positie.
      if (navPaused) return;
      if (!location || rejoin.isPending) return;
      const pos = { lat: location.latitude, lon: location.longitude };
      // Nooit een herberekenlus: een nieuw verzoek pas na afkoeltijd of
      // echte verplaatsing sinds het vorige verzoek.
      if (!allowNewRejoinRequest(rejoinMarkRef.current, Date.now(), pos)) return;
      rejoinMarkRef.current = { atMs: Date.now(), ...pos };
      rejoin.mutate(
        { ...pos, mode },
        { onSuccess: (result) => setDetour(result) },
      );
    },
    [location, rejoin, navPaused],
  );

  // Keuzekaart tonen? Puur en herhaalvrij: nieuwe episode → één kaart;
  // "negeren" houdt hem dicht tot de afwijking relevant groeit.
  const showOffRouteCard =
    offRouteActive &&
    shouldShowOffRoutePrompt(offPrompt, {
      active: offRouteActive,
      episode: offEpisode,
      distanceM: match?.distanceM ?? 0,
      hasDetour: !!detour,
    });
  const dismissOffRouteCard = useCallback(() => {
    setOffPrompt((s) => registerDismiss(s, offEpisode, match?.distanceM ?? 0));
  }, [offEpisode, match?.distanceM]);

  const distanceToTurn =
    nextStep && progress
      ? Math.max(0, (nextStep.km - progress.traveledKm) * 1000)
      : null;

  // ---------- Klimkaart (alleen uit ECHTE routeklimdata; anders afwezig) ----------
  const climbWindows = useMemo(
    () => buildClimbWindows(route?.climbs ?? null),
    [route?.climbs],
  );
  const climbPhase: ClimbPhase | null = useMemo(
    () => (progress ? climbPhaseAt(climbWindows, progress.traveledKm) : null),
    [climbWindows, progress],
  );
  const climbSlice = useMemo(
    () =>
      climbPhase
        ? climbProfileSlice(
            route?.profile ?? null,
            route?.distanceKm ?? null,
            climbPhase.climb,
          )
        : null,
    [climbPhase, route?.profile, route?.distanceKm],
  );
  // De klimkaart meet zijn eigen hoogte; de lay-outkern begrenst die en
  // bepaalt hoeveel ruimte de kaart overhoudt (nooit overlap, herstel bij sluiten).
  const [climbPanelMeasuredH, setClimbPanelMeasuredH] = useState(0);
  const navLayout = computeNavLayout({
    screenWidth,
    screenHeight,
    topInset: insets.top,
    bottomInset: insets.bottom,
    climbPanelHeight: climbPhase ? climbPanelMeasuredH : null,
  });
  // Beschikbare breedte per metric in de databalk (3 naast elkaar).
  const metricW = metricContainerWidthPx(screenWidth - 32, 3);

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

  // ---------- Fail-closed weigering (taak #505) ----------
  // De backend weigerde de navigatiestart bewust (409): route hard
  // geblokkeerd of niet controleerbaar. Eerlijke melding, geen navigatie.
  if (navRefusal) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.background, padding: 32 }]}>
        <Ionicons name="alert-circle-outline" size={40} color={c.mutedForeground} />
        <Text style={[styles.stateTitle, { color: c.foreground }]}>
          {navRefusal.code === "ROUTE_BLOCKED"
            ? "Route geblokkeerd"
            : "Route niet gecontroleerd"}
        </Text>
        <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
          {navRefusal.message}
        </Text>
        <Pressable onPress={goBack} style={[styles.backPill, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>Terug</Text>
        </Pressable>
      </View>
    );
  }

  // ---------- Volgauto-rolkeuze / automodus ----------
  // Alleen wanneer de instelling aan staat. "Ik fiets" laat de fietsnavigatie
  // volledig ongewijzigd; de automodus is een eigen scherm met de aparte
  // autoroute. Grote knoppen (veiligheid) + verplichte disclaimer.
  if (volgautoRolkeuzeZichtbaar(volgautoPlan, volgautoRole)) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.background, padding: 24 }]}>
        <Ionicons name="car-sport-outline" size={44} color={c.primary} />
        <Text style={[styles.stateTitle, { color: c.foreground, fontSize: 22 }]}>
          Wie ben jij op deze rit?
        </Text>
        <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
          Deze route wordt gevolgd door een volgauto.
        </Text>
        <Pressable
          onPress={() => setVolgautoRole("renner")}
          style={[styles.rolePick, { backgroundColor: c.primary }]}
        >
          <Ionicons name="bicycle" size={26} color="#0b0f16" />
          <Text style={styles.rolePickText}>Ik fiets</Text>
        </Pressable>
        <Pressable
          onPress={() => setVolgautoRole("volgauto")}
          style={[styles.rolePick, { backgroundColor: "#f59e0b" }]}
        >
          <Ionicons name="car" size={26} color="#0b0f16" />
          <Text style={styles.rolePickText}>Ik bestuur de volgauto</Text>
        </Pressable>
        <Text style={[styles.stateBody, { color: c.mutedForeground, fontSize: 12 }]}>
          {volgautoPlan?.disclaimer}
        </Text>
      </View>
    );
  }
  if (volgautoPlan?.enabled && volgautoRole === "volgauto") {
    return (
      <VolgautoDriverMode
        routeId={routeId}
        plan={volgautoPlan}
        location={location}
        onExit={goBack}
      />
    );
  }

  const hasGeometry = path.length >= 2;
  const hasNav = !!route.nav && route.nav.length > 0;
  const showMap = Platform.OS !== "web" && hasMapbox && hasGeometry;

  return (
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      {/* ---------- Map ---------- */}
      {showMap ? (
        // De kaartcontainer eindigt boven de klimkaart (nooit overlap);
        // zonder klimkaart krijgt de kaart de volledige ruimte terug. De
        // camerastand (zoom/rotatie/positie) blijft daarbij ongemoeid.
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: navLayout.mapHeight,
            overflow: "hidden",
          }}
        >
          <RouteMap
            path={path}
            detourPath={detourPath.length >= 2 ? detourPath : undefined}
            location={displayLocation}
            following={following}
            onUserPan={() => setFollowing(false)}
            primary={c.primary}
            background={c.background}
            friendClusters={friendClusters}
            onFriendPress={(cl) => setFriendDetail(cl)}
          />
        </View>
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
            detour && detourNext ? (
              <View style={[styles.instruction, { backgroundColor: HUD_BG, borderColor: "#facc15" }]}>
                <View style={[styles.dirCircleBig, { backgroundColor: "#facc15" }]}>
                  <Ionicons
                    name={describeDir(detourNext.step.dir).icon}
                    size={36}
                    color="#04070e"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.instrTop}>
                    <Text style={[styles.instrLabelBig, { color: HUD_TEXT }]}>
                      {describeDir(detourNext.step.dir).label}
                    </Text>
                    <Text style={[styles.instrDistBig, { color: "#facc15" }]}>
                      {fmtMeters(detourNext.distanceM)}
                    </Text>
                  </View>
                  <Text style={[styles.instrNote, { color: HUD_MUTED }]} numberOfLines={2}>
                    {detour.mode === "terug"
                      ? "Nieuw stuk terug naar je route."
                      : "Nieuw stuk — je pikt de route verderop weer op."}
                  </Text>
                </View>
              </View>
            ) : showOffRouteCard ? (
              <View style={[styles.instruction, { backgroundColor: c.card, borderColor: c.destructive }]}>
                <Ionicons name="warning-outline" size={26} color={c.destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.instrLabel, { color: c.destructive }]}>
                    Je bent van de route afgeweken.
                  </Text>
                  <Text style={[styles.instrNote, { color: c.mutedForeground }]} numberOfLines={2}>
                    {rejoin.isPending
                      ? "Nieuw stuk wordt berekend…"
                      : rejoin.isError
                        ? (rejoin.error as Error)?.message ??
                          "Kon geen vervolg berekenen. Keer terug naar de lijn."
                        : `Je bent ${fmtMeters(progress.offBy)} van de route.`}
                  </Text>
                  {!rejoin.isPending && (
                    <View style={styles.rejoinCol}>
                      {offRouteOptions(!!race).map((opt) => (
                        <Pressable
                          key={opt.id}
                          onPress={() =>
                            opt.id === "negeren"
                              ? dismissOffRouteCard()
                              : requestRejoin(opt.id)
                          }
                          disabled={opt.id !== "negeren" && !location}
                          style={[
                            styles.rejoinBtn,
                            opt.primary
                              ? { backgroundColor: c.primary }
                              : { borderWidth: 1, borderColor: c.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.rejoinBtnText,
                              { color: opt.primary ? c.primaryForeground : c.foreground },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={[styles.rejoinBtnDetail, { color: opt.primary ? c.primaryForeground : c.mutedForeground }]}
                            numberOfLines={2}
                          >
                            {opt.detail}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              // Genegeerd: kaart blijft dicht (geen spam), wel een eerlijke
              // compacte statusregel zolang de afwijking voortduurt.
              <View style={[styles.instruction, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="warning-outline" size={20} color={c.mutedForeground} />
                <Text style={[styles.instrNote, { color: c.mutedForeground, flex: 1 }]}>
                  Van de route ({fmtMeters(progress.offBy)}) — je koos negeren; je originele route blijft actief.
                </Text>
              </View>
            )
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

        {usingOfflineRoute && (
          <View style={[styles.signalPill, { backgroundColor: HUD_BG, borderColor: c.border }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={HUD_MUTED} />
            <Text style={[styles.signalText, { color: HUD_TEXT }]}>
              Geen verbinding — je navigeert op de bewaarde route.
            </Text>
          </View>
        )}

        {/* ---------- Wedstrijdmodus-HUD ---------- */}
        {race && (
          <View style={[styles.signalPill, { backgroundColor: HUD_BG, borderColor: c.primary }]}>
            <Ionicons name="flag-outline" size={16} color={c.primary} />
            <Text style={[styles.signalText, { color: HUD_TEXT }]}>
              Wedstrijdmodus · {race.name}
              {race.localLaps != null && race.localLaps > 1
                ? ` · ronde ${raceState.lap}/${race.localLaps}`
                : ""}
            </Text>
          </View>
        )}
        {race?.assignment ? (
          <View style={[styles.signalPill, { backgroundColor: HUD_BG, borderColor: c.border }]}>
            <Ionicons name="clipboard-outline" size={16} color={HUD_MUTED} />
            <Text style={[styles.signalText, { color: HUD_TEXT }]} numberOfLines={2}>
              Opdracht: {race.assignment}
            </Text>
          </View>
        ) : null}
        {upcomingRacePoint && !progress?.offRoute && (
          <View style={[styles.signalPill, { backgroundColor: HUD_BG, borderColor: "#facc15" }]}>
            <Ionicons
              name={upcomingRacePoint.point.kind === "finish" ? "flag" : "locate-outline"}
              size={16}
              color="#facc15"
            />
            <Text style={[styles.signalText, { color: HUD_TEXT }]} numberOfLines={2}>
              Nog {fmtMeters(upcomingRacePoint.distanceM)} tot{" "}
              {upcomingRacePoint.point.label}
            </Text>
          </View>
        )}

        {/* In wedstrijdmodus onderdrukken we niet-koersrelevante meldingen
            (verkeerslichten/POI's) — het parcours is leidend. */}
        {!race && nextSignal && !progress?.offRoute && (
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

        {/* Geluidssignalen + gesproken aanwijzingen: direct toepasbaar én
            persistent (zelfde instelling als Navigatie-instellingen op web). */}
        <View style={styles.audioToggles} pointerEvents="box-none">
          <Pressable
            onPress={() => audioPrefs.setSoundCues(!audioPrefs.prefs.soundCues)}
            hitSlop={10}
            accessibilityLabel={
              audioPrefs.prefs.soundCues
                ? "Geluidssignalen uitzetten"
                : "Geluidssignalen aanzetten"
            }
            style={[
              styles.backBtn,
              {
                backgroundColor: c.card,
                borderColor: audioPrefs.prefs.soundCues ? c.primary : c.border,
              },
            ]}
          >
            <Ionicons
              name={audioPrefs.prefs.soundCues ? "volume-high" : "volume-mute"}
              size={20}
              color={audioPrefs.prefs.soundCues ? c.primary : c.mutedForeground}
            />
          </Pressable>
          <Pressable
            onPress={() => audioPrefs.setVoiceCues(!audioPrefs.prefs.voiceCues)}
            hitSlop={10}
            accessibilityLabel={
              audioPrefs.prefs.voiceCues
                ? "Gesproken aanwijzingen uitzetten"
                : "Gesproken aanwijzingen aanzetten"
            }
            style={[
              styles.backBtn,
              {
                backgroundColor: c.card,
                borderColor: audioPrefs.prefs.voiceCues ? c.primary : c.border,
              },
            ]}
          >
            <Ionicons
              name={audioPrefs.prefs.voiceCues ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
              size={20}
              color={audioPrefs.prefs.voiceCues ? c.primary : c.mutedForeground}
            />
          </Pressable>
        </View>
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

      {/* ---------- Navigatie gepauzeerd: locatietoestemming weg ---------- */}
      {navPaused && (
        <View style={[styles.locNotice, { top: insets.top + (hasNav ? 118 : 90), backgroundColor: c.card, borderColor: c.destructive, flexDirection: "column", alignItems: "stretch", gap: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="pause-circle-outline" size={20} color={c.destructive} />
            <Text style={[styles.locNoticeText, { color: c.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Navigatie gepauzeerd
            </Text>
          </View>
          <Text style={[styles.locNoticeText, { color: c.mutedForeground }]}>
            {locError ?? "Geen toegang tot je locatie."} Aanwijzingen en
            route-bewaking staan stil; je eerder opgenomen rit blijft bewaard.
            Zodra de locatie terug is, gaat de navigatie vanzelf verder.
          </Text>
          {permission === "denied" && (
            <Pressable
              onPress={() => void openAppInstellingen()}
              style={[styles.locNoticeBtn, { borderColor: c.border }]}
            >
              <Ionicons name="settings-outline" size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                Locatie weer toestaan
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ---------- Volgauto-delen hapert: eerlijk melden, nooit stil ---------- */}
      {volgautoShareFailing && volgautoRole === "renner" && (
        <View style={[styles.locNotice, { top: insets.top + (hasNav ? 168 : 140), backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="car-outline" size={18} color={c.mutedForeground} />
          <Text style={[styles.locNoticeText, { color: c.mutedForeground }]}>
            Positie delen met de volgauto hapert — geen verbinding. De volgauto
            ziet je nu mogelijk niet.
          </Text>
        </View>
      )}

      {/* ---------- Klimkaart: onderaan, kaart krimpt erboven (geen overlap) ---------- */}
      {showMap && climbPhase && (
        <View
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h !== climbPanelMeasuredH) setClimbPanelMeasuredH(h);
          }}
          style={[
            styles.climbPanel,
            {
              bottom: insets.bottom,
              maxHeight: navLayout.climbPanelMaxHeight,
              backgroundColor: HUD_BG,
              borderColor: c.primary,
            },
          ]}
        >
          <View style={styles.climbHead}>
            <Ionicons name="trending-up" size={18} color={c.primary} />
            <Text style={[styles.climbTitle, { color: HUD_TEXT }]} numberOfLines={1}>
              {climbPhase.climb.name}
            </Text>
            <Text style={[styles.climbMeta, { color: HUD_MUTED }]}>
              {climbPhase.climb.lengthKm.toFixed(1)} km ·{" "}
              {climbPhase.climb.avgGradePct ? `${climbPhase.climb.avgGradePct.toFixed(1)}%` : "—"}
            </Text>
          </View>
          <Text style={[styles.climbPhaseText, { color: HUD_TEXT }]}>
            {climbPhase.phase === "komt"
              ? `Klim over ${fmtMeters(climbPhase.inM)}`
              : climbPhase.phase === "op"
                ? `Nog ${fmtMeters(climbPhase.toTopM)} tot de top`
                : climbPhase.phase === "top"
                  ? "Bijna boven!"
                  : "Top gepasseerd — goed gedaan."}
          </Text>
          {climbSlice ? (
            <View style={styles.climbProfileRow}>
              {(() => {
                const min = Math.min(...climbSlice);
                const span = Math.max(1, Math.max(...climbSlice) - min);
                const doneFrac =
                  climbPhase.phase === "op" || climbPhase.phase === "top"
                    ? climbPhase.fracDone
                    : climbPhase.phase === "einde"
                      ? 1
                      : 0;
                return climbSlice.map((ele, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      alignSelf: "flex-end",
                      height: 8 + ((ele - min) / span) * 40,
                      backgroundColor:
                        i / (climbSlice.length - 1) <= doneFrac
                          ? c.primary
                          : "rgba(255,255,255,0.28)",
                      marginHorizontal: 1,
                      borderTopLeftRadius: 2,
                      borderTopRightRadius: 2,
                    }}
                  />
                ));
              })()}
            </View>
          ) : (
            <Text style={[styles.climbMeta, { color: HUD_MUTED }]}>
              Geen hoogteprofiel voor deze route beschikbaar.
            </Text>
          )}
        </View>
      )}

      {/* ---------- Bottom: progress + recenter ---------- */}
      {Platform.OS !== "web" && hasMapbox && hasGeometry && (
        <View
          style={[
            styles.bottom,
            { bottom: insets.bottom + 16 + navLayout.climbPanelHeight },
          ]}
          pointerEvents="box-none"
        >
          {/* Live delen: zichtbare status + snelle toegang. Standaard UIT. */}
          <Pressable
            onPress={() => setShareOpen(true)}
            style={[
              styles.sharePill,
              {
                backgroundColor: sharing ? c.primary : c.card,
                borderColor: sharing ? c.primary : c.border,
              },
            ]}
          >
            <Ionicons
              name={sharing ? "radio-outline" : "people-outline"}
              size={16}
              color={sharing ? c.primaryForeground : c.mutedForeground}
            />
            <Text
              style={{
                color: sharing ? c.primaryForeground : c.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
              }}
            >
              {sharing
                ? shareSession.data?.audience === "groep"
                  ? "Live delen: groepsrit"
                  : `Live delen: ${shareSession.data?.viewerCount ?? 0} ${
                      (shareSession.data?.viewerCount ?? 0) === 1
                        ? "vriend"
                        : "vrienden"
                    }`
                : "Locatie delen: uit"}
            </Text>
          </Pressable>
          {!following && (
            <Pressable
              onPress={() => setFollowing(true)}
              style={[styles.recenter, { backgroundColor: c.primary }]}
            >
              <Ionicons name="locate" size={20} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
                Terug naar mijn positie
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
              widthPx={metricW}
              fontScale={fontScale}
              c={c}
            />
            <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
            <Metric
              label="Resterend"
              value={progress ? progress.remainingKm.toFixed(1) : "—"}
              unit="km"
              widthPx={metricW}
              fontScale={fontScale}
              c={c}
            />
            <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
            <Metric
              label="Totaal"
              value={route.distanceKm != null ? route.distanceKm.toFixed(1) : "—"}
              unit="km"
              widthPx={metricW}
              fontScale={fontScale}
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
                widthPx={metricW}
                fontScale={fontScale}
                c={c}
              />
              <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
              <Metric
                label="Hartslag"
                value={
                  live.values.heartRate != null ? `${live.values.heartRate}` : "—"
                }
                unit="spm"
                widthPx={metricW}
                fontScale={fontScale}
                c={c}
              />
              <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
              <Metric
                label="Cadans"
                value={live.values.cadence != null ? `${live.values.cadence}` : "—"}
                unit="rpm"
                widthPx={metricW}
                fontScale={fontScale}
                c={c}
              />
            </View>
          )}
        </View>
      )}

      {/* ---------- Machtigingenuitleg (Golf 28): navigeren kan pas met
           locatie; de uitleg staat er VÓÓR de systeemvraag. ---------- */}
      {locConsent.checked && !locConsent.ready && !locError && (
        <View style={[styles.permissionWrap, { bottom: insets.bottom + 96 }]}>
          <PermissionExplainer
            c={c}
            permission="locatie"
            extraKeys={["achtergrondlocatie"]}
            showBatterijHint
            onContinue={locConsent.consent}
            onDismiss={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          />
        </View>
      )}

      {/* ---------- Ride recording ---------- */}
      <RideRecorderBar
        c={c}
        insets={insets}
        recorder={recorder}
        location={location}
        permissionDenied={permission === "denied" || !!locError}
        locationGranted={locConsent.ready}
        saving={saveRide.isPending}
        saveError={saveRide.error ? String((saveRide.error as Error).message) : null}
        saved={saved}
        onStart={() => {
          locConsent.consent();
          setSaved(null);
          saveRide.reset();
          recorder.start();
        }}
        onStop={async () => {
          recorder.stop();
          // Rit gestopt = live delen stopt automatisch (geen naloop).
          if (startedShareHereRef.current) {
            startedShareHereRef.current = false;
            void stopLiveShareNow();
          }
          try {
            const res = await saveRide.mutateAsync({
              points: recorder.points,
              name: route.name,
              // Real Bluetooth readings logged this ride — written into the
              // GPX so the saved training carries measured watts/hartslag/cadans.
              sensorSamples: recorder.getSensorSamples(),
            });
            // Ook zonder netwerk is de rit nu veilig: hij staat in de lokale
            // uploadwachtrij en gaat automatisch alsnog omhoog. Het lokale
            // opnamespoor mag dus pas HIER worden opgeruimd.
            setSaved({
              sessionId: res.sessionId,
              synced: res.synced,
              syncError: res.syncError,
            });
            recorder.reset();
            // Rit afgerond → deze navigatie is niet meer "actief" voor hervatten.
            void clearActiveNav();
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
            setSaved({
              sessionId: res.sessionId,
              synced: res.synced,
              syncError: res.syncError,
            });
            setRecoveredReview(null);
            recorder.reset();
            void clearActiveNav();
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

      {/* ---------- Live delen: keuzepaneel ---------- */}
      {shareOpen && (
        <View style={styles.shareBackdrop}>
          <View style={[styles.shareSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.shareHead}>
              <Text style={[styles.shareTitle, { color: c.foreground }]}>
                Locatie delen tijdens deze rit
              </Text>
              <Pressable onPress={() => setShareOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[styles.shareNote, { color: c.mutedForeground }]}>
              Standaard uit. Alleen tijdens deze rit, alleen voor wie jij kiest.
              Er wordt geen locatiegeschiedenis bewaard — bij stoppen verdwijnt je positie direct.
            </Text>

            {sharing ? (
              <>
                <Text style={[styles.shareNote, { color: c.foreground }]}>
                  {shareSession.data?.audience === "groep"
                    ? "Je deelt nu met je groepsrit."
                    : `Je deelt nu met ${shareSession.data?.viewerCount ?? 0} ${
                        (shareSession.data?.viewerCount ?? 0) === 1 ? "vriend" : "vrienden"
                      }.`}
                </Text>
                <Pressable
                  onPress={() => {
                    startedShareHereRef.current = false;
                    stopShare.mutate();
                    setShareOpen(false);
                  }}
                  style={[styles.shareAction, { backgroundColor: c.destructive }]}
                >
                  <Ionicons name="stop-circle-outline" size={18} color="#fff" />
                  <Text style={styles.shareActionText}>Stop met delen</Text>
                </Pressable>
              </>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                <Text style={[styles.shareSection, { color: c.mutedForeground }]}>
                  Geselecteerde vrienden
                </Text>
                {shareableFriends.isLoading ? (
                  <ActivityIndicator color={c.primary} />
                ) : (shareableFriends.data ?? []).length === 0 ? (
                  <Text style={[styles.shareNote, { color: c.mutedForeground }]}>
                    Je hebt nog geen geaccepteerde vrienden om mee te delen.
                  </Text>
                ) : (
                  (shareableFriends.data ?? []).map((f) => {
                    const on = selectedFriends.has(f.clerkId);
                    return (
                      <Pressable
                        key={f.clerkId}
                        onPress={() =>
                          setSelectedFriends((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.clerkId)) next.delete(f.clerkId);
                            else next.add(f.clerkId);
                            return next;
                          })
                        }
                        style={[styles.shareRow, { borderColor: c.border }]}
                      >
                        <Ionicons
                          name={on ? "checkbox" : "square-outline"}
                          size={20}
                          color={on ? c.primary : c.mutedForeground}
                        />
                        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", flex: 1 }}>
                          {f.name || "Onbekend"}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
                {selectedFriends.size > 0 && (
                  <Pressable
                    disabled={startShare.isPending}
                    onPress={() =>
                      startShare.mutate(
                        { audience: "vrienden", friendClerkIds: [...selectedFriends] },
                        {
                          onSuccess: () => {
                            startedShareHereRef.current = true;
                            setShareOpen(false);
                          },
                        },
                      )
                    }
                    style={[styles.shareAction, { backgroundColor: c.primary, opacity: startShare.isPending ? 0.6 : 1 }]}
                  >
                    <Ionicons name="radio-outline" size={18} color={c.primaryForeground} />
                    <Text style={[styles.shareActionText, { color: c.primaryForeground }]}>
                      Deel met {selectedFriends.size} {selectedFriends.size === 1 ? "vriend" : "vrienden"}
                    </Text>
                  </Pressable>
                )}

                <Text style={[styles.shareSection, { color: c.mutedForeground }]}>
                  Groepsrit van vandaag
                </Text>
                {groupOptions.isLoading ? (
                  <ActivityIndicator color={c.primary} />
                ) : (groupOptions.data ?? []).length === 0 ? (
                  <Text style={[styles.shareNote, { color: c.mutedForeground }]}>
                    Geen groepsrit gevonden waarvoor je vandaag bent aangemeld.
                  </Text>
                ) : (
                  (groupOptions.data ?? []).map((g) => (
                    <Pressable
                      key={g.clubTrainingId}
                      disabled={startShare.isPending}
                      onPress={() =>
                        startShare.mutate(
                          { audience: "groep", clubTrainingId: g.clubTrainingId },
                          {
                            onSuccess: () => {
                              startedShareHereRef.current = true;
                              setShareOpen(false);
                            },
                          },
                        )
                      }
                      style={[styles.shareRow, { borderColor: c.border }]}
                    >
                      <Ionicons name="people-circle-outline" size={20} color={c.primary} />
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", flex: 1 }}>
                        {g.title}
                        {g.startTime ? ` · ${g.startTime}` : ""}
                      </Text>
                    </Pressable>
                  ))
                )}
                {startShare.isError && (
                  <Text style={[styles.shareNote, { color: c.destructive }]}>
                    {(startShare.error as Error)?.message ?? "Delen starten lukte niet."}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* ---------- Vriend-detail (tik op marker) ---------- */}
      {friendDetail && (
        <View style={styles.shareBackdrop}>
          <View style={[styles.shareSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.shareHead}>
              <Text style={[styles.shareTitle, { color: c.foreground }]}>
                {friendDetail.members.length > 1
                  ? `${friendDetail.members.length} vrienden dicht bij elkaar`
                  : friendDetail.members[0]?.name ?? "Vriend"}
              </Text>
              <Pressable onPress={() => setFriendDetail(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.mutedForeground} />
              </Pressable>
            </View>
            {friendDetail.members.map((m) => (
              <View key={m.clerkId} style={[styles.shareRow, { borderColor: c.border }]}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", flex: 1 }}>
                  {m.name}
                </Text>
                <Text style={{ color: m.statusKind === "live" ? c.primary : c.mutedForeground, fontSize: 12 }}>
                  {m.status}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ---------- Val-alarm overlay ---------- */}
      {fall.alert && (
        <FallAlertCard
          c={c}
          alert={fall.alert}
          onOk={fall.dismiss}
          onSendNow={() => void fall.sendNow()}
          onClose={fall.close}
        />
      )}
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
  locationGranted,
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
  locationGranted: boolean;
  saving: boolean;
  saveError: string | null;
  saved: null | { sessionId: number | null; synced: boolean; syncError: string | null };
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

  // Golf 28 — uitlegkaart vóór de systeemvraag om locatietoegang.
  const [showPermissionUitleg, setShowPermissionUitleg] = useState(false);

  if (saved) {
    return (
      <View style={[styles.recWrap, { bottom }]} pointerEvents="box-none">
        <View style={[styles.recCard, { backgroundColor: c.card, borderColor: c.primary }]}>
          <Ionicons
            name={saved.synced ? "checkmark-circle" : "cloud-offline-outline"}
            size={22}
            color={c.primary}
          />
          <Text style={[styles.recSavedText, { color: c.foreground }]}>
            {saved.synced
              ? saved.sessionId != null
                ? "Rit opgeslagen in je trainingen."
                : "Rit opgeslagen."
              : "Rit veilig bewaard op je telefoon. Uploaden lukt nu niet en wordt automatisch opnieuw geprobeerd."}
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
        <PermissionDeniedNotice
          c={c}
          permission="locatie"
          message="Zonder locatietoegang kan je rit niet worden vastgelegd."
        />
      ) : showPermissionUitleg ? (
        <PermissionExplainer
          c={c}
          permission="locatie"
          extraKeys={["achtergrondlocatie"]}
          showBatterijHint
          onContinue={() => {
            setShowPermissionUitleg(false);
            onStart();
          }}
          onDismiss={() => setShowPermissionUitleg(false)}
        />
      ) : (
        <Pressable
          onPress={() => {
            // Golf 28 — uitleg vóór de systeemvraag zolang locatie nog niet is
            // toegekend; bij al toegekende toegang start de rit direct.
            if (Platform.OS !== "web" && !locationGranted) {
              setShowPermissionUitleg(true);
              return;
            }
            onStart();
          }}
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
  widthPx,
  fontScale,
  c,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
  /** Beschikbare containerbreedte (px) voor waarde + eenheid. */
  widthPx?: number;
  /** Systeem-fontschaal (PixelRatio.getFontScale()). */
  fontScale?: number;
  c: ReturnType<typeof useColors>;
}) {
  // Begrensde container: past waarde+eenheid niet naast elkaar (grote
  // getallen of grote systeemletters), dan komt de eenheid ONDER de waarde —
  // nooit afgekapte of overlappende cijfers.
  const layout =
    widthPx != null
      ? chooseMetricLayout(value, unit ?? "", widthPx, fontScale ?? 1)
      : "row";
  const valueColor = highlight ? c.primary : HUD_TEXT;
  const unitColor = highlight ? c.primary : HUD_MUTED;
  return (
    <View style={styles.metric}>
      {layout === "stacked" ? (
        <View style={styles.metricValueCol}>
          <Text style={[styles.metricValue, { color: valueColor }]} numberOfLines={1}>
            {value}
          </Text>
          {unit ? (
            <Text style={[styles.metricUnit, { color: unitColor }]} numberOfLines={1}>
              {unit}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.metricValueRow}>
          <Text style={[styles.metricValue, { color: valueColor }]} numberOfLines={1}>
            {value}
          </Text>
          {unit ? (
            <Text style={[styles.metricUnit, { color: unitColor }]} numberOfLines={1}>
              {unit}
            </Text>
          ) : null}
        </View>
      )}
      <Text style={[styles.metricLabel, { color: HUD_MUTED }]} numberOfLines={1}>
        {label}
      </Text>
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
  rolePick: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "stretch",
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 14,
  },
  rolePickText: {
    color: "#0b0f16",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
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
  rejoinRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  rejoinCol: { gap: 8, marginTop: 8 },
  rejoinBtnDetail: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  metricValueCol: { alignItems: "center" },
  climbPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  climbHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  climbTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  climbMeta: { fontFamily: "Inter_400Regular", fontSize: 12 },
  climbPhaseText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  climbProfileRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 52,
    marginTop: 2,
  },
  rejoinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rejoinBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
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
  locNoticeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  audioToggles: { gap: 8 },
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
  sharePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  shareBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,7,14,0.55)",
    justifyContent: "flex-end",
    padding: 16,
    zIndex: 60,
  },
  shareSheet: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  shareHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  shareTitle: { fontFamily: "Inter_700Bold", fontSize: 16, flex: 1 },
  shareNote: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  shareSection: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 4,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  shareAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  shareActionText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
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
  permissionWrap: { position: "absolute", left: 16, right: 16 },
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
