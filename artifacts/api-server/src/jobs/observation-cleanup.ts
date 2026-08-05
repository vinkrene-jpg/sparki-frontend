// Opschoontaak voor verouderde en inhoudelijk dubbele AI-observaties.
//
// Verantwoorde opschoning — GEEN harde delete. Rijen krijgen status
// "outdated" (bestaande statuswaarde) zodat alles terug te draaien is en de
// verantwoording bewaard blijft. Elke run is controleerbaar: eerst een
// rapport met de ids per reden, pas met --apply wordt er geschreven, en na
// afloop volgt een her-telling.
//
// Regels (in deze volgorde):
//  A. achterhaalde_ftp_waarde — de tekst citeert een FTP-wattage dat in de
//     FTP-geschiedenis als "[achterhaald]" gemarkeerd is (afgeleide waarde).
//     Zo'n "terugval van 331W" is een data-artefact, geen echte terugval.
//  B. verouderd_doel — de tekst gaat over een doel ("doel", "van X naar Y")
//     met wattages die niet meer overeenkomen met de huidige FTP van het
//     profiel; alleen gerapporteerd/opgeschoond als de rij ouder is dan 14
//     dagen zodat een vers doel nooit geraakt wordt.
//  C. zelfde_strekking — inhoudelijk duplicaat van een NIEUWERE actieve
//     observatie (zelfde woord-/getaloverlap-heuristiek als de
//     presentatiekant); per strekking blijft de nieuwste rij als
//     representant staan.
//
// Gebruik (vanuit artifacts/api-server):
//   pnpm run job:observation-cleanup -- --clerk-id=user_xxx            (dry-run)
//   pnpm run job:observation-cleanup -- --clerk-id=user_xxx --apply    (schrijft)
//
// Productie: draai het script met de productie-DATABASE_URL en --apply
// ALLEEN na expliciet akkoord van René; de dry-run levert de rapportage
// vooraf (lijst ids), de her-telling de rapportage achteraf.

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  aiObservationsTable,
  aiMemoryEventsTable,
  athleteProfilesTable,
} from "@workspace/db";
import { getOutdatedFtpWatts, recordMemoryEvent } from "../lib/ai-memory";
import {
  citesWattValue,
  contentSignature,
  isNearDuplicateContent,
  observationContentText,
  significantNumbers,
} from "../engines/observation/content-dedupe";

const ACTIVE_STATUSES = ["new", "acknowledged", "saved"] as const;
const GOAL_MIN_AGE_DAYS = 14;
// §4.4 — één seizoen; daarna zakt een nooit-bevestigde herinnering terug naar
// "voorlopig" en wordt hij één keer opnieuw voorgelegd.
const SEASON_DAYS = 365;
const RE_ASK_WAIT_DAYS = 14;

export type CleanupReason =
  | "achterhaalde_ftp_waarde"
  | "verouderd_doel"
  | "zelfde_strekking";

export type CleanupReportEntry = {
  id: number;
  reason: CleanupReason;
  createdAt: string;
  title: string;
  keptRepresentativeId?: number;
};

export type CleanupReport = {
  clerkId: string;
  activeBefore: number;
  outdatedFtpWatts: number[];
  flagged: CleanupReportEntry[];
  keptActive: number;
  applied: boolean;
  activeAfter: number | null;
};

// Puur besluitdeel: bepaal per actieve observatie of en waarom hij opgeruimd
// hoort te worden. Exporteerbaar zodat de test dit zonder DB kan verifiëren.
export function planCleanup(
  observations: Array<{
    id: number;
    title: string;
    summary: string | null;
    observationText: string;
    createdAt: Date | string;
  }>,
  outdatedWatts: number[],
  currentFtp: number | null,
  now = new Date(),
): CleanupReportEntry[] {
  const flagged: CleanupReportEntry[] = [];
  const flaggedIds = new Set<number>();

  const entryOf = (
    o: (typeof observations)[number],
    reason: CleanupReason,
    keptRepresentativeId?: number,
  ): CleanupReportEntry => ({
    id: o.id,
    reason,
    createdAt: new Date(o.createdAt).toISOString(),
    title: o.title,
    ...(keptRepresentativeId != null ? { keptRepresentativeId } : {}),
  });

  // Regel A + B.
  for (const o of observations) {
    const text = observationContentText(o);
    if (citesWattValue(text, outdatedWatts)) {
      flagged.push(entryOf(o, "achterhaalde_ftp_waarde"));
      flaggedIds.add(o.id);
      continue;
    }
    const ageDays =
      (now.getTime() - new Date(o.createdAt).getTime()) / 86_400_000;
    if (ageDays >= GOAL_MIN_AGE_DAYS && /\bdoel\b/i.test(text)) {
      const watts = [...significantNumbers(text)]
        .map((n) => Number(n))
        .filter(
          (n) =>
            Number.isInteger(n) &&
            n >= 100 &&
            n <= 600 &&
            citesWattValue(text, [n]),
        );
      if (
        watts.length > 0 &&
        (currentFtp == null || !watts.includes(currentFtp))
      ) {
        flagged.push(entryOf(o, "verouderd_doel"));
        flaggedIds.add(o.id);
      }
    }
  }

  // Regel C — onder de overblijvers: nieuwste eerst, nieuwste per strekking
  // blijft de representant, oudere near-duplicates gaan eruit.
  const survivors = observations
    .filter((o) => !flaggedIds.has(o.id))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const keptSigs: Array<{
    id: number;
    sig: ReturnType<typeof contentSignature>;
  }> = [];
  for (const o of survivors) {
    const sig = contentSignature(observationContentText(o));
    const dup = keptSigs.find((k) => isNearDuplicateContent(k.sig, sig));
    if (dup) {
      flagged.push(entryOf(o, "zelfde_strekking", dup.id));
      flaggedIds.add(o.id);
    } else {
      keptSigs.push({ id: o.id, sig });
    }
  }

  return flagged;
}

export async function runObservationCleanup(
  clerkId: string,
  apply: boolean,
  trigger: string = "handmatig",
): Promise<CleanupReport> {
  const active = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, clerkId),
        inArray(aiObservationsTable.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(desc(aiObservationsTable.createdAt));

  const outdatedWatts = await getOutdatedFtpWatts(clerkId);
  const [profile] = await db
    .select({ ftp: athleteProfilesTable.ftp })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));

  const flagged = planCleanup(active, outdatedWatts, profile?.ftp ?? null);

  let activeAfter: number | null = null;
  if (apply && flagged.length > 0) {
    await db
      .update(aiObservationsTable)
      .set({ status: "outdated", updatedAt: new Date() })
      .where(
        and(
          eq(aiObservationsTable.clerkId, clerkId),
          inArray(
            aiObservationsTable.id,
            flagged.map((f) => f.id),
          ),
          // Nooit iets anders raken dan wat we net als actief zagen.
          inArray(aiObservationsTable.status, [...ACTIVE_STATUSES]),
        ),
      );
    await recordMemoryEvent(clerkId, "observation_cleanup", null, {
      trigger,
      flagged: flagged.length,
      byReason: flagged.reduce<Record<string, number>>((acc, f) => {
        acc[f.reason] = (acc[f.reason] ?? 0) + 1;
        return acc;
      }, {}),
      ids: flagged.map((f) => f.id),
    });
  }
  if (apply) {
    const after = await db
      .select({ id: aiObservationsTable.id })
      .from(aiObservationsTable)
      .where(
        and(
          eq(aiObservationsTable.clerkId, clerkId),
          inArray(aiObservationsTable.status, [...ACTIVE_STATUSES]),
        ),
      );
    activeAfter = after.length;
  }

  // §4.4 — vergeten is een functie (alleen bij apply; nooit harde deletes):
  //  1. ouder dan één seizoen en nooit bevestigd → terug naar "voorlopig",
  //     zodat de bevestigingsstroom hem precies één keer opnieuw voorlegt;
  //  2. staat hij daarna nog steeds op "voorlopig" én is de her-voorlegging
  //     ≥ 14 dagen geleden getoond → stil vervallen ("outdated").
  //  Weerlegde herinneringen komen nooit automatisch terug (niet geraakt).
  if (apply) {
    const seizoenGrens = new Date(Date.now() - SEASON_DAYS * 86_400_000);
    await db
      .update(aiObservationsTable)
      .set({ status: "voorlopig", updatedAt: new Date() })
      .where(
        and(
          eq(aiObservationsTable.clerkId, clerkId),
          inArray(aiObservationsTable.status, [...ACTIVE_STATUSES]),
          lt(aiObservationsTable.createdAt, seizoenGrens),
        ),
      );
    const herVoorlegGrens = new Date(Date.now() - RE_ASK_WAIT_DAYS * 86_400_000);
    const getoond = await db
      .select({ obsId: aiMemoryEventsTable.relatedObservationId })
      .from(aiMemoryEventsTable)
      .where(
        and(
          eq(aiMemoryEventsTable.clerkId, clerkId),
          eq(aiMemoryEventsTable.eventType, "confirm_question_shown"),
          lt(aiMemoryEventsTable.createdAt, herVoorlegGrens),
        ),
      );
    const getoondIds = getoond.map((g) => g.obsId).filter((v): v is number => v != null);
    if (getoondIds.length > 0) {
      await db
        .update(aiObservationsTable)
        .set({ status: "outdated", updatedAt: new Date() })
        .where(
          and(
            eq(aiObservationsTable.clerkId, clerkId),
            eq(aiObservationsTable.status, "voorlopig"),
            lt(aiObservationsTable.createdAt, seizoenGrens),
            inArray(aiObservationsTable.id, getoondIds),
          ),
        );
    }
  }

  return {
    clerkId,
    activeBefore: active.length,
    outdatedFtpWatts: outdatedWatts,
    flagged,
    keptActive: active.length - flagged.length,
    applied: apply && flagged.length > 0,
    activeAfter,
  };
}

export interface ScheduledCleanupSummary {
  usersChecked: number;
  usersWithFlagged: number;
  totalFlagged: number;
  totalActiveAfter: number;
}

// ── Automatische runs ────────────────────────────────────────────────────────
//
// Dezelfde regels als de handmatige job (nooit harde deletes, status
// "outdated", observation_cleanup-event met ids), maar veilig aan te roepen
// vanuit event-paden en de periodieke sweep: een fout mag de aanroeper nooit
// breken. `trigger` maakt in het event zichtbaar wáárom de run draaide.
export async function runAutomaticObservationCleanup(
  clerkId: string,
  trigger: string,
): Promise<CleanupReport | null> {
  try {
    const report = await runObservationCleanup(clerkId, true, trigger);
    if (report.applied) {
      console.log(
        `[observation-cleanup] auto (${trigger}) ${clerkId}: ${report.flagged.length} gemarkeerd, ${report.activeAfter} actief over`,
      );
    }
    return report;
  } catch (err) {
    console.error(
      `[observation-cleanup] automatische run (${trigger}) faalde voor ${clerkId}:`,
      err,
    );
    return null;
  }
}

// Periodieke sweep over alle gebruikers met actieve observaties. Idempotent:
// al-gemarkeerde rijen zijn niet meer actief en worden nooit opnieuw geraakt.
export async function sweepObservationCleanup(
  trigger = "periodiek",
): Promise<{ users: number; flagged: number }> {
  const users = await db
    .selectDistinct({ clerkId: aiObservationsTable.clerkId })
    .from(aiObservationsTable)
    .where(inArray(aiObservationsTable.status, [...ACTIVE_STATUSES]));
  let flagged = 0;
  for (const u of users) {
    const report = await runAutomaticObservationCleanup(u.clerkId, trigger);
    if (report?.applied) flagged += report.flagged.length;
  }
  return { users: users.length, flagged };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const clerkId = args
    .find((a) => a.startsWith("--clerk-id="))
    ?.slice("--clerk-id=".length);
  const apply = args.includes("--apply");
  if (!clerkId) {
    console.error(
      "Gebruik: --clerk-id=user_xxx [--apply]  (zonder --apply: dry-run)",
    );
    process.exit(1);
  }

  const report = await runObservationCleanup(clerkId, apply);

  console.log(`\n=== Observatie-opschoning voor ${report.clerkId} ===`);
  console.log(`Actieve observaties vooraf: ${report.activeBefore}`);
  console.log(
    `Achterhaalde FTP-waarden ([achterhaald] in ftp_history): ${
      report.outdatedFtpWatts.join(", ") || "geen"
    }`,
  );
  console.log(`Gemarkeerd voor opschoning: ${report.flagged.length}`);
  for (const f of report.flagged) {
    console.log(
      `  #${f.id} [${f.reason}] (${f.createdAt.slice(0, 10)}) ${f.title}` +
        (f.keptRepresentativeId != null
          ? ` — representant blijft #${f.keptRepresentativeId}`
          : ""),
    );
  }
  console.log(`Blijft actief: ${report.keptActive}`);
  if (report.applied) {
    console.log(
      `TOEGEPAST — status 'outdated' gezet. Actieve observaties achteraf: ${report.activeAfter}`,
    );
  } else if (apply) {
    console.log("Niets om toe te passen.");
  } else {
    console.log("DRY-RUN — er is niets gewijzigd. Draai met --apply om te schrijven.");
  }
  process.exit(0);
}

const isDirectRun = /jobs[\\/][^\\/]*observation-cleanup/.test(
  process.argv[1] ?? "",
);
if (isDirectRun) {
  main().catch((err) => {
    console.error("observation-cleanup faalde:", err);
    process.exit(1);
  });
}

export async function runScheduledObservationCleanup(
  now = new Date(),
): Promise<ScheduledCleanupSummary | null> {
  // At most once per Amsterdam day.
  const dayStr = now.toLocaleDateString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  if (dayStr === lastScheduledCleanupDay) return null;
  lastScheduledCleanupDay = dayStr;

  // Find all distinct users with at least one active observation.
  const rows = await db.execute(
    sql`SELECT DISTINCT clerk_id FROM ai_observations WHERE status IN ('new','acknowledged','saved')`,
  ) as { rows: { clerk_id: string }[] };
  const clerkIds = rows.rows.map((r) => r.clerk_id).filter(Boolean);

  let usersWithFlagged = 0;
  let totalFlagged = 0;
  let totalActiveAfter = 0;
  for (const clerkId of clerkIds) {
    const report = await runObservationCleanup(clerkId, true);
    if (report.flagged.length > 0) usersWithFlagged++;
    totalFlagged += report.flagged.length;
    totalActiveAfter += report.activeAfter ?? report.keptActive;
  }
  return { usersChecked: clerkIds.length, usersWithFlagged, totalFlagged, totalActiveAfter };
}

let lastScheduledCleanupDay = "";
