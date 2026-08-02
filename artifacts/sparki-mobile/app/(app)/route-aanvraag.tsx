import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { createAanvraagSessies } from "@/lib/route-aanvraag-state";
import {
  genereerNieuweVoorstellen,
  haalRouteInfo,
  haalVoorstelInfo,
  haalVoorstelWeer,
  useSaveVoorstel,
  useZoekBekendeRoutes,
  type KnownRouteMatch,
  type RouteInfo,
  type RouteObjectCounts,
  type RouteWeerInfo,
  type RouteOption,
  type ZoekCriteria,
} from "@/lib/route-zoek-api";

// Routeaanvraag op mobiel (taak #519): zelfde zoeklaag als de web-planner.
// Volgorde is bewust sequentieel: éérst bekende routes (POST /api/routes/zoek,
// met herkomstlabel + motivering + fail-closed blokkadecontrole), pas daarna
// nieuwe voorstellen — automatisch alleen wanneer er níets bruikbaars bekend
// is, anders na een expliciete keuze van de rijder.

const AFSTANDEN = [20, 40, 60, 80, 100] as const;

// Hoofdstuk 3 (MOBILE_ROUTE_NAV_AFBOUW_01): het hoofdfilter is wat voor
// training je doet — niet vijftien velden. Verkeerslichten, rotondes,
// spoorwegovergangen, drempels en het weer zijn geen filter meer: die staan
// als echte informatie bij elke route.
const TRAINING_OPTIES: { value: string | null; label: string }[] = [
  { value: null, label: "Vrije rit" },
  { value: "duurtraining", label: "Duurtraining" },
  { value: "interval", label: "Interval" },
  { value: "tempo", label: "Tempo" },
  { value: "herstel", label: "Herstel" },
];

const FIETS_OPTIES: { value: ZoekCriteria["bikeType"]; label: string }[] = [
  { value: null, label: "Maakt niet uit" },
  { value: "racefiets", label: "Race" },
  { value: "gravel", label: "Gravel" },
  { value: "mtb", label: "MTB" },
];

const FASE_LABEL: Record<string, string> = {
  berekenen: "Nieuwe voorstellen worden berekend…",
  veiligheidscontrole: "Veiligheidscontrole van de voorstellen…",
};

export default function RouteAanvraagScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location, error: locError } = useLiveLocation(true);

  const [afstand, setAfstand] = useState<number>(40);
  const [training, setTraining] = useState<string | null>(null);
  const [fiets, setFiets] = useState<ZoekCriteria["bikeType"]>(null);

  const zoek = useZoekBekendeRoutes();
  const [bekend, setBekend] = useState<KnownRouteMatch[] | null>(null);

  const [genBusy, setGenBusy] = useState(false);
  const [genFase, setGenFase] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [voorstellen, setVoorstellen] = useState<RouteOption[] | null>(null);
  // Informatie bij nieuwe voorstellen (hoofdstuk 3): de server verrijkt
  // kandidaten op de achtergrond; hier komt het resultaat per candidateId.
  const [voorstelInfo, setVoorstelInfo] = useState<
    Record<string, Awaited<ReturnType<typeof haalVoorstelInfo>>>
  >({});
  const [voorstelWeer, setVoorstelWeer] = useState<
    Record<string, RouteWeerInfo | null>
  >({});
  const saveVoorstel = useSaveVoorstel();
  const [saveError, setSaveError] = useState<string | null>(null);
  // De laatst gezochte criteria — nieuwe voorstellen gebruiken exact dezelfde
  // aanvraag als de zoekstap, en resultaten horen bij precies één criteria-set.
  const criteriaRef = useRef<ZoekCriteria | null>(null);
  // Sessiebewaking (reviewronde): elke zoekopdracht/criteriawijziging start
  // een nieuwe sessie; uitkomsten van een oudere, nog lopende zoek- of
  // generatie-aanvraag mogen daarna nooit meer landen — anders kiest de
  // rijder een voorstel dat bij een vorig startpunt of afstand hoort.
  const sessiesRef = useRef(createAanvraagSessies());
  const huidigTokenRef = useRef(0);

  // Criteriawijziging wist alle resultaten: de bekende-lijst hoort bij één
  // criteria-set, anders toont een volgende blik routes van een vorige vraag.
  const resetResultaten = useCallback(() => {
    sessiesRef.current.invalideer();
    setBekend(null);
    setVoorstellen(null);
    setVoorstelInfo({});
    setVoorstelWeer({});
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
      // Verouderde sessie (criteria gewijzigd of opnieuw gezocht): uitkomst
      // volledig negeren — geen voorstellen, geen fout, geen fase.
      if (!actueel()) return;
      setGenBusy(false);
      setGenFase(null);
      if (uitkomst.ok) {
        setVoorstellen(uitkomst.options);
        // Verkeersobject-info per voorstel ophalen: een paar rustige polls —
        // eerlijk niets tonen als de verrijking (nog) geen data heeft.
        for (const optie of uitkomst.options) {
          // Weer bij het startpunt van het voorstel — één aanvraag, eerlijk
          // null (= geen regel) wanneer de bron niet antwoordt.
          void haalVoorstelWeer(optie.candidateId).then((weer) => {
            if (weer && actueel()) {
              setVoorstelWeer((prev) => ({
                ...prev,
                [optie.candidateId]: weer,
              }));
            }
          });
          void (async () => {
            for (let poging = 0; poging < 6; poging++) {
              if (!actueel()) return;
              const info = await haalVoorstelInfo(optie.candidateId);
              if (info) {
                if (actueel()) {
                  setVoorstelInfo((prev) => ({
                    ...prev,
                    [optie.candidateId]: info,
                  }));
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

  const doZoek = useCallback(() => {
    if (!location) return;
    const criteria: ZoekCriteria = {
      startLat: location.latitude,
      startLon: location.longitude,
      targetDistanceKm: afstand,
      elevationPreference: "any",
      trainingType: training,
      bikeType: fiets,
    };
    criteriaRef.current = criteria;
    const token = sessiesRef.current.nieuweSessie();
    huidigTokenRef.current = token;
    setBekend(null);
    setVoorstellen(null);
    setGenError(null);
    setGenFase(null);
    setGenBusy(false);
    setSaveError(null);
    zoek.mutate(criteria, {
      onSuccess: (res) => {
        if (!sessiesRef.current.isActueel(token)) return;
        setBekend(res.bekend);
        // Sequentieel, zoals op web: nieuwe generatie start alleen automatisch
        // wanneer er geen enkele bruikbare bekende route is.
        if (!res.bekend.some((m) => m.bruikbaar)) {
          void startGeneratie(criteria, token);
        }
      },
    });
  }, [location, afstand, training, fiets, zoek, startGeneratie]);

  const kiesVoorstel = useCallback(
    (optie: RouteOption) => {
      setSaveError(null);
      saveVoorstel.mutate(
        { candidateId: optie.candidateId, name: optie.name },
        {
          onSuccess: (route) => router.push(`/navigate/${route.id}`),
          onError: (err) =>
            setSaveError(
              (err as { body?: { error?: string } })?.body?.error ??
                (err as Error)?.message ??
                "Bewaren is niet gelukt. Probeer het opnieuw.",
            ),
        },
      );
    },
    [saveVoorstel, router],
  );

  const bruikbaar = bekend?.filter((m) => m.bruikbaar) ?? [];
  const nietBruikbaar = bekend?.filter((m) => !m.bruikbaar) ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: c.primary }]}>SPARKI</Text>
          <Text style={[styles.title, { color: c.foreground }]}>
            Route aanvragen
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
          gap: 14,
        }}
      >
        <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>
          Rondrit vanaf je huidige locatie
        </Text>

        <View style={styles.chipRow}>
          {AFSTANDEN.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              active={afstand === km}
              onPress={() => {
                setAfstand(km);
                resetResultaten();
              }}
              c={c}
            />
          ))}
        </View>
        <View style={styles.chipRow}>
          {TRAINING_OPTIES.map((o) => (
            <Chip
              key={o.label}
              label={o.label}
              active={training === o.value}
              onPress={() => {
                setTraining(o.value);
                resetResultaten();
              }}
              c={c}
            />
          ))}
        </View>
        <View style={styles.chipRow}>
          {FIETS_OPTIES.map((o) => (
            <Chip
              key={o.label}
              label={o.label}
              active={fiets === o.value}
              onPress={() => {
                setFiets(o.value);
                resetResultaten();
              }}
              c={c}
            />
          ))}
        </View>

        {locError ? (
          <Text style={[styles.honest, { color: c.destructive }]}>{locError}</Text>
        ) : null}

        <Pressable
          disabled={!location || zoek.isPending}
          onPress={doZoek}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: c.primary,
              opacity: !location || zoek.isPending ? 0.6 : 1,
            },
          ]}
        >
          {zoek.isPending ? (
            <ActivityIndicator color={c.primaryForeground} />
          ) : (
            <Ionicons name="search" size={18} color={c.primaryForeground} />
          )}
          <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
            {!location
              ? "Wachten op GPS…"
              : zoek.isPending
                ? "Bekende routes zoeken…"
                : "Zoek een route"}
          </Text>
        </Pressable>

        {zoek.isError ? (
          <Text style={[styles.honest, { color: c.destructive }]}>
            {(zoek.error as { body?: { error?: string } })?.body?.error ??
              "Bekende routes zoeken is niet gelukt. Controleer je verbinding."}
          </Text>
        ) : null}

        {bekend !== null && (
          <>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Bekende routes die passen
            </Text>
            {bekend.length === 0 ? (
              <Text style={[styles.honest, { color: c.mutedForeground }]}>
                Geen van je bekende routes past bij deze aanvraag.
              </Text>
            ) : null}
            {bruikbaar.map((m) => (
              <BekendeRouteCard
                key={m.routeId}
                match={m}
                c={c}
                onPress={
                  m.ownership === "eigen"
                    ? () => router.push(`/navigate/${m.routeId}`)
                    : undefined
                }
              />
            ))}
            {nietBruikbaar.map((m) => (
              <BekendeRouteCard key={m.routeId} match={m} c={c} />
            ))}

            {voorstellen === null && !genBusy ? (
              <Pressable
                onPress={() => {
                  if (criteriaRef.current) {
                    void startGeneratie(
                      criteriaRef.current,
                      huidigTokenRef.current,
                    );
                  }
                }}
                style={[
                  styles.secondaryBtn,
                  { borderColor: c.border, backgroundColor: c.card },
                ]}
              >
                <Ionicons name="sparkles-outline" size={18} color={c.primary} />
                <Text style={[styles.secondaryBtnText, { color: c.primary }]}>
                  Sparki, maak nieuwe voorstellen
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        {genBusy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={c.primary} />
            <Text style={[styles.honest, { color: c.mutedForeground }]}>
              {FASE_LABEL[genFase ?? ""] ?? "Nieuwe voorstellen worden berekend…"}
            </Text>
          </View>
        ) : null}
        {genError ? (
          <Text style={[styles.honest, { color: c.destructive }]}>{genError}</Text>
        ) : null}

        {voorstellen !== null && (
          <>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Nieuwe voorstellen
            </Text>
            {voorstellen.map((o) => (
              <Pressable
                key={o.candidateId}
                disabled={saveVoorstel.isPending}
                onPress={() => kiesVoorstel(o)}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.card,
                    borderColor: c.border,
                    opacity: saveVoorstel.isPending ? 0.6 : 1,
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
                  <Text style={[styles.reasons, { color: c.mutedForeground }]}>
                    {fmtCounts(voorstelInfo[o.candidateId]!.counts)}
                  </Text>
                ) : null}
                {voorstelWeer[o.candidateId] ? (
                  <Text style={[styles.reasons, { color: c.mutedForeground }]}>
                    Bij vertrek komend uur:{" "}
                    {fmtWeer(voorstelWeer[o.candidateId]!) ?? "geen gegevens"}
                  </Text>
                ) : null}
                {voorstelInfo[o.candidateId]?.rationale ? (
                  <Text style={[styles.reasons, { color: c.mutedForeground }]}>
                    {voorstelInfo[o.candidateId]!.rationale}
                  </Text>
                ) : null}
                <View style={styles.ctaRow}>
                  <Ionicons name="play" size={15} color={c.primary} />
                  <Text style={[styles.ctaText, { color: c.primary }]}>
                    {saveVoorstel.isPending ? "Bewaren…" : "Bewaar en navigeer"}
                  </Text>
                </View>
              </Pressable>
            ))}
            {saveError ? (
              <Text style={[styles.honest, { color: c.destructive }]}>
                {saveError}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BekendeRouteCard({
  match,
  c,
  onPress,
}: {
  match: KnownRouteMatch;
  c: ReturnType<typeof useColors>;
  onPress?: () => void;
}) {
  const verdict =
    match.verificatie.status === "geverifieerd" ? null : match.verificatie;
  const geblokkeerd = verdict !== null;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: geblokkeerd ? c.destructive : c.border,
          opacity: geblokkeerd ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: c.foreground }]} numberOfLines={1}>
          {match.name}
        </Text>
        <View style={[styles.badge, { backgroundColor: c.accent }]}>
          <Text style={[styles.badgeText, { color: c.accentForeground }]}>
            {match.originLabel}
          </Text>
        </View>
      </View>
      <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
        {fmtKm(match.distanceKm)} · {fmtHm(match.elevationGainM)} · start op{" "}
        {match.startAfstandKm.toFixed(1)} km
      </Text>
      {match.matchReasons.length > 0 ? (
        <Text style={[styles.reasons, { color: c.mutedForeground }]}>
          {match.matchReasons.join(" · ")}
        </Text>
      ) : null}
      {verdict ? (
        // Eerlijke markering, exact zoals op web: geblokkeerd of niet
        // controleerbaar — en dan is de route bewust niet start-baar.
        <View style={styles.blockRow}>
          <Ionicons name="alert-circle" size={15} color={c.destructive} />
          <Text style={[styles.blockText, { color: c.destructive }]}>
            {verdict.status === "geblokkeerd"
              ? `Geblokkeerd: ${verdict.reden}`
              : `Niet controleerbaar: ${verdict.reden}`}
          </Text>
        </View>
      ) : onPress ? (
        <>
          <RouteInfoBlok routeId={match.routeId} c={c} />
          <View style={styles.ctaRow}>
            <Ionicons name="play" size={15} color={c.primary} />
            <Text style={[styles.ctaText, { color: c.primary }]}>Navigeer</Text>
          </View>
        </>
      ) : (
        // Gedeelde routes zijn nooit direct start-baar vanuit de zoeklaag
        // (privacy-veilige kijkersgeometrie) — zelfde regel als op web.
        <Text style={[styles.reasons, { color: c.mutedForeground }]}>
          Gedeelde route — open hem via je routebibliotheek op web om hem te
          gebruiken.
        </Text>
      )}
    </Pressable>
  );
}

// ── Informatie bij de route (hoofdstuk 3) ───────────────────────────────────

const OBJECT_LABELS: [key: string, enkel: string, meer: string][] = [
  ["traffic_signal", "verkeerslicht", "verkeerslichten"],
  ["railway_crossing", "spoorwegovergang", "spoorwegovergangen"],
  ["roundabout", "rotonde", "rotondes"],
  ["speed_bump", "drempel", "drempels"],
];

function fmtCounts(counts: RouteObjectCounts): string | null {
  const parts: string[] = [];
  for (const [key, enkel, meer] of OBJECT_LABELS) {
    const n = counts[key] ?? 0;
    if (n > 0) parts.push(`${n} ${n === 1 ? enkel : meer}`);
  }
  if (parts.length === 0) return "geen verkeerslichten, overwegen, rotondes of drempels bekend op de route";
  return parts.join(" · ");
}

function fmtWeer(w: NonNullable<RouteInfo["weather"]>): string | null {
  const parts: string[] = [];
  if (w.windKmh != null) {
    parts.push(
      `wind ${Math.round(w.windKmh)} km/u${w.windDirLabel ? ` uit ${w.windDirLabel}` : ""}`,
    );
  }
  if (w.tempC != null) parts.push(`${Math.round(w.tempC)}°`);
  if (w.precipProbPct != null) parts.push(`${Math.round(w.precipProbPct)}% neerslagkans`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Route-informatie voor een eigen bekende route: pas opgehaald wanneer de
// rijder erom vraagt (één tik) — geen stapel kaartaanvragen voor een hele
// lijst. Bronnen die niet antwoorden leveren eerlijk "geen gegevens".
function RouteInfoBlok({
  routeId,
  c,
}: {
  routeId: number;
  c: ReturnType<typeof useColors>;
}) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<RouteInfo | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  if (info) {
    const objecten = info.counts ? fmtCounts(info.counts) : null;
    const weer = info.weather ? fmtWeer(info.weather) : null;
    return (
      <View style={{ gap: 3 }}>
        <Text style={[styles.reasons, { color: c.mutedForeground }]}>
          {objecten ?? "Verkeersobjecten: geen gegevens voor deze route."}
        </Text>
        <Text style={[styles.reasons, { color: c.mutedForeground }]}>
          {weer ? `Bij vertrek komend uur: ${weer}` : "Weer: geen gegevens voor het startpunt."}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      disabled={busy}
      hitSlop={8}
      onPress={(e) => {
        // De kaart zelf is óók tikbaar (Navigeer) — dit blok niet laten doorbubbelen.
        e.stopPropagation();
        setBusy(true);
        setFout(null);
        haalRouteInfo(routeId)
          .then(setInfo)
          .catch(() =>
            setFout("Route-informatie kon niet worden opgehaald."),
          )
          .finally(() => setBusy(false));
      }}
      style={styles.ctaRow}
    >
      {busy ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <Ionicons name="information-circle-outline" size={15} color={c.primary} />
      )}
      <Text style={[styles.ctaText, { color: fout ? c.destructive : c.primary }]}>
        {fout ?? (busy ? "Route-informatie ophalen…" : "Toon route-informatie")}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
  c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.card,
          borderColor: active ? c.primary : c.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? c.primaryForeground : c.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function fmtKm(km: number | null): string {
  return km == null ? "— km" : `${km.toFixed(1)} km`;
}
function fmtHm(m: number | null): string {
  return m == null ? "— hm" : `${Math.round(m)} hm`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 2 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, letterSpacing: -0.5 },
  sectionLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  honest: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  card: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardName: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  cardMeta: { fontFamily: "Inter_500Medium", fontSize: 13 },
  reasons: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  blockRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  blockText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
