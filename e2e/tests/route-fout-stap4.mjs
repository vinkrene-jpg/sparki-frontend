// ROUTE_CLIMB_ERROR_FEEDBACK_01 — echte browserkliktest tegen de PRODUCTIEBUILD.
//
// Bewijst dat een mislukte routegeneratie op stap 4 "Controleren" direct
// zichtbaar faalt op stap 4 zelf (role=alert, begrijpelijke tekst, retry,
// terug naar stap 3, keuzes bewaard) — voor 422 NO_SUITABLE_ROUTE,
// CLIMB_NOT_ON_ROUTE, onbekende 500 en netwerk-timeout. Foutinjectie gebeurt
// op netwerkniveau (page.route op de generatie-endpoints); alle kliks zijn echt.
//
// Draaien: node e2e/tests/route-fout-stap4.mjs
import { launchBrowser, ensureE2eUser, mintTicket, TestRun, VIEWPORTS } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/route-fout-stap4",
);
mkdirSync(EVIDENCE, { recursive: true });

const GEO = { latitude: 50.865, longitude: 5.83 };

const stappen = [];
let exitCode = 0;
function log(stap, ok, detail = "") {
  const status = ok ? "OK" : "FOUT";
  if (!ok) exitCode = 1;
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

// Foutinjectie: het jobmodel is start + poll. We beantwoorden start met een
// jobId en de eerstvolgende poll met done + de gewenste fout.
function installFault(page, fault) {
  let startCalls = 0;
  const jobId = `e2e-fout-${Math.random().toString(36).slice(2)}`;
  const startHandler = async (route) => {
    startCalls += 1;
    if (fault.kind === "timeout-start") {
      await route.abort("timedout");
      return;
    }
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ jobId }),
    });
  };
  const pollHandler = async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        done: true,
        status: fault.status,
        body: fault.body,
      }),
    });
  };
  return {
    jobId,
    getStartCalls: () => startCalls,
    install: async () => {
      await page.route("**/api/routes/generate/start", startHandler);
      await page.route("**/api/routes/generate/options/start", startHandler);
      await page.route(`**/api/routes/generate-jobs/**`, pollHandler);
    },
    uninstall: async () => {
      await page.unroute("**/api/routes/generate/start");
      await page.unroute("**/api/routes/generate/options/start");
      await page.unroute(`**/api/routes/generate-jobs/**`);
    },
  };
}

async function naarStap4(run, { viewport }) {
  const page = run.page;
  await page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Gebruik mijn locatie" }).click();
  await page.getByText(/^Startpunt: 50\.8/).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Verder →" }).first().click(); // → 2
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Verder →" }).first().click(); // → 3
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Verder →" }).first().click(); // → 4
  await page.getByText("JOUW KEUZES").waitFor({ timeout: 5000 });
  log(`${viewport}: wizard op stap 4`, true);
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
try {
  const userId = await ensureE2eUser();

  for (const viewport of ["mobiel", "desktop"]) {
    const run = new TestRun({
      browser,
      baseUrl,
      viewport,
      evidenceDir: EVIDENCE,
      runName: `route-fout-stap4-${viewport}`,
    });
    await run.open();
    await run.context.grantPermissions(["geolocation"]);
    await run.context.setGeolocation(GEO);
    await run.loginWithTicket(await mintTicket(userId));
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    const me = await run.verifyIdentity({ expectClerkId: userId });
    log(`${viewport}: login`, me.status === 200, `auth/me=${me.status}`);
    const page = run.page;
    // Servercode moet technisch gelogd worden — vang de console op.
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    await naarStap4(run, { viewport });
    await run.shot(`${viewport}-stap4`);

    const alert = page.locator('[role="alert"]');
    const genereerKnop = page.getByRole("button", { name: /Genereer route|Berekenen…|Veiligheidscontrole…/ });

    // Scenario 1: 422 NO_SUITABLE_ROUTE (zonder servertekst → vaste tekst).
    let fault = installFault(page, {
      status: 422,
      body: { code: "NO_SUITABLE_ROUTE" },
    });
    await fault.install();
    await page.getByRole("button", { name: "Genereer route" }).click();
    await alert.waitFor({ timeout: 15000 });
    const t1 = (await alert.textContent()) ?? "";
    log(
      `${viewport}: 422 NO_SUITABLE_ROUTE → fout op stap 4`,
      t1.includes("Er kon geen veilige route worden gemaakt"),
      t1.slice(0, 90),
    );
    log(
      `${viewport}: stap 4 blijft actief (geen sprong naar stap 3)`,
      await page.getByText("JOUW KEUZES").isVisible(),
    );
    log(
      `${viewport}: knop hersteld (niet blijven hangen)`,
      (await page.getByRole("button", { name: "Genereer route" }).isVisible()) &&
        !(await page.getByRole("button", { name: "Genereer route" }).isDisabled()),
    );
    log(
      `${viewport}: servercode technisch gelogd`,
      consoleErrors.some((c) => c.includes("NO_SUITABLE_ROUTE")),
    );
    // Fout blijft staan zonder gebruikersactie.
    await page.waitForTimeout(1500);
    log(`${viewport}: fout blijft zichtbaar zonder actie`, await alert.isVisible());
    await run.shot(`${viewport}-fout-422`);

    // Geen dubbele foutmelding.
    log(`${viewport}: precies één foutmelding`, (await alert.count()) === 1);

    // Retry vanuit de fout: knop "Opnieuw proberen" vuurt een nieuwe aanvraag.
    const startsVoor = fault.getStartCalls();
    await alert.getByRole("button", { name: "Opnieuw proberen" }).click();
    await page.waitForTimeout(1200);
    log(
      `${viewport}: retry na fout doet echte nieuwe aanvraag`,
      fault.getStartCalls() > startsVoor,
      `starts ${startsVoor}→${fault.getStartCalls()}`,
    );
    await alert.waitFor({ timeout: 15000 });

    // Terugweg niet geblokkeerd: "Wensen aanpassen (stap 3)" werkt en wist de fout.
    await alert.getByRole("button", { name: "Wensen aanpassen (stap 3)" }).click();
    await page.waitForTimeout(400);
    log(
      `${viewport}: terug naar stap 3 werkt en wist de fout`,
      (await page.getByText("SAMEN RIJDEN?").isVisible()) && (await alert.count()) === 0,
    );
    // En weer vooruit naar stap 4.
    await page.getByRole("button", { name: "Verder →" }).first().click();
    await page.getByText("JOUW KEUZES").waitFor({ timeout: 5000 });
    await fault.uninstall();

    // Scenario 2: CLIMB_NOT_ON_ROUTE met servertekst → servertekst wint.
    fault = installFault(page, {
      status: 422,
      body: {
        code: "CLIMB_NOT_ON_ROUTE",
        error:
          "De gekozen klim kon niet betrouwbaar in de route worden opgenomen. Kies een andere klim of pas het startpunt aan.",
      },
    });
    await fault.install();
    await page.getByRole("button", { name: "Genereer route" }).click();
    await alert.waitFor({ timeout: 15000 });
    const t2 = (await alert.textContent()) ?? "";
    log(
      `${viewport}: CLIMB_NOT_ON_ROUTE → begrijpelijke tekst`,
      t2.includes("kon niet betrouwbaar in de route worden opgenomen"),
      t2.slice(0, 90),
    );
    log(
      `${viewport}: CLIMB-code technisch gelogd`,
      consoleErrors.some((c) => c.includes("CLIMB_NOT_ON_ROUTE")),
    );
    await run.shot(`${viewport}-fout-klim`);
    await fault.uninstall();

    // Keuzes bewaard: samenvatting toont nog steeds start + route-vorm.
    log(
      `${viewport}: keuzes bewaard na fouten`,
      (await page.getByText(/Start: 50\.8/).isVisible()) &&
        (await page.getByText("Lus (rondje)").isVisible()),
    );

    // Scenario 3: onbekende 500 → vaste eerlijke tekst.
    fault = installFault(page, { status: 500, body: {} });
    await fault.install();
    await page.getByRole("button", { name: "Genereer route" }).click();
    await alert.waitFor({ timeout: 15000 });
    const t3 = (await alert.textContent()) ?? "";
    log(
      `${viewport}: onbekende 500 → eerlijke standaardtekst`,
      t3.includes("De route kon niet worden gemaakt. Je instellingen zijn bewaard."),
      t3.slice(0, 90),
    );
    await run.shot(`${viewport}-fout-500`);
    await fault.uninstall();

    // Scenario 4: netwerk-timeout bij de start-aanroep → eerlijke tekst, knop herstelt.
    fault = installFault(page, { kind: "timeout-start" });
    await fault.install();
    // Dubbelklik-test: twee snelle kliks — knop moet tijdens pending disabled zijn.
    const knop = page.getByRole("button", { name: "Genereer route" });
    await knop.click();
    const dubbelklikGeblokkeerd = await knop
      .isDisabled()
      .catch(() => true);
    await knop.click({ force: true }).catch(() => {});
    await alert.waitFor({ timeout: 20000 });
    const t4 = (await alert.textContent()) ?? "";
    log(
      `${viewport}: timeout → eerlijke fout op stap 4`,
      t4.includes("De route kon niet worden gemaakt") || t4.includes("Probeer"),
      t4.slice(0, 90),
    );
    log(
      `${viewport}: dubbelklik geblokkeerd + max 1 extra start`,
      dubbelklikGeblokkeerd || fault.getStartCalls() <= 1,
      `starts=${fault.getStartCalls()}`,
    );
    log(
      `${viewport}: knop hersteld na timeout`,
      !(await page.getByRole("button", { name: "Genereer route" }).isDisabled()),
    );
    await run.shot(`${viewport}-fout-timeout`);
    await fault.uninstall();

    // Snel terug/vooruit tussen stap 3 en 4: fout wist bij teruggaan, wizard blijft heel.
    await page.getByRole("button", { name: "Terug", exact: true }).click();
    await page.getByRole("button", { name: "Verder →" }).first().click();
    await page.getByRole("button", { name: "Terug", exact: true }).click();
    await page.getByRole("button", { name: "Verder →" }).first().click();
    log(
      `${viewport}: snel terug/vooruit 3↔4 blijft heel`,
      (await page.getByText("JOUW KEUZES").isVisible()) && (await alert.count()) === 0,
    );

    await run.close();
  }
} catch (e) {
  exitCode = 1;
  console.error("[FOUT] test brak af:", e);
} finally {
  writeFileSync(
    path.join(EVIDENCE, "verslag.json"),
    JSON.stringify({ stappen, exitCode, t: new Date().toISOString() }, null, 2),
  );
  await browser.close().catch(() => {});
  server?.close?.();
  process.exit(exitCode);
}
