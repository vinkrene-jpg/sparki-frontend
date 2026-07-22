// Eenvoudige, afhankelijkheidsvrije sliding-window rate limiter (in-memory,
// per proces). Sleutel = clerkId wanneer ingelogd, anders IP. Bij overschrijding:
// generieke Nederlandse 429 + auditregel (met demping zodat een burst niet
// honderden auditrijen schrijft).

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getClerkUserId } from "../auth";
import { writeAudit } from "./audit";

interface Bucket {
  timestamps: number[];
  lastAuditAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

// Testhaak: in geautomatiseerde tests kunnen limieten strakker gezet worden.
const MULTIPLIER = Number(process.env.SPARKI_RATE_LIMIT_MULTIPLIER || "1") || 1;

export interface RateLimitStats {
  blockedTotal: number;
  blockedByScope: Record<string, number>;
}
export const rateLimitStats: RateLimitStats = {
  blockedTotal: 0,
  blockedByScope: {},
};

function keyFor(req: Request): string {
  const clerkId = getClerkUserId(req);
  if (clerkId) return `u:${clerkId}`;
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return `ip:${raw?.split(",")[0]?.trim() || req.socket?.remoteAddress || "?"}`;
}

/**
 * Maak een limiter: max `max` verzoeken per `windowMs` per gebruiker/IP
 * binnen deze scope.
 */
export function rateLimit(opts: {
  scope: string;
  max: number;
  windowMs: number;
}): RequestHandler {
  const max = Math.max(1, Math.round(opts.max * MULTIPLIER));
  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    // Periodieke opruiming zodat de map niet oneindig groeit.
    if (now - lastSweep > 10 * 60_000) {
      lastSweep = now;
      for (const [k, b] of buckets) {
        if (b.timestamps.length === 0 || now - b.timestamps[b.timestamps.length - 1] > 30 * 60_000) {
          buckets.delete(k);
        }
      }
    }
    const key = `${opts.scope}|${keyFor(req)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [], lastAuditAt: 0 };
      buckets.set(key, bucket);
    }
    const cutoff = now - opts.windowMs;
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length >= max) {
      rateLimitStats.blockedTotal += 1;
      rateLimitStats.blockedByScope[opts.scope] =
        (rateLimitStats.blockedByScope[opts.scope] ?? 0) + 1;
      if (now - bucket.lastAuditAt > 60_000) {
        bucket.lastAuditAt = now;
        void writeAudit({
          event: "rate_limited",
          actorClerkId: getClerkUserId(req),
          meta: { scope: opts.scope, path: req.baseUrl + req.path },
          req,
        });
      }
      res
        .status(429)
        .json({ error: "Te veel verzoeken. Probeer het later opnieuw." });
      return;
    }
    bucket.timestamps.push(now);
    next();
  };
}
