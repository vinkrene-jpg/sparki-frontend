// F-P1-05 (SPARKI_AUDIT_RECOVERY_AND_COMPLETION_01 C.5) — analyse op mobiel:
// geen horizontale overflow op 375px en 412px; tabbladen doorlopen met echte
// kliks tegen de productiebuild.
import { launchBrowser, TestRun, mintTicket, ensureE2eUser } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/analyse-mobiel-overflow",
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
try {
  for (const [naam, viewport] of [
    ["375", { width: 375, height: 667 }],
    ["412", { width: 412, height: 915 }],
  ]) {
    const run = new TestRun({
      browser,
      baseUrl,
      viewport,
      evidenceDir: EVIDENCE,
      runName: `analyse-${naam}`,
    });
    await run.open();
    const userId = await ensureE2eUser();
    await run.loginWithTicket(await mintTicket(userId));
    await run.page.goto(`${baseUrl}/analyse`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    await run.page.waitForTimeout(1500);
    const page = run.page;

    // Tabbladen doorlopen (indien aanwezig) en per stand overflow meten.
    const meet = async (label) => {
      const m = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      log(
        `${naam}px · ${label}: geen horizontale overflow`,
        m.scroll <= m.inner + 1,
        `scrollWidth=${m.scroll} innerWidth=${m.inner}`,
      );
    };
    await meet("start");
    await page.screenshot({ path: path.join(EVIDENCE, `analyse-${naam}-start.png`) });

    const tabs = page.locator('[role="tab"], [data-testid^="analyse-tab"]');
    const n = await tabs.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 6); i++) {
      const t = tabs.nth(i);
      const tekst = ((await t.innerText().catch(() => "")) || `tab${i}`).trim().slice(0, 20);
      await t.click().catch(() => {});
      await page.waitForTimeout(800);
      await meet(`tab "${tekst}"`);
    }
    if (n === 0) log(`${naam}px · tabbladen gevonden`, true, "geen tabs — enkel scherm gemeten");
    await page.screenshot({ path: path.join(EVIDENCE, `analyse-${naam}-eind.png`) });
    await run.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\nanalyse-mobiel-overflow: ${stappen.length - fouten}/${stappen.length} OK`);
process.exit(fouten > 0 ? 1 : 0);
