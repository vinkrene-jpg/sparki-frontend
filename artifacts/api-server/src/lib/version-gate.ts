// Versie- en compatibiliteitscontrole voor web, API en mobiele app.
// Per platform staat een minimaal ondersteunde clientversie in de database
// (version_requirements). Een client onder dat minimum krijgt 426 (Upgrade
// Required) met een duidelijke Nederlandse melding; web en mobiel tonen daarop
// een blokkeerscherm. Verzoeken zonder versieheader (webhooks, curl, oudere
// clients van vóór deze golf) worden niet geblokkeerd — de controle is een
// veiligheidspoort voor bekende clients, geen aanvalsdetectie.

import type { Request, Response, NextFunction } from "express";
import { db, versionRequirementsTable } from "@workspace/db";
import { logger } from "./logger";

const CACHE_TTL_MS = 10_000;
let cache: { at: number; rows: Map<string, { minVersion: string; message: string | null }> } | null =
  null;

export function invalidateVersionCache(): void {
  cache = null;
}

async function requirements(): Promise<Map<string, { minVersion: string; message: string | null }>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.rows;
  try {
    const rows = await db.select().from(versionRequirementsTable);
    cache = {
      at: now,
      rows: new Map(rows.map((r) => [r.platform, { minVersion: r.minVersion, message: r.message }])),
    };
    return cache.rows;
  } catch (err) {
    logger.error({ err }, "version-requirements read failed");
    return cache?.rows ?? new Map();
  }
}

/** Vergelijk twee "1.2.3"-versies; ontbrekende delen tellen als 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function isParsableVersion(v: string): boolean {
  return /^\d+(\.\d+){0,3}$/.test(v.trim());
}

export function versionGate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const version = req.get("x-sparki-app-version");
    if (!version || !isParsableVersion(version)) return next();
    const platform = req.get("x-sparki-platform") === "mobiel" ? "mobiel" : "web";
    const reqs = await requirements();
    const rule = reqs.get(platform);
    if (!rule) return next();
    if (compareVersions(version, rule.minVersion) < 0) {
      res.status(426).json({
        error:
          rule.message ??
          "Deze versie van Sparki is verouderd en werkt niet meer veilig samen met de server. Ververs de app (web: pagina herladen; mobiel: update installeren) om verder te gaan.",
        code: "version_incompatible",
        platform,
        minVersion: rule.minVersion,
        clientVersion: version,
      });
      return;
    }
    next();
  };
}
