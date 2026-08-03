// Laadtijdmeting MARKETINGSITE_01 (MKT-17): productiebuild, mobiele viewport,
// gesimuleerde "gemiddelde telefoonverbinding" via CDP-netwerkthrottling.
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import pw from "/home/runner/workspace/node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core/index.js";

const { chromium } = pw;
const ROOT = "/home/runner/workspace/artifacts/site/dist/public";
const PORT = 46311;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain" };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (!p.startsWith("/site/")) p = "/site" + p;
    let fp = path.join(ROOT, p.slice("/site/".length) || "index.html");
    try {
      if ((await stat(fp)).isDirectory()) fp = path.join(fp, "index.html");
    } catch {
      fp = path.join(ROOT, "index.html"); // SPA-fallback
    }
    const body = await readFile(fp);
    res.writeHead(200, { "content-type": MIME[path.extname(fp)] ?? "application/octet-stream" });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

const executablePath = execSync("which chromium").toString().trim();
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });

// Profielen: gemiddelde 4G-telefoon en trage 3G als ondergrens.
const PROFILES = [
  { name: "4G (9 Mbps, 60 ms RTT)", down: (9e6) / 8, up: (3e6) / 8, latency: 60 },
  { name: "langzaam 4G/snel 3G (1,6 Mbps, 150 ms RTT)", down: (1.6e6) / 8, up: (0.75e6) / 8, latency: 150 },
];
const PAGES = ["/site/", "/site/sporters", "/site/renner", "/site/prijzen/sporters"];

for (const prof of PROFILES) {
  console.log(`\n== ${prof.name} ==`);
  for (const page of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: prof.latency, downloadThroughput: prof.down, uploadThroughput: prof.up });
    const bad = [];
    p.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await p.goto(`http://127.0.0.1:${PORT}${page}`, { waitUntil: "load" });
    const t = await p.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null };
    });
    console.log(`${page}  FCP ${t.fcp} ms · DCL ${t.domContentLoaded} ms · load ${t.load} ms${bad.length ? "  !! " + bad.join(", ") : ""}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
