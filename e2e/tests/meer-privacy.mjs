// Eerste proef van de e2e-browsertestomgeving (WP-S1): Meer → Privacy.
//
// Bewijst per formaat (telefoon + desktop), met échte Clerk-login en échte
// kliks: de Meer-pagina toont "Privacy", de klik landt op /privacy met de
// zichtbare kop "Privacyverklaring Sparki". Daarnaast reproduceert de test de
// door René gevonden verkeerde uitkomst in DEV Preview (aparte routetabel):
// vóór de WP-S1-fix landde Meer → Privacy daar stil op de StartPage-fallback.
//
// Draaien: node e2e/tests/meer-privacy.mjs
import { startProdServer } from "../serve-prod.mjs";
import {
  ensureE2eUser,
  mintTicket,
  launchBrowser,
  TestRun,
} from "../harness.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/meer-privacy",
);

const results = [];
function record(name, fn) {
  return fn()
    .then(() => results.push({ name, status: "PASS" }))
    .catch((err) => results.push({ name, status: "FAIL", note: err.message }));
}

async function proefMeerPrivacy({ browser, baseUrl, viewport, userId }) {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport,
    evidenceDir: EVIDENCE,
    runName: "prod",
  });
  try {
    await run.open();
    // 1. Echt inloggen (éénmalig ticket per context).
    await run.loginWithTicket(await mintTicket(userId));
    // 2. Identiteit + rol verifiëren — faalt bij dev-fallback of verkeerde rol.
    await run.page.goto(`${baseUrl}/meer`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    const me = await run.verifyIdentity({ expectClerkId: userId, expectRole: "athlete" });
    if (me.status !== 200)
      throw new Error(`identiteitscheck gaf status ${me.status} — niet ingelogd?`);
    // 3. Naar Meer, zichtbare Privacy-knop aanklikken, uitkomst controleren.
    await run.page.goto(`${baseUrl}/meer`, { waitUntil: "networkidle" });
    await run.clickAndVerify({
      label: "meer-privacy",
      locator: run.page.getByText("Privacy", { exact: true }).first(),
      expectPath: "/privacy",
      expectVisibleText: ["Privacyverklaring Sparki"],
    });
  } finally {
    await run.close();
  }
}

// Reproductie/verklaring van de DEV Preview-afwijking: de dev-server heeft een
// eigen routetabel (dev-preview.tsx). Deze proef documenteert wat DEV Preview
// nú toont op Meer → Privacy en faalt als daar iets anders dan de echte
// Privacyverklaring verschijnt — vóór de WP-S1-fix was dat de StartPage.
async function proefDevPreview({ browser, userId: _unused }) {
  const run = new TestRun({
    browser,
    baseUrl: "http://127.0.0.1:80",
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: "devpreview",
  });
  try {
    await run.open();
    await run.page.goto("http://127.0.0.1:80/meer", { waitUntil: "networkidle" });
    await run.clickAndVerify({
      label: "meer-privacy",
      locator: run.page.getByText("Privacy", { exact: true }).first(),
      expectPath: "/privacy",
      expectVisibleText: ["Privacyverklaring Sparki"],
    });
  } finally {
    await run.close();
  }
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
try {
  const userId = await ensureE2eUser();
  await record("prod-build mobiel 402x874: Meer → Privacy", () =>
    proefMeerPrivacy({ browser, baseUrl, viewport: "mobiel", userId }));
  await record("prod-build desktop 1440x900: Meer → Privacy", () =>
    proefMeerPrivacy({ browser, baseUrl, viewport: "desktop", userId }));
  await record("dev-preview mobiel: Meer → Privacy (routetabel-afwijking)", () =>
    proefDevPreview({ browser, userId }));
} finally {
  await browser.close();
  server.close();
}

console.log("\n=== e2e meer-privacy — resultaten ===");
let failed = 0;
for (const r of results) {
  console.log(`[${r.status}] ${r.name}${r.note ? ` — ${r.note}` : ""}`);
  if (r.status === "FAIL") failed++;
}
console.log(`${results.length - failed}/${results.length} geslaagd. Bewijs: ${EVIDENCE}`);
process.exit(failed ? 1 : 0);
