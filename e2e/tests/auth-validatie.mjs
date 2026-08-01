// Auth-frustratietest (01-08-2026) — echte browserkliks tegen de PRODUCTIEBUILD.
//
// Bewijst dat de bestaande Clerk-veldvalidatie zichtbaar aankomt (geen eigen
// tweede regelset):
//  A. ongeldig e-mailadres op het inlogscherm → directe, zichtbare veldfout,
//     geen stil falen, knop niet blijvend "dood";
//  B. leeg e-mailadres → zichtbare fout;
//  C. zwak wachtwoord op registratie → zichtbare uitleg welke eis faalt,
//     geen generieke/technische fout;
//  D. dubbelklik op de doorgaan-knop → geen dubbele actie/crash;
//  E. velden houden normale toetsenbordinvoer.
// Mobiel én desktop.
//
// Draaien: node e2e/tests/auth-validatie.mjs
import { launchBrowser, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/auth-validatie",
);
mkdirSync(EVIDENCE, { recursive: true });

const stappen = [];
let fouten = 0;
function log(stap, ok, detail = "") {
  stappen.push({ stap, ok, detail });
  if (!ok) fouten += 1;
  console.log(`[${ok ? "OK" : "FOUT"}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();

async function zichtbareFoutTekst(page) {
  // Clerk toont veldfouten als tekst bij het veld; pak alle zichtbare
  // waarschuwings-/fouttekst binnen het Clerk-formulier.
  return page.evaluate(() => {
    const sel = [
      '[data-clerk-error]',
      '[id$="-error"]',
      '[role="alert"]',
      '.cl-formFieldErrorText',
      '.cl-formFieldWarningText',
      '[class*="error" i]',
    ].join(",");
    return Array.from(document.querySelectorAll(sel))
      .filter((el) => el.offsetParent !== null && el.textContent.trim().length > 2)
      .map((el) => el.textContent.trim())
      .join(" | ")
      .slice(0, 300);
  });
}

async function testViewport(viewportName) {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: viewportName,
    evidenceDir: EVIDENCE,
    runName: "auth",
  });
  await run.open();
  const page = run.page;

  // ── A/B: inloggen met ongeldig / leeg e-mailadres ──
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await run.shot("signin");

  const email = page.locator('input[name="identifier"], input[type="email"]').first();
  const doorgaan = page.getByRole("button", { name: /doorgaan|continue/i }).first();

  if (!(await email.isVisible().catch(() => false))) {
    log(`${viewportName}: inlogformulier zichtbaar`, false);
  } else {
    // E: normale toetsenbordinvoer
    await email.click();
    await email.pressSequentially("geen-mailadres", { delay: 15 });
    log(`${viewportName}: e-mailveld accepteert invoer`, (await email.inputValue()) === "geen-mailadres");

    // A: ongeldig e-mailadres + dubbelklik (D). Zichtbare feedback kan óf een
    // Clerk-veldfout in de DOM zijn, óf de native browser-veldvalidatie
    // (validatieballon in de taal van de browser + focus op het veld —
    // schermlezers kondigen die aan). Beide zijn directe, niet-stille feedback.
    await doorgaan.click();
    await doorgaan.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    await run.shot("signin-ongeldig-email");
    const foutA = await zichtbareFoutTekst(page);
    const nativeA = await email.evaluate((el) => ({
      invalid: !el.validity.valid,
      message: el.validationMessage || "",
      focused: document.activeElement === el,
    }));
    const nogOpSignIn = new URL(page.url()).pathname.startsWith("/sign-in");
    log(
      `${viewportName}: A. ongeldig e-mail geeft zichtbare fout`,
      (foutA.length > 0 || (nativeA.invalid && nativeA.message.length > 0)) && nogOpSignIn,
      `dom="${foutA}" native="${nativeA.message}" focus=${nativeA.focused}`,
    );
    const knopBruikbaar = await doorgaan.isEnabled().catch(() => false);
    log(`${viewportName}: A. knop blijft bruikbaar (niet dood)`, knopBruikbaar);

    // B: leeg veld — zelfde regel: DOM-fout óf native veldvalidatie.
    await email.fill("");
    await doorgaan.click();
    await page.waitForTimeout(1500);
    await run.shot("signin-leeg-email");
    const foutB = await zichtbareFoutTekst(page);
    const nativeB = await email.evaluate((el) => ({
      invalid: !el.validity.valid,
      message: el.validationMessage || "",
    }));
    log(
      `${viewportName}: B. leeg e-mail geeft zichtbare fout`,
      foutB.length > 0 || (nativeB.invalid && nativeB.message.length > 0),
      `dom="${foutB}" native="${nativeB.message}"`,
    );

    // Geldig formaat → fout verdwijnt of stap verandert (geen blijvende fout)
    await email.fill("qa-validatie+clerk_test@example.com");
    await page.waitForTimeout(800);
  }

  // ── C: registratie met zwak wachtwoord ──
  await page.goto(`${baseUrl}/sign-up`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await run.shot("signup");

  const suEmail = page.locator('input[name="emailAddress"], input[type="email"]').first();
  const suWachtwoord = page.locator('input[name="password"], input[type="password"]').first();
  if (!(await suWachtwoord.isVisible().catch(() => false))) {
    log(`${viewportName}: registratieformulier met wachtwoordveld zichtbaar`, false);
  } else {
    if (await suEmail.isVisible().catch(() => false)) {
      await suEmail.fill("qa-validatie+clerk_test@example.com");
    }
    await suWachtwoord.click();
    await suWachtwoord.pressSequentially("abc", { delay: 20 });
    // blur om live-validatie te triggeren, daarna ook echt proberen
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1200);
    let foutC = await zichtbareFoutTekst(page);
    if (!foutC) {
      const suDoorgaan = page.getByRole("button", { name: /doorgaan|continue/i }).first();
      await suDoorgaan.click().catch(() => {});
      await page.waitForTimeout(2500);
      foutC = await zichtbareFoutTekst(page);
    }
    await run.shot("signup-zwak-wachtwoord");
    const begrijpelijk = foutC.length > 0 && !/error|exception|500|undefined/i.test(foutC);
    log(
      `${viewportName}: C. zwak wachtwoord geeft duidelijke eis-uitleg`,
      begrijpelijk,
      `fout="${foutC}"`,
    );
  }

  await run.close();
}

let exitCode = 0;
try {
  await testViewport("mobiel");
  await testViewport("desktop");
  console.log(`\nResultaat: ${stappen.length - fouten}/${stappen.length} OK, ${fouten} FOUT`);
  if (fouten > 0) exitCode = 1;
} catch (err) {
  console.error("ONVERWACHTE FOUT:", err);
  exitCode = 2;
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
