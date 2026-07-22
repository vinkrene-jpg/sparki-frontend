// Kill switches — directe noodstop per verwerkingsdomein, zonder deployment.
// Een actieve switch stopt uitsluitend NIEUWE verwerking; bestaande data
// blijft onaangetast. Toestand staat in de database (kill_switches) en wordt
// hier kort gecached zodat elke request geen extra query kost maar een
// wijziging binnen seconden effect heeft.

import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  killSwitchesTable,
  KILL_SWITCH_KEYS,
  KILL_SWITCH_LABELS,
  type KillSwitchKey,
} from "@workspace/db";
import { logger } from "./logger";

const CACHE_TTL_MS = 10_000;
let cache: { at: number; active: Set<string> } | null = null;

export function invalidateKillSwitchCache(): void {
  cache = null;
}

async function activeSwitches(): Promise<Set<string>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.active;
  try {
    const rows = await db
      .select({ key: killSwitchesTable.key, active: killSwitchesTable.active })
      .from(killSwitchesTable);
    cache = {
      at: now,
      active: new Set(rows.filter((r) => r.active).map((r) => r.key)),
    };
    return cache.active;
  } catch (err) {
    // Leesfout mag de app niet platleggen; bestaande cache blijft leidend.
    logger.error({ err }, "kill-switch read failed");
    return cache?.active ?? new Set();
  }
}

export async function isKilled(key: KillSwitchKey): Promise<boolean> {
  return (await activeSwitches()).has(key);
}

export class KillSwitchError extends Error {
  constructor(public readonly key: KillSwitchKey) {
    super(
      `${KILL_SWITCH_LABELS[key]} is tijdelijk uitgeschakeld door de beheerder. Bestaande gegevens blijven bewaard; probeer het later opnieuw.`,
    );
    this.name = "KillSwitchError";
  }
}

/** Gooit KillSwitchError wanneer het domein is stilgelegd. */
export async function ensureAlive(key: KillSwitchKey): Promise<void> {
  if (await isKilled(key)) throw new KillSwitchError(key);
}

/** Express-middleware: 503 met Nederlandse melding wanneer stilgelegd. */
export function killSwitchGuard(key: KillSwitchKey) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    if (await isKilled(key)) {
      res.status(503).json({
        error: `${KILL_SWITCH_LABELS[key]} is tijdelijk uitgeschakeld door de beheerder. Bestaande gegevens blijven bewaard; probeer het later opnieuw.`,
        killSwitch: key,
      });
      return;
    }
    next();
  };
}

export { KILL_SWITCH_KEYS, KILL_SWITCH_LABELS, type KillSwitchKey };
