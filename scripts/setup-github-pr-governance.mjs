#!/usr/bin/env node
/**
 * Taak 507: Stelt branch protection op main in en controleert Copilot-review.
 *
 * Gebruik: node scripts/setup-github-pr-governance.mjs
 * Vereist: @replit/connectors-sdk (zit in pnpm node_modules/.pnpm)
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Vind connectors-sdk in pnpm store
const require = createRequire(
  path.join(ROOT, "node_modules/.pnpm/node_modules/@replit/connectors-sdk/package.json"),
);
let ReplitConnectors;
try {
  ({ ReplitConnectors } = await import(
    path.join(ROOT, "node_modules/.pnpm/node_modules/@replit/connectors-sdk/dist/index.js")
  ));
} catch {
  console.error("SKIP: @replit/connectors-sdk niet gevonden. Sla handmatig in.");
  process.exit(0);
}

const OWNER = "vinkrene-jpg";
const REPO = "sparki-frontend";

async function ghApi(connectors, endpoint, options = {}) {
  const res = await connectors.proxy("github", endpoint, options);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  let connectors;
  try {
    connectors = new ReplitConnectors();
  } catch (e) {
    console.error("Kan connectors niet initialiseren:", e.message);
    process.exit(0);
  }

  // 1. Wie ben ik?
  const me = await ghApi(connectors, "/user");
  if (me.status !== 200) {
    console.error("GitHub API niet bereikbaar, status:", me.status, JSON.stringify(me.json));
    process.exit(1);
  }
  console.log("Authenticated as:", me.json.login);

  // 2. Controleer huidige branch protection op main
  const current = await ghApi(connectors, `/repos/${OWNER}/${REPO}/branches/main/protection`);
  if (current.status === 404) {
    console.log("Geen branch protection gevonden. Ingesteld wordt nu.");
  } else if (current.status === 200) {
    console.log("Branch protection bestaat al. Update naar gewenste config.");
  } else {
    console.log("Branch protection status:", current.status, JSON.stringify(current.json).slice(0, 200));
  }

  // 3. Stel branch protection in
  // Verplichte check-namen moeten overeenkomen met de 'name:' velden in pr-checks.yml
  const protectionBody = {
    required_status_checks: {
      strict: true,
      contexts: [
        "validators (promise-calibration + sanity-reports)",
        "typecheck (libs + api-server)",
        "admin-smoke (echte app tegen verse Postgres)",
      ],
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      required_approving_review_count: 0, // Copilot-review is voldoende; menselijke approval niet geforceerd
    },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  };

  const protect = await ghApi(
    connectors,
    `/repos/${OWNER}/${REPO}/branches/main/protection`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(protectionBody),
    },
  );

  if (protect.status === 200 || protect.status === 201) {
    console.log("✅ Branch protection op main ingesteld.");
  } else {
    console.error("⚠️ Branch protection instellen mislukt:", protect.status, JSON.stringify(protect.json).slice(0, 400));
  }

  // 4. Controleer Copilot-autoreview
  // GitHub biedt geen API-eindpunt voor Copilot-autoreview aan; we controleren
  // of de repo-instellingen (via settings API) de feature weerspiegelen.
  const repoInfo = await ghApi(connectors, `/repos/${OWNER}/${REPO}`);
  console.log("\nRepo:", repoInfo.json.full_name);
  console.log("Copilot auto-review: geen dedicatedAPI-eindpunt —");
  console.log("  Moet handmatig via GitHub → Settings → Code Security → Copilot code review worden ingeschakeld.");
  console.log("  Status wordt eerlijk vastgelegd in docs/COPILOT_REVIEW_GOVERNANCE.md.");
}

main().catch((e) => {
  console.error("Fout:", e.message);
  process.exit(1);
});
