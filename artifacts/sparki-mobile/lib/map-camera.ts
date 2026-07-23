// Kaartcamera: volgmodus vs. vrije modus — pure, testbare besliskern.
//
// Volgmodus: de camera volgt de GPS-positie (koers mee, vaste kijkhoek).
// Zodra de renner de kaart HANDMATIG bedient (pannen, pinch-zoom of draaien)
// schakelt de kaart naar vrije modus: geen enkele automatische camerabeweging
// meer, dus geen terugschieten naar de GPS-positie en geen zoom/rotatie-reset.
// Eén knop ("Terug naar mijn positie") herstelt de volgmodus bewust.

export type CameraGesture = "pan" | "pinch" | "rotate";

export type FollowEvent =
  | { type: "gesture"; gesture: CameraGesture }
  | { type: "recenter" }
  | { type: "location" };

/**
 * Volgende volgstatus. Elke handmatige kaartbeweging zet de volgmodus uit;
 * alleen de expliciete "Terug naar mijn positie"-actie zet hem weer aan.
 * Een nieuwe GPS-meting verandert de modus nooit.
 */
export function nextFollowing(following: boolean, event: FollowEvent): boolean {
  if (event.type === "gesture") return false;
  if (event.type === "recenter") return true;
  return following;
}

export type CameraPose = {
  center: { latitude: number; longitude: number };
  heading: number;
  pitch: number;
  zoom: number;
};

export const FOLLOW_PITCH = 45;
export const FOLLOW_ZOOM = 16;

/**
 * Camerapositie voor een GPS-meting. In vrije modus altijd null: de kaart
 * blijft exact waar de gebruiker hem zette (zoom, positie én rotatie).
 * Zonder locatie is er niets om te volgen — ook null, nooit verzonnen.
 */
export function cameraForLocation(
  following: boolean,
  location: { latitude: number; longitude: number; heading: number | null } | null,
): CameraPose | null {
  if (!following || !location) return null;
  return {
    center: { latitude: location.latitude, longitude: location.longitude },
    heading: location.heading ?? 0,
    pitch: FOLLOW_PITCH,
    zoom: FOLLOW_ZOOM,
  };
}
