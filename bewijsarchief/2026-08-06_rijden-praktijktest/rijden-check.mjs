// Praktijktest RIJDEN_01 — eigen reproductie (dev, echte Chromium + SwiftShader-WebGL).
import { chromium } from "/home/runner/workspace/node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core/index.mjs";

const BASE = "http://localhost:80";
const CHROME = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";
const out = [];
const ok = (name, pass, detail = "") => {
  out.push(`${pass ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!pass) process.exitCode = 1;
};
const vis = (page, sel) => page.locator(sel).locator("visible=true").first();

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--headless=new"],
});
const ctx = await browser.newContext({
  viewport: { width: 402, height: 874 },
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 52.2755, longitude: 6.7925 },
  permissions: ["geolocation"],
});
await ctx.addInitScript(() => {
  window.localStorage.setItem("sparki.dev.previewAthlete", "dev_qa_athlete");
});
const page = await ctx.newPage();
page.setDefaultTimeout(25000);

await page.goto(BASE + "/route");
const webgl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  return !!(c.getContext("webgl2") || c.getContext("webgl"));
});
ok("WebGL-context beschikbaar in testbrowser", webgl);

// Stap 1
await vis(page, "text=Wat ga je doen?").waitFor();
ok("Stap 1 zichtbaar (Wat ga je doen?)", true);
ok("Kaart-canvas aanwezig", (await page.locator("canvas").count()) > 0);
await page.waitForTimeout(4000);
await page.screenshot({ path: "/tmp/rijden-stap1.png" });

// Stap 1 → 2
await vis(page, "button:has-text('Fietsen')").click();
await vis(page, "text=Sparki laat maken").waitFor();
ok("Stap 2 zichtbaar (Zelf maken / Sparki laat maken / Opnemen)", true);
await page.waitForTimeout(2000);
await page.screenshot({ path: "/tmp/rijden-stap2.png" });

// Route aantikken → routekaartje (2a) → stap 5
let hadKaartje = false;
const item = page.locator("text=/\\d+[.,]\\d km/").locator("visible=true").first();
if (await item.count()) {
  await item.click().catch(() => {});
  hadKaartje = await vis(page, "button:has-text('Deze gebruiken')").isVisible().catch(() => false);
}
ok("Routekaartje (stap 2a) met 'Deze gebruiken'", hadKaartje);
if (hadKaartje) {
  await page.screenshot({ path: "/tmp/rijden-stap2a.png" });
  await vis(page, "button:has-text('Deze gebruiken')").click();
  await vis(page, "text=Klaar om te gaan").waitFor();
  ok("Stap 5 zichtbaar (Klaar om te gaan + Start navigatie)",
    await vis(page, "text=Start navigatie").isVisible());
  await page.screenshot({ path: "/tmp/rijden-stap5.png" });
}

// Stap 3 (Zelf maken)
await page.goto(BASE + "/route");
await vis(page, "text=Wat ga je doen?").waitFor();
await vis(page, "button:has-text('Fietsen')").click();
await vis(page, "text=Zelf maken").click();
const stap3zicht = await vis(page, "text=/afstand/i").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
ok("Stap 3 (Zelf maken) toont afstand-keuze", stap3zicht);
await page.screenshot({ path: "/tmp/rijden-stap3.png" });

// Deep-link view=bewaard&route=265
await page.goto(BASE + "/route?view=bewaard&route=265");
await page.waitForTimeout(4000);
const bewaardBody = await page.textContent("body");
ok("Deep-link /route?view=bewaard&route=265 rendert route", /36[.,]\d* km|Hengelose Es/i.test(bewaardBody || ""));
await page.screenshot({ path: "/tmp/rijden-deeplink.png" });

// Oude /routes redirect met query
await page.goto(BASE + "/routes?view=bewaard&route=265");
await page.waitForTimeout(2000);
ok("Oude /routes redirect → /route mét query", page.url().includes("/route?view=bewaard&route=265"), page.url());

await page.goto(BASE + "/routes");
await page.waitForTimeout(1500);
ok("Kale /routes → /route", new URL(page.url()).pathname === "/route", page.url());

await browser.close();
console.log(out.join("\n"));
