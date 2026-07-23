import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { captureRef } from "react-native-view-shot";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ElevationProfile } from "@/components/ElevationProfile";
import { TrackMap } from "@/components/TrackMap";
import { useColors } from "@/hooks/useColors";
import type { LatLon } from "@/lib/geo";
import { hasMapbox } from "@/lib/mapbox";
import { useSaveRideAsRoute } from "@/lib/routes-api";
import {
  useApplyTrim,
  useRestoreTrim,
  useSession,
  useTrimPreview,
} from "@/lib/sessions-api";
import { shareErrorMessage, useShareInfo, useShareToStrava } from "@/lib/share-api";

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

  // Elevation-cursor position (fraction 0..1 of the ride) while the athlete
  // scrubs the profile chart; highlights the matching real track point on the
  // map. Only set while touching; null otherwise.
  const [cursorFraction, setCursorFraction] = useState<number | null>(null);

  // The matching REAL track point for the cursor: interpolated between the
  // two nearest stored coordinates so the dot sits exactly on the ridden line.
  const cursorPoint: LatLon | null = useMemo(() => {
    if (cursorFraction == null || path.length < 2) return null;
    const t = cursorFraction * (path.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, path.length - 1);
    const f = t - i0;
    return {
      latitude: path[i0].latitude + (path[i1].latitude - path[i0].latitude) * f,
      longitude:
        path[i0].longitude + (path[i1].longitude - path[i0].longitude) * f,
    };
  }, [cursorFraction, path]);

  const session = data?.session ?? null;
  const hasTrack = path.length >= 2;
  const profile = data?.profile ?? null;
  const hasProfile = (profile?.length ?? 0) >= 2;
  const climbs = data?.climbs ?? [];
  const showMap = Platform.OS !== "web" && hasMapbox && hasTrack;

  // Save this ridden track as a re-ridable route. Only offered when the ride
  // really has a stored track AND a linked activity import (importId) — the
  // backend refuses honestly (422) without one, and we show that message.
  const importId = data?.importId ?? null;
  const saveAsRoute = useSaveRideAsRoute();
  const [savedRouteName, setSavedRouteName] = useState<string | null>(null);
  const canSaveAsRoute = hasTrack && importId != null;

  // Delen — deeltekst met echte waarden via het officiële deelmenu van het
  // toestel, plus (indien toegestaan) uploaden naar het eigen Strava-account.
  const share = useShareInfo(session?.id ?? null, session != null);
  const stravaUpload = useShareToStrava();
  const [shareBusy, setShareBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const statsCardRef = useRef<View>(null);

  const onShare = async () => {
    if (!share.data || shareBusy) return;
    setShareBusy(true);
    try {
      await Share.share({ message: share.data.text });
    } catch {
      // Annuleren of deelmenu-fout — geen actie nodig.
    } finally {
      setShareBusy(false);
    }
  };

  // Deel de statistiekkaart (echte waarden) als afbeelding via het officiële
  // deelmenu. De kaart in beeld wordt vastgelegd — niets wordt bijgetekend.
  const onShareImage = async () => {
    if (imageBusy || Platform.OS === "web") return;
    setImageBusy(true);
    setImageError(null);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setImageError("Delen van bestanden wordt op dit toestel niet ondersteund.");
        return;
      }
      const uri = await captureRef(statsCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch {
      setImageError("Afbeelding delen is niet gelukt.");
    } finally {
      setImageBusy(false);
    }
  };

  // ── Rit inkorten ───────────────────────────────────────────────────────────
  // Verplaats het begin- en/of eindpunt van de bewaarde rit. Statistieken
  // worden op de server herberekend uit de ECHTE track; de ruwe opname blijft
  // bewaard zodat herstellen altijd kan. De duur is een schatting (de bewaarde
  // geometrie draagt geen tijd) en wordt ook zo benoemd.
  const trimEdit = data?.trimEdit ?? null;
  const fullPointCount = data?.trackPointCount ?? 0;
  const canTrim = fullPointCount >= 4;
  const [trimOpen, setTrimOpen] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const trimPreview = useTrimPreview(session?.id ?? null);
  const applyTrim = useApplyTrim(session?.id ?? null);
  const restoreTrim = useRestoreTrim(session?.id ?? null);
  const trimStep = Math.max(1, Math.round(fullPointCount / 100));

  const openTrim = () => {
    setTrimStart(trimEdit?.startIndex ?? 0);
    setTrimEnd(trimEdit?.endIndex ?? Math.max(0, fullPointCount - 1));
    trimPreview.reset();
    setTrimOpen(true);
  };

  // Voorvertoning automatisch verversen (licht gedebounced) bij elk verschoven
  // begin/einde — niets wordt opgeslagen tot "Inkorten toepassen".
  useEffect(() => {
    if (!trimOpen || !session || trimEnd <= trimStart) return;
    const t = setTimeout(() => {
      trimPreview.mutate({ startIndex: trimStart, endIndex: trimEnd });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimOpen, trimStart, trimEnd, session?.id]);

  const onApplyTrim = () => {
    if (applyTrim.isPending || trimEnd <= trimStart) return;
    applyTrim.mutate(
      { startIndex: trimStart, endIndex: trimEnd },
      { onSuccess: () => setTrimOpen(false) },
    );
  };

  const onSaveAsRoute = () => {
    if (importId == null || saveAsRoute.isPending || savedRouteName) return;
    saveAsRoute.mutate(
      {
        importId,
        ...(session?.title?.trim() ? { name: session.title.trim() } : {}),
      },
      { onSuccess: (route) => setSavedRouteName(route.name) },
    );
  };

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
              <TrackMap
                path={path}
                primary={c.primary}
                background={c.background}
                highlight={cursorPoint}
              />
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

          {/* ---------- Save as re-ridable route (real track only) ---------- */}
          {canSaveAsRoute ? (
            savedRouteName ? (
              <View
                style={[
                  styles.saveDone,
                  { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
                ]}
              >
                <Ionicons name="checkmark-circle" size={18} color={c.primary} />
                <Text style={[styles.saveDoneText, { color: c.foreground }]}>
                  Opgeslagen als route "{savedRouteName}" — je vindt hem in je
                  routelijst.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Pressable
                  onPress={onSaveAsRoute}
                  disabled={saveAsRoute.isPending}
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: c.primary,
                      borderRadius: c.radius,
                      opacity: saveAsRoute.isPending ? 0.6 : 1,
                    },
                  ]}
                >
                  {saveAsRoute.isPending ? (
                    <ActivityIndicator color={c.primaryForeground} />
                  ) : (
                    <Ionicons name="bookmark-outline" size={18} color={c.primaryForeground} />
                  )}
                  <Text style={[styles.saveBtnText, { color: c.primaryForeground }]}>
                    {saveAsRoute.isPending ? "Bezig met opslaan…" : "Opslaan als route"}
                  </Text>
                </Pressable>
                {saveAsRoute.isError ? (
                  <Text style={[styles.saveError, { color: c.destructive }]}>
                    {(saveAsRoute.error as Error)?.message ||
                      "Opslaan als route is niet gelukt. Probeer het opnieuw."}
                  </Text>
                ) : null}
              </View>
            )
          ) : null}

          {/* ---------- Rit inkorten: begin/einde verplaatsen, herstelbaar ---------- */}
          {canTrim ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Rit inkorten
              </Text>
              {trimEdit && !trimOpen ? (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <Text style={[styles.shareNote, { color: c.mutedForeground }]}>
                    Deze rit is ingekort
                    {trimEdit.durationEstimated
                      ? " (duur geschat op basis van afstand)"
                      : ""}
                    . De volledige opname blijft bewaard.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={openTrim}
                      style={[styles.stravaBtn, { borderColor: c.border, borderRadius: c.radius }]}
                    >
                      <Ionicons name="cut-outline" size={16} color={c.primary} />
                      <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        Aanpassen
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => !restoreTrim.isPending && restoreTrim.mutate()}
                      style={[styles.stravaBtn, { borderColor: c.border, borderRadius: c.radius }]}
                    >
                      {restoreTrim.isPending ? (
                        <ActivityIndicator size="small" color={c.primary} />
                      ) : (
                        <Ionicons name="refresh-outline" size={16} color={c.primary} />
                      )}
                      <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        Volledige rit herstellen
                      </Text>
                    </Pressable>
                  </View>
                  {restoreTrim.isError ? (
                    <Text style={[styles.saveError, { color: c.destructive }]}>
                      {(restoreTrim.error as Error)?.message || "Herstellen is niet gelukt."}
                    </Text>
                  ) : null}
                </View>
              ) : !trimOpen ? (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <Text style={[styles.shareNote, { color: c.mutedForeground }]}>
                    Verplaats het begin- of eindpunt (bijv. wanneer de opname te
                    lang doorliep). Afstand en hoogte worden echt herberekend;
                    de duur wordt geschat op basis van afstand. Altijd
                    terug te draaien.
                  </Text>
                  <Pressable
                    onPress={openTrim}
                    style={[styles.stravaBtn, { borderColor: c.border, borderRadius: c.radius, alignSelf: "flex-start" }]}
                  >
                    <Ionicons name="cut-outline" size={16} color={c.primary} />
                    <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      Rit inkorten
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 6 }}>
                  {(
                    [
                      {
                        label: "Begin",
                        value: trimStart,
                        dec: () => setTrimStart((v) => Math.max(0, v - trimStep)),
                        inc: () =>
                          setTrimStart((v) => Math.min(trimEnd - 1, v + trimStep)),
                      },
                      {
                        label: "Einde",
                        value: trimEnd,
                        dec: () =>
                          setTrimEnd((v) => Math.max(trimStart + 1, v - trimStep)),
                        inc: () =>
                          setTrimEnd((v) =>
                            Math.min(fullPointCount - 1, v + trimStep),
                          ),
                      },
                    ] as const
                  ).map((row) => (
                    <View
                      key={row.label}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                    >
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 13,
                          width: 48,
                        }}
                      >
                        {row.label}
                      </Text>
                      <Pressable
                        onPress={row.dec}
                        hitSlop={8}
                        style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.background }]}
                      >
                        <Ionicons name="remove" size={18} color={c.foreground} />
                      </Pressable>
                      <Text
                        style={{
                          color: c.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 13,
                          minWidth: 72,
                          textAlign: "center",
                        }}
                      >
                        {fullPointCount > 1
                          ? `${Math.round((row.value / (fullPointCount - 1)) * 100)}%`
                          : "0%"}
                      </Text>
                      <Pressable
                        onPress={row.inc}
                        hitSlop={8}
                        style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.background }]}
                      >
                        <Ionicons name="add" size={18} color={c.foreground} />
                      </Pressable>
                    </View>
                  ))}
                  {trimPreview.isPending ? (
                    <View style={styles.shareRow}>
                      <ActivityIndicator size="small" color={c.primary} />
                      <Text style={[styles.shareNote, { color: c.mutedForeground }]}>
                        Voorvertoning wordt berekend…
                      </Text>
                    </View>
                  ) : trimPreview.data ? (
                    <Text style={[styles.shareNote, { color: c.foreground }]}>
                      {`Nieuw: ${trimPreview.data.preview.distanceKm.toFixed(1)} km`}
                      {trimPreview.data.preview.durationMin != null
                        ? ` · ±${trimPreview.data.preview.durationMin} min (geschat)`
                        : ""}
                      {trimPreview.data.preview.elevationM != null
                        ? ` · ${trimPreview.data.preview.elevationM} hm`
                        : " · hoogte niet herberekenbaar"}
                    </Text>
                  ) : trimPreview.isError ? (
                    <Text style={[styles.saveError, { color: c.destructive }]}>
                      {(trimPreview.error as Error)?.message ||
                        "Voorvertoning is niet gelukt."}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={onApplyTrim}
                      disabled={applyTrim.isPending}
                      style={[
                        styles.stravaBtn,
                        {
                          borderColor: c.primary,
                          borderRadius: c.radius,
                          opacity: applyTrim.isPending ? 0.6 : 1,
                        },
                      ]}
                    >
                      {applyTrim.isPending ? (
                        <ActivityIndicator size="small" color={c.primary} />
                      ) : (
                        <Ionicons name="checkmark" size={16} color={c.primary} />
                      )}
                      <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        Inkorten toepassen
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setTrimOpen(false)}
                      style={[styles.stravaBtn, { borderColor: c.border, borderRadius: c.radius }]}
                    >
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        Annuleren
                      </Text>
                    </Pressable>
                  </View>
                  {applyTrim.isError ? (
                    <Text style={[styles.saveError, { color: c.destructive }]}>
                      {(applyTrim.error as Error)?.message || "Inkorten is niet gelukt."}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {/* ---------- Delen: deelmenu + officiële Strava-upload ---------- */}
          {share.isLoading ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Deel deze rit
              </Text>
              <View style={[styles.shareRow]}>
                <ActivityIndicator color={c.primary} />
                <Text style={[styles.shareNote, { color: c.mutedForeground }]}>
                  Deeltekst wordt opgesteld…
                </Text>
              </View>
            </View>
          ) : share.isError ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Deel deze rit
              </Text>
              <Text style={[styles.shareNote, { color: c.mutedForeground, marginTop: 6 }]}>
                De deeltekst kon nu niet worden opgesteld.
              </Text>
              <Pressable
                onPress={() => share.refetch()}
                style={[
                  styles.stravaBtn,
                  { borderColor: c.border, borderRadius: c.radius },
                ]}
              >
                <Ionicons name="refresh-outline" size={16} color={c.primary} />
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  Opnieuw proberen
                </Text>
              </Pressable>
            </View>
          ) : share.data ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Deel deze rit
              </Text>

              {/* Statistiekkaart met echte waarden — dit blok wordt als
                  afbeelding vastgelegd bij "Deel afbeelding". */}
              <View
                ref={statsCardRef}
                collapsable={false}
                style={[styles.shareStatsCard, { borderRadius: c.radius }]}
              >
                <Text style={styles.shareStatsDate}>
                  {fmtDate(session.sessionDate).toUpperCase()}
                </Text>
                <Text style={styles.shareStatsTitle} numberOfLines={2}>
                  {session.title?.trim() || "Rit"}
                </Text>
                <View style={styles.shareStatsRow}>
                  {metrics.slice(0, 4).map((m) => (
                    <View key={m.label} style={{ minWidth: "40%" }}>
                      <Text style={styles.shareStatsValue}>{m.value}</Text>
                      <Text style={styles.shareStatsLabel}>{m.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.shareStatsBrand}>SPARKI</Text>
              </View>

              <Text style={[styles.shareText, { color: c.mutedForeground }]}>
                {share.data.text}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={onShare}
                  disabled={shareBusy}
                  style={[
                    styles.saveBtn,
                    {
                      flex: 1,
                      backgroundColor: c.primary,
                      borderRadius: c.radius,
                      opacity: shareBusy ? 0.6 : 1,
                    },
                  ]}
                >
                  <Ionicons name="share-outline" size={18} color={c.primaryForeground} />
                  <Text style={[styles.saveBtnText, { color: c.primaryForeground }]}>
                    Delen…
                  </Text>
                </Pressable>
                {Platform.OS !== "web" ? (
                  <Pressable
                    onPress={onShareImage}
                    disabled={imageBusy}
                    style={[
                      styles.saveBtn,
                      {
                        flex: 1,
                        borderWidth: 1,
                        borderColor: c.border,
                        backgroundColor: c.card,
                        borderRadius: c.radius,
                        opacity: imageBusy ? 0.6 : 1,
                      },
                    ]}
                  >
                    {imageBusy ? (
                      <ActivityIndicator color={c.primary} />
                    ) : (
                      <Ionicons name="image-outline" size={18} color={c.primary} />
                    )}
                    <Text style={[styles.saveBtnText, { color: c.primary }]}>
                      Deel afbeelding
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {imageError ? (
                <Text style={[styles.saveError, { color: c.destructive, marginTop: 8 }]}>
                  {imageError}
                </Text>
              ) : null}
              {share.data.capabilities.strava.canUpload ? (
                stravaUpload.isSuccess ? (
                  <View style={[styles.shareRow]}>
                    <Ionicons name="checkmark-circle" size={16} color={c.primary} />
                    <Text style={[styles.shareNote, { color: c.foreground }]}>
                      Staat op Strava.
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() =>
                      !stravaUpload.isPending &&
                      stravaUpload.mutate({
                        sessionId: session.id,
                        description: share.data.text,
                      })
                    }
                    style={[
                      styles.stravaBtn,
                      {
                        borderColor: c.border,
                        borderRadius: c.radius,
                        opacity: stravaUpload.isPending ? 0.6 : 1,
                      },
                    ]}
                  >
                    {stravaUpload.isPending ? (
                      <ActivityIndicator color={c.primary} />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={16} color={c.primary} />
                    )}
                    <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {stravaUpload.isPending ? "Bezig met uploaden…" : "Zet op Strava"}
                    </Text>
                  </Pressable>
                )
              ) : share.data.capabilities.strava.reason ? (
                <Text style={[styles.shareNote, { color: c.mutedForeground, marginTop: 10 }]}>
                  {share.data.capabilities.strava.reason}
                </Text>
              ) : null}
              {stravaUpload.isError ? (
                <Text style={[styles.saveError, { color: c.destructive, marginTop: 8 }]}>
                  {shareErrorMessage(stravaUpload.error)}
                </Text>
              ) : null}
              <Text style={[styles.shareNote, { color: c.mutedForeground, marginTop: 10 }]}>
                {share.data.capabilities.platformNote}
              </Text>
            </View>
          ) : null}

          {/* ---------- Elevation profile: only when a real one was stored ---------- */}
          {hasProfile ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Hoogteprofiel
              </Text>
              <ElevationProfile
                profile={profile!}
                distanceKm={fmtNum(session.distanceKm)}
                onCursorChange={hasTrack ? setCursorFraction : undefined}
              />
              {climbs.length > 0 ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={[styles.climbHeader, { color: c.mutedForeground }]}>
                    Klimmen in deze rit
                  </Text>
                  {climbs.map((cl, i) => (
                    <View key={`${cl.name ?? "klim"}-${i}`} style={styles.metricRow}>
                      <Ionicons name="trending-up-outline" size={16} color={c.primary} />
                      <Text
                        style={[styles.metricLabel, { color: c.foreground }]}
                        numberOfLines={1}
                      >
                        {cl.name ?? `Klim ${i + 1}`}
                      </Text>
                      <Text style={[styles.metricValue, { color: c.mutedForeground }]}>
                        {cl.lengthKm.toFixed(1)} km · {cl.avgGradePct.toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : hasTrack ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Hoogteprofiel
              </Text>
              <Text style={[styles.noMapText, { color: c.mutedForeground }]}>
                Geen hoogtedata bij deze rit — het ritbestand bevatte geen
                hoogtemetingen.
              </Text>
            </View>
          ) : null}

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
  climbHeader: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  metricValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  noteText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  saveDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveDoneText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  shareText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginTop: 6 },
  shareStatsCard: {
    backgroundColor: "#05070e",
    padding: 18,
    marginTop: 10,
    gap: 4,
  },
  shareStatsDate: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(125,227,244,0.75)",
  },
  shareStatsTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 22,
    color: "rgba(255,255,255,0.95)",
    marginTop: 2,
  },
  shareStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 12,
  },
  shareStatsValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: "rgba(255,255,255,0.92)",
  },
  shareStatsLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginTop: 1,
  },
  shareStatsBrand: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 3,
    color: "rgba(125,227,244,0.9)",
    marginTop: 14,
  },
  shareNote: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  stravaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    paddingVertical: 10,
    marginTop: 10,
  },
  saveError: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
