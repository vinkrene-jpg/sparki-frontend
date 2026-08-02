// ROUTE_PAKKET_02b + 02c (GRATIS_A_TOT_Z_01 fase F5) — handhaving van de
// Gratis-limieten, server-side en fail-closed op de handhavingspaden zelf,
// maar nooit blokkerend voor betaald/legacy.
//
// Productregels (besluiten René 30/31-07-2026, GAZ-D):
//  02b — maximaal 8 GEBRUIKTE routes per kalendermaand (fiets en wandelen
//        delen één potje). Plannen, aanpassen en bekijken blijven onbeperkt.
//        Bij 8/8 worden geblokkeerd: opslaan, exporteren (GPX/TCX) en het
//        definitief in gebruik nemen van een NIEUWE route. Een route die deze
//        maand al is geteld, blijft vrij bruikbaar. De melding is eerlijk:
//        eerst wat er aan de hand is, dan het aanbod om te upgraden — geen
//        kunstmatige urgentie.
//  02c — Gratis mag maximaal 3 routes tegelijk bewaard houden; een vierde
//        opslagpoging wordt geweigerd met uitleg en de keuze om een bestaande
//        route te vervangen. Een gratis bewaarde route vervalt na 30 dagen
//        naar een HERSTELBARE vervallen-status en wordt pas 30 dagen later
//        definitief opgeruimd (die definitieve opruiming start in
//        rapporteer-alleen-modus: alleen loggen, niets verwijderen).
import { db, routesTable, routeUsageRegistrationsTable } from "@workspace/db";
import { and, eq, isNull, isNotNull, lt, sql } from "drizzle-orm";
import { resolveEntitlements } from "./entitlements";
import { amsterdamCalendarMonth } from "./route-usage-metering";

export const MAAND_LIMIET = 8;
export const BEWAAR_LIMIET = 3;
export const BEWAARTERMIJN_DAGEN = 30;
export const HERSTELTERMIJN_DAGEN = 30;

const DAG_MS = 24 * 60 * 60 * 1000;

/** Geldt de Gratis-handhaving voor deze gebruiker? Betaalde varianten en de
 * bewuste legacy-carve-out blijven volledig ongelimiteerd. */
export async function isGratisBeperkt(clerkId: string): Promise<boolean> {
  const ent = await resolveEntitlements(clerkId);
  if (ent.entitlementMode === "legacy_unrestricted") return false;
  return ent.productVariant == null;
}

export type LimietBesluit =
  | { allowed: true; savedUntil: Date | null }
  | {
      allowed: false;
      code: "maandlimiet" | "bewaarlimiet";
      status: 409;
      error: string;
      gebruikt?: number;
      limiet: number;
      upgrade: true;
    };

/** Eerlijke melding bij 8/8 (GAZ-D): eerst uitleg, dan het aanbod. */
export function maandlimietMelding(gebruikt: number): string {
  return (
    `Je hebt deze maand ${gebruikt} van de ${MAAND_LIMIET} gratis routes gebruikt. ` +
    `Nieuwe routes opslaan, exporteren of in gebruik nemen kan daardoor pas volgende maand weer. ` +
    `Routes die deze maand al meetellen blijven gewoon bruikbaar, en plannen en bekijken kan altijd. ` +
    `Wil je nu verder? Met Sparki Go vervalt deze limiet.`
  );
}

export function bewaarlimietMelding(): string {
  return (
    `Je hebt al ${BEWAAR_LIMIET} routes bewaard — het maximum in de gratis versie. ` +
    `Vervang een bestaande bewaarde route, of upgrade naar Sparki Go voor onbeperkt bewaren.`
  );
}

/** Hoeveel verschillende routes tellen deze kalendermaand al mee? */
export async function maandGebruik(clerkId: string): Promise<number> {
  const maand = amsterdamCalendarMonth();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(routeUsageRegistrationsTable)
    .where(
      and(
        eq(routeUsageRegistrationsTable.clerkId, clerkId),
        eq(routeUsageRegistrationsTable.calendarMonth, maand),
      ),
    );
  return row?.n ?? 0;
}

/** Is deze route/kandidaat deze maand al geteld (en dus vrij bruikbaar)? */
export async function isAlGeteld(
  clerkId: string,
  identity: { routeId?: number; candidateKey?: string },
): Promise<boolean> {
  const maand = amsterdamCalendarMonth();
  const waar =
    identity.routeId != null
      ? eq(routeUsageRegistrationsTable.routeId, identity.routeId)
      : identity.candidateKey != null
        ? eq(routeUsageRegistrationsTable.candidateKey, identity.candidateKey)
        : null;
  if (!waar) return false;
  const [row] = await db
    .select({ id: routeUsageRegistrationsTable.id })
    .from(routeUsageRegistrationsTable)
    .where(
      and(
        eq(routeUsageRegistrationsTable.clerkId, clerkId),
        eq(routeUsageRegistrationsTable.calendarMonth, maand),
        waar,
      ),
    )
    .limit(1);
  return !!row;
}

/** Aantal nu bewaarde (niet verwijderde, niet vervallen) routes. */
export async function bewaardAantal(clerkId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(routesTable)
    .where(
      and(
        eq(routesTable.clerkId, clerkId),
        isNull(routesTable.deletedAt),
        isNull(routesTable.expiredAt),
      ),
    );
  return row?.n ?? 0;
}

/**
 * 02b — mag deze gebruiker deze route/kandidaat nu gebruiken (opslaan,
 * exporteren, in gebruik nemen)? Al-getelde identiteiten blijven altijd vrij.
 */
export async function checkMaandlimiet(
  clerkId: string,
  identity: { routeId?: number; candidateKey?: string },
): Promise<LimietBesluit> {
  if (!(await isGratisBeperkt(clerkId))) return { allowed: true, savedUntil: null };
  if (await isAlGeteld(clerkId, identity)) return { allowed: true, savedUntil: null };
  const gebruikt = await maandGebruik(clerkId);
  if (gebruikt < MAAND_LIMIET) return { allowed: true, savedUntil: null };
  return {
    allowed: false,
    code: "maandlimiet",
    status: 409,
    error: maandlimietMelding(gebruikt),
    gebruikt,
    limiet: MAAND_LIMIET,
    upgrade: true,
  };
}

/**
 * 02b + 02c samen, voor opslagpaden: eerst maandlimiet, dan bewaarplek.
 * Bij toestemming voor een Gratis-gebruiker komt de 30-dagen-bewaartermijn
 * (`savedUntil`) mee die de aanroeper op de nieuwe rij zet.
 */
export async function checkOpslag(
  clerkId: string,
  identity: { routeId?: number; candidateKey?: string },
): Promise<LimietBesluit> {
  if (!(await isGratisBeperkt(clerkId))) return { allowed: true, savedUntil: null };
  const maand = await checkMaandlimiet(clerkId, identity);
  if (!maand.allowed) return maand;
  const bewaard = await bewaardAantal(clerkId);
  if (bewaard >= BEWAAR_LIMIET) {
    return {
      allowed: false,
      code: "bewaarlimiet",
      status: 409,
      error: bewaarlimietMelding(),
      limiet: BEWAAR_LIMIET,
      upgrade: true,
    };
  }
  return {
    allowed: true,
    savedUntil: new Date(Date.now() + BEWAARTERMIJN_DAGEN * DAG_MS),
  };
}

/**
 * Harde invariant ná een insert (laatste verdedigingslaag tegen races):
 * parallelle opslag-verzoeken kunnen elk dezelfde 2/3-stand zien en samen
 * boven de bewaarlimiet uitkomen. Direct na de insert hertellen we; staat de
 * teller boven de limiet, dan wordt precies de zojuist ingevoegde rij weer
 * verwijderd (soft-delete) en komt er alsnog een eerlijke 409. Betaald/legacy
 * is nooit beperkt en slaat de hertelling over.
 */
export async function bewaarInvariantNaInsert(
  clerkId: string,
  routeId: number,
): Promise<LimietBesluit> {
  if (!(await isGratisBeperkt(clerkId))) return { allowed: true, savedUntil: null };
  const bewaard = await bewaardAantal(clerkId);
  if (bewaard <= BEWAAR_LIMIET) return { allowed: true, savedUntil: null };
  await db
    .update(routesTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(routesTable.id, routeId), eq(routesTable.clerkId, clerkId)));
  return {
    allowed: false,
    code: "bewaarlimiet",
    status: 409,
    error: bewaarlimietMelding(),
    limiet: BEWAAR_LIMIET,
    upgrade: true,
  };
}

type LogLike = {
  info: (obj: unknown, msg: string) => void;
  error: (obj: unknown, msg: string) => void;
};

/**
 * 02c — dagelijkse opruimronde.
 *  Stap 1 (handhavend): routes waarvan de bewaartermijn verstreken is naar de
 *   herstelbare vervallen-status zetten. Alleen rijen met een gezette
 *   `savedUntil` — betaald/legacy en pre-02c-routes (null) blijven onaangeroerd.
 *  Stap 2 (handhavend, vangnet): routes van nu-Gratis gebruikers zonder termijn
 *   krijgen er alsnog één (30 dagen vanaf nu — nooit met terugwerkende kracht,
 *   zodat een downgrade nooit in één klap routes laat vervallen).
 *  Stap 3 (RAPPORTEER-ALLEEN): vervallen routes voorbij de hersteltermijn
 *   alleen loggen; er wordt niets definitief verwijderd tot dat expliciet
 *   wordt vrijgegeven.
 */
export async function runRouteBewaartermijnRonde(log: LogLike): Promise<{
  vervallen: number;
  termijnGezet: number;
  zouVerwijderen: number;
}> {
  const nu = new Date();
  // Stap 1
  const vervallenRows = await db
    .update(routesTable)
    .set({ expiredAt: nu })
    .where(
      and(
        isNull(routesTable.deletedAt),
        isNull(routesTable.expiredAt),
        isNotNull(routesTable.savedUntil),
        lt(routesTable.savedUntil, nu),
      ),
    )
    .returning({ id: routesTable.id, clerkId: routesTable.clerkId });
  // Stap 2 — per eigenaar zonder termijn: alleen als die nú Gratis is.
  let termijnGezet = 0;
  const zonderTermijn = await db
    .selectDistinct({ clerkId: routesTable.clerkId })
    .from(routesTable)
    .where(
      and(
        isNull(routesTable.deletedAt),
        isNull(routesTable.expiredAt),
        isNull(routesTable.savedUntil),
      ),
    );
  for (const { clerkId } of zonderTermijn) {
    try {
      if (!(await isGratisBeperkt(clerkId))) continue;
      const res = await db
        .update(routesTable)
        .set({ savedUntil: new Date(nu.getTime() + BEWAARTERMIJN_DAGEN * DAG_MS) })
        .where(
          and(
            eq(routesTable.clerkId, clerkId),
            isNull(routesTable.deletedAt),
            isNull(routesTable.expiredAt),
            isNull(routesTable.savedUntil),
          ),
        )
        .returning({ id: routesTable.id });
      termijnGezet += res.length;
    } catch (err) {
      log.error({ err, clerkId }, "bewaartermijn zetten faalde voor gebruiker");
    }
  }
  // Stap 3 — rapporteer-alleen
  const herstelGrens = new Date(nu.getTime() - HERSTELTERMIJN_DAGEN * DAG_MS);
  const zouVerwijderen = await db
    .select({ id: routesTable.id, clerkId: routesTable.clerkId, expiredAt: routesTable.expiredAt })
    .from(routesTable)
    .where(
      and(
        isNull(routesTable.deletedAt),
        isNotNull(routesTable.expiredAt),
        lt(routesTable.expiredAt, herstelGrens),
      ),
    );
  if (zouVerwijderen.length > 0) {
    log.info(
      { routes: zouVerwijderen.map((r) => r.id) },
      "route-bewaartermijn RAPPORTEER-ALLEEN: deze vervallen routes zouden definitief verwijderd worden (niet uitgevoerd)",
    );
  }
  log.info(
    { vervallen: vervallenRows.length, termijnGezet, zouVerwijderen: zouVerwijderen.length },
    "route-bewaartermijnronde afgerond",
  );
  return {
    vervallen: vervallenRows.length,
    termijnGezet,
    zouVerwijderen: zouVerwijderen.length,
  };
}
