// Golf 11 — Garmin/Wahoo automatische datasync test harness.
//
// Dekt: adapternormalisatie (Garmin/Wahoo → canoniek), provenance per veld,
// handmatige correcties die nooit overschreven worden, idempotente webhooks,
// externe-gebruiker-resolutie en eerlijke registry-beschikbaarheid.
//
// Run: `pnpm --filter @workspace/api-server run test:provider-sync`
// Requires: DATABASE_URL (webhook/DB checks skippen zonder). Exits non-zero on
// any failure.

import { eq, and } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  connectorConnectionsTable,
  webhookEventsTable,
} from "@workspace/db";
import {
  normalizeGarminActivity,
  normalizeWahooWorkout,
  isDeviceProvider,
  isDeviceProviderConfigured,
} from "../lib/connectors/providers/device-sync";
import {
  buildMergePatch,
  updateFieldSources,
} from "../engines/data-hub/dedupe";
import {
  recordWebhookEvent,
  resolveClerkIdByExternalUser,
  processWebhookEvent,
} from "../engines/data-hub/webhooks";
import { getConnectorDefinition } from "../lib/connectors/registry";

type Status = "pass" | "fail" | "skip";
const results: { area: string; check: string; status: Status; note?: string }[] =
  [];

async function run(area: string, check: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ area, check, status: "pass" });
  } catch (err) {
    results.push({
      area,
      check,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}
function skip(area: string, check: string, note: string) {
  results.push({ area, check, status: "skip", note });
}
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  // ── 1. Garmin-normalisatie ────────────────────────────────────────────────
  await run("garmin", "volledige activiteit normaliseert met eenheden", () => {
    const a = normalizeGarminActivity({
      summaryId: "g-123",
      startTimeInSeconds: 1750000000,
      durationInSeconds: 3600,
      distanceInMeters: 40000,
      activityType: "ROAD_BIKING",
      activityName: " Ochtendrit ",
      averagePowerInWatts: 210.4,
      averageHeartRateInBeatsPerMinute: 141.6,
      totalElevationGainInMeters: 350.2,
      averageSpeedInMetersPerSecond: 11.11,
    });
    assert(a !== null, "activiteit is null");
    assert(a!.externalId === "g-123", "externalId");
    assert(a!.durationMin === 60, `durationMin=${a!.durationMin}`);
    assert(a!.distanceKm === 40, `distanceKm=${a!.distanceKm}`);
    assert(a!.avgPower === 210, "avgPower afgerond");
    assert(a!.avgHR === 142, "avgHR afgerond");
    assert(a!.elevationM === 350, "elevationM afgerond");
    assert(a!.avgSpeedKph === 40, `avgSpeedKph=${a!.avgSpeedKph}`);
    assert(a!.title === "Ochtendrit", "titel getrimd");
    assert(
      a!.startedAt === new Date(1750000000 * 1000).toISOString(),
      "startedAt uit epoch-seconden",
    );
  });

  await run("garmin", "zonder summaryId of starttijd ⇒ null (nooit verzinnen)", () => {
    assert(
      normalizeGarminActivity({ startTimeInSeconds: 1750000000 }) === null,
      "ontbrekende summaryId moet null geven",
    );
    assert(
      normalizeGarminActivity({ summaryId: "x" }) === null,
      "ontbrekende starttijd moet null geven",
    );
  });

  await run("garmin", "onbekend activiteitstype valt terug op cycling", () => {
    const a = normalizeGarminActivity({
      summaryId: "g-1",
      startTimeInSeconds: 1750000000,
      activityType: "SOMETHING_WEIRD",
    });
    assert(a !== null && a.sport === "cycling", `sport=${a?.sport}`);
  });

  // ── 2. Wahoo-normalisatie ─────────────────────────────────────────────────
  await run("wahoo", "workout met summary normaliseert", () => {
    const a = normalizeWahooWorkout({
      id: 987,
      starts: "2026-07-01T08:00:00.000Z",
      workout_type_id: 0,
      name: "Duurtraining",
      workout_summary: {
        duration_active_accum: "5400",
        distance_accum: "60000",
        power_avg: "180",
        heart_rate_avg: "135",
        speed_avg: "11.0",
      },
    });
    assert(a !== null, "workout is null");
    assert(a!.externalId === "987", "externalId als string");
    assert(a!.durationMin === 90, `durationMin=${a!.durationMin}`);
    assert(a!.distanceKm === 60, `distanceKm=${a!.distanceKm}`);
    assert(a!.sport === "cycling", "sport cycling");
  });

  await run("wahoo", "sport-mapping: running/mtb-ids en onbekend ⇒ cycling", () => {
    const mk = (typeId: number) =>
      normalizeWahooWorkout({
        id: 1,
        starts: "2026-07-01T08:00:00.000Z",
        workout_type_id: typeId,
      });
    assert(mk(1)!.sport === "running", "type 1 = running");
    assert(mk(62)!.sport === "mountainbike", "type 62 = mtb");
    assert(mk(999)!.sport === "cycling", "onbekend type = cycling");
  });

  await run("wahoo", "ongeldige starttijd of ontbrekend id ⇒ null", () => {
    assert(
      normalizeWahooWorkout({ id: 1, starts: "geen-datum" }) === null,
      "ongeldige datum moet null geven",
    );
    assert(
      normalizeWahooWorkout({ starts: "2026-07-01T08:00:00Z" }) === null,
      "ontbrekend id moet null geven",
    );
  });

  // ── 3. Provenance + handmatige correcties ─────────────────────────────────
  await run("provenance", "buildMergePatch vult alleen lege velden", () => {
    const patch = buildMergePatch(
      { avgPower: 200, avgHR: null },
      { avgPower: 190, avgHR: 140 },
    );
    assert(!("avgPower" in patch), "bestaande waarde nooit overschreven");
    assert(patch["avgHR"] === 140, "leeg veld wordt gevuld");
  });

  await run("provenance", "handmatig gecorrigeerd veld wordt NOOIT gevuld", () => {
    const patch = buildMergePatch(
      { avgHR: null, notes: null },
      { avgHR: 140, notes: "auto" },
      ["avgHR"],
    );
    assert(!("avgHR" in patch), "manual veld overslaan — ook als het leeg is");
    assert(patch["notes"] === "auto", "niet-manual veld gewoon gevuld");
  });

  await run("provenance", "updateFieldSources: eerste bron houdt het veld", () => {
    const first = updateFieldSources(null, { avgPower: 200 }, "garmin");
    assert(first["avgPower"] === "garmin", "eerste bron geregistreerd");
    const second = updateFieldSources(first, { avgPower: 190, avgHR: 140 }, "wahoo");
    assert(second["avgPower"] === "garmin", "bestaande herkomst blijft staan");
    assert(second["avgHR"] === "wahoo", "nieuw veld krijgt nieuwe bron");
    const none = updateFieldSources(first, { avgHR: null }, "wahoo");
    assert(!("avgHR" in none), "null-waarde krijgt geen herkomst");
  });

  // ── 4. Registry-eerlijkheid ───────────────────────────────────────────────
  await run("registry", "garmin/wahoo zijn device-providers in de registry", () => {
    assert(isDeviceProvider("garmin") && isDeviceProvider("wahoo"), "beide device");
    assert(!isDeviceProvider("strava"), "strava niet");
    for (const id of ["garmin", "wahoo"] as const) {
      const def = getConnectorDefinition(id);
      assert(!!def, `${id} in registry`);
      assert(def!.authType === "oauth", `${id} oauth`);
      // Eerlijk: zonder fabrikantsleutels is de koppeling niet beschikbaar en
      // draagt hij een reden — nooit een nep-"beschikbaar".
      if (!isDeviceProviderConfigured(id)) {
        assert(def!.available === false, `${id} eerlijk niet beschikbaar`);
        assert(
          typeof def!.unavailableReason === "string" && def!.unavailableReason.length > 0,
          `${id} draagt een reden`,
        );
      }
    }
  });

  // ── 5. Webhooks (DB-gebonden) ─────────────────────────────────────────────
  const hasDb = !!process.env["DATABASE_URL"];
  const EXT = `test-ext-${Date.now()}`;
  const EVT = `test-evt-${Date.now()}`;
  let clerkId: string | null = null;

  if (!hasDb) {
    skip("webhooks", "alle DB-checks", "geen DATABASE_URL");
  } else {
    const profiles = await db.select().from(userProfilesTable).limit(1);
    clerkId = profiles[0]?.clerkId ?? null;

    await run("webhooks", "recordWebhookEvent is idempotent (zelfde event 2x)", async () => {
      const first = await recordWebhookEvent({
        provider: "garmin",
        eventId: EVT,
        externalUserId: EXT,
        payload: { test: true },
      });
      assert(!first.duplicate && !!first.event, "eerste keer aangemaakt");
      const second = await recordWebhookEvent({
        provider: "garmin",
        eventId: EVT,
        externalUserId: EXT,
        payload: { test: true },
      });
      assert(second.duplicate && second.event === null, "tweede keer duplicaat, geen nieuwe rij");
      
    });

    await run("webhooks", "onbekende externe gebruiker resolvet naar null", async () => {
      const resolved = await resolveClerkIdByExternalUser("garmin", "bestaat-niet-xyz");
      assert(resolved === null, "onbekend extern id ⇒ null, nooit gokken");
    });

    if (!clerkId) {
      skip("webhooks", "resolutie + verwerking", "geen user_profiles rij");
    } else {
      await run("webhooks", "bekende externe gebruiker resolvet naar clerkId", async () => {
        await db
          .insert(connectorConnectionsTable)
          .values({
            clerkId: clerkId!,
            provider: "garmin",
            status: "connected",
            externalUserId: EXT,
          })
          .onConflictDoUpdate({
            target: [
              connectorConnectionsTable.clerkId,
              connectorConnectionsTable.provider,
            ],
            set: { externalUserId: EXT, status: "connected" },
          });
        const resolved = await resolveClerkIdByExternalUser("garmin", EXT);
        assert(resolved === clerkId, `resolved=${resolved}`);
      });

      await run("webhooks", "event zonder herleidbare gebruiker ⇒ skipped (niet failed)", async () => {
        const evtId = `${EVT}-orphan`;
        const rec = await recordWebhookEvent({
          provider: "garmin",
          eventId: evtId,
          externalUserId: "niemand-hier",
          payload: {},
        });
        const out = await processWebhookEvent(rec.event!);
        assert(out.status === "skipped", `status=${out.status}`);
        const [row] = await db
          .select()
          .from(webhookEventsTable)
          .where(eq(webhookEventsTable.id, rec.event!.id));
        assert(row!.status === "skipped", "status persisted als skipped");
      });

      await run("webhooks", "verwerking zet attempts + eindstatus (nooit stil verdwijnen)", async () => {
        const evtId = `${EVT}-proc`;
        const rec = await recordWebhookEvent({
          provider: "garmin",
          eventId: evtId,
          externalUserId: EXT,
          payload: {},
        });
        const out = await processWebhookEvent(rec.event!);
        // Zonder echte Garmin-tokens faalt de sync eerlijk — dat is het punt:
        // de uitkomst is processed OF failed-met-fout, nooit een stille no-op.
        assert(
          out.status === "processed" || out.status === "failed",
          `status=${out.status}`,
        );
        const [row] = await db
          .select()
          .from(webhookEventsTable)
          .where(eq(webhookEventsTable.id, rec.event!.id));
        assert(row!.attempts >= 1, "attempts geregistreerd");
        assert(
          row!.status === "processed" || (row!.status === "failed" && !!row!.lastError),
          "failed draagt altijd een lastError",
        );
      });
    }

    // Opruimen: alleen eigen testrijen.
    await db
      .delete(webhookEventsTable)
      .where(eq(webhookEventsTable.externalUserId, EXT));
    await db
      .delete(webhookEventsTable)
      .where(
        and(
          eq(webhookEventsTable.provider, "garmin"),
          eq(webhookEventsTable.eventId, EVT),
        ),
      );
    if (clerkId) {
      await db
        .update(connectorConnectionsTable)
        .set({ externalUserId: null })
        .where(
          and(
            eq(connectorConnectionsTable.clerkId, clerkId),
            eq(connectorConnectionsTable.provider, "garmin"),
            eq(connectorConnectionsTable.externalUserId, EXT),
          ),
        );
    }
  }

  // ── Rapport ───────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : r.status === "skip" ? "⏭️" : "❌";
    if (r.status === "fail") failed++;
    console.log(`${mark} [${r.area}] ${r.check}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(
    `\n${results.filter((r) => r.status === "pass").length} pass, ${failed} fail, ${results.filter((r) => r.status === "skip").length} skip`,
  );
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Test harness crashed:", err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
