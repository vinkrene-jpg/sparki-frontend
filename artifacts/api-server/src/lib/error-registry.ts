// Centrale crash- en foutregistratie (web, API, mobiel).
// Gelijke fouten worden gegroepeerd op een fingerprint van platform +
// genormaliseerde melding + stack-top. Per groep: ernst, eerste/laatste
// voorkomen, aantal voorvallen; per voorval: releasegroep, appversie, scherm
// en correlation-id (nooit persoonsinhoud of sportdata).

import { createHash } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  errorGroupsTable,
  errorEventsTable,
  ERROR_SEVERITIES,
  type ErrorSeverity,
} from "@workspace/db";
import { logger } from "./logger";

export interface ErrorReport {
  platform: "web" | "mobiel" | "api";
  message: string;
  stack?: string | null;
  severity?: ErrorSeverity;
  clerkId?: string | null;
  releaseGroup?: string | null;
  appVersion?: string | null;
  screen?: string | null;
  correlationId?: string | null;
  // Featureflag waaraan dit voorval toe te schrijven is (indien bekend);
  // alleen voorvallen mét flag tellen mee voor de uitrolbewaking van die flag.
  flagKey?: string | null;
}

// Meldingen normaliseren zodat varianten met ids/getallen/urls samen groeperen.
export function normalizeMessage(message: string): string {
  return message
    .slice(0, 500)
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "<uuid>")
    .replace(/\b\d+\b/g, "<n>")
    .trim();
}

export function stackTopOf(stack: string | null | undefined): string | null {
  if (!stack) return null;
  const line = stack
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("at ") || /@|:\d+/.test(l));
  return line ? line.slice(0, 300).replace(/:\d+:\d+\)?$/, "") : null;
}

export function fingerprintOf(
  platform: string,
  normalizedMessage: string,
  stackTop: string | null,
): string {
  return createHash("sha256")
    .update(`${platform}|${normalizedMessage}|${stackTop ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  kritiek: 0,
  fout: 1,
  waarschuwing: 2,
};

/** Registreer één foutvoorval; upsert de groep atomair. Gooit nooit. */
export async function recordError(report: ErrorReport): Promise<number | null> {
  try {
    const severity: ErrorSeverity = ERROR_SEVERITIES.includes(
      report.severity as ErrorSeverity,
    )
      ? (report.severity as ErrorSeverity)
      : "fout";
    const normalized = normalizeMessage(report.message || "Onbekende fout");
    const top = stackTopOf(report.stack);
    const fp = fingerprintOf(report.platform, normalized, top);

    const [group] = await db
      .insert(errorGroupsTable)
      .values({
        fingerprint: fp,
        platform: report.platform,
        severity,
        message: normalized,
        stackTop: top,
        eventCount: 1,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: errorGroupsTable.fingerprint,
        set: {
          lastSeenAt: new Date(),
          eventCount: sql`${errorGroupsTable.eventCount} + 1`,
          // Ernst kan alleen zwaarder worden, nooit lichter (eerlijk beeld).
          severity: sql`CASE WHEN ${errorGroupsTable.severity} = 'kritiek' OR ${sql.raw(`'${severity}'`)} = 'kritiek' THEN 'kritiek' WHEN ${errorGroupsTable.severity} = 'fout' OR ${sql.raw(`'${severity}'`)} = 'fout' THEN 'fout' ELSE 'waarschuwing' END`,
          // Een nieuw voorval heropent een als opgelost gemarkeerde groep.
          resolvedAt: sql`NULL`,
        },
      })
      .returning({ id: errorGroupsTable.id });

    if (!group) return null;
    await db.insert(errorEventsTable).values({
      groupId: group.id,
      clerkId: report.clerkId ?? null,
      releaseGroup: report.releaseGroup ?? null,
      appVersion: report.appVersion?.slice(0, 32) ?? null,
      screen: report.screen?.slice(0, 120) ?? null,
      correlationId: report.correlationId?.slice(0, 64) ?? null,
      flagKey: report.flagKey?.slice(0, 64) ?? null,
    });
    return group.id;
  } catch (err) {
    logger.error({ err }, "error-registry write failed");
    return null;
  }
}

/**
 * Aantal kritieke voorvallen binnen het venster voor ÉÉN featureflag (voor de
 * uitrolbewaking). Alleen geauthenticeerde voorvallen tellen mee — anonieme
 * meldingen kunnen anders een uitrol-stop forceren (misbruik).
 */
export async function criticalEventCountSince(
  since: Date,
  flagKey: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(errorEventsTable)
    .innerJoin(errorGroupsTable, eq(errorGroupsTable.id, errorEventsTable.groupId))
    .where(
      and(
        gte(errorEventsTable.at, since),
        eq(errorGroupsTable.severity, "kritiek"),
        eq(errorEventsTable.flagKey, flagKey),
        sql`${errorEventsTable.clerkId} IS NOT NULL`,
      ),
    );
  return row?.n ?? 0;
}

/** Totaal kritieke voorvallen binnen het venster (alleen voor het beheerbord). */
export async function criticalEventCountAllSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(errorEventsTable)
    .innerJoin(errorGroupsTable, eq(errorGroupsTable.id, errorEventsTable.groupId))
    .where(
      and(gte(errorEventsTable.at, since), eq(errorGroupsTable.severity, "kritiek")),
    );
  return row?.n ?? 0;
}

export { SEVERITY_RANK };
