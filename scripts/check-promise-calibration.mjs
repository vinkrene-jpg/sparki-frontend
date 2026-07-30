#!/usr/bin/env node
// Validatie: elke afkeurregel (hard_reject_rules) in het kalibratiedocument
// moet een geldig rule_type-etiket dragen (hard_blockage | soft_tolerance | unverifiable).
// Bewaakt tegen nieuwe hoofdstukken/regels die het etiket vergeten (zie taak #489-risico).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml");
const VALID_RULE_TYPES = new Set(["hard_blockage", "soft_tolerance", "unverifiable"]);

let doc;
try {
  doc = parse(readFileSync(FILE, "utf8"));
} catch (err) {
  console.error(`FOUT: kan ${FILE} niet parsen als YAML: ${err.message}`);
  process.exit(1);
}

const errors = [];
let rulesChecked = 0;
let listsFound = 0;

function walk(node, path) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, `${path}[${i}]`));
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key === "hard_reject_rules") {
      listsFound++;
      if (!Array.isArray(value)) {
        errors.push(`${childPath}: hard_reject_rules is geen lijst`);
        continue;
      }
      value.forEach((entry, i) => {
        const entryPath = `${childPath}[${i}]`;
        rulesChecked++;
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
          errors.push(`${entryPath}: regel-item is geen object (verwacht '- rule: ...')`);
          return;
        }
        const ruleText =
          typeof entry.rule === "string" ? entry.rule.slice(0, 80) : "(geen 'rule'-tekst)";
        if (!("rule" in entry)) {
          errors.push(`${entryPath}: mist 'rule'-tekst`);
        }
        if (!("rule_type" in entry)) {
          errors.push(`${entryPath}: mist rule_type — "${ruleText}…"`);
        } else if (!VALID_RULE_TYPES.has(entry.rule_type)) {
          errors.push(
            `${entryPath}: ongeldig rule_type "${entry.rule_type}" (geldig: ${[...VALID_RULE_TYPES].join(" | ")}) — "${ruleText}…"`,
          );
        }
      });
    } else {
      walk(value, childPath);
    }
  }
}

walk(doc, "");

if (listsFound === 0) {
  console.error("FOUT: geen enkele hard_reject_rules-lijst gevonden — is de documentstructuur gewijzigd?");
  process.exit(1);
}
if (rulesChecked === 0) {
  console.error("FOUT: hard_reject_rules-lijsten gevonden maar zonder regels — is de documentstructuur gewijzigd?");
  process.exit(1);
}
if (errors.length > 0) {
  console.error(`FOUT: ${errors.length} afkeurregel(s) zonder geldig rule_type-etiket:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `OK: ${rulesChecked} afkeurregels in ${listsFound} hard_reject_rules-lijsten dragen allemaal een geldig rule_type.`,
);
