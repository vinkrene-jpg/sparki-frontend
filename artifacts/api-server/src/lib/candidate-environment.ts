// Gedeelde omgevingsmeting per lus-kandidaat — de basis van de VASTE eis dat
// gegenereerde routes zo min mogelijk door dorpskernen/woonwijken koersen en
// stoplichten/wegobstakels vermijden. Onderbrekende wegobjecten komen uit de
// eigen wegobjecten-database (incl. zelflerende bevestigingen + OSM-corridor-
// sync); bos- en bebouwingsaandeel komen uit één Overpass-meting (6u gecachet).
// Eerlijk null wanneer een bron niet antwoordt — er wordt nooit iets verzonnen.
import type { CandidateEnvironment } from "./routing/loop-quality";
import { getRouteEnvironment } from "./route-insight";
import { getRoadObjectsAlongRoute } from "../engines/road-objects";

// Totaal aantal onderbrekende wegobjecten: verkeerslichten, spoorwegovergangen,
// rotondes en drempels onderbreken allemaal een aaneengesloten trainingsblok.
export function stopObstaclesFrom(counts: Record<string, number>): number {
  return (
    (counts["traffic_signal"] ?? 0) +
    (counts["railway_crossing"] ?? 0) +
    (counts["roundabout"] ?? 0) +
    (counts["speed_bump"] ?? 0)
  );
}

// Tijdbudget-hulp: geeft null zodra het budget op is — een cache-hit of snelle
// bron telt gewoon mee, een trage bron valt eerlijk weg (nooit blokkeren, nooit
// verzinnen). budgetMs null/0 = geen budget (achtergrondpaden meten voluit).
function withBudget<T>(p: Promise<T | null>, budgetMs: number | null): Promise<T | null> {
  if (!budgetMs) return p;
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
  ]);
}

export function candidateEnvironmentOf(
  wantsNature: boolean,
  opts?: {
    // Interactieve paden (gebruiker wacht op de route) MOETEN een kort budget
    // zetten; de rustige-wegen-vergelijking gebruikt dan alleen wat binnen het
    // budget echt gemeten is (cache-hits + eigen DB). Achtergrondpaden
    // (bibliotheek) laten dit weg en meten volledig.
    budgetMs?: number | null;
  },
) {
  const budgetMs = opts?.budgetMs ?? null;
  return async (
    path: [number, number][],
  ): Promise<CandidateEnvironment | null> => {
    const [env, road] = await Promise.all([
      // Bebouwingsaandeel is onderdeel van de vaste rustige-wegen-eis, dus de
      // Overpass-meting draait altijd mee (niet alleen bij een natuurwens).
      withBudget(getRouteEnvironment(path).catch(() => null), budgetMs),
      withBudget(getRoadObjectsAlongRoute(path).catch(() => null), budgetMs),
    ]);
    void wantsNature; // natuurwens beïnvloedt de weging (loop-quality), niet de meting
    if (!env && !road) return null;
    return {
      trafficLights:
        road?.counts["traffic_signal"] ?? env?.trafficLights ?? null,
      forestSharePct: env?.forestSharePct ?? null,
      builtUpSharePct: env?.builtUpSharePct ?? null,
      stopObstacles: road ? stopObstaclesFrom(road.counts) : null,
    };
  };
}
