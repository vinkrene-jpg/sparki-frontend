// Sparki Connect — kapotte koppeling actief melden (Taak: sync-fouten direct).
//
// Test de pure afleiding (isSyncStale, evaluateConnectionHealth) én de echte
// controle-job (runConnectionHealthCheck) tegen de database:
//   • verlopen toestemming ⇒ melding met herstelactie;
//   • >24u geen geslaagde sync ⇒ melding;
//   • herhaald draaien ⇒ GEEN tweede melding (één per storing, niet per poging);
//   • geslaagde sync (resolveNotifications link:strava) ⇒ melding opgelost,
//     daarna mag een NIEUWE storing wél weer melden.
//
// Run: `pnpm --filter @workspace/api-server run test:connection-health`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  connectorConnectionsTable,
  notificationsTable,
  type ConnectorConnection,
} from "@workspace/db";
import { isSyncStale, SYNC_STALE_MS } from "../lib/connectors/connect-status";
import {
  evaluateConnectionHealth,
  runConnectionHealthCheck,
  linkResolutionKey,
} from "../engines/data-hub/connection-health";
import { resolveNotifications } from "../lib/notifications";

const CLERK_ID = "test-connection-health-user";

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

function row(partial: Partial<ConnectorConnection>): ConnectorConnection {
  const now = new Date();
  return {
    id: 0,
    clerkId: CLERK_ID,
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

const NOW = new Date("2026-07-30T12:00:00Z");
const OLD = new Date(NOW.getTime() - SYNC_STALE_MS - 60_000); // 24u + 1min terug
const FRESH = new Date(NOW.getTime() - 60 * 60 * 1000); // 1u terug

async function cleanup() {
  await db
    .delete(notificationsTable)
    .where(eq(notificationsTable.clerkId, CLERK_ID));
  await db
    .delete(connectorConnectionsTable)
    .where(eq(connectorConnectionsTable.clerkId, CLERK_ID));
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, CLERK_ID));
}

async function openLinkNotifications() {
  return db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, CLERK_ID),
        eq(notificationsTable.resolutionKey, linkResolutionKey("strava")),
        isNull(notificationsTable.resolvedAt),
      ),
    );
}

async function main() {
  // ── Puur: isSyncStale ─────────────────────────────────────────────────────
  await scenario("1. verse sync (1u geleden) → niet verouderd", () => {
    assert(!isSyncStale(row({ lastSyncAt: FRESH }), NOW), "moet vers zijn");
  });

  await scenario("2. laatste sync >24u geleden → verouderd", () => {
    assert(isSyncStale(row({ lastSyncAt: OLD }), NOW), "moet verouderd zijn");
  });

  await scenario("3. nooit gesynct, net gekoppeld → niet verouderd", () => {
    assert(
      !isSyncStale(row({ connectedAt: FRESH }), NOW),
      "net gekoppeld is geen storing",
    );
  });

  await scenario("4. nooit gesynct, koppeling >24u oud → verouderd", () => {
    assert(isSyncStale(row({ connectedAt: OLD }), NOW), "moet verouderd zijn");
  });

  await scenario("5. verbroken koppeling → nooit verouderd", () => {
    assert(
      !isSyncStale(row({ status: "disconnected", lastSyncAt: OLD }), NOW),
      "verbroken telt niet",
    );
  });

  await scenario("6. fout-rij met oude sync → verouderd (óók kapot)", () => {
    assert(
      isSyncStale(row({ status: "error", lastSyncAt: OLD }), NOW),
      "error-rij telt mee",
    );
  });

  // ── Puur: evaluateConnectionHealth ────────────────────────────────────────
  await scenario("7. verlopen toestemming wint van verouderd", () => {
    const r = evaluateConnectionHealth(
      row({
        accessToken: "secret",
        refreshToken: null,
        tokenExpiresAt: new Date(NOW.getTime() - 1000),
        lastSyncAt: OLD,
      }),
      NOW,
    );
    assert(r === "consent_expired", `got ${r}`);
  });

  await scenario("8. alleen verouderd → sync_stale", () => {
    const r = evaluateConnectionHealth(row({ lastSyncAt: OLD }), NOW);
    assert(r === "sync_stale", `got ${r}`);
  });

  await scenario("9. gezond → null", () => {
    const r = evaluateConnectionHealth(
      row({ accessToken: "secret", refreshToken: "r", lastSyncAt: FRESH }),
      NOW,
    );
    assert(r === null, `got ${r}`);
  });

  // ── Echte controle-job tegen de database ──────────────────────────────────
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: CLERK_ID,
    email: "connection-health-test@example.com",
    displayName: "Verbinding Test",
    roles: ["athlete"],
  });
  await db.insert(connectorConnectionsTable).values({
    clerkId: CLERK_ID,
    provider: "strava",
    status: "connected",
    connectedAt: OLD,
    lastSyncAt: OLD,
  });

  await scenario("10. job meldt verouderde koppeling precies één keer", async () => {
    const s1 = await runConnectionHealthCheck({ now: NOW });
    assert(s1.broken >= 1, `broken=${s1.broken}`);
    const open1 = await openLinkNotifications();
    assert(open1.length === 1, `verwacht 1 open melding, kreeg ${open1.length}`);
    assert(
      open1[0]!.actionUrl === "/you?focus=connections",
      "herstelactie moet naar Koppelingen wijzen",
    );
    assert(open1[0]!.type === "sync_error", "type sync_error");
    // Tweede run: dezelfde storing, GEEN tweede melding.
    await runConnectionHealthCheck({ now: NOW });
    const open2 = await openLinkNotifications();
    assert(open2.length === 1, `na herhaalde run nog steeds 1, kreeg ${open2.length}`);
  });

  await scenario(
    "11. geslaagde sync lost op; nieuwe storing meldt opnieuw",
    async () => {
      // Zoals runSync bij succes doet:
      await resolveNotifications(CLERK_ID, linkResolutionKey("strava"));
      assert((await openLinkNotifications()).length === 0, "opgelost");
      // Storing keert terug → een NIEUWE melding mag wél.
      await runConnectionHealthCheck({ now: NOW });
      assert(
        (await openLinkNotifications()).length === 1,
        "nieuwe storing meldt opnieuw",
      );
    },
  );

  await scenario("12. verse koppeling → geen melding", async () => {
    await cleanup();
    await db.insert(userProfilesTable).values({
      clerkId: CLERK_ID,
      email: "connection-health-test@example.com",
      displayName: "Verbinding Test",
      roles: ["athlete"],
    });
    await db.insert(connectorConnectionsTable).values({
      clerkId: CLERK_ID,
      provider: "strava",
      status: "connected",
      connectedAt: FRESH,
      lastSyncAt: FRESH,
      refreshToken: "encrypted",
    });
    await runConnectionHealthCheck({ now: NOW });
    assert((await openLinkNotifications()).length === 0, "geen melding");
  });

  await cleanup();

  // ── Rapport ───────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed++;
    console.log(
      `${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("connection-health test FATAL:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
