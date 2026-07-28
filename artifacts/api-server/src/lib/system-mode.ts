/**
 * system-mode — gecachte lezer voor de system_business_mode singleton.
 *
 * FAIL-SAFE PRINCIPE (niet fail-open):
 * ─────────────────────────────────────
 * • Bij een DB-leesfout: behoud de LAATSTE GELDIGE status (cache verloopt NIET
 *   door een fout). Retourneer die status met { dbError: true, staleCache: true }.
 * • Als er NOOIT een succesvolle read is geweest (processtart zonder DB-verbinding):
 *   retourneer DEGRADED — blokkeer nieuwe verkoop en risicovolle adminacties.
 *   NORMAL treedt hier nooit op als gevolg van een fout.
 * • NORMAL mag uitsluitend worden geretourneerd als de database NORMAL bevat,
 *   of als de singleton-rij nog niet bestaat (aantoonbaar nieuw systeem).
 * • Schrijven uitsluitend via writeSystemMode() (admin-gated).
 *
 * Tests: src/tests/system-mode.ts
 * Bewijs: docs/PRODUCTIE_DB_BEWIJS.md
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

/**
 * lastValidRead wordt UITSLUITEND bijgewerkt na een succesvolle DB-read.
 * Een fout-pad mag deze waarde nooit overschrijven.
 */
let lastValidRead: { mode: SystemBusinessMode; reason: string | null } | null =
  null;
let cacheAt: number | null = null;

export type SystemModeResult = {
  mode: SystemBusinessMode;
  reason: string | null;
  /**
   * true als de LAATSTE leespoging een DB-fout opleverde.
   * De consumer kan een degraded-UI of waarschuwing tonen.
   */
  dbError: boolean;
  /**
   * true als de teruggegeven waarde uit een verouderde cache komt
   * (DB was tijdelijk onbereikbaar, maar eerdere status bekend).
   */
  staleCache: boolean;
};

/** Vernietig de TTL-cache. lastValidRead blijft als vangnet bij volgende fout. */
export function invalidateSystemModeCache(): void {
  cacheAt = null;
}

/**
 * Reset volledig voor testdoeleinden — NOOIT in productiecode aanroepen.
 */
export function _resetSystemModeStateForTest(): void {
  lastValidRead = null;
  cacheAt = null;
}

/** Probeer een DB-leesfout te registreren in admin_ops_log. Fire-and-forget. */
async function _logDbErrorToAudit(errorMessage: string): Promise<void> {
  try {
    await db.insert(adminOpsLogTable).values({
      action: "system_mode_db_read_error",
      actorClerkId: "system",
      previousState: lastValidRead ?? null,
      newState: null,
      reason: `[FAILSAFE] DB-leesfout — ${errorMessage}`,
      actorIp: null,
    });
  } catch {
    // DB is zelf down — audit logging secundair, nooit gooien.
  }
}

/**
 * Lees de huidige systeemmodus.
 *
 * @param _testQueryOverride - Optionele query-functie voor tests. Nooit gebruiken
 *   in productiecode. Geeft de test controle over succes/fout zonder echte DB.
 */
export async function readSystemMode(
  _testQueryOverride?: () =>
    | Promise<
        | { mode: string; reason: string | null; id: number } // minimale subset
        | undefined
      >
    | never,
): Promise<SystemModeResult> {
  const now = Date.now();

  // Cache-hit binnen TTL — geen DB-aanroep nodig.
  if (
    lastValidRead &&
    cacheAt !== null &&
    now - cacheAt < CACHE_TTL_MS &&
    !_testQueryOverride // tests slaan cache over zodat queries zichtbaar zijn
  ) {
    return {
      mode: lastValidRead.mode,
      reason: lastValidRead.reason,
      dbError: false,
      staleCache: false,
    };
  }

  try {
    let row: { mode: string; reason: string | null; id: number } | undefined;

    if (_testQueryOverride) {
      row = await _testQueryOverride();
    } else {
      const [dbRow] = await db
        .select()
        .from(systemBusinessModeTable)
        .where(eq(systemBusinessModeTable.id, 1))
        .limit(1);
      row = dbRow
        ? { mode: dbRow.mode, reason: dbRow.reason ?? null, id: dbRow.id }
        : undefined;
    }

    if (!row) {
      // Geen singleton-rij = aantoonbaar nieuwe installatie. NORMAL is hier
      // toegestaan, maar log een waarschuwing zodat beheerders de rij aanmaken.
      logger.warn(
        "system_business_mode singleton niet gevonden — NORMAL als initialisatie-standaard",
      );
      const mode: SystemBusinessMode = "NORMAL";
      lastValidRead = { mode, reason: null };
      cacheAt = now;
      return { mode, reason: null, dbError: false, staleCache: false };
    }

    const mode = row.mode as SystemBusinessMode;
    const reason = row.reason ?? null;
    // Succesvolle read — bijwerken.
    lastValidRead = { mode, reason };
    cacheAt = now;
    return { mode, reason, dbError: false, staleCache: false };
  } catch (err) {
    // ═══════════════════════════════════════════════════════════════════════
    // DB-LEESFOUT — FAILSAFE GEACTIVEERD
    // NOOIT terugvallen op NORMAL. Status mag uitsluitend van de DB komen.
    // ═══════════════════════════════════════════════════════════════════════

    const errorMsg = err instanceof Error ? err.message : String(err);

    logger.error(
      { err },
      "[CRITICAL] system-mode DB-leesfout — failsafe actief, status ongewijzigd",
    );

    // Poging om fout te registreren in admin_ops_log (fire-and-forget).
    _logDbErrorToAudit(errorMsg).catch(() => {});

    if (lastValidRead) {
      // Bestaande geldige status beschikbaar — gebruik die zonder NORMAL te introduceren.
      logger.warn(
        { mode: lastValidRead.mode, staleCache: true },
        "[CRITICAL] system-mode: stale cache actief na DB-fout — status ongewijzigd",
      );
      return {
        mode: lastValidRead.mode,
        reason: lastValidRead.reason,
        dbError: true,
        staleCache: true,
      };
    }

    // Geen enkele succesvolle read gehad (processtart zonder DB).
    // DEGRADED = veilige fallback: blokkeert nieuwe verkoop + risicovolle
    // adminacties, staat read-only bestaande functies toe.
    logger.error(
      "[CRITICAL] system-mode: geen geldige status bij processtart — DEGRADED als veilige fallback",
    );
    return {
      mode: "DEGRADED",
      reason:
        "Database onbereikbaar — bedrijfsstatus onbekend bij processtart",
      dbError: true,
      staleCache: false,
    };
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
  // Huidige status ophalen voor de audit-log.
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

  // Audit-log — fire-and-forget, mislukken blokkeert niet.
  try {
    await db.insert(adminOpsLogTable).values({
      action: "system_mode_change",
      actorClerkId: opts.actorClerkId,
      previousState: { mode: previous.mode, reason: previous.reason },
      newState: { mode: newMode, reason: opts.reason ?? null },
      reason: opts.reason ?? null,
      actorIp: opts.actorIp ?? null,
    });
  } catch (auditErr) {
    logger.error(
      { auditErr },
      "admin-ops-log write failed after system-mode change",
    );
  }

  invalidateSystemModeCache();
}

export { systemBusinessModes };
export type { SystemBusinessMode };
