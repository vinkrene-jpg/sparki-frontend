// KETEN_FIETS_01 — harde eis 1: iedere routegeneratietaak eindigt.
// Bewijst: (1) een job die de deadline overschrijdt komt bij de eerstvolgende
// poll terug als done met 504 GENERATION_DEADLINE ("geen route geleverd"),
// (2) een laat alsnog binnenkomend resultaat verandert die uitkomst niet meer,
// (3) een job binnen de deadline blijft gewoon lopen.
import {
  createRouteGenerationJob,
  getRouteGenerationJob,
  finishJob,
} from "../lib/route-generation-jobs";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
  if (!ok) failed++;
}

// 1+2: verlopen job
const job = createRouteGenerationJob("test_user");
(job as { createdAt: number }).createdAt = Date.now() - 6 * 60 * 1000;
const polled = getRouteGenerationJob(job.id, "test_user");
check("verlopen job is done", polled?.done === true);
check("verlopen job status 504", polled?.status === 504);
const body = polled?.body as { code?: string; error?: string } | null;
check("code GENERATION_DEADLINE", body?.code === "GENERATION_DEADLINE");
check("eerlijke melding (geen route geleverd)", !!body?.error && body.error.includes("Geen route geleverd"));
check("melding noemt veiligheidscontrole niet overgeslagen", !!body?.error && body.error.includes("veiligheidscontrole"));
// laat resultaat mag uitkomst niet meer wijzigen
finishJob(job, 200, { route: "te laat" });
check("late einduitslag genegeerd", job.status === 504);

// 3: verse job loopt door
const fresh = createRouteGenerationJob("test_user");
const freshPolled = getRouteGenerationJob(fresh.id, "test_user");
check("verse job niet done", freshPolled?.done === false);


// 4 (reviewronde): late einduitslag VÓÓR de eerste poll mag nooit een succes
// vastleggen — finishJob zelf is deadline-bewust.
const stale = createRouteGenerationJob("test_user");
(stale as { createdAt: number }).createdAt = Date.now() - 6 * 60 * 1000;
finishJob(stale, 200, { route: "te laat, vóór poll" });
check("late finish vóór poll ⇒ toch 504", stale.status === 504 && stale.done === true);
const staleBody = stale.body as { code?: string } | null;
check("late finish vóór poll ⇒ code GENERATION_DEADLINE", staleBody?.code === "GENERATION_DEADLINE");

if (failed > 0) { console.error(`${failed} checks gefaald`); process.exit(1); }
console.log("ALLE CHECKS GROEN (10)");
process.exit(0);
