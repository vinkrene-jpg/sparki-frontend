// Golf 27 — AI-helpdesk & supportautomatisering: DB-backed route + engine test.
//
// Test de ECHTE Express-app met wegwerp-gebruikers. Deterministische engine-
// paden (mens/storing_bekend/meer_info) lopen via HTTP; het AI-verwoordingspad
// (direct/beperkt) wordt op engine-niveau vastgepind zodat de test geen
// modelaanroep nodig heeft. Gepind gedrag:
//   1. Deterministische categorie-indeling (expliciete keuze wint).
//   2. Gevoelige onderwerpen (privacy/betaling/gezondheid) → altijd mens.
//   3. Minderjarig (of onbekende leeftijd) fail-closed → mens buiten
//      gebruik/training/mechanieker; ticketprioriteit urgent.
//   4. Antwoordbesluit-matrix: artikelen → direct/beperkt, storing →
//      storing_bekend, foutgroep zonder bron → mens, korte vraag → meer_info,
//      geen bron → mens + ticket.
//   5. Privacyvraag via HTTP: ticket met humanRequiredReason, antwoord belooft
//      expliciet géén wijziging aan account/gegevens/betalingen.
//   6. Bekende storing via HTTP: deterministisch antwoord + ticket gekoppeld.
//   7. Zelfde storing opnieuw vragen → GEEN duplicaat (attach op open ticket).
//   8. Negatieve beoordeling zonder ticket → automatisch ticket.
//   9. Rolgebonden artikel is onzichtbaar voor een andere rol (kennisbank).
//  10. Gebruiker ziet NOOIT interne notities of onverzonden concepten.
//  11. Reactie op een opgelost ticket heropent het.
//  12. Cross-account: andermans ticket = 404.
//  13. Beheer: verzenden zet wacht_op_gebruiker + bericht + melding.
//  14. Storing oplossen informeert getroffen gebruikers.
//  15. Opgelost ticket → concept-artikel; publiceren = versie + 1.
//  16. humanSendRequired hard voor privacy/betaling.
//
// Run: `pnpm --filter @workspace/api-server run test:support-helpdesk`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  athleteProfilesTable,
  helpdeskTurnsTable,
  supportTicketsTable,
  supportTicketMessagesTable,
  supportKnownIssuesTable,
  supportArticlesTable,
  notificationsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  classifyCategory,
  humanReasonFor,
  decideAnswer,
  findArticles,
  humanSendRequired,
} from "../lib/support/helpdesk";

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

const RUN = `test_support_${Date.now()}`;
const clerkId = `${RUN}_adult`;
const clerkIdB = `${RUN}_other`;
const clerkIdMinor = `${RUN}_minor`;

async function api(
  method: string,
  path: string,
  body?: unknown,
  actor: string = clerkId,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function cleanup() {
  const ids = [clerkId, clerkIdB, clerkIdMinor];
  const tickets = await db
    .select({ id: supportTicketsTable.id })
    .from(supportTicketsTable)
    .where(inArray(supportTicketsTable.clerkId, ids));
  const ticketIds = tickets.map((t) => t.id);
  if (ticketIds.length > 0) {
    await db
      .delete(supportTicketMessagesTable)
      .where(inArray(supportTicketMessagesTable.ticketId, ticketIds));
  }
  await db.delete(helpdeskTurnsTable).where(inArray(helpdeskTurnsTable.clerkId, ids));
  if (ticketIds.length > 0) {
    await db.delete(supportTicketsTable).where(inArray(supportTicketsTable.id, ticketIds));
  }
  // Testdata op titelprefix — alleen eigen wegwerp-rijen.
  const issues = await db
    .select({ id: supportKnownIssuesTable.id })
    .from(supportKnownIssuesTable);
  const own = issues.length
    ? await db
        .select({ id: supportKnownIssuesTable.id, title: supportKnownIssuesTable.title })
        .from(supportKnownIssuesTable)
    : [];
  const ownIssueIds = own.filter((i) => i.title.startsWith(RUN)).map((i) => i.id);
  if (ownIssueIds.length > 0) {
    await db
      .delete(supportKnownIssuesTable)
      .where(inArray(supportKnownIssuesTable.id, ownIssueIds));
  }
  const articles = await db
    .select({ id: supportArticlesTable.id, title: supportArticlesTable.title })
    .from(supportArticlesTable);
  const ownArticleIds = articles.filter((a) => a.title.startsWith(RUN)).map((a) => a.id);
  if (ownArticleIds.length > 0) {
    await db
      .delete(supportArticlesTable)
      .where(inArray(supportArticlesTable.id, ownArticleIds));
  }
  await db.delete(notificationsTable).where(inArray(notificationsTable.clerkId, ids));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ids));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  await ensureAccount(clerkId, `${clerkId}@example.test`, "Support Volwassen", silentLogger);
  await ensureAccount(clerkIdB, `${clerkIdB}@example.test`, "Support Ander", silentLogger);
  await ensureAccount(clerkIdMinor, `${clerkIdMinor}@example.test`, "Support Jeugd", silentLogger);
  // Volwassen renners krijgen een geboortedatum; de jeugdgebruiker bewust NIET
  // (onbekende leeftijd = minderjarig, fail-closed).
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: "1990-05-01", birthYear: 1990 })
    .where(inArray(athleteProfilesTable.clerkId, [clerkId, clerkIdB]));
  await startServer();

  // ── Engine (deterministisch, geen modelaanroep) ───────────────────────────

  await scenario("1. Categorie-indeling: sleutelwoorden + expliciete keuze wint", () => {
    assert(classifyCategory("Mijn Strava synchroniseert niet", null) === "koppelingen_sync", "strava → koppelingen_sync");
    assert(classifyCategory("Hoe zeg ik mijn abonnement op?", null) === "abonnement_betaling", "abonnement → betaling");
    assert(classifyCategory("Waar vind ik dit?", null) === "gebruik", "onbekend → gebruik");
    assert(classifyCategory("Mijn Strava synchroniseert niet", "mechanieker") === "mechanieker", "expliciete keuze wint");
  });

  await scenario("2. Gevoelige onderwerpen gaan altijd naar een mens", () => {
    assert(humanReasonFor("Ik wil mijn account verwijderen", "gebruik", false) === "accountverwijdering", "verwijderen → accountverwijdering");
    assert(humanReasonFor("Waar blijft mijn terugbetaling?", "abonnement_betaling", false) === "betaling", "refund → betaling");
    assert(humanReasonFor("Ik heb pijn op de borst na de training", "training_analyse", false) === "gezondheid_veiligheid", "gezondheid → mens");
    assert(humanReasonFor("Hoe werkt het trainingsschema?", "training_analyse", false) === null, "gewone vraag → geen mens verplicht");
  });

  await scenario("3. Minderjarig fail-closed buiten gebruik/training/mechanieker", () => {
    assert(humanReasonFor("Strava koppelen lukt niet", "koppelingen_sync", true) === "minderjarig", "minor + sync → minderjarig");
    assert(humanReasonFor("Hoe lees ik mijn belasting?", "training_analyse", true) === null, "minor + trainingsuitleg mag");
  });

  await scenario("4. Antwoordbesluit-matrix is deterministisch", () => {
    const base = { isMinor: false, knownIssue: null, articles: [], errorGroup: null } as any;
    const mens = decideAnswer("Waar blijft mijn terugbetaling?", "abonnement_betaling", base);
    assert(mens.status === "mens" && mens.needsTicket, "betaling → mens + ticket");
    const storing = decideAnswer("De app laadt niet", "technisch", { ...base, knownIssue: { id: 1 } });
    assert(storing.status === "storing_bekend" && storing.needsTicket, "storing → storing_bekend + ticket");
    const direct = decideAnswer("Hoe koppel ik mijn meter?", "gebruik", { ...base, articles: [{ id: 1 }, { id: 2 }] });
    assert(direct.status === "direct" && !direct.needsTicket, "≥2 artikelen → direct");
    const beperkt = decideAnswer("Hoe koppel ik mijn meter?", "gebruik", { ...base, articles: [{ id: 1 }] });
    assert(beperkt.status === "beperkt", "1 artikel → beperkt");
    const fout = decideAnswer("Er ging vanmiddag iets kapot", "technisch", { ...base, errorGroup: { id: 1 } });
    assert(fout.status === "mens" && fout.needsTicket, "foutgroep zonder bron → mens");
    const kort = decideAnswer("help", "gebruik", base);
    assert(kort.status === "meer_info" && !kort.needsTicket, "korte vraag → meer_info zonder ticket");
    const geen = decideAnswer("Waarom verandert mijn weekoverzicht steeds", "gebruik", base);
    assert(geen.status === "mens" && geen.needsTicket, "geen bron → mens + ticket");
  });

  // ── HTTP: gebruikerskant ───────────────────────────────────────────────────

  let privacyTicketId = 0;
  await scenario("5. Privacyvraag via HTTP → ticket + geen-mutatie-belofte", async () => {
    const r = await api("POST", "/api/support/helpdesk/ask", {
      question: "Ik wil al mijn gegevens laten verwijderen (AVG).",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.status === "mens", `answerStatus ${r.body.status}`);
    assert(Number.isInteger(r.body.ticketId), "ticket aangemaakt");
    privacyTicketId = r.body.ticketId;
    assert(
      typeof r.body.answer === "string" && r.body.answer.includes("niets gewijzigd"),
      "antwoord belooft expliciet geen wijziging",
    );
    const [t] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, privacyTicketId))
      .limit(1);
    assert(t && (t.humanRequiredReason === "privacy" || t.humanRequiredReason === "accountverwijdering"), `humanRequiredReason ${t?.humanRequiredReason}`);
  });

  await scenario("6. Minderjarige (onbekende leeftijd) → mens + urgent ticket", async () => {
    const r = await api(
      "POST",
      "/api/support/helpdesk/ask",
      { question: "Mijn Strava koppeling synchroniseert al dagen niet meer" },
      clerkIdMinor,
    );
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.status === "mens", `answerStatus ${r.body.status}`);
    assert(Number.isInteger(r.body.ticketId), "ticket aangemaakt");
    const [t] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, r.body.ticketId))
      .limit(1);
    assert(t?.humanRequiredReason === "minderjarig", `reden ${t?.humanRequiredReason}`);
    assert(t?.priority === "urgent", `prioriteit ${t?.priority}`);
  });

  let issueId = 0;
  let issueTicketId = 0;
  await scenario("7. Bekende storing → deterministisch antwoord + gekoppeld ticket", async () => {
    const created = await api("POST", "/api/support/beheer/storingen", {
      title: `${RUN} kaartweergave storing`,
      description: "De kaartweergave op de routepagina laadt niet.",
      category: "technisch",
    });
    assert(created.status === 200, `storing aanmaken ${created.status}`);
    issueId = created.body.issue.id;
    const r = await api("POST", "/api/support/helpdesk/ask", {
      question: "De kaartweergave van de routepagina laadt bij mij niet, is dat een storing?",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.status === "storing_bekend", `answerStatus ${r.body.status}`);
    assert(r.body.knownIssue?.id === issueId, "storing herkend");
    assert(typeof r.body.answer === "string" && r.body.answer.includes("kaartweergave"), "deterministisch antwoord noemt de storing");
    assert(Number.isInteger(r.body.ticketId), "ticket aangemaakt");
    issueTicketId = r.body.ticketId;
    const [t] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, issueTicketId))
      .limit(1);
    assert(t?.knownIssueId === issueId, "ticket gekoppeld aan storing");
  });

  await scenario("8. Zelfde storing opnieuw → attach, geen duplicaat-ticket", async () => {
    const r = await api("POST", "/api/support/helpdesk/ask", {
      question: "De kaartweergave op de routepagina laadt niet, is de storing er nog?",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.ticketAttached === true, "attached aan bestaand ticket");
    assert(r.body.ticketId === issueTicketId, `zelfde ticket (${r.body.ticketId} vs ${issueTicketId})`);
  });

  await scenario("9. Korte vraag → meer_info, géén ticket", async () => {
    const r = await api("POST", "/api/support/helpdesk/ask", { question: "help" });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.status === "meer_info", `answerStatus ${r.body.status}`);
    assert(r.body.ticketId === null, "geen ticket");
    assert(typeof r.body.answer === "string" && r.body.answer.length > 0, "wel een doorvraag");
  });

  await scenario("10. Negatieve beoordeling zonder ticket → automatisch ticket", async () => {
    // meer_info-beurt van scenario 9 heeft geen ticket; beoordeel die negatief.
    const turns = await db
      .select()
      .from(helpdeskTurnsTable)
      .where(and(eq(helpdeskTurnsTable.clerkId, clerkId), eq(helpdeskTurnsTable.answerStatus, "meer_info")));
    assert(turns.length > 0, "meer_info-beurt gevonden");
    const turn = turns[turns.length - 1]!;
    const r = await api("POST", `/api/support/helpdesk/${turn.id}/feedback`, {
      feedback: "niet_geholpen",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(Number.isInteger(r.body.ticketId), "ticket aangemaakt na negatieve beoordeling");
  });

  await scenario("11. Rolgebonden artikel onzichtbaar voor andere rol", async () => {
    await api("POST", "/api/support/beheer/artikelen", {
      title: `${RUN} coachhandleiding wachtrij`,
      body: "Alleen voor coaches: zo werkt de cockpitwachtrij.",
      category: "club_coach",
      audienceRoles: ["coach"],
    });
    const created = await api("POST", "/api/support/beheer/artikelen", {
      title: `${RUN} algemene uitleg zones`,
      body: "Zo stel je je zones in via je profiel.",
      category: "training_analyse",
    });
    // Publiceren is verplicht vóór zichtbaarheid.
    const all = await api("GET", "/api/support/beheer/artikelen");
    const own = (all.body.articles as any[]).filter((a) => a.title.startsWith(RUN));
    for (const a of own) await api("POST", `/api/support/beheer/artikelen/${a.id}/publiceer`);
    const list = await api("GET", "/api/support/artikelen");
    const titles = (list.body.articles as any[]).map((a) => a.title);
    assert(titles.includes(`${RUN} algemene uitleg zones`), "algemeen artikel zichtbaar voor sporter");
    assert(!titles.includes(`${RUN} coachhandleiding wachtrij`), "coach-artikel onzichtbaar voor sporter");
    assert(created.status === 200, "artikel aanmaken ok");
  });

  await scenario("12. Gebruiker ziet nooit interne notities of concepten", async () => {
    await api("POST", `/api/support/beheer/tickets/${privacyTicketId}/notitie`, {
      body: "INTERN: identiteit geverifieerd.",
    });
    await db.insert(supportTicketMessagesTable).values({
      ticketId: privacyTicketId,
      authorClerkId: clerkIdB,
      authorRole: "beheerder",
      body: "CONCEPT: nog niet verzonden.",
      isDraft: true,
    });
    const r = await api("GET", `/api/support/tickets/${privacyTicketId}`);
    assert(r.status === 200, `status ${r.status}`);
    const bodies = (r.body.messages as any[]).map((m) => m.body).join(" | ");
    assert(!bodies.includes("INTERN:"), "interne notitie verborgen");
    assert(!bodies.includes("CONCEPT:"), "onverzonden concept verborgen");
  });

  await scenario("13. Cross-account: andermans ticket = 404", async () => {
    const r = await api("GET", `/api/support/tickets/${privacyTicketId}`, undefined, clerkIdB);
    assert(r.status === 404, `status ${r.status}`);
    const w = await api(
      "POST",
      `/api/support/tickets/${privacyTicketId}/messages`,
      { body: "inbreekpoging" },
      clerkIdB,
    );
    assert(w.status === 404, `bericht op andermans ticket ${w.status}`);
  });

  await scenario("14. Beheer verzendt antwoord → wacht_op_gebruiker + melding", async () => {
    const r = await api("POST", `/api/support/beheer/tickets/${privacyTicketId}/verzend`, {
      body: "Een medewerker heeft je verzoek in behandeling genomen. We nemen binnen twee werkdagen contact op.",
    });
    assert(r.status === 200, `status ${r.status}`);
    const [t] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, privacyTicketId))
      .limit(1);
    assert(t?.status === "wacht_op_gebruiker", `ticketstatus ${t?.status}`);
    const view = await api("GET", `/api/support/tickets/${privacyTicketId}`);
    const sent = (view.body.messages as any[]).some((m) => m.body.includes("in behandeling genomen"));
    assert(sent, "verzonden antwoord zichtbaar voor gebruiker");
    const notif = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, clerkId));
    assert(notif.some((n) => n.source === "support"), "supportmelding aangemaakt");
  });

  await scenario("15. Reactie op opgelost ticket heropent het", async () => {
    await api("PATCH", `/api/support/beheer/tickets/${privacyTicketId}`, { status: "opgelost" });
    const r = await api("POST", `/api/support/tickets/${privacyTicketId}/messages`, {
      body: "Het is toch nog niet opgelost bij mij.",
    });
    assert(r.status === 200 && r.body.reopened === true, "reopened");
    const [t] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, privacyTicketId))
      .limit(1);
    assert(t?.status === "heropend", `ticketstatus ${t?.status}`);
  });

  await scenario("16. Storing oplossen informeert getroffen gebruikers", async () => {
    const before = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, clerkId));
    const r = await api("PATCH", `/api/support/beheer/storingen/${issueId}`, {
      status: "opgelost",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.notified >= 1, `notified ${r.body.notified}`);
    const after = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, clerkId));
    assert(after.length > before.length, "getroffen gebruiker kreeg melding");
  });

  await scenario("17. Opgelost ticket → artikel; publiceren = versie + 1", async () => {
    await api("PATCH", `/api/support/beheer/tickets/${issueTicketId}`, { status: "opgelost" });
    const r = await api("POST", `/api/support/beheer/tickets/${issueTicketId}/naar-artikel`);
    assert(r.status === 200, `status ${r.status}`);
    const articleId = r.body.article.id;
    assert(r.body.article.sourceTicketId === issueTicketId, "bron-ticket vastgelegd");
    assert(r.body.article.status !== "gepubliceerd", "concept, niet direct gepubliceerd");
    const pub = await api("POST", `/api/support/beheer/artikelen/${articleId}/publiceer`);
    assert(pub.status === 200 && pub.body.article.version === r.body.article.version + 1, "versie + 1 bij publicatie");
    // Opruimen van dit artikel gebeurt via titelprefix niet — verwijder direct.
    await db.delete(supportArticlesTable).where(eq(supportArticlesTable.id, articleId));
  });

  await scenario("18. Onvoltooid ticket kan geen artikel worden (409)", async () => {
    const r = await api("POST", `/api/support/beheer/tickets/${privacyTicketId}/naar-artikel`);
    assert(r.status === 409, `status ${r.status}`);
  });

  await scenario("19. humanSendRequired hard voor privacy/betaling", () => {
    assert(humanSendRequired({ humanRequiredReason: null, category: "account_privacy" }), "privacycategorie");
    assert(humanSendRequired({ humanRequiredReason: null, category: "abonnement_betaling" }), "betalingscategorie");
    assert(humanSendRequired({ humanRequiredReason: "minderjarig", category: "gebruik" }), "mens-reden");
    assert(!humanSendRequired({ humanRequiredReason: null, category: "gebruik" }), "gewone categorie niet");
  });

  await scenario("21. Parallelle vragen over zelfde storing → exact één open ticket", async () => {
    const created = await api("POST", "/api/support/beheer/storingen", {
      title: `${RUN} uploadwachtrij storing`,
      description: "De uploadwachtrij van ritten blijft hangen bij synchroniseren.",
      category: "koppelingen_sync",
    });
    assert(created.status === 200, `storing aanmaken ${created.status}`);
    const parallelIssueId = created.body.issue.id;
    const q = { question: "Mijn uploadwachtrij blijft hangen bij het synchroniseren, storing?" };
    const [r1, r2, r3] = await Promise.all([
      api("POST", "/api/support/helpdesk/ask", q, clerkIdB),
      api("POST", "/api/support/helpdesk/ask", q, clerkIdB),
      api("POST", "/api/support/helpdesk/ask", q, clerkIdB),
    ]);
    for (const r of [r1, r2, r3]) assert(r.status === 200, `status ${r.status}`);
    const ids = new Set([r1.body.ticketId, r2.body.ticketId, r3.body.ticketId]);
    assert(ids.size === 1, `verwacht één ticket, kreeg ${[...ids].join(",")}`);
    const open = await db
      .select({ id: supportTicketsTable.id })
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.clerkId, clerkIdB),
          eq(supportTicketsTable.knownIssueId, parallelIssueId),
        ),
      );
    assert(open.length === 1, `verwacht 1 ticketrij, kreeg ${open.length}`);
    assert([r1, r2, r3].filter((r) => r.body.ticketAttached).length === 2, "twee van drie attached");
  });

  await scenario("20. findArticles: rolgebonden + score-drempel", async () => {
    const found = await findArticles("Hoe stel ik mijn zones in via mijn profiel?", "training_analyse", "athlete", 5);
    assert(found.some((a) => a.title === `${RUN} algemene uitleg zones`), "artikel gevonden op termen+categorie");
    const coachOnly = await findArticles("cockpitwachtrij voor coaches wachtrij", "club_coach", "athlete", 5);
    assert(!coachOnly.some((a) => a.title.startsWith(RUN)), "coach-artikel niet voor sporter");
  });

  await stopServer();
  await cleanup();
  await pool.end();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  if (failed.length > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("Testrun mislukt:", err);
  try {
    await stopServer();
    await cleanup();
    await pool.end();
  } catch {
    /* opruimen is best-effort */
  }
  process.exit(1);
});
