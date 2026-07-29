// Ouder-/verzorgeromgeving (Afbouwgolf 12) — DB-backed route contract test.
//
// Dekt de rechtenlaag per gegevenstype (8 categorieën), leeftijdstiers met
// herbevestiging, ouderacties (meldingen, noodcontacten, bevestigingen,
// berichten) en het weigeren van een uitnodiging. Boot de ECHTE Express-app,
// seedt eigen RUN-geprefixte profielen en ruimt uitsluitend eigen rijen op.
//
// Scenario's (14):
//  1. Ongekoppelde ouder: overview toont het kind niet; rechten-endpoint 403.
//  2. u16 zonder bevestigde keuze: veiligheidsminimum (gezondheid/herstel/
//     slaap aan, planning uit) en parentMayEdit=true.
//  3. Kill-switch dataSharingParent=none: level none, alle categorieën uit.
//  4. Ouder wijzigt rechten voor u16-kind (PUT 200) → overview volgt.
//  5. Ouder wijzigt rechten voor 16–17-kind → 403 (sporter beheert zelf).
//  6. Sporter beheert zelf rechten via /api/links (geldt als bevestiging).
//  7. Tierwissel sinds bevestiging → reconfirmRequired, niet-veiligheids-
//     categorieën vallen dicht (16–17: veiligheidsminimum blijft).
//  8. Sporter herbevestigt → reconfirmRequired weg, rechten hersteld.
//  9. Volwassen sporter + tierwissel → ALLES dicht tot herbevestiging;
//     parentMayEdit blijft false.
// 10. Melding ziek/blessure/afwezig: POST 201, sporter ziet en markeert hem;
//     ongeldige soort → 400.
// 11. Noodcontacten: toevoegen, maximum 5 afgedwongen (400), verwijderen.
// 12. Bevestigingen: zonder wedstrijd-recht 403; met recht idempotente upsert
//     (tweede besluit overschrijft, geen tweede rij).
// 13. Berichten: communicatie uit → 403 beide kanten; aan → versturen +
//     unreadMessages in overview + sporter-spiegel.
// 14. Uitnodiging weigeren: pending → declined, géén koppeling, tweede keer 409.
//
// Run: `pnpm --filter @workspace/api-server run test:parent-environment`

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  parentAthleteLinksTable,
  parentReportsTable,
  emergencyContactsTable,
  parentConfirmationsTable,
  parentMessagesTable,
  athleteDailyMetricsTable,
  plannedWorkoutsTable,
  invitationsTable,
  notificationsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
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

// ── Server boot ──────────────────────────────────────────────────────────────
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
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_parentenv_${Date.now()}`;
const clerkParent = `${RUN}_parent`;
const clerkParentB = `${RUN}_parent_b`; // ongekoppeld — isolatie-controle
const clerkChildU16 = `${RUN}_child_u16`;
const clerkTeen = `${RUN}_teen`; // 16–17
const clerkAdult = `${RUN}_adult`;
const ALL_CLERKS = [clerkParent, clerkParentB, clerkChildU16, clerkTeen, clerkAdult];

function birthDateForAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setDate(d.getDate() - 40); // ruim voorbij de verjaardag dit jaar
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
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

async function setParentSharing(
  athlete: string,
  level: "none" | "safety_only" | "summary",
): Promise<void> {
  await db
    .insert(privacySettingsTable)
    .values({ clerkId: athlete, dataSharingParent: level })
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: { dataSharingParent: level },
    });
}

async function linkRow(parent: string, athlete: string) {
  const [row] = await db
    .select()
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parent),
        eq(parentAthleteLinksTable.athleteClerkId, athlete),
      ),
    );
  return row ?? null;
}

function childEntry(json: any, athlete: string): any {
  return (json?.children as any[] | undefined)?.find(
    (c) => c.athleteClerkId === athlete,
  );
}

async function cleanup() {
  await db
    .delete(parentReportsTable)
    .where(inArray(parentReportsTable.athleteClerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(emergencyContactsTable)
    .where(inArray(emergencyContactsTable.athleteClerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(parentConfirmationsTable)
    .where(inArray(parentConfirmationsTable.athleteClerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(parentMessagesTable)
    .where(inArray(parentMessagesTable.athleteClerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(plannedWorkoutsTable)
    .where(inArray(plannedWorkoutsTable.clerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(athleteDailyMetricsTable)
    .where(inArray(athleteDailyMetricsTable.clerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(privacySettingsTable)
    .where(inArray(privacySettingsTable.clerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(parentAthleteLinksTable)
    .where(inArray(parentAthleteLinksTable.parentClerkId, [clerkParent, clerkParentB]))
    .catch(() => {});
  await db
    .delete(invitationsTable)
    .where(inArray(invitationsTable.inviterClerkId, ALL_CLERKS))
    .catch(() => {});
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.clerkId, ALL_CLERKS))
    .catch(() => {});
  for (const c of ALL_CLERKS) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function main() {
  await startServer();

  // Seed: één ouder, één ongekoppelde ouder, drie kinderen per leeftijdstier.
  await ensureAccount(clerkParent, `${clerkParent}@example.test`, "Ouder A", silentLogger);
  await ensureAccount(clerkParentB, `${clerkParentB}@example.test`, "Ouder B", silentLogger);
  await ensureAccount(clerkChildU16, `${clerkChildU16}@example.test`, "Kind 14", silentLogger);
  await ensureAccount(clerkTeen, `${clerkTeen}@example.test`, "Teen 16", silentLogger);
  await ensureAccount(clerkAdult, `${clerkAdult}@example.test`, "Volwassen 20", silentLogger);

  for (const p of [clerkParent, clerkParentB]) {
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete", "parent"] })
      .where(eq(userProfilesTable.clerkId, p));
  }
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: birthDateForAge(14) })
    .where(eq(athleteProfilesTable.clerkId, clerkChildU16));
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: birthDateForAge(16) })
    .where(eq(athleteProfilesTable.clerkId, clerkTeen));
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: birthDateForAge(20) })
    .where(eq(athleteProfilesTable.clerkId, clerkAdult));

  // Geaccepteerde koppelingen ouder A → alle drie de kinderen.
  for (const a of [clerkChildU16, clerkTeen, clerkAdult]) {
    await db.insert(parentAthleteLinksTable).values({
      parentClerkId: clerkParent,
      athleteClerkId: a,
      status: "accepted",
    });
    await setParentSharing(a, "safety_only");
  }

  // Eén welzijnsmetriek per kind zodat gated velden echt iets te tonen hebben.
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  for (const a of [clerkChildU16, clerkTeen, clerkAdult]) {
    await db.insert(athleteDailyMetricsTable).values({
      clerkId: a,
      metricDate: iso,
      feelScore: 7,
      fatigueScore: 3,
      sleepHours: "7.50",
      sleepQuality: 8,
    });
  }

  // 1 — Ongekoppelde ouder ziet niets en krijgt 403 op rechten.
  await scenario("ongekoppelde ouder: geen kind in overview, rechten 403", async () => {
    const ov = await req("GET", "/api/parent/overview", clerkParentB);
    assert(ov.status === 200, `overview status ${ov.status}`);
    assert(!childEntry(ov.json, clerkChildU16), "ongekoppeld kind zichtbaar");
    const perm = await req(
      "GET",
      `/api/parent/athletes/${clerkChildU16}/permissions`,
      clerkParentB,
    );
    assert(perm.status === 403, `permissions status ${perm.status}`);
  });

  // 2 — u16 standaard (legacy zonder consentConfirmedAt): STRIKT het
  // veiligheidsminimum — alleen gezondheid + herstel, dus ook slaap dicht.
  await scenario("u16 zonder keuze: veiligheidsminimum, parentMayEdit", async () => {
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    assert(ov.status === 200, `overview status ${ov.status}`);
    const child = childEntry(ov.json, clerkChildU16);
    assert(child, "kind ontbreekt in overview");
    const acc = child.access;
    assert(acc.tier === "u16", `tier ${acc.tier}`);
    assert(acc.parentMayEdit === true, "parentMayEdit moet true zijn voor u16");
    assert(acc.permissions.gezondheid === true, "gezondheid moet aan staan");
    assert(acc.permissions.herstel === true, "herstel moet aan staan");
    assert(
      acc.permissions.slaap === false,
      "slaap moet uit staan (legacy = alleen veiligheidsminimum)",
    );
    assert(acc.permissions.planning === false, "planning moet uit staan");
    assert(acc.permissions.communicatie === false, "communicatie moet uit staan");
    assert(child.wellbeing != null, "wellbeing ontbreekt bij herstel aan");
    assert(child.today === undefined, "today mag niet zonder planning-recht");
  });

  // 3 — Kill-switch none.
  await scenario("kill-switch none: alles dicht", async () => {
    await setParentSharing(clerkChildU16, "none");
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkChildU16);
    assert(child, "kind ontbreekt in overview");
    assert(child.access.level === "none", `level ${child.access.level}`);
    const perms = Object.values(child.access.permissions as Record<string, boolean>);
    assert(perms.every((v) => v === false), "alle categorieën moeten uit staan");
    assert(child.wellbeing === undefined, "wellbeing mag niet lekken bij none");
    await setParentSharing(clerkChildU16, "safety_only");
  });

  // 4 — Ouder wijzigt rechten voor u16-kind.
  await scenario("ouder wijzigt rechten u16: PUT 200 en overview volgt", async () => {
    const r = await req(
      "PUT",
      `/api/parent/athletes/${clerkChildU16}/permissions`,
      clerkParent,
      {
        permissions: {
          gezondheid: true,
          herstel: true,
          slaap: true,
          planning: true,
          wedstrijd: true,
          aanwezigheid: false,
          locatie: false,
          communicatie: true,
        },
      },
    );
    assert(r.status === 200, `PUT status ${r.status}`);
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkChildU16);
    assert(child.access.permissions.planning === true, "planning niet doorgevoerd");
    assert(Array.isArray(child.today), "today ontbreekt na planning-recht");
    const link = await linkRow(clerkParent, clerkChildU16);
    assert(link?.consentConfirmedAt != null, "consentConfirmedAt niet gezet");
    assert(link?.ageTierAtConsent === "u16", `ageTierAtConsent ${link?.ageTierAtConsent}`);
  });

  // 5 — Ouder mag rechten van 16–17-kind NIET wijzigen.
  await scenario("ouder wijzigt rechten 16–17: 403", async () => {
    const r = await req(
      "PUT",
      `/api/parent/athletes/${clerkTeen}/permissions`,
      clerkParent,
      { permissions: { gezondheid: true, planning: true } },
    );
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    const link = await linkRow(clerkParent, clerkTeen);
    assert(link?.permissions == null, "permissions mocht niet geschreven zijn");
  });

  // 6 — Sporter (teen) beheert zelf rechten via /api/links.
  await scenario("sporter beheert zelf rechten (bevestiging)", async () => {
    const r = await req(
      "PUT",
      `/api/links/parent/${clerkParent}/permissions`,
      clerkTeen,
      {
        permissions: {
          gezondheid: true,
          herstel: true,
          slaap: false,
          planning: true,
          wedstrijd: true,
          aanwezigheid: true,
          locatie: false,
          communicatie: false,
        },
      },
    );
    assert(r.status === 200, `PUT status ${r.status}`);
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkTeen);
    assert(child.access.permissions.planning === true, "planning niet doorgevoerd");
    assert(child.access.permissions.slaap === false, "slaap moest uit staan");
    assert(child.access.parentMayEdit === false, "parentMayEdit moet false zijn ≥16");
    const link = await linkRow(clerkParent, clerkTeen);
    assert(link?.ageTierAtConsent === "16_17", `tier bij consent ${link?.ageTierAtConsent}`);
  });

  // 7 — Tierwissel → herbevestiging nodig, niet-veiligheid dicht.
  await scenario("tierwissel: reconfirmRequired, alleen veiligheidsminimum", async () => {
    await db
      .update(parentAthleteLinksTable)
      .set({ ageTierAtConsent: "u16" })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, clerkParent),
          eq(parentAthleteLinksTable.athleteClerkId, clerkTeen),
        ),
      );
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkTeen);
    assert(child.access.reconfirmRequired === true, "reconfirmRequired moet true zijn");
    assert(child.access.permissions.gezondheid === true, "veiligheidsminimum moet open blijven");
    assert(child.access.permissions.planning === false, "planning moet dichtvallen");
    assert(child.access.permissions.wedstrijd === false, "wedstrijd moet dichtvallen");
  });

  // 8 — Herbevestiging herstelt de rechten.
  await scenario("herbevestiging herstelt rechten", async () => {
    const r = await req("POST", `/api/links/parent/${clerkParent}/reconfirm`, clerkTeen);
    assert(r.status === 200, `reconfirm status ${r.status}`);
    assert(r.json?.tier === "16_17", `tier ${r.json?.tier}`);
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkTeen);
    assert(child.access.reconfirmRequired === false, "reconfirmRequired moet weg zijn");
    assert(child.access.permissions.planning === true, "planning moet terug open zijn");
  });

  // 9 — Volwassen sporter + tierwissel: ALLES dicht.
  await scenario("volwassene: tierwissel sluit alles tot herbevestiging", async () => {
    // Volwassene bevestigt eerst rechten…
    const set = await req(
      "PUT",
      `/api/links/parent/${clerkParent}/permissions`,
      clerkAdult,
      { permissions: { gezondheid: true, herstel: true, planning: true } },
    );
    assert(set.status === 200, `PUT status ${set.status}`);
    // …daarna simuleren we dat de bevestiging uit een eerdere tier stamt.
    await db
      .update(parentAthleteLinksTable)
      .set({ ageTierAtConsent: "16_17" })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, clerkParent),
          eq(parentAthleteLinksTable.athleteClerkId, clerkAdult),
        ),
      );
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkAdult);
    assert(child.access.tier === "adult", `tier ${child.access.tier}`);
    assert(child.access.reconfirmRequired === true, "reconfirmRequired moet true zijn");
    const perms = Object.values(child.access.permissions as Record<string, boolean>);
    assert(perms.every((v) => v === false), "bij volwassene moet ALLES dicht");
    assert(child.access.parentMayEdit === false, "parentMayEdit moet false zijn");
    // herstel voor latere scenario's
    await req("POST", `/api/links/parent/${clerkParent}/reconfirm`, clerkAdult);
  });

  // 9b — Volwassen sporter met LEGACY-koppeling (geen bevestiging, geen tier):
  // 18+ sluit alles — óók het veiligheidsminimum — tot expliciete herbevestiging.
  await scenario("volwassene: legacy zonder bevestiging = alles dicht", async () => {
    await db
      .update(parentAthleteLinksTable)
      .set({ ageTierAtConsent: null, consentConfirmedAt: null, permissions: null })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, clerkParent),
          eq(parentAthleteLinksTable.athleteClerkId, clerkAdult),
        ),
      );
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkAdult);
    assert(child.access.tier === "adult", `tier ${child.access.tier}`);
    assert(child.access.reconfirmRequired === true, "reconfirmRequired moet true zijn");
    const perms = Object.values(child.access.permissions as Record<string, boolean>);
    assert(perms.every((v) => v === false), "18+ legacy: alles moet dicht");
    // Expliciete herbevestiging door de volwassen sporter heropent het
    // veiligheidsminimum-standaardpad (eigen regie).
    const rc = await req("POST", `/api/links/parent/${clerkParent}/reconfirm`, clerkAdult);
    assert(rc.status === 200, `reconfirm status ${rc.status}`);
    const ov2 = await req("GET", "/api/parent/overview", clerkParent);
    const child2 = childEntry(ov2.json, clerkAdult);
    assert(child2.access.reconfirmRequired === false, "na herbevestiging geen reconfirm meer");
    assert(child2.access.permissions.gezondheid === true, "na herbevestiging veiligheidsminimum open");
    assert(child2.access.permissions.planning === false, "niet-veiligheid blijft dicht zonder keuze");
  });

  // 10 — Meldingen: aanmaken, sporter ziet en markeert; ongeldige soort 400.
  await scenario("melding ziek: 201, sporter markeert, ongeldig 400", async () => {
    const bad = await req(
      "POST",
      `/api/parent/athletes/${clerkChildU16}/reports`,
      clerkParent,
      { kind: "verkouden" },
    );
    assert(bad.status === 400, `ongeldige soort gaf ${bad.status}`);
    const r = await req(
      "POST",
      `/api/parent/athletes/${clerkChildU16}/reports`,
      clerkParent,
      { kind: "ziek", note: "Koorts vanochtend" },
    );
    assert(r.status === 201, `report status ${r.status}`);
    const reportId = r.json?.report?.id;
    assert(reportId, "report id ontbreekt");
    const mine = await req("GET", "/api/links/parent-reports", clerkChildU16);
    assert(
      (mine.json?.reports as any[]).some((x) => x.id === reportId),
      "sporter ziet de melding niet",
    );
    const mark = await req(
      "POST",
      `/api/links/parent-reports/${reportId}/status`,
      clerkChildU16,
      { status: "afgerond" },
    );
    assert(mark.status === 200, `status-markering gaf ${mark.status}`);
    assert(mark.json?.report?.status === "afgerond", "status niet afgerond");
  });

  // 11 — Noodcontacten: toevoegen, max 5, verwijderen.
  await scenario("noodcontacten: max 5 afgedwongen", async () => {
    let lastId = 0;
    for (let i = 1; i <= 5; i++) {
      const r = await req(
        "POST",
        `/api/parent/athletes/${clerkChildU16}/emergency-contacts`,
        clerkParent,
        { name: `Contact ${i}`, phone: `06-000000${i}`, relation: "familie" },
      );
      assert(r.status === 201, `contact ${i} status ${r.status}`);
      lastId = r.json?.contact?.id;
    }
    const zesde = await req(
      "POST",
      `/api/parent/athletes/${clerkChildU16}/emergency-contacts`,
      clerkParent,
      { name: "Zesde", phone: "06-9999999" },
    );
    assert(zesde.status === 400, `zesde contact gaf ${zesde.status}`);
    const del = await req(
      "DELETE",
      `/api/parent/athletes/${clerkChildU16}/emergency-contacts/${lastId}`,
      clerkParent,
    );
    assert(del.status === 200 && del.json?.removed === 1, "verwijderen mislukt");
  });

  // 12 — Bevestigingen: rechten-gate + idempotente upsert.
  await scenario("bevestiging: gate op wedstrijd-recht, idempotent", async () => {
    // Teen heeft wedstrijd-recht (scenario 6/8); adult had geen wedstrijd-recht.
    const denied = await req(
      "POST",
      `/api/parent/athletes/${clerkAdult}/confirmations`,
      clerkParent,
      { subjectType: "race", subjectId: "race-1", decision: "bevestigd" },
    );
    assert(denied.status === 403, `zonder recht gaf ${denied.status}`);
    const eerste = await req(
      "POST",
      `/api/parent/athletes/${clerkTeen}/confirmations`,
      clerkParent,
      { subjectType: "race", subjectId: "race-42", decision: "bevestigd" },
    );
    assert(eerste.status === 200, `eerste bevestiging ${eerste.status}`);
    const tweede = await req(
      "POST",
      `/api/parent/athletes/${clerkTeen}/confirmations`,
      clerkParent,
      { subjectType: "race", subjectId: "race-42", decision: "afgewezen" },
    );
    assert(tweede.status === 200, `tweede besluit ${tweede.status}`);
    const rows = await db
      .select()
      .from(parentConfirmationsTable)
      .where(
        and(
          eq(parentConfirmationsTable.parentClerkId, clerkParent),
          eq(parentConfirmationsTable.athleteClerkId, clerkTeen),
          eq(parentConfirmationsTable.subjectId, "race-42"),
        ),
      );
    assert(rows.length === 1, `verwacht 1 rij, kreeg ${rows.length}`);
    assert(rows[0]!.decision === "afgewezen", "besluit niet overschreven");
  });

  // 13 — Berichten: communicatie-gate + versturen + spiegel.
  await scenario("berichten: gate en tweerichtingsverkeer", async () => {
    // Teen heeft communicatie uit (scenario 6) → beide kanten 403.
    const p403 = await req(
      "GET",
      `/api/parent/athletes/${clerkTeen}/messages`,
      clerkParent,
    );
    assert(p403.status === 403, `ouder zonder recht gaf ${p403.status}`);
    const a403 = await req(
      "GET",
      `/api/links/parent/${clerkParent}/messages`,
      clerkTeen,
    );
    assert(a403.status === 403, `sporter zonder recht gaf ${a403.status}`);
    // u16 heeft communicatie aan (scenario 4).
    const send = await req(
      "POST",
      `/api/parent/athletes/${clerkChildU16}/messages`,
      clerkParent,
      { body: "Vergeet je bidon niet!" },
    );
    assert(send.status === 201, `versturen gaf ${send.status}`);
    const mirror = await req(
      "GET",
      `/api/links/parent/${clerkParent}/messages`,
      clerkChildU16,
    );
    assert(mirror.status === 200, `sporter-spiegel gaf ${mirror.status}`);
    assert(
      (mirror.json?.messages as any[]).some((m) => m.body === "Vergeet je bidon niet!"),
      "bericht niet zichtbaar bij sporter",
    );
  });

  // 14 — Uitnodiging weigeren: declined, geen koppeling, tweede keer 409.
  await scenario("uitnodiging weigeren: atomair, geen koppeling", async () => {
    const inv = await req("POST", "/api/invitations", clerkParent, {
      relationship: "parent_athlete",
    });
    assert(inv.status === 201 || inv.status === 200, `invite status ${inv.status}`);
    const token = inv.json?.invitation?.token ?? inv.json?.token;
    assert(token, "token ontbreekt");
    const decline = await req(
      "POST",
      `/api/invitations/${token}/decline`,
      clerkAdult,
    );
    assert(decline.status === 200, `decline status ${decline.status}`);
    assert(
      decline.json?.invitation?.status === "declined",
      `status ${decline.json?.invitation?.status}`,
    );
    const again = await req(
      "POST",
      `/api/invitations/${token}/decline`,
      clerkAdult,
    );
    assert(again.status === 409, `tweede decline gaf ${again.status}`);
    const link = await linkRow(clerkParent, clerkAdult);
    // De bestaande (geseedde) koppeling blijft — maar er is géén extra rij en
    // de invite heeft niets aangemaakt of gewijzigd.
    const rows = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, clerkParent),
          eq(parentAthleteLinksTable.athleteClerkId, clerkAdult),
        ),
      );
    assert(rows.length === 1 && link?.status === "accepted", "koppeling gewijzigd door decline");
  });

  // 15 — Onbekende leeftijd: fail-closed op veiligheidsminimum, ook mét
  // eerder bevestigde bredere rechten; parentMayEdit blijft false.
  await scenario("onbekende leeftijd: nooit meer dan veiligheidsminimum", async () => {
    // Adult had zojuist herbevestigde rechten incl. planning (scenario 9).
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: null, birthYear: null })
      .where(eq(athleteProfilesTable.clerkId, clerkAdult));
    const ov = await req("GET", "/api/parent/overview", clerkParent);
    const child = childEntry(ov.json, clerkAdult);
    assert(child.access.tier === "unknown", `tier ${child.access.tier}`);
    assert(child.access.parentMayEdit === false, "parentMayEdit moet false zijn");
    assert(child.access.permissions.planning === false, "planning moet dicht bij onbekende leeftijd");
    assert(child.access.permissions.gezondheid === true, "veiligheidsminimum moet open blijven");
    // Ook de legacy-route /api/parent/athletes volgt dezelfde rechtenlaag.
    const legacy = await req("GET", "/api/parent/athletes", clerkParent);
    const entry = (legacy.json?.athletes as any[]).find(
      (a) => a.athleteClerkId === clerkAdult,
    );
    assert(entry, "kind ontbreekt in /athletes");
    assert(entry.schedule === undefined, "schedule mag niet lekken zonder planning-recht");
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: birthDateForAge(20) })
      .where(eq(athleteProfilesTable.clerkId, clerkAdult));
  });

  // 16 — Noodcontact-limiet houdt stand onder gelijktijdige verzoeken.
  await scenario("noodcontacten: limiet houdt onder gelijktijdigheid", async () => {
    // Teen heeft 0 contacten; vuur 8 tegelijk af — er mogen er max 5 landen.
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        req(
          "POST",
          `/api/parent/athletes/${clerkTeen}/emergency-contacts`,
          clerkParent,
          { name: `Race ${i}`, phone: `06-11111${i}` },
        ),
      ),
    );
    const created = attempts.filter((a) => a.status === 201).length;
    assert(created === 5, `verwacht 5 aangemaakt, kreeg ${created}`);
    const rows = await db
      .select({ id: emergencyContactsTable.id })
      .from(emergencyContactsTable)
      .where(eq(emergencyContactsTable.athleteClerkId, clerkTeen));
    assert(rows.length === 5, `verwacht 5 rijen, kreeg ${rows.length}`);
  });

  await cleanup();
  await stopServer();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(
      `${r.status === "pass" ? "PASS" : "FAIL"}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("test run crashed:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
