import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RouteMap } from "@/components/RouteMap";
import { useColors } from "@/hooks/useColors";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { toLatLon } from "@/lib/geo";
import { createAanvraagSessies } from "@/lib/route-aanvraag-state";
import {
  genereerNieuweVoorstellen,
  haalVoorstelInfo,
  haalVoorstelWeer,
  useSaveVoorstel,
  useZoekBekendeRoutes,
  zoekPlaats,
  type KnownRouteMatch,
  type PlaatsResultaat,
  type RouteObjectCounts,
  type RouteOption,
  type RouteWeerInfo,
  type ZoekCriteria,
} from "@/lib/route-zoek-api";
import {
  useDeleteRoute,
  useHerstelRoute,
  useNearbyRoutes,
  useRoute,
  useRoutes,
  type RouteSummary,
} from "@/lib/routes-api";
import { nearbyTellerTekst, ontdekKaartCenter } from "@/lib/nearby-view";
import {
  NEARBY_FILTERS_LEEG,
  nearbyFiltersActief,
  pasNearbyFilters,
  type NearbyFilters,
  type NearbyMoeilijkheid,
  type NearbySport,
} from "@/lib/nearby-filters";

// ── Hoofdstuk 1 MOBILE_ROUTE_NAV_AFBOUW_01: het schermmodel ─────────────────
// Kaart-eerst (kaart is het scherm), zoekveld + filterbolletjes bovenop de
// kaart, onderaan een sleep-open blad in drie hoogtes met de drie ingangen:
// 1) Voorstel van vandaag, 2) de bibliotheek (hoofdingang), 3) filteren voor
// iets nieuws. Het eerste filterbolletje is het TRAININGSTYPE, niet de sport.
// Zelf tekenen vanaf niets is bewust géén ingang.
//
// Bij het starten van een route wisselt de app naar de navigatieweergave op
// dezelfde kaartcomponent (RouteMap in /navigate) — planningsbediening weg,
// navigatiebediening ervoor in de plaats.

const AFSTANDEN = [20, 40, 60, 80, 100] as const;

const TRAINING_OPTIES: { value: string | null; label: string }[] = [
  { value: null, label: "Vrije rit" },
  { value: "duurtraining", label: "Duurtraining" },
  { value: "interval", label: "Interval" },
  { value: "tempo", label: "Tempo" },
  { value: "herstel", label: "Herstel" },
];

const FIETS_OPTIES: { value: ZoekCriteria["bikeType"]; label: string }[] = [
  { value: null, label: "Elke fiets" },
  { value: "racefiets", label: "Race" },
  { value: "gravel", label: "Gravel" },
  { value: "mtb", label: "MTB" },
];

const FASE_LABEL: Record<string, string> = {
  berekenen: "Nieuwe voorstellen worden berekend…",
  veiligheidscontrole: "Veiligheidscontrole van de voorstellen…",
};

const OBJECT_LABELS: [key: string, enkel: string, meer: string][] = [
  ["traffic_signal", "verkeerslicht", "verkeerslichten"],
  ["railway_crossing", "spoorwegovergang", "spoorwegovergangen"],
  ["roundabout", "rotonde", "rotondes"],
  ["speed_bump", "drempel", "drempels"],
];

function fmtCounts(counts: RouteObjectCounts): string {
  const parts: string[] = [];
  for (const [key, enkel, meer] of OBJECT_LABELS) {
    const n = counts[key] ?? 0;
    if (n > 0) parts.push(`${n} ${n === 1 ? enkel : meer}`);
  }
  return parts.length > 0
    ? parts.join(" · ")
    : "geen verkeerslichten, overwegen, rotondes of drempels bekend op de route";
}

function fmtWeer(w: RouteWeerInfo): string | null {
  const parts: string[] = [];
  if (w.windKmh != null) {
    parts.push(
      `wind ${Math.round(w.windKmh)} km/u${w.windDirLabel ? ` uit ${w.windDirLabel}` : ""}`,
    );
  }
  if (w.tempC != null) parts.push(`${Math.round(w.tempC)}°`);
  if (w.precipProbPct != null)
    parts.push(`${Math.round(w.precipProbPct)}% neerslagkans`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function fmtKm(km: number | null): string {
  return km == null ? "— km" : `${km.toFixed(1)} km`;
}
function fmtHm(m: number | null): string {
  return m == null ? "— hm" : `${Math.round(m)} hm`;
}

type PlannedWorkoutToday = {
  id: number;
  title: string;
  type: string;
  scheduledDate: string;
  targetDurationMin: number | null;
  status: string;
  routeId: number | null;
} | null;

// Geplande trainingstypes → het trainingstype-filter van de routelaag. Alleen
// echte, herkenbare woorden; onbekend = eerlijk "vrije rit"-gedrag (null).
function trainingTypeVanWorkout(w: NonNullable<PlannedWorkoutToday>): string | null {
  const t = `${w.type} ${w.title}`.toLowerCase();
  if (t.includes("interval")) return "interval";
  if (t.includes("herstel")) return "herstel";
  if (t.includes("tempo")) return "tempo";
  if (t.includes("duur")) return "duurtraining";
  return null;
}

// Kaart-eerst voorstellen (taak #561): sportkeuze + korte labels voor de lijst.
const SPORT_OPTIES: { id: NearbySport; label: string; meervoud: string }[] = [
  { id: "cycling", label: "Fietsen", meervoud: "fietsroutes" },
  { id: "walking", label: "Wandelen", meervoud: "wandelroutes" },
  { id: "hiking", label: "Hiken", meervoud: "hikeroutes" },
];

const MOEILIJKHEID_LABEL: Record<NearbyMoeilijkheid, string> = {
  makkelijk: "Makkelijk",
  gemiddeld: "Gemiddeld",
  zwaar: "Zwaar",
};

const BRON_KORT: Record<string, string> = {
  bewaard: "Bewaard",
  plan: "Plan",
  gereden: "Gereden",
  gedeeld: "Gedeeld",
  openbaar: "Openbaar",
};

// Afstand- en hoogtebanden als tikbare presets (mobiel geen invoervelden).
const AFSTAND_BANDEN: {
  label: string;
  minKm: number | null;
  maxKm: number | null;
}[] = [
  { label: "Alle", minKm: null, maxKm: null },
  { label: "tot 25 km", minKm: null, maxKm: 25 },
  { label: "25–60 km", minKm: 25, maxKm: 60 },
  { label: "60+ km", minKm: 60, maxKm: null },
];

const HM_BANDEN: {
  label: string;
  minHm: number | null;
  maxHm: number | null;
}[] = [
  { label: "Alle", minHm: null, maxHm: null },
  { label: "vlak (≤300 hm)", minHm: null, maxHm: 300 },
  { label: "heuvelig (300–800)", minHm: 300, maxHm: 800 },
  { label: "bergen (800+)", minHm: 800, maxHm: null },
];

type Tab = "ontdek" | "vandaag" | "bibliotheek" | "nieuw";
type BladHoogte = "laag" | "half" | "vol";

export default function RoutePlannenScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location, permission, error: locError } = useLiveLocation(true);
  const schermH = Dimensions.get("window").height;

  // ── Startpunt: GPS, of een gezochte plaats via het zoekveld ────────────────
  const [startpunt, setStartpunt] = useState<PlaatsResultaat | null>(null);
  const [zoekTekst, setZoekTekst] = useState("");
  const [plaatsen, setPlaatsen] = useState<PlaatsResultaat[] | null>(null);
  const [plaatsBusy, setPlaatsBusy] = useState(false);
  const [plaatsFout, setPlaatsFout] = useState<string | null>(null);

  // ── Filters (hoofdstuk 3-set; trainingstype eerst) ─────────────────────────
  const [training, setTraining] = useState<string | null>(null);
  const [afstand, setAfstand] = useState<number>(40);
  const [fiets, setFiets] = useState<ZoekCriteria["bikeType"]>(null);
  const [openFilter, setOpenFilter] = useState<
    "training" | "afstand" | "fiets" | "sport" | null
  >(null);

  // ── Ontdek: kaart-eerst voorstellen uit GET /api/routes/nearby (taak #561) ─
  const [sport, setSport] = useState<NearbySport>("cycling");
  const [nearbyFilters, setNearbyFilters] =
    useState<NearbyFilters>(NEARBY_FILTERS_LEEG);
  const [nearbyFiltersOpen, setNearbyFiltersOpen] = useState(false);
  const [gekozenNearbyKey, setGekozenNearbyKey] = useState<string | null>(null);

  // ── Sleepblad ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("ontdek");
  const [blad, setBlad] = useState<BladHoogte>("half");
  const bladHoogtePx: Record<BladHoogte, number> = {
    laag: 64 + insets.bottom,
    half: Math.round(schermH * 0.42),
    vol: Math.round(schermH * 0.82),
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 12,
      onPanResponderRelease: (_e, g) => {
        setBlad((huidig) => {
          const volgorde: BladHoogte[] = ["laag", "half", "vol"];
          const i = volgorde.indexOf(huidig);
          if (g.dy < -30) return volgorde[Math.min(i + 1, 2)]!;
          if (g.dy > 30) return volgorde[Math.max(i - 1, 0)]!;
          return huidig;
        });
      },
    }),
  ).current;

  // ── Bibliotheek (hoofdingang) ──────────────────────────────────────────────
  const routesQ = useRoutes();
  const [gekozenRouteId, setGekozenRouteId] = useState<number | null>(null);
  const gekozenRoute = useRoute(gekozenRouteId);

  // ── Voorstel van vandaag ───────────────────────────────────────────────────
  const workoutQ = useQuery({
    queryKey: ["workout-today"],
    queryFn: () =>
      customFetch<PlannedWorkoutToday>("/api/athlete/workouts/today", {
        responseType: "json",
      }),
  });
  const [vandaagOvergeslagen, setVandaagOvergeslagen] = useState(false);

  // ── Filteren / iets nieuws (zelfde zoeklaag als hoofdstuk 3) ───────────────
  const zoek = useZoekBekendeRoutes();
  const [bekend, setBekend] = useState<KnownRouteMatch[] | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genFase, setGenFase] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [voorstellen, setVoorstellen] = useState<RouteOption[] | null>(null);
  const [voorstelInfo, setVoorstelInfo] = useState<
    Record<string, Awaited<ReturnType<typeof haalVoorstelInfo>>>
  >({});
  const [voorstelWeer, setVoorstelWeer] = useState<Record<string, RouteWeerInfo | null>>({});
  const [kaartVoorstel, setKaartVoorstel] = useState<RouteOption | null>(null);
  const saveVoorstel = useSaveVoorstel();
  const [saveError, setSaveError] = useState<string | null>(null);
  // 02c — bewaarlimiet (3 routes) bereikt: bewaar het gekozen voorstel en bied
  // in de bibliotheek de keuze om een bestaande route te vervangen.
  const [vervangVoorstel, setVervangVoorstel] = useState<RouteOption | null>(null);
  const deleteRoute = useDeleteRoute();
  const herstelRoute = useHerstelRoute();
  const criteriaRef = useRef<ZoekCriteria | null>(null);
  const sessiesRef = useRef(createAanvraagSessies());

  const resetResultaten = useCallback(() => {
    sessiesRef.current.invalideer();
    setBekend(null);
    setVoorstellen(null);
    setVoorstelInfo({});
    setVoorstelWeer({});
    setKaartVoorstel(null);
    setGenError(null);
    setGenFase(null);
    setGenBusy(false);
    setSaveError(null);
    criteriaRef.current = null;
  }, []);

  const startGeneratie = useCallback(
    async (criteria: ZoekCriteria, token: number) => {
      const actueel = () => sessiesRef.current.isActueel(token);
      if (!actueel()) return;
      setGenBusy(true);
      setGenError(null);
      setGenFase("berekenen");
      const uitkomst = await genereerNieuweVoorstellen(criteria, (fase) => {
        if (actueel()) setGenFase(fase);
      });
      if (!actueel()) return;
      setGenBusy(false);
      setGenFase(null);
      if (uitkomst.ok) {
        setVoorstellen(uitkomst.options);
        setKaartVoorstel(uitkomst.options[0] ?? null);
        for (const optie of uitkomst.options) {
          void haalVoorstelWeer(optie.candidateId).then((weer) => {
            if (weer && actueel()) {
              setVoorstelWeer((prev) => ({ ...prev, [optie.candidateId]: weer }));
            }
          });
          void (async () => {
            for (let poging = 0; poging < 6; poging++) {
              if (!actueel()) return;
              const info = await haalVoorstelInfo(optie.candidateId);
              if (info) {
                if (actueel()) {
                  setVoorstelInfo((prev) => ({ ...prev, [optie.candidateId]: info }));
                }
                return;
              }
              await new Promise((r) => setTimeout(r, 3000));
            }
          })();
        }
      } else setGenError(uitkomst.error);
    },
    [],
  );

  const startLatLon = useMemo(() => {
    if (startpunt) return { lat: startpunt.lat, lon: startpunt.lon };
    if (location) return { lat: location.latitude, lon: location.longitude };
    return null;
  }, [startpunt, location]);

  const doZoek = useCallback(
    (opts?: {
      trainingType?: string | null;
      targetDurationMin?: number | null;
      plannedWorkoutId?: number | null;
    }) => {
      if (!startLatLon) return;
      const criteria: ZoekCriteria = {
        startLat: startLatLon.lat,
        startLon: startLatLon.lon,
        targetDistanceKm: afstand,
        elevationPreference: "any",
        trainingType: opts?.trainingType !== undefined ? opts.trainingType : training,
        bikeType: fiets,
        ...(opts?.targetDurationMin != null
          ? { targetDurationMin: opts.targetDurationMin }
          : {}),
        ...(opts?.plannedWorkoutId != null
          ? { plannedWorkoutId: opts.plannedWorkoutId }
          : {}),
      };
      criteriaRef.current = criteria;
      const token = sessiesRef.current.nieuweSessie();
      setBekend(null);
      setVoorstellen(null);
      setVoorstelInfo({});
      setVoorstelWeer({});
      setKaartVoorstel(null);
      setGenError(null);
      setGenFase(null);
      setGenBusy(false);
      setSaveError(null);
      zoek.mutate(criteria, {
        onSuccess: (res) => {
          if (!sessiesRef.current.isActueel(token)) return;
          setBekend(res.bekend);
          if (!res.bekend.some((m) => m.bruikbaar)) {
            void startGeneratie(criteria, token);
          }
        },
      });
    },
    [startLatLon, afstand, training, fiets, zoek, startGeneratie],
  );

  const kiesVoorstel = useCallback(
    (optie: RouteOption) => {
      setSaveError(null);
      saveVoorstel.mutate(
        { candidateId: optie.candidateId, name: optie.name },
        {
          onSuccess: (route) => {
            setVervangVoorstel(null);
            router.push(`/navigate/${route.id}`);
          },
          onError: (err) => {
            const body = (err as { body?: { error?: string; code?: string } })
              ?.body;
            setSaveError(
              body?.error ??
                (err as Error)?.message ??
                "Bewaren is niet gelukt. Probeer het opnieuw.",
            );
            // 02c — bied de vervang-keuze aan in de bibliotheek.
            if (body?.code === "bewaarlimiet") {
              setVervangVoorstel(optie);
              setTab("bibliotheek");
            }
          },
        },
      );
    },
    [saveVoorstel, router],
  );

  const doPlaatsZoek = useCallback(() => {
    const q = zoekTekst.trim();
    if (q.length < 2) return;
    setPlaatsBusy(true);
    setPlaatsFout(null);
    zoekPlaats(q)
      .then((res) => {
        setPlaatsen(res);
        if (res.length === 0) setPlaatsFout("Geen plaats gevonden.");
      })
      .catch((err) =>
        setPlaatsFout(
          (err as { body?: { error?: string } })?.body?.error ??
            "Adres zoeken is niet gelukt.",
        ),
      )
      .finally(() => setPlaatsBusy(false));
  }, [zoekTekst]);

  // Zoek al tijdens het typen (vanaf drie tekens, kort vertraagd) zodat je
  // nooit afhankelijk bent van de zoektoets op het toetsenbord.
  useEffect(() => {
    const q = zoekTekst.trim();
    if (q.length < 3) return;
    const timer = setTimeout(() => {
      setPlaatsBusy(true);
      setPlaatsFout(null);
      zoekPlaats(q)
        .then((res) => {
          setPlaatsen(res);
          if (res.length === 0) setPlaatsFout("Geen plaats gevonden.");
        })
        .catch(() => {
          // Tijdens typen niet alarmeren; de zichtbare zoekknop meldt fouten wél.
        })
        .finally(() => setPlaatsBusy(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [zoekTekst]);

  // Eerlijke uitleg + uitweg wanneer er nog geen startpunt is: dit scherm mag
  // nooit doodlopen op een grijze knop zonder verklaring.
  const startpuntUitleg =
    startLatLon != null ? null : (
      <View style={{ gap: 6 }}>
        <Text style={[styles.honest, { color: c.destructive }]}>
          {permission === "denied"
            ? "De routeknop staat uit omdat de app je locatie niet mag gebruiken."
            : "De routeknop staat uit omdat je positie nog niet bekend is (wachten op GPS)."}
        </Text>
        <Text style={[styles.honest, { color: c.mutedForeground }]}>
          Je kunt ook zonder GPS verder: typ een plaats in het zoekveld bovenaan
          en kies die als startpunt.
        </Text>
        {permission === "denied" ? (
          <Pressable
            onPress={() => void Linking.openSettings()}
            style={styles.ctaRow}
          >
            <Ionicons name="settings-outline" size={15} color={c.primary} />
            <Text style={[styles.ctaText, { color: c.primary }]}>
              Locatietoestemming aanzetten in instellingen
            </Text>
          </Pressable>
        ) : null}
      </View>
    );

  // ── Kaartlijn: gekozen bibliotheekroute of het (eerste) nieuwe voorstel ────
  const kaartPad = useMemo(() => {
    if (kaartVoorstel?.geometry && kaartVoorstel.geometry.length >= 2) {
      return kaartVoorstel.geometry.map(toLatLon);
    }
    const geo = gekozenRoute.data?.geometry;
    if (Array.isArray(geo) && geo.length >= 2) return geo.map(toLatLon);
    return [] as ReturnType<typeof toLatLon>[];
  }, [kaartVoorstel, gekozenRoute.data]);

  const workout = workoutQ.data ?? null;
  const bruikbaar = bekend?.filter((m) => m.bruikbaar) ?? [];
  const nietBruikbaar = bekend?.filter((m) => !m.bruikbaar) ?? [];

  // ── Ontdek-gegevens: nearby-lijst + client-side filters (live teller) ──────
  const nearbyQ = useNearbyRoutes(tab === "ontdek" ? startLatLon : null, sport);
  const alleNearby = nearbyQ.data?.routes ?? [];
  const nearbyRoutes = useMemo(
    () => pasNearbyFilters(alleNearby, nearbyFilters),
    [alleNearby, nearbyFilters],
  );
  const gekozenNearby =
    nearbyRoutes.find((r) => r.key === gekozenNearbyKey) ?? null;
  const sportInfo = SPORT_OPTIES.find((s) => s.id === sport)!;
  const nearbyKaartLijnen = useMemo(
    () =>
      tab === "ontdek"
        ? nearbyRoutes
            .filter((r) => r.geometry.length >= 2)
            .map((r) => ({ key: r.key, path: r.geometry.map(toLatLon) }))
        : [],
    [tab, nearbyRoutes],
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      {/* ── De kaart is het scherm ── */}
      <RouteMap
        path={kaartPad}
        location={location}
        following={kaartPad.length < 2 && nearbyKaartLijnen.length === 0}
        onUserPan={() => {}}
        primary={c.primary}
        background={c.background}
        centerOn={
          tab === "ontdek" && kaartPad.length < 2
            ? ontdekKaartCenter(
                startpunt ? { lat: startpunt.lat, lon: startpunt.lon } : null,
                location,
              )
            : null
        }
        nearbyRoutes={nearbyKaartLijnen}
        selectedNearbyKey={gekozenNearbyKey}
        onNearbyPress={(key) => {
          setGekozenNearbyKey(key);
          setBlad((h) => (h === "laag" ? "half" : h));
        }}
      />
      {kaartPad.length < 2 && !location && !(tab === "ontdek" && startpunt) ? (
        <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
          <Text style={[styles.honest, { color: c.mutedForeground, textAlign: "center" }]}>
            {locError ?? "Wachten op GPS voor de kaart…"}
          </Text>
        </View>
      ) : null}

      {/* ── Bovenop de kaart: terug, zoekveld, filterbolletjes ── */}
      <View style={[styles.topWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <Ionicons name="chevron-back" size={20} color={c.foreground} />
          </Pressable>
          <View
            style={[styles.zoekVeld, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Ionicons name="search" size={16} color={c.mutedForeground} />
            <TextInput
              value={zoekTekst}
              onChangeText={(t) => {
                setZoekTekst(t);
                setPlaatsen(null);
                setPlaatsFout(null);
              }}
              onSubmitEditing={doPlaatsZoek}
              placeholder={startpunt ? startpunt.name : "Startpunt of plaats zoeken"}
              placeholderTextColor={c.mutedForeground}
              returnKeyType="search"
              style={[styles.zoekInput, { color: c.foreground }]}
            />
            {plaatsBusy ? <ActivityIndicator size="small" color={c.primary} /> : null}
            {!plaatsBusy && zoekTekst.trim().length >= 2 ? (
              <Pressable hitSlop={8} onPress={doPlaatsZoek}>
                <Ionicons name="arrow-forward-circle" size={20} color={c.primary} />
              </Pressable>
            ) : null}
            {startpunt ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setStartpunt(null);
                  setZoekTekst("");
                  setPlaatsen(null);
                  resetResultaten();
                }}
              >
                <Ionicons name="close-circle" size={18} color={c.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {plaatsen && plaatsen.length > 0 ? (
          <View style={[styles.plaatsLijst, { backgroundColor: c.card, borderColor: c.border }]}>
            {plaatsen.slice(0, 4).map((p, i) => (
              <Pressable
                key={`${p.lat}-${p.lon}-${i}`}
                onPress={() => {
                  setStartpunt(p);
                  setZoekTekst("");
                  setPlaatsen(null);
                  resetResultaten();
                }}
                style={styles.plaatsRij}
              >
                <Ionicons name="location-outline" size={15} color={c.primary} />
                <Text style={[styles.plaatsTekst, { color: c.foreground }]} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : plaatsFout ? (
          <View style={[styles.plaatsLijst, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.honest, { color: c.destructive, padding: 10 }]}>{plaatsFout}</Text>
          </View>
        ) : null}

        {/* Filterbolletjes — Ontdek: sport/locatie/filters; anders het
            trainingstype eerst. */}
        {tab === "ontdek" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bolletjesRij}
          >
            <FilterBolletje
              label={sportInfo.label}
              actief={openFilter === "sport"}
              onPress={() => setOpenFilter(openFilter === "sport" ? null : "sport")}
              c={c}
            />
            <FilterBolletje
              label="Huidige locatie"
              actief={startpunt == null && location != null}
              onPress={() => {
                setStartpunt(null);
                setZoekTekst("");
                setPlaatsen(null);
                setGekozenNearbyKey(null);
              }}
              c={c}
            />
            <FilterBolletje
              label={
                nearbyFiltersActief(nearbyFilters) ? "Filters •" : "Filters"
              }
              actief={nearbyFiltersOpen || nearbyFiltersActief(nearbyFilters)}
              onPress={() => {
                setNearbyFiltersOpen((v) => !v);
                setBlad((h) => (h === "laag" ? "half" : h));
              }}
              c={c}
            />
          </ScrollView>
        ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bolletjesRij}
        >
          <FilterBolletje
            label={TRAINING_OPTIES.find((o) => o.value === training)?.label ?? "Vrije rit"}
            actief={training !== null || openFilter === "training"}
            onPress={() => setOpenFilter(openFilter === "training" ? null : "training")}
            c={c}
          />
          <FilterBolletje
            label={`${afstand} km`}
            actief={openFilter === "afstand"}
            onPress={() => setOpenFilter(openFilter === "afstand" ? null : "afstand")}
            c={c}
          />
          <FilterBolletje
            label={FIETS_OPTIES.find((o) => o.value === fiets)?.label ?? "Elke fiets"}
            actief={fiets !== null || openFilter === "fiets"}
            onPress={() => setOpenFilter(openFilter === "fiets" ? null : "fiets")}
            c={c}
          />
        </ScrollView>
        )}
        {openFilter === "sport" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bolletjesRij}
          >
            {SPORT_OPTIES.map((s) => (
              <FilterBolletje
                key={s.id}
                label={s.label}
                actief={sport === s.id}
                onPress={() => {
                  setSport(s.id);
                  setGekozenNearbyKey(null);
                  setOpenFilter(null);
                }}
                c={c}
              />
            ))}
          </ScrollView>
        ) : null}
        {openFilter && openFilter !== "sport" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bolletjesRij}
          >
            {openFilter === "training"
              ? TRAINING_OPTIES.map((o) => (
                  <FilterBolletje
                    key={o.label}
                    label={o.label}
                    actief={training === o.value}
                    onPress={() => {
                      setTraining(o.value);
                      setOpenFilter(null);
                      resetResultaten();
                    }}
                    c={c}
                  />
                ))
              : openFilter === "afstand"
                ? AFSTANDEN.map((km) => (
                    <FilterBolletje
                      key={km}
                      label={`${km} km`}
                      actief={afstand === km}
                      onPress={() => {
                        setAfstand(km);
                        setOpenFilter(null);
                        resetResultaten();
                      }}
                      c={c}
                    />
                  ))
                : FIETS_OPTIES.map((o) => (
                    <FilterBolletje
                      key={o.label}
                      label={o.label}
                      actief={fiets === o.value}
                      onPress={() => {
                        setFiets(o.value);
                        setOpenFilter(null);
                        resetResultaten();
                      }}
                      c={c}
                    />
                  ))}
          </ScrollView>
        ) : null}
      </View>

      {/* ── Sleep-open blad in drie hoogtes ── */}
      <View
        style={[
          styles.blad,
          {
            height: bladHoogtePx[blad],
            backgroundColor: c.background,
            borderColor: c.border,
          },
        ]}
      >
        <View {...pan.panHandlers} style={styles.bladGreepZone}>
          <View style={[styles.bladGreep, { backgroundColor: c.border }]} />
        </View>
        {blad !== "laag" ? (
          <View style={styles.tabRij}>
            <TabKnop label="Ontdek" actief={tab === "ontdek"} onPress={() => setTab("ontdek")} c={c} />
            <TabKnop label="Vandaag" actief={tab === "vandaag"} onPress={() => setTab("vandaag")} c={c} />
            <TabKnop label="Bibliotheek" actief={tab === "bibliotheek"} onPress={() => setTab("bibliotheek")} c={c} />
            <TabKnop label="Nieuw" actief={tab === "nieuw"} onPress={() => setTab("nieuw")} c={c} />
          </View>
        ) : (
          <Pressable onPress={() => setBlad("half")}>
            <Text style={[styles.honest, { color: c.mutedForeground, textAlign: "center" }]}>
              Sleep omhoog voor routes
            </Text>
          </Pressable>
        )}

        {blad !== "laag" ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 24,
              gap: 12,
            }}
          >
            {tab === "ontdek" ? <OntdekInhoud /> : null}

            {tab === "vandaag" ? (
              workoutQ.isLoading ? (
                <ActivityIndicator color={c.primary} />
              ) : !workout || vandaagOvergeslagen ? (
                <Text style={[styles.honest, { color: c.mutedForeground }]}>
                  {vandaagOvergeslagen
                    ? "Voorstel overgeslagen — kies uit je bibliotheek of maak iets nieuws."
                    : "Er staat vandaag geen training in je schema. Kies uit je bibliotheek of maak iets nieuws."}
                </Text>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: c.foreground }]}>
                    {workout.title}
                  </Text>
                  <Text style={[styles.honest, { color: c.mutedForeground }]}>
                    {workout.targetDurationMin
                      ? `Gepland: ${workout.targetDurationMin} minuten.`
                      : "Geplande training van vandaag."}{" "}
                    Er wordt één route gezocht die hierbij past.
                  </Text>
                  {workout.routeId ? (
                    <Pressable
                      onPress={() => router.push(`/navigate/${workout.routeId}`)}
                      style={[styles.primaryBtn, { backgroundColor: c.primary }]}
                    >
                      <Ionicons name="play" size={18} color={c.primaryForeground} />
                      <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
                        Start de gekoppelde route
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={!startLatLon || zoek.isPending}
                      onPress={() =>
                        doZoek({
                          trainingType: trainingTypeVanWorkout(workout),
                          targetDurationMin: workout.targetDurationMin,
                          plannedWorkoutId: workout.id,
                        })
                      }
                      style={[
                        styles.primaryBtn,
                        {
                          backgroundColor: c.primary,
                          opacity: !startLatLon || zoek.isPending ? 0.6 : 1,
                        },
                      ]}
                    >
                      {zoek.isPending ? (
                        <ActivityIndicator color={c.primaryForeground} />
                      ) : (
                        <Ionicons name="sparkles" size={18} color={c.primaryForeground} />
                      )}
                      <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
                        {!startLatLon
                          ? permission === "denied"
                            ? "Geen locatietoestemming"
                            : "Wachten op GPS…"
                          : "Zoek een passende route"}
                      </Text>
                    </Pressable>
                  )}
                  {startpuntUitleg}
                  <Pressable onPress={() => setVandaagOvergeslagen(true)} style={styles.ctaRow}>
                    <Text style={[styles.ctaText, { color: c.mutedForeground }]}>Overslaan</Text>
                  </Pressable>
                  <ZoekResultaten />
                </>
              )
            ) : null}

            {tab === "bibliotheek" && vervangVoorstel ? (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.primary }]}>
                <Text style={[styles.cardName, { color: c.foreground }]}>
                  Bewaarplek vol (3 van 3)
                </Text>
                <Text style={[styles.honest, { color: c.mutedForeground }]}>
                  Kies hieronder welke route je vervangt door
                  “{vervangVoorstel.name}”, of upgrade naar Sparki Go voor
                  onbeperkt bewaren.
                </Text>
                <Pressable onPress={() => setVervangVoorstel(null)}>
                  <Text style={[styles.ctaText, { color: c.mutedForeground }]}>
                    Toch niet vervangen
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {tab === "bibliotheek" ? (
              routesQ.isLoading ? (
                <ActivityIndicator color={c.primary} />
              ) : (routesQ.data ?? []).length === 0 ? (
                <Text style={[styles.honest, { color: c.mutedForeground }]}>
                  Nog geen routes in je bibliotheek. Maak iets nieuws via het
                  tabblad Nieuw, of koppel Strava zodat je gereden routes hier
                  verschijnen.
                </Text>
              ) : (
                (routesQ.data ?? []).map((r: RouteSummary) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setKaartVoorstel(null);
                      setGekozenRouteId(r.id);
                    }}
                    style={[
                      styles.card,
                      {
                        backgroundColor: c.card,
                        borderColor: gekozenRouteId === r.id ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Text style={[styles.cardName, { color: c.foreground }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                      {fmtKm(r.distanceKm)} · {fmtHm(r.elevationGainM)}
                      {r.expiredAt ? " · Vervallen" : ""}
                    </Text>
                    {r.expiredAt ? (
                      // 02c — vervallen (bewaartermijn verstreken) maar
                      // herstelbaar; herstellen loopt door dezelfde poorten
                      // als opslaan en kan dus eerlijk weigeren.
                      <Pressable
                        disabled={herstelRoute.isPending}
                        onPress={() =>
                          herstelRoute.mutate(r.id, {
                            onError: (err) =>
                              setSaveError(
                                (err as { body?: { error?: string } })?.body
                                  ?.error ?? "Herstellen is niet gelukt.",
                              ),
                          })
                        }
                        style={styles.ctaRow}
                      >
                        <Ionicons name="refresh" size={15} color={c.primary} />
                        <Text style={[styles.ctaText, { color: c.primary }]}>
                          {herstelRoute.isPending ? "Bezig…" : "Herstel route"}
                        </Text>
                      </Pressable>
                    ) : null}
                    {vervangVoorstel && !r.expiredAt ? (
                      <Pressable
                        disabled={deleteRoute.isPending || saveVoorstel.isPending}
                        onPress={() => {
                          const optie = vervangVoorstel;
                          deleteRoute.mutate(r.id, {
                            onSuccess: () => kiesVoorstel(optie),
                            onError: (err) =>
                              setSaveError(
                                (err as { body?: { error?: string } })?.body
                                  ?.error ?? "Vervangen is niet gelukt.",
                              ),
                          });
                        }}
                        style={styles.ctaRow}
                      >
                        <Ionicons name="swap-horizontal" size={15} color={c.destructive} />
                        <Text style={[styles.ctaText, { color: c.destructive }]}>
                          {deleteRoute.isPending || saveVoorstel.isPending
                            ? "Bezig…"
                            : "Vervang deze route"}
                        </Text>
                      </Pressable>
                    ) : null}
                    {gekozenRouteId === r.id ? (
                      <Pressable
                        onPress={() => router.push(`/navigate/${r.id}`)}
                        style={styles.ctaRow}
                      >
                        <Ionicons name="play" size={15} color={c.primary} />
                        <Text style={[styles.ctaText, { color: c.primary }]}>Navigeer</Text>
                      </Pressable>
                    ) : null}
                  </Pressable>
                ))
              )
            ) : null}

            {tab === "nieuw" ? (
              <>
                <Text style={[styles.honest, { color: c.mutedForeground }]}>
                  {startpunt
                    ? `Rondrit vanaf ${startpunt.name}`
                    : "Rondrit vanaf je huidige locatie"}{" "}
                  — stel de bolletjes bovenaan in en zoek.
                </Text>
                <Pressable
                  disabled={!startLatLon || zoek.isPending}
                  onPress={() => doZoek()}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: c.primary,
                      opacity: !startLatLon || zoek.isPending ? 0.6 : 1,
                    },
                  ]}
                >
                  {zoek.isPending ? (
                    <ActivityIndicator color={c.primaryForeground} />
                  ) : (
                    <Ionicons name="search" size={18} color={c.primaryForeground} />
                  )}
                  <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
                    {!startLatLon
                      ? permission === "denied"
                        ? "Geen locatietoestemming"
                        : "Wachten op GPS…"
                      : zoek.isPending
                        ? "Bekende routes zoeken…"
                        : "Zoek een route"}
                  </Text>
                </Pressable>
                {startpuntUitleg}
                <ZoekResultaten />
              </>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );

  // Ontdek-tab (taak #561): voorstellen uit GET /api/routes/nearby met live
  // gefilterde teller, kaartselectie en een eerlijke dun-gebied-melding met
  // "Zelf plannen" als uitweg.
  function OntdekInhoud() {
    if (startLatLon == null) {
      return (
        <>
          <Text style={[styles.honest, { color: c.mutedForeground }]}>
            Er is nog geen locatie bekend. Zet locatietoestemming aan of zoek
            een plaatsnaam bovenaan — dan verschijnen hier de routes uit die
            omgeving.
          </Text>
          {startpuntUitleg}
        </>
      );
    }
    return (
      <>
        {nearbyFiltersOpen ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardName, { color: c.foreground }]}>Filters</Text>
            <Text style={[styles.honest, { color: c.mutedForeground }]}>Afstand</Text>
            <View style={styles.chipsWrap}>
              {AFSTAND_BANDEN.map((b) => (
                <FilterBolletje
                  key={b.label}
                  label={b.label}
                  actief={
                    nearbyFilters.minKm === b.minKm &&
                    nearbyFilters.maxKm === b.maxKm
                  }
                  onPress={() =>
                    setNearbyFilters({
                      ...nearbyFilters,
                      minKm: b.minKm,
                      maxKm: b.maxKm,
                    })
                  }
                  c={c}
                />
              ))}
            </View>
            <Text style={[styles.honest, { color: c.mutedForeground }]}>Hoogtemeters</Text>
            <View style={styles.chipsWrap}>
              {HM_BANDEN.map((b) => (
                <FilterBolletje
                  key={b.label}
                  label={b.label}
                  actief={
                    nearbyFilters.minHm === b.minHm &&
                    nearbyFilters.maxHm === b.maxHm
                  }
                  onPress={() =>
                    setNearbyFilters({
                      ...nearbyFilters,
                      minHm: b.minHm,
                      maxHm: b.maxHm,
                    })
                  }
                  c={c}
                />
              ))}
            </View>
            <Text style={[styles.honest, { color: c.mutedForeground }]}>
              Moeilijkheid (indicatief, uit echte afstand en hoogtemeters)
            </Text>
            <View style={styles.chipsWrap}>
              {(Object.keys(MOEILIJKHEID_LABEL) as NearbyMoeilijkheid[]).map((m) => (
                <FilterBolletje
                  key={m}
                  label={MOEILIJKHEID_LABEL[m]}
                  actief={nearbyFilters.moeilijkheid[m]}
                  onPress={() =>
                    setNearbyFilters({
                      ...nearbyFilters,
                      moeilijkheid: {
                        ...nearbyFilters.moeilijkheid,
                        [m]: !nearbyFilters.moeilijkheid[m],
                      },
                    })
                  }
                  c={c}
                />
              ))}
            </View>
            <Text style={[styles.honest, { color: c.mutedForeground }]}>Ondergrond</Text>
            <View style={styles.chipsWrap}>
              {(
                [
                  ["geen", "Geen voorkeur"],
                  ["verhard", "Weg of verhard"],
                  ["onverhard", "Off-road"],
                ] as const
              ).map(([id, label]) => (
                <FilterBolletje
                  key={id}
                  label={label}
                  actief={nearbyFilters.ondergrond === id}
                  onPress={() =>
                    setNearbyFilters({ ...nearbyFilters, ondergrond: id })
                  }
                  c={c}
                />
              ))}
            </View>
            <Text style={[styles.honest, { color: c.mutedForeground }]}>
              Routes zonder bekend wegdek tellen alleen mee bij "Geen voorkeur".
            </Text>
            <Text style={[styles.honest, { color: c.mutedForeground }]}>Type route</Text>
            <View style={styles.chipsWrap}>
              {(
                [
                  ["alle", "Alle"],
                  ["lus", "Circulair"],
                  ["heenterug", "Heen en terug"],
                ] as const
              ).map(([id, label]) => (
                <FilterBolletje
                  key={id}
                  label={label}
                  actief={nearbyFilters.type === id}
                  onPress={() => setNearbyFilters({ ...nearbyFilters, type: id })}
                  c={c}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setNearbyFilters(NEARBY_FILTERS_LEEG)}
                style={[styles.secondaryBtn, { borderColor: c.border, flex: 1 }]}
              >
                <Text style={[styles.secondaryBtnText, { color: c.foreground }]}>
                  Alles resetten
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setNearbyFiltersOpen(false)}
                style={[styles.primaryBtn, { backgroundColor: c.primary, flex: 1 }]}
              >
                <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
                  {nearbyTellerTekst(nearbyRoutes.length, sportInfo.meervoud, {
                    total: nearbyQ.data?.total,
                    afgekapt: nearbyQ.data?.afgekapt,
                  })}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {nearbyQ.isLoading ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={c.primary} />
            <Text style={[styles.honest, { color: c.mutedForeground }]}>
              Routes in de buurt zoeken…
            </Text>
          </View>
        ) : nearbyQ.isError ? (
          <>
            <Text style={[styles.honest, { color: c.destructive }]}>
              Routes in de buurt konden niet geladen worden.
            </Text>
            <Pressable
              onPress={() => void nearbyQ.refetch()}
              style={[styles.secondaryBtn, { borderColor: c.border }]}
            >
              <Ionicons name="refresh" size={16} color={c.foreground} />
              <Text style={[styles.secondaryBtnText, { color: c.foreground }]}>
                Opnieuw proberen
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              {nearbyTellerTekst(nearbyRoutes.length, sportInfo.meervoud, {
                total: nearbyQ.data?.total,
                afgekapt: nearbyQ.data?.afgekapt,
              })}
            </Text>
            {nearbyRoutes.length === 0 ? (
              <>
                <Text style={[styles.honest, { color: c.mutedForeground }]}>
                  {alleNearby.length > 0
                    ? "Geen routes binnen deze filters. Zet een filter ruimer of reset alles."
                    : "Nog geen bekende routes in dit gebied. De voorstellen komen uit je eigen routes, je ritgeschiedenis en gedeelde of openbare routes van anderen — hier is daarvan nog niets. Plan zelf een route; die wordt dan met een echte blokkadecontrole gemaakt."}
                </Text>
                <Pressable
                  onPress={() => setTab("nieuw")}
                  style={[styles.primaryBtn, { backgroundColor: c.primary }]}
                >
                  <Ionicons name="sparkles" size={18} color={c.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
                    Zelf plannen
                  </Text>
                </Pressable>
              </>
            ) : (
              nearbyRoutes.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() =>
                    setGekozenNearbyKey(gekozenNearbyKey === r.key ? null : r.key)
                  }
                  style={[
                    styles.card,
                    {
                      backgroundColor: c.card,
                      borderColor:
                        gekozenNearbyKey === r.key ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.cardName, { color: c.foreground }]}
                    numberOfLines={1}
                  >
                    {r.naam}
                  </Text>
                  <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                    {fmtKm(r.distanceKm)} · {fmtHm(r.elevationGainM)}
                    {r.moeilijkheid
                      ? ` · ${MOEILIJKHEID_LABEL[r.moeilijkheid]}`
                      : ""}
                    {` · ${r.isLus ? "Rondje" : "Heen en terug / A-B"}`}
                  </Text>
                  <Text style={[styles.honest, { color: c.mutedForeground }]}>
                    {BRON_KORT[r.bron] ?? r.bronLabel} · start op{" "}
                    {r.startAfstandKm.toFixed(1)} km
                  </Text>
                  {gekozenNearbyKey === r.key ? (
                    r.soort === "route" &&
                    (r.bron === "bewaard" ||
                      r.bron === "plan" ||
                      r.bron === "gereden") ? (
                      <Pressable
                        onPress={() => router.push(`/navigate/${r.id}`)}
                        style={styles.ctaRow}
                      >
                        <Ionicons name="play" size={15} color={c.primary} />
                        <Text style={[styles.ctaText, { color: c.primary }]}>
                          Navigeer
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.honest, { color: c.mutedForeground }]}>
                        {r.soort === "kandidaat"
                          ? "Gereden rit — bewaar hem eerst als route via je ritgeschiedenis."
                          : "Gedeelde of openbare route — open hem via je routebibliotheek op web."}
                      </Text>
                    )
                  ) : null}
                  {gekozenNearbyKey === r.key ? (
                    <Text style={[styles.honest, { color: c.mutedForeground }]}>
                      Vóór opslaan of navigeren volgt altijd een nieuwe
                      blokkadecontrole.
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
            {nearbyQ.data ? (
              <Text style={[styles.honest, { color: c.mutedForeground }]}>
                {nearbyQ.data.corpusNote} {nearbyQ.data.verificatieNote}
              </Text>
            ) : null}
          </>
        )}
      </>
    );
  }

  // Gedeelde resultatenlijst (bekende routes + nieuwe voorstellen) — gebruikt
  // door zowel het Vandaag-tabblad als het Nieuw-tabblad.
  function ZoekResultaten() {
    return (
      <>
        {zoek.isError ? (
          <Text style={[styles.honest, { color: c.destructive }]}>
            {(zoek.error as { body?: { error?: string } })?.body?.error ??
              "Bekende routes zoeken is niet gelukt. Controleer je verbinding."}
          </Text>
        ) : null}
        {bekend !== null ? (
          <>
            {bekend.length === 0 ? (
              <Text style={[styles.honest, { color: c.mutedForeground }]}>
                Geen van je bekende routes past bij deze aanvraag.
              </Text>
            ) : (
              <Text style={[styles.sectionTitle, { color: c.foreground }]}>
                Bekende routes die passen
              </Text>
            )}
            {bruikbaar.map((m) => (
              <Pressable
                key={m.routeId}
                onPress={() => {
                  setGekozenRouteId(null);
                  setKaartVoorstel({
                    candidateId: `bekend-${m.routeId}`,
                    name: m.name,
                    distanceKm: m.distanceKm,
                    elevationGainM: m.elevationGainM,
                    durationSec: m.durationSec,
                    surface: m.surface,
                    geometry: m.geometry,
                    nav: null,
                  });
                }}
                style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <Text style={[styles.cardName, { color: c.foreground }]} numberOfLines={1}>
                  {m.name} · {m.originLabel}
                </Text>
                <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                  {fmtKm(m.distanceKm)} · {fmtHm(m.elevationGainM)} · start op{" "}
                  {m.startAfstandKm.toFixed(1)} km
                </Text>
                {m.matchReasons.length > 0 ? (
                  <Text style={[styles.honest, { color: c.mutedForeground }]}>
                    {m.matchReasons.join(" · ")}
                  </Text>
                ) : null}
                {m.ownership === "eigen" ? (
                  <Pressable
                    onPress={() => router.push(`/navigate/${m.routeId}`)}
                    style={styles.ctaRow}
                  >
                    <Ionicons name="play" size={15} color={c.primary} />
                    <Text style={[styles.ctaText, { color: c.primary }]}>Navigeer</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.honest, { color: c.mutedForeground }]}>
                    Gedeelde route — open hem via je routebibliotheek op web.
                  </Text>
                )}
              </Pressable>
            ))}
            {nietBruikbaar.map((m) => (
              <View
                key={m.routeId}
                style={[styles.card, { backgroundColor: c.card, borderColor: c.destructive, opacity: 0.85 }]}
              >
                <Text style={[styles.cardName, { color: c.foreground }]} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={[styles.honest, { color: c.destructive }]}>
                  {m.verificatie.status === "geblokkeerd"
                    ? `Geblokkeerd: ${m.verificatie.reden}`
                    : m.verificatie.status === "niet_controleerbaar"
                      ? `Niet controleerbaar: ${m.verificatie.reden}`
                      : ""}
                </Text>
              </View>
            ))}
            {voorstellen === null && !genBusy ? (
              <Pressable
                onPress={() => {
                  if (criteriaRef.current) {
                    void startGeneratie(criteriaRef.current, sessiesRef.current.nieuweSessie());
                  }
                }}
                style={[styles.secondaryBtn, { borderColor: c.border }]}
              >
                <Ionicons name="sparkles" size={16} color={c.foreground} />
                <Text style={[styles.secondaryBtnText, { color: c.foreground }]}>
                  Maak toch een nieuw voorstel
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {genBusy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={c.primary} />
            <Text style={[styles.honest, { color: c.mutedForeground }]}>
              {FASE_LABEL[genFase ?? ""] ?? "Bezig…"}
            </Text>
          </View>
        ) : null}
        {genError ? (
          <Text style={[styles.honest, { color: c.destructive }]}>{genError}</Text>
        ) : null}
        {saveError ? (
          <Text style={[styles.honest, { color: c.destructive }]}>{saveError}</Text>
        ) : null}
        {(voorstellen ?? []).map((o) => (
          <Pressable
            key={o.candidateId}
            onPress={() => {
              setGekozenRouteId(null);
              setKaartVoorstel(o);
            }}
            style={[
              styles.card,
              {
                backgroundColor: c.card,
                borderColor:
                  kaartVoorstel?.candidateId === o.candidateId ? c.primary : c.border,
              },
            ]}
          >
            <Text style={[styles.cardName, { color: c.foreground }]} numberOfLines={1}>
              {o.name}
            </Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              {fmtKm(o.distanceKm)} · {fmtHm(o.elevationGainM)}
            </Text>
            {voorstelInfo[o.candidateId] ? (
              <Text style={[styles.honest, { color: c.mutedForeground }]}>
                {fmtCounts(voorstelInfo[o.candidateId]!.counts)}
              </Text>
            ) : null}
            {voorstelWeer[o.candidateId] ? (
              <Text style={[styles.honest, { color: c.mutedForeground }]}>
                Bij vertrek komend uur:{" "}
                {fmtWeer(voorstelWeer[o.candidateId]!) ?? "geen gegevens"}
              </Text>
            ) : null}
            {voorstelInfo[o.candidateId]?.rationale ? (
              <Text style={[styles.honest, { color: c.mutedForeground }]}>
                {voorstelInfo[o.candidateId]!.rationale}
              </Text>
            ) : null}
            <Pressable
              disabled={saveVoorstel.isPending}
              onPress={() => kiesVoorstel(o)}
              style={styles.ctaRow}
            >
              {saveVoorstel.isPending ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <Ionicons name="play" size={15} color={c.primary} />
              )}
              <Text style={[styles.ctaText, { color: c.primary }]}>
                Bewaar en navigeer
              </Text>
            </Pressable>
          </Pressable>
        ))}
      </>
    );
  }
}

function FilterBolletje({
  label,
  actief,
  onPress,
  c,
}: {
  label: string;
  actief: boolean;
  onPress: () => void;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.bolletje,
        {
          backgroundColor: actief ? c.primary : c.card,
          borderColor: actief ? c.primary : c.border,
        },
      ]}
    >
      <Text
        style={[styles.bolletjeText, { color: actief ? c.primaryForeground : c.foreground }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TabKnop({
  label,
  actief,
  onPress,
  c,
}: {
  label: string;
  actief: boolean;
  onPress: () => void;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabKnop,
        { borderBottomColor: actief ? c.primary : "transparent" },
      ]}
    >
      <Text
        style={[
          styles.tabKnopText,
          { color: actief ? c.foreground : c.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mapFallback: { alignItems: "center", justifyContent: "center", padding: 40 },
  topWrap: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  zoekVeld: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 40,
  },
  zoekInput: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, paddingVertical: 0 },
  plaatsLijst: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  plaatsRij: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  plaatsTekst: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  bolletjesRij: { gap: 8, paddingRight: 12 },
  bolletje: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  bolletjeText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  blad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  bladGreepZone: { alignItems: "center", paddingVertical: 10 },
  bladGreep: { width: 44, height: 5, borderRadius: 3 },
  tabRij: { flexDirection: "row", paddingHorizontal: 16, gap: 4 },
  tabKnop: { flex: 1, alignItems: "center", paddingVertical: 8, borderBottomWidth: 2 },
  tabKnopText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  honest: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  card: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    gap: 6,
  },
  cardName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  cardMeta: { fontFamily: "Inter_500Medium", fontSize: 13 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
