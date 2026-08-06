// Prod-build statisch serveren (SPA rewrite) + /routes-redirect + SW-versiewissel bewijzen.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/home/runner/workspace/node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core/index.mjs";

const ROOT = "/home/runner/workspace/artifacts/sparki/dist/public";
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".webmanifest":"application/manifest+json", ".png":"image/png", ".svg":"image/svg+xml", ".jpg":"image/jpeg", ".webp":"image/webp" };
let swOverride = null; // als gezet: serveer deze inhoud voor /sw.js
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let p = decodeURIComponent(url.pathname);
  if (p === "/sw.js" && swOverride) {
    res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-cache" });
    return res.end(swOverride);
  }
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(4599, r));

const out = [];
const ok = (n, p, d = "") => { out.push(`${p ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!p) process.exitCode = 1; };

const browser = await chromium.launch({
  executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  args: ["--no-sandbox", "--headless=new"],
});
const ctx = await browser.newContext();
const hist = [];
await ctx.addInitScript(() => {
  const rs = history.replaceState.bind(history), ps = history.pushState.bind(history);
  history.replaceState = (...a) => { console.log("[HIST] replace " + a[2]); return rs(...a); };
  history.pushState = (...a) => { console.log("[HIST] push " + a[2]); return ps(...a); };
});
const page = await ctx.newPage();
page.on("console", (m) => { if (m.text().startsWith("[HIST]")) hist.push(m.text()); });

// 1) /routes-bookmark redirect met query (prod-Switch, signed-out volstaat: RoutesDoorstuur zit vóór de auth-gate)
await page.goto("http://localhost:4599/routes?view=bewaard&route=265");
await page.waitForTimeout(4000);
const rewrote = hist.some((h) => h.includes("/route?view=bewaard&route=265"));
ok("Prod-build: /routes?query → history-rewrite naar /route?view=bewaard&route=265", rewrote, hist.join(" | ").slice(0, 200));

// 2) kale /routes
hist.length = 0;
await page.goto("http://localhost:4599/routes");
await page.waitForTimeout(3000);
ok("Prod-build: kale /routes → /route", hist.some((h) => /\/route(\?|$| )/.test(h)), hist.join(" | ").slice(0, 200));

// 3) SW registreren (v1 uit de build) en cache-inhoud controleren
const swPage = await ctx.newPage();
await swPage.goto("http://localhost:4599/");
const reg1 = await swPage.evaluate(async () => {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  await new Promise((r) => setTimeout(r, 1500));
  return { keys: await caches.keys() };
});
ok("SW v1 registreert en maakt app-shell-cache", reg1.keys.includes("sparki-shell-v1"), JSON.stringify(reg1.keys));
const shell1 = await swPage.evaluate(async () => {
  const c = await caches.open("sparki-shell-v1");
  return (await c.keys()).map((r) => new URL(r.url).pathname);
});
ok("App-shell-bestanden gecachet (index/manifest/iconen/kaartstijl)",
  shell1.includes("/manifest.webmanifest") && shell1.includes("/icon-192.png") && shell1.includes("/kaart/sparki-stijl.json"),
  JSON.stringify(shell1));

// 4) Nieuwe release: CACHE_VERSIE ophogen → oude cache aantoonbaar weg
swOverride = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").replace("sparki-shell-v1", "sparki-shell-v2-proef");
const reg2 = await swPage.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  await reg.update();
  // wacht tot de nieuwe SW actief is (skipWaiting + clients.claim in activate)
  for (let i = 0; i < 30; i++) {
    const keys = await caches.keys();
    if (keys.includes("sparki-shell-v2-proef") && !keys.includes("sparki-shell-v1")) return { keys };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { keys: await caches.keys() };
});
ok("CACHE_VERSIE-wissel: nieuwe SW verruilt oude app-shell-cache (v1 weg, v2 aanwezig)",
  reg2.keys.includes("sparki-shell-v2-proef") && !reg2.keys.includes("sparki-shell-v1"),
  JSON.stringify(reg2.keys));

await browser.close();
server.close();
console.log(out.join("\n"));
