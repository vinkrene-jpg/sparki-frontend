// Besluitenpatch 2026-08-01 (hoofdstuk B, pakket 01): de ouderkoppeling stopt
// AUTOMATISCH zodra de sporter 18 wordt. Sporter en gekoppelde trainer(s)
// krijgen één week vooraf bericht; de ouder krijgt bij het daadwerkelijke
// einde een neutraal bericht. Beëindiging is een soft-end (endedAt gezet,
// historie blijft — zelfde model als BB-09), nooit een delete.
//
// Eerlijkheid & veiligheid:
// - Alleen koppelingen met een BEKENDE geboortedatum worden beëindigd; een
//   onbekende leeftijd blijft in het strengste (minderjarigen)regime en wordt
//   hier nooit "volwassen geraden".
// - Idempotent: meldingen dedupen op dedupeKey; beëindiging is een
//   voorwaardelijke UPDATE (endedAt IS NULL), dus dubbele runs doen niets.
// - Draait dagelijks mee in de reminder-scheduler; fouten breken de run nooit.

import { and, eq, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  parentAthleteLinksTable,
  coachAthleteLinksTable,
} from "@workspace/db";
import { createNotification } from "./notifications";
import { logger } from "./logger";

export type ParentAgeTransitionSummary = {
  noticesSent: number;
  linksEnded: number;
};

/** Datum (UTC-veilig, birth_date is een kale date-kolom) waarop iemand 18 wordt. */
function eighteenthBirthday(birthDate: string): Date {
  const [y, m, d] = birthDate.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC((y ?? 0) + 18, (m ?? 1) - 1, d ?? 1));
}

export async function runParentAgeTransition(
  now = new Date(),
): Promise<ParentAgeTransitionSummary> {
  const summary: ParentAgeTransitionSummary = { noticesSent: 0, linksEnded: 0 };

  // Alle ACTIEVE ouderkoppelingen van sporters met bekende geboortedatum.
  const rows = await db
    .select({
      parentClerkId: parentAthleteLinksTable.parentClerkId,
      athleteClerkId: parentAthleteLinksTable.athleteClerkId,
      birthDate: athleteProfilesTable.birthDate,
    })
    .from(parentAthleteLinksTable)
    .innerJoin(
      athleteProfilesTable,
      eq(athleteProfilesTable.clerkId, parentAthleteLinksTable.athleteClerkId),
    )
    .where(
      and(
        eq(parentAthleteLinksTable.status, "accepted"),
        isNull(parentAthleteLinksTable.endedAt),
        sql`${athleteProfilesTable.birthDate} IS NOT NULL`,
        // Alleen sporters die binnen 8 dagen 18 worden of het al zijn:
        // (geboortedatum + 18 jaar) <= now + 8 dagen.
        lte(
          sql`(${athleteProfilesTable.birthDate}::date + interval '18 years')`,
          new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        ),
      ),
    );

  for (const row of rows) {
    if (!row.birthDate) continue;
    const turns18 = eighteenthBirthday(row.birthDate);
    const isAdult = now.getTime() >= turns18.getTime();

    if (!isAdult) {
      // Week-vooraf-bericht aan sporter én gekoppelde trainer(s). DedupeKey
      // per sporter×18e-verjaardag: hoogstens één bericht, ook bij herhaalde
      // dagelijkse runs of meerdere ouderkoppelingen.
      const dag = row.birthDate;
      const created = await createNotification({
        clerkId: row.athleteClerkId,
        type: "access_changed",
        title: "Je ouderkoppeling stopt binnenkort automatisch",
        body:
          "Je wordt over minder dan een week 18. Vanaf je verjaardag stopt de " +
          "koppeling met je ouder/verzorger automatisch; jij beheert daarna " +
          "zelf volledig wie wat ziet.",
        source: "parent-age-transition",
        dedupeKey: `parent-18-notice:athlete:${row.athleteClerkId}:${dag}`,
        actionUrl: "/instellingen/privacy",
      });
      if (created) summary.noticesSent++;

      const coaches = await db
        .select({ coachClerkId: coachAthleteLinksTable.coachClerkId })
        .from(coachAthleteLinksTable)
        .where(
          and(
            eq(coachAthleteLinksTable.athleteClerkId, row.athleteClerkId),
            eq(coachAthleteLinksTable.status, "accepted"),
            isNull(coachAthleteLinksTable.endedAt),
          ),
        );
      for (const c of coaches) {
        const sent = await createNotification({
          clerkId: c.coachClerkId,
          type: "access_changed",
          title: "Ouderkoppeling van een sporter stopt binnenkort",
          body:
            "Een van je sporters wordt binnen een week 18; de ouderkoppeling " +
            "stopt dan automatisch.",
          athleteClerkId: row.athleteClerkId,
          audience: "coach",
          source: "parent-age-transition",
          dedupeKey: `parent-18-notice:coach:${c.coachClerkId}:${row.athleteClerkId}:${dag}`,
        });
        if (sent) summary.noticesSent++;
      }
      continue;
    }

    // 18 of ouder: koppeling automatisch beëindigen (soft-end, voorwaardelijk
    // zodat een parallelle run nooit dubbel telt of endedAt overschrijft).
    const ended = await db
      .update(parentAthleteLinksTable)
      .set({ endedAt: now })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, row.parentClerkId),
          eq(parentAthleteLinksTable.athleteClerkId, row.athleteClerkId),
          isNull(parentAthleteLinksTable.endedAt),
        ),
      )
      .returning({ athleteClerkId: parentAthleteLinksTable.athleteClerkId });
    if (ended.length === 0) continue;
    summary.linksEnded++;

    await createNotification({
      clerkId: row.parentClerkId,
      type: "access_changed",
      title: "Ouderkoppeling automatisch beëindigd",
      body:
        "Je kind is 18 geworden. De ouderkoppeling is daarom automatisch " +
        "gestopt; je ziet vanaf nu geen gegevens meer.",
      athleteClerkId: row.athleteClerkId,
      audience: "parent",
      source: "parent-age-transition",
      dedupeKey: `parent-18-ended:parent:${row.parentClerkId}:${row.athleteClerkId}`,
    });
    await createNotification({
      clerkId: row.athleteClerkId,
      type: "access_changed",
      title: "Je ouderkoppeling is gestopt",
      body:
        "Je bent 18 geworden — de koppeling met je ouder/verzorger is " +
        "automatisch beëindigd. Wil je toch weer delen, dan kan dat alleen " +
        "met een nieuwe koppeling die jij zelf bevestigt.",
      source: "parent-age-transition",
      dedupeKey: `parent-18-ended:athlete:${row.athleteClerkId}:${row.parentClerkId}`,
      actionUrl: "/instellingen/privacy",
    });
  }

  if (summary.noticesSent > 0 || summary.linksEnded > 0) {
    logger.info(
      { parentAgeTransition: summary },
      "parent age transition run done",
    );
  }
  return summary;
}
