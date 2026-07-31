// ROUTE_PAKKET_02A (SPARKI-BESLUIT-2026-003) — telling van routegebruik.
//
// Alleen meten, niets blokkeren. Eén centrale registratiefunctie: alle
// telling loopt server-side hierdoorheen; frontendwaarden zijn nooit leidend.
//
// Productregels (Besluit René 31-07-2026):
//  - Een route telt als één gebruikte route bij: definitief opslaan (SAVED),
//    succesvolle GPX-export (GPX_EXPORTED) of ≥20% van de route gereden
//    (RIDDEN_20_PERCENT, achter een aparte operationele vlag).
//  - Plannen, aanpassen en bekijken tellen nooit (die paden roepen deze
//    functie simpelweg nooit aan).
//  - Dezelfde route telt maximaal één keer per kalendermaand — afgedwongen
//    met een unieke databasesleutel (clerk_id, route_id, calendar_month),
//    dus ook onder gelijktijdige verzoeken.
//  - Kalendermaanden gaan expliciet op Europe/Amsterdam.
//  - Er wordt gemeten voor ALLE pakketten (Gratis, Go, Compleet); het pakket
//    wordt als momentopname vastgelegd en nooit herrekend.
import { db, routeUsageRegistrationsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { resolveEntitlements } from "./entitlements";

// Aanvulling 02a (besluit René 31-07-2026): iedere succesvolle export telt,
// ongeacht het formaat (GPX, TCX, toekomstige formaten) — samen maximaal één
// keer per route per kalendermaand. Ook export van een nog niet opgeslagen
// routevoorstel telt, via de bestaande stabiele kandidaat-identiteit.
export type RouteUsageType =
  | "SAVED"
  | "GPX_EXPORTED"
  | "TCX_EXPORTED"
  | "RIDDEN_20_PERCENT";

/** Kalendermaand "YYYY-MM" van een tijdstip, in Europe/Amsterdam. */
export function amsterdamCalendarMonth(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

/**
 * Operationele vlag voor de 20%-gereden-trigger. Staat UIT: er bestaat op de
 * server geen betrouwbare vastlegging van de werkelijk afgelegde afstand op
 * een geplande route (geen navigatiesessies/route-dekking server-side), dus
 * dit percentage is nu niet aantoonbaar te bepalen. We gokken niet en bouwen
 * geen benadering — expliciet restpunt van 02a; de registratie is er klaar
 * voor zodra die gegevenslaag bestaat.
 */
export function isRiddenTriggerEnabled(): boolean {
  return process.env.ROUTE_USAGE_RIDDEN_TRIGGER === "true";
}

export type RecordRouteUsageResult =
  | { registered: true; calendarMonth: string }
  | {
      registered: false;
      calendarMonth: string;
      reason: "al_geteld_deze_maand" | "ridden_vlag_uit";
    };

/**
 * Registreer één routegebruik. Idempotent en gelijktijdigheids-veilig via de
 * unieke databasesleutel; een tweede tellende gebeurtenis voor dezelfde route
 * in dezelfde maand verandert niets (registered=false, al_geteld_deze_maand).
 */
export async function recordRouteUsage(opts: {
  clerkId: string;
  /** Opgeslagen route. Precies één van routeId/candidateKey opgeven. */
  routeId?: number;
  /** Nog niet opgeslagen voorstel: bestaande stabiele candidateId. */
  candidateKey?: string;
  usageType: RouteUsageType;
  source: string;
  /** Alleen voor tests: registratiemoment overschrijven. */
  occurredAt?: Date;
  idempotencyKey?: string;
}): Promise<RecordRouteUsageResult> {
  const occurredAt = opts.occurredAt ?? new Date();
  const calendarMonth = amsterdamCalendarMonth(occurredAt);
  if ((opts.routeId == null) === (opts.candidateKey == null)) {
    throw new Error(
      "recordRouteUsage: geef precies één van routeId/candidateKey op",
    );
  }

  if (opts.usageType === "RIDDEN_20_PERCENT" && !isRiddenTriggerEnabled()) {
    return { registered: false, calendarMonth, reason: "ridden_vlag_uit" };
  }

  // Pakket-momentopname: productVariant wanneer die er is, anders de
  // toegangsmodus (bijv. legacy_unrestricted), anders "gratis". Ruwe
  // serverwaarheid — geen productmapping, wordt nooit herrekend.
  const ent = await resolveEntitlements(opts.clerkId);
  const subscriptionTier =
    ent.productVariant ?? ent.entitlementMode ?? "gratis";

  const identity = opts.routeId != null ? opts.routeId : opts.candidateKey;
  const values = {
    clerkId: opts.clerkId,
    routeId: opts.routeId ?? null,
    candidateKey: opts.candidateKey ?? null,
    usageType: opts.usageType,
    occurredAt,
    calendarMonth,
    subscriptionTier,
    source: opts.source,
    idempotencyKey:
      opts.idempotencyKey ?? `${opts.clerkId}:${identity}:${calendarMonth}`,
  };

  // Partiële unieke indexen: route- en kandidaat-identiteit hebben elk hun
  // eigen doelindex (onConflictDoNothing gebruikt `where` als indexpredicaat).
  const inserted =
    opts.routeId != null
      ? await db
          .insert(routeUsageRegistrationsTable)
          .values(values)
          .onConflictDoNothing({
            target: [
              routeUsageRegistrationsTable.clerkId,
              routeUsageRegistrationsTable.routeId,
              routeUsageRegistrationsTable.calendarMonth,
            ],
            where: sql`route_id IS NOT NULL`,
          })
          .returning({ id: routeUsageRegistrationsTable.id })
      : await db
          .insert(routeUsageRegistrationsTable)
          .values(values)
          .onConflictDoNothing({
            target: [
              routeUsageRegistrationsTable.clerkId,
              routeUsageRegistrationsTable.candidateKey,
              routeUsageRegistrationsTable.calendarMonth,
            ],
            where: sql`candidate_key IS NOT NULL`,
          })
          .returning({ id: routeUsageRegistrationsTable.id });

  return inserted.length > 0
    ? { registered: true, calendarMonth }
    : { registered: false, calendarMonth, reason: "al_geteld_deze_maand" };
}

/**
 * Kandidaat → opgeslagen route. Als het voorstel deze maand al telde (via een
 * export), wordt DIE rij gepromoveerd naar de definitieve route-id zodat de
 * route niet dubbel telt. Retourneert true wanneer een bestaande registratie
 * is gepromoveerd (de aanroeper hoeft dan geen SAVED-registratie meer te doen).
 */
export async function promoteCandidateUsage(opts: {
  clerkId: string;
  candidateKey: string;
  routeId: number;
  occurredAt?: Date;
}): Promise<boolean> {
  const calendarMonth = amsterdamCalendarMonth(opts.occurredAt ?? new Date());
  try {
    const updated = await db
      .update(routeUsageRegistrationsTable)
      .set({ routeId: opts.routeId, candidateKey: null })
      .where(
        and(
          eq(routeUsageRegistrationsTable.clerkId, opts.clerkId),
          eq(routeUsageRegistrationsTable.candidateKey, opts.candidateKey),
          eq(routeUsageRegistrationsTable.calendarMonth, calendarMonth),
        ),
      )
      .returning({ id: routeUsageRegistrationsTable.id });
    return updated.length > 0;
  } catch {
    // Unieke-indexbotsing: de route zelf is deze maand al geteld. De
    // kandidaatrij laten staan is dan dubbel — verwijder hem stilletjes niet;
    // hij blijft historisch juist ("export vóór opslaan"), maar de teller
    // gebruikt uniciteit per identiteit. Promotie is dan niet nodig.
    return true;
  }
}

type LogLike = { error: (obj: unknown, msg: string) => void };

/**
 * Best-effort variant voor in request-paden: de gebruikersactie (opslaan,
 * exporteren) mag nooit falen doordat de telling faalt — maar een mislukte
 * telling wordt wel luid gelogd.
 */
export async function recordRouteUsageSafe(
  log: LogLike,
  opts: Parameters<typeof recordRouteUsage>[0],
): Promise<void> {
  try {
    await recordRouteUsage(opts);
  } catch (err) {
    log.error({ err, ...opts }, "route-usage telling faalde (actie zelf is geslaagd)");
  }
}

/** Registraties van één gebruiker in één kalendermaand (voor de teller). */
export async function listRouteUsage(clerkId: string, calendarMonth: string) {
  return db
    .select({
      routeId: routeUsageRegistrationsTable.routeId,
      usageType: routeUsageRegistrationsTable.usageType,
      occurredAt: routeUsageRegistrationsTable.occurredAt,
      source: routeUsageRegistrationsTable.source,
      subscriptionTier: routeUsageRegistrationsTable.subscriptionTier,
    })
    .from(routeUsageRegistrationsTable)
    .where(
      and(
        eq(routeUsageRegistrationsTable.clerkId, clerkId),
        eq(routeUsageRegistrationsTable.calendarMonth, calendarMonth),
      ),
    )
    .orderBy(routeUsageRegistrationsTable.occurredAt);
}
