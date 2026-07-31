import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  featureFlagsTable,
  userFlagOverridesTable,
  FEATURE_KEYS,
  type FeatureKey,
  type ReleaseGroup,
} from "@workspace/db";

// Platform van de client, uit de X-Sparki-Platform header. Onbekend ⇒ "web"
// (het bestaande gedrag; mobiel stuurt de header expliciet mee).
export type ClientPlatform = "web" | "mobiel";

export function parsePlatform(header: string | undefined | null): ClientPlatform {
  return header === "mobiel" ? "mobiel" : "web";
}

/**
 * Deterministische uitrol-bucket 0..99 voor (clerkId, flagKey).
 * Zelfde gebruiker + zelfde flag ⇒ altijd dezelfde bucket, zodat een
 * percentage-uitrol stabiel is (niemand "flippert" tussen aan en uit).
 */
export function rolloutBucket(clerkId: string, flagKey: string): number {
  const h = createHash("sha256").update(`${clerkId}:${flagKey}`).digest();
  return h.readUInt32BE(0) % 100;
}

/**
 * Resolve all feature flags for a user.
 *
 * Precedence (highest → lowest):
 *   1. User-level override   (user_flag_overrides row) — negeert platform/percentage
 *   2. Platformpoort         (flag.enabledPlatforms niet-leeg en platform ontbreekt ⇒ uit)
 *   3. Rol / releasegroep / globaal — elk van deze zet de flag aan, MAAR alleen
 *      binnen het uitrolpercentage (deterministische bucket per gebruiker+flag).
 *   4. Head-tester early access — geregistreerde maar nog niet vrijgegeven flags
 *      gaan voor hoofdtesters vast aan (kill-switch = override false, stap 1).
 *   5. false
 */
export async function resolveFlags(
  clerkId: string,
  activeRole: string,
  opts: {
    isHeadTester?: boolean;
    releaseGroup?: ReleaseGroup;
    platform?: ClientPlatform;
  } = {},
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
  const platform = opts.platform ?? "web";
  const group = opts.releaseGroup ?? "productie";

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
    // Platformpoort: expliciete platformlijst zonder dit platform ⇒ uit.
    if (flag.enabledPlatforms.length > 0 && !flag.enabledPlatforms.includes(platform)) {
      result[key] = false;
      continue;
    }
    const pct = Math.max(0, Math.min(100, flag.rolloutPercentage ?? 100));
    const inRollout = rolloutBucket(clerkId, key) < pct;
    const granted =
      flag.enabledRoles.includes(activeRole) ||
      flag.enabledGroups.includes(group) ||
      flag.enabledGlobally;
    if (granted) {
      result[key] = inRollout;
      continue;
    }
    // Head-tester early access: geregistreerde flags die nog niet zijn
    // vrijgegeven staan voor de Hoofdtester vast aan (geen percentage —
    // vroege toegang is het hele punt).
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
  // WP-S1 (31-07-2026): GEEN dev-bypass meer. De vroegere bypass maakte élke
  // geïmpersoneerde identiteit admin, waardoor dev-/testbewijs over rollen en
  // rechten ongeldig was. Admin is nu altijd strikt: alleen clerkIds in
  // SPARKI_ADMIN_IDS. Wil je in dev het adminpaneel zien, zet dan de
  // geïmpersoneerde (seed-)clerkId expliciet in SPARKI_ADMIN_IDS.
  const raw = process.env.SPARKI_ADMIN_IDS ?? "";
  if (!raw.trim()) return false;
  return raw.split(",").map((s) => s.trim()).includes(clerkId);
}
