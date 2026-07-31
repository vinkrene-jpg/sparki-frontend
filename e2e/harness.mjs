// E2E-browsertestomgeving (WP-S1) — echte browserkliks tegen de draaiende app.
//
// Harde eisen (besluit René 31-07-2026):
// - echt inloggen (Clerk ticket-login) of een geldige testidentiteit;
// - rolcontext controleren en FALEN bij verkeerde identiteit/rol;
// - zichtbare elementen aanklikken (geen page.goto als vervanging van de klik);
// - URL, paginatitel en zichtbare inhoud controleren;
// - screenshots vóór en na elke klik;
// - telefoon- (402x874) en desktopformaat (1440x900).
//
// Browser: Nix-chromium (bundled Playwright-browsers missen systeemlibs hier).
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

export const VIEWPORTS = {
  mobiel: { width: 402, height: 874 },
  desktop: { width: 1440, height: 900 },
};

const CLERK_API = "https://api.clerk.com/v1";

function clerkHeaders() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY ontbreekt");
  return { authorization: `Bearer ${key}`, "content-type": "application/json" };
}

// Vind-of-maak de vaste e2e-testgebruiker in Clerk. Eén dedicated QA-account —
// nooit het account van een echt persoon gebruiken.
export async function ensureE2eUser(email = "sparki-e2e-qa+clerk_test@example.com") {
  const q = await fetch(
    `${CLERK_API}/users?email_address=${encodeURIComponent(email)}`,
    { headers: clerkHeaders() },
  );
  if (!q.ok) throw new Error(`Clerk users-query faalde: ${q.status}`);
  const found = await q.json();
  if (Array.isArray(found) && found.length > 0) return found[0].id;
  const created = await fetch(`${CLERK_API}/users`, {
    method: "POST",
    headers: clerkHeaders(),
    body: JSON.stringify({
      email_address: [email],
      first_name: "E2E",
      last_name: "QA",
      skip_password_requirement: true,
    }),
  });
  if (!created.ok)
    throw new Error(`Clerk user aanmaken faalde: ${created.status} ${await created.text()}`);
  return (await created.json()).id;
}

// Sign-in tickets zijn éénmalig: mint er één per browsercontext.
export async function mintTicket(userId) {
  const res = await fetch(`${CLERK_API}/sign_in_tokens`, {
    method: "POST",
    headers: clerkHeaders(),
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  });
  if (!res.ok) throw new Error(`sign_in_token faalde: ${res.status}`);
  return (await res.json()).token; // nooit loggen
}

export async function launchBrowser() {
  const executablePath = execSync("which chromium").toString().trim();
  return chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
}

export class TestRun {
  constructor({ browser, baseUrl, viewport, evidenceDir, runName }) {
    this.browser = browser;
    this.baseUrl = baseUrl;
    this.viewport = VIEWPORTS[viewport] ?? viewport;
    this.viewportName = typeof viewport === "string" ? viewport : "custom";
    this.evidenceDir = evidenceDir;
    this.runName = runName;
    this.step = 0;
    mkdirSync(evidenceDir, { recursive: true });
  }

  async open() {
    this.context = await this.browser.newContext({ viewport: this.viewport });
    this.page = await this.context.newPage();
    return this.page;
  }

  async shot(label) {
    this.step += 1;
    const file = path.join(
      this.evidenceDir,
      `${this.runName}-${this.viewportName}-${String(this.step).padStart(2, "0")}-${label}.png`,
    );
    await this.page.screenshot({ path: file, fullPage: false });
    return file;
  }

  // Echte login via Clerk ticket-strategie, in de pagina zelf.
  async loginWithTicket(ticket) {
    await this.page.goto(`${this.baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
    await this.page.waitForFunction(() => window.Clerk?.loaded === true, null, {
      timeout: 30000,
    });
    await this.page.evaluate(async (t) => {
      const res = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: t });
      if (res.status !== "complete") throw new Error(`signIn status ${res.status}`);
      await window.Clerk.setActive({ session: res.createdSessionId });
    }, ticket);
  }

  // Identiteits- en rolcontrole. FAALT hard bij status 200 + verkeerde
  // identiteit of rol (verkeerde-rolcontext-eis). 401/403 = consent-pad.
  async verifyIdentity({ expectClerkId, expectRole }) {
    const me = await this.page.evaluate(async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      return { status: r.status, body: r.status === 200 ? await r.json() : null };
    });
    if (me.status === 200) {
      if (expectClerkId && me.body.clerkId !== expectClerkId)
        throw new Error(
          `VERKEERDE IDENTITEIT: verwacht ${expectClerkId}, kreeg ${me.body.clerkId} — dit is precies de dev-fallback-valkuil`,
        );
      if (expectRole && me.body.activeRole !== expectRole)
        throw new Error(
          `VERKEERDE ROL: verwacht ${expectRole}, kreeg ${me.body.activeRole}`,
        );
    }
    return me;
  }

  // Consent-gate van het eigen QA-testaccount doorlopen via échte kliks.
  async acceptConsentIfPresent() {
    const gate = this.page.getByText("Eerst even akkoord", { exact: false });
    if (!(await gate.isVisible().catch(() => false))) return false;
    await this.shot("consent-gate");
    const boxes = this.page.locator('input[type="checkbox"]');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check();
    await this.page.getByRole("button", { name: /akkoord/i }).click();
    await this.page.waitForLoadState("networkidle");
    await this.shot("consent-akkoord");
    return true;
  }

  // Kernhelper: klik een ZICHTBAAR element en controleer URL + titel +
  // zichtbare inhoud, met screenshots vóór en na. Faalt bij elke afwijking.
  async clickAndVerify({ label, locator, expectPath, expectTitle, expectVisibleText }) {
    await this.shot(`voor-klik-${label}`);
    const el = typeof locator === "string" ? this.page.locator(locator).first() : locator;
    if (!(await el.isVisible()))
      throw new Error(`Element voor "${label}" is niet zichtbaar — kan niet klikken`);
    await el.click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
    const after = await this.shot(`na-klik-${label}`);
    const url = new URL(this.page.url());
    if (expectPath && url.pathname !== expectPath)
      throw new Error(
        `VERKEERDE PAGINA na "${label}": verwacht pad ${expectPath}, kreeg ${url.pathname} (bewijs: ${after})`,
      );
    if (expectTitle) {
      const title = await this.page.title();
      if (!title.includes(expectTitle))
        throw new Error(`VERKEERDE TITEL na "${label}": verwacht "${expectTitle}" in "${title}"`);
    }
    for (const text of expectVisibleText ?? []) {
      // Meerdere matches mogelijk (bv. verborgen desktop-zijbalk op mobiel):
      // tel elke ZICHTBARE match, niet alleen de eerste in de DOM.
      const vis = await this.page
        .getByText(text, { exact: false })
        .locator("visible=true")
        .first()
        .isVisible()
        .catch(() => false);
      if (!vis)
        throw new Error(
          `VERWACHTE INHOUD ONTBREEKT na "${label}": "${text}" niet zichtbaar (bewijs: ${after})`,
        );
    }
    return after;
  }

  async close() {
    await this.context?.close();
  }
}
