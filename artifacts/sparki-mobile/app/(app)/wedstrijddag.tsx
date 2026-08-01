import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customFetch } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

/**
 * Wedstrijddagmodus — APP-ONLY (besluitenpatch 01-08-2026, hoofdstuk D).
 * Voor de ploegleider én teammanager: selectie, dagschema, vervoer,
 * materiaalstatus, briefings en opdrachten van één clubwedstrijd in één
 * scherm. De server bepaalt de rechten (403 voor andere rollen) — hier wordt
 * niets verzonnen: wat de club niet heeft ingevuld, staat er eerlijk niet.
 */

type ClubRace = {
  id: number;
  clubId: number;
  name: string;
  raceDate: string;
  location: string | null;
};

type DayMode = {
  event: { id: number; name: string; raceDate: string; location: string | null };
  isRaceDay: boolean;
  selections: Array<{ clerkId: string; role: string; availability: string | null }>;
  schedule: Array<{
    clerkId: string;
    departTime: string;
    meetPoint: string;
    returnTime: string | null;
    note: string | null;
  }>;
  vehicles: Array<{ id: number; name: string; seats: number | null; passengers: string[] }>;
  material: { total: number; loaded: number; open: Array<{ id: number; item: string; riderClerkId: string }> };
  briefings: Array<{ id: number; audience: string; title: string; body: string }>;
  assignments: Array<{ riderClerkId: string; body: string }>;
};

// Contract van GET /api/clubs: lidmaatschappen met club-rij (server-SSOT).
type ClubMembership = {
  membership: { clubId: number; role: string };
  club: { id: number; name: string } | null;
};

export default function WedstrijddagScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [races, setRaces] = useState<Array<ClubRace & { clubName: string }>>([]);
  const [selected, setSelected] = useState<ClubRace | null>(null);
  const [day, setDay] = useState<DayMode | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadRaces = useCallback(async () => {
    setError(null);
    try {
      const memberships = await customFetch<ClubMembership[]>("/api/clubs", {
        responseType: "json",
      });
      const all: Array<ClubRace & { clubName: string }> = [];
      for (const m of memberships) {
        if (!m.club) continue;
        try {
          const evs = await customFetch<ClubRace[]>(`/api/clubs/${m.club.id}/races`, {
            responseType: "json",
          });
          for (const ev of evs) all.push({ ...ev, clubId: m.club.id, clubName: m.club.name });
        } catch {
          // Geen rechten in deze club — eerlijk overslaan.
        }
      }
      all.sort((a, b) => a.raceDate.localeCompare(b.raceDate));
      setRaces(all);
    } catch {
      setError("Wedstrijden laden is niet gelukt. Controleer je verbinding.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDay = useCallback(async (race: ClubRace) => {
    setError(null);
    setLoading(true);
    try {
      const data = await customFetch<DayMode>(
        `/api/clubs/${race.clubId}/races/${race.id}/day-mode`,
        { responseType: "json" },
      );
      setDay(data);
      setSelected(race);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("403") || msg.toLowerCase().includes("ploegleider")
          ? "De wedstrijddagmodus is voor de ploegleider en teammanager."
          : "Wedstrijddag laden is niet gelukt.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRaces();
  }, [loadRaces]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selected) await loadDay(selected);
    else await loadRaces();
    setRefreshing(false);
  }, [selected, loadDay, loadRaces]);

  const s = styles(c);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable
          onPress={() => (selected ? (setSelected(null), setDay(null)) : router.back())}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={s.title}>{selected ? day?.event.name ?? "Wedstrijddag" : "Wedstrijddagmodus"}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.tint} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {error ? <Text style={s.error}>{error}</Text> : null}

          {!selected ? (
            races.length === 0 && !error ? (
              <Text style={s.empty}>
                Geen clubwedstrijden gevonden. De wedstrijddagmodus werkt zodra jouw club een
                wedstrijd heeft gepland.
              </Text>
            ) : (
              races.map((r) => (
                <Pressable key={`${r.clubId}-${r.id}`} style={s.card} onPress={() => void loadDay(r)}>
                  <Text style={s.cardTitle}>{r.name}</Text>
                  <Text style={s.cardMeta}>
                    {r.raceDate}
                    {r.location ? ` · ${r.location}` : ""} · {r.clubName}
                  </Text>
                </Pressable>
              ))
            )
          ) : day ? (
            <>
              {day.isRaceDay ? (
                <View style={s.badgeToday}>
                  <Text style={s.badgeTodayText}>Vandaag is de wedstrijddag</Text>
                </View>
              ) : null}

              <Text style={s.section}>Selectie ({day.selections.length})</Text>
              {day.selections.length === 0 ? (
                <Text style={s.empty}>Nog geen selectie ingevuld.</Text>
              ) : (
                day.selections.map((sel) => (
                  <Text key={sel.clerkId} style={s.row}>
                    {sel.role === "renner" ? "🚴" : sel.role === "reserve" ? "🔁" : "🧰"} {sel.clerkId}
                    {sel.availability && sel.availability !== "beschikbaar"
                      ? ` — ${sel.availability.replace(/_/g, " ")}`
                      : ""}
                  </Text>
                ))
              )}

              <Text style={s.section}>Dagschema</Text>
              {day.schedule.length === 0 ? (
                <Text style={s.empty}>Geen dagschema ingevuld.</Text>
              ) : (
                day.schedule.map((r) => (
                  <Text key={r.clerkId} style={s.row}>
                    {r.departTime} · {r.meetPoint} · {r.clerkId}
                    {r.returnTime ? ` (terug ${r.returnTime})` : ""}
                  </Text>
                ))
              )}

              <Text style={s.section}>Vervoer</Text>
              {day.vehicles.length === 0 ? (
                <Text style={s.empty}>Geen vervoersindeling.</Text>
              ) : (
                day.vehicles.map((v) => (
                  <Text key={v.id} style={s.row}>
                    {v.name}
                    {v.seats != null ? ` (${v.passengers.length}/${v.seats})` : ""} —{" "}
                    {v.passengers.length > 0 ? v.passengers.join(", ") : "leeg"}
                  </Text>
                ))
              )}

              <Text style={s.section}>
                Materiaal — {day.material.loaded}/{day.material.total} ingeladen
              </Text>
              {day.material.open.length > 0 ? (
                day.material.open.map((m) => (
                  <Text key={m.id} style={[s.row, s.warn]}>
                    Nog niet ingeladen: {m.item} ({m.riderClerkId})
                  </Text>
                ))
              ) : day.material.total > 0 ? (
                <Text style={s.row}>Alles ingeladen.</Text>
              ) : (
                <Text style={s.empty}>Geen materiaallijst.</Text>
              )}

              <Text style={s.section}>Briefings</Text>
              {day.briefings.length === 0 ? (
                <Text style={s.empty}>Geen briefings.</Text>
              ) : (
                day.briefings.map((b) => (
                  <View key={b.id} style={s.card}>
                    <Text style={s.cardTitle}>
                      {b.title} <Text style={s.cardMeta}>({b.audience})</Text>
                    </Text>
                    <Text style={s.row}>{b.body}</Text>
                  </View>
                ))
              )}

              <Text style={s.section}>Opdrachten</Text>
              {day.assignments.length === 0 ? (
                <Text style={s.empty}>Geen opdrachten.</Text>
              ) : (
                day.assignments.map((a) => (
                  <Text key={a.riderClerkId} style={s.row}>
                    {a.riderClerkId}: {a.body}
                  </Text>
                ))
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, textAlign: "center" },
    section: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 20, marginBottom: 6 },
    row: { fontSize: 14, color: c.text, marginBottom: 4 },
    warn: { color: "#b45309" },
    empty: { fontSize: 14, color: c.mutedForeground, marginBottom: 4 },
    error: { fontSize: 14, color: "#b91c1c", marginBottom: 12 },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    cardTitle: { fontSize: 15, fontWeight: "600", color: c.text },
    cardMeta: { fontSize: 13, color: c.mutedForeground, marginTop: 2 },
    badgeToday: {
      backgroundColor: "#065f46",
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    badgeTodayText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  });
