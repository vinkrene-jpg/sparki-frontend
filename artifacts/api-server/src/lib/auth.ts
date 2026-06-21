import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function getClerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}
