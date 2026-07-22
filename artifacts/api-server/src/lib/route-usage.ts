// Golf 19 — versiegebruik van routes vastleggen. Trainingen, wedstrijden,
// activiteiten en navigatiesessies leggen idempotent vast WELKE versie van een
// route zij gebruikten (route_version_usages, unique op route+context+
// contextId). De rij snapshot de routenaam zodat historie leesbaar blijft, ook
// wanneer de route later wordt verwijderd (routeId wordt dan null).
import { db, routeVersionUsagesTable } from "@workspace/db";

export type RouteUsageContext =
  | "training"
  | "wedstrijd"
  | "activiteit"
  | "navigatie";

export async function registerRouteUsage(
  route: { id: number; name: string; version: number },
  context: RouteUsageContext,
  contextId: number,
  clerkId: string,
): Promise<void> {
  await db
    .insert(routeVersionUsagesTable)
    .values({
      routeId: route.id,
      routeName: route.name,
      version: route.version,
      context,
      contextId,
      clerkId,
    })
    .onConflictDoNothing();
}
