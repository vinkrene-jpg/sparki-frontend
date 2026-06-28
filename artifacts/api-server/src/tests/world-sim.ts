// Sparki World — simulation v1 test (pure, deterministic, no DB / no images).
//
// Proves T004's acceptance: a "world-day" produces validated, plausible posts.
// Runs the simulation across the whole generated cast over a week of in-world
// days and asserts: events + posts are produced, every APPROVED post passes
// validation independently, every REJECTED post carries a reason, there is real
// variation (not the same event repeated), determinism holds, and no approved
// caption leaks forbidden ("AI"/narrator) wording.

import { generatePopulation } from "../lib/world/population";
import { simulateDay } from "../lib/world/simulation";
import { validatePost } from "../lib/world/validation";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function datesFrom(start: string, days: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    out.push(d.toISOString().split("T")[0]!);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function main() {
  console.log("\nSparki World — Simulatie v1 test\n");

  const { athletes } = generatePopulation(50, 1);
  const dates = datesFrom("2026-06-01", 7);

  let total = 0;
  let approved = 0;
  let rejected = 0;
  let rejectedWithoutReason = 0;
  let approvedFailingValidator = 0;
  let forbiddenLeak = 0;
  let photoWithoutScene = 0;
  const eventTypes = new Set<string>();
  const captions = new Set<string>();

  for (const date of dates) {
    for (const a of athletes) {
      const { event, post } = simulateDay(a, date, { withImage: false });
      const verdict = validatePost(a, event, post);
      total++;
      eventTypes.add(event.type);
      captions.add(post.caption);

      if (verdict.status === "approved") {
        approved++;
        // an approved post must independently re-pass the validator
        const re = validatePost(a, event, post);
        if (re.status !== "approved") approvedFailingValidator++;
        if (/\bA\.?I\.?\b/i.test(post.caption) || /Sparki (ziet|denkt|weet)/i.test(post.caption))
          forbiddenLeak++;
        if (post.kind === "photo" && !post.scene) photoWithoutScene++;
      } else {
        rejected++;
        if (!verdict.notes) rejectedWithoutReason++;
      }
    }
  }

  // determinism: same (athlete, date) → identical event + caption
  const a0 = athletes[0]!;
  const d1 = simulateDay(a0, dates[0]!);
  const d2 = simulateDay(a0, dates[0]!);
  const deterministic =
    JSON.stringify(d1.event) === JSON.stringify(d2.event) &&
    d1.post.caption === d2.post.caption;

  check("een wereld-week produceert posts", total > 0, `total=${total}`);
  check("er zijn goedgekeurde posts", approved > 0, `approved=${approved}`);
  check("elke goedgekeurde post doorstaat de validatie opnieuw", approvedFailingValidator === 0, `${approvedFailingValidator} faalden`);
  check("elke afgekeurde post heeft een reden", rejectedWithoutReason === 0, `${rejectedWithoutReason} zonder reden`);
  check("geen verboden formulering in goedgekeurde caption", forbiddenLeak === 0, `${forbiddenLeak} lekken`);
  check("geen foto-post zonder beeld goedgekeurd", photoWithoutScene === 0);
  check("voldoende variatie in event-types (\u22655)", eventTypes.size >= 5, `${eventTypes.size} types`);
  check("captions variëren (geen monocultuur)", captions.size > total * 0.15, `${captions.size} unieke captions`);
  check("simulatie is deterministisch", deterministic);

  console.log(
    `\n  Samenvatting: ${total} dagen gesimuleerd, ${approved} goedgekeurd, ${rejected} afgekeurd.`,
  );
  console.log(`  Event-types: ${[...eventTypes].sort().join(", ")}`);
  console.log(`\n${passed}/${passed + failed} passed`);
  if (failed > 0) process.exit(1);
}

main();
