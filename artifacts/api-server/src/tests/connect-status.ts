// Sparki Connect — centraal statusmodel + eerlijke capabilitystatus.
//
// Test 17 scenario's: alle 8 statussen van deriveConnectState, foutcategorie-
// afleiding, tokenveiligheid (nooit het token zelf), capabilitys per platform
// (Garmin nooit "available" zonder officiële sleutels), bestandsimport, en de
// echte GET /api/connectors-route (zelfde bron als onboarding, geen tokens in
// de respons, disconnectedAt na verbreken).
//
// Run: `pnpm --filter @workspace/api-server run test:connect-status`
// Requires: DATABASE_URL + DEV_AUTH_BYPASS=true. Exits non-zero on any failure.

import {
  db,
  pool,
  userProfilesTable,
  connectorConnectionsTable,
  syncRunsTable,
  type ConnectorConnection,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  deriveConnectState,
  categorizeConnectError,
  deriveCapabilities,
  FILE_IMPORT_CAPABILITIES,
} from "../lib/connectors/connect-status";
import {
  getConnectorDefinition,
  connectorRegistry,
} from "../lib/connectors/registry";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
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

// Minimale rij-fabriek voor pure-functie scenario's.
function row(partial: Partial<ConnectorConnection>): ConnectorConnection {
  const now = new Date();
  return {
    id: 0,
    clerkId: "test",
    provider: "strava",
    status: "connected",
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    scopes: null,
    externalUserId: null,
    connectedAt: null,
    lastSyncAt: null,
    lastSyncAttemptAt: null,
    lastErrorCategory: null,
    disconnectedAt: null,
    importedDataTypes: [],
    errorStatus: null,
    permissionRevoked: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  } as ConnectorConnection;
}

async function main() {
  // ── Pure statusafleiding: alle 8 statussen ────────────────────────────────
  await scenario("1. geen rij → not_connected", () => {
    const s = deriveConnectState(null);
    assert(s.status === "not_connected", `got ${s.status}`);
    assert(s.permissionState === "none", "permissionState must be none");
    assert(s.tokenAvailable === false, "tokenAvailable must be false");
  });

  await scenario("2. pending → connecting", () => {
    assert(deriveConnectState(row({ status: "pending" })).status === "connecting", "pending");
  });

  await scenario("3. connected zonder lopende sync → connected", () => {
    const s = deriveConnectState(
      row({ status: "connected", accessToken: "secret", connectedAt: new Date() }),
    );
    assert(s.status === "connected", `got ${s.status}`);
    assert(s.permissionState === "granted", "granted");
    assert(s.tokenAvailable === true, "tokenAvailable true");
  });

  await scenario("4. connected + lopende sync-run → sync_in_progress", () => {
    const s = deriveConnectState(row({ status: "connected" }), { syncRunning: true });
    assert(s.status === "sync_in_progress", `got ${s.status}`);
  });

  await scenario("5. error met tijdelijke oorzaak → temporarily_unavailable", () => {
    const s = deriveConnectState(row({ status: "error", lastErrorCategory: "temporary" }));
    assert(s.status === "temporarily_unavailable", `got ${s.status}`);
    assert(s.lastErrorCategory === "temporary", "category temporary");
  });

  await scenario("6. error met auth-oorzaak → action_required", () => {
    const s = deriveConnectState(row({ status: "error", lastErrorCategory: "auth" }));
    assert(s.status === "action_required", `got ${s.status}`);
  });

  await scenario("7. toestemming ingetrokken → permission_revoked", () => {
    const a = deriveConnectState(row({ status: "revoked" }));
    const b = deriveConnectState(row({ status: "connected", permissionRevoked: true }));
    assert(a.status === "permission_revoked" && b.status === "permission_revoked", "revoked");
    assert(a.permissionState === "revoked", "permissionState revoked");
  });

  await scenario("8. verbroken met historie → disconnected; lege schaduwrij → not_connected", () => {
    const withHistory = deriveConnectState(
      row({ status: "disconnected", disconnectedAt: new Date() }),
    );
    const shell = deriveConnectState(row({ status: "disconnected" }));
    assert(withHistory.status === "disconnected", `got ${withHistory.status}`);
    assert(shell.status === "not_connected", `shell got ${shell.status}`);
  });

  // ── Veiligheid & velden ───────────────────────────────────────────────────
  await scenario("9. status bevat NOOIT het token zelf", () => {
    const s = deriveConnectState(row({ accessToken: "supergeheim-token" }));
    const json = JSON.stringify(s);
    assert(!json.includes("supergeheim-token"), "token leaked in ConnectState");
    assert(typeof s.tokenAvailable === "boolean", "tokenAvailable is a boolean");
  });

  await scenario("10. velden lastSuccessfulSyncAt/lastSyncAttemptAt komen uit de rij", () => {
    const sync = new Date("2026-07-01T10:00:00Z");
    const attempt = new Date("2026-07-02T10:00:00Z");
    const s = deriveConnectState(row({ lastSyncAt: sync, lastSyncAttemptAt: attempt }));
    assert(s.lastSuccessfulSyncAt?.getTime() === sync.getTime(), "lastSuccessfulSyncAt");
    assert(s.lastSyncAttemptAt?.getTime() === attempt.getTime(), "lastSyncAttemptAt");
  });

  await scenario("11. onbekende opgeslagen foutcategorie normaliseert naar unknown", () => {
    const s = deriveConnectState(row({ status: "error", lastErrorCategory: "weird" }));
    assert(s.lastErrorCategory === "unknown", `got ${s.lastErrorCategory}`);
    assert(s.status === "action_required", "unknown ⇒ action_required");
  });

  await scenario("12. categorizeConnectError herkent auth/permission/temporary/unknown", () => {
    assert(categorizeConnectError({ status: 401, message: "x" }) === "auth", "401");
    assert(categorizeConnectError(new Error("access revoked by user")) === "permission", "revoked");
    assert(categorizeConnectError(new Error("fetch failed")) === "temporary", "network");
    assert(categorizeConnectError(new Error("iets vreemds")) === "unknown", "unknown");
  });

  // ── Capabilities ──────────────────────────────────────────────────────────
  await scenario("13. Garmin zonder officiële sleutels: nooit 'available'", () => {
    const def = getConnectorDefinition("garmin")!;
    const caps = deriveCapabilities(def, false);
    assert(
      Object.values(caps).every((v) => v !== "available"),
      `garmin leaked available: ${JSON.stringify(caps)}`,
    );
    assert(caps.route_export === "awaiting_official_access", "route_export awaiting");
    assert(caps.webhook_sync === "awaiting_official_access", "webhook awaiting");
  });

  await scenario("14. workout_export is overal eerlijk unsupported", () => {
    for (const def of connectorRegistry) {
      const caps = deriveCapabilities(def, true);
      assert(caps.workout_export === "unsupported", `${def.id} workout_export`);
    }
  });

  await scenario("15. bestandsimport is echt beschikbaar; platforms zelf niet file_import", () => {
    assert(FILE_IMPORT_CAPABILITIES.file_import === "available", "file import available");
    assert(FILE_IMPORT_CAPABILITIES.activity_import === "available", "activity via file");
    for (const def of connectorRegistry) {
      assert(deriveCapabilities(def, true).file_import === "unsupported", `${def.id} file_import`);
    }
  });

  // ── Echte route: zelfde bron voor onboarding en instellingen ─────────────
  const RUN = `test_connect_status_${Date.now()}`;
  const port = process.env.PORT ?? "8080";
  const base = `http://localhost:${port}`;

  try {
    await db.insert(userProfilesTable).values({
      clerkId: RUN,
      email: `${RUN}@test.local`,
      displayName: "Connect Status Test",
    });

    await scenario("16. GET /api/connectors: connect+capabilities aanwezig, geen tokens", async () => {
      const res = await fetch(`${base}/api/connectors`, {
        headers: { "x-dev-clerk-id": RUN },
      });
      assert(res.ok, `HTTP ${res.status}`);
      const body = (await res.json()) as {
        connectors: Array<Record<string, unknown>>;
        fileImport?: { capabilities?: Record<string, string> };
      };
      assert(Array.isArray(body.connectors) && body.connectors.length > 0, "connectors list");
      for (const c of body.connectors) {
        assert(c.connect && typeof c.connect === "object", `${c.id} misses connect`);
        assert(c.capabilities && typeof c.capabilities === "object", `${c.id} misses capabilities`);
        const json = JSON.stringify(c);
        assert(!/accessToken|refreshToken/.test(json), `${c.id} leaks token fields`);
      }
      const strava = body.connectors.find((c) => c.id === "strava") as
        | { connect: { status: string } }
        | undefined;
      assert(strava?.connect.status === "not_connected", "strava not_connected for fresh user");
      const garmin = body.connectors.find((c) => c.id === "garmin") as
        | { capabilities: Record<string, string> }
        | undefined;
      assert(
        garmin && Object.values(garmin.capabilities).every((v) => v !== "available"),
        "garmin must never be available without official keys",
      );
      assert(body.fileImport?.capabilities?.file_import === "available", "fileImport block");
    });

    await scenario("17. verbreken zet disconnectedAt en status disconnected via route", async () => {
      const now = new Date();
      await db.insert(connectorConnectionsTable).values({
        clerkId: RUN,
        provider: "strava",
        status: "connected",
        accessToken: "geheim",
        connectedAt: now,
        lastSyncAt: now,
      });
      const res = await fetch(`${base}/api/connectors/strava/disconnect`, {
        method: "POST",
        headers: { "x-dev-clerk-id": RUN },
      });
      assert(res.ok, `HTTP ${res.status}`);
      const body = (await res.json()) as {
        connector: { connect: { status: string; disconnectedAt: string | null; tokenAvailable: boolean } };
      };
      assert(body.connector.connect.status === "disconnected", `got ${body.connector.connect.status}`);
      assert(body.connector.connect.disconnectedAt !== null, "disconnectedAt set");
      assert(body.connector.connect.tokenAvailable === false, "token cleared");
      const [dbRow] = await db
        .select()
        .from(connectorConnectionsTable)
        .where(
          and(
            eq(connectorConnectionsTable.clerkId, RUN),
            eq(connectorConnectionsTable.provider, "strava"),
          ),
        );
      assert(dbRow?.disconnectedAt != null, "db disconnectedAt persisted");
      assert(dbRow?.accessToken == null, "db token wiped");
    });
  } finally {
    await db.delete(syncRunsTable).where(eq(syncRunsTable.clerkId, RUN)).catch(() => {});
    await db
      .delete(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, RUN));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, RUN));
  }

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "PASS" : "FAIL";
    if (r.status === "fail") failed++;
    console.log(`${mark}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} checks geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("connect-status test crashed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
