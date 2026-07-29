// Test voor de automatische exports/-opschoning (taak 407).
//
// 1. Pure parser: alleen rijen die extern veiliggesteld ÉN lokaal verwijderd
//    zijn leveren een SHA op; "behouden"-rijen nooit.
// 2. Live routine in een sandbox-exports-map via een tijdelijke repo-root:
//    - onbekend bestand blijft staan (mogelijk nieuw bewijs);
//    - vers bestand (<24u) blijft staan, ook mét SHA-match;
//    - oud bestand met SHA-match wordt verwijderd;
//    - onleesbare inventaris ⇒ niets verwijderd (fail-closed).
// 3. Disk-usage classificatie benoemt exports/ als opruimkandidaat boven de
//    drempel, en niet eronder.

import { mkdtemp, mkdir, writeFile, utimes, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseOffloadedShas,
  runExportsMaintenance,
  sha256OfFile,
  EXPORTS_MIN_AGE_MS,
  INVENTORY_RELATIVE_PATH,
} from "../lib/exports-maintenance";
import { classifyDiskUsage, EXPORTS_WARN_BYTES } from "../lib/health/disk-usage";

const assert = (c: boolean, m: string) => {
  if (!c) {
    console.error("FAIL:", m);
    process.exit(1);
  }
  console.log("ok:", m);
};

// ── 1. Pure parser ───────────────────────────────────────────────────────────
const shaA = "a".repeat(64);
const shaB = "b".repeat(64);
const md = [
  "| Pad | Grootte | SHA-256 | Git | Categorie | Publiek | Actie |",
  "|---|---|---|---|---|---|---|",
  `| exports/x.zip | 1 | \`${shaA}\` | untracked | audit | nee | extern veiliggesteld en lokaal verwijderd |`,
  `| docs/y.zip | 1 | \`${shaB}\` | tracked | bewijs | nee | behouden, ongewijzigd |`,
  "geen tabelregel met `" + shaB + "` extern veiliggesteld lokaal verwijderd",
].join("\n");
const shas = parseOffloadedShas(md);
assert(shas.has(shaA), "extern-veiliggestelde + lokaal-verwijderde rij levert SHA");
assert(!shas.has(shaB), "'behouden'-rij levert NOOIT een SHA");
assert(parseOffloadedShas("").size === 0, "lege inventaris ⇒ geen SHA's");

// ── 2. Live routine in een sandbox ───────────────────────────────────────────
const root = await mkdtemp(path.join(tmpdir(), "exports-maint-"));
await mkdir(path.join(root, ".git"), { recursive: true });
await mkdir(path.join(root, "exports"), { recursive: true });
await mkdir(path.join(root, "docs"), { recursive: true });

const oldTime = new Date(Date.now() - 2 * EXPORTS_MIN_AGE_MS);
const offloadedPath = path.join(root, "exports", "offloaded.zip");
await writeFile(offloadedPath, "OFFLOADED-CONTENT");
await utimes(offloadedPath, oldTime, oldTime);
const unknownPath = path.join(root, "exports", "unknown.zip");
await writeFile(unknownPath, "UNKNOWN-CONTENT");
await utimes(unknownPath, oldTime, oldTime);
const freshPath = path.join(root, "exports", "fresh.zip");
await writeFile(freshPath, "OFFLOADED-CONTENT"); // zelfde inhoud, maar vers

const offloadedSha = await sha256OfFile(offloadedPath);

// Fail-closed: inventaris ontbreekt ⇒ niets verwijderd.
const origCwd = process.cwd();
process.chdir(root);
try {
  const noInv = await runExportsMaintenance({ force: true });
  assert(!noInv.ran && (noInv.skippedReason ?? "").includes("inventaris"), "zonder inventaris: skip met reden");
  assert((await readdir(path.join(root, "exports"))).length === 3, "zonder inventaris: niets verwijderd");

  await writeFile(
    path.join(root, INVENTORY_RELATIVE_PATH),
    `| exports/offloaded.zip | 17 | \`${offloadedSha}\` | untracked | audit | nee | extern veiliggesteld⁴ en lokaal verwijderd |\n`,
  );

  // Onder de ondergrens zonder force: no-op.
  const noop = await runExportsMaintenance();
  assert(!noop.ran && (noop.skippedReason ?? "").includes("ondergrens"), "onder ondergrens: goedkope no-op");

  const run = await runExportsMaintenance({ force: true });
  assert(run.ran, "routine draait met force");
  assert(
    run.deleted.length === 1 && run.deleted[0].name === "offloaded.zip" && run.deleted[0].sha256 === offloadedSha,
    "alleen het byte-identiek veiliggestelde oude bestand wordt verwijderd",
  );
  const remaining = await readdir(path.join(root, "exports"));
  assert(remaining.includes("unknown.zip"), "onbekend bestand blijft staan (mogelijk nieuw bewijs)");
  assert(remaining.includes("fresh.zip"), "vers bestand (<24u) blijft staan, ook met SHA-match");
  assert(!remaining.includes("offloaded.zip"), "veiliggesteld oud bestand is weg");
  const keptReasons = run.kept.map((k) => `${k.name}:${k.reason}`).join(" | ");
  console.log("kept:", keptReasons);
  assert(run.kept.length === 2, "beide behouden bestanden eerlijk gemeld met reden");

  // Idempotent: tweede run verwijdert niets meer.
  const again = await runExportsMaintenance({ force: true });
  assert(again.ran && again.deleted.length === 0, "tweede run: niets meer te verwijderen");

  // ── Root-backups (taak 408) ────────────────────────────────────────────────
  // Oud root-bestand met SHA-match wordt verwijderd; onbekend root-bestand en
  // niet-zip/bundle-bestanden blijven ALTIJD staan.
  const rootOffloaded = path.join(root, "old-backup.zip");
  await writeFile(rootOffloaded, "ROOT-OFFLOADED");
  await utimes(rootOffloaded, oldTime, oldTime);
  const rootUnknown = path.join(root, "mystery-backup.bundle");
  await writeFile(rootUnknown, "ROOT-UNKNOWN");
  await utimes(rootUnknown, oldTime, oldTime);
  const rootOther = path.join(root, "notes.txt");
  await writeFile(rootOther, "ROOT-OFFLOADED"); // zelfde inhoud, verkeerde extensie
  await utimes(rootOther, oldTime, oldTime);
  const rootSha = await sha256OfFile(rootOffloaded);
  await writeFile(
    path.join(root, INVENTORY_RELATIVE_PATH),
    `| old-backup.zip | 14 | \`${rootSha}\` | tracked | backup | nee | extern veiliggesteld⁴ en lokaal verwijderd |\n`,
  );
  const rootRun = await runExportsMaintenance({ force: true });
  assert(rootRun.ran, "root-run draait");
  assert(
    rootRun.deleted.length === 1 && rootRun.deleted[0].name === "old-backup.zip",
    "alleen het byte-identiek veiliggestelde oude root-backupbestand wordt verwijderd",
  );
  const rootRemaining = await readdir(root);
  assert(rootRemaining.includes("mystery-backup.bundle"), "onbekende root-bundle blijft staan (fail-closed)");
  assert(rootRemaining.includes("notes.txt"), "niet-zip/bundle-bestand wordt nooit aangeraakt, ook met SHA-match");
  assert(!rootRemaining.includes("old-backup.zip"), "veiliggesteld oud root-bestand is weg");
} finally {
  process.chdir(origCwd);
  await rm(root, { recursive: true, force: true });
}

// ── 3. Disk-usage benoemt exports/ ───────────────────────────────────────────
const base = {
  gitBytes: 0.2 * 1024 ** 3,
  totalBytes: 1 * 1024 ** 3,
  offenders: [{ name: "exports", bytes: 0.4 * 1024 ** 3 }],
};
const flagged = classifyDiskUsage({ ...base, exportsBytes: 0.4 * 1024 ** 3 }, 1);
assert((flagged.message ?? "").includes("exports/"), "boven drempel: exports/ expliciet benoemd als opruimkandidaat");
assert((flagged.message ?? "").includes("opruimkandidaat"), "melding gebruikt het woord opruimkandidaat");
const quiet = classifyDiskUsage({ ...base, exportsBytes: EXPORTS_WARN_BYTES - 1 }, 1);
assert(!(quiet.message ?? "").includes("opruimkandidaat"), "onder drempel: geen exports-melding");
assert((flagged.technicalDetails ?? "").includes("exports/="), "technicalDetails toont exacte exports-omvang");

console.log("ALLE TESTS GESLAAGD");
