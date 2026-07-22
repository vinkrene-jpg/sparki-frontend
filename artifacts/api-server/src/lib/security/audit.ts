// Onveranderbaar beveiligings-auditlog. Alleen appenden — nergens in de
// applicatie bestaat een update/delete op deze tabel. Schrijffouten mogen een
// gebruikersactie nooit blokkeren behalve waar de wet audit vereist
// (export/verwijdering): daar is de audit onderdeel van dezelfde flow.

import type { Request } from "express";
import {
  db,
  securityAuditLogTable,
  type SecurityEventKind,
} from "@workspace/db";
import { logger } from "../logger";

export interface AuditInput {
  event: SecurityEventKind;
  actorClerkId?: string | null;
  subjectClerkId?: string | null;
  meta?: Record<string, unknown>;
  req?: Request;
}

function clientIp(req?: Request): string | null {
  if (!req) return null;
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw?.split(",")[0]?.trim() || req.socket?.remoteAddress) ?? null;
}

/** Schrijf een auditregel. Gooit alleen wanneer `required` waar is. */
export async function writeAudit(
  input: AuditInput,
  opts: { required?: boolean } = {},
): Promise<void> {
  try {
    await db.insert(securityAuditLogTable).values({
      event: input.event,
      actorClerkId: input.actorClerkId ?? null,
      subjectClerkId: input.subjectClerkId ?? null,
      meta: input.meta ?? null,
      ip: clientIp(input.req),
    });
  } catch (err) {
    if (opts.required) throw err;
    logger.error({ err, event: input.event }, "audit write failed");
  }
}
