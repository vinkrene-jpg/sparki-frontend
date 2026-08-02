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
 * Operationele vlag voor de 20%-gereden-trigger. Staat AAN (F5, 02-08-2026):
 * de navigatie meldt bij rit-einde server-side de werkelijk afgelegde fractie
 * van de route (POST /api/routes/:id/gereden-dekking), berekend uit de
 * route-matching tijdens de rit — geen benadering, geen gok. Uitzetten kan
 * operationeel met ROUTE_USAGE_RIDDEN_TRIGGER=false.
 */
export function isRiddenTriggerEnabled(): boolean {
  return process.env.ROUTE_USAGE_RIDDEN_TRIGGER !== "false";
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
 * Serialiseert alle tellingen rond één kandidaat van één gebruiker: een
 * advisory-transactielock (één client, binnen de transactie) sluit de race
 * tussen "voorstel exporteren" en "voorstel opslaan" uit.
 */
function candidateLock(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], clerkId: string, candidateKey: string) {
  return tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`route-usage:${clerkId}:${candidateKey}`}))`,
  );
}

/**
 * Kandidaat → opgeslagen route, race-vrij. Onder de kandidaat-lock:
 *  - bestaat er deze maand een kandidaatregistratie én nog geen
 *    routeregistratie → promoveer de kandidaatrij naar de route-id;
 *  - bestaan beide (route al geteld) → verwijder de kandidaatrij
 *    (normalisatie: nooit twee telbare rijen voor dezelfde route);
 *  - bestaat er geen kandidaatrij → registreer een gewone SAVED-rij.
 * Check-dan-handel is hier veilig: de lock serialiseert alle paden die deze
 * kandidaat aanraken. Fouten worden NIET ingeslikt — de aanroeper gebruikt de
 * Safe-variant die luid logt.
 */
export async function settleCandidateOnSave(opts: {
  clerkId: string;
  candidateKey: string;
  routeId: number;
  source: string;
  occurredAt?: Date;
}): Promise<void> {
  const occurredAt = opts.occurredAt ?? new Date();
  const calendarMonth = amsterdamCalendarMonth(occurredAt);
  await db.transaction(async (tx) => {
    await candidateLock(tx, opts.clerkId, opts.candidateKey);
    const [candRow] = await tx
      .select({ id: routeUsageRegistrationsTable.id })
      .from(routeUsageRegistrationsTable)
      .where(
        and(
          eq(routeUsageRegistrationsTable.clerkId, opts.clerkId),
          eq(routeUsageRegistrationsTable.candidateKey, opts.candidateKey),
          eq(routeUsageRegistrationsTable.calendarMonth, calendarMonth),
        ),
      );
    const [routeRow] = await tx
      .select({ id: routeUsageRegistrationsTable.id })
      .from(routeUsageRegistrationsTable)
      .where(
        and(
          eq(routeUsageRegistrationsTable.clerkId, opts.clerkId),
          eq(routeUsageRegistrationsTable.routeId, opts.routeId),
          eq(routeUsageRegistrationsTable.calendarMonth, calendarMonth),
        ),
      );
    if (candRow && !routeRow) {
      await tx
        .update(routeUsageRegistrationsTable)
        .set({ routeId: opts.routeId, candidateKey: null })
        .where(eq(routeUsageRegistrationsTable.id, candRow.id));
      return;
    }
    if (candRow && routeRow) {
      // Route is deze maand al geteld — de kandidaatrij zou een tweede
      // telbare rij voor dezelfde route zijn. Normaliseer.
      await tx
        .delete(routeUsageRegistrationsTable)
        .where(eq(routeUsageRegistrationsTable.id, candRow.id));
      return;
    }
    if (routeRow) return; // route al geteld, niets te doen
    const ent = await resolveEntitlements(opts.clerkId);
    await tx
      .insert(routeUsageRegistrationsTable)
      .values({
        clerkId: opts.clerkId,
        routeId: opts.routeId,
        candidateKey: null,
        usageType: "SAVED",
        occurredAt,
        calendarMonth,
        subscriptionTier: ent.productVariant ?? ent.entitlementMode ?? "gratis",
        source: opts.source,
        idempotencyKey: `${opts.clerkId}:${opts.routeId}:${calendarMonth}`,
      })
      .onConflictDoNothing({
        target: [
          routeUsageRegistrationsTable.clerkId,
          routeUsageRegistrationsTable.routeId,
          routeUsageRegistrationsTable.calendarMonth,
        ],
        where: sql`route_id IS NOT NULL`,
      });
  });
}

/** Best-effort variant: opslaan mag nooit falen door de telling. */
export async function settleCandidateOnSaveSafe(
  log: LogLike,
  opts: Parameters<typeof settleCandidateOnSave>[0],
): Promise<void> {
  try {
    await settleCandidateOnSave(opts);
  } catch (err) {
    log.error(
      { err, ...opts },
      "route-usage kandidaat-promotie faalde (opslaan zelf is geslaagd)",
    );
  }
}

/**
 * Registreer de export van een (nog) niet opgeslagen voorstel, race-vrij
 * onder dezelfde kandidaat-lock. De keuze kandidaat- vs route-identiteit
 * wordt PAS BINNEN de lock gemaakt via `resolveSavedRouteId` (verse lezing
 * van de kandidatenopslag) — nooit uit een momentopname van vóór de lock.
 * Zo kan een gelijktijdig opslaan nooit tot twee telbare rijen leiden:
 *  - opslaan won de lock eerder → markCandidateSaved is dan al gebeurd en de
 *    verse lezing levert de route-id op → registratie onder de route;
 *  - de export won de lock eerder → kandidaatrij; het opslaan promoveert die
 *    daarna onder dezelfde lock (settleCandidateOnSave).
 */
export async function recordCandidateExportUsage(opts: {
  clerkId: string;
  candidateKey: string;
  /** Verse lezing van de opslag; wordt binnen de lock aangeroepen. */
  resolveSavedRouteId: () => number | null | undefined;
  usageType: RouteUsageType;
  source: string;
  occurredAt?: Date;
}): Promise<void> {
  const occurredAt = opts.occurredAt ?? new Date();
  const calendarMonth = amsterdamCalendarMonth(occurredAt);
  const ent = await resolveEntitlements(opts.clerkId);
  const subscriptionTier =
    ent.productVariant ?? ent.entitlementMode ?? "gratis";
  await db.transaction(async (tx) => {
    await candidateLock(tx, opts.clerkId, opts.candidateKey);
    const savedRouteId = opts.resolveSavedRouteId() ?? null;
    const base = {
      clerkId: opts.clerkId,
      usageType: opts.usageType,
      occurredAt,
      calendarMonth,
      subscriptionTier,
      source: opts.source,
    };
    if (savedRouteId != null) {
      await tx
        .insert(routeUsageRegistrationsTable)
        .values({
          ...base,
          routeId: savedRouteId,
          candidateKey: null,
          idempotencyKey: `${opts.clerkId}:${savedRouteId}:${calendarMonth}`,
        })
        .onConflictDoNothing({
          target: [
            routeUsageRegistrationsTable.clerkId,
            routeUsageRegistrationsTable.routeId,
            routeUsageRegistrationsTable.calendarMonth,
          ],
          where: sql`route_id IS NOT NULL`,
        });
      return;
    }
    await tx
      .insert(routeUsageRegistrationsTable)
      .values({
        ...base,
        routeId: null,
        candidateKey: opts.candidateKey,
        idempotencyKey: `${opts.clerkId}:${opts.candidateKey}:${calendarMonth}`,
      })
      .onConflictDoNothing({
        target: [
          routeUsageRegistrationsTable.clerkId,
          routeUsageRegistrationsTable.candidateKey,
          routeUsageRegistrationsTable.calendarMonth,
        ],
        where: sql`candidate_key IS NOT NULL`,
      });
  });
}

/** Best-effort variant: de export mag nooit falen door de telling. */
export async function recordCandidateExportUsageSafe(
  log: LogLike,
  opts: Parameters<typeof recordCandidateExportUsage>[0],
): Promise<void> {
  try {
    await recordCandidateExportUsage(opts);
  } catch (err) {
    log.error(
      { err, ...opts },
      "route-usage kandidaat-export-telling faalde (export zelf is geslaagd)",
    );
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
