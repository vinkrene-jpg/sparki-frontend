// Straal-zoeken in de routebibliotheek (correctie René 31-07-2026): bij
// zoeken op plaatsnaam mogen alleen routes verschijnen die daadwerkelijk
// binnen de gevraagde straal rond het gekozen startpunt STARTEN — nooit
// stilzwijgend routes tientallen kilometers verderop. Pure functies, los van
// de router, zodat de regressietest (route-library-straal) ze direct dekt.

export type StraalCentrum = { lat: number; lon: number; radiusKm: number };

// Hemelsbrede afstand in km (haversine, R=6371).
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Parametervalidatie: ongeldig ⇒ null (de route antwoordt dan 400; er is
// géén default-straal en géén stille terugval naar de bbox-vorm).
export function parseStraalCentrum(
  latRaw: unknown,
  lonRaw: unknown,
  radiusRaw: unknown,
): StraalCentrum | null {
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  const radiusKm = Number(radiusRaw);
  if (
    ![lat, lon, radiusKm].every(Number.isFinite) ||
    lat < -60 ||
    lat > 75 ||
    lon < -30 ||
    lon > 45 ||
    radiusKm < 0.5 ||
    radiusKm > 100
  ) {
    return null;
  }
  return { lat, lon, radiusKm };
}

// Ophaal-bbox rond het centrum — bewust RUIMER dan de cirkel (cos-vloer 0,2
// maakt hem alleen maar breder), zodat de exacte haversine-filter hieronder
// nooit routes binnen de straal kan missen.
export function straalOphaalBbox(c: StraalCentrum): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const dLat = c.radiusKm / 111;
  const dLon =
    c.radiusKm / (111 * Math.max(0.2, Math.cos((c.lat * Math.PI) / 180)));
  return {
    minLat: c.lat - dLat,
    maxLat: c.lat + dLat,
    minLon: c.lon - dLon,
    maxLon: c.lon + dLon,
  };
}

// Exacte filter + sortering: alleen routes waarvan de start ≤ radiusKm van
// het centrum ligt, dichtstbijzijnde eerst; afstand op 1 decimaal.
export function filterOpStraal<T extends { startLat: number; startLon: number }>(
  rows: T[],
  c: StraalCentrum,
): Array<T & { startAfstandKm: number }> {
  return rows
    .flatMap((r) => {
      const d = haversineKm(c.lat, c.lon, r.startLat, r.startLon);
      if (d > c.radiusKm) return [];
      return [{ ...r, startAfstandKm: Math.round(d * 10) / 10 }];
    })
    .sort((a, b) => a.startAfstandKm - b.startAfstandKm);
}
