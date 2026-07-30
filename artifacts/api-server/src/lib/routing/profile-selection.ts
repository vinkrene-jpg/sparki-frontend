// Automatic routing-profile selection. The athlete NEVER picks a raw ORS
// profile — Sparki derives it from the sport, the bike type (for cycling),
// the training intent, the planned duration/target distance, and the elevation
// preference. Provider-agnostic: returns a `RoutingProfile`, which each provider
// maps to its own internal profile id.

import type { RouteSurface } from "@workspace/db";
import type { RoutingProfile } from "./types";

export const sports = ["cycling", "running", "walking", "hiking"] as const;
export type Sport = (typeof sports)[number];

export const bikeTypes = ["racefiets", "mtb", "gravel"] as const;
export type BikeType = (typeof bikeTypes)[number];

export const elevationPreferences = ["flat", "hilly", "any"] as const;
export type ElevationPreference = (typeof elevationPreferences)[number];

export type ProfileSelectionInput = {
  sport: Sport;
  bikeType?: BikeType | null;
  trainingType?: string | null;
  durationMin?: number | null;
  targetDistanceKm?: number | null;
  elevationPreference?: ElevationPreference | null;
};

// Choose the routing profile. Cycling is driven primarily by the bike type
// (the bike physically constrains the surface); foot sports split walking vs
// hiking/trail by sport and elevation/training intent.
export function selectRoutingProfile(
  input: ProfileSelectionInput,
): RoutingProfile {
  const training = (input.trainingType ?? "").toLowerCase();
  const elevation = input.elevationPreference ?? "any";
  const wantsTrail =
    elevation === "hilly" ||
    /trail|berg|klim|hill|mountain|off.?road|onverhard/.test(training);

  switch (input.sport) {
    case "walking":
      return "foot-walking";
    case "hiking":
      return "foot-hiking";
    case "running":
      // ORS has no dedicated running profile; foot-walking follows the road/
      // pavement network, foot-hiking favours trails for off-road running.
      return wantsTrail ? "foot-hiking" : "foot-walking";
    case "cycling":
    default:
      if (input.bikeType === "racefiets") return "cycling-road";
      if (input.bikeType === "mtb") return "cycling-mountain";
      // Gravel (taak #445): eigen profiel — deelt NIET de harde
      // 0%-onverhard-afkeur van cycling-regular (gewone fiets, taak #441);
      // onverhard wegdek is op gravel juist het doel.
      if (input.bikeType === "gravel") return "cycling-gravel";
      // No bike type given: prefer a mountain profile only when the rider
      // explicitly wants climbing/trails, otherwise a versatile mixed profile.
      return wantsTrail ? "cycling-mountain" : "cycling-regular";
  }
}

// Stored surface preference (lib/db routeSurfaces) for a profile.
export function profileToSurface(profile: RoutingProfile): RouteSurface {
  switch (profile) {
    case "cycling-road":
      return "asfalt";
    case "cycling-mountain":
      return "mtb";
    case "cycling-regular":
      return "mixed";
    case "cycling-gravel":
      return "gravel";
    case "foot-walking":
      return "asfalt";
    case "foot-hiking":
      return "pad";
    case "driving-car":
      // Volgauto rijdt op de openbare weg; alleen relevant voor overlays.
      return "asfalt";
  }
}

// Conservative cruising speed (km/h) per profile, used ONLY to convert a
// workout's target duration into a target distance for a loop request. The
// actual distance always comes back from the provider — this only sizes it.
export function profileCruisingSpeedKmh(profile: RoutingProfile): number {
  switch (profile) {
    case "cycling-road":
      return 30;
    case "cycling-regular":
      return 24;
    case "cycling-gravel":
      // Iets langzamer dan de toerfiets: gemengd/onverhard terrein.
      return 22;
    case "cycling-mountain":
      return 18;
    case "foot-walking":
      return 5;
    case "foot-hiking":
      return 4.5;
    case "driving-car":
      // Conservatief gemiddelde voor een volgauto op gemengde wegen.
      return 45;
  }
}

// Whether a profile belongs to the cycling family (affects avoid_features).
export function isCyclingProfile(profile: RoutingProfile): boolean {
  return profile.startsWith("cycling-");
}

// Human-readable Dutch label for a sport/profile, for rationale + naming.
export function activityLabel(profile: RoutingProfile): string {
  switch (profile) {
    case "cycling-road":
      return "racefiets (asfalt)";
    case "cycling-mountain":
      return "mountainbike (onverhard)";
    case "cycling-regular":
      return "toer-/stadsfiets (verhard)";
    case "cycling-gravel":
      return "gravelfiets (gemengd/onverhard)";
    case "foot-walking":
      return "wandel-/looproute (verhard)";
    case "foot-hiking":
      return "hike-/trailroute (paden)";
    case "driving-car":
      return "volgauto (autoroute)";
  }
}
