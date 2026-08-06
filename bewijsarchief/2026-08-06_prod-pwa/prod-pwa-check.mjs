// Task #627 stap 1: live productie-controle sw.js + app-shell-cache op
// https://sparki-frontend.replit.app — echte Chromium, geen simulatie.
import { chromium } from "/home/runner/workspace/node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core/index.mjs";
const PROD = "https://sparki-frontend.replit.app";
const out = [];
const ok = (n, p, d = "") => { out.push(`${p ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!p) process.exitCode = 1; };

const swTekst = await (await fetch(`${PROD}/sw.js`)).text();
ok("Prod /sw.js is de app-shell-variant", swTekst.includes("CACHE_VERSIE") && swTekst.includes("sparki-shell-"), (swTekst.match(/sparki-shell-v\d+/) ?? ["?"])[0]);
const mani = await fetch(`${PROD}/manifest.webmanifest`);
ok("Prod manifest.webmanifest bereikbaar", mani.ok, `http ${mani.status}`);

const browser = await chromium.launch({
  executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  args: ["--no-sandbox", "--headless=new"],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${PROD}/`, { waitUntil: "load", timeout: 60000 });
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  await new Promise((res) => setTimeout(res, 2500));
  const keys = await caches.keys();
  const shellKey = keys.find((k) => k.startsWith("sparki-shell-"));
  const inhoud = shellKey
    ? (await (await caches.open(shellKey)).keys()).map((q) => new URL(q.url).pathname)
    : [];
  return { keys, shellKey, inhoud, scope: r.scope };
});
ok("SW registreert op productie", !!reg.shellKey, JSON.stringify(reg.keys));
ok("App-shell-cache gevuld (manifest/iconen/kaartstijl)",
  reg.inhoud.includes("/manifest.webmanifest") && reg.inhoud.includes("/icon-192.png") && reg.inhoud.includes("/kaart/sparki-stijl.json"),
  JSON.stringify(reg.inhoud));
await browser.close();
console.log(out.join("\n"));
