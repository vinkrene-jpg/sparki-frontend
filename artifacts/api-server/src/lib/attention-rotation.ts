// Aandacht-rotatie — centrale motor die voorkomt dat hetzelfde niet-kritieke
// meerijdende bericht (nudge, releasekaart, onderhoudssignaal) dagenlang
// onveranderd op Vandaag blijft staan wanneer de gebruiker er niets mee doet.
//
// Regels (deterministisch en eerlijk):
// - Een item mag SHOW_DAYS verschillende dagen in beeld zijn geweest; daarna
//   pauzeert het en komt het op z'n vroegst PAUSE_DAYS dagen na de laatste
//   vertoning terug (snoozedUntil is exclusief: op die dag mag het weer),
//   zodat een ander bericht (of rust) de ruimte krijgt. Na de pauze mag het
//   gewoon terugkomen zolang de situatie echt nog bestaat — het wordt dus
//   nooit stilletjes voorgoed verzwegen.
// - Alleen presentatie: de onderliggende melding/situatie blijft bestaan en
//   bereikbaar via haar eigen bestemming (bel, Mechanieker, koppelingen).
// - Kritieke berichten doen NIET mee: gezondheids-/veiligheidssignalen en een
//   vastgesteld defect worden nooit als sleutel geaccepteerd of onderdrukt.
// - Dagen zijn Amsterdamse kalenderdagen — nooit UTC (zie local-date-valkuil).

import { and, eq, gt, sql } from "drizzle-orm";
import { db, attentionImpressionsTable } from "@workspace/db";

export const ATTENTION_SHOW_DAYS = 3;
export const ATTENTION_PAUSE_DAYS = 4;

// Alleen deze niet-kritieke families mogen rouleren. "onderhoud:" accepteert
// bewust géén vastgesteld defect (aparte guard hieronder).
const ALLOWED_PREFIXES = ["nudge:", "release:", "onderhoud:"] as const;
const FORBIDDEN_FRAGMENTS = ["vastgesteld_defect", "veiligheid", "privacy"];
const KEY_RE = /^[\p{L}\p{N}:_.\-]{4,160}$/u;

/** YYYY-MM-DD van vandaag in Europe/Amsterdam (en-CA levert ISO-volgorde). */
export function amsterdamToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

/** Kalenderdag-optelling op een YYYY-MM-DD string (12:00 UTC vermijdt DST). */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Alleen sleutels uit toegestane niet-kritieke families zijn geldig. */
export function isValidAttentionKey(key: unknown): key is string {
  if (typeof key !== "string" || !KEY_RE.test(key)) return false;
  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) return false;
  const lower = key.toLowerCase();
  return !FORBIDDEN_FRAGMENTS.some((f) => lower.includes(f));
}

/** Sleutels die vandaag gepauzeerd zijn (snoozedUntil ligt ná vandaag). */
export async function getSuppressedKeys(
  clerkId: string,
  today: string = amsterdamToday(),
): Promise<string[]> {
  const rows = await db
    .select({ itemKey: attentionImpressionsTable.itemKey })
    .from(attentionImpressionsTable)
    .where(
      and(
        eq(attentionImpressionsTable.clerkId, clerkId),
        gt(attentionImpressionsTable.snoozedUntil, today),
      ),
    );
  return rows.map((r) => r.itemKey);
}

/**
 * Registreer dat een item vandaag daadwerkelijk getoond is. Idempotent per
 * Amsterdamse kalenderdag: meerdere bezoeken op één dag tellen als één dag.
 * Zodra een item SHOW_DAYS dagen gezien is, gaat het PAUSE_DAYS dagen in pauze
 * (dagenteller reset zodat het na de pauze weer een verse cyclus krijgt).
 */
export async function recordImpression(
  clerkId: string,
  itemKey: string,
  today: string = amsterdamToday(),
): Promise<void> {
  const inserted = await db
    .insert(attentionImpressionsTable)
    .values({
      clerkId,
      itemKey,
      firstSeenOn: today,
      lastSeenOn: today,
      daysSeen: 1,
    })
    .onConflictDoNothing({
      target: [
        attentionImpressionsTable.clerkId,
        attentionImpressionsTable.itemKey,
      ],
    })
    .returning({ id: attentionImpressionsTable.id });
  if (inserted.length > 0) return;

  // Bestaande rij: alleen tellen als het vandaag nog niet geteld is én het
  // item niet in pauze staat. De hele beslissing zit in één UPDATE zodat twee
  // gelijktijdige aanroepen nooit dubbel tellen.
  const t = attentionImpressionsTable;
  const snoozeUntil = addDays(today, ATTENTION_PAUSE_DAYS);
  await db
    .update(t)
    .set({
      lastSeenOn: today,
      daysSeen: sql`CASE WHEN ${t.daysSeen} + 1 >= ${ATTENTION_SHOW_DAYS} THEN 0 ELSE ${t.daysSeen} + 1 END`,
      snoozedUntil: sql`CASE WHEN ${t.daysSeen} + 1 >= ${ATTENTION_SHOW_DAYS} THEN ${snoozeUntil}::date ELSE ${t.snoozedUntil} END`,
      timesSnoozed: sql`CASE WHEN ${t.daysSeen} + 1 >= ${ATTENTION_SHOW_DAYS} THEN ${t.timesSnoozed} + 1 ELSE ${t.timesSnoozed} END`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(t.clerkId, clerkId),
        eq(t.itemKey, itemKey),
        sql`${t.lastSeenOn} < ${today}::date`,
        sql`(${t.snoozedUntil} IS NULL OR ${t.snoozedUntil} <= ${today}::date)`,
      ),
    );
}
