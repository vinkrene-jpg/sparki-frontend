// MOBILE_ROUTE_WALKING_01 F1 — echte browserkliktest tegen de PRODUCTIEBUILD.
//
// Bewijst de telefoon-gerichte wizard achter de flag `mobile_routeplanner_v2`:
// - mobiele voortgangskop ("Stap X van 4" + voortgangsbalk) zichtbaar op
//   telefoonformaat, desktop-stappenteller daar verborgen;
// - primaire actie (Verder →) binnen het zichtbare scherm (sticky balk);
// - géén horizontale overflow op vier telefoon-viewports;
// - stapfout blijft op dezelfde stap en keuzes blijven behouden;
// - flag UIT ⇒ exact de bestaande weergave (geen mobiele kop);
// - desktop (flag aan) ⇒ ongewijzigde stappenteller.
//
// Draaien: node e2e/tests/routeplanner-mobiel-v2.mjs
import { execSync } from "node:child_process";
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/routeplanner-mobiel-v2",
);
mkdirSync(EVIDENCE, { recursive: true });

const GEO = { latitude: 50.865, longitude: 5.83 };

// Opdracht §18: kleine/grote iPhone- en Android-viewports.
const PHONE_VIEWPORTS = {
  "iphone-klein": { width: 375, height: 667 },
  "iphone-groot": { width: 430, height: 932 },
  "android-klein": { width: 360, height: 800 },
  "android-groot": { width: 412, height: 915 },
};

const stappen = [];
let exitCode = 0;
function log(stap, ok, detail = "") {
  const status = ok ? "OK" : "FOUT";
  if (!ok) exitCode = 1;
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

function psql(sql) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  return execSync(`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c ${JSON.stringify(oneLine)}`, {
    encoding: "utf8",
  });
}

// Gerichte activatie voor de testidentiteit (opdracht §16) — nooit globaal.
function setOverride(clerkId, enabled) {
  psql(
    `INSERT INTO feature_flags (key) VALUES ('mobile_routeplanner_v2') ON CONFLICT (key) DO NOTHING;`,
  );
  psql(
    `INSERT INTO user_flag_overrides (clerk_id, flag_key, enabled, set_by, reason)
     VALUES ('${clerkId}', 'mobile_routeplanner_v2', ${enabled}, 'e2e', 'MOBILE_ROUTE_WALKING_01 F1 e2e')
     ON CONFLICT (clerk_id, flag_key) DO UPDATE SET enabled = EXCLUDED.enabled;`,
  );
}

async function geenHorizontaleOverflow(page) {
  return page.evaluate(() => {
    const el = document.documentElement;
    return { scroll: el.scrollWidth, client: el.clientWidth, ok: el.scrollWidth <= el.clientWidth + 1 };
  });
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
try {
  const userId = await ensureE2eUser();

  // ---- Flag AAN: vier telefoon-viewports ----
  setOverride(userId, true);
  for (const [naam, viewport] of Object.entries(PHONE_VIEWPORTS)) {
    const run = new TestRun({
      browser,
      baseUrl,
      viewport,
      evidenceDir: EVIDENCE,
      runName: `mobiel-v2-${naam}`,
    });
    await run.open();
    await run.context.grantPermissions(["geolocation"]);
    await run.context.setGeolocation(GEO);
    await run.loginWithTicket(await mintTicket(userId));
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    const me = await run.verifyIdentity({ expectClerkId: userId });
    log(`${naam}: login`, me.status === 200, `auth/me=${me.status}`);
    const page = run.page;
    await page.waitForTimeout(800);

    // Mobiele voortgangskop zichtbaar, desktop-teller verborgen.
    const kop = page.locator('[data-testid="mobiele-wizard-kop"]');
    await kop.waitFor({ timeout: 15000 });
    log(`${naam}: mobiele voortgangskop zichtbaar`, await kop.isVisible());
    log(
      `${naam}: 'Stap 1 van 4' getoond`,
      ((await kop.textContent()) ?? "").includes("Stap 1 van 4"),
    );
    const balk = page.locator('[data-testid="mobiele-actiebalk"]');
    log(`${naam}: actiebalk aanwezig`, (await balk.count()) === 1);

    // Primaire actie binnen het zichtbare scherm (sticky), zonder te scrollen.
    const verder = page.getByRole("button", { name: "Verder →" }).first();
    const box = await verder.boundingBox();
    log(
      `${naam}: primaire actie binnen beeld`,
      !!box && box.y + box.height <= viewport.height && box.y >= 0,
      box ? `y=${Math.round(box.y)} h=${Math.round(box.height)} vp=${viewport.height}` : "geen box",
    );

    // Geen horizontale overflow op stap 1.
    let ov = await geenHorizontaleOverflow(page);
    log(`${naam}: geen horizontale overflow (stap 1)`, ov.ok, `${ov.scroll}/${ov.client}`);
    await run.shot("stap1");

    // Stapfout blijft op dezelfde stap: Verder zonder startpunt.
    await verder.click();
    await page.waitForTimeout(300);
    log(
      `${naam}: fout op dezelfde stap, stap blijft 1`,
      ((await kop.textContent()) ?? "").includes("Stap 1 van 4") &&
        (await page.getByText("Kies eerst een startpunt", { exact: false }).isVisible()),
    );

    // Door de stappen heen: keuzes blijven behouden, voortgang loopt mee.
    await page.getByRole("button", { name: "Gebruik mijn locatie" }).click();
    await page.getByText(/^Startpunt: 50\.8/).waitFor({ timeout: 15000 });
    await verder.click(); // → 2
    await page.waitForTimeout(300);
    log(`${naam}: voortgang toont stap 2`, ((await kop.textContent()) ?? "").includes("Stap 2 van 4"));
    ov = await geenHorizontaleOverflow(page);
    log(`${naam}: geen horizontale overflow (stap 2)`, ov.ok, `${ov.scroll}/${ov.client}`);
    await run.shot("stap2");
    await page.getByRole("button", { name: "Verder →" }).first().click(); // → 3
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Verder →" }).first().click(); // → 4
    await page.getByText("JOUW KEUZES").waitFor({ timeout: 5000 });
    log(`${naam}: stap 4 bereikt, voortgang klopt`, ((await kop.textContent()) ?? "").includes("Stap 4 van 4"));
    log(
      `${naam}: startpunt behouden op stap 4`,
      await page.getByText(/50\.8/).first().isVisible(),
    );
    ov = await geenHorizontaleOverflow(page);
    log(`${naam}: geen horizontale overflow (stap 4)`, ov.ok, `${ov.scroll}/${ov.client}`);
    // Terug via de voortgangsbalk (tik op eerdere stap).
    await kop.getByRole("button", { name: "Terug naar stap 1" }).click();
    await page.waitForTimeout(300);
    log(`${naam}: terugtik naar stap 1 werkt`, ((await kop.textContent()) ?? "").includes("Stap 1 van 4"));
    await run.shot("stap4-en-terug");
    await run.context.close();
  }

  // ---- Flag AAN op desktop: bestaande weergave ongewijzigd ----
  {
    const run = new TestRun({
      browser, baseUrl, viewport: "desktop", evidenceDir: EVIDENCE, runName: "mobiel-v2-desktop",
    });
    await run.open();
    await run.context.grantPermissions(["geolocation"]);
    await run.context.setGeolocation(GEO);
    await run.loginWithTicket(await mintTicket(userId));
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    const page = run.page;
    await page.waitForTimeout(800);
    log(
      "desktop (flag aan): mobiele kop NIET zichtbaar",
      !(await page.locator('[data-testid="mobiele-wizard-kop"]').isVisible()),
    );
    log(
      "desktop (flag aan): bestaande stappenteller zichtbaar",
      await page.locator("span.font-mono", { hasText: "Waar rijd je?" }).isVisible(),
    );
    await run.shot("desktop");
    await run.context.close();
  }

  // ---- Flag UIT op telefoon: exact bestaande weergave ----
  setOverride(userId, false);
  {
    const run = new TestRun({
      browser, baseUrl, viewport: PHONE_VIEWPORTS["iphone-klein"], evidenceDir: EVIDENCE, runName: "mobiel-v2-uit",
    });
    await run.open();
    await run.context.grantPermissions(["geolocation"]);
    await run.context.setGeolocation(GEO);
    await run.loginWithTicket(await mintTicket(userId));
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    const page = run.page;
    await page.waitForTimeout(800);
    log(
      "flag uit: geen mobiele kop, bestaande stappenteller",
      !(await page.locator('[data-testid="mobiele-wizard-kop"]').isVisible()) &&
        (await page.locator("span.font-mono", { hasText: "Waar rijd je?" }).isVisible()),
    );
    await run.shot("flag-uit");
    await run.context.close();
  }
} finally {
  // Testoverride niet aan laten staan.
  try {
    const userId = await ensureE2eUser();
    psql(`DELETE FROM user_flag_overrides WHERE clerk_id='${userId}' AND flag_key='mobile_routeplanner_v2';`);
  } catch {}
  await browser.close();
  server.close();
}

writeFileSync(
  path.join(EVIDENCE, "rapport.json"),
  JSON.stringify({ stappen, exitCode, t: new Date().toISOString() }, null, 2),
);
console.log(`\nKlaar — exitcode ${exitCode} (${stappen.length} checks)`);
process.exit(exitCode);
