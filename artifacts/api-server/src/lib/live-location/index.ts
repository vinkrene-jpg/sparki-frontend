// ── Live locatie tijdens navigatie — pure engine (Opdracht 4) ────────────────
// Deterministische regels, geen netwerk. De routes gebruiken deze functies
// voor eerlijke veroudering en server-side autorisatie. Ontbrekende data
// wordt NOOIT vervangen door voorbeeld- of geschatte posities.

// Verouderingsgrenzen (ms).
export const LIVE_MAX_AGE_MS = 20_000; // t/m hier heet de positie "Live"
export const UNAVAILABLE_AFTER_MS = 5 * 60_000; // daarna: geen coördinaten meer tonen
export const DROP_AFTER_MS = 15 * 60_000; // daarna: helemaal niet meer teruggeven
// Sessie zonder verse positie verloopt vanzelf (idle-verval): ook wanneer de
// app niet netjes kon afsluiten (crash, lege batterij) stopt het delen.
export const SESSION_IDLE_EXPIRE_MS = 30 * 60_000;
// Richting is alleen betrouwbaar bij voldoende snelheid.
export const HEADING_MIN_SPEED_MPS = 1.5;

export type AgeStatus =
  | { kind: "live"; label: "Live" }
  | { kind: "verouderd"; label: string }
  | { kind: "niet_beschikbaar"; label: "Locatie niet meer beschikbaar" };

/** Eerlijke leeftijdstatus van een positie-update. */
export function classifyAge(ageMs: number): AgeStatus {
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { kind: "niet_beschikbaar", label: "Locatie niet meer beschikbaar" };
  }
  if (ageMs <= LIVE_MAX_AGE_MS) return { kind: "live", label: "Live" };
  if (ageMs >= UNAVAILABLE_AFTER_MS) {
    return { kind: "niet_beschikbaar", label: "Locatie niet meer beschikbaar" };
  }
  if (ageMs < 60_000) {
    const s = Math.round(ageMs / 1000 / 10) * 10;
    return { kind: "verouderd", label: `${Math.max(30, s)} seconden geleden` };
  }
  const m = Math.floor(ageMs / 60_000);
  return {
    kind: "verouderd",
    label: m === 1 ? "1 minuut geleden" : `${m} minuten geleden`,
  };
}

/** Richting alleen doorgeven wanneer die betrouwbaar is (anders null). */
export function reliableHeading(
  headingDeg: number | null,
  speedMps: number | null,
): number | null {
  if (headingDeg == null || !Number.isFinite(headingDeg)) return null;
  if (speedMps == null || !Number.isFinite(speedMps)) return null;
  if (speedMps < HEADING_MIN_SPEED_MPS) return null;
  const norm = ((headingDeg % 360) + 360) % 360;
  return norm;
}

/** Is de sessie op dit moment nog werkzaam (niet beëindigd, niet idle-verlopen)? */
export function sessionIsLive(
  session: { endedAt: Date | null; startedAt: Date },
  lastPositionAt: Date | null,
  now: Date,
): boolean {
  if (session.endedAt != null) return false;
  const anchor = lastPositionAt ?? session.startedAt;
  return now.getTime() - anchor.getTime() < SESSION_IDLE_EXPIRE_MS;
}

/** Initialen voor de kleine kaartmarker ("Jan Jansen" → "JJ"). */
export function initialsFor(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Positie valideren — ongeldige input wordt geweigerd, nooit "gerepareerd". */
export function validPosition(
  lat: unknown,
  lon: unknown,
): { lat: number; lon: number } | null {
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lon !== "number" || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
