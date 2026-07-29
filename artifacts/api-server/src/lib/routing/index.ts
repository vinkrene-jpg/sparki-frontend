// Routing module entry point. The app imports the active provider through this
// registry only — never a concrete provider directly — so new providers
// (Google, Komoot, Strava, Mapbox, GraphHopper, …) can be registered here
// without changing any route handler or frontend code.

import { GraphHopperProvider } from "./providers/graphhopper";
import { OrsProvider } from "./providers/ors";
import type { RoutingProvider } from "./types";

// Registered providers, keyed by name. Add future providers here.
const providers: Record<string, RoutingProvider> = {
  ors: new OrsProvider(),
  graphhopper: new GraphHopperProvider(),
};

// Register an additional provider programmatically. Used only in tests (and by
// future provider integrations) — never called in production request paths.
// Allows a test to inject a mock provider BEFORE the app boots, so the route
// handler receives it via getRoutingProvider() without any dynamic-import tricks.
export function registerProvider(name: string, provider: RoutingProvider): void {
  providers[name] = provider;
}

const FALLBACK_PROVIDER = "ors";

// Voorkeursvolgorde wanneer geen expliciete keuze is gemaakt: GraphHopper
// (wegdek- en toegangsbewust routeren, PO-01/taak #419) vóór ORS. Een provider
// wordt alleen standaard als zijn sleutel echt is geconfigureerd — nooit een
// provider kiezen die gegarandeerd gaat falen.
const PREFERRED_ORDER = ["graphhopper", "ors"] as const;

// Resolve the active routing provider. `ROUTING_PROVIDER` env var can switch the
// default; otherwise the first *configured* provider in preference order wins.
export function getRoutingProvider(name?: string): RoutingProvider {
  const key = name ?? process.env.ROUTING_PROVIDER;
  if (key && providers[key]) return providers[key]!;
  for (const preferred of PREFERRED_ORDER) {
    const p = providers[preferred];
    if (p?.isConfigured()) return p;
  }
  return providers[FALLBACK_PROVIDER]!;
}

export function bikeSuitabilityConfigError(
  profile: string,
): string | null {
  if (profile !== "cycling-road" && profile !== "cycling-mountain") return null;
  const active = getRoutingProvider();
  if (active.name === "graphhopper") return null;
  const gh = providers.graphhopper;
  if (gh?.isConfigured()) {
    return "Routegeneratie staat verkeerd ingesteld: de fietsgeschiktheids-motor (GraphHopper) is beschikbaar maar niet actief. Dit is een instellingsfout aan onze kant — geen route gemaakt die de racefiets/MTB-belofte niet kan waarmaken.";
  }
  return null;
}

export * from "./types";
export * from "./profile-selection";
export * from "./loop-quality";
