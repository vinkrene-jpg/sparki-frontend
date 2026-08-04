// MEETNIVEAU_EN_UITLEG_01 §3+§4+§8 — bewijstest meetniveau-waarneming.
//
// Bewijs:
//  1. Meetniveau is een WAARNEMING (laatste 10 activiteiten, drempel 6;
//     herstel op ≥3 van 7 dagen bovenop beide ritsporen) — geen instelling.
//  2. Interne codes (SPOOR_*) verlaten de server nooit (B4).
//  3. T4: valt een spoor weg ⇒ precies ÉÉN melding; blijft weg ⇒ stil;
//     komt terug ⇒ stil terug-groeien, geen melding.
//  4. De wegval-melding is een DATAMELDING: nooit het woord "upgraden" (§4).
//  5. Profielregel (§7): één zin wat Sparki ziet + wat ontbreekt en waarom.
//
// Run: node ./scripts/run-test.mjs meetniveau-sporen --dev-auth

import { and, eq, like } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  activityImportsTable,
  athleteDailyMetricsTable,
  notificationsTable,
} from "@workspace/db";
import app from "../app";
import type { Server } from "node:http";

const USER = "test_meetniveau_sporen";
type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function scenario(name: string, fn: () => Promise<void>) {
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

let server: Server;
let base = "";
async function http(method: string, path: string) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": USER },
  });
  return {
    status: res.status,
    text: await res.text(),
  };
}

function dagenGeleden(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function seedSessies(
  specs: { daysAgo: number; power: boolean; hr: boolean }[],
) {
  for (const s of specs) {
    await db.insert(trainingSessionsTable).values({
      clerkId: USER,
      sessionDate: dagenGeleden(s.daysAgo),
      type: "ride",
      durationMin: 90,
      avgPower: s.power ? 200 : null,
      avgHR: s.hr ? 150 : null,
      signals: { power: s.power, hr: s.hr, duration: true },
    });
  }
}

async function meldingen() {
  return db
    .select({ id: notificationsTable.id, title: notificationsTable.title, body: notificationsTable.body })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, USER),
        eq(notificationsTable.source, "meetniveau"),
      ),
    );
}

async function cleanup() {
  await db.delete(notificationsTable).where(eq(notificationsTable.clerkId, USER));
  await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
  await db.delete(athleteDailyMetricsTable).where(eq(athleteDailyMetricsTable.clerkId, USER));
  await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, USER));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, USER));
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: USER,
    email: `${USER}@example.com`,
    displayName: USER,
    roles: ["athlete"],
    activeRole: "athlete",
  });
  await db.insert(athleteProfilesTable).values({ clerkId: USER });

  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  await scenario("zonder activiteiten: eerlijk niets, geen interne codes naar buiten (B4)", async () => {
    const r = await http("GET", "/api/athlete/meetniveau");
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const j = JSON.parse(r.text);
    assert(j.vermogen === false && j.hartslag === false && j.herstel === false, "sporen moeten uit staan");
    assert(!r.text.includes("SPOOR") && !r.text.includes("HERSTEL_R") && !r.text.includes("BASIS"), "interne codes lekken naar buiten");
    assert(typeof j.profielregel === "string" && j.profielregel.length > 0, "profielregel ontbreekt");
  });

  await scenario("T1-basis: 10 ritten met vermogen én hartslag ⇒ beide sporen actief", async () => {
    await seedSessies(
      Array.from({ length: 10 }, (_, i) => ({ daysAgo: 30 - i, power: true, hr: true })),
    );
    const j = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(j.vermogen === true && j.hartslag === true, `beide sporen verwacht: ${JSON.stringify(j)}`);
    assert(j.herstel === false, "herstel mag zonder nachtmetingen niet actief zijn (B2)");
    assert(j.profielregel.includes("vermogen") && j.profielregel.includes("hartslag"), "profielregel benoemt de sporen niet");
    assert(j.profielregel.toLowerCase().includes("nog niet"), "profielregel moet benoemen wat ontbreekt (§7)");
    assert((await meldingen()).length === 0, "geen melding bij opbouw");
  });

  await scenario("herstel: rusthartslag/HRV op ≥3 van 7 dagen ⇒ herstelspoor actief", async () => {
    for (const d of [0, 1, 2]) {
      await db.insert(athleteDailyMetricsTable).values({
        clerkId: USER,
        metricDate: dagenGeleden(d),
        restingHR: 45,
        hrv: 80,
      });
    }
    const j = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(j.herstel === true, `herstel verwacht: ${JSON.stringify(j)}`);
    assert(j.hersteldagen >= 3, "hersteldagen niet geteld");
    assert((await meldingen()).length === 0, "stil groeien mag geen melding geven");
  });

  await scenario("T4: hartslag valt weg ⇒ precies één datamelding, daarna stil", async () => {
    // 10 nieuwere ritten zonder hartslag verdringen het venster.
    await seedSessies(
      Array.from({ length: 10 }, (_, i) => ({ daysAgo: 10 - i, power: true, hr: false })),
    );
    const j = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(j.vermogen === true && j.hartslag === false, `hartslag moet wegvallen: ${JSON.stringify(j)}`);
    // Herstel is een eigen draagbare-waarneming en staat los van de ritsporen.
    assert(j.herstel === true, "herstel-waarneming mag niet meezakken met een ritspoor");
    const eerste = await meldingen();
    assert(eerste.length === 1, `precies één melding verwacht, kreeg ${eerste.length}`);
    assert(eerste[0].title.toLowerCase().includes("hartslag"), "melding benoemt de sensor niet");
    // §4: datamelding, nooit pakkettaal.
    const tekst = `${eerste[0].title} ${eerste[0].body}`.toLowerCase();
    assert(!tekst.includes("upgrad") && !tekst.includes("pakket") && !tekst.includes("compleet"), "datamelding bevat pakkettaal");
    // Nogmaals uitlezen: geen tweede melding.
    await http("GET", "/api/athlete/meetniveau");
    await http("GET", "/api/athlete/meetniveau");
    assert((await meldingen()).length === 1, "melding mag niet herhalen zolang het spoor weg blijft");
  });

  await scenario("terugkeer: hartslag komt terug ⇒ stil terug-groeien, geen melding", async () => {
    await seedSessies(
      Array.from({ length: 10 }, (_, i) => ({ daysAgo: 9 - i, power: true, hr: true })),
    );
    const j = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(j.hartslag === true, "hartslag moet terug-groeien");
    assert((await meldingen()).length === 1, "terugkeer mag geen nieuwe melding geven");
  });

  await scenario("herhaalde wegval: nieuwe episode ⇒ nieuwe melding (oude is afgesloten)", async () => {
    // Hartslag valt een TWEEDE keer weg. De melding van de eerste episode is
    // bij de terugkeer opgelost, dus de open resolutionKey blokkeert niet.
    await seedSessies(
      Array.from({ length: 10 }, (_, i) => ({ daysAgo: 5, power: true, hr: false })),
    );
    const j = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(j.hartslag === false, "hartslag moet opnieuw wegvallen");
    const rows = await meldingen();
    assert(rows.length === 2, `tweede episode moet een nieuwe melding geven, kreeg ${rows.length}`);
    // En blijft daarna weer stil.
    await http("GET", "/api/athlete/meetniveau");
    assert((await meldingen()).length === 2, "binnen één episode nooit een herhaling");
  });

  await scenario("drempel: 5 van 10 ritten met vermogen is niet genoeg (≥6)", async () => {
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
    await seedSessies(
      Array.from({ length: 10 }, (_, i) => ({ daysAgo: 10 - i, power: i < 5, hr: true })),
    );
    const j = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(j.vermogen === false && j.hartslag === true, `drempel klopt niet: ${JSON.stringify(j)}`);
  });

  await scenario("gelijktijdige refreshes claimen één episode ⇒ nooit dubbele melding", async () => {
    // Hartslag valt opnieuw weg terwijl acht uitleespaden tegelijk verversen.
    const voor = (await meldingen()).filter((m) => m.title.toLowerCase().includes("hartslag")).length;
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
    await seedSessies(
      Array.from({ length: 10 }, () => ({ daysAgo: 3, power: true, hr: false })),
    );
    await Promise.all(
      Array.from({ length: 8 }, () => http("GET", "/api/athlete/meetniveau")),
    );
    const na = (await meldingen()).filter((m) => m.title.toLowerCase().includes("hartslag")).length;
    assert(na === voor + 1, `precies één nieuwe hartslag-melding verwacht, kreeg ${na - voor}`);
  });

  await scenario("pakketpoort is server-side: niet-Compleet krijgt 403 op analyse-endpoints", async () => {
    // Zonder commercieel recht (subscription zonder grants) is de poort
    // fail-closed op de server — de UI-melding is geen autorisatielaag.
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "subscription", productVariant: "sparki_go" })
      .where(eq(userProfilesTable.clerkId, USER));
    const bests = await http("GET", "/api/athlete/power-bests");
    assert(bests.status === 403, `power-bests verwacht 403, kreeg ${bests.status}`);
    assert(bests.text.includes("upgrade_required"), "403 moet als pakketprobleem gecodeerd zijn");
    const zones = await http("GET", "/api/athlete/weekly-zones");
    assert(zones.status === 403, `weekly-zones verwacht 403, kreeg ${zones.status}`);
    // De profielwaarneming zelf (§7) is bewust vrij: geen analysedata.
    const mn = await http("GET", "/api/athlete/meetniveau");
    assert(mn.status === 200, `meetniveau hoort vrij te blijven, kreeg ${mn.status}`);
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "legacy_unrestricted", productVariant: null })
      .where(eq(userProfilesTable.clerkId, USER));
  });

  await scenario("SPOOR_H: alleen hartslag ⇒ belastingsreeks op hartslagbasis, nooit gemengd", async () => {
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
    // Renner zonder vermogensmeter: alle sessies hebben een hartslagbelasting
    // (hrLoad) en géén tss — het belastingsmodel moet dan op de
    // hartslagreeks draaien en dat expliciet zeggen.
    for (let i = 0; i < 6; i++) {
      await db.insert(trainingSessionsTable).values({
        clerkId: USER,
        sessionDate: dagenGeleden(2 + i * 3),
        type: "ride",
        durationMin: 90,
        avgHR: 150,
        hrLoad: 70,
        signals: { power: false, hr: true, duration: true },
      });
    }
    const load = JSON.parse((await http("GET", "/api/athlete/load")).text);
    assert(load.basis === "hartslag", `basis hartslag verwacht, kreeg ${load.basis}`);
    assert(load.ctl > 0, "hartslagreeks moet echte fitheid opleveren");
    // Eén vermogenssessie erbij ⇒ reeks slaat om naar vermogensbasis en de
    // hartslagsessies tellen expliciet als buiten-basis (nooit optellen).
    await db.insert(trainingSessionsTable).values({
      clerkId: USER,
      sessionDate: dagenGeleden(1),
      type: "ride",
      durationMin: 60,
      avgPower: 200,
      tss: 60,
      signals: { power: true, hr: false, duration: true },
    });
    const load2 = JSON.parse((await http("GET", "/api/athlete/load")).text);
    assert(load2.basis === "vermogen", `basis vermogen verwacht, kreeg ${load2.basis}`);
    assert(
      load2.basisDetail?.buitenBasis === 6,
      `6 hartslagsessies buiten basis verwacht, kreeg ${load2.basisDetail?.buitenBasis}`,
    );
  });

  await scenario("SPOOR_H: /power-bests server-side gepoort op waargenomen vermogen, ook met oude historie", async () => {
    // Renner met alleen hartslag in de laatste 10 activiteiten, maar mét
    // oudere vermogensrecords in de database: de datapoort telt de
    // waarneming, niet de historie — en spreekt nooit over upgraden.
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
    await db.insert(trainingSessionsTable).values({
      clerkId: USER,
      sessionDate: dagenGeleden(200),
      type: "ride",
      durationMin: 60,
      avgPower: 220,
      powerBests: { p5s: 800, p60s: 400, p300s: 300 },
      signals: { power: true, hr: false, duration: true },
    });
    await seedSessies(
      Array.from({ length: 10 }, (_, i) => ({ daysAgo: 10 - i, power: false, hr: true })),
    );
    const bests = await http("GET", "/api/athlete/power-bests");
    assert(bests.status === 403, `power-bests verwacht 403, kreeg ${bests.status}`);
    assert(bests.text.includes("sensor_data_required"), "403 moet als sensorprobleem gecodeerd zijn");
    assert(!bests.text.includes("upgrade"), "sensorprobleem spreekt nooit over upgraden");
  });

  await scenario("SPOOR_H: hartslagzones per week uit echte streams (eigen kaartenset)", async () => {
    await db.delete(activityImportsTable).where(eq(activityImportsTable.clerkId, USER));
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
    await db
      .update(athleteProfilesTable)
      .set({ maxHr: 190, ftp: null })
      .where(eq(athleteProfilesTable.clerkId, USER));
    const vandaag = dagenGeleden(1);
    const [sessie] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId: USER,
        sessionDate: vandaag,
        type: "ride",
        durationMin: 60,
        avgHR: 150,
        signals: { power: false, hr: true, duration: true },
      })
      .returning({ id: trainingSessionsTable.id });
    // Echte (gedownsamplede) hartslagstream: 10 samples van 60s in Z2–Z4.
    await db.insert(activityImportsTable).values({
      clerkId: USER,
      fileName: "hr-rit.fit",
      fileType: "fit",
      status: "parsed",
      linkedTrainingSessionId: sessie!.id,
      parsedSummary: {
        streams: {
          t: Array.from({ length: 10 }, (_, i) => i * 60),
          heartRate: [120, 125, 130, 140, 150, 155, 160, 165, 150, 140],
        },
      },
    });
    const zones = JSON.parse((await http("GET", "/api/athlete/weekly-zones")).text);
    assert(zones.maxHrBron === "profiel", `maxHR-bron profiel verwacht, kreeg ${zones.maxHrBron}`);
    assert(zones.sessionsWithHr === 1, `1 sessie met hartslagstream verwacht, kreeg ${zones.sessionsWithHr}`);
    assert(Array.isArray(zones.hrZones) && zones.hrZones.length === 5, "5 hartslagzones verwacht");
    const week = zones.weeks.find((w: { hrZoneSeconds: number[] }) => w.hrZoneSeconds.some((v: number) => v > 0));
    assert(week != null, "week met hartslag-zoneseconden verwacht");
    const totaal = week.hrZoneSeconds.reduce((a: number, b: number) => a + b, 0);
    assert(totaal >= 540 && totaal <= 660, `~600s in zones verwacht, kreeg ${totaal}`);
    await db.delete(activityImportsTable).where(eq(activityImportsTable.clerkId, USER));
  });

  await scenario("SPOOR_H: provider-hartslag zonder samplereeksen ⇒ eerlijk 'wel signaal, geen reeksen'", async () => {
    // Provider-import: sessies dragen een gemiddelde hartslag maar géén
    // parsedSummary.streams. Het hartslagspoor is dan actief, maar een
    // zoneverdeling is eerlijk afwezig — het antwoord moet dat onderscheid
    // dragen (sessionsWithAvgHr > 0 terwijl sessionsWithHr === 0).
    await db.delete(activityImportsTable).where(eq(activityImportsTable.clerkId, USER));
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
    await seedSessies(
      Array.from({ length: 8 }, (_, i) => ({ daysAgo: 8 - i, power: false, hr: true })),
    );
    const mn = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(mn.hartslag === true, "hartslagspoor hoort actief te zijn op gemeten gemiddelden");
    const zones = JSON.parse((await http("GET", "/api/athlete/weekly-zones")).text);
    assert(zones.sessionsWithHr === 0, `geen samplereeksen ⇒ sessionsWithHr 0, kreeg ${zones.sessionsWithHr}`);
    assert(
      zones.sessionsWithAvgHr >= 8,
      `gemeten gemiddelden moeten zichtbaar zijn, kreeg ${zones.sessionsWithAvgHr}`,
    );
  });

  await scenario("herstel-waarneming staat los van de ritsporen (B2 eigen niveau)", async () => {
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
    const j = JSON.parse((await http("GET", "/api/athlete/meetniveau")).text);
    assert(j.vermogen === false && j.hartslag === false, "geen ritsporen verwacht");
    assert(j.herstel === true, "herstel moet actief blijven op draagbare-metingen alleen");
  });

  await cleanup();
  await pool.end();
  server.close();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  if (failed.length > 0) {
    console.error(`\n${failed.length} scenario('s) gefaald`);
    process.exit(1);
  }
  console.log(`\nAlle ${results.length} scenario's geslaagd`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
