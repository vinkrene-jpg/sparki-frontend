// Sparki Connect — centrale bestandsimport (opdracht 3B) testharnas.
//
// Bewijst het eerlijke importcontract van POST /api/activity-imports:
//   - validatie vóór verwerking: onbekend bestandstype en lege bestanden
//     krijgen een duidelijke Nederlandse 400, geen stille placeholder-rij;
//   - herkomst (provenance): elke verwerkte upload draagt checksum,
//     parserVersion en een eerlijke dedupeStatus (new / merged_existing /
//     route_only);
//   - duplicaatwaarschuwing: byte-identieke bestanden (ook hernoemd) leveren
//     duplicate:true met de bestaande import — geen tweede rij, geen tweede
//     sessie; de dedupe is per gebruiker (geen cross-account lek);
//   - capability-eerlijkheid: geen enkel platform claimt vandaag werkende
//     gezondheidsdata ("health_data" nooit "available"); Garmin is eerlijk
//     "prepared_not_active" voor gezondheidsdata; GET /api/connectors lekt
//     nooit tokens.
//
// Boots the REAL Express app; DB rows are cleaned up afterwards.
// Run: `pnpm --filter @workspace/api-server run test:connect-import`
// Requires: DATABASE_URL + DEV_AUTH_BYPASS=true. Exits non-zero on failure.

import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  activityImportsTable,
  trainingSessionsTable,
  connectorActivitiesTable,
  userProfilesTable,
} from "@workspace/db";
import app from "../app";
import { FILE_PARSER_VERSION } from "../lib/activity-file-ingest";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
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

const RUN = `test_connimp_${Date.now()}`;
const userA = `${RUN}_a`;
const userB = `${RUN}_b`;

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

async function upload(
  clerkId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/activity-imports`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

// GPX mét tijden → wordt een echte training (dedupeStatus "new").
function timedGpx(startIso: string): string {
  const t = (offsetMs: number) =>
    new Date(Date.parse(startIso) + offsetMs).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="sparki-test" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><name>Testrit</name><trkseg>
  <trkpt lat="52.0900" lon="5.1210"><ele>10</ele><time>${t(0)}</time></trkpt>
  <trkpt lat="52.0950" lon="5.1300"><ele>14</ele><time>${t(600_000)}</time></trkpt>
  <trkpt lat="52.1000" lon="5.1400"><ele>18</ele><time>${t(1200_000)}</time></trkpt>
  <trkpt lat="52.1050" lon="5.1500"><ele>16</ele><time>${t(1800_000)}</time></trkpt>
 </trkseg></trk>
</gpx>`;
}

// GPX zónder tijden → een kale route, geen training (dedupeStatus "route_only").
const ROUTE_ONLY_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="sparki-test" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><name>Testroute</name><trkseg>
  <trkpt lat="52.0900" lon="5.1210"><ele>10</ele></trkpt>
  <trkpt lat="52.0950" lon="5.1300"><ele>14</ele></trkpt>
  <trkpt lat="52.1000" lon="5.1400"><ele>18</ele></trkpt>
 </trkseg></trk>
</gpx>`;

async function importRows(clerkId: string) {
  return db
    .select()
    .from(activityImportsTable)
    .where(eq(activityImportsTable.clerkId, clerkId));
}

async function main() {
  // Seed beide gebruikers zodat de dev-bypass ze kan resolven.
  await db
    .insert(userProfilesTable)
    .values([
      { clerkId: userA, email: `${userA}@test.local`, displayName: "Import A" },
      { clerkId: userB, email: `${userB}@test.local`, displayName: "Import B" },
    ])
    .onConflictDoNothing();
  await startServer();

  const gpxContent = timedGpx("2026-07-20T09:00:00.000Z");

  await scenario("onbekend bestandstype → 400 met Nederlandse uitleg", async () => {
    const r = await upload(userA, { fileName: "foto.jpg", content: "xxx" });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    const err = String(r.json.error ?? "");
    assert(err.includes("bestandstype"), `onduidelijke fout: ${err}`);
    assert(!/unknown|invalid|error code/i.test(err), "geen interne codes in de melding");
  });

  await scenario("leeg tekstbestand → 400", async () => {
    const r = await upload(userA, { fileName: "leeg.gpx", content: "   " });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    assert(String(r.json.error ?? "").includes("leeg"), "melding benoemt 'leeg'");
  });

  await scenario("leeg FIT-bestand (geen base64) → 400", async () => {
    const r = await upload(userA, { fileName: "leeg.fit", contentBase64: "" });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  let firstImportId = 0;
  await scenario(
    "GPX-upload → 201 met checksum, parserVersion en dedupeStatus 'new'",
    async () => {
      const r = await upload(userA, { fileName: "rit.gpx", content: gpxContent });
      assert(r.status === 201, `verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
      const imp = r.json.import as Record<string, unknown>;
      assert(typeof imp.checksum === "string" && (imp.checksum as string).length === 40,
        "checksum (sha1-hex) ontbreekt");
      assert(imp.parserVersion === FILE_PARSER_VERSION, `parserVersion=${imp.parserVersion}`);
      assert(imp.dedupeStatus === "new", `dedupeStatus=${imp.dedupeStatus}`);
      assert(typeof r.json.sessionId === "number" || imp.linkedTrainingSessionId != null,
        "verwachtte een echte sessie voor een gedateerde rit");
      firstImportId = Number(imp.id);
    },
  );

  await scenario(
    "zelfde bytes, andere bestandsnaam → duplicate:true, geen nieuwe rij",
    async () => {
      const before = (await importRows(userA)).length;
      const r = await upload(userA, { fileName: "hernoemd.gpx", content: gpxContent });
      assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
      assert(r.json.duplicate === true, "duplicate-vlag ontbreekt");
      const imp = r.json.import as Record<string, unknown>;
      assert(Number(imp.id) === firstImportId, "duplicaat wijst niet naar bestaande import");
      const msg = String(r.json.message ?? "");
      assert(msg.includes("al geïmporteerd"), `melding onduidelijk: ${msg}`);
      const after = (await importRows(userA)).length;
      assert(after === before, `rijen: ${before} → ${after} (mag niet groeien)`);
    },
  );

  await scenario("dedupe is per gebruiker — zelfde bytes bij B is géén duplicaat", async () => {
    const r = await upload(userB, { fileName: "rit.gpx", content: gpxContent });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    assert(r.json.duplicate !== true, "cross-account duplicaat gelekt");
  });

  await scenario("GPX zonder tijden → dedupeStatus 'route_only', geen sessie", async () => {
    const r = await upload(userA, { fileName: "route.gpx", content: ROUTE_ONLY_GPX });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    const imp = r.json.import as Record<string, unknown>;
    assert(imp.dedupeStatus === "route_only", `dedupeStatus=${imp.dedupeStatus}`);
    assert(r.json.sessionId == null, "route zonder tijd mag geen sessie opleveren");
    assert(typeof imp.checksum === "string", "ook routes dragen een checksum");
  });

  await scenario("te groot FIT-bestand (>8 MB) → 400", async () => {
    const big = Buffer.alloc(8 * 1024 * 1024 + 16, 1).toString("base64");
    const r = await upload(userA, { fileName: "groot.fit", contentBase64: big });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    assert(String(r.json.error ?? "").includes("te groot"), "melding benoemt 'te groot'");
  });

  await scenario("CSV: placeholder mét checksum; tweede upload is duplicaat", async () => {
    const csv = "tijd,vermogen\n0,200\n1,210\n";
    const r1 = await upload(userA, { fileName: "meting.csv", content: csv });
    assert(r1.status === 201, `verwacht 201, kreeg ${r1.status}`);
    const imp = r1.json.import as Record<string, unknown>;
    assert(imp.status === "uploaded", `status=${imp.status}`);
    assert(typeof imp.checksum === "string", "CSV-rij zonder checksum");
    const r2 = await upload(userA, { fileName: "meting-kopie.csv", content: csv });
    assert(r2.status === 200 && r2.json.duplicate === true, "CSV-duplicaat niet herkend");
  });

  await scenario("kapotte GPX → eerlijke foutrij mét parserVersion", async () => {
    const r = await upload(userA, { fileName: "kapot.gpx", content: "<gpx><niets/></gpx>" });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    const imp = r.json.import as Record<string, unknown>;
    assert(imp.status === "failed", `status=${imp.status}`);
    assert(typeof imp.errorMessage === "string" && (imp.errorMessage as string).length > 0,
      "foutrij zonder uitleg");
    assert(imp.parserVersion === FILE_PARSER_VERSION, "parserVersion ontbreekt op foutrij");
  });

  await scenario("geen enkel platform claimt werkende gezondheidsdata", async () => {
    const res = await fetch(`${baseUrl}/api/connectors`, {
      headers: { "x-dev-clerk-id": userA },
    });
    assert(res.status === 200, `GET /api/connectors → ${res.status}`);
    const body = (await res.json()) as {
      connectors: { id: string; capabilities: Record<string, string> }[];
    };
    for (const c of body.connectors) {
      assert(
        c.capabilities.health_data !== "available",
        `${c.id} claimt health_data 'available' zonder echte fetcher`,
      );
    }
    const garmin = body.connectors.find((c) => c.id === "garmin");
    assert(garmin, "Garmin ontbreekt in registry");
    assert(
      garmin!.capabilities.health_data === "prepared_not_active",
      `Garmin health_data=${garmin!.capabilities.health_data}`,
    );
    assert(
      garmin!.capabilities.activity_import === "awaiting_official_access" ||
        garmin!.capabilities.activity_import === "available",
      `Garmin activity_import=${garmin!.capabilities.activity_import}`,
    );
  });

  await scenario("GET /api/connectors lekt nooit tokens", async () => {
    const res = await fetch(`${baseUrl}/api/connectors`, {
      headers: { "x-dev-clerk-id": userA },
    });
    const raw = await res.text();
    assert(!raw.includes("accessToken"), "accessToken-veld in respons");
    assert(!raw.includes("refreshToken"), "refreshToken-veld in respons");
  });

  // ── Opruimen ──
  const rows = await db
    .select({ id: activityImportsTable.id, sid: activityImportsTable.linkedTrainingSessionId })
    .from(activityImportsTable)
    .where(inArray(activityImportsTable.clerkId, [userA, userB]));
  if (rows.length > 0) {
    await db
      .delete(activityImportsTable)
      .where(inArray(activityImportsTable.clerkId, [userA, userB]));
  }
  await db
    .delete(connectorActivitiesTable)
    .where(inArray(connectorActivitiesTable.clerkId, [userA, userB]));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, [userA, userB]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [userA, userB]));

  await stopServer();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    if (r.status === "fail") failed++;
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testharnas crashte:", err);
  try {
    await stopServer();
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
