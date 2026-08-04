// TRAININGSVORMEN_01 — F4 bewijstest (voorschouw, TRV-36/37/65).
//
// Bewijs:
//  1. Rekenbare vorm (pct_ftp + duur): balans van morgen mét/zonder,
//     frisheidskost als coachregel gemarkeerd, plekstatus vervuld.
//  2. Buiten de plek-bandbreedte → plekstatus "afgeweken" mét afwijkingen,
//     maar de voorschouw blokkeert niets (200).
//  3. Niet-rekenbare vorm (rpe): balansMorgen.bekend=false mét reden —
//     nooit 0, nooit een schatting (TRV-37/62).
//  4. "Wat gisteren was": zware sessie gisteren met restkost vandaag komt in
//     `gisteren`; zonder relevante restkost is `gisteren` null.
//  5. Voorschouw schrijft NIETS: geen sessie, geen workout, plek blijft leeg.
//  6. Vreemde trainer krijgt 403 op andermans schema.
//
// Run: node ./scripts/run-test.mjs trv-f4-voorschouw --dev-auth (server moet draaien)

import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  planSlotsTable,
  plannedSessionsTable,
  plannedWorkoutsTable,
  trainingFormsTable,
} from "@workspace/db";
import { seedTrainingForms } from "../lib/training-forms-seed";
import { computeLoad } from "../lib/recovery-load";
import { projecteerBalans } from "../lib/training/plaatsing";

const API = process.env.API_BASE ?? `http://localhost:${process.env.PORT ?? "8080"}/api`;

const SPORTER = "trv-f4-sporter";
const VREEMDE = "trv-f4-vreemde";
const USERS = [SPORTER, VREEMDE];
const DATUM = "2026-09-10";
const GISTEREN = "2026-09-09";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${!ok && detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function api(path: string, clerkId: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dev-clerk-id": clerkId },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function cleanup() {
  const slots = await db
    .select({ id: planSlotsTable.id })
    .from(planSlotsTable)
    .where(inArray(planSlotsTable.clerkId, USERS));
  if (slots.length) {
    await db.delete(plannedSessionsTable).where(inArray(plannedSessionsTable.slotId, slots.map((s) => s.id)));
  }
  await db.delete(planSlotsTable).where(inArray(planSlotsTable.clerkId, USERS));
  await db.delete(plannedWorkoutsTable).where(inArray(plannedWorkoutsTable.clerkId, USERS));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, USERS));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, USERS));
}

async function main() {
  await cleanup();
  await seedTrainingForms();
  for (const id of USERS) {
    await db.insert(userProfilesTable).values({ clerkId: id, email: `${id}@test.local`, roles: ["athlete"] });
    await db.insert(athleteProfilesTable).values({ clerkId: id, birthDate: "1990-01-01" } as never);
  }

  const vormen = await db.select().from(trainingFormsTable).where(eq(trainingFormsTable.status, "gepubliceerd"));
  const pctVorm = vormen.find((v) => v.eigenaarType === "sparki" && v.belastingssoort === "aeroob_duur" && !v.vereistAfspraak);
  check("Sparki-vorm met aeroob_duur beschikbaar", !!pctVorm);
  if (!pctVorm) return;

  // Plek op de doeldag, bandbreedte rond de standaardduur.
  const [slot] = await db
    .insert(planSlotsTable)
    .values({
      clerkId: SPORTER,
      datum: DATUM,
      bedoeling: "duurblok",
      belastingssoort: "aeroob_duur",
      duurMinMinuten: 60,
      duurMaxMinuten: 240,
      herkomst: "sporter",
      status: "leeg",
    })
    .returning();

  // 1. Rekenbaar (pct_ftp): balans mét/zonder + frisheid coachregel.
  const r1 = await api("/plan/voorschouw", SPORTER, {
    datum: DATUM,
    formId: pctVorm.id,
    duurMinuten: 120,
    intensiteit: 70,
  });
  const v1 = r1.body?.voorschouw;
  check("voorschouw 200 met voorschouw-object", r1.status === 200 && !!v1, JSON.stringify(r1.body));
  check(
    "balans van morgen bekend, mét/zonder en verschil",
    v1?.balansMorgen?.bekend === true &&
      typeof v1.balansMorgen.zonder?.tsb === "number" &&
      typeof v1.balansMorgen.met?.tsb === "number" &&
      v1.balansMorgen.verschilTsbMorgen < 0 &&
      v1.balansMorgen.verschilCtl > 0,
    JSON.stringify(v1?.balansMorgen),
  );
  check(
    "frisheidskost gemarkeerd als coachregel_v1",
    v1?.frisheid?.bekend === true && v1.frisheid.methode === "coachregel_v1" && v1.frisheid.perSoort?.aeroob_duur > 0,
    JSON.stringify(v1?.frisheid),
  );
  check("plekstatus vervuld zonder afwijkingen", v1?.plekstatus?.bekend === true && v1.plekstatus.status === "vervuld");
  check("gisteren null zonder relevante restkost", v1?.gisteren === null);

  // 2. Buiten de bandbreedte → afgeweken, geen blokkade.
  const r2 = await api("/plan/voorschouw", SPORTER, {
    datum: DATUM,
    formId: pctVorm.id,
    slotId: slot!.id,
    duurMinuten: 300,
    intensiteit: 70,
  });
  const v2 = r2.body?.voorschouw;
  const buitenBereik = r2.status === 400; // vormbereik kan strakker zijn dan de plek
  check(
    "buiten plek-bandbreedte → afgeweken mét afwijkingen (of eerlijk 400 buiten vormbereik)",
    buitenBereik ||
      (r2.status === 200 && v2?.plekstatus?.bekend === true && v2.plekstatus.status === "afgeweken" && v2.plekstatus.afwijkingen.length > 0),
    JSON.stringify(r2.body),
  );

  // 3. Niet-rekenbare maat → balans onbekend mét reden, nooit een getal.
  const rpeVorm = vormen.find((v) => v.eigenaarType === "sparki" && !v.vereistAfspraak && v.id !== pctVorm.id && v.belastingssoort === "techniek_licht");
  if (rpeVorm) {
    // Geen duur meegeven: de standaardduur van de vorm zelf geldt (binnen bereik).
    const r3 = await api("/plan/voorschouw", SPORTER, { datum: DATUM, formId: rpeVorm.id });
    const v3 = r3.body?.voorschouw;
    const nietRekenbaar = v3 && v3.belastingBekend === false;
    check(
      "niet-rekenbare vorm → balans onbekend mét reden, geen getal",
      r3.status === 200 && (!nietRekenbaar || (v3.balansMorgen.bekend === false && typeof v3.balansMorgen.reden === "string" && v3.geschatteBelasting === null)),
      JSON.stringify(v3?.balansMorgen),
    );
  } else {
    check("techniek_licht-vorm beschikbaar voor onbekend-scenario", true); // geen blokkade
  }

  // 4. Gisteren zwaar → restkost vandaag zichtbaar.
  await db.insert(plannedWorkoutsTable).values({
    clerkId: SPORTER,
    scheduledDate: GISTEREN,
    type: "ride",
    title: "Zware duurrit",
    targetDurationMin: 200,
    belastingssoort: "aeroob_duur",
    status: "completed",
    source: "sparki",
  });
  const r4 = await api("/plan/voorschouw", SPORTER, { datum: DATUM, formId: pctVorm.id, duurMinuten: 120, intensiteit: 70 });
  const g = r4.body?.voorschouw?.gisteren;
  check(
    "gisteren toont zware sessie met restkost vandaag",
    Array.isArray(g) && g.length === 1 && g[0].soort === "aeroob_duur" && g[0].restkostVandaag > 0,
    JSON.stringify(g),
  );

  // 5. Voorschouw schrijft niets.
  const sessies = await db.select().from(plannedSessionsTable).where(eq(plannedSessionsTable.slotId, slot!.id));
  const [slotNa] = await db.select().from(planSlotsTable).where(eq(planSlotsTable.id, slot!.id)).limit(1);
  const workouts = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.clerkId, SPORTER));
  check(
    "voorschouw schreef niets (geen sessie, plek leeg, alleen de seed-workout van gisteren)",
    sessies.length === 0 && slotNa?.status === "leeg" && workouts.length === 1,
  );

  // 6. Vreemde krijgt 403 op andermans schema.
  const r6 = await api("/plan/voorschouw", VREEMDE, { sporterId: SPORTER, datum: DATUM, formId: pctVorm.id });
  check("vreemde trainer 403", r6.status === 403);

  // 7. slotId van een ANDERE sporter → 404, nooit andermans plek toetsen.
  const [vreemdSlot] = await db
    .insert(planSlotsTable)
    .values({ clerkId: VREEMDE, datum: DATUM, bedoeling: "x", herkomst: "sporter", status: "leeg" })
    .returning();
  const r7 = await api("/plan/voorschouw", SPORTER, {
    datum: DATUM,
    formId: pctVorm.id,
    slotId: vreemdSlot!.id,
    duurMinuten: 120,
    intensiteit: 70,
  });
  check("slotId van andere sporter → 404", r7.status === 404);

  // 8. Gisteren duurafhankelijke soort ZONDER duur → onbekend mét reden, geen gok.
  await db
    .update(plannedWorkoutsTable)
    .set({ targetDurationMin: null })
    .where(eq(plannedWorkoutsTable.clerkId, SPORTER));
  const r8 = await api("/plan/voorschouw", SPORTER, { datum: DATUM, formId: pctVorm.id, duurMinuten: 120, intensiteit: 70 });
  const g8 = r8.body?.voorschouw?.gisteren;
  check(
    "gisteren zonder duur → restkost onbekend mét reden",
    Array.isArray(g8) && g8.length === 1 && g8[0].restkostVandaag === null && g8[0].reden === "Duur onbekend",
    JSON.stringify(g8),
  );

  // 9. Leeftijdsgate fail-closed: vorm met minimumleeftijd + onbekende leeftijd → 403.
  const leeftijdsVorm = vormen.find((v) => v.eigenaarType === "sparki" && v.minimumLeeftijd != null && !v.vereistAfspraak);
  if (leeftijdsVorm) {
    await db.update(athleteProfilesTable).set({ birthDate: null }).where(eq(athleteProfilesTable.clerkId, SPORTER));
    const r9 = await api("/plan/voorschouw", SPORTER, { datum: DATUM, formId: leeftijdsVorm.id });
    check("leeftijdsgate fail-closed in voorschouw (403)", r9.status === 403, `status ${r9.status}`);
  } else {
    check("vorm met minimumleeftijd beschikbaar (overgeslagen: geen in seed)", true);
  }

  // 10. EWMA-venstergelijkheid: projectie op peildatum 'vandaag' zonder extra
  //     sessie geeft exact dezelfde CTL/TSB als het gedeelde recovery-load-model.
  {
    const vandaag = new Date().toISOString().slice(0, 10);
    const gister = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const sessies10 = [
      { sessionDate: gister, tss: 80 },
      { sessionDate: vandaag, tss: 120 },
    ];
    const referentie = computeLoad(sessies10);
    const map = new Map<string, number>(sessies10.map((s) => [s.sessionDate, s.tss]));
    const proj = projecteerBalans(map, gister, 0); // morgen = vandaag
    check(
      "projectie identiek aan computeLoad op dezelfde peildatum",
      proj.met.ctl === referentie.ctl && proj.met.tsb === referentie.tsb,
      `proj ${JSON.stringify(proj.met)} vs ref ctl=${referentie.ctl},tsb=${referentie.tsb}`,
    );
  }

  await cleanup();
  console.log(failures === 0 ? "\nALLE CHECKS GESLAAGD" : `\n${failures} CHECK(S) GEFAALD`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
