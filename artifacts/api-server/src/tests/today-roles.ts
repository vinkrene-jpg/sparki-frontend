// Vandaag voor rollen (WP-T2) — gerichte route-contracttest op /api/today?rol=…
//
// Bewaakt de opdracht-eisen:
// 1. rolwissel binnen één account geeft aantoonbaar verschillende weergaven;
// 2. multi-rol gebruiker krijgt alle (en alleen) rolweergaven waar hij recht op heeft;
// 3. ontbrekende relatie → eerlijke lege toestand (geen verzonnen kaarten);
// 4. verboden individuele gegevens lekken niet (marker-strings afwezig);
// 5. lege club / trainer zonder sporters → eerlijke lege lead;
// 6. urgente kaart blijft leidend; wisselkaart is dag-stabiel;
// 7. meerdere logins zien alleen hun eigen sporters (cross-account isolatie);
// 8. directe API-calls zonder recht → 403 (en onzin-rol → 400).
//
// Run: `pnpm --filter @workspace/api-server run test:today-roles`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

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
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leeg */
  }
  return { status: res.status, text, json: json as Record<string, unknown> | null };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_todayroles_${Date.now()}`;
const coachA = `${RUN}_coachA`;
const athleteA = `${RUN}_athA`;
const coachB = `${RUN}_coachB`;
const athleteB = `${RUN}_athB`;
const multi = `${RUN}_multi`; // coach + parent
const child = `${RUN}_child`;
const solo = `${RUN}_solo`; // alleen atleet
const clubOwner = `${RUN}_owner`;
const hoofd = `${RUN}_hoofd`;
const coachEmpty = `${RUN}_coachEmpty`;
const ALL = [coachA, athleteA, coachB, athleteB, multi, child, solo, clubOwner, hoofd, coachEmpty];

const MARK_B = `MARK_ATHB_${RUN}`; // displayName van sporter B (isolatie)
const MARK_PLAN = `MARK_PLAN_${RUN}`; // workout-titel van het kind (ouderrechten)
let clubId = 0;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });

async function seed() {
  for (const id of ALL) {
    const p = await ensureAccount(id, `${id}@example.test`, id.slice(-12), silentLogger);
    assert(p, `account ${id} niet aangemaakt`);
  }
  // Rollen instellen
  const setRoles = (id: string, roles: string[], active: string) =>
    db
      .update(userProfilesTable)
      .set({ roles, activeRole: active })
      .where(eq(userProfilesTable.clerkId, id));
  await setRoles(coachA, ["athlete", "coach"], "coach");
  await setRoles(coachB, ["athlete", "coach"], "coach");
  await setRoles(coachEmpty, ["athlete", "coach"], "coach");
  await setRoles(multi, ["athlete", "coach", "parent"], "parent");
  await setRoles(hoofd, ["athlete", "coach"], "coach");

  // Sporter B krijgt een herkenbare naam (isolatiemarker).
  await db
    .update(userProfilesTable)
    .set({ displayName: MARK_B })
    .where(eq(userProfilesTable.clerkId, athleteB));

  // Coachlinks + delen: A→athA (ziek), B→athB.
  await db.insert(coachAthleteLinksTable).values([
    { coachClerkId: coachA, athleteClerkId: athleteA, status: "accepted" },
    { coachClerkId: coachB, athleteClerkId: athleteB, status: "accepted" },
  ]);
  await db
    .insert(privacySettingsTable)
    .values([
      { clerkId: athleteA, dataSharingCoach: "summary" },
      { clerkId: athleteB, dataSharingCoach: "summary" },
    ])
    .onConflictDoNothing();
  await db
    .update(athleteProfilesTable)
    .set({ healthStatus: "sick" })
    .where(eq(athleteProfilesTable.clerkId, athleteA));

  // Ouderlink multi→child, bevestigd op u16 maar ZONDER planning-recht.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: "2014-05-01", birthYear: 2014 })
    .where(eq(athleteProfilesTable.clerkId, child));
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: multi,
    athleteClerkId: child,
    status: "accepted",
    ageTierAtConsent: "u16",
    consentConfirmedAt: new Date(),
    permissions: { gezondheid: true, herstel: true, planning: false },
  });
  await db
    .insert(privacySettingsTable)
    .values({ clerkId: child, dataSharingParent: "summary" })
    .onConflictDoNothing();
  // Kind heeft vandaag een training met marker-titel (mag NIET zichtbaar zijn).
  await db.insert(plannedWorkoutsTable).values({
    clerkId: child,
    scheduledDate: today,
    title: MARK_PLAN,
    status: "planned",
    source: "self",
    type: "duurtraining",
  });

  // Club: owner beheert, hoofdtrainer-lid, en één team ZONDER trainer.
  const [c] = await db
    .insert(clubsTable)
    .values({ name: `Testclub ${RUN}`, ownerClerkId: clubOwner })
    .returning({ id: clubsTable.id });
  clubId = c!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: clubOwner, role: "owner" },
    { clubId, clerkId: hoofd, role: "hoofdtrainer" },
  ]);
  await db.insert(clubTeamsTable).values({ clubId, name: `Team-${RUN}` });
}

async function cleanup() {
  await db.delete(todayDisplayHistoryTable).where(inArray(todayDisplayHistoryTable.clerkId, ALL)).catch(() => {});
  await db.delete(plannedWorkoutsTable).where(inArray(plannedWorkoutsTable.clerkId, ALL)).catch(() => {});
  await db.delete(parentAthleteLinksTable).where(eq(parentAthleteLinksTable.parentClerkId, multi)).catch(() => {});
  await db.delete(coachAthleteLinksTable).where(inArray(coachAthleteLinksTable.coachClerkId, [coachA, coachB])).catch(() => {});
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

  await scenario("trainer: zieke sporter is urgente lead", async () => {
    const r = await req("/api/today", coachA);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json?.role === "trainer", `role=${r.json?.role}`);
    const lead = r.json?.lead as Record<string, unknown>;
    assert(String(lead?.key).startsWith("trainer:lead:attention"), `lead=${lead?.key}`);
    assert(lead?.urgent === true, "aandachtslead moet urgent zijn");
  });

  await scenario("rolwissel binnen account: ouder vs trainer geeft andere weergave", async () => {
    const ouder = await req("/api/today?rol=ouder", multi);
    const trainer = await req("/api/today?rol=trainer", multi);
    assert(ouder.status === 200 && trainer.status === 200, `${ouder.status}/${trainer.status}`);
    assert(ouder.json?.role === "ouder" && trainer.json?.role === "trainer", "rolvelden kloppen niet");
    const lk = (ouder.json?.lead as Record<string, unknown>)?.key as string;
    const tk = (trainer.json?.lead as Record<string, unknown>)?.key as string;
    assert(lk?.startsWith("ouder:") && tk?.startsWith("trainer:"), `leads ${lk} / ${tk}`);
  });

  await scenario("multi-rol: availableRoles bevat precies de echte rollen", async () => {
    const r = await req("/api/today", multi);
    const av = (r.json?.availableRoles ?? []) as string[];
    assert(av.includes("atleet") && av.includes("trainer") && av.includes("ouder"), `av=${av}`);
    assert(!av.includes("clubbeheer") && !av.includes("hoofdtrainer"), `te veel rollen: ${av}`);
  });

  await scenario("ouder zonder planning-recht: workout-titel lekt niet", async () => {
    const r = await req("/api/today?rol=ouder", multi);
    assert(r.status === 200, `status ${r.status}`);
    assert(!r.text.includes(MARK_PLAN), "planning-marker zichtbaar zonder recht");
  });

  await scenario("trainer zonder sporters: eerlijke lege lead", async () => {
    const r = await req("/api/today", coachEmpty);
    const lead = r.json?.lead as Record<string, unknown>;
    assert(lead?.key === "trainer:lead:no_athletes", `lead=${lead?.key}`);
  });

  await scenario("ontbrekende relatie: ouder zonder kind (solo heeft geen ouderrol) → 403", async () => {
    const r = await req("/api/today?rol=ouder", solo);
    assert(r.status === 403, `status ${r.status}`);
  });

  await scenario("directe API-call zonder recht: trainer/clubbeheer/hoofdtrainer → 403", async () => {
    for (const rol of ["trainer", "clubbeheer", "hoofdtrainer"]) {
      const r = await req(`/api/today?rol=${rol}`, solo);
      assert(r.status === 403, `${rol}: status ${r.status}`);
    }
  });

  await scenario("onzin-rol → 400", async () => {
    const r = await req("/api/today?rol=onzin", coachA);
    assert(r.status === 400, `status ${r.status}`);
  });

  await scenario("clubbeheer: team zonder trainer is de lead", async () => {
    const r = await req("/api/today?rol=clubbeheer", clubOwner);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json?.role === "clubbeheer", `role=${r.json?.role}`);
    const lead = r.json?.lead as Record<string, unknown>;
    assert(String(lead?.key).startsWith("clubbeheer:lead:teams_without_trainer"), `lead=${lead?.key}`);
  });

  await scenario("hoofdtrainer: niet-toegewezen team is de lead; geen individuele data", async () => {
    const r = await req("/api/today?rol=hoofdtrainer", hoofd);
    assert(r.status === 200, `status ${r.status}`);
    const lead = r.json?.lead as Record<string, unknown>;
    assert(String(lead?.key).startsWith("hoofdtrainer:lead:unassigned"), `lead=${lead?.key}`);
    for (const banned of ["healthStatus", "ziek", "geblesseerd", MARK_B, MARK_PLAN]) {
      assert(!r.text.includes(banned), `verboden inhoud in hoofdtrainer-weergave: ${banned}`);
    }
  });

  await scenario("hoofdtrainer-rol geeft géén clubbeheer-weergave", async () => {
    const r = await req("/api/today?rol=clubbeheer", hoofd);
    assert(r.status === 403, `status ${r.status}`);
  });

  await scenario("meerdere logins: trainer A ziet sporter van trainer B niet", async () => {
    const rA = await req("/api/today", coachA);
    assert(!rA.text.includes(MARK_B), "sporter B lekt naar coach A");
    const rB = await req("/api/today", coachB);
    assert(rB.status === 200 && rB.json?.role === "trainer", `B status ${rB.status}`);
  });

  await scenario("wisselkaart is dag-stabiel (twee calls, zelfde rotating)", async () => {
    const r1 = await req("/api/today", coachB);
    const r2 = await req("/api/today", coachB);
    const k1 = (r1.json?.rotating as Record<string, unknown> | null)?.key ?? null;
    const k2 = (r2.json?.rotating as Record<string, unknown> | null)?.key ?? null;
    assert(k1 === k2, `rotating flikkert: ${k1} vs ${k2}`);
  });

  await scenario("atleet-weergave blijft werken en draagt role-veld", async () => {
    const r = await req("/api/today?rol=atleet", multi);
    assert(r.status === 200 && r.json?.role === "atleet", `status ${r.status} role=${r.json?.role}`);
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
