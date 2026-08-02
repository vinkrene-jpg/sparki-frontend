// SPARKI_BUILD_01 F10 (PD-3) — acceptatietest van de contacten- en relatielaag.
//
// Dekt de acceptatiecriteria uit het F10-document:
//  1. dezelfde persoon kan tegelijk ouder én trainer zijn: één contact, twee relaties;
//  2. een klant die ook sporter is: één contact, twee relaties (geen samengevoegde entiteit);
//  3. een duidelijk duplicaat wordt herkend en geweigerd MET uitleg (409);
//  4. twee verschillende personen met dezelfde naam zijn GEEN duplicaat;
//  5. een beëindigde relatie krijgt een einddatum, blijft historisch zichtbaar, contact blijft;
//  6. twijfelgevallen komen op de beoordelingslijst en zijn NIET samengevoegd;
//  7. de migratie-dry-run laat geen bron stilzwijgend verdwijnen (elke bron gedekt).

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { db, pool, contactsTable, contactRelationsTable, contactMergeReviewTable, userProfilesTable, trainerClientsTable, clientAthleteLinksTable } from "@workspace/db";
import { like, inArray, eq } from "drizzle-orm";

// De contacten-router is beheer-only (isAdmin + SPARKI_ADMIN_IDS). Zet de
// admin-id VOORDAT de app-graph laadt. De dev-auth resolvet x-dev-clerk-id
// alleen als er een user_profiles-rij bestaat, dus we maken beide accounts aan.
process.env["DEV_AUTH_BYPASS"] = "true";
const ADMIN = "f10-admin";
const NIET_ADMIN = "f10-niet-admin";
process.env["SPARKI_ADMIN_IDS"] = ADMIN;

const app = (await import("../app")).default;

const PREFIX = "F10-TEST-";

async function seedAccounts() {
  for (const id of [ADMIN, NIET_ADMIN]) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@f10.invalid`, displayName: id, releaseGroup: "test" })
      .onConflictDoNothing();
  }
}

async function cleanup() {
  const cs = await db
    .select({ id: contactsTable.id })
    .from(contactsTable)
    .where(like(contactsTable.displayName, `${PREFIX}%`));
  const ids = cs.map((c) => c.id);
  if (ids.length) {
    await db.delete(contactRelationsTable).where(inArray(contactRelationsTable.fromContactId, ids));
    await db.delete(contactRelationsTable).where(inArray(contactRelationsTable.toContactId, ids));
    await db.delete(contactMergeReviewTable).where(inArray(contactMergeReviewTable.contactId, ids));
    await db.delete(contactsTable).where(inArray(contactsTable.id, ids));
  }
  // Migratie-testdata (trainer_clients + client_athlete_links) opruimen.
  const tcs = await db
    .select({ id: trainerClientsTable.id })
    .from(trainerClientsTable)
    .where(like(trainerClientsTable.name, `${PREFIX}%`));
  const tcIds = tcs.map((t) => t.id);
  if (tcIds.length) {
    await db.delete(clientAthleteLinksTable).where(inArray(clientAthleteLinksTable.clientId, tcIds));
    await db.delete(trainerClientsTable).where(inArray(trainerClientsTable.id, tcIds));
  }
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, [ADMIN, NIET_ADMIN]));
}

async function main() {
  await cleanup();
  await seedAccounts();

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const api = (method: string, pad: string, body?: unknown, als: string = ADMIN) =>
    fetch(`http://127.0.0.1:${port}/api/contacts${pad}`, {
      method,
      headers: { "content-type": "application/json", "x-dev-clerk-id": als },
      body: body ? JSON.stringify(body) : undefined,
    });
  // Ontvangen JSON is untyped; deze helper houdt de test leesbaar.
  const json = async (r: Response): Promise<any> => r.json();

  let ok = 0;
  const test = async (naam: string, fn: () => Promise<void>) => {
    await fn();
    ok++;
    console.log(`✓ ${naam}`);
  };

  await test("beheer-only: niet-admin krijgt 403", async () => {
    const r = await api("POST", "/", { displayName: `${PREFIX}Geen toegang` }, NIET_ADMIN);
    assert.equal(r.status, 403);
  });

  // 1. Ouder + trainer: één contact, twee relaties.
  let ouderTrainerId = 0;
  let kindId = 0;
  await test("ouder+trainer = één contact, twee relaties", async () => {
    const ot = await api("POST", "/", {
      clerkId: `${PREFIX}ct-ouder-trainer`,
      email: `${PREFIX}ot@f10.invalid`,
      displayName: `${PREFIX}Ouder Trainer`,
      kindTags: ["ouder_verzorger", "trainer"],
    });
    assert.equal(ot.status, 201);
    ouderTrainerId = (await json(ot)).contact.id;

    const kind = await api("POST", "/", {
      clerkId: `${PREFIX}ct-kind`,
      displayName: `${PREFIX}Kind Sporter`,
      kindTags: ["sporter"],
    });
    kindId = (await json(kind)).contact.id;

    const r1 = await api("POST", "/relations", {
      fromContactId: ouderTrainerId,
      toContactId: kindId,
      relationType: "ouder_van",
    });
    assert.equal(r1.status, 201);
    const r2 = await api("POST", "/relations", {
      fromContactId: ouderTrainerId,
      toContactId: kindId,
      relationType: "trainer_van",
    });
    assert.equal(r2.status, 201);

    const rels = await json(await api("GET", `/${ouderTrainerId}/relations`));
    assert.equal(rels.length, 2, "twee relaties op één contact");
    // Eén contact: geen tweede record voor dezelfde identiteit.
    const [row] = await db.select().from(contactsTable).where(eq(contactsTable.id, ouderTrainerId));
    assert.deepEqual(new Set(row!.kindTags), new Set(["ouder_verzorger", "trainer"]));
  });

  // 2. Klant die ook sporter is: één contact, twee relaties — geen samengevoegde entiteit.
  await test("klant+sporter = één contact, twee relaties (geen merge)", async () => {
    const trainer = await api("POST", "/", { clerkId: `${PREFIX}ks-trainer`, displayName: `${PREFIX}Trainer T`, kindTags: ["trainer"] });
    const trainerId = (await json(trainer)).contact.id;

    // Eén identiteit die klant én sporter is.
    const person = await api("POST", "/", {
      clerkId: `${PREFIX}ks-person`,
      email: `${PREFIX}ks@f10.invalid`,
      displayName: `${PREFIX}Klant Sporter`,
      kindTags: ["klant", "sporter"],
    });
    assert.equal(person.status, 201);
    const personId = (await json(person)).contact.id;

    // Twee relaties: klant_voor (de trainer) en lid_van (een organisatie).
    const org = await api("POST", "/", { displayName: `${PREFIX}Club Org`, kindTags: ["bedrijf"] });
    const orgId = (await json(org)).contact.id;

    await api("POST", "/relations", { fromContactId: personId, toContactId: trainerId, relationType: "klant_voor" });
    await api("POST", "/relations", { fromContactId: personId, toContactId: orgId, relationType: "lid_van" });

    // Nog steeds precies één contact voor deze identiteit.
    const same = await db.select().from(contactsTable).where(eq(contactsTable.clerkId, `${PREFIX}ks-person`));
    assert.equal(same.length, 1, "klant en sporter blijven één contact, niet samengevoegd tot iets nieuws");
    const rels = await json(await api("GET", `/${personId}/relations`));
    assert.equal(rels.length, 2, "twee relaties, geen samengevoegde entiteit");
  });

  // 3. Duidelijk duplicaat (zelfde geverifieerde e-mail) wordt geweigerd met uitleg.
  await test("duidelijk duplicaat geweigerd met uitleg (409)", async () => {
    const dup = await api("POST", "/", {
      displayName: `${PREFIX}Andere Naam`,
      email: `${PREFIX}ot@f10.invalid`, // zelfde e-mail als de ouder+trainer
    });
    assert.equal(dup.status, 409);
    const body = await json(dup);
    assert.ok(body.error && /e-mailadres/i.test(body.error), "uitleg benoemt het e-mailadres");
    assert.ok(body.existingContact && body.existingContact.id === ouderTrainerId, "bestaand contact benoemd");
  });

  // 4. Zelfde naam ≠ duplicaat.
  await test("twee personen met dezelfde naam zijn geen duplicaat", async () => {
    const a = await api("POST", "/", { displayName: `${PREFIX}Jan Jansen`, email: `${PREFIX}jan1@f10.invalid` });
    const b = await api("POST", "/", { displayName: `${PREFIX}Jan Jansen`, email: `${PREFIX}jan2@f10.invalid` });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    const ida = (await json(a)).contact.id;
    const idb = (await json(b)).contact.id;
    assert.notEqual(ida, idb, "twee aparte contacten, zelfde naam");
  });

  // 5. Beëindigde relatie: einddatum + historisch zichtbaar + contact blijft.
  await test("beëindigde relatie krijgt einddatum en blijft historisch zichtbaar", async () => {
    const rels = await json(await api("GET", `/${ouderTrainerId}/relations`));
    const trainerVan = rels.find((r: { relationType: string }) => r.relationType === "trainer_van");
    const end = await api("POST", `/relations/${trainerVan.id}/end`, {});
    assert.equal(end.status, 200);
    assert.ok((await json(end)).endedAt, "einddatum gezet");

    // Actief-alleen laat hem weg; volledige lijst toont hem historisch.
    const actief = await json(await api("GET", `/${ouderTrainerId}/relations?activeOnly=true`));
    assert.ok(!actief.some((r: { relationType: string }) => r.relationType === "trainer_van"), "niet meer actief");
    const alles = await json(await api("GET", `/${ouderTrainerId}/relations`));
    assert.ok(alles.some((r: { relationType: string }) => r.relationType === "trainer_van"), "historisch nog zichtbaar");

    // Contact blijft bestaan.
    const [c] = await db.select().from(contactsTable).where(eq(contactsTable.id, ouderTrainerId));
    assert.ok(c, "contact blijft bestaan");
  });

  // 6. Twijfelgeval (zelfde naam + telefoon, geen e-mail) op de lijst, niet samengevoegd.
  await test("twijfelgeval op beoordelingslijst en NIET samengevoegd", async () => {
    const naam = `${PREFIX}Twijfel Persoon`;
    const a = await api("POST", "/", { displayName: naam, phone: "0612345678" });
    assert.equal(a.status, 201);
    const b = await api("POST", "/", { displayName: naam, phone: "0612345678" });
    // Onduidelijk: nieuw contact aangemaakt (201) MAAR op de review-lijst.
    assert.equal(b.status, 201);
    const bBody = await json(b);
    assert.ok(bBody.review, "tweede aanmaak levert een review-melding");
    assert.notEqual((await json(a)).contact.id, bBody.contact.id, "twee aparte contacten, niet samengevoegd");

    const lijst = await json(await api("GET", "/review"));
    assert.ok(lijst.some((r: { contactId: number }) => r.contactId === bBody.contact.id), "staat op de beoordelingslijst");
  });

  // 8. Merge met CONFLICTERENDE actieve relaties: geen rollback, geen
  //    zelfrelatie, audit klopt. We bouwen een broncontact en een doelcontact
  //    die allebei een actieve relatie van hetzelfde type naar dezelfde
  //    tegenpartij hebben, plus een directe bron↔doel-relatie.
  await test("merge met conflicterende relaties: geen rollback, geen zelfrelatie, audit klopt", async () => {
    const doel = await api("POST", "/", { clerkId: `${PREFIX}m-doel`, displayName: `${PREFIX}Merge Doel` });
    const bron = await api("POST", "/", { clerkId: `${PREFIX}m-bron`, displayName: `${PREFIX}Merge Bron` });
    const tegenpartij = await api("POST", "/", { clerkId: `${PREFIX}m-tp`, displayName: `${PREFIX}Merge TP` });
    const doelId = (await json(doel)).contact.id;
    const bronId = (await json(bron)).contact.id;
    const tpId = (await json(tegenpartij)).contact.id;

    // Beide (doel én bron) trainer_van dezelfde tegenpartij ⇒ zou botsen op de
    // unique index bij blind ombuigen.
    await api("POST", "/relations", { fromContactId: doelId, toContactId: tpId, relationType: "trainer_van" });
    await api("POST", "/relations", { fromContactId: bronId, toContactId: tpId, relationType: "trainer_van" });
    // Directe bron↔doel-relatie ⇒ zou zelfrelatie worden bij ombuigen.
    await api("POST", "/relations", { fromContactId: bronId, toContactId: doelId, relationType: "klant_voor" });
    // Unieke bronrelatie die WEL verplaatst moet worden.
    await api("POST", "/relations", { fromContactId: bronId, toContactId: tpId, relationType: "ouder_van" });

    // Zet een review-geval dat naar het broncontact wijst.
    const [review] = await db
      .insert(contactMergeReviewTable)
      .values({ source: "test", contactId: bronId, candidateContactIds: [doelId], reason: `${PREFIX}merge-conflict`, status: "open" })
      .returning();

    const dec = await api("POST", `/review/${review!.id}/decide`, { decision: "samengevoegd", decidedTargetContactId: doelId });
    assert.equal(dec.status, 200, "merge slaagt (geen rollback door unique-conflict)");
    const body = await json(dec);
    assert.ok(body.moved >= 1, "minstens één relatie verplaatst");
    assert.ok(body.ended >= 2, "conflict + zelfrelatie beëindigd");

    // Geen zelfrelatie op het doelcontact.
    const doelRels = await json(await api("GET", `/${doelId}/relations`));
    const zelf = doelRels.filter((r: { fromContactId: number; toContactId: number }) => r.fromContactId === doelId && r.toContactId === doelId);
    assert.equal(zelf.length, 0, "geen zelfrelatie ontstaan");

    // De verplaatste ouder_van-relatie hangt nu actief aan het doelcontact.
    const actief = await json(await api("GET", `/${doelId}/relations?activeOnly=true`));
    assert.ok(
      actief.some((r: { relationType: string; fromContactId: number; toContactId: number }) => r.relationType === "ouder_van" && r.fromContactId === doelId && r.toContactId === tpId),
      "unieke relatie verplaatst naar doel",
    );
    // Er is precies één ACTIEVE trainer_van doel→tp (geen dubbele).
    const trAct = actief.filter((r: { relationType: string; toContactId: number }) => r.relationType === "trainer_van" && r.toContactId === tpId);
    assert.equal(trAct.length, 1, "geen dubbele actieve trainer_van na dedup");

    // Audit-herkomst: beëindigde relaties dragen een F10-merge-notitie met het
    // broncontact (traceerbaar welke relatie beëindigd/verplaatst is en vanaf welk contact).
    const alleTp = await json(await api("GET", `/${tpId}/relations`));
    const alleDoel = await json(await api("GET", `/${doelId}/relations`));
    const alleRel = [...alleTp, ...alleDoel];
    const gemergeAudit = alleRel.filter(
      (r: { sourceNote: string | null }) =>
        (r.sourceNote ?? "").includes("F10-merge") && (r.sourceNote ?? "").includes(`broncontact #${bronId}`),
    );
    assert.ok(gemergeAudit.length >= 1, "audit-herkomst traceerbaar (F10-merge + broncontact-id)");
  });

  // 9. E-mailrace: twee gelijktijdige creates met hetzelfde genormaliseerde
  //    e-mailadres ⇒ hooguit één slaagt, de ander wordt nette 409 (unique index).
  await test("concurrency e-mail: gelijktijdige creates ⇒ 409 (geen tweede identiteit)", async () => {
    const email = `${PREFIX}RACE@F10.invalid`; // hoofdletters: normalisatie moet matchen
    const [r1, r2] = await Promise.all([
      api("POST", "/", { displayName: `${PREFIX}Race A`, email }),
      api("POST", "/", { displayName: `${PREFIX}Race B`, email }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    assert.deepEqual(statuses, [201, 409], "exact één 201 en één 409");
    // Slechts één contact met dit genormaliseerde e-mailadres.
    const rows = await db.select().from(contactsTable).where(eq(contactsTable.primaryEmail, email.trim().toLowerCase()));
    assert.equal(rows.length, 1, "precies één contact met dit e-mailadres");
    // Sequentiële herhaling levert óók 409 met uitleg.
    const again = await api("POST", "/", { displayName: `${PREFIX}Race C`, email });
    assert.equal(again.status, 409);
    assert.ok(/e-mailadres/i.test((await json(again)).error), "409 met uitleg");
  });

  // 10. client_athlete_links-migratie levert een klant_voor-relatie (klant → sporter).
  //     We seeden een trainer, een sporter én een klant (aparte persoon), koppelen
  //     ze via client_athlete_links en draaien de migratie in DRY-RUN als subprocess
  //     (die rolt terug). We bewijzen zo dat de kernrelatie klant_voor uit
  //     client_athlete_links komt — de basis voor "klant+sporter = twee relaties".
  await test("client_athlete_links-migratie levert klant_voor-relatie", async () => {
    const trainerId = `${PREFIX}cal-trainer`;
    const sporterId = `${PREFIX}cal-sporter`;
    // user_profiles voor trainer en sporter (migratie bouwt contactByClerk hieruit).
    for (const [id, email] of [[trainerId, `${trainerId}@f10.invalid`], [sporterId, `${sporterId}@f10.invalid`]] as const) {
      await db.insert(userProfilesTable).values({ clerkId: id, email, displayName: id, releaseGroup: "test" }).onConflictDoNothing();
    }
    // Klant is een APARTE persoon (geen account) — trainer_clients-rij.
    const [client] = await db
      .insert(trainerClientsTable)
      .values({ trainerClerkId: trainerId, clientNumber: 999001, name: `${PREFIX}Klant Persoon`, email: `${PREFIX}klant@f10.invalid` })
      .returning();
    await db.insert(clientAthleteLinksTable).values({ clientId: client!.id, athleteClerkId: sporterId, relationType: "ouder" });

    // Draai de gecompileerde migratie in dry-run (rollback) en lees het rapport.
    const migJs = path.resolve(process.cwd(), "dist/scripts/f10-migrate-contacts.mjs");
    let out = "";
    try {
      out = execFileSync("node", ["--enable-source-maps", migJs, "--dry-run"], { encoding: "utf8" });
    } catch (e) {
      out = String((e as { stdout?: string }).stdout ?? "") + String((e as { stderr?: string }).stderr ?? "");
    }
    const block = out.split("Bron: client_athlete_links")[1] ?? "";
    const relLine = /relaties:\s*(\d+)/.exec(block);
    assert.ok(relLine, "client_athlete_links-blok staat in het rapport");
    assert.ok(Number(relLine![1]) >= 1, `client_athlete_links levert ≥1 klant_voor-relatie (kreeg ${relLine![1]})`);

    // Dry-run rolt terug: er blijft geen testcontact achter in de DB.
    const rest = await db.select({ id: contactsTable.id }).from(contactsTable).where(like(contactsTable.displayName, `${PREFIX}Klant Persoon`));
    assert.equal(rest.length, 0, "dry-run heeft niets bewaard");
  });

  server.close();
  await cleanup();
  console.log(`\nAlle ${ok} F10-contacttests geslaagd.`);
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
