/**
 * system-mode — gecachte lezer voor de system_business_mode singleton.
 * Hetzelfde patroon als kill-switches: 10s TTL, maar FAIL-SAFE bij leesfout:
 * we vallen NOOIT automatisch terug op NORMAL. Bij een DB-fout houden we de
 * laatst bekende geldige modus aan (staleCache), en bij een koude start zonder
 * DB rapporteren we DEGRADED — zodat een actieve verkoop- of onderhoudspauze
 * nooit stilletjes wordt opgeheven door een storing.
 * Schrijven uitsluitend via writeSystemMode() (admin-gated).
 */

import {
  db,
  systemBusinessModeTable,
  adminOpsLogTable,
  type SystemBusinessMode,
  systemBusinessModes,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const CACHE_TTL_MS = 10_000;
let cache: { at: number; mode: SystemBusinessMode; reason: string | null } | null = null;
// Laatst bekende geldige DB-waarde — overleeft cache-invalidatie, zodat een
// DB-storing nooit een actieve pauze "vergeet".
let lastValidRead: { mode: SystemBusinessMode; reason: string | null } | null = null;

export function invalidateSystemModeCache(): void {
  cache = null;
}

/** Alleen voor tests: wist cache én laatst bekende waarde (koude start). */
export function _resetSystemModeStateForTest(): void {
  cache = null;
  lastValidRead = null;
}

type SystemModeRow = { id: number; mode: string; reason: string | null };
type SystemModeQuery = () => Promise<SystemModeRow | undefined>;

async function defaultQuery(): Promise<SystemModeRow | undefined> {
  const [row] = await db
    .select()
    .from(systemBusinessModeTable)
    .where(eq(systemBusinessModeTable.id, 1))
    .limit(1);
  return row as SystemModeRow | undefined;
}

export interface SystemModeReadResult {
  mode: SystemBusinessMode;
  reason: string | null;
  /** true wanneer de DB-read faalde en het antwoord dus niet vers is. */
  dbError: boolean;
  /** true wanneer we op de laatst bekende (mogelijk verouderde) waarde leunen. */
  staleCache: boolean;
}

/**
 * Lees de huidige systeemmodus. FAIL-SAFE: bij een DB-fout wordt de laatst
 * bekende modus aangehouden (staleCache=true); zonder eerdere read geeft een
 * fout DEGRADED terug — nooit automatisch NORMAL.
 */
export async function readSystemMode(
  query: SystemModeQuery = defaultQuery,
): Promise<SystemModeReadResult> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return { mode: cache.mode, reason: cache.reason, dbError: false, staleCache: false };
  }
  try {
    const row = await query();
    const mode: SystemBusinessMode = (row?.mode as SystemBusinessMode) ?? "NORMAL";
    const reason = row?.reason ?? null;
    cache = { at: now, mode, reason };
    lastValidRead = { mode, reason };
    return { mode, reason, dbError: false, staleCache: false };
  } catch (err) {
    if (lastValidRead) {
      logger.error(
        { err },
        "system-mode read failed — laatst bekende modus aangehouden",
      );
      return {
        mode: lastValidRead.mode,
        reason: lastValidRead.reason,
        dbError: true,
        staleCache: true,
      };
    }
    logger.error({ err }, "system-mode read failed zonder eerdere waarde — DEGRADED");
    return { mode: "DEGRADED", reason: null, dbError: true, staleCache: false };
  }
}

/** Zet de systeemmodus. Schrijft ook een admin-ops-logregel. */
export async function writeSystemMode(
  newMode: SystemBusinessMode,
  opts: {
    reason?: string;
    actorClerkId: string;
    actorIp?: string;
  },
): Promise<void> {
  const previous = await readSystemMode();

  // Upsert singleton (id=1).
  await db
    .insert(systemBusinessModeTable)
    .values({
      id: 1,
      mode: newMode,
      reason: opts.reason ?? null,
      changedByClerkId: opts.actorClerkId,
      changedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemBusinessModeTable.id,
      set: {
        mode: newMode,
        reason: opts.reason ?? null,
        changedByClerkId: opts.actorClerkId,
        changedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  // Audit log — fire-and-forget, mislukken blokkeert niet.
  try {
    await db.insert(adminOpsLogTable).values({
      action: "system_mode_change",
      actorClerkId: opts.actorClerkId,
      previousState: previous,
      newState: { mode: newMode, reason: opts.reason ?? null },
      reason: opts.reason ?? null,
      actorIp: opts.actorIp ?? null,
    });
  } catch (auditErr) {
    logger.error({ auditErr }, "admin-ops-log write failed after system-mode change");
  }

  invalidateSystemModeCache();
}

export { systemBusinessModes };
export type { SystemBusinessMode };
