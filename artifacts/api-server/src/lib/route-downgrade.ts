// ── ABONNEMENT_01 §1.3 — downgrade van routes: keuzeflow "drie actieve" ──────
// Vastgesteld besluit: bij een downgrade naar Gratis blijven ALLE routes
// zichtbaar en herstelbaar; er verdwijnt niets automatisch. De gebruiker
// kiest maximaal drie routes als "actief". Hier zit alleen de keuzeflow en
// de toestandsbepaling; de opslaglimiet, vervaltermijn en opruimtaak horen
// in ROUTE_PAKKET_02c en bouwen op route_active_selections.
//
// Bewerken van routes is al Sparki Go-gepoort (route_library_manage), dus de
// "alleen-lezen" toestand op Gratis bestaat server-side al; deze laag legt de
// keuze vast en vertelt de UI eerlijk waar de gebruiker staat.

import { eq, and, isNull, inArray } from "drizzle-orm";
import { db, routesTable, routeActiveSelectionsTable } from "@workspace/db";
import { getBillingState } from "./billing";

export const ACTIVE_ROUTE_LIMIT = 3;

export interface RouteDowngradeState {
  // Alleen van toepassing na een echte downgrade: subscription-modus, ooit een
  // betaald pad (Stripe-abonnement of verlopen proef), nu effectief Gratis.
  vanToepassing: boolean;
  limiet: number;
  totaalRoutes: number;
  gekozenRouteIds: number[];
  // true zolang er méér routes zijn dan de limiet en er nog geen geldige
  // keuze is gemaakt.
  keuzeVereist: boolean;
}

export async function getRouteDowngradeState(
  clerkId: string,
): Promise<RouteDowngradeState> {
  const state = await getBillingState(clerkId);
  const effectiefGratis =
    state.status !== "legacy_unrestricted" &&
    state.status !== "active" &&
    state.status !== "grace" &&
    state.status !== "canceled" && // canceled behoudt toegang tot periode-einde
    state.status !== "trialing";
  const ooitBetaaldPad =
    state.hasStripeSubscription || state.status === "expired" || state.status === "blocked";
  const vanToepassing = effectiefGratis && ooitBetaaldPad;

  const routes = await db
    .select({ id: routesTable.id })
    .from(routesTable)
    .where(and(eq(routesTable.clerkId, clerkId), isNull(routesTable.deletedAt)));
  const gekozen = await db
    .select({ routeId: routeActiveSelectionsTable.routeId })
    .from(routeActiveSelectionsTable)
    .where(eq(routeActiveSelectionsTable.clerkId, clerkId));
  // Alleen keuzes die nog naar een bestaande, niet-verwijderde route wijzen.
  const routeIds = new Set(routes.map((r) => r.id));
  const gekozenRouteIds = gekozen
    .map((g) => g.routeId)
    .filter((id) => routeIds.has(id));

  return {
    vanToepassing,
    limiet: ACTIVE_ROUTE_LIMIT,
    totaalRoutes: routes.length,
    gekozenRouteIds,
    keuzeVereist:
      vanToepassing &&
      routes.length > ACTIVE_ROUTE_LIMIT &&
      (gekozenRouteIds.length === 0 || gekozenRouteIds.length > ACTIVE_ROUTE_LIMIT),
  };
}

/**
 * Vervang de actieve-routekeuze in één transactie. Eist eigendom van elke
 * route; nooit meer dan de limiet. Geeft de nieuwe keuze terug.
 */
export async function setActiveRouteSelection(
  clerkId: string,
  routeIds: number[],
): Promise<
  | { ok: true; gekozenRouteIds: number[] }
  | { ok: false; fout: "te_veel" | "niet_van_jou" }
> {
  const uniek = [...new Set(routeIds)];
  if (uniek.length > ACTIVE_ROUTE_LIMIT) return { ok: false, fout: "te_veel" };
  if (uniek.length > 0) {
    const eigen = await db
      .select({ id: routesTable.id })
      .from(routesTable)
      .where(
        and(
          eq(routesTable.clerkId, clerkId),
          inArray(routesTable.id, uniek),
          isNull(routesTable.deletedAt),
        ),
      );
    if (eigen.length !== uniek.length) return { ok: false, fout: "niet_van_jou" };
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(routeActiveSelectionsTable)
      .where(eq(routeActiveSelectionsTable.clerkId, clerkId));
    if (uniek.length > 0) {
      await tx
        .insert(routeActiveSelectionsTable)
        .values(uniek.map((routeId) => ({ clerkId, routeId })));
    }
  });
  return { ok: true, gekozenRouteIds: uniek };
}
