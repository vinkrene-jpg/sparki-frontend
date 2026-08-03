// F6 — VOG en jeugdveiligheid: route-contracttest.
//
// Spec (SPARKI_BUILD_01 §F6): status · datum · vervaldatum/hercontrole ·
// bewijsreferentie · bevoegd beheer · audit; koppeling aan een jeugdgroep
// wordt server-side geweigerd wanneer de verplichte status ontbreekt.
// Besluitenpatch 01-08 (versoepeld): een VERLOPEN VOG (>3 jaar) waarschuwt en
// wordt gemarkeerd/gemeld, maar blokkeert de koppeling niet.
//
// Scenario's:
//   1. Bevoegdheid: alleen clubbeheer registreert VOG (trainer zelf → 403).
//   2. VOG registreren met bewijsreferentie; audit ontstaat.
//   3. Koppelpoging jeugdgroep ZONDER VOG → 409 met eerlijke melding.
//   4. Met geldige VOG lukt de koppeling wél.
//   5. Verlopen VOG: koppeling lukt met waarschuwing; het VOG-overzicht
//      markeert de jeugdkoppeling ("verlopen"), niets wordt verbroken.
//   6. VOG-overzicht is beheer-only (trainer → 403).
//
// Run: `pnpm --filter @workspace/api-server run test:club-vog`

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
  clubAuditLogTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";

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

async function api(
  method: string,
  path: string,
  clerkId: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-dev-clerk-id": clerkId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, body: json };
}

const OWNER = "test_vog_owner";
const TRAINER = "test_vog_trainer";
const TRAINER2 = "test_vog_trainer2";
const ALL_IDS = [OWNER, TRAINER, TRAINER2];

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(eq(clubsTable.ownerClerkId, OWNER));
  for (const c of clubs) {
    await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  }
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL_IDS));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL_IDS));
}

async function main() {
  await cleanup();
  for (const [i, id] of ALL_IDS.entries()) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, displayName: `TEST VOG ${i}`, email: `${id}@test.sparki` })
      .onConflictDoNothing();
  }

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("geen poort"));
    });
  });

  // Club + leden + jeugdgroep opzetten.
  const created = await api("POST", "/api/clubs", OWNER, { name: "TEST VOG Club" });
  assert(created.status === 201, `club aanmaken faalde: ${created.status} ${JSON.stringify(created.body)}`);
  const clubId = created.body.id ?? created.body.club?.id;
  assert(clubId, "geen club-id");

  for (const t of [TRAINER, TRAINER2]) {
    await db.insert(clubMembersTable).values({ clubId, clerkId: t, role: "trainer" });
  }
  const [group] = await db
    .insert(clubGroupsTable)
    .values({ clubId, name: "Jeugdgroep U15", level: "jeugd U15" })
    .returning();
  const groupId = group!.id;
  // Trainers-lidmaatschapsrijen ophalen voor member-ids.
  const members = await db.select().from(clubMembersTable).where(eq(clubMembersTable.clubId, clubId));
  const memberId = (clerk: string) => members.find((m) => m.clerkId === clerk)!.id;

  await scenario("1. alleen clubbeheer registreert een VOG (trainer → 403)", async () => {
    const r = await api("PUT", `/api/clubs/${clubId}/members/${memberId(TRAINER)}/vog`, TRAINER, {
      issuedOn: "2026-01-15",
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  await scenario("2. VOG met bewijsreferentie registreren + auditrecord", async () => {
    const r = await api("PUT", `/api/clubs/${clubId}/members/${memberId(TRAINER)}/vog`, OWNER, {
      issuedOn: "2026-01-15",
      reference: "Justis-kenmerk ABC-123",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.body)}`);
    const [row] = await db
      .select()
      .from(clubMembersTable)
      .where(eq(clubMembersTable.id, memberId(TRAINER)));
    assert(row!.vogIssuedOn === "2026-01-15", "afgiftedatum niet opgeslagen");
    assert(row!.vogReference === "Justis-kenmerk ABC-123", "bewijsreferentie niet opgeslagen");
    const audits = await db.select().from(clubAuditLogTable).where(eq(clubAuditLogTable.clubId, clubId));
    assert(
      audits.some((a) => String(a.action).includes("vog")),
      "geen VOG-auditrecord in clubauditlog",
    );
  });

  await scenario("3. koppeling jeugdgroep zonder VOG wordt geweigerd (409, eerlijke melding)", async () => {
    const r = await api("POST", `/api/clubs/${clubId}/trainer-assignments`, OWNER, {
      trainerClerkId: TRAINER2,
      groupId,
    });
    assert(r.status === 409, `verwacht 409, kreeg ${r.status}: ${JSON.stringify(r.body)}`);
    assert(String(r.body?.error ?? "").includes("VOG"), "melding noemt de VOG niet");
    const rows = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(eq(clubTrainerAssignmentsTable.trainerClerkId, TRAINER2));
    assert(rows.length === 0, "koppeling werd tóch aangemaakt");
  });

  await scenario("4. met geldige VOG lukt de jeugdkoppeling", async () => {
    const r = await api("POST", `/api/clubs/${clubId}/trainer-assignments`, OWNER, {
      trainerClerkId: TRAINER,
      groupId,
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.body)}`);
    assert(!r.body?.waarschuwingen, "onterecht een waarschuwing bij geldige VOG");
  });

  await scenario("5. verlopen VOG: koppeling mét waarschuwing, overzicht markeert (niets verbroken)", async () => {
    const r1 = await api("PUT", `/api/clubs/${clubId}/members/${memberId(TRAINER2)}/vog`, OWNER, {
      issuedOn: "2020-01-01",
      reference: "OUD-999",
    });
    assert(r1.status === 200, `VOG registreren faalde: ${r1.status}`);
    const r2 = await api("POST", `/api/clubs/${clubId}/trainer-assignments`, OWNER, {
      trainerClerkId: TRAINER2,
      groupId,
    });
    assert(r2.status === 201, `verwacht 201, kreeg ${r2.status}: ${JSON.stringify(r2.body)}`);
    assert(Array.isArray(r2.body?.waarschuwingen) && r2.body.waarschuwingen.length > 0, "geen waarschuwing bij verlopen VOG");

    const ov = await api("GET", `/api/clubs/${clubId}/vog-overzicht`, OWNER);
    assert(ov.status === 200, `overzicht faalde: ${ov.status}`);
    const items: any[] = ov.body.koppelingen;
    const flagged = items.find((k) => k.trainerClerkId === TRAINER2);
    assert(flagged, "verlopen-VOG-koppeling ontbreekt in overzicht");
    assert(flagged.jeugd === true, "jeugdmarkering ontbreekt");
    assert(flagged.vogStatus === "verlopen", `verwacht status verlopen, kreeg ${flagged.vogStatus}`);
    assert(flagged.gemarkeerd === true && typeof flagged.melding === "string", "markering/melding ontbreekt");
    const ok = items.find((k) => k.trainerClerkId === TRAINER);
    assert(ok && ok.vogStatus === "geldig" && ok.gemarkeerd === false, "geldige VOG onterecht gemarkeerd");
    // Niets verbroken: beide koppelingen bestaan nog.
    const rows = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(eq(clubTrainerAssignmentsTable.clubId, clubId));
    assert(rows.length === 2, `verwacht 2 koppelingen, kreeg ${rows.length}`);
  });

  await scenario("6. VOG-overzicht is beheer-only (trainer → 403)", async () => {
    const r = await api("GET", `/api/clubs/${clubId}/vog-overzicht`, TRAINER);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  // Groepslid-tabel onaangeroerd laten checken is niet nodig; cleanup:
  await cleanup();
  await new Promise<void>((resolve) => server!.close(() => resolve()));

  let failed = 0;
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`${r.status === "pass" ? "✔" : "✖"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
