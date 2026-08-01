// CLUB_ONBOARDING_01 — een club van registratie tot actief.
//
// Boot de ECHTE Express-app en bewijs het volledige onboardingcontract:
//   1.  Club aanmaken → precies één eigenaar, status "concept".
//   2.  Activatie geweigerd met een lijst van wat ontbreekt.
//   3.  Halverwege stoppen en hervatten: niets kwijt.
//   4.  In concept vertrekt geen uitnodiging en zijn leden niet zichtbaar.
//   5.  Logo te groot of verkeerd type: eerlijk geweigerd.
//   6.  Import 100 rijen met 3 fouten: 97 verwerkt na bevestiging, 3 per rij gemeld.
//   7.  Import zonder bevestiging voegt niets toe (en annuleren wist de rijen).
//   8.  Dubbel lid herkend op e-mailadres, niet op naam.
//   9.  Team hoort bij een seizoen; seizoensgrenzen configureerbaar.
//   10. Niet-bevoegde gebruiker kan niet activeren, ook niet via directe aanroep.
//   11. Activatie staat in admin_ops_log én in het clubauditlog.
//   12. Bestaande clubs (zonder concept-flow) blijven "actief" en behouden rollen.
//   13. Fout- en lege toestanden zijn onderscheiden (eigen melding + volgende stap).
//   14. Capaciteit: een import die niet past wordt in zijn geheel geweigerd.
//
// Run: `pnpm --filter @workspace/api-server run test:club-onboarding`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  invitationsTable,
  clubsTable,
  clubMembersTable,
  clubSubscriptionsTable,
  clubAuditLogTable,
  clubSeasonsTable,
  clubTeamsTable,
  clubImportBatchesTable,
  clubImportRowsTable,
  adminOpsLogTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, desc, like } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

// ── Testidentiteiten ─────────────────────────────────────────────────────────
const RUN = Date.now();
const OWNER = `dev_onb_owner_${RUN}`;
const OUTSIDER = `dev_onb_out_${RUN}`;
const TRAINER = `dev_onb_trainer_${RUN}`;
const IMPORT_PREFIX = `dev_onb_imp_${RUN}_`;

let clubId = 0;

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(like(clubsTable.name, `Onboardingclub ${RUN}%`));
  const ids = clubs.map((c) => c.id);
  if (ids.length) {
    const batches = await db
      .select({ id: clubImportBatchesTable.id })
      .from(clubImportBatchesTable)
      .where(inArray(clubImportBatchesTable.clubId, ids));
    if (batches.length)
      await db.delete(clubImportRowsTable).where(inArray(clubImportRowsTable.batchId, batches.map((b) => b.id)));
    await db.delete(clubImportBatchesTable).where(inArray(clubImportBatchesTable.clubId, ids));
    await db.delete(clubsTable).where(inArray(clubsTable.id, ids));
  }
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `dev_onb_%_${RUN}%`));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${IMPORT_PREFIX}%`));
}

async function main() {
  await startServer();
  await ensureAccount(OWNER, `onb-owner-${RUN}@sparki.test`, "Onboarding Eigenaar", silentLogger);
  await ensureAccount(OUTSIDER, `onb-out-${RUN}@sparki.test`, "Buitenstaander", silentLogger);
  await ensureAccount(TRAINER, `onb-trainer-${RUN}@sparki.test`, "Trainer Bestaat", silentLogger);

  await scenario("1. Club aanmaken → precies één eigenaar, status concept", async () => {
    const r = await req("POST", "/api/clubs", OWNER, { name: `Onboardingclub ${RUN}`, concept: true });
    assert(r.status === 201, `aanmaken kreeg ${r.status}`);
    clubId = Number(r.json["id"]);
    assert(Number.isFinite(clubId) && clubId > 0, "geen club-id terug");
    assert(r.json["status"] === "concept", `status is ${r.json["status"]}, verwacht concept`);
    const owners = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.role, "owner"), isNull(clubMembersTable.endedAt)));
    assert(owners.length === 1, `${owners.length} eigenaren, verwacht 1`);
  });

  await scenario("2. Activatie geweigerd met lijst van wat ontbreekt", async () => {
    const r = await req("POST", `/api/clubs/${clubId}/activate`, OWNER);
    assert(r.status === 422, `activatie kreeg ${r.status}, verwacht 422`);
    const missing = r.json["ontbreekt"] as string[];
    assert(Array.isArray(missing) && missing.length >= 2, "geen lijst van ontbrekende punten");
    assert(missing.some((m) => /contact/i.test(m)), "contactgegevens niet gemeld");
    assert(missing.some((m) => /team/i.test(m)), "team niet gemeld");
  });

  await scenario("3. Halverwege stoppen en hervatten: niets kwijt", async () => {
    const upd = await req("PUT", `/api/clubs/${clubId}`, OWNER, { contactEmail: `club-${RUN}@sparki.test` });
    assert(upd.status === 200, `contact opslaan kreeg ${upd.status}`);
    // "Later verder": een verse GET (nieuwe sessie) toont de bewaarde voortgang.
    const ob = await req("GET", `/api/clubs/${clubId}/onboarding`, OWNER);
    assert(ob.status === 200, `onboarding kreeg ${ob.status}`);
    const steps = ob.json["steps"] as Record<string, unknown>;
    assert(steps["contact"] === true, "contactstap niet bewaard");
    assert(steps["profiel"] === true, "naamstap niet bewaard");
    assert(ob.json["klaarVoorActivatie"] === false, "ten onrechte klaar voor activatie");
  });

  await scenario("4. In concept: geen uitnodiging en leden niet zichtbaar", async () => {
    const inv = await req("POST", "/api/invitations", OWNER, { relationship: "club_member", clubId });
    assert(inv.status === 409, `uitnodiging in concept kreeg ${inv.status}, verwacht 409`);
    const invRows = await db.select().from(invitationsTable).where(eq(invitationsTable.clubId, clubId));
    assert(invRows.length === 0, "er is toch een uitnodiging vastgelegd");
    // Trainer met bestaand account direct toewijzen (zonder uitnodiging) …
    const mgr = await req("POST", `/api/clubs/${clubId}/onboarding/managers`, OWNER, {
      email: `onb-trainer-${RUN}@sparki.test`,
      role: "trainer",
    });
    assert(mgr.status === 201, `rol toewijzen kreeg ${mgr.status}`);
    // … maar ook die trainer ziet in concept géén ledenlijst.
    const members = await req("GET", `/api/clubs/${clubId}/members`, TRAINER);
    assert(members.status === 403, `ledenlijst voor trainer in concept kreeg ${members.status}, verwacht 403`);
    // En aansluiten met de clubcode kan niet zolang de club concept is.
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    const join = await req("POST", "/api/clubs/join", OUTSIDER, { code: club!.joinCode });
    assert(join.status === 409, `join in concept kreeg ${join.status}, verwacht 409`);
  });

  await scenario("5. Logo: verkeerd type en te groot eerlijk geweigerd (echte uploads)", async () => {
    async function upload(name: string, contentType: string, bytes: Uint8Array) {
      const presign = await req("POST", "/api/storage/uploads/request-url", OWNER, {
        name,
        size: bytes.length,
        contentType,
      });
      if (presign.status !== 200) return { presignStatus: presign.status, objectPath: null as string | null };
      const put = await fetch(String(presign.json["uploadURL"]), {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: bytes,
      });
      assert(put.ok, `PUT upload faalde (${put.status})`);
      return { presignStatus: 200, objectPath: String(presign.json["objectPath"]) };
    }
    // Verkeerd type: GIF wordt al bij de upload eerlijk geweigerd.
    const gif = await req("POST", "/api/storage/uploads/request-url", OWNER, {
      name: "logo.gif",
      size: 1000,
      contentType: "image/gif",
    });
    assert(gif.status === 400, `gif-upload kreeg ${gif.status}, verwacht 400`);
    // Te groot: echte PNG-bytes van 6 MB — de OPGESLAGEN grootte telt.
    const bigBytes = new Uint8Array(6 * 1024 * 1024);
    bigBytes.set([0x89, 0x50, 0x4e, 0x47]);
    const big = await upload("groot-logo.png", "image/png", bigBytes);
    assert(big.objectPath, "grote upload kon niet worden klaargezet");
    const tooBig = await req("POST", `/api/clubs/${clubId}/logo`, OWNER, { logoUrl: big.objectPath });
    assert(tooBig.status === 400 && /te groot/i.test(String(tooBig.json["error"])), "te groot niet eerlijk geweigerd");
    // Geldig logo: klein echt PNG-bestand.
    const okBytes = new Uint8Array(2_000);
    okBytes.set([0x89, 0x50, 0x4e, 0x47]);
    const small = await upload("logo.png", "image/png", okBytes);
    assert(small.objectPath, "kleine upload kon niet worden klaargezet");
    const ok = await req("POST", `/api/clubs/${clubId}/logo`, OWNER, { logoUrl: small.objectPath });
    assert(ok.status === 200 && ok.json["logoUrl"], `geldig logo niet opgeslagen (${ok.status}: ${ok.json["error"]})`);
    // Niet-bestaand object: eerlijke fout, geen stille koppeling.
    const ghost = await req("POST", `/api/clubs/${clubId}/logo`, OWNER, { logoUrl: "/objects/uploads/bestaat-niet" });
    assert(ghost.status === 400 && /niet gevonden/i.test(String(ghost.json["error"])), "spookbestand niet eerlijk geweigerd");
  });

  await scenario("9. Seizoen met configureerbare grenzen; team hoort bij seizoen", async () => {
    const season = await req("POST", `/api/clubs/${clubId}/seasons`, OWNER, {
      name: `Seizoen ${RUN}`,
      startsOn: "2026-11-01",
      endsOn: "2027-10-31",
    });
    assert(season.status === 201, `seizoen kreeg ${season.status}`);
    assert(season.json["startsOn"] === "2026-11-01" && season.json["endsOn"] === "2027-10-31", "seizoensgrenzen niet bewaard");
    const team = await req("POST", `/api/clubs/${clubId}/teams`, OWNER, {
      name: "Team 1",
      seasonId: season.json["id"],
    });
    assert(team.status === 201, `team kreeg ${team.status}`);
    assert(team.json["seasonId"] === season.json["id"], "team niet aan seizoen gekoppeld");
  });

  // Ruimte voor de grote import: limiet omhoog (configureerbaar per club).
  await db
    .update(clubSubscriptionsTable)
    .set({ maxMembers: 120 })
    .where(eq(clubSubscriptionsTable.clubId, clubId));

  let bigBatchId = 0;
  await scenario("6+7. Import 100 rijen (3 fout): niets vóór bevestiging, 97 erna", async () => {
    const rows: { email: string; name?: string }[] = [];
    for (let i = 0; i < 97; i++) {
      const clerkId = `${IMPORT_PREFIX}${i}`;
      const email = `onb-import-${RUN}-${i}@sparki.test`;
      await ensureAccount(clerkId, email, `Importlid ${i}`, silentLogger);
      rows.push({ email, name: `Importlid ${i}` });
    }
    rows.push({ email: "geen-mailadres", name: "Fout 1" });
    rows.push({ email: "ook@fout", name: "Fout 2" });
    rows.push({ email: "", name: "Fout 3" });
    const create = await req("POST", `/api/clubs/${clubId}/import`, OWNER, { fileName: "leden.csv", rows });
    assert(create.status === 201, `import klaarzetten kreeg ${create.status}`);
    assert(create.json["klaar"] === 97, `${create.json["klaar"]} rijen klaar, verwacht 97`);
    const outRows = create.json["rows"] as { status: string; message: string | null }[];
    const failures = outRows.filter((r) => r.status === "ongeldig");
    assert(failures.length === 3 && failures.every((f) => f.message), "3 foutrijen met eigen melding verwacht");
    bigBatchId = Number((create.json["batch"] as Record<string, unknown>)["id"]);
    // Zonder bevestiging is er NIETS toegevoegd.
    const before = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt)));
    assert(before.length === 2, `${before.length} leden vóór bevestiging, verwacht 2 (eigenaar+trainer)`);
    const confirm = await req("POST", `/api/clubs/${clubId}/import/${bigBatchId}/confirm`, OWNER);
    assert(confirm.status === 200, `bevestigen kreeg ${confirm.status}`);
    assert(confirm.json["toegevoegd"] === 97 && confirm.json["nietVerwerkt"] === 3, `rapport klopt niet: ${JSON.stringify(confirm.json)}`);
    const after = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt)));
    assert(after.length === 99, `${after.length} leden ná bevestiging, verwacht 99`);
  });

  await scenario("8. Dubbel herkend op e-mailadres, niet op naam", async () => {
    const dupEmail = `onb-import-${RUN}-0@sparki.test`; // al lid, andere naam
    const sameNameEmail = `onb-samenaam-${RUN}@sparki.test`; // zelfde naam, ander adres
    await ensureAccount(`dev_onb_naam_${RUN}`, sameNameEmail, "Importlid 0", silentLogger);
    const r = await req("POST", `/api/clubs/${clubId}/import`, OWNER, {
      rows: [
        { email: dupEmail, name: "Compleet Andere Naam" },
        { email: sameNameEmail, name: "Importlid 0" },
      ],
    });
    assert(r.status === 201, `import kreeg ${r.status}`);
    const rows = r.json["rows"] as { email: string; status: string }[];
    assert(rows.find((x) => x.email === dupEmail)?.status === "dubbel", "zelfde e-mail niet als dubbel herkend");
    assert(rows.find((x) => x.email === sameNameEmail)?.status === "klaar", "zelfde naam ten onrechte als dubbel behandeld");
    const batchId = Number((r.json["batch"] as Record<string, unknown>)["id"]);
    const cancel = await req("POST", `/api/clubs/${clubId}/import/${batchId}/cancel`, OWNER);
    assert(cancel.status === 200, "annuleren mislukt");
    const left = await db.select().from(clubImportRowsTable).where(eq(clubImportRowsTable.batchId, batchId));
    assert(left.length === 0, "geannuleerde rijen (persoonsgegevens) niet gewist");
  });

  await scenario("14. Import die niet past wordt in zijn geheel geweigerd", async () => {
    await db.update(clubSubscriptionsTable).set({ maxMembers: 99 }).where(eq(clubSubscriptionsTable.clubId, clubId));
    const email = `onb-teveel-${RUN}@sparki.test`;
    await ensureAccount(`dev_onb_teveel_${RUN}`, email, "Te Veel", silentLogger);
    const r = await req("POST", `/api/clubs/${clubId}/import`, OWNER, { rows: [{ email }] });
    const batchId = Number((r.json["batch"] as Record<string, unknown>)["id"]);
    const confirm = await req("POST", `/api/clubs/${clubId}/import/${batchId}/confirm`, OWNER);
    assert(confirm.status === 409, `volle import kreeg ${confirm.status}, verwacht 409`);
    const count = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt)));
    assert(count.length === 99, "er is toch iets toegevoegd bij een geweigerde import");
    await db.update(clubSubscriptionsTable).set({ maxMembers: 120 }).where(eq(clubSubscriptionsTable.clubId, clubId));
  });

  await scenario("15. Activatiepoort niet te omzeilen via PUT status", async () => {
    const r = await req("PUT", `/api/clubs/${clubId}`, OWNER, { status: "actief" });
    assert(r.status === 409, `PUT status vanuit concept kreeg ${r.status}, verwacht 409`);
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    assert(club!.status === "concept", "clubstatus is toch gewijzigd buiten de activatiepoort om");
  });

  await scenario("16. Confirm/cancel race: tweede en gelijktijdige acties eerlijk geweigerd", async () => {
    const email = `onb-race-${RUN}@sparki.test`;
    await ensureAccount(`dev_onb_race_${RUN}`, email, "Race Lid", silentLogger);
    const create = await req("POST", `/api/clubs/${clubId}/import`, OWNER, { rows: [{ email }] });
    const batchId = Number((create.json["batch"] as Record<string, unknown>)["id"]);
    // Twee gelijktijdige confirms: precies één 200, de ander 409.
    const [a, b] = await Promise.all([
      req("POST", `/api/clubs/${clubId}/import/${batchId}/confirm`, OWNER),
      req("POST", `/api/clubs/${clubId}/import/${batchId}/confirm`, OWNER),
    ]);
    const codes = [a.status, b.status].sort();
    assert(codes[0] === 200 && codes[1] === 409, `gelijktijdige confirms kregen ${codes.join("+")}, verwacht 200+409`);
    // Annuleren van een al bevestigde batch: 404, rijen blijven onaangetast.
    const cancel = await req("POST", `/api/clubs/${clubId}/import/${batchId}/cancel`, OWNER);
    assert(cancel.status === 404, `cancel na confirm kreeg ${cancel.status}, verwacht 404`);
    const members = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt)));
    assert(members.length === 100, `${members.length} leden, verwacht 100 (99 + racelid)`);
  });

  await scenario("10. Niet-bevoegde gebruiker kan niet activeren (directe aanroep)", async () => {
    const out = await req("POST", `/api/clubs/${clubId}/activate`, OUTSIDER);
    assert(out.status === 403 || out.status === 404, `buitenstaander kreeg ${out.status}`);
    const tr = await req("POST", `/api/clubs/${clubId}/activate`, TRAINER);
    assert(tr.status === 403, `trainer kreeg ${tr.status}, verwacht 403`);
    const ob = await req("GET", `/api/clubs/${clubId}/onboarding`, TRAINER);
    assert(ob.status === 403, `onboardingweergave voor trainer kreeg ${ob.status}, verwacht 403`);
  });

  await scenario("11. Activatie: server-side voorwaarden + audit in beide logboeken", async () => {
    const r = await req("POST", `/api/clubs/${clubId}/activate`, OWNER);
    assert(r.status === 200 && r.json["status"] === "actief", `activatie kreeg ${r.status}`);
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    assert(club!.status === "actief", "clubstatus niet actief");
    const audit = await db
      .select()
      .from(clubAuditLogTable)
      .where(and(eq(clubAuditLogTable.clubId, clubId), eq(clubAuditLogTable.action, "club_geactiveerd")));
    assert(audit.length === 1, "clubauditlog mist activatie");
    const ops = await db
      .select()
      .from(adminOpsLogTable)
      .where(eq(adminOpsLogTable.action, "club_geactiveerd"))
      .orderBy(desc(adminOpsLogTable.id))
      .limit(5);
    assert(ops.some((o) => (o.newState as Record<string, unknown> | null)?.["clubId"] === clubId), "admin_ops_log mist activatie");
    // Na activatie vertrekt een uitnodiging wél.
    const inv = await req("POST", "/api/invitations", OWNER, { relationship: "club_member", clubId });
    assert(inv.status === 201, `uitnodiging na activatie kreeg ${inv.status}`);
  });

  await scenario("12. Bestaande flow ongewijzigd: club zonder concept-flag is direct actief", async () => {
    const r = await req("POST", "/api/clubs", OUTSIDER, { name: `Onboardingclub ${RUN} legacy` });
    assert(r.status === 201, `legacy aanmaken kreeg ${r.status}`);
    assert(r.json["status"] === "actief", `legacy status is ${r.json["status"]}, verwacht actief`);
    const owners = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, Number(r.json["id"])), eq(clubMembersTable.role, "owner")));
    assert(owners.length === 1, "legacy club mist eigenaar");
  });

  await scenario("13. Fout- en lege toestanden zijn onderscheiden", async () => {
    // (a) lege import
    const empty = await req("POST", `/api/clubs/${clubId}/import`, OWNER, { rows: [] });
    assert(empty.status === 400 && /geen rijen/i.test(String(empty.json["error"])), "lege import niet onderscheiden");
    // (b) onbekende batch = technische fout met eerlijke melding
    const gone = await req("POST", `/api/clubs/${clubId}/import/999999/confirm`, OWNER);
    assert(gone.status === 404, "onbekende batch niet eerlijk gemeld");
    // (c) dubbel bevestigen
    const again = await req("POST", `/api/clubs/${clubId}/import/${bigBatchId}/confirm`, OWNER);
    assert(again.status === 409, "dubbele bevestiging niet geweigerd");
    // (d) activeren terwijl al actief → eerlijk, geen fout
    const act = await req("POST", `/api/clubs/${clubId}/activate`, OWNER);
    assert(act.status === 200 && act.json["alActief"] === true, "heractivatie niet eerlijk gemeld");
    // (e) rol toewijzen aan onbekend account
    const mgr = await req("POST", `/api/clubs/${clubId}/onboarding/managers`, OWNER, {
      email: `bestaat-niet-${RUN}@sparki.test`,
      role: "trainer",
    });
    assert(mgr.status === 404 && /nog geen account/i.test(String(mgr.json["error"])), "onbekend account niet eerlijk gemeld");
    // (f) onvolledig voor activatie is al bewezen in scenario 2 (422 + lijst).
  });

  await cleanup();

  let failed = 0;
  for (const r of results) {
    if (r.status === "pass") console.log(`✅ ${r.scenario}`);
    else {
      failed++;
      console.log(`❌ ${r.scenario} — ${r.note}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  server?.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
