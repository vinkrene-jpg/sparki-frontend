// Mergepoort FASE 1/3 (opdracht 31-07-2026): een wijziging aan harde
// routeregels mag niet gemerged worden zonder ingevulde risicoanalyse in
// docs/ROUTING_RISK_ANALYSES/ (sjabloon: docs/SPARKI_ROUTING_RISK_ANALYSIS_TEMPLATE.md).
//
// Gebruik (CI): node scripts/check-routing-risk-analysis.mjs <base-ref>
//   default base-ref: origin/main
// Gedrag (fail-closed):
// - raakt de diff een kernbestand van de harde routeketen, dan moet in
//   dezelfde diff een risicoanalyse zijn TOEGEVOEGD of GEWIJZIGD (status A/M —
//   een verwijderde analyse telt niet) onder docs/ROUTING_RISK_ANALYSES/;
// - die analyse moet inhoudelijk ingevuld zijn: de verplichte sjabloonvelden
//   moeten voorkomen en het bestand moet substantieel zijn (≥ 1500 tekens);
// - escape-luik alleen voor puur redactionele wijzigingen: de HEAD-commit
//   (niet een willekeurige oudere commit) bevat "RRA: niet van toepassing —
//   <reden>"; de reviewketen beoordeelt die claim.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "origin/main";
if (!/^[A-Za-z0-9_\/.\-]+$/.test(base)) {
  console.error(`check-routing-risk-analysis: ongeldige base-ref ${JSON.stringify(base)} — fail-closed.`);
  process.exit(1);
}

const CORE = [
  /^artifacts\/api-server\/src\/lib\/routing\//,
  /^artifacts\/api-server\/src\/lib\/route-remarks\.ts$/,
  /^artifacts\/api-server\/src\/lib\/road-objects\/along-route\.ts$/,
  /^artifacts\/api-server\/src\/lib\/verharding\//,
  /^artifacts\/api-server\/src\/routes\/routes\.ts$/,
];

// Verplichte sjabloonvelden — een lege of louter aangeraakte analyse telt niet.
const REQUIRED_FIELDS = [
  "Betreffende regel",
  "Foutpositieven",
  "Foutnegatieven",
  "Gedrag bij timeout",
  "Gedrag bij onbereikbare kaartbron",
  "Counterexamples",
  "Fail-closed",
  "regressietests",
];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

let statusLines;
try {
  statusLines = git("diff", "--name-status", `${base}...HEAD`)
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [status, ...rest] = l.split("\t");
      return { status: status[0], file: rest[rest.length - 1] };
    });
} catch {
  console.error(`check-routing-risk-analysis: kan diff t.o.v. ${base} niet bepalen — fail-closed.`);
  process.exit(1);
}

const touched = statusLines
  .filter(({ file }) => CORE.some((re) => re.test(file)))
  .map(({ file }) => file);
if (touched.length === 0) {
  console.log("check-routing-risk-analysis: geen harde-routeregel-bestanden geraakt — OK.");
  process.exit(0);
}

// Alleen toegevoegde/gewijzigde analyses tellen; verwijderd (D) niet.
const analyses = statusLines.filter(
  ({ status, file }) =>
    (status === "A" || status === "M" || status === "R") &&
    file.startsWith("docs/ROUTING_RISK_ANALYSES/") &&
    file.endsWith(".md"),
);

for (const { file } of analyses) {
  let body;
  try {
    body = readFileSync(file, "utf8");
  } catch {
    continue; // niet leesbaar in werkkopie ⇒ telt niet
  }
  const missing = REQUIRED_FIELDS.filter((f) => !body.includes(f));
  if (body.length >= 1500 && missing.length === 0) {
    console.log(
      `check-routing-risk-analysis: routekern geraakt (${touched.join(", ")}) en ingevulde risicoanalyse aanwezig (${file}) — OK.`,
    );
    process.exit(0);
  }
  console.error(
    `check-routing-risk-analysis: ${file} is aanwezig maar niet volledig ingevuld` +
      (missing.length ? ` (ontbrekende velden: ${missing.join(", ")})` : " (te kort)") +
      " — telt niet.",
  );
}

// Escape-luik: alleen de HEAD-commit-message, mét reden.
const headMsg = git("log", "-1", "--format=%B", "HEAD");
if (/RRA:\s*niet van toepassing\s*[—-]\s*\S+/i.test(headMsg)) {
  console.log(
    "check-routing-risk-analysis: routekern geraakt zonder analyse, maar HEAD-commit claimt gemotiveerd 'RRA: niet van toepassing' — doorgelaten; de reviewketen beoordeelt de claim.",
  );
  process.exit(0);
}

console.error(
  `check-routing-risk-analysis: FOUT — harde-routeregel-bestanden gewijzigd zonder ingevulde risicoanalyse:\n  ${touched.join("\n  ")}\nVul docs/SPARKI_ROUTING_RISK_ANALYSIS_TEMPLATE.md in en sla op onder docs/ROUTING_RISK_ANALYSES/, of motiveer in de HEAD-commit: 'RRA: niet van toepassing — <reden>'.`,
);
process.exit(1);
