// Test voor de automatische .git-opschoning (taak 406).
//
// 1. Pure selectielogica: alleen bekende wegwerp-refs, nooit main/huidige
//    branch/origin.
// 2. Veiligheidspoort live: in deze werkruimte draait de echte
//    verifyMainMatchesOrigin + runGitMaintenance; de uitkomst moet eerlijk
//    zijn (ran met acties, of overgeslagen met reden) en mag NOOIT iets doen
//    wanneer main != origin/main.

import {
  selectBranchesToDelete,
  selectRemotesToDelete,
  verifyMainMatchesOrigin,
  runGitMaintenance,
  GIT_MAINTENANCE_MIN_BYTES,
} from "../lib/git-maintenance";
import { findRepoRoot } from "../lib/health/disk-usage";

const assert = (c: boolean, m: string) => {
  if (!c) {
    console.error("FAIL:", m);
    process.exit(1);
  }
  console.log("ok:", m);
};

// ── 1. Pure selectie ─────────────────────────────────────────────────────────
const branches = [
  "main",
  "subrepl-abc123",
  "subrepl-def456/main",
  "backup-pre-lighthistory",
  "gitsafe-backup/main",
  "replit-agent",
  "feature/x",
];
const del = selectBranchesToDelete(branches, "main");
assert(!del.includes("main"), "main wordt nooit geselecteerd");
assert(!del.includes("replit-agent"), "replit-agent blijft staan (niet aanraken)");
assert(!del.includes("feature/x"), "gewone feature-branch blijft staan");
assert(del.includes("subrepl-abc123"), "subrepl-* wordt geselecteerd");
assert(del.includes("subrepl-def456/main"), "subrepl-*/main wordt geselecteerd");
assert(del.includes("backup-pre-lighthistory"), "backup-* wordt geselecteerd");
assert(del.includes("gitsafe-backup/main"), "gitsafe-backup/* wordt geselecteerd");
assert(
  selectBranchesToDelete(["subrepl-x"], "subrepl-x").length === 0,
  "de uitgecheckte branch wordt nooit geselecteerd",
);

const rdel = selectRemotesToDelete(["origin", "subrepl-abc", "upstream"]);
assert(rdel.length === 1 && rdel[0] === "subrepl-abc", "alleen subrepl-*-remotes, nooit origin/overige");

assert(GIT_MAINTENANCE_MIN_BYTES >= 0.5 * 1024 ** 3, "ondergrens is een echte drempel (≥ 0,5 GB)");

// ── 2. Live poort + routine (eerlijk gedrag in deze werkruimte) ─────────────
const repoRoot = findRepoRoot(process.cwd());
assert(repoRoot !== null, "repo-root met .git gevonden");

const gate = await verifyMainMatchesOrigin(repoRoot!);
console.log("LIVE poort:", JSON.stringify(gate));

const summary = await runGitMaintenance();
console.log("LIVE run:", JSON.stringify(summary));
if (!gate.ok) {
  assert(!summary.ran, "poort dicht (main != origin/main) ⇒ routine doet NIETS");
  assert(!!summary.skippedReason, "overslaan heeft een eerlijke reden");
} else {
  // Poort open: run mag draaien óf eerlijk overslaan op de ondergrens.
  assert(
    summary.ran || summary.skippedReason !== undefined,
    "poort open ⇒ gedraaid of eerlijk overgeslagen met reden",
  );
}
console.log("git-maintenance test geslaagd");
