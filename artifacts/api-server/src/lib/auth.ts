import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, userProfilesTable } from "@workspace/db";

// Dev auth bypass requires BOTH a non-production runtime AND an explicit opt-in
// flag. Keying off NODE_ENV alone is brittle — a misconfigured/staging
// deployment running with non-production NODE_ENV would otherwise silently grant
// access as a fallback user. The flag defaults OFF and must be set deliberately.
const IS_DEV =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_AUTH_BYPASS === "true";

// In development, requests without a real Clerk session resolve to a dev user so
// the v0 frontend can be previewed without signing in. The dev user id comes
// from DEV_AUTH_CLERK_ID, falling back to the first user_profiles row. Cached for
// the process lifetime. This branch is fully disabled in production.
let cachedDevUserId: string | null | undefined = undefined;

async function resolveDevUserId(): Promise<string | null> {
  if (cachedDevUserId !== undefined) return cachedDevUserId;
  const envId = process.env.DEV_AUTH_CLERK_ID;
  if (envId) {
    cachedDevUserId = envId;
    return cachedDevUserId;
  }
  try {
    const rows = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .orderBy(userProfilesTable.createdAt, userProfilesTable.clerkId)
      .limit(1);
    cachedDevUserId = rows[0]?.clerkId ?? null;
  } catch {
    cachedDevUserId = null;
  }
  return cachedDevUserId;
}

// Dev-only middleware: attaches a resolved dev user id to the request when there
// is no real Clerk session. Registered only when NODE_ENV !== "production".
export async function devAuthBypass(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!IS_DEV) return next();
  const auth = getAuth(req);
  if (auth?.userId) return next();
  const devId = await resolveDevUserId();
  if (devId) {
    (req as Request & { devClerkUserId?: string }).devClerkUserId = devId;
  }
  next();
}

function devUserId(req: Request): string | null {
  if (!IS_DEV) return null;
  return (
    (req as Request & { devClerkUserId?: string }).devClerkUserId ?? null
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId ?? devUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function getClerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? devUserId(req);
}

// True when the request carries a real Clerk session (not the dev bypass).
export function hasRealSession(req: Request): boolean {
  return Boolean(getAuth(req)?.userId);
}

// Resolves the caller's *verified* primary email straight from Clerk — the only
// trustworthy source of identity. Never trust an email from the request body for
// security decisions (e.g. account re-linking): a client could submit someone
// else's address. Returns null when there is no real session, no primary email,
// or the primary email is unverified.
export async function getClerkVerifiedEmail(req: Request): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const addresses = user.emailAddresses ?? [];
    const primary =
      addresses.find((a) => a.id === user.primaryEmailAddressId) ?? addresses[0];
    if (!primary) return null;
    return primary.verification?.status === "verified"
      ? primary.emailAddress
      : null;
  } catch {
    return null;
  }
}
