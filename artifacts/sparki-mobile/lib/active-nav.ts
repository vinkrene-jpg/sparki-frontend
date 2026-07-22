import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RouteDetail } from "@/lib/routes-api";

// Offline-bestendige actieve navigatie.
//
// Bij het openen van een route wordt de echte routedata (lijn + afslagen)
// lokaal bewaard. Valt onderweg het netwerk weg of wordt de app opnieuw
// gestart, dan kan de navigatie doorgaan/hervatten op basis van deze bewaarde
// gegevens — dezelfde data die de backend gaf, nooit iets verzonnen.

const ACTIVE_NAV_KEY = "sparki:active-nav";

export type ActiveNav = {
  routeId: number;
  route: RouteDetail;
  startedAt: number;
};

export async function saveActiveNav(routeId: number, route: RouteDetail): Promise<void> {
  try {
    const existing = await loadActiveNav();
    await AsyncStorage.setItem(
      ACTIVE_NAV_KEY,
      JSON.stringify({
        routeId,
        route,
        // Bewaar het oorspronkelijke startmoment bij een verversing van
        // dezelfde route, zodat "hervatten" eerlijk blijft over wanneer de
        // navigatie begon.
        startedAt:
          existing && existing.routeId === routeId ? existing.startedAt : Date.now(),
      } satisfies ActiveNav),
    );
  } catch {
    // Opslaan mislukt: navigatie werkt gewoon door zolang er netwerk is.
  }
}

export async function loadActiveNav(): Promise<ActiveNav | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_NAV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveNav;
    if (
      !parsed ||
      typeof parsed.routeId !== "number" ||
      !parsed.route ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearActiveNav(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_NAV_KEY);
  } catch {
    // ignore
  }
}
