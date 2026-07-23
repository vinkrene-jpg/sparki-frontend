// Sparki Connect — Strava webhook-eerst synchronisatie.
//
// Test ~28 scenario's: de pure inhaalsync-beslisregel (shouldCatchUp) met alle
// grensgevallen, het "vanaf"-moment met overlap, veld-verversing binnen dezelfde
// bron (handmatig heilig, andere bronnen eerste-bron-wint), gerichte
// webhook-verwerking (aanmaken/bijwerken/geen duplicaten, delete eerlijk
// overgeslagen, busy overgeslagen), 404/429-gedrag, geen tokens in de
// API-respons, en ontkoppelen dat activiteiten behoudt.
//
// Run: `pnpm --filter @workspace/api-server run test:strava-sync`
// Requires: DATABASE_URL + DEV_AUTH_BYPASS=true. Exits non-zero on any failure.

import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  connectorConnectionsTable,
  connectorActivitiesTable,
  syncRunsTable,
  trainingSessionsTable,
  webhookEventsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  shouldCatchUp,
  computeCatchUpAfterEpochSec,
  STALE_SYNC_HOURS,
} from "../engines/data-hub/strava-sync";
import { buildMergePatch } from "../engines/data-hub/dedupe";
import {
  recordWebhookEvent,
  processWebhookEvent,
  resolveClerkIdByExternalUser,
} from "../engines/data-hub/webhooks";
import { runSync, HubError, isTransientError } from "../engines/data-hub";
import { encryptSecret } from "../lib/token-crypto";

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

// ── Strava-API-stub (in-process fetch) ───────────────────────────────────────
// Alleen www.strava.com-verzoeken worden onderschept; al het andere (eigen API,
// database) loopt gewoon door. Zo testen we het echte sync-pad zonder externe
// afhankelijkheid — en zien we exact welke Strava-endpoints zijn aangeroepen.
const realFetch = globalThis.fetch;
let stravaCalls: string[] = [];
let stravaResponder: ((url: string) => Response | null) | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url.startsWith("https://www.strava.com/")) {
    stravaCalls.push(url);
    const out = stravaResponder?.(url);
    if (out) return out;
    return json({ message: "not stubbed" }, 500);
  }
  return realFetch(input as never, init);
}) as typeof fetch;

function stravaActivity(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Testrit ${id}`,
    sport_type: "Ride",
    start_date: "2026-07-20T08:00:00Z",
    moving_time: 3600,
    distance: 30000,
    total_elevation_gain: 250,
    average_watts: 180,
    ...overrides,
  };
}

const RUN = `test_strava_sync_${Date.now()}`;
const EXTERNAL_USER = `9${Date.now() % 100000000}`;

async function seedConnection() {
  await db
    .insert(connectorConnectionsTable)
    .values({
      clerkId: RUN,
      provider: "strava",
      status: "connected",
      accessToken: encryptSecret("test-access-token"),
      refreshToken: encryptSecret("test-refresh-token"),
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      externalUserId: EXTERNAL_USER,
      scopes: ["read", "activity:read_all"],
      connectedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        connectorConnectionsTable.clerkId,
        connectorConnectionsTable.provider,
      ],
      set: {
        status: "connected",
        accessToken: encryptSecret("test-access-token"),
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
        externalUserId: EXTERNAL_USER,
        permissionRevoked: false,
        errorStatus: null,
      },
    });
}

async function sessionCount(): Promise<number> {
  const rows = await db
    .select({ id: trainingSessionsTable.id })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, RUN));
  return rows.length;
}

async function main() {
  const now = new Date("2026-07-23T12:00:00Z");
  const conn = (over: Record<string, unknown>) =>
    ({
      status: "connected",
      accessToken: "x",
      lastSyncAt: null,
      ...over,
    }) as never;

  // ── shouldCatchUp: pure beslisregel ───────────────────────────────────────
  await scenario("1. geen rij → geen inhaalsync (geen_koppeling)", () => {
    const d = shouldCatchUp(null, null, now);
    assert(!d.catchUp && d.reason === "geen_koppeling", d.reason);
  });

  await scenario("2. niet verbonden → geen inhaalsync", () => {
    const d = shouldCatchUp(conn({ status: "disconnected" }), null, now);
    assert(!d.catchUp && d.reason === "niet_verbonden", d.reason);
  });

  await scenario("3. verbonden zonder token → geen inhaalsync (geen_token)", () => {
    const d = shouldCatchUp(conn({ accessToken: null }), null, now);
    assert(!d.catchUp && d.reason === "geen_token", d.reason);
  });

  await scenario("4. nooit gesynct → inhaalsync (nooit_gesynct)", () => {
    const d = shouldCatchUp(conn({}), null, now);
    assert(d.catchUp && d.reason === "nooit_gesynct", d.reason);
  });

  await scenario("5. laatst gesynct 1 uur geleden → actueel, geen sync", () => {
    const d = shouldCatchUp(
      conn({ lastSyncAt: new Date(now.getTime() - 3_600_000) }),
      "success",
      now,
    );
    assert(!d.catchUp && d.reason === "actueel", d.reason);
  });

  await scenario("6. grens: precies 24u oud → nog actueel; 24u+1s → verouderd", () => {
    const exactly = shouldCatchUp(
      conn({ lastSyncAt: new Date(now.getTime() - STALE_SYNC_HOURS * 3_600_000) }),
      "success",
      now,
    );
    const past = shouldCatchUp(
      conn({
        lastSyncAt: new Date(now.getTime() - STALE_SYNC_HOURS * 3_600_000 - 1000),
      }),
      "success",
      now,
    );
    assert(!exactly.catchUp, "exact 24u mag niet triggeren");
    assert(past.catchUp && past.reason === "verouderd", past.reason);
  });

  await scenario("7. verse sync maar laatste run mislukt → inhaalsync", () => {
    const d = shouldCatchUp(
      conn({ lastSyncAt: new Date(now.getTime() - 3_600_000) }),
      "failed",
      now,
    );
    assert(d.catchUp && d.reason === "vorige_sync_mislukt", d.reason);
  });

  await scenario("8. gedocumenteerde actualiteitsgrens is 24 uur", () => {
    assert(STALE_SYNC_HOURS === 24, `STALE_SYNC_HOURS=${STALE_SYNC_HOURS}`);
  });

  // ── computeCatchUpAfterEpochSec ───────────────────────────────────────────
  await scenario("9. met laatste syncmoment: 48u overlap terug", () => {
    const last = new Date("2026-07-22T12:00:00Z");
    const got = computeCatchUpAfterEpochSec(last, now);
    assert(
      got === Math.floor(last.getTime() / 1000) - 48 * 3600,
      `got ${got}`,
    );
  });

  await scenario("10. zonder syncmoment: begrensd 30 dagen terug (geen volledige historie)", () => {
    const got = computeCatchUpAfterEpochSec(null, now);
    assert(got === Math.floor(now.getTime() / 1000) - 30 * 86_400, `got ${got}`);
  });

  await scenario("11. nooit negatief (heel oud syncmoment)", () => {
    assert(computeCatchUpAfterEpochSec(new Date(0), now) === 0, "clamp 0");
  });

  // ── buildMergePatch: verversen binnen dezelfde bron ───────────────────────
  await scenario("12. lege velden worden altijd gevuld", () => {
    const p = buildMergePatch({ title: null }, { title: "Rit" });
    assert(p.title === "Rit", "fill null");
  });

  await scenario("13. eigen veld (zelfde bron) mag verversen bij wijziging", () => {
    const p = buildMergePatch(
      { title: "Oud", distanceKm: 30 },
      { title: "Nieuw", distanceKm: 31 },
      null,
      new Set(["title", "distanceKm"]),
    );
    assert(p.title === "Nieuw" && p.distanceKm === 31, JSON.stringify(p));
  });

  await scenario("14. veld van ándere bron blijft staan (eerste-bron-wint)", () => {
    const p = buildMergePatch(
      { title: "Van Garmin" },
      { title: "Van Strava" },
      null,
      new Set(), // niets eerder door Strava geleverd
    );
    assert(!("title" in p), "cross-source overwrite verboden");
  });

  await scenario("15. handmatige correctie is heilig, ook binnen refreshFields", () => {
    const p = buildMergePatch(
      { title: "Handmatig" },
      { title: "Strava-update" },
      ["title"],
      new Set(["title"]),
    );
    assert(!("title" in p), "manual field overschreven");
  });

  await scenario("16. ongewijzigde eigen waarde geeft géén patch (idempotent)", () => {
    const p = buildMergePatch(
      { title: "Zelfde" },
      { title: "Zelfde" },
      null,
      new Set(["title"]),
    );
    assert(Object.keys(p).length === 0, JSON.stringify(p));
  });

  // ── Echte data: gebruiker + koppeling ─────────────────────────────────────
  await db.insert(userProfilesTable).values({
    clerkId: RUN,
    email: `${RUN}@test.local`,
    displayName: "Strava Sync Test",
  });
  await db.insert(athleteProfilesTable).values({ clerkId: RUN });
  await seedConnection();

  const port = process.env.PORT ?? "8080";
  const base = `http://localhost:${port}`;

  try {
    await scenario("17. externalUserId lost op naar de juiste gebruiker", async () => {
      const got = await resolveClerkIdByExternalUser("strava", EXTERNAL_USER);
      assert(got === RUN, `got ${got}`);
      const none = await resolveClerkIdByExternalUser("strava", "0");
      assert(none === null, "onbekende externe gebruiker moet null geven");
    });

    await scenario("18. gerichte webhook-sync haalt precies één activiteit op (geen lijst, geen profiel)", async () => {
      stravaCalls = [];
      stravaResponder = (url) =>
        url.includes("/activities/9001") ? json(stravaActivity(9001)) : null;
      const rec = await recordWebhookEvent({
        provider: "strava",
        eventId: `${RUN}-evt-create-9001`,
        externalUserId: EXTERNAL_USER,
        payload: { object_type: "activity", object_id: 9001, aspect_type: "create" },
      });
      assert(rec.event, "event vastgelegd");
      const out = await processWebhookEvent(rec.event!);
      assert(out.status === "processed", `status ${out.status}: ${out.error ?? ""}`);
      assert(
        stravaCalls.some((u) => u.includes("/activities/9001")),
        "detail-endpoint niet aangeroepen",
      );
      assert(
        !stravaCalls.some((u) => u.includes("/athlete/activities")),
        "lijst-endpoint mag niet worden aangeroepen",
      );
      assert(
        !stravaCalls.some((u) => u.endsWith("/athlete")),
        "profiel-endpoint mag niet worden aangeroepen",
      );
      assert((await sessionCount()) === 1, "activiteit niet aangemaakt");
    });

    await scenario("19. sync-run vastgelegd met trigger webhook", async () => {
      const [run] = await db
        .select()
        .from(syncRunsTable)
        .where(
          and(eq(syncRunsTable.clerkId, RUN), eq(syncRunsTable.provider, "strava")),
        );
      assert(run, "geen sync_run rij");
      assert(run!.trigger === "webhook", `trigger ${run!.trigger}`);
      assert(run!.status === "success", `status ${run!.status}`);
    });

    await scenario("20. zelfde webhook nogmaals → idempotent, geen duplicaat", async () => {
      const rec = await recordWebhookEvent({
        provider: "strava",
        eventId: `${RUN}-evt-create-9001`,
        externalUserId: EXTERNAL_USER,
        payload: { object_type: "activity", object_id: 9001, aspect_type: "create" },
      });
      assert(rec.duplicate === true, "duplicate niet herkend");
      assert((await sessionCount()) === 1, "duplicaat aangemaakt");
    });

    await scenario("21. update-webhook ververst Strava's eigen velden (titel)", async () => {
      stravaResponder = (url) =>
        url.includes("/activities/9001")
          ? json(stravaActivity(9001, { name: "Hernoemde rit" }))
          : null;
      const rec = await recordWebhookEvent({
        provider: "strava",
        eventId: `${RUN}-evt-update-9001`,
        externalUserId: EXTERNAL_USER,
        payload: { object_type: "activity", object_id: 9001, aspect_type: "update" },
      });
      const out = await processWebhookEvent(rec.event!);
      assert(out.status === "processed", `status ${out.status}: ${out.error ?? ""}`);
      assert((await sessionCount()) === 1, "update mag geen duplicaat maken");
      const [s] = await db
        .select({ title: trainingSessionsTable.title })
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, RUN));
      assert(s?.title === "Hernoemde rit", `titel ${s?.title}`);
    });

    await scenario("22. handmatig gecorrigeerd veld overleeft een Strava-update", async () => {
      await db
        .update(trainingSessionsTable)
        .set({ title: "Mijn eigen naam", manualFields: ["title"] })
        .where(eq(trainingSessionsTable.clerkId, RUN));
      stravaResponder = (url) =>
        url.includes("/activities/9001")
          ? json(stravaActivity(9001, { name: "Strava wint niet" }))
          : null;
      const rec = await recordWebhookEvent({
        provider: "strava",
        eventId: `${RUN}-evt-update2-9001`,
        externalUserId: EXTERNAL_USER,
        payload: { object_type: "activity", object_id: 9001, aspect_type: "update" },
      });
      const out = await processWebhookEvent(rec.event!);
      assert(out.status === "processed", `status ${out.status}`);
      const [s] = await db
        .select({ title: trainingSessionsTable.title })
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, RUN));
      assert(s?.title === "Mijn eigen naam", `titel ${s?.title}`);
    });

    await scenario("23. delete-webhook wordt eerlijk overgeslagen; lokale data blijft", async () => {
      stravaCalls = [];
      const rec = await recordWebhookEvent({
        provider: "strava",
        eventId: `${RUN}-evt-delete-9001`,
        externalUserId: EXTERNAL_USER,
        payload: { object_type: "activity", object_id: 9001, aspect_type: "delete" },
      });
      const out = await processWebhookEvent(rec.event!);
      assert(out.status === "skipped", `status ${out.status}`);
      assert(stravaCalls.length === 0, "delete mag Strava niet aanroepen");
      assert((await sessionCount()) === 1, "lokale activiteit verwijderd!");
    });

    await scenario("24. 404 op gerichte ophaling → run slaagt eerlijk zonder data", async () => {
      stravaResponder = (url) =>
        url.includes("/activities/9002") ? json({ message: "gone" }, 404) : null;
      const rec = await recordWebhookEvent({
        provider: "strava",
        eventId: `${RUN}-evt-create-9002`,
        externalUserId: EXTERNAL_USER,
        payload: { object_type: "activity", object_id: 9002, aspect_type: "create" },
      });
      const out = await processWebhookEvent(rec.event!);
      assert(out.status === "processed", `status ${out.status}: ${out.error ?? ""}`);
      assert((await sessionCount()) === 1, "404 mag niets aanmaken");
    });

    await scenario("25. 429 wordt als tijdelijk herkend (transient retry-pad)", async () => {
      const err = new Error("Strava-limiet bereikt.") as Error & { status: number };
      err.status = 429;
      assert(isTransientError(err), "429 moet transient zijn");
      assert(!isTransientError(new Error("iets anders")), "gewone fout niet transient");
    });

    await scenario("26. lopende sync → busy (geen tweede gelijktijdige run)", async () => {
      await db.insert(syncRunsTable).values({
        clerkId: RUN,
        provider: "strava",
        trigger: "manual",
        status: "running",
        startedAt: new Date(),
      });
      try {
        await runSync(RUN, "strava", "manual");
        assert(false, "runSync had busy moeten gooien");
      } catch (err) {
        assert(err instanceof HubError && err.code === "busy", `got ${String(err)}`);
      } finally {
        await db
          .delete(syncRunsTable)
          .where(
            and(eq(syncRunsTable.clerkId, RUN), eq(syncRunsTable.status, "running")),
          );
      }
    });

    await scenario("26b. twee gelijktijdige runSyncs → precies één start, één busy", async () => {
      stravaResponder = (url) => {
        if (url.endsWith("/athlete")) return json({ id: Number(EXTERNAL_USER) });
        if (url.includes("/athlete/activities")) return json([]);
        if (url.includes("/activities/")) return json(stravaActivity(9500));
        return null;
      };
      const outcomes = await Promise.allSettled([
        runSync(RUN, "strava", "manual"),
        runSync(RUN, "strava", "manual"),
      ]);
      const ok = outcomes.filter((o) => o.status === "fulfilled").length;
      const busy = outcomes.filter(
        (o) =>
          o.status === "rejected" &&
          o.reason instanceof HubError &&
          o.reason.code === "busy",
      ).length;
      assert(ok === 1 && busy === 1, `ok=${ok} busy=${busy}`);
    });

    await scenario("27. inhaalsync geeft 'after' door aan Strava (begrensde batch)", async () => {
      stravaCalls = [];
      stravaResponder = (url) => {
        if (url.endsWith("/athlete")) return json({ id: Number(EXTERNAL_USER) });
        if (url.includes("/athlete/activities")) return json([]);
        return null;
      };
      const after = Math.floor(Date.now() / 1000) - 7 * 86_400;
      await runSync(RUN, "strava", "scheduled", { afterEpochSec: after });
      const listCall = stravaCalls.find((u) => u.includes("/athlete/activities"));
      assert(listCall, "lijst-endpoint niet aangeroepen");
      assert(listCall!.includes(`after=${after}`), `after ontbreekt: ${listCall}`);
    });

    await scenario("28. GET /api/connectors lekt nooit tokens en toont laatste sync", async () => {
      const res = await realFetch(`${base}/api/connectors`, {
        headers: { "x-dev-clerk-id": RUN },
      });
      assert(res.ok, `HTTP ${res.status}`);
      const body = (await res.json()) as { connectors: Array<Record<string, unknown>> };
      const strava = body.connectors.find((c) => c.id === "strava") as
        | { connect: { status: string; lastSuccessfulSyncAt: string | null } }
        | undefined;
      assert(strava, "strava ontbreekt");
      assert(
        !/test-access-token|test-refresh-token|accessToken|refreshToken/.test(
          JSON.stringify(strava),
        ),
        "token(informatie) gelekt",
      );
      assert(strava!.connect.lastSuccessfulSyncAt != null, "laatste sync ontbreekt");
    });

    await scenario("29. ontkoppelen behoudt activiteiten; webhook lost daarna niet meer op", async () => {
      const res = await realFetch(`${base}/api/connectors/strava/disconnect`, {
        method: "POST",
        headers: { "x-dev-clerk-id": RUN },
      });
      assert(res.ok, `HTTP ${res.status}`);
      assert((await sessionCount()) === 1, "ontkoppelen verwijderde activiteiten!");
      const resolved = await resolveClerkIdByExternalUser("strava", EXTERNAL_USER);
      assert(resolved === null, "ontkoppelde gebruiker mag niet meer oplossen");
    });
  } finally {
    globalThis.fetch = realFetch;
    await db.delete(webhookEventsTable).where(eq(webhookEventsTable.clerkId, RUN)).catch(() => {});
    await db.delete(syncRunsTable).where(eq(syncRunsTable.clerkId, RUN)).catch(() => {});
    await db
      .delete(connectorActivitiesTable)
      .where(eq(connectorActivitiesTable.clerkId, RUN))
      .catch(() => {});
    await db
      .delete(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, RUN))
      .catch(() => {});
    await db
      .delete(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, RUN))
      .catch(() => {});
    await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, RUN)).catch(() => {});
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
  console.error("strava-sync test crashed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
