// Routing module entry point. The app imports the active provider through this
// registry only — never a concrete provider directly — so new providers
// (Google, Komoot, Strava, Mapbox, GraphHopper, …) can be registered here
// without changing any route handler or frontend code.

import { OrsProvider } from "./providers/ors";
import type { RoutingProvider } from "./types";

// Registered providers, keyed by name. Add future providers here.
const providers: Record<string, RoutingProvider> = {
  ors: new OrsProvider(),
};

const DEFAULT_PROVIDER = "ors";

// Resolve the active routing provider. `ROUTING_PROVIDER` env var can switch the
// default once more providers exist; falls back to ORS.
export function getRoutingProvider(name?: string): RoutingProvider {
  const key = name ?? process.env.ROUTING_PROVIDER ?? DEFAULT_PROVIDER;
  return providers[key] ?? providers[DEFAULT_PROVIDER]!;
}

export * from "./types";
export * from "./profile-selection";
