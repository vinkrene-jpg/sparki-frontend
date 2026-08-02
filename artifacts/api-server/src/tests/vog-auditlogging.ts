// F6 — Auditlogging bij VOG.
//
// Boot de ECHTE Express-app en bewijs het volledige auditcontract rond de
// VOG-registratie op een clublidmaatschap:
//   1.  VOG registreren (datum toevoegen) ⇒ precies één auditrecord met
//       oude + nieuwe afgiftedatum in security_audit_log.
//   2.  VOG wijzigen (andere datum) ⇒ opnieuw precies één record (oud+nieuw).
//   3.  Onveranderde datum opnieuw sturen ⇒ GEEN nieuw record.
//   4.  VOG verwijderen (null) ⇒ record met event vog_registratie_verwijderd.
//   5.  Onbevoegde (gewoon lid) kan de VOG-historie NIET lezen (403), ook niet
//       via directe API-aanroep.
//   6.  Clubbeheer kan de historie van één persoon opvragen (append-only,
//       nieuwste eerst).
//   7.  Trainer ZONDER VOG-registratie aan een jeugdgroep toevoegen ⇒ geweigerd
//       met eerlijke melding (409).
//   8.  Trainer MÉT verlopen VOG (> 3 jaar) ⇒ toewijzing lukt, alleen een
//       waarschuwing (geen weigering).
//   9.  Migratie van bestaande koppeling zonder registratie schrijft een record
//       (event vog_registratie_gemigreerd), server-side.
//
// Run: `pnpm --filter @workspace/api-server run test:vog-auditlogging`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  clubsTable,
  clubMembersTable,
  clubGroupsTable,
  clubGroupMembersTable,
  clubTrainerAssignmentsTable,
  securityAuditLogTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, like, desc } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { writeVogAudit } from "../lib/security/vog-audit";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({ scenario: name, status: "fail", note: err instanceof Error ? err.message : String(err) });
  }
}

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("no address"));
    });
  });
}

async function req(method: string, path: string, actor: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-dev-clerk-id": actor },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

const RUN = Date.now();
const OWNER = `dev_vog_owner_${RUN}`;
const TRAINER = `dev_vog_trainer_${RUN}`;
const TRAINER2 = `dev_vog_trainer2_${RUN}`;
const MIGR_TRAINER = `dev_vog_migr_${RUN}`;
const KID = `dev_vog_kid_${RUN}`;
const OUTSIDER = `dev_vog_out_${RUN}`;

let clubId = 0;
let trainerMemberId = 0;

function isoYearsAgo(y: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
}

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(like(clubsTable.name, `VOG-auditclub ${RUN}%`));
  const ids = clubs.map((c) => c.id);
  if (ids.length) await db.delete(clubsTable).where(inArray(clubsTable.id, ids));
  const subjects = [TRAINER, TRAINER2, MIGR_TRAINER];
  await db
    .delete(securityAuditLogTable)
    .where(inArray(securityAuditLogTable.subjectClerkId, subjects));
  await db.delete(athleteProfilesTable).where(like(athleteProfilesTable.clerkId, `dev_vog_%_${RUN}`));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `dev_vog_%_${RUN}`));
}

async function vogRecordsFor(subject: string): Promise<
  { event: string; meta: Record<string, unknown> | null }[]
> {
  const rows = await db
    .select({ event: securityAuditLogTable.event, meta: securityAuditLogTable.meta })
    .from(securityAuditLogTable)
    .where(
      and(
        eq(securityAuditLogTable.subjectClerkId, subject),
        inArray(securityAuditLogTable.event, [
          "vog_registratie_gewijzigd",
          "vog_registratie_verwijderd",
          "vog_registratie_gemigreerd",
        ]),
      ),
    )
    .orderBy(desc(securityAuditLogTable.at));
  return rows as { event: string; meta: Record<string, unknown> | null }[];
}

async function main() {
  await startServer();
  await cleanup();
  await ensureAccount(OWNER, `vog-owner-${RUN}@sparki.test`, "VOG Eigenaar", silentLogger);
  await ensureAccount(TRAINER, `vog-trainer-${RUN}@sparki.test`, "VOG Trainer", silentLogger);
  await ensureAccount(TRAINER2, `vog-trainer2-${RUN}@sparki.test`, "VOG Trainer Twee", silentLogger);
  await ensureAccount(MIGR_TRAINER, `vog-migr-${RUN}@sparki.test`, "VOG Migratie Trainer", silentLogger);
  await ensureAccount(KID, `vog-kid-${RUN}@sparki.test`, "VOG Jeugdlid", silentLogger);
  await ensureAccount(OUTSIDER, `vog-out-${RUN}@sparki.test`, "VOG Buitenstaander", silentLogger);
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: isoYearsAgo(13) })
    .where(eq(athleteProfilesTable.clerkId, KID));

  // Club + leden opzetten.
  const c = await req("POST", "/api/clubs", OWNER, { name: `VOG-auditclub ${RUN}` });
  clubId = Number(c.json["id"]);
  assert(clubId > 0, "geen club-id");

  // Trainer, tweede trainer, migratie-trainer, kind, buitenstaander als lid.
  for (const id of [TRAINER, TRAINER2, MIGR_TRAINER, KID, OUTSIDER]) {
    await db.insert(clubMembersTable).values({ clubId, clerkId: id, role: "member" }).onConflictDoNothing();
  }
  // Trainerrollen zetten.
  await db
    .update(clubMembersTable)
    .set({ role: "trainer" })
    .where(and(eq(clubMembersTable.clubId, clubId), inArray(clubMembersTable.clerkId, [TRAINER, TRAINER2, MIGR_TRAINER])));

  const [tm] = await db
    .select({ id: clubMembersTable.id })
    .from(clubMembersTable)
    .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, TRAINER), isNull(clubMembersTable.endedAt)));
  trainerMemberId = tm!.id;

  await scenario("1. VOG registreren ⇒ precies één record met oude + nieuwe datum", async () => {
    const before = await vogRecordsFor(TRAINER);
    const r = await req("PUT", `/api/clubs/${clubId}/members/${trainerMemberId}/vog`, OWNER, {
      issuedOn: "2025-01-10",
    });
    assert(r.status === 200, `vog registreren kreeg ${r.status}`);
    const after = await vogRecordsFor(TRAINER);
    assert(after.length === before.length + 1, `verwacht 1 nieuw record, kreeg ${after.length - before.length}`);
    const rec = after[0]!;
    assert(rec.event === "vog_registratie_gewijzigd", `event is ${rec.event}`);
    assert(rec.meta?.["oudeAfgiftedatum"] === null, "oude datum niet null");
    assert(rec.meta?.["nieuweAfgiftedatum"] === "2025-01-10", "nieuwe datum onjuist");
    assert(rec.meta?.["clubId"] === clubId, "clubId ontbreekt in meta");
    assert(rec.meta?.["actorRol"] === "owner", "actor-rol ontbreekt");
  });

  await scenario("2. VOG wijzigen ⇒ opnieuw precies één record (oud+nieuw)", async () => {
    const before = await vogRecordsFor(TRAINER);
    const r = await req("PUT", `/api/clubs/${clubId}/members/${trainerMemberId}/vog`, OWNER, {
      issuedOn: "2025-06-01",
      toelichting: "nieuwe VOG getoond",
    });
    assert(r.status === 200, `wijzigen kreeg ${r.status}`);
    const after = await vogRecordsFor(TRAINER);
    assert(after.length === before.length + 1, "verwacht precies 1 nieuw record");
    assert(after[0]!.meta?.["oudeAfgiftedatum"] === "2025-01-10", "oude datum onjuist");
    assert(after[0]!.meta?.["nieuweAfgiftedatum"] === "2025-06-01", "nieuwe datum onjuist");
    assert(after[0]!.meta?.["toelichting"] === "nieuwe VOG getoond", "toelichting ontbreekt");
  });

  await scenario("3. Onveranderde datum ⇒ GEEN nieuw record", async () => {
    const before = await vogRecordsFor(TRAINER);
    const r = await req("PUT", `/api/clubs/${clubId}/members/${trainerMemberId}/vog`, OWNER, {
      issuedOn: "2025-06-01",
    });
    assert(r.status === 200, `kreeg ${r.status}`);
    const after = await vogRecordsFor(TRAINER);
    assert(after.length === before.length, "er is ten onrechte een record bijgeschreven");
  });

  await scenario("4. VOG verwijderen ⇒ record vog_registratie_verwijderd", async () => {
    const before = await vogRecordsFor(TRAINER);
    const r = await req("PUT", `/api/clubs/${clubId}/members/${trainerMemberId}/vog`, OWNER, { issuedOn: null });
    assert(r.status === 200, `wissen kreeg ${r.status}`);
    const after = await vogRecordsFor(TRAINER);
    assert(after.length === before.length + 1, "verwacht precies 1 nieuw record");
    assert(after[0]!.event === "vog_registratie_verwijderd", `event is ${after[0]!.event}`);
    assert(after[0]!.meta?.["oudeAfgiftedatum"] === "2025-06-01", "oude datum ontbreekt");
    assert(after[0]!.meta?.["nieuweAfgiftedatum"] === null, "nieuwe datum niet null");
  });

  await scenario("5. Onbevoegde kan VOG-historie niet lezen (403)", async () => {
    const r = await req("GET", `/api/clubs/${clubId}/members/${trainerMemberId}/vog-audit`, OUTSIDER);
    assert(r.status === 403, `onbevoegd kreeg ${r.status}, verwacht 403`);
  });

  await scenario("6. Clubbeheer kan historie per persoon lezen", async () => {
    const r = await req("GET", `/api/clubs/${clubId}/members/${trainerMemberId}/vog-audit`, OWNER);
    assert(r.status === 200, `beheer kreeg ${r.status}`);
    const hist = r.json["historie"] as unknown[];
    assert(Array.isArray(hist) && hist.length >= 3, `verwacht >=3 records, kreeg ${hist?.length}`);
    // Append-only, nieuwste eerst.
    const first = hist[0] as { event: string };
    assert(first.event === "vog_registratie_verwijderd", "nieuwste record niet bovenaan");
  });

  await scenario("7. Trainer zonder VOG aan jeugdgroep ⇒ geweigerd (409)", async () => {
    const g = await req("POST", `/api/clubs/${clubId}/groups`, OWNER, {
      name: `Jeugd ${RUN}`,
      level: "jeugd U15",
    });
    assert(g.status === 201, `groep aanmaken kreeg ${g.status}`);
    const groupId = Number(g.json["id"]);
    // TRAINER2 heeft geen VOG-registratie.
    const r = await req("POST", `/api/clubs/${clubId}/trainer-assignments`, OWNER, {
      trainerClerkId: TRAINER2,
      groupId,
    });
    assert(r.status === 409, `verwacht 409, kreeg ${r.status}`);
    assert(/VOG/i.test(String(r.json["error"])), "melding noemt geen VOG");
    // Geen toewijzing weggeschreven.
    const rows = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(and(eq(clubTrainerAssignmentsTable.clubId, clubId), eq(clubTrainerAssignmentsTable.trainerClerkId, TRAINER2)));
    assert(rows.length === 0, "er is toch een toewijzing gemaakt");
  });

  await scenario("8. Verlopen VOG (>3 jaar) ⇒ toewijzing lukt met waarschuwing", async () => {
    // Registreer een verlopen VOG voor TRAINER2 (4 jaar geleden).
    const [t2] = await db
      .select({ id: clubMembersTable.id })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, TRAINER2), isNull(clubMembersTable.endedAt)));
    const vr = await req("PUT", `/api/clubs/${clubId}/members/${t2!.id}/vog`, OWNER, {
      issuedOn: isoYearsAgo(4),
    });
    assert(vr.status === 200, `vog zetten kreeg ${vr.status}`);
    const [g] = await db
      .select({ id: clubGroupsTable.id })
      .from(clubGroupsTable)
      .where(and(eq(clubGroupsTable.clubId, clubId), like(clubGroupsTable.name, `Jeugd ${RUN}`)));
    const r = await req("POST", `/api/clubs/${clubId}/trainer-assignments`, OWNER, {
      trainerClerkId: TRAINER2,
      groupId: g!.id,
    });
    assert(r.status === 201, `verlopen VOG mag niet blokkeren, kreeg ${r.status}`);
    const warns = r.json["waarschuwingen"] as string[] | undefined;
    assert(Array.isArray(warns) && warns.some((w) => /3 jaar/.test(w)), "geen verlopen-waarschuwing");
  });

  await scenario("9. Migratie bestaande koppeling zonder registratie schrijft record", async () => {
    // Zet een jeugd-groep + koppeling voor MIGR_TRAINER (zonder VOG) rechtstreeks
    // in de db, zoals een bestaande koppeling van vóór F6.
    const [g] = await db
      .insert(clubGroupsTable)
      .values({ clubId, name: `MigratieJeugd ${RUN}`, level: "jeugd U13" })
      .returning();
    await db
      .insert(clubTrainerAssignmentsTable)
      .values({ clubId, trainerClerkId: MIGR_TRAINER, groupId: g!.id })
      .onConflictDoNothing();
    const before = await vogRecordsFor(MIGR_TRAINER);
    assert(before.length === 0, "onverwacht bestaand record");
    // Server-side helper direct aanroepen (zoals het migratiescript doet).
    const [member] = await db
      .select({ id: clubMembersTable.id })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, MIGR_TRAINER), isNull(clubMembersTable.endedAt)));
    await db.transaction(async (tx) => {
      await writeVogAudit(
        {
          event: "vog_registratie_gemigreerd",
          actorClerkId: "systeem_migratie",
          subjectClerkId: MIGR_TRAINER,
          meta: {
            actorRol: "systeem",
            clubId,
            clubMemberId: member!.id,
            oudeAfgiftedatum: null,
            nieuweAfgiftedatum: null,
            toelichting: "Bestaande koppeling zonder VOG-registratie — gemarkeerd bij migratie.",
            groepId: g!.id,
          },
        },
        tx,
      );
    });
    const after = await vogRecordsFor(MIGR_TRAINER);
    assert(after.length === 1, `verwacht 1 migratierecord, kreeg ${after.length}`);
    assert(after[0]!.event === "vog_registratie_gemigreerd", "verkeerd event");
    // Koppeling nog intact (nooit stil verbroken).
    const links = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(and(eq(clubTrainerAssignmentsTable.clubId, clubId), eq(clubTrainerAssignmentsTable.trainerClerkId, MIGR_TRAINER)));
    assert(links.length === 1, "koppeling ten onrechte verdwenen");
  });

  await cleanup();
  server?.close();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} geslaagd.`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
