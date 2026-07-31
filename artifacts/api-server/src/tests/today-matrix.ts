// Vandaag WP-T3 — volledige 17-scenario-testmatrix (opdracht §10) + bewijs van
// ≥6 aantoonbaar verschillende profiel-/rolweergaven + debugweergave-gating.
//
// Elke rij van de matrix uit de oorspronkelijke opdracht heeft hier een eigen
// scenario tegen de ECHTE Express-app met echte DB-fixtures. Waar een rij geen
// eigen Vandaag-variant hoort te krijgen (mechanieker) bewijst de test juist de
// eerlijke afwijzing (geen geleende weergave, 403 op rol zonder recht).
//
// Extra WP-T3-contracten:
// - passedOver (debugdetail) NOOIT in de normale respons;
// - ?debug=1 alleen voor admin/Hoofdtester → debug-blok met profiel, rol,
//   gekozen kaarten, bronnen, afgevallen kandidaten, aiUsed=false, historie;
// - minimaal 6 verschillende weergaven (lead-sleutels/varianten) aantoonbaar.
//
// Run: `pnpm --filter @workspace/api-server run test:today-matrix`

import type { Server } from "node:http";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  plannedWorkoutsTable,
  racesTable,
  trainingSessionsTable,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  todayDisplayHistoryTable,
} from "@workspace/db";
import { and, eq, inArray, like } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

async function req(path: string, actor: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-dev-clerk-id": actor },
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* leeg */
  }
  return { status: res.status, text, json };
}

const item = (j: Record<string, unknown> | null, slot: string) =>
  (j?.[slot] ?? null) as Record<string, unknown> | null;
const key = (j: Record<string, unknown> | null, slot: string) =>
  String(item(j, slot)?.key ?? "");

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_todaymatrix_${Date.now()}`;
const u = (s: string) => `${RUN}_${s}`;
const jeugd15 = u("jeugd15");
const jeugd17 = u("jeugd17");
const wedstrijd = u("wedstrijd");
const recreatief = u("recreatief");
const beginner = u("beginner");
const gekoppeld = u("gekoppeld"); // sporter mét trainer
const zonderTrainer = u("solo");
const trainer = u("trainer"); // zelfstandige trainer, meerdere aandachtssporters
const aandacht2 = u("aandacht2");
const ploegleider = u("ploegleider"); // coach in wedstrijddagcontext (Hoofdtester → debug)
const wedstrijdsporter = u("wedsporter");
const mechanieker = u("mechanieker");
const ouder = u("ouder");
const kind = u("kind");
const clubbeheer = u("clubbeheer");
const conflict = u("conflict"); // ziek ÉN training gepland (tegenstrijdig)
const stil = u("stil"); // geen relevante nieuwe gebeurtenissen (trainerloos, leeg)
const ALL = [
  jeugd15, jeugd17, wedstrijd, recreatief, beginner, gekoppeld, zonderTrainer,
  trainer, aandacht2, ploegleider, wedstrijdsporter, mechanieker, ouder, kind,
  clubbeheer, conflict, stil,
];
let clubId = 0;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
function ymdOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}
const yearNow = new Date().getFullYear();

async function seedSessions(clerkId: string, count: number) {
  if (count <= 0) return;
  await db.insert(trainingSessionsTable).values(
    Array.from({ length: count }, (_, i) => ({
      clerkId,
      sessionDate: ymdOffset(-(i + 1) * 3),
      title: `Rit ${i + 1}`,
      tss: 60,
    })),
  );
}

async function seed() {
  for (const id of ALL) {
    const p = await ensureAccount(id, `${id}@example.test`, id.slice(-14), silentLogger);
    assert(p, `account ${id} niet aangemaakt`);
  }
  const setRoles = (id: string, roles: string[], active: string) =>
    db.update(userProfilesTable).set({ roles, activeRole: active }).where(eq(userProfilesTable.clerkId, id));
  await setRoles(trainer, ["athlete", "coach"], "coach");
  await setRoles(ploegleider, ["athlete", "coach"], "coach");
  await setRoles(ouder, ["athlete", "parent"], "parent");

  // Ploegleider is bevoegde tester (Hoofdtester) → mag de debugweergave zien.
  await db.update(userProfilesTable).set({ isHeadTester: true }).where(eq(userProfilesTable.clerkId, ploegleider));

  const setProfile = (id: string, v: Record<string, unknown>) =>
    db.update(athleteProfilesTable).set(v).where(eq(athleteProfilesTable.clerkId, id));

  // 1. 15-jarige zonder training vandaag.
  await setProfile(jeugd15, { birthDate: `${yearNow - 15}-03-01`, birthYear: yearNow - 15 });
  // 2. 17-jarige wedstrijdrenner, wedstrijd morgen.
  await setProfile(jeugd17, { birthDate: `${yearNow - 17}-06-01`, birthYear: yearNow - 17, competitionLevel: "nationaal" });
  await db.insert(racesTable).values({ clerkId: jeugd17, name: `Jeugdkoers ${RUN}`, raceDate: ymdOffset(1), status: "gepland" });
  // 3. Volwassen wedstrijdrenner na zware training (gisteren, hoge TSS).
  await setProfile(wedstrijd, { birthDate: "1994-01-01", competitionLevel: "amateur", experienceLevel: "intermediate" });
  await seedSessions(wedstrijd, 8);
  await db.insert(trainingSessionsTable).values({ clerkId: wedstrijd, sessionDate: ymdOffset(-1), title: "Zware duurrit", tss: 180, durationMin: 200 });
  // 4. Recreatieve renner (genoeg historie, geen competitie).
  await setProfile(recreatief, { birthDate: "1980-01-01", competitionLevel: "recreatief", experienceLevel: "intermediate" });
  await seedSessions(recreatief, 8);
  // 5. Beginner zonder data: geen sessies.
  await setProfile(beginner, { birthDate: "1990-01-01", experienceLevel: "beginner" });
  // 6/7. Sporter met trainer / zonder trainer.
  await setProfile(gekoppeld, { birthDate: "1992-01-01" });
  await seedSessions(gekoppeld, 6);
  await db.insert(coachAthleteLinksTable).values([
    { coachClerkId: trainer, athleteClerkId: gekoppeld, status: "accepted" },
    { coachClerkId: trainer, athleteClerkId: aandacht2, status: "accepted" },
    { coachClerkId: ploegleider, athleteClerkId: wedstrijdsporter, status: "accepted" },
  ]);
  await db.insert(privacySettingsTable).values(
    [gekoppeld, aandacht2, wedstrijdsporter].map((c) => ({ clerkId: c, dataSharingCoach: "summary" })),
  ).onConflictDoNothing();
  // 8. Trainer met meerdere aandachtssporters (twee met status ≠ ok).
  await setProfile(gekoppeld, { healthStatus: "injured" });
  await setProfile(aandacht2, { healthStatus: "sick" });
  // 9. Ploegleider in wedstrijddagcontext: sporter met wedstrijd vandaag.
  await db.insert(racesTable).values({ clerkId: wedstrijdsporter, name: `Koers ${RUN}`, raceDate: today, status: "gepland" });
  // 10. Mechanieker: alleen clubrol mechanieker — geen beheer/hoofdtrainer-recht.
  // 11. Ouder/verzorger met bevestigde link (alle categorieën).
  await setProfile(kind, { birthDate: `${yearNow - 14}-01-01`, birthYear: yearNow - 14 });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: ouder,
    athleteClerkId: kind,
    status: "accepted",
    ageTierAtConsent: "u16",
    consentConfirmedAt: new Date(),
    permissions: { gezondheid: true, herstel: true, planning: true, wedstrijd: true },
  });
  await db.insert(privacySettingsTable).values({ clerkId: kind, dataSharingParent: "summary" }).onConflictDoNothing();
  await db.insert(plannedWorkoutsTable).values({
    clerkId: kind, scheduledDate: today, title: "Rustige tocht", status: "planned", source: "self", type: "duurtraining",
  });
  // 12. Clubbeheerder + club met team zonder trainer; mechanieker is clublid.
  const [c] = await db.insert(clubsTable).values({ name: `Matrixclub ${RUN}`, ownerClerkId: clubbeheer }).returning({ id: clubsTable.id });
  clubId = c!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: clubbeheer, role: "owner" },
    { clubId, clerkId: mechanieker, role: "mechanieker" },
  ]);
  await db.insert(clubTeamsTable).values({ clubId, name: `Team ${RUN}` });
  // 16. Tegenstrijdige databronnen: ziek ÉN training gepland vandaag.
  await setProfile(conflict, { birthDate: "1988-01-01", healthStatus: "sick" });
  await db.insert(plannedWorkoutsTable).values({
    clerkId: conflict, scheduledDate: today, title: "Intervallen", status: "planned", source: "self", type: "interval",
  });
}

async function cleanup() {
  await db.delete(todayDisplayHistoryTable).where(inArray(todayDisplayHistoryTable.clerkId, ALL)).catch(() => {});
  await db.delete(plannedWorkoutsTable).where(inArray(plannedWorkoutsTable.clerkId, ALL)).catch(() => {});
  await db.delete(trainingSessionsTable).where(inArray(trainingSessionsTable.clerkId, ALL)).catch(() => {});
  await db.delete(racesTable).where(inArray(racesTable.clerkId, ALL)).catch(() => {});
  await db.delete(parentAthleteLinksTable).where(eq(parentAthleteLinksTable.parentClerkId, ouder)).catch(() => {});
  await db.delete(coachAthleteLinksTable).where(inArray(coachAthleteLinksTable.coachClerkId, [trainer, ploegleider])).catch(() => {});
  if (clubId) {
    await db.delete(clubTeamsTable).where(eq(clubTeamsTable.clubId, clubId)).catch(() => {});
    await db.delete(clubMembersTable).where(eq(clubMembersTable.clubId, clubId)).catch(() => {});
    await db.delete(clubsTable).where(eq(clubsTable.id, clubId)).catch(() => {});
  }
  await db.delete(privacySettingsTable).where(inArray(privacySettingsTable.clerkId, ALL)).catch(() => {});
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${RUN}%`)).catch(() => {});
}

async function main() {
  await seed();
  await startServer();

  // Verzameling voor het ≥6-verschillende-weergaven-bewijs.
  const views: { label: string; variantOrRole: string; leadKey: string }[] = [];
  async function collect(label: string, actor: string, path = "/api/today") {
    const r = await req(path, actor);
    assert(r.status === 200, `${label}: status ${r.status}`);
    const variant = ((r.json?.profile ?? {}) as Record<string, unknown>).variant;
    views.push({
      label,
      variantOrRole: `${r.json?.role}:${String(variant ?? "-")}`,
      leadKey: key(r.json, "lead"),
    });
    return r;
  }

  await scenario("S1 15-jarige zonder training: jeugdvariant + vrije-dag-lead", async () => {
    const r = await collect("S1", jeugd15);
    assert(((r.json?.profile as Record<string, unknown>).variant) === "jeugd", "variant ≠ jeugd");
    assert(key(r.json, "lead") === "lead:no_plan_advice", `lead=${key(r.json, "lead")}`);
    const title = String(item(r.json, "lead")?.title);
    assert(title === "Vrije dag", `jeugd-copy ontbreekt: ${title}`);
  });

  await scenario("S2 17-jarige, wedstrijd morgen: jeugd — geen wedstrijd-rotatiedruk", async () => {
    const r = await collect("S2", jeugd17);
    assert(((r.json?.profile as Record<string, unknown>).variant) === "jeugd", "variant ≠ jeugd");
    assert(!key(r.json, "rotating").startsWith("rotating:race_prep"), "jeugd kreeg wedstrijd-rotatie");
    assert(r.text.includes("Jeugdkoers"), "wedstrijd van morgen wordt eerlijk genoemd in het handelingsperspectief");
  });

  await scenario("S3 volwassen wedstrijdrenner na zware training: wedstrijdvariant", async () => {
    const r = await collect("S3", wedstrijd);
    assert(((r.json?.profile as Record<string, unknown>).variant) === "wedstrijd", "variant ≠ wedstrijd");
    assert(key(r.json, "lead").length > 0, "geen lead");
  });

  await scenario("S4 recreatieve renner: recreatief-variant, nuchter advies", async () => {
    const r = await collect("S4", recreatief);
    assert(((r.json?.profile as Record<string, unknown>).variant) === "recreatief", "variant ≠ recreatief");
  });

  await scenario("S5 beginner zonder data: geen verzonnen inzicht", async () => {
    const r = await collect("S5", beginner);
    assert(((r.json?.profile as Record<string, unknown>).variant) === "beginner", "variant ≠ beginner");
    assert(item(r.json, "insight") === null, "inzicht verzonnen zonder trenddata");
  });

  await scenario("S6 sporter mét trainer: eigen Vandaag blijft van de sporter", async () => {
    const r = await req("/api/today?rol=atleet", gekoppeld);
    assert(r.status === 200 && r.json?.role === "atleet", `status ${r.status}`);
    assert(key(r.json, "lead").startsWith("lead:health"), "gezondheid (geblesseerd) moet leiden");
  });

  await scenario("S7 sporter zonder trainer: volwaardige Vandaag", async () => {
    const r = await req("/api/today", zonderTrainer);
    assert(r.status === 200 && key(r.json, "lead").length > 0, `status ${r.status}`);
  });

  await scenario("S8 trainer met meerdere aandachtssporters: urgente aandachtslead", async () => {
    const r = await collect("S8", trainer);
    assert(r.json?.role === "trainer", `role=${r.json?.role}`);
    assert(key(r.json, "lead").startsWith("trainer:lead:attention"), `lead=${key(r.json, "lead")}`);
    assert(item(r.json, "lead")?.urgent === true, "aandacht moet urgent zijn");
    assert(String(item(r.json, "lead")?.body).includes("2"), "beide aandachtssporters geteld");
  });

  await scenario("S9 ploegleider in wedstrijddagcontext: wedstrijd zichtbaar in trainerweergave", async () => {
    const r = await collect("S9", ploegleider, "/api/today?rol=trainer&debug=1");
    const debug = r.json?.debug as Record<string, unknown> | undefined;
    assert(debug, "Hoofdtester hoort de debugweergave te krijgen");
    assert(r.text.includes(`Koers ${RUN}`) || JSON.stringify(debug).includes("race"), "wedstrijddagcontext ontbreekt volledig");
  });

  await scenario("S10 mechanieker: geen geleende beheer-/hoofdtrainerweergave (eerlijke 403)", async () => {
    for (const rol of ["clubbeheer", "hoofdtrainer", "trainer"]) {
      const r = await req(`/api/today?rol=${rol}`, mechanieker);
      assert(r.status === 403, `${rol}: status ${r.status}`);
    }
    const eigen = await req("/api/today", mechanieker);
    assert(eigen.status === 200 && eigen.json?.role === "atleet", "eigen atleten-Vandaag blijft werken");
  });

  await scenario("S11 ouder/verzorger: eigen ouderweergave met planningscontext", async () => {
    const r = await collect("S11", ouder);
    assert(r.json?.role === "ouder", `role=${r.json?.role}`);
    assert(key(r.json, "lead").startsWith("ouder:"), `lead=${key(r.json, "lead")}`);
  });

  await scenario("S12 clubbeheerder: operationele lead (team zonder trainer)", async () => {
    const r = await collect("S12", clubbeheer, "/api/today?rol=clubbeheer");
    assert(key(r.json, "lead").startsWith("clubbeheer:lead:teams_without_trainer"), `lead=${key(r.json, "lead")}`);
  });

  await scenario("S13 ontbrekende synchronisatie/data: eerlijk, geen fabricatie", async () => {
    const r = await req("/api/today", stil);
    assert(r.status === 200, `status ${r.status}`);
    assert(item(r.json, "insight") === null, "inzicht zonder data");
    assert(!r.text.includes("je gaat vooruit"), "vooruitgangsclaim zonder bewijs");
  });

  await scenario("S14 meerdere logins op één dag: daysShown telt per dag, niet per call", async () => {
    await req("/api/today", zonderTrainer);
    await req("/api/today", zonderTrainer);
    const rows = await db
      .select({ daysShown: todayDisplayHistoryTable.daysShown })
      .from(todayDisplayHistoryTable)
      .where(eq(todayDisplayHistoryTable.clerkId, zonderTrainer));
    assert(rows.length > 0, "geen historie geschreven");
    assert(rows.every((h) => h.daysShown === 1), `daysShown=${rows.map((h) => h.daysShown).join(",")}`);
  });

  // Eerlijk over de bewijskracht: de orchestrator roept géén AI aan, dus
  // AI-uitval kán Vandaag niet breken — dit scenario bewijst dat contract
  // (aiUsed=false), niet een gesimuleerde AI-storing.
  await scenario("S15 AI-dienst niet beschikbaar: orchestrator is AI-loos (aiUsed=false), uitval kan Vandaag niet raken", async () => {
    const r = await req("/api/today?debug=1", ploegleider);
    const debug = r.json?.debug as Record<string, unknown> | undefined;
    assert(r.status === 200 && debug, "geen debug voor Hoofdtester");
    assert(debug!.aiUsed === false, "orchestrator claimt AI-gebruik");
  });

  await scenario("S16 tegenstrijdige bronnen (ziek + training gepland): gezondheid wint", async () => {
    const r = await collect("S16", conflict);
    assert(key(r.json, "lead").startsWith("lead:health:sick"), `lead=${key(r.json, "lead")}`);
    assert(item(r.json, "lead")?.urgent === true, "gezondheidslead moet urgent blijven");
  });

  await scenario("S17 geen relevante nieuwe gebeurtenissen: eerlijke stille dag zonder vulkaarten", async () => {
    // Sporter `stil` heeft geen plan/wedstrijd/sessies — Vandaag blijft een
    // eerlijk handelingsperspectief zonder vulkaarten of loze inzichten.
    const r2 = await req("/api/today", stil);
    assert(r2.status === 200, `status ${r2.status}`);
    assert(key(r2.json, "lead") === "lead:no_plan_advice", `lead=${key(r2.json, "lead")}`);
    assert(item(r2.json, "insight") === null && item(r2.json, "support") === null, "loze vulling bij stille dag");
  });

  // ── WP-T3-contracten bovenop de matrix ─────────────────────────────────────
  await scenario("debug: passedOver nooit in normale respons", async () => {
    for (const actor of [jeugd15, trainer, ouder, clubbeheer]) {
      const r = await req("/api/today", actor);
      assert(!(r.json && "passedOver" in r.json), "passedOver lekt naar gewone respons");
      assert(!(r.json && "debug" in r.json), "debug lekt zonder verzoek");
    }
  });

  await scenario("debug: ?debug=1 zonder bevoegdheid levert géén debug-blok", async () => {
    const r = await req("/api/today?debug=1", jeugd15);
    assert(r.status === 200, `status ${r.status}`);
    assert(!(r.json && "debug" in r.json), "debug voor gewone gebruiker");
    assert(!r.text.includes("passedOver"), "debugdetails in respons voor gewone gebruiker");
    // Frontend-poort: debugAllowed moet false zijn ondanks DEV_AUTH_BYPASS
    // (de knop mag dus ook in dev preview niet verschijnen voor onbevoegden).
    assert(r.json?.debugAllowed === false, "debugAllowed hoort false te zijn");
  });

  await scenario("debug: debugAllowed=true alleen voor Hoofdtester/expliciete admin", async () => {
    const r = await req("/api/today", ploegleider);
    assert(r.json?.debugAllowed === true, "Hoofdtester hoort debugAllowed=true te krijgen");
    const r2 = await req("/api/today", trainer);
    assert(r2.json?.debugAllowed === false, "gewone trainer kreeg debugAllowed=true");
  });

  await scenario("debug: Hoofdtester krijgt volledige onderbouwing", async () => {
    const r = await req("/api/today?debug=1", ploegleider);
    const d = r.json?.debug as Record<string, unknown> | undefined;
    assert(d, "geen debug-blok");
    for (const f of ["profile", "role", "availableRoles", "chosen", "sources", "passedOver", "aiUsed", "generatedAt", "history"]) {
      assert(f in d!, `debugveld ${f} ontbreekt`);
    }
  });

  await scenario("bewijs: ≥6 aantoonbaar verschillende profiel-/rolweergaven", async () => {
    const distinct = new Set(views.map((v) => `${v.variantOrRole}|${v.leadKey}`));
    assert(
      distinct.size >= 6,
      `slechts ${distinct.size} verschillende weergaven: ${[...distinct].join(" ; ")}`,
    );
    const roles = new Set(views.map((v) => v.variantOrRole.split(":")[0]));
    assert(roles.size >= 4, `slechts ${roles.size} rollen vertegenwoordigd`);
  });

  await stopServer();
  await cleanup();

  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed++;
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("test crash:", err);
  await cleanup().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
