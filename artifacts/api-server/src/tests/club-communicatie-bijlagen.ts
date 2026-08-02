// SPARKI_BUILD_01 F7 — bewijs clubcommunicatie met bijlagen.
//
// Dekt de acceptatiecriteria uit het bindende document:
// - bericht + bijlage zichtbaar voor ontvanger; download werkt;
// - onbevoegde ziet/downloadt de bijlage niet, ook niet met directe attachment-id;
// - ingetrokken bestand niet meer downloadbaar (410), ook via oude link;
// - geweigerd type ⇒ nette melding + niets opgeslagen;
// - verkleed bestand (verkeerde magic bytes) geweigerd op inhoud;
// - pushmelding bevat geen berichttekst/bestandsnaam;
// - gelezenstatus per ontvanger;
// - retentie is configuratiewaarde, niet hardcoded;
// - <16-regels: geen ongevraagd contact; ouder leest mee; groep is één richting.

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  clubTeamMembersTable,
  clubMessagesTable,
  messageAttachmentsTable,
  filesTable,
  notificationsTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";
import { sniffContentType } from "../lib/files";
import {
  runClubMessageRetention,
  clubMessageRetentionDays,
} from "../lib/club-message-retention";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "f7comm-test-";
const ids = {
  owner: `${PREFIX}owner`,
  lid: `${PREFIX}lid`,
  buiten: `${PREFIX}buiten`,
  coach: `${PREFIX}coach`,
  jeugd: `${PREFIX}jeugd`, // <16
  ouder: `${PREFIX}ouder`,
  vreemde: `${PREFIX}vreemde`, // volwassene zonder koppeling
};

// Een echte, geldige 8x8 PNG (her-encodeerbaar door sharp).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPgqjiBFTEMLQkADShSgdHoYMoAAAAASUVORK5CYII=",
  "base64",
);
// Een "verkleed" bestand: naam claimt .png, maar de bytes zijn een ZIP (PK…).
const FAKE_ZIP = Buffer.from("504b0304140000000800", "hex");
// Een uitvoerbaar/onbekend type dat expliciet geweigerd moet worden.
const ELF = Buffer.from("7f454c46020101000000000000000000", "hex");

async function cleanup() {
  const clubs = await db.select({ id: clubsTable.id }).from(clubsTable).where(like(clubsTable.name, "F7comm%"));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(clubMessagesTable).where(eq(clubMessagesTable.coachClerkId, ids.coach));
  await db.delete(filesTable).where(like(filesTable.ownerClerkId, `${PREFIX}%`));
  await db.delete(coachAthleteLinksTable).where(eq(coachAthleteLinksTable.coachClerkId, ids.coach));
  await db.delete(parentAthleteLinksTable).where(eq(parentAthleteLinksTable.parentClerkId, ids.ouder));
  await db.delete(notificationsTable).where(like(notificationsTable.clerkId, `${PREFIX}%`));
  await db.delete(athleteProfilesTable).where(like(athleteProfilesTable.clerkId, `${PREFIX}%`));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
}

let ok = 0;
const test = async (naam: string, fn: () => Promise<void>) => {
  await fn();
  ok++;
  console.log(`✓ ${naam}`);
};

async function main() {
  await cleanup();
  for (const [k, id] of Object.entries(ids)) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@f7.invalid`, displayName: `F7 ${k}`, releaseGroup: "test" })
      .onConflictDoNothing();
  }
  const thisYear = new Date().getUTCFullYear();
  // jeugd = 12 jaar (<16); coach/vreemde/ouder volwassen.
  await db.insert(athleteProfilesTable).values([
    { clerkId: ids.jeugd, birthYear: thisYear - 12 },
    { clerkId: ids.lid, birthYear: thisYear - 30 },
  ]).onConflictDoNothing();

  const [club] = await db
    .insert(clubsTable)
    .values({ name: "F7comm club", ownerClerkId: ids.owner, status: "actief" })
    .returning({ id: clubsTable.id });
  const clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: ids.owner, role: "owner" },
    { clubId, clerkId: ids.lid, role: "member" },
  ]);
  const [team] = await db.insert(clubTeamsTable).values({ clubId, name: "F7 team" }).returning({ id: clubTeamsTable.id });
  await db.insert(clubTeamMembersTable).values({ teamId: team!.id, clerkId: ids.lid });

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const api = (method: string, pad: string, als: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}${pad}`, {
      method,
      headers: { "content-type": "application/json", "x-dev-clerk-id": als },
      body: body ? JSON.stringify(body) : undefined,
    });

  try {
    // ── Unit: sniffer ──────────────────────────────────────────────────────
    await test("sniffer herkent PNG op inhoud", async () => {
      const r = sniffContentType(PNG_1x1);
      assert.equal(r.ok, true);
      assert.equal((r as { contentType: string }).contentType, "image/png");
    });
    await test("sniffer weigert verkleed ZIP-bestand", async () => {
      assert.equal(sniffContentType(FAKE_ZIP).ok, false);
    });
    await test("sniffer weigert uitvoerbaar bestand", async () => {
      assert.equal(sniffContentType(ELF).ok, false);
    });

    // ── Retentie is config, niet hardcoded ──────────────────────────────────
    await test("retentietermijn komt uit env (default 365), niet hardcoded", async () => {
      assert.equal(clubMessageRetentionDays(), 365);
      process.env["CLUB_MESSAGE_RETENTION_DAYS"] = "30";
      assert.equal(clubMessageRetentionDays(), 30);
      delete process.env["CLUB_MESSAGE_RETENTION_DAYS"];
      assert.equal(clubMessageRetentionDays(), 365);
    });

    // ── Bericht + bijlage plaatsen ───────────────────────────────────────────
    let messageId = 0;
    let attachmentId = 0;
    await test("clubbeheer plaatst clubbericht met afbeelding-bijlage", async () => {
      const r = await api("POST", `/api/clubs/${clubId}/messages`, ids.owner, {
        body: "Welkom allemaal",
        scope: "club",
        attachments: [{ base64: PNG_1x1.toString("base64"), name: "geheim.png" }],
      });
      assert.equal(r.status, 201);
      const row = (await r.json()) as { id: number };
      messageId = row.id;
    });

    await test("geweigerd type wordt niet opgeslagen + nette melding", async () => {
      const before = await db.select().from(clubMessagesTable).where(eq(clubMessagesTable.clubId, clubId));
      const r = await api("POST", `/api/clubs/${clubId}/messages`, ids.owner, {
        body: "kwaadaardig",
        scope: "club",
        attachments: [{ base64: ELF.toString("base64"), name: "malware.png" }],
      });
      assert.equal(r.status, 415);
      const j = (await r.json()) as { error: string };
      assert.match(j.error, /niet ondersteund|geweigerd/i);
      const after = await db.select().from(clubMessagesTable).where(eq(clubMessagesTable.clubId, clubId));
      assert.equal(after.length, before.length, "bericht mag niet zijn opgeslagen");
    });

    await test("verkleed bestand (ZIP als .png) geweigerd op inhoud", async () => {
      const r = await api("POST", `/api/clubs/${clubId}/messages`, ids.owner, {
        body: "verkleed",
        attachments: [{ base64: FAKE_ZIP.toString("base64"), name: "foto.png" }],
      });
      assert.equal(r.status, 415);
    });

    await test("ontvanger ziet bericht + bijlage en kan downloaden", async () => {
      const r = await api("GET", `/api/clubs/${clubId}/messages`, ids.lid);
      assert.equal(r.status, 200);
      const rows = (await r.json()) as Array<{ id: number; attachments: Array<{ id: number; kind: string; url: string; contentType: string }> }>;
      const msg = rows.find((m) => m.id === messageId)!;
      assert.ok(msg, "bericht zichtbaar voor ontvanger");
      assert.equal(msg.attachments.length, 1);
      attachmentId = msg.attachments[0]!.id;
      // Her-encodeerd: PNG → jpeg.
      assert.equal(msg.attachments[0]!.contentType, "image/jpeg");
      const dl = await api("GET", msg.attachments[0]!.url, ids.lid);
      assert.equal(dl.status, 200);
      assert.equal(dl.headers.get("x-content-type-options"), "nosniff");
      assert.match(dl.headers.get("content-disposition") ?? "", /attachment/);
    });

    await test("onbevoegde (niet-lid) kan bijlage niet downloaden, ook niet met directe id", async () => {
      const dl = await api("GET", `/api/clubs/${clubId}/messages/${messageId}/attachments/${attachmentId}`, ids.buiten);
      assert.equal(dl.status, 403);
    });

    await test("gelezenstatus werkt per ontvanger", async () => {
      // lid markeert gelezen; owner niet.
      const mark = await api("POST", `/api/clubs/${clubId}/messages/${messageId}/read`, ids.lid);
      assert.equal(mark.status, 200);
      const asLid = (await (await api("GET", `/api/clubs/${clubId}/messages`, ids.lid)).json()) as Array<{ id: number; read: boolean }>;
      const asOwner = (await (await api("GET", `/api/clubs/${clubId}/messages`, ids.owner)).json()) as Array<{ id: number; read: boolean }>;
      assert.equal(asLid.find((m) => m.id === messageId)!.read, true);
      assert.equal(asOwner.find((m) => m.id === messageId)!.read, false);
    });

    await test("pushmelding bevat geen berichttekst of bestandsnaam", async () => {
      const notes = await db.select().from(notificationsTable).where(eq(notificationsTable.clerkId, ids.lid));
      assert.ok(notes.length >= 1, "ontvanger kreeg een melding");
      for (const n of notes) {
        assert.equal(n.body, null, "geen inhoud in de melding");
        assert.ok(!/geheim|Welkom allemaal/i.test(n.title), "geen tekst/bestandsnaam in titel");
        assert.match(n.title, /Nieuw bericht/);
      }
    });

    await test("ingetrokken bestand is niet meer downloadbaar (410), ook via oude link", async () => {
      const rev = await api("POST", `/api/clubs/${clubId}/messages/${messageId}/attachments/${attachmentId}/revoke`, ids.owner);
      assert.equal(rev.status, 200);
      const dl = await api("GET", `/api/clubs/${clubId}/messages/${messageId}/attachments/${attachmentId}`, ids.lid);
      assert.equal(dl.status, 410);
    });

    // ── Lijn 3a: clubtrainer → groep is één richting ─────────────────────────
    await test("groep-bericht staat geen reacties toe (één richting)", async () => {
      // owner (beheer) plaatst een groep-scope bericht; allowReplies verzoek true
      // wordt genegeerd voor group.
      const { clubGroupsTable } = await import("@workspace/db");
      const [group] = await db.insert(clubGroupsTable).values({ clubId, name: "F7 groep", trainerClerkId: ids.owner }).returning({ id: clubGroupsTable.id });
      const { clubGroupMembersTable } = await import("@workspace/db");
      await db.insert(clubGroupMembersTable).values({ groupId: group!.id, clerkId: ids.lid });
      const r = await api("POST", `/api/clubs/${clubId}/messages`, ids.owner, {
        body: "Training gaat door", scope: "group", groupId: group!.id, allowReplies: true,
      });
      assert.equal(r.status, 201);
      const groupMsg = (await r.json()) as { id: number; allowReplies: boolean };
      assert.equal(groupMsg.allowReplies, false, "reacties uit op groep-scope");
      // lid probeert te reageren ⇒ geweigerd.
      const reply = await api("POST", `/api/clubs/${clubId}/messages`, ids.lid, { body: "mag ik reageren?", parentId: groupMsg.id });
      assert.equal(reply.status, 403);
    });

    // ── Lijn 3b + jeugd: coach ↔ sporter<16, ouder leest mee ─────────────────
    await test("ongevraagd contact zonder koppeling wordt geweigerd (403)", async () => {
      const r = await api("POST", `/api/coach-messages/${ids.vreemde}/${ids.jeugd}`, ids.vreemde, { body: "hoi" });
      assert.equal(r.status, 403);
    });

    await test("gekoppelde coach ↔ sporter<16: twee richtingen + ouder leest mee", async () => {
      await db.insert(coachAthleteLinksTable).values({ coachClerkId: ids.coach, athleteClerkId: ids.jeugd, status: "accepted" });
      await db.insert(parentAthleteLinksTable).values({ parentClerkId: ids.ouder, athleteClerkId: ids.jeugd, status: "accepted" });
      // coach stuurt.
      const send = await api("POST", `/api/coach-messages/${ids.coach}/${ids.jeugd}`, ids.coach, { body: "goede training vandaag" });
      assert.equal(send.status, 201);
      // sporter stuurt terug (twee richtingen).
      const back = await api("POST", `/api/coach-messages/${ids.coach}/${ids.jeugd}`, ids.jeugd, { body: "dankjewel" });
      assert.equal(back.status, 201);
      // ouder leest mee (volledig).
      const asParent = await api("GET", `/api/coach-messages/${ids.coach}/${ids.jeugd}`, ids.ouder);
      assert.equal(asParent.status, 200);
      const pj = (await asParent.json()) as { role: string; parentReadsAlong: boolean; messages: unknown[] };
      assert.equal(pj.role, "parent");
      assert.equal(pj.parentReadsAlong, true);
      assert.equal(pj.messages.length, 2, "ouder ziet alle berichten volledig");
      // ouder mag NIET sturen in deze lijn.
      const parentSend = await api("POST", `/api/coach-messages/${ids.coach}/${ids.jeugd}`, ids.ouder, { body: "ik ook" });
      assert.equal(parentSend.status, 403);
    });

    await test("een vreemde volwassene ziet het jeugd-gesprek niet", async () => {
      const r = await api("GET", `/api/coach-messages/${ids.coach}/${ids.jeugd}`, ids.vreemde);
      assert.equal(r.status, 403);
    });

    // ── Retentie ruimt op en trekt bijlagen in ───────────────────────────────
    await test("retentie ruimt oude berichten op (en trekt hun bijlagen in)", async () => {
      // Plaats een bericht met bijlage en zet createdAt ver in het verleden.
      const r = await api("POST", `/api/clubs/${clubId}/messages`, ids.owner, {
        body: "oud bericht",
        attachments: [{ base64: PNG_1x1.toString("base64"), name: "oud.png" }],
      });
      const oldMsg = (await r.json()) as { id: number };
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 3600 * 1000);
      await db.update(clubMessagesTable).set({ createdAt: twoYearsAgo }).where(eq(clubMessagesTable.id, oldMsg.id));
      const atts = await db.select().from(messageAttachmentsTable).where(eq(messageAttachmentsTable.messageId, oldMsg.id));
      const fileId = atts[0]!.fileId!;
      const summary = await runClubMessageRetention();
      assert.ok(summary.messagesDeleted >= 1);
      const [gone] = await db.select().from(clubMessagesTable).where(eq(clubMessagesTable.id, oldMsg.id));
      assert.equal(gone, undefined, "oud bericht opgeruimd");
      const [f] = await db.select().from(filesTable).where(eq(filesTable.id, fileId));
      assert.ok(f?.revokedAt != null, "bijlage ingetrokken bij opruiming");
    });

    console.log(`\n✅ F7 communicatie met bijlagen — ${ok} controles geslaagd`);
  } finally {
    server.close();
    await cleanup();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
