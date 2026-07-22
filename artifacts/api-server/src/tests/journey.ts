// Journey — DB-backed route contract test voor de persoonlijke tijdlijn en
// het wedstrijddossier.
//
// Boot de ECHTE Express-app en seedt een atleet met een wedstrijd, sessies op
// de wedstrijddag en een tweede gebruiker. Bewijst:
//   • samenstelling van de tijdlijn (wedstrijd + handmatig item verschijnen)
//   • auto-koppeling kiest de LANGSTE sessie op de wedstrijddag
//   • handmatige correctie + "geen activiteit" + eigendomscheck op sessies
//   • terugblik-upsert (één rij, tweede PUT werkt bij)
//   • dossier-isolatie tussen accounts
//   • media-eigendomscheck, minderjarigen-blokkade op "gedeeld" (fail-closed)
//   • deelkaart-whitelist (alleen gekozen velden, onbekende velden genegeerd)
//
// Run: `pnpm --filter @workspace/api-server run test:journey`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  racesTable,
  trainingSessionsTable,
  journeyItemsTable,
  journeyMediaTable,
  journeyReflectionsTable,
  athleteProfilesTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
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
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
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
      } else reject(new Error("failed to determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

const RUN = `test_journey_${Date.now()}`;
const clerkA = `${RUN}_a`; // volwassen atleet (geboortedatum gezet)
const clerkB = `${RUN}_b`; // tweede account (isolatie)
const clerkM = `${RUN}_m`; // profiel zonder geboortedatum → fail-closed minor

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function cleanup() {
  for (const c of [clerkA, clerkB, clerkM]) {
    await db.delete(journeyMediaTable).where(eq(journeyMediaTable.clerkId, c)).catch(() => {});
    await db.delete(journeyReflectionsTable).where(eq(journeyReflectionsTable.clerkId, c)).catch(() => {});
    await db.delete(journeyItemsTable).where(eq(journeyItemsTable.clerkId, c)).catch(() => {});
    await db.delete(racesTable).where(eq(racesTable.clerkId, c)).catch(() => {});
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, c)).catch(() => {});
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, c)).catch(() => {});
  }
}

async function main() {
  await startServer();

  await ensureAccount(clerkA, `${clerkA}@example.test`, "Renner A", silentLogger);
  await ensureAccount(clerkB, `${clerkB}@example.test`, "Renner B", silentLogger);
  await ensureAccount(clerkM, `${clerkM}@example.test`, "Renner M", silentLogger);

  // A is aantoonbaar volwassen; M heeft bewust GEEN geboortedatum.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: "1990-05-01", birthYear: 1990 })
    .where(eq(athleteProfilesTable.clerkId, clerkA));

  const raceDate = "2026-06-14";
  const [raceA] = await db
    .insert(racesTable)
    .values({
      clerkId: clerkA,
      name: `${RUN} Omloop`,
      raceDate,
      location: "Testdorp",
      discipline: "road",
      result: { position: 7, fieldSize: 60, status: "finished" },
    })
    .returning();
  const [raceB] = await db
    .insert(racesTable)
    .values({ clerkId: clerkB, name: `${RUN} B-koers`, raceDate })
    .returning();
  const [raceM] = await db
    .insert(racesTable)
    .values({ clerkId: clerkM, name: `${RUN} M-koers`, raceDate })
    .returning();

  // Twee sessies op de wedstrijddag: de langste moet automatisch winnen.
  const [shortSession] = await db
    .insert(trainingSessionsTable)
    .values({ clerkId: clerkA, sessionDate: raceDate, title: "Losrijden", durationMin: 40 })
    .returning();
  const [longSession] = await db
    .insert(trainingSessionsTable)
    .values({ clerkId: clerkA, sessionDate: raceDate, title: "Koers", durationMin: 150, avgPower: 230 })
    .returning();
  const [otherDaySession] = await db
    .insert(trainingSessionsTable)
    .values({ clerkId: clerkA, sessionDate: "2026-06-10", title: "Training", durationMin: 90 })
    .returning();
  const [sessionOfB] = await db
    .insert(trainingSessionsTable)
    .values({ clerkId: clerkB, sessionDate: raceDate, title: "B-rit", durationMin: 120 })
    .returning();

  // 1. Tijdlijn bevat de wedstrijd
  await scenario("tijdlijn bevat de geseedde wedstrijd als 'wedstrijd'-event", async () => {
    const r = await req("GET", "/api/journey", clerkA);
    assert(r.status === 200, `status ${r.status}`);
    const ev = (r.json.events as any[]).find(
      (e) => e.kind === "wedstrijd" && e.ref.id === raceA!.id,
    );
    assert(ev, "wedstrijd-event ontbreekt");
    assert(ev.date === raceDate, "verkeerde datum");
  });

  // 2. Handmatig item verschijnt in de tijdlijn
  let itemId = 0;
  await scenario("handmatig mijlpaal-item verschijnt in de tijdlijn", async () => {
    const c = await req("POST", "/api/journey/items", clerkA, {
      kind: "mijlpaal",
      title: "Eerste top-10",
      startDate: raceDate,
    });
    assert(c.status === 201, `status ${c.status}`);
    itemId = c.json.item.id;
    const r = await req("GET", "/api/journey?kinds=mijlpaal", clerkA);
    const ev = (r.json.events as any[]).find((e) => e.ref.id === itemId);
    assert(ev, "mijlpaal ontbreekt in tijdlijn");
  });

  // 3. Ongeldig soort → 400
  await scenario("item met ongeldig soort wordt geweigerd (400)", async () => {
    const c = await req("POST", "/api/journey/items", clerkA, {
      kind: "vakantie",
      title: "x",
      startDate: raceDate,
    });
    assert(c.status === 400, `status ${c.status}`);
  });

  // 4. Auto-koppeling kiest langste sessie op de wedstrijddag
  await scenario("auto-koppeling kiest de langste sessie op de wedstrijddag", async () => {
    const r = await req("GET", `/api/journey/race/${raceA!.id}`, clerkA);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json.activity.mode === "auto", `mode ${r.json.activity.mode}`);
    assert(
      r.json.activity.session?.id === longSession!.id,
      `verwacht sessie ${longSession!.id}, kreeg ${r.json.activity.session?.id}`,
    );
  });

  // 5. Handmatige correctie naar eigen sessie
  await scenario("handmatige koppeling naar eigen sessie werkt", async () => {
    const r = await req("PUT", `/api/journey/race/${raceA!.id}/link`, clerkA, {
      mode: "manual",
      sessionId: otherDaySession!.id,
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json.activity.session?.id === otherDaySession!.id, "verkeerde sessie gekoppeld");
  });

  // 6. Handmatige koppeling naar sessie van ander account → 404
  await scenario("koppeling naar andermans sessie wordt geweigerd (404)", async () => {
    const r = await req("PUT", `/api/journey/race/${raceA!.id}/link`, clerkA, {
      mode: "manual",
      sessionId: sessionOfB!.id,
    });
    assert(r.status === 404, `status ${r.status}`);
  });

  // 7. "Geen activiteit" → session null, mode none
  await scenario("'geen activiteit' zet de koppeling honest op none", async () => {
    const r = await req("PUT", `/api/journey/race/${raceA!.id}/link`, clerkA, { mode: "none" });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json.activity.mode === "none" && r.json.activity.session === null, "none-koppeling faalt");
  });

  // 8. Terugblik-upsert: tweede PUT werkt dezelfde rij bij
  await scenario("terugblik-upsert houdt één rij per wedstrijd", async () => {
    const a = await req("PUT", `/api/journey/race/${raceA!.id}/reflection`, clerkA, {
      reflection: "Zwaar maar goed",
      lesson: "Eerder voorin zitten",
    });
    assert(a.status === 200, `status ${a.status}`);
    const b = await req("PUT", `/api/journey/race/${raceA!.id}/reflection`, clerkA, {
      reflection: "Bijgewerkt",
      lesson: "Eerder voorin zitten",
      nextAction: "Positioneringstraining",
    });
    assert(b.status === 200, `status ${b.status}`);
    const rows = await db
      .select()
      .from(journeyReflectionsTable)
      .where(
        and(
          eq(journeyReflectionsTable.clerkId, clerkA),
          eq(journeyReflectionsTable.raceId, raceA!.id),
        ),
      );
    assert(rows.length === 1, `verwacht 1 rij, kreeg ${rows.length}`);
    assert(rows[0]!.reflection === "Bijgewerkt", "reflection niet bijgewerkt");
  });

  // 9. Dossier van andermans wedstrijd → 404
  await scenario("dossier van andermans wedstrijd is onbereikbaar (404)", async () => {
    const r = await req("GET", `/api/journey/race/${raceB!.id}`, clerkA);
    assert(r.status === 404, `status ${r.status}`);
  });

  // 10. Media registreren bij een onderwerp dat niet van jou is → 404
  await scenario("media bij andermans wedstrijd wordt geweigerd (404)", async () => {
    const r = await req("POST", "/api/journey/media", clerkA, {
      subjectType: "race",
      subjectId: raceB!.id,
      objectPath: "/objects/uploads/nep",
      mediaType: "image/jpeg",
    });
    assert(r.status === 404, `status ${r.status}`);
  });

  // Seed mediarows direct (de presign/ACL-flow vergt echte object storage).
  const [mediaA] = await db
    .insert(journeyMediaTable)
    .values({
      clerkId: clerkA,
      subjectType: "race",
      subjectId: raceA!.id,
      objectPath: "/objects/uploads/test-a",
      mediaType: "image/jpeg",
      sortIndex: 0,
    })
    .returning();
  const [mediaM] = await db
    .insert(journeyMediaTable)
    .values({
      clerkId: clerkM,
      subjectType: "race",
      subjectId: raceM!.id,
      objectPath: "/objects/uploads/test-m",
      mediaType: "image/jpeg",
      sortIndex: 0,
    })
    .returning();

  // 11. Onbekende leeftijd → delen geblokkeerd (fail-closed minderjarig)
  await scenario("zonder geboortedatum blijft media privé (403 op 'gedeeld')", async () => {
    const r = await req("PUT", `/api/journey/media/${mediaM!.id}`, clerkM, {
      visibility: "gedeeld",
    });
    assert(r.status === 403, `status ${r.status}`);
    const [row] = await db
      .select()
      .from(journeyMediaTable)
      .where(eq(journeyMediaTable.id, mediaM!.id));
    assert(row!.visibility === "prive", "media werd toch gedeeld");
  });

  // 12. Volwassene mag wél op 'gedeeld' zetten; onderschrift werkt mee
  await scenario("volwassene kan media op 'gedeeld' zetten en onderschrift geven", async () => {
    const r = await req("PUT", `/api/journey/media/${mediaA!.id}`, clerkA, {
      visibility: "gedeeld",
      caption: "Finishfoto",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json.media.visibility === "gedeeld", "visibility niet gezet");
    assert(r.json.media.caption === "Finishfoto", "caption niet gezet");
  });

  // 13. Media van een ander kun je niet bijwerken of verwijderen
  await scenario("andermans media bijwerken/verwijderen faalt (404)", async () => {
    const u = await req("PUT", `/api/journey/media/${mediaM!.id}`, clerkA, { caption: "hack" });
    assert(u.status === 404, `update status ${u.status}`);
    const d = await req("DELETE", `/api/journey/media/${mediaM!.id}`, clerkA);
    assert(d.status === 404, `delete status ${d.status}`);
  });

  // 14. Deelkaart: alleen gekozen velden, onbekende velden genegeerd
  await scenario("deelkaart bevat uitsluitend gekozen velden", async () => {
    const r = await req("POST", `/api/journey/race/${raceA!.id}/share-card`, clerkA, {
      fields: ["naam", "uitslag", "geheim_veld", "terugblik"],
      mediaIds: [mediaA!.id],
    });
    assert(r.status === 200, `status ${r.status}`);
    const keys = Object.keys(r.json.fields);
    assert(keys.includes("naam") && keys.includes("uitslag"), "gekozen velden ontbreken");
    assert(!keys.includes("geheim_veld"), "onbekend veld lekte door");
    assert(!keys.includes("datum") && !keys.includes("locatie"), "niet-gekozen veld lekte door");
    assert(r.json.media.length === 1 && r.json.media[0].id === mediaA!.id, "media-selectie klopt niet");
  });

  // 14b. Deelkaart: privé-media wordt server-side geweigerd (nooit UI-only)
  await scenario("deelkaart weigert privé-media (400), ook gemengd met deelbare", async () => {
    const [privateMedia] = await db
      .insert(journeyMediaTable)
      .values({
        clerkId: clerkA,
        subjectType: "race",
        subjectId: raceA!.id,
        objectPath: "/objects/uploads/test-a-prive",
        mediaType: "image/jpeg",
        sortIndex: 1,
      })
      .returning();
    const alone = await req("POST", `/api/journey/race/${raceA!.id}/share-card`, clerkA, {
      fields: ["naam"],
      mediaIds: [privateMedia!.id],
    });
    assert(alone.status === 400, `privé alleen: status ${alone.status}`);
    const mixed = await req("POST", `/api/journey/race/${raceA!.id}/share-card`, clerkA, {
      fields: ["naam"],
      mediaIds: [mediaA!.id, privateMedia!.id],
    });
    assert(mixed.status === 400, `gemengd: status ${mixed.status}`);
  });

  // 14c. Minderjarige (onbekende leeftijd) kan geen media op de deelkaart krijgen
  await scenario("deelkaart van minderjarige kan nooit media bevatten (400)", async () => {
    const r = await req("POST", `/api/journey/race/${raceM!.id}/share-card`, clerkM, {
      fields: ["naam"],
      mediaIds: [mediaM!.id],
    });
    assert(r.status === 400, `status ${r.status}`);
  });

  // 15. Deelkaart zonder velden → 400 (nooit stilletjes alles delen)
  await scenario("deelkaart zonder gekozen velden wordt geweigerd (400)", async () => {
    const r = await req("POST", `/api/journey/race/${raceA!.id}/share-card`, clerkA, {
      fields: [],
      mediaIds: [],
    });
    assert(r.status === 400, `status ${r.status}`);
  });

  // 16. Item van een ander verwijderen faalt; eigen item lukt
  await scenario("item-verwijderen is eigenaar-gebonden", async () => {
    const other = await req("DELETE", `/api/journey/items/${itemId}`, clerkB);
    assert(other.status === 404, `vreemde delete status ${other.status}`);
    const own = await req("DELETE", `/api/journey/items/${itemId}`, clerkA);
    assert(own.status === 200, `eigen delete status ${own.status}`);
  });

  await stopServer();
  await cleanup();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`[${r.status === "pass" ? "PASS" : "FAIL"}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\njourney: ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("journey test crashed:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
