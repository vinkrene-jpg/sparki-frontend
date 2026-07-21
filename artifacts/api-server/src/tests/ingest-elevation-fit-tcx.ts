// Hoogte-informatie bij FIT/TCX-INGEST — POST /api/activity-imports contract.
//
// The ingest-elevation-profile test covers GPX only. FIT and TCX uploads go
// through parseFit/parseTcx and a DIFFERENT summary path in the route (no
// parseGpxRoute merge), so a refactor there could silently drop elevation data
// without any test failing. This test closes that gap and doubles as the
// written contract for what FIT/TCX honestly store today:
//
//   1. a real TCX with <AltitudeMeters> → the stored parsedSummary keeps the
//      real climbed metres in `elevationGainM` (read back from the DB row);
//   2. a real (synthetic, spec-valid) FIT with record altitude samples → the
//      stored parsedSummary keeps `elevationGainM` computed from the real
//      positive altitude deltas;
//   3. CONTRACT: FIT/TCX summaries do NOT write `route` (geometry/profile/
//      climbs) — only GPX does, because only GPX carries per-point coordinates
//      the route deriver reads. The linked session's detail endpoint therefore
//      honestly serves profile:null and climbs:[] for FIT/TCX rides. If someone
//      later ADDS a route/profile writer for FIT/TCX, this test fails loudly so
//      the contract (and the GPX-style assertions) get updated deliberately —
//      never silently.
//   4. a TCX WITHOUT altitude → elevationGainM stays null (honest absence,
//      never fabricated).
//
// Cleanup removes only the rows/users this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:ingest-elevation-fit-tcx`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  trainingSessionsTable,
  activityImportsTable,
  connectorActivitiesTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

const RUN = `test_ingestfittcx_${Date.now()}`;
const clerkA = `${RUN}_athlete`;

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
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

// ── Real TCX builder ────────────────────────────────────────────────────────
// A schema-shaped Garmin TCX: <Id> start time, one <Lap> with authoritative
// totals, trackpoints every 30 s. With elevation the ride climbs 12 → 102 m
// (real ascent = 90 m); without, <AltitudeMeters> is simply absent.

function buildTcx(startIso: string, withAltitude: boolean): string {
  const start = Date.parse(startIso);
  const eles = [
    ...Array.from({ length: 10 }, () => 12),
    ...Array.from({ length: 10 }, (_, i) => 12 + (i + 1) * 9),
    ...Array.from({ length: 5 }, () => 102),
  ];
  const pts: string[] = [];
  for (let i = 0; i < eles.length; i++) {
    const time = new Date(start + i * 30_000).toISOString();
    const alt = withAltitude
      ? `<AltitudeMeters>${eles[i]}</AltitudeMeters>`
      : "";
    pts.push(
      `          <Trackpoint><Time>${time}</Time>${alt}<DistanceMeters>${i * 111}</DistanceMeters></Trackpoint>`,
    );
  }
  const totalSec = (eles.length - 1) * 30;
  const totalM = (eles.length - 1) * 111;
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startIso}</Id>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${totalSec}</TotalTimeSeconds>
        <DistanceMeters>${totalM}</DistanceMeters>
        <Track>
${pts.join("\n")}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

// ── Minimal FIT encoder (test fixture, mirrors src/tests/fit-parse.ts) ──────
// Builds a valid little-endian FIT file with record messages carrying real
// timestamped altitude samples (field 2, scale 5 offset 500), so the decoder's
// record path computes the ascent from real positive deltas.

const FIT_EPOCH_OFFSET_SEC = 631_065_600;

type FieldSpec = { fieldNum: number; baseType: number; value: number };
type Message = { globalNum: number; localType: number; fields: FieldSpec[] };

function baseSize(baseType: number): number {
  if ([0x00, 0x01, 0x02, 0x0d].includes(baseType)) return 1;
  if ([0x03, 0x04].includes(baseType)) return 2;
  if ([0x05, 0x06].includes(baseType)) return 4;
  throw new Error(`unsupported base size: ${baseType}`);
}

function writeValue(buf: Buffer, offset: number, baseType: number, value: number) {
  switch (baseType) {
    case 0x00:
    case 0x02:
    case 0x0d:
      buf.writeUInt8(value, offset);
      break;
    case 0x01:
      buf.writeInt8(value, offset);
      break;
    case 0x04:
      buf.writeUInt16LE(value, offset);
      break;
    case 0x03:
      buf.writeInt16LE(value, offset);
      break;
    case 0x06:
      buf.writeUInt32LE(value, offset);
      break;
    case 0x05:
      buf.writeInt32LE(value, offset);
      break;
    default:
      throw new Error(`unsupported base type in fixture: ${baseType}`);
  }
}

function encodeFit(messages: Message[]): Buffer {
  const body: Buffer[] = [];
  const defined = new Set<number>();
  for (const msg of messages) {
    if (!defined.has(msg.localType)) {
      defined.add(msg.localType);
      const def = Buffer.alloc(6 + msg.fields.length * 3);
      def.writeUInt8(0x40 | msg.localType, 0);
      def.writeUInt8(0, 1);
      def.writeUInt8(0, 2); // little endian
      def.writeUInt16LE(msg.globalNum, 3);
      def.writeUInt8(msg.fields.length, 5);
      let o = 6;
      for (const f of msg.fields) {
        def.writeUInt8(f.fieldNum, o);
        def.writeUInt8(baseSize(f.baseType), o + 1);
        def.writeUInt8(f.baseType, o + 2);
        o += 3;
      }
      body.push(def);
    }
    const dataLen = 1 + msg.fields.reduce((s, f) => s + baseSize(f.baseType), 0);
    const data = Buffer.alloc(dataLen);
    data.writeUInt8(msg.localType, 0);
    let o = 1;
    for (const f of msg.fields) {
      writeValue(data, o, f.baseType, f.value);
      o += baseSize(f.baseType);
    }
    body.push(data);
  }
  const dataBuf = Buffer.concat(body);
  const header = Buffer.alloc(12);
  header.writeUInt8(12, 0);
  header.writeUInt8(0x10, 1);
  header.writeUInt16LE(2000, 2);
  header.writeUInt32LE(dataBuf.length, 4);
  header.write(".FIT", 8, "ascii");
  return Buffer.concat([header, dataBuf, Buffer.alloc(2)]);
}

function fitTime(iso: string): number {
  return Math.round(Date.parse(iso) / 1000) - FIT_EPOCH_OFFSET_SEC;
}

// Record-only FIT ride: altitude climbs 100 → 190 m in 9 m steps (real ascent
// = 90 m), one sample per 30 s, distance ticking up. altitude raw = (m+500)*5.
function buildFitWithAltitude(startIso: string): Buffer {
  const t0 = fitTime(startIso);
  const messages: Message[] = [];
  for (let i = 0; i <= 10; i++) {
    const altM = 100 + i * 9;
    messages.push({
      globalNum: 20, // record
      localType: 1,
      fields: [
        { fieldNum: 253, baseType: 0x06, value: t0 + i * 30 }, // timestamp
        { fieldNum: 2, baseType: 0x04, value: (altM + 500) * 5 }, // altitude
        { fieldNum: 5, baseType: 0x06, value: i * 25_000 }, // distance (scale 100)
      ],
    });
  }
  return encodeFit(messages);
}

// ── State / helpers ─────────────────────────────────────────────────────────

type StoredSummary = {
  format?: unknown;
  elevationGainM?: unknown;
  route?: unknown;
};

async function loadImportRow(importId: number) {
  const [row] = await db
    .select()
    .from(activityImportsTable)
    .where(eq(activityImportsTable.id, importId));
  assert(row, `import row ${importId} must exist in DB`);
  return row!;
}

async function upload(fileName: string, payload: { content?: string; contentBase64?: string }) {
  const { status, json } = await req("POST", "/api/activity-imports", clerkA, {
    fileName,
    ...payload,
  });
  assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(json)}`);
  const body = json as {
    parsed?: unknown;
    sessionId?: unknown;
    import?: { id?: unknown };
  };
  assert(body.parsed === true, `upload must be parsed, got ${JSON.stringify(body)}`);
  assert(
    typeof body.import?.id === "number",
    `response must carry the import id, got ${JSON.stringify(body.import)}`,
  );
  return body.import!.id as number;
}

// The written contract for FIT/TCX: no `route` key (geometry/profile/climbs)
// in parsedSummary — only GPX derives a track shape. If this starts failing,
// someone added a FIT/TCX route writer: update this test to assert the profile
// like the GPX ingest test does, instead of deleting the assertion.
function assertNoRouteContract(summary: StoredSummary, label: string) {
  assert(
    !("route" in summary) || summary.route == null,
    `${label}: contract says FIT/TCX write NO route/profile — found route=${String(JSON.stringify(summary.route)).slice(0, 200)}. ` +
      "If FIT/TCX now derive a real track, update this test to assert profile/climbs like the GPX test.",
  );
}

async function assertDetailHonestlyEmpty(sessionId: number, label: string) {
  const { status, json } = await req(
    "GET",
    `/api/athlete/sessions/${sessionId}`,
    clerkA,
  );
  assert(status === 200, `${label}: detail expected 200, got ${status}`);
  const body = json as { profile?: unknown; climbs?: unknown };
  assert(
    body.profile === null,
    `${label}: detail profile must be explicit null (no fabricated profile), got ${JSON.stringify(body.profile)}`,
  );
  assert(
    Array.isArray(body.climbs) && (body.climbs as unknown[]).length === 0,
    `${label}: detail climbs must be [], got ${JSON.stringify(body.climbs)}`,
  );
}

async function cleanup() {
  await db
    .delete(activityImportsTable)
    .where(inArray(activityImportsTable.clerkId, [clerkA]));
  await db
    .delete(connectorActivitiesTable)
    .where(inArray(connectorActivitiesTable.clerkId, [clerkA]));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, [clerkA]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [clerkA]));
}

async function main() {
  await startServer();

  await scenario("seed athlete via ensureAccount (precondition)", async () => {
    await ensureAccount(clerkA, `${clerkA}@example.test`, "Atleet A", silentLogger);
    const { status } = await req("GET", "/api/athlete/sessions?limit=1", clerkA);
    assert(
      status === 200,
      `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  await scenario(
    "TCX with AltitudeMeters → stored parsedSummary keeps the real 90 m gain",
    async () => {
      const importId = await upload(`${RUN}-klim.tcx`, {
        content: buildTcx("2032-07-01T09:00:00.000Z", true),
      });
      const row = await loadImportRow(importId);
      const summary = (row.parsedSummary ?? {}) as StoredSummary;
      assert(
        summary.format === "tcx",
        `stored summary must be the TCX parse, got format=${JSON.stringify(summary.format)}`,
      );
      assert(
        summary.elevationGainM === 90,
        `stored elevationGainM must be the real 90 m ascent, got ${JSON.stringify(summary.elevationGainM)}`,
      );
      assertNoRouteContract(summary, "TCX");

      // A dated TCX must have become a linked session, and its detail endpoint
      // must honestly report no profile (contract: TCX carries no track shape).
      assert(
        row.status === "linked" && typeof row.linkedTrainingSessionId === "number",
        `dated TCX must link to a session, got status=${row.status} sessionId=${row.linkedTrainingSessionId}`,
      );
      await assertDetailHonestlyEmpty(
        row.linkedTrainingSessionId as number,
        "TCX",
      );
    },
  );

  await scenario(
    "FIT with altitude records → stored parsedSummary keeps the real 90 m gain",
    async () => {
      const buf = buildFitWithAltitude("2032-07-02T09:00:00.000Z");
      const importId = await upload(`${RUN}-klim.fit`, {
        contentBase64: buf.toString("base64"),
      });
      const row = await loadImportRow(importId);
      const summary = (row.parsedSummary ?? {}) as StoredSummary;
      assert(
        summary.format === "fit",
        `stored summary must be the FIT parse, got format=${JSON.stringify(summary.format)}`,
      );
      assert(
        summary.elevationGainM === 90,
        `stored elevationGainM must be the real 90 m ascent from record deltas, got ${JSON.stringify(summary.elevationGainM)}`,
      );
      assertNoRouteContract(summary, "FIT");

      assert(
        row.status === "linked" && typeof row.linkedTrainingSessionId === "number",
        `dated FIT must link to a session, got status=${row.status} sessionId=${row.linkedTrainingSessionId}`,
      );
      await assertDetailHonestlyEmpty(
        row.linkedTrainingSessionId as number,
        "FIT",
      );
    },
  );

  await scenario(
    "TCX without AltitudeMeters → elevationGainM stays null (honest absence)",
    async () => {
      const importId = await upload(`${RUN}-vlak.tcx`, {
        content: buildTcx("2032-07-03T09:00:00.000Z", false),
      });
      const row = await loadImportRow(importId);
      const summary = (row.parsedSummary ?? {}) as StoredSummary;
      assert(
        summary.format === "tcx",
        `stored summary must be the TCX parse, got format=${JSON.stringify(summary.format)}`,
      );
      assert(
        summary.elevationGainM === null,
        `elevationGainM must be null without altitude data — never fabricated — got ${JSON.stringify(summary.elevationGainM)}`,
      );
      assertNoRouteContract(summary, "flat TCX");
    },
  );
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log(
      "\n=== hoogte bij FIT/TCX-ingest (POST /api/activity-imports) — test results ===",
    );
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
