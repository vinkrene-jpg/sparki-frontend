import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ProbeResult } from "./types";

// ── Project disk-usage probe ─────────────────────────────────────────────────
// The publish/deploy image includes the working directory PLUS .git and has a
// hard 8 GiB limit. History cleanups brought .git back to ~0.5 GB, but backup
// refs, stale subrepl branches and big committed files can silently regrow it
// until publishing fails. This probe measures real sizes with `du` and warns
// EARLY (well below the hard limit) with the biggest offenders, so the admin
// can clean up before a publish ever breaks.
//
// Honesty: when there is no .git directory (or `du` is unavailable) the result
// is GREY — we never guess a size.

// Thresholds. Warn early, escalate near the limit. Verlaagd na de herhaling
// van 2026-07-29 (publicatie faalde op de 8 GiB-limiet): eerder oranje zodat
// René het vóór een publicatie ziet.
export const GIT_WARN_BYTES = 1.0 * 1024 ** 3; // .git > 1,0 GB → orange
export const TOTAL_WARN_BYTES = 5 * 1024 ** 3; // totaal > 5 GiB → orange
export const TOTAL_CRITICAL_BYTES = 7.25 * 1024 ** 3; // totaal > 7,25 GiB → red (publish limit is 8 GiB)
// exports/ boven deze drempel wordt expliciet als opruimkandidaat benoemd:
// oude export-zips komen via checkpoint-herstel terug en tellen volledig mee
// voor de publiceerlimiet (taak 407).
export const EXPORTS_WARN_BYTES = 200 * 1024 ** 2; // exports/ > 200 MB → benoemen

function ms(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}

function runDu(args: string[], cwd: string, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "du",
      args,
      { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        // `du` exits non-zero on unreadable files but still prints totals;
        // accept output when we got any, otherwise fail honestly.
        if (stdout && stdout.trim().length > 0) return resolve(stdout);
        reject(err ?? new Error("du gaf geen uitvoer"));
      },
    );
  });
}

// Walk up from a starting directory to the repo root (the dir containing .git).
export function findRepoRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export function formatGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}

interface DiskUsage {
  gitBytes: number;
  totalBytes: number;
  // Exact size of exports/ (0/undefined when absent) — named cleanup candidate.
  exportsBytes?: number;
  // Largest top-level entries (name + bytes), sorted desc.
  offenders: Array<{ name: string; bytes: number }>;
  // Environment-managed dirs measured but excluded from the alarm total.
  excludedNote?: string;
}

// Environment-managed dirs (package store, caches, agent tooling). They are
// rebuilt/managed by the platform, are not what this alarm watches (backup
// refs, subrepl branches, big committed files) and would otherwise cause a
// permanent false alarm. They ARE still measured and reported in the details.
const ENV_MANAGED_DIRS = new Set([
  "node_modules",
  ".cache",
  ".config",
  ".upm",
  ".local",
]);

// Parse "du -sk" style output: "<kb>\t<path>" per line.
function parseDuLines(out: string): Array<{ name: string; bytes: number }> {
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d+)\s+(.+)$/);
      if (!m) return null;
      return { name: m[2], bytes: Number(m[1]) * 1024 };
    })
    .filter((x): x is { name: string; bytes: number } => x !== null);
}

export async function measureDiskUsage(repoRoot: string): Promise<DiskUsage> {
  // One `du -sk` per top-level entry (incl. .git) in a single invocation.
  const listing = await runDu(["-sk", "--", ".git", ...(await topLevelEntries(repoRoot))], repoRoot);
  const entries = parseDuLines(listing);
  const gitBytes = entries.find((e) => e.name === ".git")?.bytes ?? 0;
  const counted = entries.filter((e) => !ENV_MANAGED_DIRS.has(e.name));
  const excluded = entries.filter((e) => ENV_MANAGED_DIRS.has(e.name));
  const totalBytes = counted.reduce((sum, e) => sum + e.bytes, 0);
  const exportsBytes = counted.find((e) => e.name === "exports")?.bytes ?? 0;
  const offenders = [...counted].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  const excludedNote =
    excluded.length > 0
      ? excluded
          .sort((a, b) => b.bytes - a.bytes)
          .map((e) => `${e.name}: ${formatGb(e.bytes)}`)
          .join(", ")
      : undefined;
  return { gitBytes, totalBytes, exportsBytes, offenders, excludedNote };
}

async function topLevelEntries(repoRoot: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(repoRoot);
  return names.filter((n) => n !== ".git");
}

export function classifyDiskUsage(
  usage: DiskUsage,
  tookMs: number,
): ProbeResult {
  const { gitBytes, totalBytes, offenders } = usage;
  const offenderLine = offenders
    .map((o) => `${o.name}: ${formatGb(o.bytes)}`)
    .join(", ");
  const exportsBytes = usage.exportsBytes ?? 0;
  const exportsNote =
    exportsBytes > EXPORTS_WARN_BYTES
      ? ` De map exports/ is ${formatGb(exportsBytes)} en is een opruimkandidaat: oude export-zips die al extern veiliggesteld zijn (zie docs/EVIDENCE_ARCHIVE_INVENTORY.md) horen lokaal niet meer te bestaan; de automatische exports-opschoning ruimt bewijsbaar veilige bestanden dagelijks op.`
      : "";
  const technicalDetails =
    `.git=${formatGb(gitBytes)}, totaal (excl. omgevingsmappen)=${formatGb(totalBytes)} ` +
    `(drempels: .git ${formatGb(GIT_WARN_BYTES)}, totaal ${formatGb(TOTAL_WARN_BYTES)}, ` +
    `kritiek ${formatGb(TOTAL_CRITICAL_BYTES)}; publiceerlimiet 8 GiB). ` +
    `Grootste mappen: ${offenderLine}` +
    (exportsBytes > 0
      ? `. exports/=${formatGb(exportsBytes)} (drempel opruimkandidaat ${formatGb(EXPORTS_WARN_BYTES)})`
      : "") +
    (usage.excludedNote
      ? `. Niet meegeteld (omgevingsmappen): ${usage.excludedNote}`
      : "");

  if (totalBytes > TOTAL_CRITICAL_BYTES) {
    return {
      status: "red",
      passed: false,
      responseTimeMs: tookMs,
      message:
        `De projectmap is ${formatGb(totalBytes)} en zit vlak bij de publiceerlimiet van 8 GiB. ` +
        `Publiceren kan hierdoor mislukken. Grootste boosdoeners: ${offenderLine}.` +
        exportsNote,
      technicalDetails,
      urgency: "critical",
    };
  }
  if (totalBytes > TOTAL_WARN_BYTES || gitBytes > GIT_WARN_BYTES) {
    const reason =
      gitBytes > GIT_WARN_BYTES
        ? `De .git-map is gegroeid tot ${formatGb(gitBytes)} (drempel ${formatGb(GIT_WARN_BYTES)}).`
        : `De projectmap is gegroeid tot ${formatGb(totalBytes)} (drempel ${formatGb(TOTAL_WARN_BYTES)}).`;
    return {
      status: "orange",
      passed: false,
      responseTimeMs: tookMs,
      message:
        `${reason} Ruim op voordat de publiceerlimiet (8 GiB) in zicht komt. ` +
        `Grootste boosdoeners: ${offenderLine}.` +
        exportsNote,
      technicalDetails,
      urgency: "medium",
    };
  }
  return {
    status: "green",
    passed: true,
    responseTimeMs: tookMs,
    message:
      `De projectmap is gezond van omvang (totaal ${formatGb(totalBytes)}, ` +
      `.git ${formatGb(gitBytes)}) — ruim onder de publiceerlimiet.` +
      exportsNote,
    technicalDetails,
  };
}

export async function probeProjectDiskSize(): Promise<ProbeResult> {
  const start = performance.now();
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    return {
      status: "grey",
      passed: false,
      responseTimeMs: ms(start),
      message:
        "Geen .git-map gevonden in deze omgeving; de projectgrootte kan hier niet gemeten worden.",
      technicalDetails: `Gestart vanuit ${process.cwd()}`,
    };
  }
  try {
    const usage = await measureDiskUsage(repoRoot);
    return classifyDiskUsage(usage, ms(start));
  } catch (err) {
    return {
      status: "orange",
      passed: false,
      responseTimeMs: ms(start),
      message:
        "De projectgrootte kon niet gemeten worden (du mislukte). Controleer dit handmatig voordat je publiceert.",
      technicalDetails: err instanceof Error ? err.message : String(err),
    };
  }
}
