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
 *   1. User-level override  (user_flag_overrides row)
 *   2. Role match           (flag.enabledRoles includes activeRole)
 *   3. Global default       (flag.enabledGlobally)
 *   4. false
 */
export async function resolveFlags(
  clerkId: string,
  activeRole: string,
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
    result[key] = flag.enabledGlobally;
  }

  return result;
}

/**
 * Returns true if the admin env var is set and includes this clerkId.
 * Used to guard /api/flags/admin/* endpoints.
 * Bootstrap: set SPARKI_ADMIN_IDS=clerk_xxxxx,clerk_yyyyy in Replit Secrets.
 */
export function isAdmin(clerkId: string): boolean {
  const raw = process.env.SPARKI_ADMIN_IDS ?? "";
  if (!raw.trim()) return false;
  return raw.split(",").map((s) => s.trim()).includes(clerkId);
}
