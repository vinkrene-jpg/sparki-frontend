// ── Vrienden live op de kaart — pure clientlogica (Opdracht 4) ───────────────
// Deterministisch en testbaar zonder React Native. Regels:
// - Nooit een positie verzinnen of doortrekken: zonder verse data toont de
//   marker de laatst ONTVANGEN positie met een eerlijke veroudering, en na de
//   servergrens helemaal niets meer.
// - Updatefrequentie past zich aan (batterij, snelheid, scherm, netwerk) —
//   bij netwerkverlies wordt NIET verstuurd (geen wachtrij met oude punten).

export type FriendPosition = {
  clerkId: string;
  name: string;
  initials: string;
  lat: number | null;
  lon: number | null;
  headingDeg: number | null;
  ageSec: number | null;
  status: string;
  statusKind: "live" | "verouderd" | "niet_beschikbaar";
};

// ── Adaptieve updatefrequentie ───────────────────────────────────────────────
export type UpdateContext = {
  /** Huidige snelheid in m/s (null = onbekend). */
  speedMps: number | null;
  /** Staat het scherm aan (navigatie zichtbaar)? */
  screenOn: boolean;
  /** Batterijspaarstand of laag (<20%)? */
  batteryLow: boolean;
  /** Is er netwerk? */
  online: boolean;
};

export const BASE_INTERVAL_MS = 10_000;
export const STATIONARY_INTERVAL_MS = 30_000;
export const SCREEN_OFF_INTERVAL_MS = 20_000;
export const BATTERY_LOW_INTERVAL_MS = 30_000;
export const MOVING_SPEED_MPS = 1.0;

/**
 * Bepaal het verzendinterval in ms, of null wanneer er nu NIET verzonden
 * mag worden (offline). Traagste toepasselijke regel wint — nooit sneller
 * zenden dan de zuinigste voorwaarde toestaat.
 */
export function decideUpdateIntervalMs(ctx: UpdateContext): number | null {
  if (!ctx.online) return null; // eerlijk: niets sturen, geen oude wachtrij
  let interval = BASE_INTERVAL_MS;
  const moving = ctx.speedMps != null && ctx.speedMps >= MOVING_SPEED_MPS;
  if (!moving) interval = Math.max(interval, STATIONARY_INTERVAL_MS);
  if (!ctx.screenOn) interval = Math.max(interval, SCREEN_OFF_INTERVAL_MS);
  if (ctx.batteryLow) interval = Math.max(interval, BATTERY_LOW_INTERVAL_MS);
  return interval;
}

// ── Clustering van vriendmarkers ─────────────────────────────────────────────
export type FriendCluster = {
  lat: number;
  lon: number;
  members: FriendPosition[];
};

const EARTH_M_PER_DEG_LAT = 111_320;

function approxDistanceM(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = (aLat - bLat) * EARTH_M_PER_DEG_LAT;
  const dLon =
    (aLon - bLon) * EARTH_M_PER_DEG_LAT * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

/**
 * Greedy afstandsclustering: vrienden binnen `thresholdM` van elkaar worden
 * één cluster met het gemiddelde als ankerpunt. Vrienden zonder coördinaten
 * (status "niet beschikbaar") komen NIET op de kaart.
 */
export function clusterFriendMarkers(
  friends: FriendPosition[],
  thresholdM = 60,
): FriendCluster[] {
  const placed: FriendCluster[] = [];
  for (const f of friends) {
    if (f.lat == null || f.lon == null) continue;
    const near = placed.find(
      (c) => approxDistanceM(c.lat, c.lon, f.lat!, f.lon!) <= thresholdM,
    );
    if (near) {
      near.members.push(f);
      near.lat =
        near.members.reduce((s, m) => s + (m.lat ?? 0), 0) / near.members.length;
      near.lon =
        near.members.reduce((s, m) => s + (m.lon ?? 0), 0) / near.members.length;
    } else {
      placed.push({ lat: f.lat, lon: f.lon, members: [f] });
    }
  }
  return placed;
}

// ── Weergaveregels ───────────────────────────────────────────────────────────
/**
 * Bij netwerkverlies aan de KIJKKANT: behoud de laatst ontvangen lijst maar
 * herbereken de veroudering lokaal — nooit "Live" blijven tonen op oude data.
 */
export function ageFriendsLocally(
  friends: FriendPosition[],
  msSinceFetch: number,
): FriendPosition[] {
  if (msSinceFetch <= 0) return friends;
  return friends.map((f) => {
    if (f.ageSec == null) return f;
    const ageSec = f.ageSec + Math.round(msSinceFetch / 1000);
    const ageMs = ageSec * 1000;
    if (ageMs >= 5 * 60_000) {
      return {
        ...f,
        ageSec,
        lat: null,
        lon: null,
        headingDeg: null,
        statusKind: "niet_beschikbaar",
        status: "Locatie niet meer beschikbaar",
      };
    }
    if (ageMs <= 20_000) return { ...f, ageSec };
    const label =
      ageMs < 60_000
        ? `${Math.max(30, Math.round(ageSec / 10) * 10)} seconden geleden`
        : `${Math.floor(ageSec / 60)} ${Math.floor(ageSec / 60) === 1 ? "minuut" : "minuten"} geleden`;
    return { ...f, ageSec, statusKind: "verouderd", status: label };
  });
}
