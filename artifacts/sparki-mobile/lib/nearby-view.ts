// Pure weergavelogica voor de Ontdek-kaart (taak #561), los van React zodat
// hij met node-tests bewezen kan worden.

import type { LatLon } from "@/lib/geo";

/**
 * Het actieve ontdek-centrum: een gezochte plaats wint ALTIJD van de fysieke
 * GPS-positie, en zonder GPS werkt een gezochte plaats ook — de kaart mag
 * nooit stil op het toestel blijven hangen terwijl de lijst een ander gebied
 * toont.
 */
export function ontdekKaartCenter(
  startpunt: { lat: number; lon: number } | null,
  location: { latitude: number; longitude: number } | null,
): LatLon | null {
  if (startpunt) return { latitude: startpunt.lat, longitude: startpunt.lon };
  if (location) return { latitude: location.latitude, longitude: location.longitude };
  return null;
}

/**
 * Eerlijke tellertekst: als de server afkapt op het payload-plafond tonen we
 * nooit het geleverde aantal alsof het compleet is.
 */
export function nearbyTellerTekst(
  zichtbaar: number,
  meervoud: string,
  opts?: { total?: number; afgekapt?: boolean },
): string {
  if (opts?.afgekapt && typeof opts.total === "number") {
    return `${zichtbaar} van minstens ${opts.total} ${meervoud} (dichtstbijzijnde eerst)`;
  }
  return `${zichtbaar} ${meervoud}`;
}
