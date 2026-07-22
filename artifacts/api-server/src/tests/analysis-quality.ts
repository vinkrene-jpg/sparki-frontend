// Analysekwaliteit & feedbacklus (Afbouwgolf 4) — DB-backed route contract test.
//
// Pint de garanties van de feedbacklus vast:
//   1. Herleidbaarheid: persistObservation stempelt engine/regel/versie/
//      ontbrekende data op de rij.
//   2. Feedback is idempotent: één rij per (actor, onderwerp); een nieuw
//      oordeel VERVANGT het vorige (upsert), nooit een dubbele melding.
//   3. Kwaliteitsregistratie: bij ieder oordeel wordt de berekeningscontext
//      als momentopname meegeschreven (voor observaties uit de databank).
//   4. Validatie: "onjuist" vereist een reden; onbekende oordelen/onderwerpen/
//      redenen worden geweigerd.
//   5. Toestemmingsgate: een coach zonder geaccepteerde koppeling of met
//      sharing "none" krijgt 403 (fail-closed); eigendom van observaties wordt
//      gecontroleerd (404 bij andermans observatie).
//   6. Coachbesluit accept/adjust/reject: reject vereist reden, accept
//      hergebruikt het bestaande overnemen-pad (geen parallel schrijfpad) en
//      is idempotent; elk besluit landt als één feedbackrij.
//   7. Admin-kwaliteitsoverzicht telt de oordelen eerlijk mee.
//   VEILIGHEID: feedback wijzigt nooit analyse-/veiligheidsregels — er bestaat
//   geen schrijfpad; dit blijft registratie + aggregatie.
//
// Run: `pnpm --filter @workspace/api-server run test:analysis-quality`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  aiObservationsTable,
  analysisFeedbackTable,
  coachAthleteLinksTable,
  privacySettingsTable,
  plannedWorkoutsTable,
  trainingPlansTable,
  planDaysTable,
  userProfilesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { persistObservation } from "../lib/ai-memory";
import { SPARKI_ENGINE_VERSION } from "../lib/engine-version";

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
const RUN = `test_anaq_${Date.now()}`;
const athleteA = `${RUN}_athlete_a`;
const athleteB = `${RUN}_athlete_b`;
const coachLinked = `${RUN}_coach_linked`;
const coachUnlinked = `${RUN}_coach_unlinked`;

const seeded = {
  obsA: 0,
  planId: 0,
  planDayId: 0,
  planDayDate: "",
};

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

async function feedbackRows(actor: string, subjectKey: string) {
  return db
    .select()
    .from(analysisFeedbackTable)
    .where(
      and(
        eq(analysisFeedbackTable.actorClerkId, actor),
        eq(analysisFeedbackTable.subjectKey, subjectKey),
      ),
    );
}

async function cleanup() {
  for (const c of [athleteA, athleteB, coachLinked, coachUnlinked]) {
    await db
      .delete(analysisFeedbackTable)
      .where(eq(analysisFeedbackTable.actorClerkId, c))
      .catch(() => {});
  }
  await db
    .delete(aiObservationsTable)
    .where(eq(aiObservationsTable.clerkId, athleteA))
    .catch(() => {});
  await db
    .delete(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.clerkId, athleteA))
    .catch(() => {});
  await db
    .delete(planDaysTable)
    .where(eq(planDaysTable.clerkId, athleteA))
    .catch(() => {});
  await db
    .delete(trainingPlansTable)
    .where(eq(trainingPlansTable.clerkId, athleteA))
    .catch(() => {});
  await db
    .delete(privacySettingsTable)
    .where(eq(privacySettingsTable.clerkId, athleteA))
    .catch(() => {});
  await db
    .delete(coachAthleteLinksTable)
    .where(eq(coachAthleteLinksTable.athleteClerkId, athleteA))
    .catch(() => {});
  for (const c of [coachLinked, coachUnlinked, athleteB, athleteA]) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function seed() {
  await ensureAccount(athleteA, `${athleteA}@example.test`, "Atleet A", silentLogger);
  await ensureAccount(athleteB, `${athleteB}@example.test`, "Atleet B", silentLogger);
  await ensureAccount(coachLinked, `${coachLinked}@example.test`, "Coach L", silentLogger);
  await ensureAccount(coachUnlinked, `${coachUnlinked}@example.test`, "Coach U", silentLogger);
  for (const c of [coachLinked, coachUnlinked]) {
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete", "coach"] })
      .where(eq(userProfilesTable.clerkId, c));
  }
  // Volwassen sporter zodat de coachgate niet op minderjarigheid dichtvalt.
  await db
    .update(athleteProfilesTable)
    .set({ birthYear: 1990 })
    .where(eq(athleteProfilesTable.clerkId, athleteA));

  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: coachLinked,
    athleteClerkId: athleteA,
    status: "accepted",
  });
  await db
    .insert(privacySettingsTable)
    .values({ clerkId: athleteA, dataSharingCoach: "full" })
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: { dataSharingCoach: "full" },
    });

  // Adviesschema met één trainingsdag voor het coachbesluit.
  seeded.planDayDate = isoOffset(2);
  const [plan] = await db
    .insert(trainingPlansTable)
    .values({
      clerkId: athleteA,
      status: "active",
      mode: "advisory",
      weekStartDate: isoOffset(0),
      horizonEndDate: isoOffset(20),
    })
    .returning({ id: trainingPlansTable.id });
  seeded.planId = plan!.id;
  const [day] = await db
    .insert(planDaysTable)
    .values({
      planId: seeded.planId,
      clerkId: athleteA,
      dayDate: seeded.planDayDate,
      weekIndex: 0,
      focus: "Duurblok analysekwaliteit",
      trainingType: "duur",
    })
    .returning({ id: planDaysTable.id });
  seeded.planDayId = day!.id;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await startServer();
  await seed();

  // 1) Herleidbaarheid op persist.
  await scenario(
    "persistObservation stempelt engine/regel/versie/ontbrekende data",
    async () => {
      const row = await persistObservation({
        clerkId: athleteA,
        sourceType: "system",
        title: "Testobservatie kwaliteit",
        observationText: "Belasting stijgt sneller dan gebruikelijk.",
        category: "training",
        severity: "info",
        confidenceScore: 0.7,
        engine: "observation",
        ruleKey: "load_spike",
        engineVersion: SPARKI_ENGINE_VERSION,
        missingData: ["hartslag in rust"],
        dedupeKey: `${RUN}_obs_a`,
      });
      assert(row, "observatie niet opgeslagen");
      assert(row!.engine === "observation", `engine=${row!.engine}`);
      assert(row!.ruleKey === "load_spike", `ruleKey=${row!.ruleKey}`);
      assert(
        row!.engineVersion === SPARKI_ENGINE_VERSION,
        `engineVersion=${row!.engineVersion}`,
      );
      assert(
        Array.isArray(row!.missingData) && row!.missingData[0] === "hartslag in rust",
        "missingData ontbreekt",
      );
      seeded.obsA = row!.id;
    },
  );

  // 2) Feedback op eigen observatie + contextmomentopname uit de databank.
  await scenario(
    "feedback 'nuttig' op eigen observatie slaat contextmomentopname op",
    async () => {
      const { status, json } = await req("POST", "/api/analysis-feedback", athleteA, {
        subjectType: "observation",
        subjectKey: String(seeded.obsA),
        verdict: "nuttig",
      });
      assert(status === 201, `status=${status}`);
      const fb = (json as { feedback: { context: Record<string, unknown> } }).feedback;
      assert(fb.context?.engine === "observation", "context.engine ontbreekt");
      assert(fb.context?.ruleKey === "load_spike", "context.ruleKey ontbreekt");
      assert(
        fb.context?.engineVersion === SPARKI_ENGINE_VERSION,
        "context.engineVersion ontbreekt",
      );
    },
  );

  // 3) Idempotentie: nieuw oordeel vervangt, geen tweede rij.
  await scenario("herhaalde feedback is een upsert (één rij, nieuw oordeel)", async () => {
    const { status } = await req("POST", "/api/analysis-feedback", athleteA, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "al_bekend",
    });
    assert(status === 201, `status=${status}`);
    const rows = await feedbackRows(athleteA, String(seeded.obsA));
    assert(rows.length === 1, `rijen=${rows.length}`);
    assert(rows[0]!.verdict === "al_bekend", `verdict=${rows[0]!.verdict}`);
  });

  // 4) "onjuist" zonder reden wordt geweigerd.
  await scenario("'onjuist' zonder reden → 400", async () => {
    const { status } = await req("POST", "/api/analysis-feedback", athleteA, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "onjuist",
    });
    assert(status === 400, `status=${status}`);
  });

  // 5) "onjuist" mét reden wordt geregistreerd.
  await scenario("'onjuist' met redencode → 201 en reden bewaard", async () => {
    const { status } = await req("POST", "/api/analysis-feedback", athleteA, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "onjuist",
      reasonCode: "klopt_niet_met_gevoel",
    });
    assert(status === 201, `status=${status}`);
    const rows = await feedbackRows(athleteA, String(seeded.obsA));
    assert(rows.length === 1 && rows[0]!.reasonCode === "klopt_niet_met_gevoel",
      "reden niet bewaard of dubbele rij");
  });

  // 6) Onbekende waarden worden geweigerd.
  await scenario("onbekend oordeel / onderwerp / reden → 400", async () => {
    const bad1 = await req("POST", "/api/analysis-feedback", athleteA, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "geweldig",
    });
    assert(bad1.status === 400, `verdict-status=${bad1.status}`);
    const bad2 = await req("POST", "/api/analysis-feedback", athleteA, {
      subjectType: "horoscoop",
      subjectKey: "x",
      verdict: "nuttig",
    });
    assert(bad2.status === 400, `subjectType-status=${bad2.status}`);
    const bad3 = await req("POST", "/api/analysis-feedback", athleteA, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "onjuist",
      reasonCode: "omdat",
    });
    assert(bad3.status === 400, `reasonCode-status=${bad3.status}`);
  });

  // 7) Eigendom: andermans observatie → 404, geen rij.
  await scenario("feedback op andermans observatie → 404 zonder mutatie", async () => {
    const { status } = await req("POST", "/api/analysis-feedback", athleteB, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "nuttig",
    });
    assert(status === 404, `status=${status}`);
    const rows = await feedbackRows(athleteB, String(seeded.obsA));
    assert(rows.length === 0, "rij ontstond ondanks 404");
  });

  // 8) Coachgate: zonder koppeling → 403.
  await scenario("coach zonder koppeling → 403", async () => {
    const { status } = await req("POST", "/api/analysis-feedback", coachUnlinked, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "nuttig",
      athleteClerkId: athleteA,
    });
    assert(status === 403, `status=${status}`);
  });

  // 9) Coachgate: koppeling maar sharing "none" → 403 (fail-closed).
  await scenario("gekoppelde coach bij sharing 'none' → 403", async () => {
    await db
      .update(privacySettingsTable)
      .set({ dataSharingCoach: "none" })
      .where(eq(privacySettingsTable.clerkId, athleteA));
    const { status } = await req("POST", "/api/analysis-feedback", coachLinked, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "nuttig",
      athleteClerkId: athleteA,
    });
    assert(status === 403, `status=${status}`);
    await db
      .update(privacySettingsTable)
      .set({ dataSharingCoach: "full" })
      .where(eq(privacySettingsTable.clerkId, athleteA));
  });

  // 10) Gekoppelde coach met sharing → 201, actorRole "coach".
  await scenario("gekoppelde coach met sharing → 201 als coach", async () => {
    const { status, json } = await req("POST", "/api/analysis-feedback", coachLinked, {
      subjectType: "observation",
      subjectKey: String(seeded.obsA),
      verdict: "nuttig",
      athleteClerkId: athleteA,
    });
    assert(status === 201, `status=${status}`);
    const fb = (json as { feedback: { actorRole: string } }).feedback;
    assert(fb.actorRole === "coach", `actorRole=${fb.actorRole}`);
  });

  // 11) GET geeft alleen eigen oordelen, gefilterd.
  await scenario("GET /analysis-feedback filtert op eigen oordelen", async () => {
    const { status, json } = await req(
      "GET",
      `/api/analysis-feedback?subjectType=observation&subjectKeys=${seeded.obsA}`,
      athleteA,
    );
    assert(status === 200, `status=${status}`);
    const rows = (json as { feedback: { actorClerkId: string }[] }).feedback;
    assert(rows.length === 1, `rijen=${rows.length}`);
    assert(rows[0]!.actorClerkId === athleteA, "andermans rij zichtbaar");
  });

  // 12) Coachbesluit: reject zonder reden → 400.
  await scenario("coachbesluit 'reject' zonder reden → 400", async () => {
    const { status } = await req(
      "POST",
      `/api/coach/athletes/${athleteA}/plan/decision`,
      coachLinked,
      { planDayId: seeded.planDayId, decision: "reject" },
    );
    assert(status === 400, `status=${status}`);
  });

  // 13) Coachbesluit: adjust zonder toelichting → 400.
  await scenario("coachbesluit 'adjust' zonder toelichting → 400", async () => {
    const { status } = await req(
      "POST",
      `/api/coach/athletes/${athleteA}/plan/decision`,
      coachLinked,
      { planDayId: seeded.planDayId, decision: "adjust" },
    );
    assert(status === 400, `status=${status}`);
  });

  // 14) Coachbesluit accept: hergebruikt overnemen-pad + feedbackrij.
  await scenario(
    "coachbesluit 'accept' neemt de dag over en registreert één feedbackrij",
    async () => {
      const { status } = await req(
        "POST",
        `/api/coach/athletes/${athleteA}/plan/decision`,
        coachLinked,
        { planDayId: seeded.planDayId, decision: "accept" },
      );
      assert(status === 200 || status === 201, `status=${status}`);
      const adopted = await db
        .select()
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, athleteA),
            eq(plannedWorkoutsTable.scheduledDate, seeded.planDayDate),
            eq(plannedWorkoutsTable.source, "coach"),
          ),
        );
      assert(adopted.length === 1, `overgenomen sessies=${adopted.length}`);
      const rows = await feedbackRows(
        coachLinked,
        `plan_day:${seeded.planDayId}`,
      );
      assert(rows.length === 1, `feedbackrijen=${rows.length}`);
      assert(rows[0]!.subjectType === "coach_proposal", "subjectType onjuist");
    },
  );

  // 15) Idempotentie coachbesluit: herhalen maakt géén tweede sessie/rij.
  await scenario("herhaald coachbesluit blijft één sessie en één rij", async () => {
    const { status } = await req(
      "POST",
      `/api/coach/athletes/${athleteA}/plan/decision`,
      coachLinked,
      { planDayId: seeded.planDayId, decision: "accept" },
    );
    assert(status === 200 || status === 201, `status=${status}`);
    const adopted = await db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, athleteA),
          eq(plannedWorkoutsTable.scheduledDate, seeded.planDayDate),
          eq(plannedWorkoutsTable.source, "coach"),
        ),
      );
    assert(adopted.length === 1, `overgenomen sessies=${adopted.length}`);
    const rows = await feedbackRows(coachLinked, `plan_day:${seeded.planDayId}`);
    assert(rows.length === 1, `feedbackrijen=${rows.length}`);
  });

  // 16) Coachbesluit reject: besluit vervangt het eerdere, geen mutatie in plan.
  await scenario(
    "coachbesluit 'reject' met reden vervangt het oordeel zonder planmutatie",
    async () => {
      const before = await db
        .select({ id: plannedWorkoutsTable.id })
        .from(plannedWorkoutsTable)
        .where(eq(plannedWorkoutsTable.clerkId, athleteA));
      const { status } = await req(
        "POST",
        `/api/coach/athletes/${athleteA}/plan/decision`,
        coachLinked,
        {
          planDayId: seeded.planDayId,
          decision: "reject",
          reasonText: "Te zwaar na wedstrijdweekend.",
        },
      );
      assert(status === 200 || status === 201, `status=${status}`);
      const after = await db
        .select({ id: plannedWorkoutsTable.id })
        .from(plannedWorkoutsTable)
        .where(eq(plannedWorkoutsTable.clerkId, athleteA));
      assert(after.length === before.length, "reject muteerde het plan");
      const rows = await feedbackRows(coachLinked, `plan_day:${seeded.planDayId}`);
      assert(rows.length === 1, `feedbackrijen=${rows.length}`);
      assert(rows[0]!.verdict === "niet_opgevolgd", `verdict=${rows[0]!.verdict}`);
      assert(!!rows[0]!.reasonText, "reden ontbreekt");
      // Herbeoordeling moet de HELE rij verversen: ook reasonCode en de
      // contextmomentopname — anders blijft de oude verantwoording staan.
      assert(rows[0]!.reasonCode === "anders", `reasonCode=${rows[0]!.reasonCode}`);
      const ctx = rows[0]!.context as Record<string, unknown> | null;
      assert(ctx?.ruleKey === "decision:reject", `context.ruleKey=${ctx?.ruleKey}`);
      assert(
        ctx?.engineVersion === SPARKI_ENGINE_VERSION,
        "context.engineVersion niet ververst",
      );
    },
  );

  // 17) Coachgate op besluit: ongekoppelde coach → 403.
  await scenario("coachbesluit door ongekoppelde coach → 403", async () => {
    const { status } = await req(
      "POST",
      `/api/coach/athletes/${athleteA}/plan/decision`,
      coachUnlinked,
      { planDayId: seeded.planDayId, decision: "accept" },
    );
    assert(status === 403, `status=${status}`);
  });

  // 18) Admin-kwaliteitsoverzicht telt de oordelen eerlijk mee.
  await scenario("admin kwaliteitsoverzicht telt geregistreerde oordelen", async () => {
    const { status, json } = await req("GET", "/api/admin/quality", athleteA);
    assert(status === 200, `status=${status}`);
    const q = json as {
      totals: Record<string, number>;
      byEngine: { engine: string; total: number; onjuist: number }[];
      recentIncorrect: unknown[];
    };
    assert((q.totals.onjuist ?? 0) >= 1, `totals.onjuist=${q.totals.onjuist}`);
    assert(
      q.byEngine.some((e) => e.engine === "observation" && e.total >= 1),
      "byEngine mist de observation-engine",
    );
    assert(Array.isArray(q.recentIncorrect), "recentIncorrect ontbreekt");
  });

  // VEILIGHEID (structureel): er bestaat geen schrijfpad van feedback naar
  // analyse-regels; dit wordt geborgd doordat de routes uitsluitend in
  // analysis_feedback schrijven — bovenstaande scenario's bewijzen dat plan en
  // observaties ongewijzigd blijven bij oordelen.

  await cleanup();
  await stopServer();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "PASS" : "FAIL";
    if (r.status === "fail") failed++;
    console.log(`${mark}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("test run failed:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
