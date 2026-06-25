// Founding Athlete program + Hoofdtester ("head tester") running joke.
//
// Founding number: a stable sequential badge assigned exactly once, the first
// time onboarding V2 completes. Assignment is atomic and idempotent — a retry
// returns the same number, and concurrent first-completions never collide
// (the UNIQUE constraint on founding_number is the backstop; we retry on it).

import { eq, sql } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";

// Postgres unique-violation SQLSTATE.
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Assign (or return the existing) Founding Athlete number for an athlete.
 * Idempotent: if one is already set, it is returned unchanged.
 */
export async function assignFoundingNumber(clerkId: string): Promise<number> {
  const [existing] = await db
    .select({ n: userProfilesTable.foundingNumber })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (existing?.n != null) return existing.n;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Single statement: compute MAX+1 and claim it only if still unassigned.
      const result = await db.execute<{ founding_number: number }>(sql`
        UPDATE user_profiles
        SET founding_number = (
              SELECT COALESCE(MAX(founding_number), 0) + 1 FROM user_profiles
            ),
            updated_at = now()
        WHERE clerk_id = ${clerkId} AND founding_number IS NULL
        RETURNING founding_number
      `);
      const claimed = result.rows?.[0]?.founding_number;
      if (claimed != null) return Number(claimed);

      // 0 rows updated → another request assigned it concurrently; re-read.
      const [row] = await db
        .select({ n: userProfilesTable.foundingNumber })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, clerkId));
      if (row?.n != null) return row.n;
    } catch (err) {
      if (isUniqueViolation(err)) continue; // lost the MAX+1 race — retry fresh
      throw err;
    }
  }
  throw new Error("Kon geen Founding Athlete-nummer toewijzen.");
}

/** Zero-padded badge label, e.g. 1 → "Founding Athlete #001". */
export function foundingLabel(n: number): string {
  return `Founding Athlete #${String(n).padStart(3, "0")}`;
}

/**
 * Assign (or return the existing) Head Tester number for a user. Mirrors
 * {@link assignFoundingNumber}: idempotent, atomic MAX+1, retries on the unique
 * constraint when two first-accepts race. Called when a head-tester invite is
 * accepted.
 */
export async function assignHeadTesterNumber(clerkId: string): Promise<number> {
  const [existing] = await db
    .select({ n: userProfilesTable.headTesterNumber })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (existing?.n != null) return existing.n;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await db.execute<{ head_tester_number: number }>(sql`
        UPDATE user_profiles
        SET head_tester_number = (
              SELECT COALESCE(MAX(head_tester_number), 0) + 1 FROM user_profiles
            ),
            updated_at = now()
        WHERE clerk_id = ${clerkId} AND head_tester_number IS NULL
        RETURNING head_tester_number
      `);
      const claimed = result.rows?.[0]?.head_tester_number;
      if (claimed != null) return Number(claimed);

      const [row] = await db
        .select({ n: userProfilesTable.headTesterNumber })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, clerkId));
      if (row?.n != null) return row.n;
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new Error("Kon geen Hoofdtester-nummer toewijzen.");
}

/** Zero-padded badge label, e.g. 1 → "Head Tester #001". */
export function headTesterLabel(n: number): string {
  return `Head Tester #${String(n).padStart(3, "0")}`;
}

/** The three-line founding badge copy (verbatim brief). */
export const FOUNDING_LINES = [
  "Klinkt belangrijk.",
  "Is het waarschijnlijk ook.",
  "Vraag me over een paar maanden nog eens.",
] as const;

/** Rotating Hoofdtester joke lines (verbatim brief). */
export const HEAD_TESTER_LINES = [
  "Mijn grootste bron van bugs is online.",
  "Nieuwe functie beschikbaar. Vertrouwen: 62%.",
  "Bedankt voor je feedback. Mijn reputatie heeft opnieuw schade opgelopen.",
  "Jij test mij. Ik test jou. We noemen het samenwerking.",
] as const;

/** Deterministic day-rotating tester line so it changes day to day, stably. */
export function headTesterLine(now: Date = new Date()): string {
  const dayOfYear = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), 0, 0)) /
      (1000 * 60 * 60 * 24),
  );
  return HEAD_TESTER_LINES[dayOfYear % HEAD_TESTER_LINES.length]!;
}
