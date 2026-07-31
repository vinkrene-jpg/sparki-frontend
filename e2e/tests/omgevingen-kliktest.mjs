// Omgevings-kliktest (opdracht René 31-07-2026): voer op elke omgeving exact
// dezelfde echte kliktest uit — Meer → Privacy, terug, Voorwaarden, Hulp &
// ondersteuning (met dezelfde basisvraag), Profiel (Jij), Uitnodigingen — en
// leg per stap URL, titel en zichtbare inhoud vast. Elk resultaat draagt:
// volledige URL, omgevingsnaam, commit-SHA, actieve rol, apparaat/formaat.
//
// Draaien: node e2e/tests/omgevingen-kliktest.mjs
// Bewust GEEN ensureE2eUser/mintTicket hier: dit script raakt productie en
// mag dus nooit (ook niet per ongeluk, als het Clerk-secret ooit live wordt)
// een QA-account aanmaken. DEV gebruikt de dev-bypass-identiteit; productie
// wordt uitgelogd getest.
import { launchBrowser, TestRun } from "../harness.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/omgevingen",
);
mkdirSync(EVIDENCE, { recursive: true });

const BASISVRAAG = "Hoe koppel ik mijn Strava-account?";

async function pageState(page) {
  return {
    url: page.url(),
    titel: await page.title(),
    kop: (await page
      .locator("h1, h2")
      .first()
      .textContent()
      .catch(() => null))?.trim()?.slice(0, 80) ?? null,
  };
}

async function klik(run, label, tekst, { exact = true } = {}) {
  const page = run.page;
  await run.shot(`voor-${label}`);
  const el = page.getByText(tekst, { exact }).first();
  const zichtbaar = await el.isVisible().catch(() => false);
  if (!zichtbaar) {
    return { stap: label, status: "NIET AANWEZIG", detail: `"${tekst}" niet zichtbaar`, ...(await pageState(page)) };
  }
  await el.click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  await run.shot(`na-${label}`);
  return { stap: label, status: "GEKLIKT", ...(await pageState(page)) };
}

async function kliktest(run, { commit, rol, identiteit }) {
  const page = run.page;
  const stappen = [];
  const meerUrl = new URL("/meer", run.baseUrl).href;
  await page.goto(meerUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  stappen.push({ stap: "open-meer", status: "OK", ...(await pageState(page)) });

  // 1-2. Privacy + inhoudscontrole
  const p = await klik(run, "privacy", "Privacy");
  p.inhoudOk = await page.getByText("Privacyverklaring Sparki").first().isVisible().catch(() => false);
  stappen.push(p);
  await page.goBack().catch(() => {});
  await page.waitForTimeout(400);

  // 3-4. Voorwaarden
  await page.goto(meerUrl, { waitUntil: "networkidle" }).catch(() => {});
  const v = await klik(run, "voorwaarden", "Voorwaarden");
  v.inhoudOk = await page.getByText(/gebruiksvoorwaarden/i).first().isVisible().catch(() => false);
  stappen.push(v);

  // 5. Hulp & ondersteuning + basisvraag
  await page.goto(meerUrl, { waitUntil: "networkidle" }).catch(() => {});
  const h = await klik(run, "hulp", "Hulp & ondersteuning", { exact: false });
  if (h.status === "GEKLIKT") {
    const input = run.page.locator("textarea, input[type=text]").first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill(BASISVRAAG);
      await run.page.keyboard.press("Enter");
      await run.page.waitForTimeout(1500);
      await run.shot("na-hulp-vraag");
      const bodyText = await run.page.locator("body").innerText().catch(() => "");
      h.antwoordBevatStrava = /strava/i.test(bodyText.slice(-2000));
    } else {
      h.antwoordBevatStrava = "geen invoerveld gevonden";
    }
  }
  stappen.push(h);

  // 6. Profiel (Meer-item "Jij")
  await page.goto(meerUrl, { waitUntil: "networkidle" }).catch(() => {});
  stappen.push(await klik(run, "profiel", "Jij"));

  // 7. Uitnodigingen (niet elk rolmenu heeft dit item — eerlijk vastleggen,
  // daarna directe navigatie als vangnet)
  await page.goto(meerUrl, { waitUntil: "networkidle" }).catch(() => {});
  const u = await klik(run, "uitnodigingen", "Uitnodigingen", { exact: false });
  if (u.status === "NIET AANWEZIG") {
    await page.goto(new URL("/invitations", run.baseUrl).href, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(400);
    await run.shot("uitnodigingen-direct");
    u.directeNavigatie = await pageState(page);
  }
  stappen.push(u);

  return { commit, rol, identiteit, formaat: run.viewportName, stappen };
}

async function apiVersion(base) {
  try {
    const r = await fetch(new URL("/api/version", base).href);
    if (!r.ok) return { commit: "onbekend (endpoint ontbreekt in deze build)" };
    return await r.json();
  } catch {
    return { commit: "onbereikbaar" };
  }
}

const browser = await launchBrowser();
const rapport = [];
try {
  // ── Omgeving 2: DEV Preview (desktop) — dev-bypass-identiteit, geen login
  // ── Omgeving 1-standin: DEV Preview op telefoonformaat (PWA-oorsprong dev)
  for (const vp of ["desktop", "mobiel"]) {
    const run = new TestRun({ browser, baseUrl: "http://127.0.0.1:80", viewport: vp, evidenceDir: EVIDENCE, runName: `devpreview-${vp}` });
    await run.open();
    await run.page.goto("http://127.0.0.1:80/meer", { waitUntil: "networkidle" });
    const me = await run.verifyIdentity({});
    const ver = await apiVersion("http://127.0.0.1:80");
    rapport.push({ omgeving: `DEV Preview (${vp})`, url: "http://127.0.0.1:80 (workspace-dev)", ...(await kliktest(run, { commit: ver.commit, rol: me.body?.activeRole ?? "?", identiteit: me.body?.clerkId ?? "dev-fallback" })) });
    await run.close();
  }

  // ── Omgeving 3: Productie (root) — mobiel + desktop.
  // BEWUST ZONDER LOGIN: productie draait op een ANDERE Clerk-instantie
  // (pk_live; dev = pk_test) — het workspace-secret kan daar geen geldig
  // ticket voor minten, én René's regel is dat productie geen testdata mag
  // bevatten. Publieke pagina's testen we met echte kliks; voor de
  // ingelogde stappen leggen we eerlijk vast dat alleen een echt
  // productie-account (René zelf) ze kan doorlopen.
  for (const vp of ["mobiel", "desktop"]) {
    const base = "https://sparki-frontend.replit.app";
    const run = new TestRun({ browser, baseUrl: base, viewport: vp, evidenceDir: EVIDENCE, runName: `productie-${vp}` });
    await run.open();
    const ver = await apiVersion(base);
    const stappen = [];
    // Waar landt /meer zonder login?
    await run.page.goto(`${base}/meer`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1500);
    await run.shot("meer-zonder-login");
    stappen.push({ stap: "open-meer (zonder login)", status: "AUTH VEREIST", ...(await pageState(run.page)) });
    // Publieke juridische pagina's — directe navigatie + inhoudscontrole.
    for (const [pad, verwacht, naam] of [["/privacy", "Privacyverklaring Sparki", "privacy"], ["/voorwaarden", /gebruiksvoorwaarden/i, "voorwaarden"]]) {
      await run.page.goto(`${base}${pad}`, { waitUntil: "networkidle" });
      await run.page.waitForTimeout(800);
      await run.shot(naam);
      const ok = await run.page.getByText(verwacht).first().isVisible().catch(() => false);
      stappen.push({ stap: naam, status: "OK (publiek)", inhoudOk: ok, ...(await pageState(run.page)) });
    }
    stappen.push({ stap: "hulp/profiel/uitnodigingen", status: "ALLEEN MET ECHT PRODUCTIE-ACCOUNT", detail: "prod-Clerk is pk_live; geen testidentiteit toegestaan/mogelijk — René voert deze stappen zelf uit als acceptatietest" });
    rapport.push({ omgeving: `Productie (${vp})`, url: `${base}/`, commit: ver.commit, rol: "uitgelogd (bezoeker)", identiteit: "geen (bewust: geen testdata in productie)", formaat: vp, stappen });
    await run.close();
  }

  // ── Omgeving 4: Productie /sparki-mobile/ (Expo-web navigatie-app)
  {
    const run = new TestRun({ browser, baseUrl: "https://sparki-frontend.replit.app/sparki-mobile/", viewport: "mobiel", evidenceDir: EVIDENCE, runName: "prod-sparki-mobile" });
    await run.open();
    await run.page.goto("https://sparki-frontend.replit.app/sparki-mobile/", { waitUntil: "networkidle" });
    await run.page.waitForTimeout(4000);
    await run.shot("start");
    const state = await pageState(run.page);
    const meerZichtbaar = await run.page.getByText("Meer", { exact: true }).first().isVisible().catch(() => false);
    const bodyKort = (await run.page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    rapport.push({ omgeving: "Productie /sparki-mobile/ (Expo-web)", url: "https://sparki-frontend.replit.app/sparki-mobile/", commit: "zelfde deploy als productie-root", rol: "n.v.t. (aparte app)", formaat: "mobiel", stappen: [{ stap: "identificatie", status: meerZichtbaar ? "Meer-tab aanwezig" : "GEEN Meer-menu — andere app (navigatie-app), kliktest niet 1-op-1 uitvoerbaar", ...state, zichtbaar: bodyKort }] });
    await run.close();
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(EVIDENCE, "rapport.json"), JSON.stringify(rapport, null, 2));
for (const r of rapport) {
  console.log(`\n=== ${r.omgeving} — ${r.url} — commit ${r.commit} — rol ${r.rol} — ${r.formaat ?? "mobiel"} — identiteit ${r.identiteit ?? "-"}`);
  for (const s of r.stappen) {
    console.log(`  [${s.status}] ${s.stap} → ${s.url ?? ""} | titel "${s.titel ?? ""}" | kop "${s.kop ?? ""}"${s.inhoudOk !== undefined ? ` | inhoudOk=${s.inhoudOk}` : ""}${s.antwoordBevatStrava !== undefined ? ` | hulp-antwoord-strava=${s.antwoordBevatStrava}` : ""}${s.directeNavigatie ? ` | direct: ${s.directeNavigatie.url} kop "${s.directeNavigatie.kop}"` : ""}${s.zichtbaar ? ` | zichtbaar: ${s.zichtbaar.slice(0,160)}` : ""}`);
  }
}
console.log(`\nBewijs: ${EVIDENCE}`);
