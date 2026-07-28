/**
 * system-mode — gecachte lezer voor de system_business_mode singleton.
 * Hetzelfde patroon als kill-switches: 10s TTL, fail-open (NORMAL bij leesfout).
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

export function invalidateSystemModeCache(): void {
  cache = null;
}

/** Lees de huidige systeemmodus. Retourneert NORMAL bij leesfout (fail-open). */
export async function readSystemMode(): Promise<{
  mode: SystemBusinessMode;
  reason: string | null;
}> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return { mode: cache.mode, reason: cache.reason };
  }
  try {
    const [row] = await db
      .select()
      .from(systemBusinessModeTable)
      .where(eq(systemBusinessModeTable.id, 1))
      .limit(1);
    const mode: SystemBusinessMode = (row?.mode as SystemBusinessMode) ?? "NORMAL";
    const reason = row?.reason ?? null;
    cache = { at: now, mode, reason };
    return { mode, reason };
  } catch (err) {
    logger.error({ err }, "system-mode read failed — defaulting to NORMAL");
    return { mode: "NORMAL", reason: null };
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
