// Entitlement-fundament — regressietest.
//
// Bewijst de kernbeloften van de commerciële rechtenlaag:
//   1. Bestaande gebruiker = legacy_unrestricted, variant NULL — toegang
//      exact zoals vóór entitlements (flag aan ⇒ toegang; flag uit ⇒ geen).
//   2. Lege entitlementtabellen veranderen niets aan legacy-toegang.
//   3. subscription is fail-closed: geen recht ⇒ geen toegang, óók als de
//      operationele flag aan staat.
//   4. Persoonlijk recht (permanent_addon) geeft subscription-gebruiker
//      commerciële toegang; flag blijft daarnaast bepalend.
//   5. Tijdelijk recht met verlopen einddatum geeft géén toegang.
//   6. Ingetrokken recht geeft géén toegang.
//   7. GET /api/entitlements toont alleen eigen rechten (auth vereist).
//   8. Adminbeheer: moduswissel + toekennen + intrekken werken en schrijven
//      auditregels; niet-admin krijgt 403.
//   9. subscription zonder variant wordt geweigerd (400).
//
// Run: `pnpm --filter @workspace/api-server run test:entitlements`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  userEntitlementsTable,
  variantFeatureGrantsTable,
  featureFlagsTable,
  securityAuditLogTable,
} from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  resolveFeatureAccess,
  resolveEntitlements,
  hasCommercialFeature,
  ensureGoVariantGrantSeed,
  GO_FEATURE_KEYS,
} from "../lib/entitlements";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("failed to determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

const RUN = `test_entl_${Date.now()}`;
const legacyUser = `${RUN}_legacy`;
const subUser = `${RUN}_sub`;
const adminUser = `${RUN}_admin`;
const ALL = [legacyUser, subUser, adminUser];

// Testflag: bestaande key die we tijdelijk globaal aanzetten en herstellen.
const FLAG = "route_planner";
let savedFlag: { enabledGlobally: boolean; enabledRoles: string[] } | null =
  null;
let flagExisted = false;

async function setFlagGlobal(enabled: boolean) {
  const [row] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, FLAG));
  if (row) {
    if (!flagExisted) {
      flagExisted = true;
      savedFlag = {
        enabledGlobally: row.enabledGlobally,
        enabledRoles: row.enabledRoles,
      };
    }
    await db
      .update(featureFlagsTable)
      .set({ enabledGlobally: enabled, enabledRoles: [] })
      .where(eq(featureFlagsTable.key, FLAG));
  } else {
    flagExisted = false;
    await db
      .insert(featureFlagsTable)
      .values({ key: FLAG, enabledGlobally: enabled });
  }
}

async function restoreFlag() {
  if (flagExisted && savedFlag) {
    await db
      .update(featureFlagsTable)
      .set(savedFlag)
      .where(eq(featureFlagsTable.key, FLAG));
  }
}

async function apiReq(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-dev-clerk-id": actor,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

async function cleanup() {
  await restoreFlag().catch(() => {});
  await db
    .delete(userEntitlementsTable)
    .where(inArray(userEntitlementsTable.clerkId, ALL))
    .catch(() => {});
  for (const c of ALL) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function main() {
  // Admin is sinds WP-S1 strikt (geen dev-bypass): de testadmin moet expliciet
  // in SPARKI_ADMIN_IDS staan. In-process server leest de env per aanroep;
  // we herstellen de oorspronkelijke waarde na afloop.
  const savedAdminIds = process.env.SPARKI_ADMIN_IDS;
  process.env.SPARKI_ADMIN_IDS = [savedAdminIds, adminUser]
    .filter(Boolean)
    .join(",");
  process.once("exit", () => {
    if (savedAdminIds === undefined) delete process.env.SPARKI_ADMIN_IDS;
    else process.env.SPARKI_ADMIN_IDS = savedAdminIds;
  });
  await startServer();

  await ensureAccount(legacyUser, `${legacyUser}@example.test`, "Legacy", silentLogger);
  await ensureAccount(subUser, `${subUser}@example.test`, "Abonnee", silentLogger);
  await ensureAccount(adminUser, `${adminUser}@example.test`, "Beheer", silentLogger);

  await scenario("nieuwe accounts starten als legacy_unrestricted, variant NULL", async () => {
    const rows = await db
      .select({
        mode: userProfilesTable.entitlementMode,
        variant: userProfilesTable.productVariant,
      })
      .from(userProfilesTable)
      .where(inArray(userProfilesTable.clerkId, ALL));
    assert(rows.length === 3, "verwacht 3 profielen");
    for (const r of rows) {
      assert(r.mode === "legacy_unrestricted", `mode was ${r.mode}`);
      assert(r.variant === null, `variant was ${r.variant}`);
    }
  });

  // Taak 385: de Go-verdeling is een bewust productbesluit — sparki_go krijgt
  // de vier Go-onderdelen, sparki_basic niets. Seed is idempotent.
  await ensureGoVariantGrantSeed();
  await ensureGoVariantGrantSeed(); // tweede aanroep mag niets veranderen

  await scenario("variant_feature_grants: sparki_go én sparki_pro (Compleet) = de vier Go-onderdelen; interne tiers = niets", async () => {
    const rows = await db.select().from(variantFeatureGrantsTable);
    for (const variant of ["sparki_go", "sparki_pro"] as const) {
      const v = rows.filter((r) => r.productVariant === variant && r.enabled);
      assert(
        v.length === GO_FEATURE_KEYS.length,
        `verwacht ${GO_FEATURE_KEYS.length} ${variant}-rijen, kreeg ${v.length}`,
      );
      for (const key of GO_FEATURE_KEYS) {
        assert(v.some((r) => r.featureKey === key), `${variant} mist ${key}`);
      }
    }
    const basic = rows.filter((r) => r.productVariant === "sparki_basic");
    const perf = rows.filter((r) => r.productVariant === "sparki_performance");
    assert(basic.length === 0, `sparki_basic (interne tier) moet leeg zijn, kreeg ${basic.length}`);
    assert(perf.length === 0, `sparki_performance (interne tier) moet leeg zijn, kreeg ${perf.length}`);
  });

  // ── Legacy-gedrag: flags blijven exact bepalend ────────────────────────────
  await setFlagGlobal(true);
  await scenario("legacy + flag AAN ⇒ toegang (gedrag ongewijzigd)", async () => {
    const a = await resolveFeatureAccess(
      { clerkId: legacyUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.allowed === true, `allowed was false: ${a.reason}`);
    assert(a.commercial_entitled === true, "commercieel recht ontbrak");
    assert(a.source === "legacy_unrestricted", `source was ${a.source}`);
    assert(a.entitlement_mode === "legacy_unrestricted", "mode fout");
  });

  await setFlagGlobal(false);
  await scenario("legacy + flag UIT ⇒ geen toegang (flag blijft bepalend)", async () => {
    const a = await resolveFeatureAccess(
      { clerkId: legacyUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.allowed === false, "allowed was true");
    assert(a.commercial_entitled === true, "commercieel recht moet true blijven");
    assert(a.operationally_enabled === false, "flag moest uit staan");
  });

  // ── Subscription: fail-closed ──────────────────────────────────────────────
  await setFlagGlobal(true);

  await scenario("admin: subscription zonder variant wordt geweigerd (400)", async () => {
    const r = await apiReq("PUT", `/api/admin/entitlements/${subUser}/mode`, adminUser, {
      entitlementMode: "subscription",
      productVariant: null,
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  await scenario("admin: moduswissel naar subscription + sparki_go slaagt en wordt geauditeerd", async () => {
    const r = await apiReq("PUT", `/api/admin/entitlements/${subUser}/mode`, adminUser, {
      entitlementMode: "subscription",
      productVariant: "sparki_go",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const [audit] = await db
      .select()
      .from(securityAuditLogTable)
      .where(
        and(
          eq(securityAuditLogTable.event, "entitlement_mode_changed"),
          eq(securityAuditLogTable.subjectClerkId, subUser),
        ),
      )
      .orderBy(desc(securityAuditLogTable.id))
      .limit(1);
    assert(!!audit, "auditregel entitlement_mode_changed ontbreekt");
  });

  await scenario("subscription zonder recht ⇒ fail-closed, óók met flag AAN", async () => {
    const a = await resolveFeatureAccess(
      { clerkId: subUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.operationally_enabled === true, "flag moest aan staan");
    assert(a.commercial_entitled === false, "commercieel recht moest false zijn");
    assert(a.allowed === false, "allowed moest false zijn");
    assert(a.reason === "geen commercieel recht", `reason was ${a.reason}`);
  });

  let grantedId = 0;
  await scenario("admin: permanent recht toekennen ⇒ toegang + auditregel", async () => {
    const r = await apiReq("POST", `/api/admin/entitlements/${subUser}`, adminUser, {
      entitlementKey: FLAG,
      entitlementType: "permanent_addon",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    grantedId = r.json?.entitlement?.id;
    assert(grantedId > 0, "geen entitlement-id terug");
    const a = await resolveFeatureAccess(
      { clerkId: subUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.allowed === true, `allowed was false: ${a.reason}`);
    assert(a.source.startsWith("entitlement:permanent_addon"), `source was ${a.source}`);
    const [audit] = await db
      .select()
      .from(securityAuditLogTable)
      .where(
        and(
          eq(securityAuditLogTable.event, "entitlement_granted"),
          eq(securityAuditLogTable.subjectClerkId, subUser),
        ),
      )
      .limit(1);
    assert(!!audit, "auditregel entitlement_granted ontbreekt");
  });

  await scenario("recht met flag UIT ⇒ geen toegang (operationele laag blijft apart)", async () => {
    await setFlagGlobal(false);
    const a = await resolveFeatureAccess(
      { clerkId: subUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.commercial_entitled === true, "commercieel recht moest blijven");
    assert(a.allowed === false, "allowed moest false zijn (flag uit)");
    await setFlagGlobal(true);
  });

  await scenario("admin: recht intrekken ⇒ fail-closed + auditregel", async () => {
    const r = await apiReq(
      "POST",
      `/api/admin/entitlements/${subUser}/${grantedId}/revoke`,
      adminUser,
    );
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const a = await resolveFeatureAccess(
      { clerkId: subUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.allowed === false, "allowed moest false zijn na intrekken");
    const [audit] = await db
      .select()
      .from(securityAuditLogTable)
      .where(
        and(
          eq(securityAuditLogTable.event, "entitlement_revoked"),
          eq(securityAuditLogTable.subjectClerkId, subUser),
        ),
      )
      .limit(1);
    assert(!!audit, "auditregel entitlement_revoked ontbreekt");
  });

  await scenario("verlopen tijdelijk recht geeft géén toegang", async () => {
    const past = new Date(Date.now() - 24 * 3600 * 1000);
    await db.insert(userEntitlementsTable).values({
      clerkId: subUser,
      entitlementKey: FLAG,
      entitlementType: "trial",
      status: "active",
      source: "test",
      endsAt: past,
    });
    const a = await resolveFeatureAccess(
      { clerkId: subUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.commercial_entitled === false, "verlopen recht mag niet tellen");
    assert(a.allowed === false, "allowed moest false zijn");
  });

  await scenario("GET /api/entitlements toont alleen eigen rechten", async () => {
    const own = await apiReq("GET", "/api/entitlements", subUser);
    assert(own.status === 200, `verwacht 200, kreeg ${own.status}`);
    assert(own.json.entitlement_mode === "subscription", "mode fout");
    assert(own.json.product_variant === "sparki_go", "variant fout");
    const other = await apiReq("GET", "/api/entitlements", legacyUser);
    assert(other.status === 200, `verwacht 200, kreeg ${other.status}`);
    assert(other.json.entitlement_mode === "legacy_unrestricted", "legacy-mode fout");
    assert(
      (other.json.active_entitlements ?? []).length === 0,
      "legacy-gebruiker mag geen rechten van een ander zien",
    );
  });

  await scenario("niet-admin krijgt 403 op adminbeheer (productiepad)", async () => {
    // isAdmin leest DEV_AUTH_BYPASS per aanroep; de dev-auth-middleware is al
    // gemount (gecachte IS_DEV). Env-flip test het echte 403-pad zonder
    // SPARKI_ADMIN_IDS.
    const saved = process.env.DEV_AUTH_BYPASS;
    process.env.DEV_AUTH_BYPASS = "false";
    try {
      const r = await apiReq("GET", "/api/admin/entitlements/users", subUser);
      assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
      const w = await apiReq(
        "PUT",
        `/api/admin/entitlements/${subUser}/mode`,
        subUser,
        { entitlementMode: "legacy_unrestricted" },
      );
      assert(w.status === 403, `verwacht 403 op schrijven, kreeg ${w.status}`);
    } finally {
      process.env.DEV_AUTH_BYPASS = saved;
    }
  });

  await scenario("onbekende modus resolvet fail-closed naar subscription zonder rechten", async () => {
    // Corrupte/onbekende moduswaarde mag nooit ontgrendelen.
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "kapotte_waarde", productVariant: "onzin" })
      .where(eq(userProfilesTable.clerkId, subUser));
    const a = await resolveFeatureAccess(
      { clerkId: subUser, activeRole: "athlete" },
      FLAG,
    );
    assert(a.entitlement_mode === "subscription", `mode was ${a.entitlement_mode}`);
    assert(a.variant === null, "onbekende variant moet null resolven");
    assert(a.allowed === false, "onbekende modus mag nooit toegang geven");
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "subscription", productVariant: "sparki_go" })
      .where(eq(userProfilesTable.clerkId, subUser));
  });

  await scenario("onbekende gebruiker resolvet fail-closed zonder rechten", async () => {
    const a = await resolveFeatureAccess(
      { clerkId: `${RUN}_bestaat_niet`, activeRole: "athlete" },
      FLAG,
    );
    assert(a.entitlement_mode === "subscription", "onbekend account moet subscription zijn");
    assert(a.commercial_entitled === false, "onbekend account mag geen recht hebben");
    assert(a.allowed === false, "onbekend account mag geen toegang hebben");
  });

  await scenario("legacy-gebruiker blijft ongewijzigd na alle beheeracties", async () => {
    const [row] = await db
      .select({
        mode: userProfilesTable.entitlementMode,
        variant: userProfilesTable.productVariant,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, legacyUser));
    assert(row.mode === "legacy_unrestricted", `mode was ${row.mode}`);
    assert(row.variant === null, `variant was ${row.variant}`);
    const grants = await db.select().from(variantFeatureGrantsTable);
    const basic = grants.filter((g) => g.productVariant === "sparki_basic");
    assert(basic.length === 0, "sparki_basic moet leeg blijven");
  });

  // ── Taak 385: Gratis vs Go zichtbaar — Go-onderdelen + routepoorten ────────
  await scenario("sparki_go-abonnee heeft commercieel recht op de vier Go-onderdelen", async () => {
    const resolved = await resolveEntitlements(subUser); // subscription + sparki_go
    for (const key of GO_FEATURE_KEYS) {
      assert(hasCommercialFeature(resolved, key), `go mist recht op ${key}`);
      assert(
        resolved.commercialFeatures[key]?.source === "variant:sparki_go",
        `source van ${key} was ${resolved.commercialFeatures[key]?.source}`,
      );
    }
    // Niet-Go-onderdelen blijven zonder recht (fail-closed).
    assert(!hasCommercialFeature(resolved, "route_planner"), "route_planner mag geen variantrecht zijn");
  });

  await scenario("sparki_basic-abonnee heeft géén Go-rechten; legacy alles", async () => {
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_basic" })
      .where(eq(userProfilesTable.clerkId, subUser));
    const basic = await resolveEntitlements(subUser);
    for (const key of GO_FEATURE_KEYS) {
      assert(!hasCommercialFeature(basic, key), `basic mag ${key} niet hebben`);
    }
    const legacy = await resolveEntitlements(legacyUser);
    for (const key of GO_FEATURE_KEYS) {
      assert(hasCommercialFeature(legacy, key), `legacy moet ${key} behouden`);
    }
  });

  await scenario("Go-routes zijn fail-closed voor basic (403 upgrade_required), open voor go en legacy", async () => {
    // subUser staat nu op sparki_basic.
    const paths = [
      ["GET", "/api/training-plan"],
      ["GET", "/api/races/insight"],
      ["GET", "/api/open-loops"],
      ["GET", "/api/coach/analysis"],
      ["GET", "/api/ai/observations"],
    ] as const;
    for (const [method, path] of paths) {
      const r = await apiReq(method, path, subUser);
      assert(r.status === 403, `${path}: verwacht 403 voor basic, kreeg ${r.status}`);
      assert(r.json?.code === "upgrade_required", `${path}: code was ${r.json?.code}`);
    }
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_go" })
      .where(eq(userProfilesTable.clerkId, subUser));
    for (const [method, path] of paths) {
      const r = await apiReq(method, path, subUser);
      assert(r.status !== 403, `${path}: go-abonnee kreeg onterecht 403`);
      const l = await apiReq(method, path, legacyUser);
      assert(l.status !== 403, `${path}: legacy kreeg onterecht 403`);
    }
  });

  await cleanup();
  await stopServer();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testrun crashte:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
