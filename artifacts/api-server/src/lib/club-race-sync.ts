// BUILD_03 (besluitenpatch hoofdstuk D — Structuur): "één wedstrijd voor
// iedereen". Een clubwedstrijd verschijnt via deze sync meteen in de eigen
// wedstrijdomgeving (races) van de geselecteerde renner/reserve, en verdwijnt
// daar weer wanneer de selectie vervalt — mits de rij door de sync is
// aangemaakt (clubEventId gevuld). Handmatige races worden nooit aangeraakt.

import { db, racesTable, clubRaceEventsTable } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";

type ClubEvent = typeof clubRaceEventsTable.$inferSelect;

// Renner of reserve geselecteerd ⇒ persoonlijke wedstrijd aanmaken/bijwerken.
// Idempotent via de unieke sleutel (clerk_id, club_event_id).
export async function syncPersonalRaceForSelection(
  event: ClubEvent,
  clerkId: string,
  selectionRole: string,
): Promise<void> {
  if (selectionRole !== "renner" && selectionRole !== "reserve") {
    // Begeleiders krijgen geen persoonlijke wedstrijd.
    await removePersonalRaceForSelection(event.id, clerkId);
    return;
  }
  await db
    .insert(racesTable)
    .values({
      clerkId,
      name: event.name,
      raceDate: event.raceDate,
      location: event.location,
      discipline: event.discipline,
      startTime: event.meetTime,
      clubEventId: event.id,
      routeId: event.routeId ?? null,
      notes: "Vanuit de clubkalender.",
    })
    .onConflictDoUpdate({
      target: [racesTable.clerkId, racesTable.clubEventId],
      // Partiële unieke index ⇒ predicaat MOET mee (drizzle-trap).
      targetWhere: isNotNull(racesTable.clubEventId),
      set: {
        name: event.name,
        raceDate: event.raceDate,
        location: event.location,
        discipline: event.discipline,
        routeId: event.routeId ?? null,
      },
    });
}

export async function removePersonalRaceForSelection(
  clubEventId: number,
  clerkId: string,
): Promise<void> {
  await db
    .delete(racesTable)
    .where(and(eq(racesTable.clerkId, clerkId), eq(racesTable.clubEventId, clubEventId)));
}

// Wedstrijdgegevens gewijzigd ⇒ alle gesynchroniseerde persoonlijke rijen mee.
export async function propagateEventUpdate(event: ClubEvent): Promise<void> {
  await db
    .update(racesTable)
    .set({
      name: event.name,
      raceDate: event.raceDate,
      location: event.location,
      discipline: event.discipline,
      routeId: event.routeId ?? null,
      ...(event.status === "geannuleerd" ? { status: "geannuleerd" } : {}),
    })
    .where(eq(racesTable.clubEventId, event.id));
}
