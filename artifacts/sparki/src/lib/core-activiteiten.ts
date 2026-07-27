import type { TrainingSession } from "@/lib/athlete-types";

export const TYPE_LABELS: Record<string, string> = {
  // ── Trainingstypen (Sparki eigen) ───────────────────────────────────────────
  endurance: "Duurtraining",
  duurtraining: "Duurtraining",
  interval: "Intervaltraining",
  intervals: "Intervaltraining",
  recovery: "Hersteltraining",
  herstel: "Hersteltraining",
  tempo: "Tempotraining",
  threshold: "Drempeltraining",
  race: "Wedstrijd",
  rest: "Rustdag",
  strength: "Krachttraining",
  other: "Training",

  // ── Canonieke sporttypen (normalizeSport output) ────────────────────────────
  // Fietsen — canonical + sub-variants
  cycling: "Fietsen",
  mountainbike: "Mountainbike",
  gravel: "Gravel",
  // Overige sporten
  running: "Hardlopen",
  hiking: "Wandeling",
  swimming: "Zwemmen",
  multisport: "Meerdere sporten",
  skiing: "Skiën",
  yoga: "Yoga",
  crossfit: "CrossFit",
  workout: "Training",

  // ── Ruwe Strava / Garmin activity types (vóór normalisatie of passthrough) ──
  ride: "Fietsen",
  virtualride: "Indoor fietsen",
  ebikeride: "E-bike",
  handcycle: "Handbike",
  velomobile: "Velomobiel",
  indoorcycling: "Indoor fietsen",
  mountainbikeride: "Mountainbike",
  gravelride: "Gravel",
  // Wandelen / hardlopen / zwemmen
  run: "Hardlopen",
  trailrun: "Trailrunning",
  virtualrun: "Hardlopen (indoor)",
  treadmill: "Hardlopen (indoor)",
  hike: "Wandeling",
  walk: "Wandeling",
  walking: "Wandeling",
  swim: "Zwemmen",
  openwaterswim: "Openwaterzwemmen",
};

/**
 * Alle bekende wielren/fiets-sporttypen (lowercased, zowel canonical als raw).
 * Gebruikt om te bepalen of Sparki inhoudelijke analyse kan bieden.
 */
export const CYCLING_SPORT_TYPES = new Set<string>([
  // canonical (normalizeSport output)
  "cycling",
  "mountainbike",
  "gravel",
  // raw strava / garmin
  "ride",
  "virtualride",
  "ebikeride",
  "handcycle",
  "velomobile",
  "indoorcycling",
  "mountainbikeride",
  "gravelride",
  "road",
  "track",
]);

/** Geeft true wanneer Sparki volledige fietsanalyse kan bieden voor dit type. */
export function isCyclingType(t: string | undefined | null): boolean {
  if (!t) return true; // lege/onbekende typen behandelen als fietsen (veilige standaard)
  return CYCLING_SPORT_TYPES.has(t.toLowerCase());
}

/**
 * Compacte Nederlandse toelichting voor niet-fietsactiviteiten.
 * Compact gehouden zodat het past naast de bestaande rij-UI.
 */
export function unsupportedSportNote(t: string | undefined | null): string {
  const key = (t ?? "").toLowerCase();
  if (key === "running" || key === "run" || key === "trailrun" || key === "virtualrun" || key === "treadmill")
    return "Hardlopen — uitgebreide analyse nog niet beschikbaar";
  if (key === "hiking" || key === "hike" || key === "walk" || key === "walking")
    return "Wandeling — geregistreerde activiteit";
  if (key === "swimming" || key === "swim" || key === "openwaterswim")
    return "Zwemmen — geregistreerde activiteit";
  return `${typeLabel(t)} — geregistreerde activiteit`;
}

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Handmatig",
  sparki: "Sparki",
  strava: "Strava",
  import: "Import",
  garmin: "Garmin",
  wahoo: "Wahoo",
};

export function typeLabel(t: string | undefined | null) {
  if (!t) return "Training";
  return TYPE_LABELS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

export function sourceLabel(s: string | undefined | null) {
  if (!s) return "Onbekend";
  return SOURCE_LABELS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

export function avgSpeed(s: TrainingSession): number | null {
  const stored = s.avgSpeedKph != null ? Number(s.avgSpeedKph) : NaN;
  if (Number.isFinite(stored) && stored > 0) return stored;
  const km = s.distanceKm != null && s.distanceKm !== "" ? Number(s.distanceKm) : NaN;
  if (Number.isFinite(km) && km > 0 && s.durationMin != null && s.durationMin > 0)
    return km / (s.durationMin / 60);
  return null;
}

export function monthKey(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(Date.UTC(y!, (m ?? 1) - 1, 15)).toLocaleDateString(
    "nl-NL",
    { month: "long", year: "numeric" },
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function relativeDate(iso: string, todayISO: string) {
  const then = new Date(iso + "T12:00:00Z").getTime();
  const now = new Date(todayISO + "T12:00:00Z").getTime();
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  return new Date(iso + "T12:00:00Z").toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export type Summary = {
  count: number;
  durationMin: number;
  distanceKm: number;
};

export function calculateSummary(sessions: TrainingSession[]): Summary {
  let durationMin = 0;
  let distanceKm = 0;
  for (const s of sessions) {
    if (s.durationMin != null && s.durationMin > 0) durationMin += s.durationMin;
    if (s.distanceKm != null && s.distanceKm !== "") {
      const d = Number(s.distanceKm);
      if (Number.isFinite(d) && d > 0) distanceKm += d;
    }
  }
  return { count: sessions.length, durationMin, distanceKm };
}

/**
 * "_cycling" is een intern pseudo-filter dat alle fietsactiviteitstypen dekt.
 * Gebruik dit als waarde voor `typeFilter` wanneer de gebruiker op "Fietsen" drukt.
 */
export const FILTER_CYCLING = "_cycling" as const;

export function filterSessions(
  sessions: TrainingSession[],
  q: string,
  typeFilter: string | null,
  monthFilter: string | null
): TrainingSession[] {
  const needle = q.trim().toLowerCase();
  return sessions.filter((s) => {
    if (typeFilter === FILTER_CYCLING) {
      if (!isCyclingType(s.type)) return false;
    } else if (typeFilter) {
      if (s.type.toLowerCase() !== typeFilter) return false;
    }
    if (monthFilter && monthKey(s.sessionDate) !== monthFilter) return false;
    if (needle) {
      const hay = [s.title ?? "", typeLabel(s.type), sourceLabel(s.source)]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function groupSessionsByMonth(sessions: TrainingSession[]): Array<[string, TrainingSession[]]> {
  const map = new Map<string, TrainingSession[]>();
  for (const s of sessions) {
    const key = monthKey(s.sessionDate);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export function sessionMetricsText(s: TrainingSession): string[] {
  const out: string[] = [];
  if (s.durationMin != null && s.durationMin > 0) out.push(`${s.durationMin} min`);
  if (s.distanceKm != null && s.distanceKm !== "") out.push(`${s.distanceKm} km`);
  const speed = avgSpeed(s);
  if (speed != null) out.push(`${(Math.round(speed * 10) / 10).toLocaleString("nl-NL")} km/u`);
  if (s.elevationM != null && s.elevationM > 0) out.push(`${s.elevationM} hm`);
  if (s.normalizedPower != null && s.normalizedPower > 0) out.push(`${s.normalizedPower} W`);
  else if (s.avgPower != null && s.avgPower > 0) out.push(`${s.avgPower} W`);
  if (s.avgHR != null && s.avgHR > 0) out.push(`${s.avgHR} bpm`);
  if (s.tss != null && s.tss > 0) out.push(`${s.tss} TSS`);
  return out;
}
