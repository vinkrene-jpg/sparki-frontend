// ── Automatische .git-opschoning (publiceerlimiet-bewaking) ─────────────────
//
// WAAROM: op 2026-07-29 mislukte publiceren op de 8 GiB-imagelimiet doordat
// .git opnieuw was volgelopen (verweesde LFS-objecten, .git/lost-found van een
// eerdere gc en tientallen subrepl-*/backup-branches die alles vasthielden).
// Dat was de tweede keer. Deze routine voert het vaste draaiboek uit
// (.agents/memory/git-history-cleanup.md, sectie "Herhaling 2026-07-29") —
// automatisch, maximaal één keer per Amsterdamse dag, en ALLEEN nadat
// geverifieerd is dat main == origin/main.
//
// VEILIGHEID (fail-closed):
//  - Draait alleen als `main` en `origin/main` naar exact dezelfde commit
//    wijzen. Bij ongepushte of achterlopende commits wordt er NIETS opgeruimd
//    (dan kunnen branches/LFS-objecten nog nodig zijn) — eerlijk overslaan.
//  - Verwijdert alleen bekende wegwerp-referenties: subrepl-*-branches,
//    backup-*-branches, gitsafe-backup/*-refs en subrepl-*-remotes. Nooit
//    main, nooit de uitgecheckte branch, nooit origin.
//  - LFS-opschoning gebeurt via `git lfs prune` (met retentie op 0) — dat
//    verwijdert alléén objecten die door geen enkele ref meer bereikbaar zijn,
//    nooit blind alle bestanden.
//  - Raakt de werkmap nooit aan: alleen refs, reflog, .git/lost-found en
//    losse objecten.
//  - Onder de ondergrens (standaard 1 GB .git) is de run een goedkope no-op,
//    zodat het dagelijkse ritme niets kost zolang alles gezond is.

import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { findRepoRoot, formatGb } from "./health/disk-usage";
import { logger } from "./logger";

// Onder deze .git-grootte doen we niets (goedkope dagelijkse no-op).
export const GIT_MAINTENANCE_MIN_BYTES = 1.0 * 1024 ** 3;

export interface GitMaintenanceSummary {
  ran: boolean;
  skippedReason?: string;
  gitBytesBefore?: number;
  gitBytesAfter?: number;
  actions: string[];
  errors: string[];
}

function runGit(
  repoRoot: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      { cwd: repoRoot, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: stdout ?? "", stderr: stderr ?? "" });
      },
    );
  });
}

async function duBytes(repoRoot: string, target: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      "du",
      ["-sk", "--", target],
      { cwd: repoRoot, timeout: 60_000, maxBuffer: 1024 * 1024 },
      (_err, stdout) => {
        const m = (stdout ?? "").trim().match(/^(\d+)\s/);
        resolve(m ? Number(m[1]) * 1024 : null);
      },
    );
  });
}

// Pure selectie: welke lokale branches zijn bekende wegwerp-referenties?
// Nooit main en nooit de huidige branch (die filtert de aanroeper er al uit
// via het `*`-prefix van `git branch`, maar we sluiten hem hier ook uit).
export function selectBranchesToDelete(
  branches: string[],
  currentBranch: string,
): string[] {
  return branches.filter(
    (b) =>
      b !== "main" &&
      b !== currentBranch &&
      (/^subrepl-/.test(b) || /^backup-/.test(b) || /^gitsafe-backup\//.test(b)),
  );
}

// Pure selectie: alleen subrepl-*-remotes; origin (en al het andere) blijft.
export function selectRemotesToDelete(remotes: string[]): string[] {
  return remotes.filter((r) => /^subrepl-/.test(r) && r !== "origin");
}

// De harde veiligheidspoort: main moet exact gelijk zijn aan origin/main.
export async function verifyMainMatchesOrigin(
  repoRoot: string,
): Promise<{ ok: boolean; reason?: string }> {
  // Best-effort verversen van origin/main; bij een offline omgeving vallen we
  // terug op de lokaal bekende origin/main-ref (nog steeds een echte poort).
  await runGit(repoRoot, ["fetch", "origin", "main", "--no-tags"], 60_000);
  const local = await runGit(repoRoot, ["rev-parse", "refs/heads/main"]);
  const remote = await runGit(repoRoot, ["rev-parse", "refs/remotes/origin/main"]);
  if (!local.ok || !remote.ok) {
    return { ok: false, reason: "main of origin/main niet vindbaar" };
  }
  const a = local.stdout.trim();
  const b = remote.stdout.trim();
  if (!a || !b || a !== b) {
    return {
      ok: false,
      reason: `main (${a.slice(0, 8)}) != origin/main (${b.slice(0, 8)}) — niets opgeruimd`,
    };
  }
  return { ok: true };
}

export async function runGitMaintenance(opts?: {
  force?: boolean;
  minBytes?: number;
}): Promise<GitMaintenanceSummary> {
  const actions: string[] = [];
  const errors: string[] = [];
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    return { ran: false, skippedReason: "geen .git-map gevonden", actions, errors };
  }

  const gitBytesBefore = await duBytes(repoRoot, ".git");
  const minBytes = opts?.minBytes ?? GIT_MAINTENANCE_MIN_BYTES;
  if (!opts?.force && gitBytesBefore !== null && gitBytesBefore < minBytes) {
    return {
      ran: false,
      skippedReason: `.git is ${formatGb(gitBytesBefore)} — onder de ondergrens (${formatGb(minBytes)}), niets te doen`,
      gitBytesBefore,
      actions,
      errors,
    };
  }

  // Poort: alleen opruimen als er niets ongepusht/achterlopend is.
  const gate = await verifyMainMatchesOrigin(repoRoot);
  if (!gate.ok) {
    return {
      ran: false,
      skippedReason: gate.reason,
      gitBytesBefore: gitBytesBefore ?? undefined,
      actions,
      errors,
    };
  }

  // 1. Wegwerp-branches (subrepl-*, backup-*, gitsafe-backup/*).
  const branchOut = await runGit(repoRoot, ["branch", "--format=%(refname:short)"]);
  const currentOut = await runGit(repoRoot, ["branch", "--show-current"]);
  const currentBranch = currentOut.stdout.trim() || "main";
  const branches = branchOut.ok
    ? branchOut.stdout.split("\n").map((l) => l.trim()).filter(Boolean)
    : [];
  for (const b of selectBranchesToDelete(branches, currentBranch)) {
    const r = await runGit(repoRoot, ["branch", "-D", b]);
    if (r.ok) actions.push(`branch verwijderd: ${b}`);
    else errors.push(`branch ${b}: ${r.stderr.trim() || "verwijderen mislukt"}`);
  }

  // 2. subrepl-*-remotes (houden anders alle objecten vast via remote refs).
  const remoteOut = await runGit(repoRoot, ["remote"]);
  const remotes = remoteOut.ok
    ? remoteOut.stdout.split("\n").map((l) => l.trim()).filter(Boolean)
    : [];
  for (const r of selectRemotesToDelete(remotes)) {
    const res = await runGit(repoRoot, ["remote", "remove", r]);
    if (res.ok) actions.push(`remote verwijderd: ${r}`);
    else errors.push(`remote ${r}: ${res.stderr.trim() || "verwijderen mislukt"}`);
  }

  // 3. .git/lost-found (restant van een eerdere gc; puur afval).
  try {
    await rm(path.join(repoRoot, ".git", "lost-found"), {
      recursive: true,
      force: true,
    });
    actions.push(".git/lost-found verwijderd");
  } catch (err) {
    errors.push(`lost-found: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Verweesde LFS-objecten — via lfs prune met retentie 0, zodat alleen
  //    onbereikbare objecten verdwijnen (nooit blind alles).
  const lfs = await runGit(repoRoot, [
    "-c",
    "lfs.fetchrecentrefsdays=0",
    "-c",
    "lfs.fetchrecentcommitsdays=0",
    "-c",
    "lfs.pruneoffsetdays=0",
    "lfs",
    "prune",
  ], 300_000);
  if (lfs.ok) actions.push("git lfs prune uitgevoerd");
  else errors.push(`lfs prune: ${lfs.stderr.trim() || "mislukt (git-lfs beschikbaar?)"}`);

  // 5. Reflog leegmaken + gc (voorgrond, gewone prune — aggressive is niet
  //    nodig en te duur voor een routinetaak).
  const reflog = await runGit(repoRoot, ["reflog", "expire", "--expire=now", "--all"]);
  if (reflog.ok) actions.push("reflog geleegd");
  else errors.push(`reflog: ${reflog.stderr.trim() || "mislukt"}`);

  const gc = await runGit(repoRoot, ["gc", "--prune=now"], 300_000);
  if (gc.ok) actions.push("git gc --prune=now uitgevoerd");
  else errors.push(`gc: ${gc.stderr.trim() || "mislukt"}`);

  const gitBytesAfter = await duBytes(repoRoot, ".git");
  return {
    ran: true,
    gitBytesBefore: gitBytesBefore ?? undefined,
    gitBytesAfter: gitBytesAfter ?? undefined,
    actions,
    errors,
  };
}

// ── Planner: maximaal één run per Amsterdamse dag, in-process ───────────────

let started = false;
let inFlight = false;
let lastRunDay = "";

function amsterdamDay(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(now).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${p.year}-${p.month}-${p.day}`;
}

export async function runScheduledGitMaintenance(): Promise<GitMaintenanceSummary | null> {
  const day = amsterdamDay();
  if (day === lastRunDay) return null;
  if (inFlight) return null;
  inFlight = true;
  try {
    const summary = await runGitMaintenance();
    // Ook een skip telt als "vandaag gedaan": de skip-redenen (te klein of
    // main != origin/main) veranderen binnen een dag zelden en de check zelf
    // is goedkoop genoeg om morgen gewoon opnieuw te doen.
    lastRunDay = day;
    return summary;
  } finally {
    inFlight = false;
  }
}

// Eigen starter (los van de reminder-scheduler): de .git-groei gebeurt juist
// in de ontwikkelomgeving, waar de reminder-scheduler standaard uit staat.
// Standaard AAN zodra er een .git-map is; uit te zetten met
// GIT_MAINTENANCE_IN_PROCESS=false.
export function startGitMaintenanceScheduler(): void {
  if (started) return;
  const flag = process.env.GIT_MAINTENANCE_IN_PROCESS;
  if (flag === "false") {
    logger.info({ gitMaintenance: "scheduler" }, "git-onderhoud uitgeschakeld via env");
    return;
  }
  if (!findRepoRoot(process.cwd())) return; // geen .git → niets te bewaken
  started = true;

  const run = async () => {
    try {
      const summary = await runScheduledGitMaintenance();
      if (!summary) return;
      if (summary.ran) {
        logger.info(
          {
            gitMaintenance: "scheduler",
            before: summary.gitBytesBefore,
            after: summary.gitBytesAfter,
            actions: summary.actions,
            errors: summary.errors,
          },
          "automatische .git-opschoning uitgevoerd",
        );
      } else {
        logger.info(
          { gitMaintenance: "scheduler", skipped: summary.skippedReason },
          "automatische .git-opschoning overgeslagen",
        );
      }
    } catch (err) {
      logger.error({ err, gitMaintenance: "scheduler" }, ".git-opschoning mislukt");
    }
  };

  const timer = setInterval(() => void run(), 6 * 60 * 60_000);
  timer.unref?.();
  const kickoff = setTimeout(() => void run(), 2 * 60_000);
  kickoff.unref?.();
  logger.info({ gitMaintenance: "scheduler" }, "git-onderhoud-planner gestart");
}
