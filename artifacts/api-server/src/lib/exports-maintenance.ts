// ── Automatische exports/-opschoning (publiceerlimiet-bewaking, taak 407) ───
//
// WAAROM: de werkmap telt óók mee voor de 8 GiB-publiceerlimiet en de map
// `exports/` groeit terug via checkpoint-herstel (zie
// .agents/memory/sparki-bewijsarchief.md, update 29 jul 2026): grote
// export-zips die al extern veiliggesteld én lokaal verwijderd waren, komen
// via een checkpoint gewoon terug. Deze routine ruimt ze opnieuw op — maar
// ALLEEN wanneer bewijsbaar vaststaat dat de bucket-kopie byte-identiek is.
//
// VEILIGHEID (fail-closed, bewijsarchief-regels zijn heilig):
//  - Een bestand in exports/ wordt UITSLUITEND verwijderd wanneer zijn
//    SHA-256 exact overeenkomt met een rij in
//    docs/EVIDENCE_ARCHIVE_INVENTORY.md waarvan de actie-kolom zegt dat het
//    bestand extern veiliggesteld ("extern veiliggesteld") én al eens
//    "lokaal verwijderd" is. Zo'n match bewijst: de inhoud staat
//    byte-identiek in de privé App Storage-bucket en hóórt lokaal niet meer
//    te bestaan.
//  - Onbekende bestanden (geen SHA-match) worden NOOIT verwijderd — dat kan
//    nieuw, nog niet geregistreerd bewijs zijn. Ze worden eerlijk gemeld als
//    "behouden" met reden; opruimen daarvan is een beheerbeslissing.
//  - Kan de inventaris niet gelezen worden → niets verwijderen (skip met
//    reden), nooit gokken.
//  - Bestanden jonger dan 24 uur worden nooit aangeraakt (kan een export
//    zijn die net gemaakt of nog geschreven wordt).
//  - Alleen reguliere bestanden direct in exports/ plus — sinds taak 408 —
//    losse backup-bestanden (*.zip / *.bundle) DIRECT in de projectroot;
//    nooit docs/, nooit attached_assets/, nooit bewijsarchiefpaden, nooit
//    submappen. Voor rootbestanden geldt exact dezelfde fail-closed regel:
//    verwijderen kan alleen bij een byte-identieke SHA-match met een
//    inventarisrij "extern veiliggesteld" + "lokaal verwijderd".
//  - Onder de ondergrens (totaal exports/ < 50 MB) is de run een goedkope
//    no-op.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { findRepoRoot, formatGb } from "./health/disk-usage";
import { logger } from "./logger";

// Onder deze totale exports/-omvang doen we niets (goedkope dagelijkse no-op).
export const EXPORTS_MAINTENANCE_MIN_BYTES = 50 * 1024 ** 2;
// Bestanden jonger dan dit worden nooit aangeraakt.
export const EXPORTS_MIN_AGE_MS = 24 * 60 * 60_000;

export const INVENTORY_RELATIVE_PATH = "docs/EVIDENCE_ARCHIVE_INVENTORY.md";

// Losse backup-bestanden direct in de projectroot die de routine mag
// beoordelen (taak 408). Uitsluitend zip/bundle-extensies; alles daarbuiten
// wordt nooit aangeraakt.
export const ROOT_BACKUP_PATTERN = /\.(zip|bundle)$/i;

export interface ExportsMaintenanceSummary {
  ran: boolean;
  skippedReason?: string;
  totalBytesBefore?: number;
  deleted: Array<{ name: string; bytes: number; sha256: string }>;
  kept: Array<{ name: string; bytes: number; reason: string }>;
  errors: string[];
}

// Pure parser: haal uit de inventaris-markdown de SHA-256's van bestanden die
// aantoonbaar extern veiliggesteld én lokaal verwijderd zijn. Alleen die
// combinatie maakt lokaal verwijderen bewijsbaar veilig.
export function parseOffloadedShas(inventoryMarkdown: string): Set<string> {
  const out = new Set<string>();
  for (const line of inventoryMarkdown.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const m = line.match(/`([0-9a-f]{64})`/);
    if (!m) continue;
    const lower = line.toLowerCase();
    if (lower.includes("extern veiliggesteld") && lower.includes("lokaal verwijderd")) {
      out.add(m[1]);
    }
  }
  return out;
}

export async function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function runExportsMaintenance(opts?: {
  force?: boolean;
  minBytes?: number;
  minAgeMs?: number;
  now?: number;
}): Promise<ExportsMaintenanceSummary> {
  const deleted: ExportsMaintenanceSummary["deleted"] = [];
  const kept: ExportsMaintenanceSummary["kept"] = [];
  const errors: string[] = [];
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    return { ran: false, skippedReason: "geen repo-root gevonden", deleted, kept, errors };
  }
  const exportsDir = path.join(repoRoot, "exports");

  const now = opts?.now ?? Date.now();
  const minAgeMs = opts?.minAgeMs ?? EXPORTS_MIN_AGE_MS;
  const files: Array<{ name: string; abs: string; bytes: number; mtimeMs: number }> = [];

  // 1. Bestanden direct in exports/ (map kan ontbreken — dan niets daar).
  let exportsDirExists = true;
  let names: string[] = [];
  try {
    names = await readdir(exportsDir);
  } catch {
    exportsDirExists = false;
  }
  for (const name of names.sort()) {
    const abs = path.join(exportsDir, name);
    try {
      const st = await stat(abs);
      if (!st.isFile()) {
        kept.push({ name, bytes: 0, reason: "geen regulier bestand — nooit aanraken" });
        continue;
      }
      files.push({ name, abs, bytes: st.size, mtimeMs: st.mtimeMs });
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Losse backup-bestanden DIRECT in de projectroot (taak 408): alleen
  //    *.zip / *.bundle, nooit submappen. Dezelfde fail-closed SHA-poort
  //    verderop beslist of verwijderen bewijsbaar veilig is.
  try {
    const rootNames = (await readdir(repoRoot)).filter((n) => ROOT_BACKUP_PATTERN.test(n));
    for (const name of rootNames.sort()) {
      const abs = path.join(repoRoot, name);
      try {
        const st = await stat(abs);
        if (!st.isFile()) continue; // mappen met .zip-achtige naam: nooit aanraken
        files.push({ name, abs, bytes: st.size, mtimeMs: st.mtimeMs });
      } catch (err) {
        errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`projectroot niet leesbaar: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!exportsDirExists && files.length === 0) {
    return {
      ran: false,
      skippedReason: "exports/ bestaat niet en geen losse root-backups — niets te doen",
      deleted,
      kept,
      errors,
    };
  }
  const totalBytesBefore = files.reduce((s, f) => s + f.bytes, 0);

  const minBytes = opts?.minBytes ?? EXPORTS_MAINTENANCE_MIN_BYTES;
  if (!opts?.force && totalBytesBefore < minBytes) {
    return {
      ran: false,
      skippedReason: `exports/ is ${formatGb(totalBytesBefore)} — onder de ondergrens (${formatGb(minBytes)}), niets te doen`,
      totalBytesBefore,
      deleted,
      kept,
      errors,
    };
  }

  // Fail-closed poort: zonder leesbare inventaris wordt er NIETS verwijderd.
  let offloaded: Set<string>;
  try {
    const md = await readFile(path.join(repoRoot, INVENTORY_RELATIVE_PATH), "utf8");
    offloaded = parseOffloadedShas(md);
  } catch (err) {
    return {
      ran: false,
      skippedReason: `bewijsarchief-inventaris niet leesbaar (${err instanceof Error ? err.message : String(err)}) — niets verwijderd`,
      totalBytesBefore,
      deleted,
      kept,
      errors,
    };
  }
  if (offloaded.size === 0) {
    return {
      ran: false,
      skippedReason:
        "inventaris bevat geen extern-veiliggestelde rijen — niets bewijsbaar veilig te verwijderen",
      totalBytesBefore,
      deleted,
      kept,
      errors,
    };
  }

  for (const f of files) {
    if (now - f.mtimeMs < minAgeMs) {
      kept.push({ name: f.name, bytes: f.bytes, reason: "jonger dan 24 uur — nooit aanraken" });
      continue;
    }
    let sha: string;
    try {
      sha = await sha256OfFile(f.abs);
    } catch (err) {
      errors.push(`${f.name}: sha256 mislukt (${err instanceof Error ? err.message : String(err)})`);
      kept.push({ name: f.name, bytes: f.bytes, reason: "sha256 kon niet bepaald worden — behouden" });
      continue;
    }
    if (!offloaded.has(sha)) {
      kept.push({
        name: f.name,
        bytes: f.bytes,
        reason: "geen byte-identieke, extern-veiliggestelde inventarisrij — behouden (mogelijk nieuw bewijs)",
      });
      continue;
    }
    try {
      await unlink(f.abs);
      deleted.push({ name: f.name, bytes: f.bytes, sha256: sha });
    } catch (err) {
      errors.push(`${f.name}: verwijderen mislukt (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  return { ran: true, totalBytesBefore, deleted, kept, errors };
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

export async function runScheduledExportsMaintenance(): Promise<ExportsMaintenanceSummary | null> {
  const day = amsterdamDay();
  if (day === lastRunDay) return null;
  if (inFlight) return null;
  inFlight = true;
  try {
    const summary = await runExportsMaintenance();
    lastRunDay = day;
    return summary;
  } finally {
    inFlight = false;
  }
}

// Eigen starter, zelfde patroon als de .git-opschoning: exports/ groeit juist
// in de ONTWIKKELomgeving (checkpoint-herstel). Uit te zetten met
// EXPORTS_MAINTENANCE_IN_PROCESS=false.
export function startExportsMaintenanceScheduler(): void {
  if (started) return;
  const flag = process.env.EXPORTS_MAINTENANCE_IN_PROCESS;
  if (flag === "false") {
    logger.info({ exportsMaintenance: "scheduler" }, "exports-onderhoud uitgeschakeld via env");
    return;
  }
  if (!findRepoRoot(process.cwd())) return;
  started = true;

  const run = async () => {
    try {
      const summary = await runScheduledExportsMaintenance();
      if (!summary) return;
      if (summary.ran) {
        logger.info(
          {
            exportsMaintenance: "scheduler",
            totalBytesBefore: summary.totalBytesBefore,
            deleted: summary.deleted,
            kept: summary.kept,
            errors: summary.errors,
          },
          "automatische exports-opschoning uitgevoerd",
        );
      } else {
        logger.info(
          { exportsMaintenance: "scheduler", skipped: summary.skippedReason },
          "automatische exports-opschoning overgeslagen",
        );
      }
    } catch (err) {
      logger.error({ err, exportsMaintenance: "scheduler" }, "exports-opschoning mislukt");
    }
  };

  const timer = setInterval(() => void run(), 6 * 60 * 60_000);
  timer.unref?.();
  const kickoff = setTimeout(() => void run(), 3 * 60_000);
  kickoff.unref?.();
  logger.info({ exportsMaintenance: "scheduler" }, "exports-onderhoud-planner gestart");
}
