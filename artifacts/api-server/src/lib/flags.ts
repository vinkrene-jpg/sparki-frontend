import { eq } from "drizzle-orm";
import {
  db,
  featureFlagsTable,
  userFlagOverridesTable,
  FEATURE_KEYS,
  type FeatureKey,
} from "@workspace/db";

/**
 * Resolve all feature flags for a user.
 *
 * Precedence (highest → lowest):
 *   1. User-level override   (user_flag_overrides row)
 *   2. Role match            (flag.enabledRoles includes activeRole)
 *   3. Global default        (flag.enabledGlobally)
 *   4. Head-tester early access — for flags that EXIST (have a row) but aren't yet
 *      enabled by role or globally, head testers get them early (true). This is the
 *      whole point of the Hoofdtester: in-test features turn on for them before
 *      everyone else. The kill-switch is a user-level override (step 1, highest
 *      precedence): set an override=false for that tester to hide a flag from them.
 *      Flags with NO row are not real features → they stay false even for head
 *      testers (we never enable something that isn't registered).
 *   5. false
 */
export async function resolveFlags(
  clerkId: string,
  activeRole: string,
  opts: { isHeadTester?: boolean } = {},
): Promise<Record<FeatureKey, boolean>> {
  const [flags, overrides] = await Promise.all([
    db.select().from(featureFlagsTable),
    db
      .select()
      .from(userFlagOverridesTable)
      .where(eq(userFlagOverridesTable.clerkId, clerkId)),
  ]);

  const overrideMap = new Map<string, boolean>(
    overrides.map((o) => [o.flagKey, o.enabled]),
  );

  const result = {} as Record<FeatureKey, boolean>;

  for (const key of FEATURE_KEYS) {
    if (overrideMap.has(key)) {
      result[key] = overrideMap.get(key)!;
      continue;
    }
    const flag = flags.find((f) => f.key === key);
    if (!flag) {
      result[key] = false;
      continue;
    }
    if (flag.enabledRoles.includes(activeRole)) {
      result[key] = true;
      continue;
    }
    if (flag.enabledGlobally) {
      result[key] = true;
      continue;
    }
    // Head-tester early access: anything not explicitly off (override) and not
    // yet globally/role-enabled still turns ON for the Hoofdtester.
    result[key] = opts.isHeadTester === true;
  }

  return result;
}

/**
 * Returns true if the admin env var is set and includes this clerkId.
 * Used to guard /api/flags/admin/* endpoints.
 * Bootstrap: set SPARKI_ADMIN_IDS=clerk_xxxxx,clerk_yyyyy in Replit Secrets.
 */
export function isAdmin(clerkId: string): boolean {
  // Development Preview Mode: when the dev auth bypass is active the resolved dev
  // user previews production components (incl. the admin dashboard). Fails closed
  // in production — requires BOTH NODE_ENV !== "production" AND DEV_AUTH_BYPASS.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "true"
  ) {
    return true;
  }
  const raw = process.env.SPARKI_ADMIN_IDS ?? "";
  if (!raw.trim()) return false;
  return raw.split(",").map((s) => s.trim()).includes(clerkId);
}
