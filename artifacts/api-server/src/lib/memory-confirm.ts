// AI_COACH_KOPPELING_EN_GEHEUGEN_01 §4.1 — Bevestigd geheugen.
//
// Sparki legt een conclusie vóór in plaats van hem stil op te slaan:
//   klopt      → "bevestigd"  — mag een advies dragen
//   klopt niet → "weerlegd"   — verdwijnt én de correctie wordt zelf onthouden
//   weet niet  → "voorlopig"  — mag alleen een vraag dragen
//
// Tempo: maximaal één bevestigingsvraag per dag (Amsterdam-dag), en de vraag
// van vandaag blijft de hele dag DEZELFDE (idempotent — geen tweede conclusie
// naschuiven zodra de eerste beantwoord is).

import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  db,
  aiObservationsTable,
  aiMemoryEventsTable,
  type AiObservation,
} from "@workspace/db";
import { persistObservation, recordMemoryEvent } from "./ai-memory";

const amsterdamDayStart = sql`(now() at time zone 'Europe/Amsterdam')::date`;

export type ConfirmQuestion = {
  observationId: number;
  title: string;
  vraag: string;
  status: string;
  /** Al beantwoord vandaag? Dan toont de client niets nieuws meer. */
  beantwoord: boolean;
};

/**
 * Hoogstens één bevestigingsvraag per dag. Als er vandaag al één getoond is,
 * komt exact diezelfde terug (of `beantwoord: true` als hij al besloten is).
 * Kandidaten: patroon-observaties die nog niet bevestigd/weerlegd zijn.
 */
export async function getConfirmQuestion(clerkId: string): Promise<ConfirmQuestion | null> {
  // Vandaag al een vraag getoond? Dan die teruggeven, nooit een tweede.
  const [vandaagGetoond] = await db
    .select()
    .from(aiMemoryEventsTable)
    .where(
      and(
        eq(aiMemoryEventsTable.clerkId, clerkId),
        eq(aiMemoryEventsTable.eventType, "confirm_question_shown"),
        gte(sql`${aiMemoryEventsTable.createdAt} at time zone 'Europe/Amsterdam'`, amsterdamDayStart),
      ),
    )
    .orderBy(desc(aiMemoryEventsTable.createdAt))
    .limit(1);

  if (vandaagGetoond) {
    if (vandaagGetoond.relatedObservationId == null) return null;
    const [obs] = await db
      .select()
      .from(aiObservationsTable)
      .where(eq(aiObservationsTable.id, vandaagGetoond.relatedObservationId));
    if (!obs) return null;
    return toQuestion(obs, obs.status === "bevestigd" || obs.status === "weerlegd");
  }

  // Nieuwe kandidaat: oudste onbevestigde patroon-conclusie.
  const [kandidaat] = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, clerkId),
        inArray(aiObservationsTable.status, ["new", "acknowledged", "voorlopig"]),
        isNotNull(aiObservationsTable.detectedPattern),
      ),
    )
    .orderBy(aiObservationsTable.createdAt)
    .limit(1);
  if (!kandidaat) return null;

  await recordMemoryEvent(clerkId, "confirm_question_shown", kandidaat.id, {
    status: kandidaat.status,
  });
  return toQuestion(kandidaat, false);
}

function toQuestion(obs: AiObservation, beantwoord: boolean): ConfirmQuestion {
  return {
    observationId: obs.id,
    title: obs.title,
    vraag: `Ik zie dit patroon: ${obs.detectedPattern ?? obs.observationText}. Klopt dat?`,
    status: obs.status,
    beantwoord,
  };
}

export type ConfirmAnswer = "klopt" | "klopt_niet" | "weet_niet";

export async function answerConfirmQuestion(
  clerkId: string,
  observationId: number,
  antwoord: ConfirmAnswer,
): Promise<{ status: string } | null> {
  const [obs] = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(eq(aiObservationsTable.id, observationId), eq(aiObservationsTable.clerkId, clerkId)),
    );
  if (!obs) return null;

  if (antwoord === "klopt") {
    await db
      .update(aiObservationsTable)
      .set({ status: "bevestigd", updatedAt: new Date() })
      .where(eq(aiObservationsTable.id, obs.id));
    await recordMemoryEvent(clerkId, "observation_confirmed", obs.id, null);
    return { status: "bevestigd" };
  }

  if (antwoord === "klopt_niet") {
    // Weerlegd: de herinnering verdwijnt uit elk advies, en de correctie
    // wordt zelf onthouden zodat dezelfde conclusie niet over drie weken
    // terugkomt. De weerlegde rij houdt zijn dedupeKey — persistObservation
    // slaat een nieuwe identieke conclusie daardoor over (afkoelmechanisme).
    await db
      .update(aiObservationsTable)
      .set({ status: "weerlegd", updatedAt: new Date() })
      .where(eq(aiObservationsTable.id, obs.id));
    await recordMemoryEvent(clerkId, "observation_refuted", obs.id, null);
    await persistObservation({
      clerkId,
      sourceType: "manual_note",
      title: `Correctie van de sporter: "${obs.title}" klopt niet`,
      summary: null,
      observationText: `De sporter heeft de conclusie "${obs.detectedPattern ?? obs.observationText}" weerlegd. Trek deze conclusie niet opnieuw zonder nieuw, sterker bewijs.`,
      category: "general",
      severity: "info",
      confidence: "high",
      detectedPattern: null,
      recommendedAction: null,
      dedupeKey: `correctie:${obs.dedupeKey ?? obs.id}`,
    });
    return { status: "weerlegd" };
  }

  // weet_niet → voorlopig: mag geen directief advies dragen, wel een vraag.
  await db
    .update(aiObservationsTable)
    .set({ status: "voorlopig", updatedAt: new Date() })
    .where(eq(aiObservationsTable.id, obs.id));
  return { status: "voorlopig" };
}
