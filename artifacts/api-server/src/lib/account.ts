import { and, eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  validRoles,
  type Role,
  type UserProfile,
} from "@workspace/db";

// The provisioning + self-healing chain that makes "auth → sync → onboarding"
// one robust pipeline. Used by POST /api/auth/sync on every login and unit-
// tested in src/tests/account.ts. Kept dependency-free of Express/Clerk so the
// logic is callable and testable in isolation (identity is passed in).

export type AccountLogger = {
  warn: (o: unknown, m: string) => void;
  error: (o: unknown, m: string) => void;
};

export const silentLogger: AccountLogger = {
  warn: () => {},
  error: () => {},
};

// Reconcile a profile's roles[]/active_role against reality. ADDITIVE and
// self-healing — it never strips a role the user legitimately holds, it only:
//   • guarantees the baseline "athlete" role is always present,
//   • re-adds "coach"/"parent" when an ACCEPTED link proves the relationship
//     exists (so the role survives even if user_profiles.roles drifted),
//   • repairs active_role when it pointed outside roles[].
// Returns the (possibly updated) profile. Writes only when something changed.
export async function reconcileRoles(
  profile: UserProfile,
  log: AccountLogger,
): Promise<UserProfile> {
  const clerkId = profile.clerkId;

  const next = new Set<Role>(["athlete"]);
  for (const r of profile.roles) {
    if ((validRoles as readonly string[]).includes(r)) next.add(r as Role);
  }

  const [coachLink] = await db
    .select({ coachClerkId: coachAthleteLinksTable.coachClerkId })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, clerkId),
        eq(coachAthleteLinksTable.status, "accepted"),
      ),
    )
    .limit(1);
  if (coachLink) next.add("coach");

  const [parentLink] = await db
    .select({ parentClerkId: parentAthleteLinksTable.parentClerkId })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, clerkId),
        eq(parentAthleteLinksTable.status, "accepted"),
      ),
    )
    .limit(1);
  if (parentLink) next.add("parent");

  // Deterministic order matching validRoles (athlete, coach, parent).
  const nextRoles = validRoles.filter((r) => next.has(r));
  const activeRole = nextRoles.includes(profile.activeRole as Role)
    ? (profile.activeRole as Role)
    : "athlete";

  const rolesChanged =
    nextRoles.length !== profile.roles.length ||
    nextRoles.some((r, i) => r !== profile.roles[i]);
  const activeChanged = activeRole !== profile.activeRole;

  if (!rolesChanged && !activeChanged) return profile;

  log.warn(
    { clerkId, from: profile.roles, to: nextRoles, activeRole },
    "account: repairing role consistency",
  );
  const [updated] = await db
    .update(userProfilesTable)
    .set({ roles: nextRoles, activeRole, updatedAt: new Date() })
    .where(eq(userProfilesTable.clerkId, clerkId))
    .returning();
  return updated ?? profile;
}

// The single source of truth for "is this account ready to use". Idempotent and
// self-healing: guarantees user_profiles + athlete_profiles exist and that
// roles/active_role are consistent. Returns the ready profile, or null when the
// account cannot be provisioned safely (caller surfaces a clear error).
export async function ensureAccount(
  clerkId: string,
  email: string,
  displayName: string | null,
  log: AccountLogger,
): Promise<UserProfile | null> {
  // 1. user_profiles — create if absent.
  await db
    .insert(userProfilesTable)
    .values({
      clerkId,
      email,
      displayName: displayName ?? null,
      roles: ["athlete"],
      activeRole: "athlete",
    })
    .onConflictDoNothing();

  let [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));

  // 2. Re-link an orphaned profile to the current clerkId. Happens when the same
  // person re-creates their Clerk account (new clerkId, same verified email):
  // the email unique constraint no-ops the insert above, leaving their old row
  // pointing at the now-defunct clerkId. Safe because the email is Clerk-verified
  // and Clerk enforces unique verified emails per instance. Child rows follow via
  // ON UPDATE CASCADE. The conditional update + row-count check guards races.
  if (!profile) {
    const [byEmail] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.email, email));

    if (byEmail && byEmail.clerkId !== clerkId) {
      log.warn(
        { fromClerkId: byEmail.clerkId, toClerkId: clerkId },
        "account: re-linking profile to re-created account",
      );
      const relinked = await db
        .update(userProfilesTable)
        .set({
          clerkId,
          displayName: displayName ?? byEmail.displayName,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userProfilesTable.clerkId, byEmail.clerkId),
            eq(userProfilesTable.email, email),
          ),
        )
        .returning();

      if (relinked.length === 1) {
        [profile] = await db
          .select()
          .from(userProfilesTable)
          .where(eq(userProfilesTable.clerkId, clerkId));
      }
    }
  }

  if (!profile) {
    log.error({ clerkId }, "account: could not provision user_profile");
    return null;
  }

  // 3. athlete_profiles — create if absent (self-heals a user whose child row
  // was lost, or whose earlier sync created the parent but failed here).
  await db
    .insert(athleteProfilesTable)
    .values({ clerkId })
    .onConflictDoNothing();

  // 4. Roles / active_role consistency.
  profile = await reconcileRoles(profile, log);

  return profile;
}
