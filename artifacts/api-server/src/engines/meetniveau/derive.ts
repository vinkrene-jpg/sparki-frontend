// Meetniveau-engine — waarnemingslaag (DB/IO).
//
// Leest de laatste 10 activiteiten en de laatste 7 dagen herstelmetingen,
// berekent de actieve sporen (compute.ts) en bewaakt de wegval-melding:
// valt een spoor weg t.o.v. de laatst bewaarde waarneming, dan volgt PRECIES
// ÉÉN melding (datapoort-toon, nooit "upgraden"); komt het terug, dan groeit
// het niveau stil weer mee — zonder melding (§3.2).

import { and, desc, eq, gte, isNotNull, or, sql } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  athleteProfilesTable,
} from "@workspace/db";
import { deriveSessionSignals } from "../../lib/measurement-level";
import { createNotification, resolveNotifications } from "../../lib/notifications";
import { logger } from "../../lib/logger";
import {
  computeSporen,
  profielregel,
  wegvalMelding,
  type SpoorNaam,
} from "./compute";
import type { ObservedSporen, SpoorWaarneming } from "./types";

/** Waarnemen zonder bijwerkingen: alleen kijken wat er feitelijk binnenkomt. */
export async function observeSporen(clerkId: string): Promise<SpoorWaarneming> {
  const [sessies, herstelRows] = await Promise.all([
    db
      .select({
        signals: trainingSessionsTable.signals,
        avgPower: trainingSessionsTable.avgPower,
        normalizedPower: trainingSessionsTable.normalizedPower,
        avgHR: trainingSessionsTable.avgHR,
        durationMin: trainingSessionsTable.durationMin,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId))
      .orderBy(desc(trainingSessionsTable.sessionDate), desc(trainingSessionsTable.id))
      .limit(10),
    db
      .select({ dagen: sql<number>`count(distinct ${athleteDailyMetricsTable.metricDate})` })
      .from(athleteDailyMetricsTable)
      .where(
        and(
          eq(athleteDailyMetricsTable.clerkId, clerkId),
          gte(
            athleteDailyMetricsTable.metricDate,
            sql`(now() at time zone 'Europe/Amsterdam')::date - interval '6 days'`,
          ),
          or(
            isNotNull(athleteDailyMetricsTable.restingHR),
            isNotNull(athleteDailyMetricsTable.hrv),
          ),
        ),
      ),
  ]);

  const signalen = sessies.map((s) =>
    // Rijen van vóór F2 hebben signals=null — dan eerlijk afleiden uit de
    // aanwezige velden op de rij zelf (zelfde regels als het ingest-moment).
    s.signals ?? deriveSessionSignals(s),
  );
  const hersteldagen = Number(herstelRows[0]?.dagen ?? 0);
  return computeSporen(signalen, hersteldagen);
}

export type MeetniveauResultaat = {
  waarneming: SpoorWaarneming;
  profielregel: string;
};

/**
 * Waarnemen + levend bijhouden: vergelijkt met de laatst bewaarde waarneming,
 * meldt een weggevallen spoor precies één keer en bewaart de nieuwe stand.
 * Terug-groeien gebeurt stil. Aan te roepen na ingest én bij uitlezen.
 */
export async function refreshMeetniveau(
  clerkId: string,
): Promise<MeetniveauResultaat> {
  const waarneming = await observeSporen(clerkId);
  const regel = profielregel(waarneming);

  try {
    // Serieel per gebruiker: gelijktijdige refreshes (ingest + uitlezen) mogen
    // dezelfde transitie niet allebei claimen. FOR UPDATE op de profielrij
    // laat precies één schrijver de episode zien; de rest wacht en vergelijkt
    // daarna tegen de al bijgewerkte stand.
    await db.transaction(async (tx) => {
    const [prof] = await tx
      .select({ observed: athleteProfilesTable.observedSporen })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1)
      .for("update");
    if (!prof) return;

    const vorige = prof.observed;
    const nieuwe: ObservedSporen = {
      v: waarneming.vermogen,
      h: waarneming.hartslag,
      r: waarneming.herstel,
      sinds: new Date().toISOString(),
    };

    const veranderd =
      !vorige ||
      vorige.v !== nieuwe.v ||
      vorige.h !== nieuwe.h ||
      vorige.r !== nieuwe.r;

    if (veranderd) {
      // Eerst de stand bewaren, dan melden: de transitie (true→false) is de
      // enige trigger, dus per wegval-episode ontstaat hoogstens één melding.
      await tx
        .update(athleteProfilesTable)
        .set({ observedSporen: nieuwe, updatedAt: new Date() })
        .where(eq(athleteProfilesTable.clerkId, clerkId));

      if (vorige) {
        // Terug-groeien is stil, maar de openstaande wegval-melding moet wél
        // afgesloten worden — anders blokkeert de open resolutionKey een
        // melding bij een LATERE wegval-episode van hetzelfde spoor.
        // (Meldingen lopen buiten deze tx, maar de rijvergrendeling hierboven
        // garandeert dat maar één schrijver deze transitie überhaupt ziet.)
        const terug: SpoorNaam[] = [];
        if (!vorige.v && nieuwe.v) terug.push("vermogen");
        if (!vorige.h && nieuwe.h) terug.push("hartslag");
        if (!vorige.r && nieuwe.r) terug.push("herstel");
        for (const spoor of terug) {
          await resolveNotifications(clerkId, `meetniveau_wegval_${spoor}`);
        }

        // Elk spoor is een eigen sensor-waarneming (ritsensoren vs draagbare),
        // dus elk weggevallen spoor krijgt zijn eigen datamelding.
        const weggevallen: SpoorNaam[] = [];
        if (vorige.v && !nieuwe.v) weggevallen.push("vermogen");
        if (vorige.h && !nieuwe.h) weggevallen.push("hartslag");
        if (vorige.r && !nieuwe.r) weggevallen.push("herstel");

        for (const spoor of weggevallen) {
          const { title, body } = wegvalMelding(spoor);
          await createNotification({
            clerkId,
            type: "system",
            category: "sync",
            title,
            body,
            source: "meetniveau",
            // Nieuwe episode ⇒ nieuwe sleutel (exact tijdstip van de wegval);
            // binnen een episode bewaakt de open resolutionKey de dedupe.
            dedupeKey: `meetniveau_wegval_${spoor}_${nieuwe.sinds}`,
            resolutionKey: `meetniveau_wegval_${spoor}`,
          });
        }
      }
    }
    });
  } catch (err) {
    // Waarneming blijft bruikbaar ook als de bijhoud-stap faalt.
    logger.error({ err, clerkId }, "meetniveau.refresh failed");
  }

  return { waarneming, profielregel: regel };
}
