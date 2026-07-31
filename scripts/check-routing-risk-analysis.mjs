// Mergepoort FASE 1/3 (opdracht 31-07-2026): een wijziging aan harde
// routeregels mag niet gemerged worden zonder ingevulde risicoanalyse in
// docs/ROUTING_RISK_ANALYSES/ (sjabloon: docs/SPARKI_ROUTING_RISK_ANALYSIS_TEMPLATE.md).
//
// Gebruik (CI): node scripts/check-routing-risk-analysis.mjs <base-ref>
//   default base-ref: origin/main
// Gedrag: bepaalt de gewijzigde bestanden t.o.v. de base; raakt de diff een
// kernbestand van de harde routeketen, dan MOET in dezelfde diff óók een
// bestand onder docs/ROUTING_RISK_ANALYSES/ toegevoegd of gewijzigd zijn.
// Escape-luik voor puur redactionele wijzigingen: commit-message bevat
// "RRA: niet van toepassing" (de reviewketen beoordeelt die claim).

import { execSync } from "node:child_process";

const base = process.argv[2] ?? "origin/main";

const CORE = [
  /^artifacts\/api-server\/src\/lib\/routing\//,
  /^artifacts\/api-server\/src\/lib\/route-remarks\.ts$/,
  /^artifacts\/api-server\/src\/lib\/road-objects\/along-route\.ts$/,
  /^artifacts\/api-server\/src\/lib\/verharding\//,
  /^artifacts\/api-server\/src\/routes\/routes\.ts$/,
];

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

let files;
try {
  files = sh(`git diff --name-only ${base}...HEAD`).split("\n").filter(Boolean);
} catch {
  console.error(`check-routing-risk-analysis: kan diff t.o.v. ${base} niet bepalen — fail-closed.`);
  process.exit(1);
}

const touched = files.filter((f) => CORE.some((re) => re.test(f)));
if (touched.length === 0) {
  console.log("check-routing-risk-analysis: geen harde-routeregel-bestanden geraakt — OK.");
  process.exit(0);
}

const hasAnalysis = files.some((f) => f.startsWith("docs/ROUTING_RISK_ANALYSES/"));
if (hasAnalysis) {
  console.log(
    `check-routing-risk-analysis: routekern geraakt (${touched.join(", ")}) en risicoanalyse aanwezig — OK.`,
  );
  process.exit(0);
}

const msgs = sh(`git log --format=%B ${base}..HEAD`);
if (/RRA:\s*niet van toepassing/i.test(msgs)) {
  console.log(
    "check-routing-risk-analysis: routekern geraakt, geen analyse, maar expliciete 'RRA: niet van toepassing'-claim in commit — doorgelaten; reviewketen beoordeelt de claim.",
  );
  process.exit(0);
}

console.error(
  `check-routing-risk-analysis: FOUT — harde-routeregel-bestanden gewijzigd zonder risicoanalyse:\n  ${touched.join("\n  ")}\nVul docs/SPARKI_ROUTING_RISK_ANALYSIS_TEMPLATE.md in en sla op onder docs/ROUTING_RISK_ANALYSES/, of motiveer 'RRA: niet van toepassing — <reden>' in de commit.`,
);
process.exit(1);
