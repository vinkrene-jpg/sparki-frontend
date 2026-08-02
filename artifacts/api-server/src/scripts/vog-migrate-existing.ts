// F6 — Auditlogging bij VOG: migratie van BESTAANDE koppelingen.
//
// Bestaande trainer-toewijzingen aan een jeugdgroep waarvan de trainer GEEN
// VOG-registratie heeft, worden gemarkeerd en gemeld — NOOIT stil verbroken.
// Server-side schrijft dit script per betrokken persoon precies één auditrecord
// (event `vog_registratie_gemigreerd`) in het bestaande security_audit_log,
// binnen dezelfde transactie als de "markering" (idempotent: als er voor deze
// persoon in deze club al een gemigreerd-record bestaat, slaan we hem over).
//
// Er wordt niets aan de VOG-velden gewijzigd (er is niets te registreren) en de
// koppeling blijft intact. Het record documenteert het ontbreken zodat beheer
// het kan opvolgen.
//
//   pnpm --filter @workspace/api-server run vog:migrate
//   pnpm --filter @workspace/api-server run vog:migrate -- --dry-run
//   pnpm --filter @workspace/api-server run vog:migrate -- --club=123

import { and, eq, isNull, inArray } from "drizzle-orm";
import {
  db,
  pool,
  clubsTable,
  clubMembersTable,
  clubGroupsTable,
  clubGroupMembersTable,
  clubTrainerAssignmentsTable,
  athleteProfilesTable,
  securityAuditLogTable,
} from "@workspace/db";
import { computeAge } from "../lib/age";
import { writeVogAudit } from "../lib/security/vog-audit";

const YOUTH_LEVEL = /\bjeugd\b|welp|pupil|aspirant|junior|nieuweling|\bu\s?-?\d{1,2}\b/;

async function isMinor(clerkId: string): Promise<boolean> {
  const [a] = await db
    .select({ birthDate: athleteProfilesTable.birthDate, birthYear: athleteProfilesTable.birthYear })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  if (!a) return true; // fail-closed
  const age = computeAge(a.birthDate, a.birthYear);
  return age == null ? true : age < 16;
}

async function groupIsYouth(groupId: number, level: string | null): Promise<boolean> {
  if (level && YOUTH_LEVEL.test(level.toLowerCase())) return true;
  const members = await db
    .select({ clerkId: clubGroupMembersTable.clerkId })
    .from(clubGroupMembersTable)
    .where(and(eq(clubGroupMembersTable.groupId, groupId), isNull(clubGroupMembersTable.endedAt)));
  for (const m of members) if (await isMinor(m.clerkId)) return true;
  return false;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const clubArg = process.argv.find((a) => a.startsWith("--club="));
  const onlyClub = clubArg ? parseInt(clubArg.slice("--club=".length), 10) : null;

  // Alle groep-toewijzingen (jeugd bepalen we per groep).
  const assignments = await db
    .select({
      id: clubTrainerAssignmentsTable.id,
      clubId: clubTrainerAssignmentsTable.clubId,
      trainerClerkId: clubTrainerAssignmentsTable.trainerClerkId,
      groupId: clubTrainerAssignmentsTable.groupId,
    })
    .from(clubTrainerAssignmentsTable);

  let scanned = 0;
  let marked = 0;
  let skipped = 0;

  for (const a of assignments) {
    if (a.groupId == null) continue;
    if (onlyClub != null && a.clubId !== onlyClub) continue;
    scanned++;

    const [group] = await db
      .select({ id: clubGroupsTable.id, level: clubGroupsTable.level, clubId: clubGroupsTable.clubId })
      .from(clubGroupsTable)
      .where(eq(clubGroupsTable.id, a.groupId));
    if (!group) continue;
    if (!(await groupIsYouth(group.id, group.level))) continue;

    // Actief lidmaatschap van de trainer in deze club (voor VOG + rol).
    const [member] = await db
      .select()
      .from(clubMembersTable)
      .where(
        and(
          eq(clubMembersTable.clubId, a.clubId),
          eq(clubMembersTable.clerkId, a.trainerClerkId),
          isNull(clubMembersTable.endedAt),
        ),
      );
    if (!member) continue;
    if (member.vogIssuedOn != null) continue; // heeft registratie → geen migratie nodig

    // Idempotent: al een gemigreerd-record voor deze persoon in deze club?
    const existing = await db
      .select({ id: securityAuditLogTable.id, meta: securityAuditLogTable.meta })
      .from(securityAuditLogTable)
      .where(
        and(
          eq(securityAuditLogTable.subjectClerkId, a.trainerClerkId),
          inArray(securityAuditLogTable.event, ["vog_registratie_gemigreerd"]),
        ),
      );
    const already = existing.some(
      (r) => (r.meta as Record<string, unknown> | null)?.["clubId"] === a.clubId,
    );
    if (already) {
      skipped++;
      continue;
    }

    const [club] = await db
      .select({ name: clubsTable.name })
      .from(clubsTable)
      .where(eq(clubsTable.id, a.clubId));

    if (dryRun) {
      console.log(
        `[dry-run] zou markeren: trainer ${a.trainerClerkId} in club ${a.clubId} (jeugdgroep ${group.id}) zonder VOG-registratie`,
      );
      marked++;
      continue;
    }

    // Server-side, in één transactie: het auditrecord documenteert het ontbreken.
    await db.transaction(async (tx) => {
      await writeVogAudit(
        {
          event: "vog_registratie_gemigreerd",
          actorClerkId: "systeem_migratie",
          subjectClerkId: a.trainerClerkId,
          meta: {
            actorRol: "systeem",
            clubId: a.clubId,
            clubNaam: club?.name ?? null,
            clubMemberId: member.id,
            oudeAfgiftedatum: null,
            nieuweAfgiftedatum: null,
            toelichting:
              "Bestaande koppeling aan een jeugdgroep zonder VOG-registratie — gemarkeerd bij migratie, koppeling blijft intact.",
            groepId: group.id,
          },
        },
        tx,
      );
    });
    marked++;
  }

  console.log(
    `\nKlaar: ${scanned} jeugd-toewijzingen bekeken, ${marked} gemarkeerd${dryRun ? " (dry-run)" : ""}, ${skipped} al eerder gemigreerd.`,
  );
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
