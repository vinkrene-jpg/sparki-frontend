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
  routesTable,
  racesTable,
  racePointsTable,
  documentAnalysesTable,
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
  COMPLEET_FEATURE_KEYS,
  VARIANT_FEATURE_KEYS,
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

  // Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-001): Compleet (sparki_pro)
  // krijgt de vier Compleet-sleutels; sparki_go alleen de (nu nog lege)
  // Go-verzameling. De seed migreert oude sparki_go-rijen weg en is idempotent.
  await ensureGoVariantGrantSeed();
  await ensureGoVariantGrantSeed(); // tweede aanroep mag niets veranderen

  await scenario("variant_feature_grants: sparki_pro (Compleet) = Go+Compleet-sleutels; sparki_go = alleen Go-sleutels; interne tiers = niets", async () => {
    const rows = await db.select().from(variantFeatureGrantsTable);
    const pro = rows.filter((r) => r.productVariant === "sparki_pro" && r.enabled);
    assert(
      pro.length === VARIANT_FEATURE_KEYS.sparki_pro.length,
      `verwacht ${VARIANT_FEATURE_KEYS.sparki_pro.length} sparki_pro-rijen, kreeg ${pro.length}`,
    );
    for (const key of VARIANT_FEATURE_KEYS.sparki_pro) {
      assert(pro.some((r) => r.featureKey === key), `sparki_pro mist ${key}`);
    }
    // Besluit 31-07-2026: de vier Compleet-sleutels zijn bij sparki_go
    // weggemigreerd; sparki_go heeft uitsluitend zijn eigen Go-sleutels.
    const go = rows.filter((r) => r.productVariant === "sparki_go");
    for (const key of COMPLEET_FEATURE_KEYS) {
      if (!VARIANT_FEATURE_KEYS.sparki_go.includes(key)) {
        assert(!go.some((r) => r.featureKey === key), `sparki_go mag ${key} niet meer hebben (gemigreerd)`);
      }
    }
    assert(
      go.length === VARIANT_FEATURE_KEYS.sparki_go.length,
      `verwacht ${VARIANT_FEATURE_KEYS.sparki_go.length} sparki_go-rijen, kreeg ${go.length}`,
    );
    const basic = rows.filter((r) => r.productVariant === "sparki_basic");
    const perf = rows.filter((r) => r.productVariant === "sparki_performance");
    assert(basic.length === 0, `sparki_basic (interne tier) moet leeg zijn, kreeg ${basic.length}`);
    assert(perf.length === 0, `sparki_performance (interne tier) moet leeg zijn, kreeg ${perf.length}`);
  });

  await scenario("superset-invariant: Compleet bezit élke Go-sleutel (Besluit 31-07-2026)", async () => {
    for (const key of GO_FEATURE_KEYS) {
      assert(
        VARIANT_FEATURE_KEYS.sparki_pro.includes(key),
        `Compleet mist Go-sleutel ${key} — superset-invariant geschonden`,
      );
    }
    // Ook in de database zelf: elke enabled sparki_go-rij bestaat als sparki_pro-rij.
    const rows = await db.select().from(variantFeatureGrantsTable);
    const proKeys = new Set(
      rows.filter((r) => r.productVariant === "sparki_pro" && r.enabled).map((r) => r.featureKey),
    );
    for (const r of rows.filter((x) => x.productVariant === "sparki_go" && x.enabled)) {
      assert(proKeys.has(r.featureKey), `DB: Compleet mist Go-sleutel ${r.featureKey}`);
    }
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
    assert(own.json.product_label === "Sparki Go", "klantlabel fout");
    assert(!("product_variant" in own.json), "interne variantnaam mag niet in het klantantwoord");
    assert(
      !JSON.stringify(own.json).match(/sparki_(basic|performance|pro|go)/),
      "interne tiernaam lekt in het klantantwoord",
    );
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

  // ── Besluit 31-07-2026 (was taak 385): Go ≠ Compleet — rechten + poorten ───
  // Omgezet per Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-001): de vier
  // onderdelen zijn nu Compleet-only; sparki_go heeft ze NIET meer. Dit is een
  // bewuste omzetting van het oude besluit (taak 385), geen reparatie.
  await scenario("sparki_go-abonnee heeft GEEN recht meer op de vier Compleet-onderdelen; Compleet wél", async () => {
    const goResolved = await resolveEntitlements(subUser); // subscription + sparki_go
    for (const key of COMPLEET_FEATURE_KEYS) {
      assert(!hasCommercialFeature(goResolved, key), `go mag ${key} niet meer hebben (Compleet-only)`);
    }
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_pro" })
      .where(eq(userProfilesTable.clerkId, subUser));
    const compleet = await resolveEntitlements(subUser);
    for (const key of COMPLEET_FEATURE_KEYS) {
      assert(hasCommercialFeature(compleet, key), `Compleet mist recht op ${key}`);
      assert(
        compleet.commercialFeatures[key]?.source === "variant:sparki_pro",
        `source van ${key} was ${compleet.commercialFeatures[key]?.source}`,
      );
    }
    // Niet-toegekende onderdelen blijven zonder recht (fail-closed).
    // Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-002): route plannen/
    // genereren blijft GRATIS — route_planner wordt dus bewust GEEN
    // variantrecht (afwijking van het oorspronkelijke opdrachtdocument,
    // dat r464 wilde omzetten; René's definitieve grenslijst gaat voor).
    assert(!hasCommercialFeature(compleet, "route_planner"), "route_planner mag geen variantrecht zijn");
    // Terug naar sparki_go voor de vervolgscenario's.
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_go" })
      .where(eq(userProfilesTable.clerkId, subUser));
  });

  await scenario("sparki_basic-abonnee heeft géén Compleet-rechten; legacy alles", async () => {
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_basic" })
      .where(eq(userProfilesTable.clerkId, subUser));
    const basic = await resolveEntitlements(subUser);
    for (const key of COMPLEET_FEATURE_KEYS) {
      assert(!hasCommercialFeature(basic, key), `basic mag ${key} niet hebben`);
    }
    const legacy = await resolveEntitlements(legacyUser);
    for (const key of COMPLEET_FEATURE_KEYS) {
      assert(hasCommercialFeature(legacy, key), `legacy moet ${key} behouden`);
    }
  });

  await scenario("Compleet-routes zijn fail-closed voor basic én go (403 upgrade_required), open voor Compleet en legacy", async () => {
    // subUser staat nu op sparki_basic. Besluit 31-07-2026: ook sparki_go
    // heeft geen recht meer op deze onderdelen — alleen Compleet en legacy.
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
      assert(r.status === 403, `${path}: go-abonnee moet nu 403 krijgen (Compleet-only), kreeg ${r.status}`);
      assert(r.json?.code === "upgrade_required", `${path}: code was ${r.json?.code}`);
    }
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_pro" })
      .where(eq(userProfilesTable.clerkId, subUser));
    for (const [method, path] of paths) {
      const r = await apiReq(method, path, subUser);
      assert(r.status !== 403, `${path}: Compleet-abonnee kreeg onterecht 403`);
      const l = await apiReq(method, path, legacyUser);
      assert(l.status !== 403, `${path}: legacy kreeg onterecht 403`);
    }
  });

  // ── Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-002): poorten op routes ──
  // Go = bibliotheek-beheer-extra's (route_library_manage); Compleet = course
  // points (route_course_points) en live vrienden/ploeg (live_friends_map).
  // Gratis basis (opslaan, simpele lijst, openen, verwijderen, plannen,
  // GPX/TCX, navigatie) blijft bewust ongepoort.
  await scenario("Besluit 2026-002: bibliotheek-extra's 403 zonder Go; gratis basis blijft open", async () => {
    // subUser staat op sparki_pro na het vorige scenario ⇒ eerst naar een
    // recht-loze variant (gedraagt zich als Gratis: geen variantrechten).
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_basic" })
      .where(eq(userProfilesTable.clerkId, subUser));
    const extras = [
      ["GET", "/api/routes?sort=afstand"],
      ["GET", "/api/routes?q=test"],
      ["GET", "/api/routes?scope=favoriet"],
      ["POST", "/api/routes/zoek"],
      ["PUT", "/api/routes/999999"],
      ["POST", "/api/routes/999999/duplicate"],
      ["POST", "/api/routes/from-activity"],
    ] as const;
    for (const [method, path] of extras) {
      const r = await apiReq(method, path, subUser, method === "GET" ? undefined : {});
      assert(r.status === 403, `${method} ${path}: verwacht 403 zonder Go, kreeg ${r.status}`);
      assert(r.json?.code === "upgrade_required", `${path}: code was ${r.json?.code}`);
      assert(r.json?.feature === "route_library_manage", `${path}: feature was ${r.json?.feature}`);
    }
    // Gratis basis blijft open: simpele lijst (nieuwste eerst) en verwijderen.
    const lijst = await apiReq("GET", "/api/routes", subUser);
    assert(lijst.status === 200, `simpele lijst moet gratis blijven, kreeg ${lijst.status}`);
    const del = await apiReq("DELETE", "/api/routes/999999", subUser);
    assert(del.status !== 403, `verwijderen moet gratis blijven, kreeg 403`);
  });

  await scenario("Besluit 2026-002: bibliotheek-extra's open voor Go, Compleet en legacy", async () => {
    for (const variant of ["sparki_go", "sparki_pro"] as const) {
      await db
        .update(userProfilesTable)
        .set({ productVariant: variant })
        .where(eq(userProfilesTable.clerkId, subUser));
      const r = await apiReq("GET", "/api/routes?sort=afstand&scope=favoriet&q=x", subUser);
      assert(r.status === 200, `${variant}: extras-lijst verwacht 200, kreeg ${r.status}`);
      // Achterliggende validatie neemt het over (400/404 = poort gepasseerd).
      const zoek = await apiReq("POST", "/api/routes/zoek", subUser, {});
      assert(zoek.status === 400, `${variant}: zoek verwacht 400 (poort voorbij), kreeg ${zoek.status}`);
      const dup = await apiReq("POST", "/api/routes/999999/duplicate", subUser, {});
      assert(dup.status === 404, `${variant}: duplicate verwacht 404 (poort voorbij), kreeg ${dup.status}`);
    }
    const l = await apiReq("GET", "/api/routes?sort=afstand", legacyUser);
    assert(l.status === 200, `legacy: verwacht 200, kreeg ${l.status}`);
  });

  await scenario("Besluit 2026-002: course points & live-kaart zijn Compleet-only (Go krijgt 403)", async () => {
    const compleetPaths = [
      ["GET", "/api/races/999999/points", "route_course_points"],
      ["GET", "/api/live-location/friends", "live_friends_map"],
      ["GET", "/api/live-location/group-options", "live_friends_map"],
    ] as const;
    for (const variant of ["sparki_basic", "sparki_go"] as const) {
      await db
        .update(userProfilesTable)
        .set({ productVariant: variant })
        .where(eq(userProfilesTable.clerkId, subUser));
      for (const [method, path, feature] of compleetPaths) {
        const r = await apiReq(method, path, subUser);
        assert(r.status === 403, `${variant} ${path}: verwacht 403, kreeg ${r.status}`);
        assert(r.json?.feature === feature, `${path}: feature was ${r.json?.feature}`);
        // Eerlijk pakketlabel: een Compleet-onderdeel mag nooit "Sparki Go" claimen.
        assert(
          typeof r.json?.error === "string" && r.json.error.includes("Sparki Compleet"),
          `${path}: 403-tekst moet naar Sparki Compleet verwijzen, was "${r.json?.error}"`,
        );
      }
    }
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_pro" })
      .where(eq(userProfilesTable.clerkId, subUser));
    for (const [method, path] of compleetPaths) {
      const r = await apiReq(method, path, subUser);
      assert(r.status !== 403, `Compleet ${path}: kreeg onterecht 403 (${r.status})`);
      const l = await apiReq(method, path, legacyUser);
      assert(l.status !== 403, `legacy ${path}: kreeg onterecht 403 (${l.status})`);
    }
  });

  await scenario("Besluit 2026-002: route-detail lekt geen wedstrijdpunten zonder Compleet", async () => {
    // Regressie (architect-review 31-07-2026): GET /api/routes/:id bouwde de
    // puntenlijst van een gekoppelde wedstrijd altijd op — een omweg om de
    // gepoorte /api/races/:id/points. Zonder route_course_points moet de
    // detail-payload een lege puntenlijst + pointsLocked geven; mét recht de
    // echte actieve punten.
    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId: subUser,
        name: "Poorttest wedstrijdroute",
        usageType: "wedstrijd",
      })
      .returning({ id: routesTable.id });
    const [race] = await db
      .insert(racesTable)
      .values({
        clerkId: subUser,
        name: "Poorttest wedstrijd",
        raceDate: "2027-06-01",
        status: "gepland",
        routeId: route!.id,
      })
      .returning({ id: racesTable.id });
    await db.insert(racePointsTable).values({
      raceId: race!.id,
      clerkId: subUser,
      kind: "bevoorrading",
      pointClass: "verzorging",
      label: "Poorttest punt",
      raceKm: 10,
      status: "bevestigd",
    });
    try {
      await db
        .update(userProfilesTable)
        .set({ productVariant: "sparki_basic" })
        .where(eq(userProfilesTable.clerkId, subUser));
      const locked = await apiReq("GET", `/api/routes/${route!.id}`, subUser);
      assert(locked.status === 200, `detail (basic) verwacht 200, kreeg ${locked.status}`);
      assert(locked.json?.race, "detail (basic): wedstrijd-metadata moet meegaan");
      assert(
        Array.isArray(locked.json.race.points) && locked.json.race.points.length === 0,
        `detail (basic): puntenlijst moet leeg zijn, was ${JSON.stringify(locked.json.race.points)}`,
      );
      assert(locked.json.race.pointsLocked === true, "detail (basic): pointsLocked moet true zijn");
      await db
        .update(userProfilesTable)
        .set({ productVariant: "sparki_pro" })
        .where(eq(userProfilesTable.clerkId, subUser));
      const open = await apiReq("GET", `/api/routes/${route!.id}`, subUser);
      assert(open.status === 200, `detail (pro) verwacht 200, kreeg ${open.status}`);
      assert(
        open.json?.race?.points?.length === 1 && open.json.race.pointsLocked === false,
        `detail (pro): verwacht 1 actief punt + pointsLocked false, kreeg ${JSON.stringify(open.json?.race)}`,
      );
    } finally {
      await db.delete(racesTable).where(eq(racesTable.id, race!.id)).catch(() => {});
      await db.delete(routesTable).where(eq(routesTable.id, route!.id)).catch(() => {});
    }
  });

  await scenario("Productbesluit gids/course points: koppelen is Compleet-only en kandidaatpunten lekken niet", async () => {
    // PRODUCTBESLUIT (René, 31-07-2026): documentanalyse blijft race_intel,
    // maar het aanmaken/koppelen/tonen van course points is route_course_points.
    // Gratis en Go: /link → 403 "Sparki Compleet" en er ontstaat GEEN verborgen
    // race_point; kandidaatpunten worden in analyse-responses gemaskeerd
    // (leeg + pointsLocked). Compleet ziet en koppelt wél.
    const kandidaat = {
      kind: "bevoorrading",
      description: "Bevoorradingszone km 45",
      page: 3,
      raceKm: 45,
      lat: null,
      lng: null,
      confidence: "high",
    };
    const [analyse] = await db
      .insert(documentAnalysesTable)
      .values({
        clerkId: subUser,
        fileName: "poorttest-gids.pdf",
        mediaType: "application/pdf",
        status: "analyzed",
        summary: "Poorttest technische gids",
        candidatePoints: [kandidaat],
      })
      .returning({ id: documentAnalysesTable.id });
    const [race] = await db
      .insert(racesTable)
      .values({
        clerkId: subUser,
        name: "Poorttest gids-wedstrijd",
        raceDate: "2027-08-01",
        status: "gepland",
      })
      .returning({ id: racesTable.id });
    try {
      for (const variant of ["sparki_basic", "sparki_go"] as const) {
        await db
          .update(userProfilesTable)
          .set({ productVariant: variant })
          .where(eq(userProfilesTable.clerkId, subUser));
        // Koppelen geweigerd met het juiste pakketlabel.
        const link = await apiReq(
          "POST",
          `/api/document-analyses/${analyse!.id}/link`,
          subUser,
          { raceId: race!.id },
        );
        assert(link.status === 403, `${variant}: link verwacht 403, kreeg ${link.status}`);
        assert(link.json?.feature === "route_course_points", `${variant}: feature was ${link.json?.feature}`);
        assert(
          typeof link.json?.error === "string" && link.json.error.includes("Sparki Compleet"),
          `${variant}: 403-tekst moet Sparki Compleet noemen, was "${link.json?.error}"`,
        );
        // Geen verborgen race_points aangemaakt.
        const stiekem = await db
          .select({ id: racePointsTable.id })
          .from(racePointsTable)
          .where(eq(racePointsTable.raceId, race!.id));
        assert(stiekem.length === 0, `${variant}: er zijn zonder recht ${stiekem.length} race_points aangemaakt`);
        // Kandidaatpunten lekken niet via analyse-responses.
        const detail = await apiReq("GET", `/api/document-analyses/${analyse!.id}`, subUser);
        assert(detail.status === 200, `${variant}: analyse-detail verwacht 200, kreeg ${detail.status}`);
        assert(
          Array.isArray(detail.json?.analysis?.candidatePoints) &&
            detail.json.analysis.candidatePoints.length === 0 &&
            detail.json.analysis.pointsLocked === true,
          `${variant}: kandidaatpunten moeten leeg + pointsLocked zijn, kreeg ${JSON.stringify({ candidatePoints: detail.json?.analysis?.candidatePoints, pointsLocked: detail.json?.analysis?.pointsLocked })}`,
        );
        const lijst = await apiReq("GET", "/api/document-analyses", subUser);
        const rij = (lijst.json?.analyses ?? []).find((a: any) => a.id === analyse!.id);
        assert(
          rij && rij.candidatePoints.length === 0 && rij.pointsLocked === true,
          `${variant}: lijst-response lekt kandidaatpunten`,
        );
        // POST /:id/answers — response is óók gemaskeerd.
        const antwoorden = await apiReq(
          "POST",
          `/api/document-analyses/${analyse!.id}/answers`,
          subUser,
          { answers: {} },
        );
        assert(
          antwoorden.status === 200 &&
            antwoorden.json?.analysis?.candidatePoints?.length === 0 &&
            antwoorden.json.analysis.pointsLocked === true,
          `${variant}: answers-response lekt kandidaatpunten of mist pointsLocked`,
        );
        // POST / (upload, hier bewust het eerlijke faalpad met onleesbare
        // inhoud — geen AI nodig): ook het failed record draagt pointsLocked.
        const upload = await apiReq("POST", "/api/document-analyses", subUser, {
          fileName: "poorttest-kapot.pdf",
          mediaType: "application/pdf",
          data: "bm9nZWVucG9vcnR0ZXN0",
        });
        assert(
          upload.status === 201 && upload.json?.analysis?.pointsLocked === true,
          `${variant}: upload-response (failed pad) mist pointsLocked, kreeg ${upload.status} ${JSON.stringify(upload.json?.analysis?.pointsLocked)}`,
        );
        await db
          .delete(documentAnalysesTable)
          .where(eq(documentAnalysesTable.id, upload.json.analysis.id))
          .catch(() => {});
      }
      // Compleet: ziet kandidaatpunten én koppelt echt (punt "voorgesteld").
      await db
        .update(userProfilesTable)
        .set({ productVariant: "sparki_pro" })
        .where(eq(userProfilesTable.clerkId, subUser));
      const open = await apiReq("GET", `/api/document-analyses/${analyse!.id}`, subUser);
      assert(
        open.json?.analysis?.candidatePoints?.length === 1 &&
          open.json.analysis.pointsLocked === false,
        `Compleet: verwacht 1 kandidaatpunt + pointsLocked false, kreeg ${JSON.stringify(open.json?.analysis?.candidatePoints)}`,
      );
      const link = await apiReq(
        "POST",
        `/api/document-analyses/${analyse!.id}/link`,
        subUser,
        { raceId: race!.id },
      );
      assert(link.status === 200, `Compleet: link verwacht 200, kreeg ${link.status} (${JSON.stringify(link.json)})`);
      const punten = await db
        .select({ id: racePointsTable.id, status: racePointsTable.status })
        .from(racePointsTable)
        .where(eq(racePointsTable.raceId, race!.id));
      assert(
        punten.length === 1 && punten[0]!.status === "voorgesteld",
        `Compleet: verwacht 1 voorgesteld punt, kreeg ${JSON.stringify(punten)}`,
      );
    } finally {
      await db.delete(racesTable).where(eq(racesTable.id, race!.id)).catch(() => {});
      await db
        .delete(documentAnalysesTable)
        .where(eq(documentAnalysesTable.id, analyse!.id))
        .catch(() => {});
    }
  });

  await scenario("01 §3 bewaaktest: de zeven gratis functies dragen nooit een commerciële poort", async () => {
    // ROUTE_PAKKET_01 §3 (v2): deze test moet FALEN zodra één van de zeven
    // gratis functies achter requireCommercialFeature schuift. Hij bewijst
    // bereikbaarheid voor een account ZONDER enig commercieel recht — niet
    // alleen dat er geen sleutel bestaat. Alleen een 403 met code
    // "upgrade_required" is een overtreding; validatie-4xx betekent juist dat
    // de (niet-bestaande) poort is gepasseerd.
    // Spraakaanwijzingen zijn client-side afgeleid van de nav-cues in het
    // route-detail; het hoogteprofiel zit in detail (profile) + /insight.
    await db
      .update(userProfilesTable)
      .set({ productVariant: "sparki_basic" }) // gedraagt zich als Gratis: nul rechten
      .where(eq(userProfilesTable.clerkId, subUser));
    const [vrij] = await db
      .insert(routesTable)
      .values({ clerkId: subUser, name: "Gratis-bewaaktest route" })
      .returning({ id: routesTable.id });
    try {
      const gratisFuncties = [
        // 1. Route plannen en genereren
        ["POST", "/api/routes/generate/options", {}],
        ["POST", "/api/routes/generate", {}],
        // 2. Route aanpassen (afstand/tijd/wegtype/hoogte/wind = generate-opties)
        ["POST", "/api/routes/generate/start", {}],
        // 3. GPX exporteren
        ["GET", `/api/routes/${vrij!.id}/gpx`, undefined],
        // 4. Afslag-voor-afslag navigatie (start + nav-cues in detail)
        ["POST", `/api/routes/${vrij!.id}/navigatie-start`, {}],
        // 5. Spraakaanwijzingen — server-side bron: nav-cues in route-detail
        // 6. Hoogteprofiel met schuifbalk
        ["GET", `/api/routes/${vrij!.id}/insight`, undefined],
        // 7. Een route bekijken (detail bevat nav + profile)
        ["GET", `/api/routes/${vrij!.id}`, undefined],
      ] as const;
      for (const [method, path, body] of gratisFuncties) {
        const r = await apiReq(method, path, subUser, body);
        assert(
          !(r.status === 403 && r.json?.code === "upgrade_required"),
          `${method} ${path}: gratis functie kreeg een commerciële poort (403 upgrade_required) — overtreding van ROUTE_PAKKET_01 §3`,
        );
      }
    } finally {
      await db.delete(routesTable).where(eq(routesTable.id, vrij!.id)).catch(() => {});
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
