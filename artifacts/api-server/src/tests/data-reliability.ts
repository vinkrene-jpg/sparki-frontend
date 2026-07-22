// Data-betrouwbaarheid — ketentest (Afbouwgolf 2).
//
// Bewijst dat de volledige keten databron → Data Hub → activiteit →
// berekeningen → Vandaag betrouwbaar is: idempotente imports, cross-source
// dedupe, transactionele opslag (rollback bij fouten), automatische retry voor
// tijdelijke fouten, zichtbare permanente fouten, eerlijke ontbrekende streams,
// correcte bronherkomst en privacy-afscherming.
//
// Gebruikt een VASTE synthetische testatleet met reproduceerbare GPX-data —
// nooit productiegegevens. Boot de echte Express-app als dev-gebruiker.
//
// Run: `pnpm --filter @workspace/api-server run test:data-reliability`
// Vereist: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  activityImportsTable,
  athleteProfilesTable,
  connectorActivitiesTable,
  trainingSessionsTable,
  userProfilesTable,
  type ConnectorDataType,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { ingestBatch } from "../engines/data-hub/ingest";
import { withTransientRetry, isTransientError } from "../engines/data-hub";
import { healthCheckDefinitions } from "../lib/health/checks";
import type { CanonicalActivity } from "../engines/data-hub/types";

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

// ── Server boot ──────────────────────────────────────────────────────────────
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

// ── Vaste synthetische testatleet ────────────────────────────────────────────
// Vast, herkenbaar id (geen timestamp): iedere run seedt exact dezelfde atleet
// opnieuw, dus de test is reproduceerbaar en raakt nooit echte gebruikers.
const SYNTH_CLERK_ID = "synthetic_ketentest_atleet";
const OTHER_CLERK_ID = "synthetic_ketentest_buurman";

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO-starttijd op een vaste kloktijd van een lokale kalenderdag. */
function startAt(date: string, hour: number, minute = 0): string {
  const d = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hour,
    minute,
    0,
  );
  return d.toISOString();
}

// Reproduceerbare GPX: rechte lijn noordwaarts, 1 punt per 30s, deterministische
// coördinaten. `sensors` voegt echte hr/cad/power-extensies toe.
function buildGpx(opts: {
  startIso: string;
  points: number;
  sensors?: boolean;
  name?: string;
}): string {
  const start = new Date(opts.startIso).getTime();
  const pts: string[] = [];
  for (let i = 0; i < opts.points; i++) {
    const lat = (52.09 + i * 0.0008).toFixed(6);
    const t = new Date(start + i * 30_000).toISOString();
    const ext = opts.sensors
      ? `<extensions><power>${200 + (i % 5) * 10}</power><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + (i % 7)}</gpxtpx:hr><gpxtpx:cad>${88 + (i % 3)}</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>`
      : "";
    pts.push(
      `<trkpt lat="${lat}" lon="5.120000"><ele>${10 + (i % 4)}</ele><time>${t}</time>${ext}</trkpt>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="sparki-ketentest" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>${opts.name ?? "Ketentest-rit"}</name><trkseg>${pts.join("")}</trkseg></trk>
</gpx>`;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  asClerkId: string = SYNTH_CLERK_ID,
): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": asClerkId,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: res.status,
    body: await res.json().catch(() => null),
    headers: res.headers,
  };
}

async function sessionsOf(clerkId: string) {
  return db
    .select()
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, clerkId));
}

async function provenanceOf(clerkId: string) {
  return db
    .select()
    .from(connectorActivitiesTable)
    .where(eq(connectorActivitiesTable.clerkId, clerkId));
}

const ALLOW_ACTIVITIES = new Set<ConnectorDataType>([
  "activities",
  "training_history",
]);

async function cleanup() {
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [SYNTH_CLERK_ID, OTHER_CLERK_ID]))
    .catch(() => {});
}

async function seedSyntheticAthlete() {
  await cleanup();
  await ensureAccount(
    SYNTH_CLERK_ID,
    "ketentest@sparki.test",
    "Synthetische Testatleet",
    silentLogger,
  );
  await ensureAccount(
    OTHER_CLERK_ID,
    "ketentest-buurman@sparki.test",
    "Ketentest Buurman",
    silentLogger,
  );
  // Vaste FTP zodat belastingscores deterministisch afleidbaar zijn.
  await db
    .update(athleteProfilesTable)
    .set({ ftp: 250 })
    .where(eq(athleteProfilesTable.clerkId, SYNTH_CLERK_ID));
}

// Deterministische activiteit voor directe hub-ingest (bron "strava"-achtig).
function canonicalRide(overrides: Partial<CanonicalActivity> = {}): CanonicalActivity {
  return {
    externalId: "synth-ride-1",
    sport: "cycling",
    startedAt: startAt(localDate(-2), 9),
    title: "Ketentest duurrit",
    durationMin: 60,
    distanceKm: 30,
    elevationM: 120,
    avgPower: 200,
    normalizedPower: 210,
    avgHR: 145,
    maxHR: 168,
    avgCadence: 90,
    avgSpeedKph: 30,
    tss: null,
    ...overrides,
  } as CanonicalActivity;
}

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL ontbreekt");
  assert(process.env.NODE_ENV !== "production", "niet in productie draaien");
  await seedSyntheticAthlete();
  await startServer();

  const dagImport = localDate(-1);
  const gpxA = buildGpx({ startIso: startAt(dagImport, 8), points: 120, sensors: true });

  // 1) Dezelfde activiteit tweemaal via dezelfde bron ─────────────────────────
  await scenario("idempotentie: zelfde bestand tweemaal via zelfde bron", async () => {
    const eerste = await api("POST", "/api/activity-imports", {
      fileName: "ketentest-rit.gpx",
      content: gpxA,
    });
    assert(eerste.status === 201, `upload 1 faalde (${eerste.status})`);
    const tweede = await api("POST", "/api/activity-imports", {
      fileName: "ketentest-rit.gpx",
      content: gpxA,
    });
    assert(tweede.status === 201, `upload 2 faalde (${tweede.status})`);
    const rows = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagImport,
    );
    assert(rows.length === 1, `verwacht 1 sessie, kreeg ${rows.length}`);
    // Herkomst blijft één rij per (bron, bestand): idempotent.
    const prov = (await provenanceOf(SYNTH_CLERK_ID)).filter(
      (p) => p.provider === "file",
    );
    assert(prov.length === 1, `verwacht 1 herkomstrij, kreeg ${prov.length}`);
  });

  // 2) Dezelfde activiteit via twee verschillende bronnen ─────────────────────
  await scenario("dedupe: zelfde rit via twee bronnen wordt samengevoegd", async () => {
    const before = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagImport,
    );
    assert(before.length === 1, "beginsituatie klopt niet");
    const counts = await ingestBatch(
      SYNTH_CLERK_ID,
      "strava",
      {
        importedDataTypes: ["activities", "training_history"],
        activities: [
          canonicalRide({
            externalId: "strava-999",
            startedAt: startAt(dagImport, 8, 1),
            durationMin: before[0]!.durationMin,
            distanceKm: before[0]!.distanceKm ? Number(before[0]!.distanceKm) : null,
          }),
        ],
      },
      { allowed: ALLOW_ACTIVITIES },
    );
    assert((counts.merged ?? 0) === 1, `verwacht merge, kreeg ${JSON.stringify(counts)}`);
    const after = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagImport,
    );
    assert(after.length === 1, `dubbele sessie ontstaan (${after.length})`);
    const sources = (after[0]!.sources ?? []) as string[];
    assert(
      sources.includes("file") && sources.includes("strava"),
      `bronnen onvolledig: ${JSON.stringify(sources)}`,
    );
  });

  // 3+9) Onderbreking halverwege + databasefout met volledige rollback ────────
  const dagPoison = localDate(-3);
  await scenario("transactie: fout halverwege batch — rest blijft, kapotte rolt terug", async () => {
    // De "raw"-payload met een circulaire verwijzing kan niet als JSON worden
    // opgeslagen → de databasefout ontstaat NA de sessie-insert, precies wat
    // een onderbreking halverwege simuleert. De transactie moet ALLES van die
    // ene activiteit terugdraaien; de twee gezonde activiteiten blijven staan.
    const poison: Record<string, unknown> = {};
    poison.self = poison;
    const counts = await ingestBatch(
      SYNTH_CLERK_ID,
      "strava",
      {
        importedDataTypes: ["activities", "training_history"],
        activities: [
          canonicalRide({ externalId: "ok-1", startedAt: startAt(dagPoison, 7) }),
          canonicalRide({
            externalId: "kapot-2",
            startedAt: startAt(dagPoison, 12),
            raw: poison as never,
          }),
          canonicalRide({ externalId: "ok-3", startedAt: startAt(dagPoison, 17) }),
        ],
      },
      { allowed: ALLOW_ACTIVITIES },
    );
    assert((counts.activities ?? 0) === 2, `verwacht 2 nieuwe, kreeg ${JSON.stringify(counts)}`);
    assert((counts.errors ?? 0) === 1, "fout niet geteld");
    assert((counts.errorSamples ?? []).length === 1, "foutvoorbeeld ontbreekt");
    const rows = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagPoison,
    );
    assert(rows.length === 2, `verwacht 2 sessies, kreeg ${rows.length} (halve rij?)`);
    const prov = (await provenanceOf(SYNTH_CLERK_ID)).filter(
      (p) => p.externalActivityId === "kapot-2",
    );
    assert(prov.length === 0, "herkomstrij van kapotte activiteit bleef staan (geen rollback)");
  });

  // 4) Tijdelijke fout met succesvolle retry ─────────────────────────────────
  await scenario("retry: tijdelijke fout wordt automatisch herkanst", async () => {
    let calls = 0;
    const result = await withTransientRetry(async () => {
      calls += 1;
      if (calls === 1) throw new Error("fetch failed");
      return "ok";
    }, 2, 1);
    assert(result === "ok" && calls === 2, `verwacht 2 pogingen, kreeg ${calls}`);
    // Permanente fout wordt NIET herkanst.
    let permCalls = 0;
    let threw = false;
    try {
      await withTransientRetry(async () => {
        permCalls += 1;
        throw new Error("Ongeldige koppeling: token geweigerd (401)");
      }, 2, 1);
    } catch {
      threw = true;
    }
    assert(threw && permCalls === 1, `permanente fout werd herkanst (${permCalls}x)`);
    assert(isTransientError(new Error("ETIMEDOUT")), "timeout niet als tijdelijk herkend");
    assert(!isTransientError(new Error("ongeldig bestand")), "permanente fout als tijdelijk herkend");
  });

  // 5+7) Corrupte bestanden → permanente, zichtbare fout ─────────────────────
  await scenario("eerlijkheid: corrupte GPX/FIT/TCX geven zichtbare foutstatus", async () => {
    const before = (await sessionsOf(SYNTH_CLERK_ID)).length;
    const corrupts: [string, Record<string, string>][] = [
      ["kapot.gpx", { content: "dit is geen xml <<<" }],
      ["kapot.tcx", { content: "<TrainingCenterDatabase><Activities>" }],
      ["kapot.fit", { contentBase64: Buffer.from("zeker-geen-fit-bestand").toString("base64") }],
    ];
    for (const [fileName, payload] of corrupts) {
      const res = await api("POST", "/api/activity-imports", { fileName, ...payload });
      assert(res.status === 201, `${fileName}: upload-route crashte (${res.status})`);
      assert(res.body?.parsed === false, `${fileName}: corrupt bestand werd 'geparsed'`);
      assert(
        res.body?.import?.status === "failed" && res.body?.import?.errorMessage,
        `${fileName}: geen zichtbare foutstatus/foutreden`,
      );
    }
    const after = (await sessionsOf(SYNTH_CLERK_ID)).length;
    assert(after === before, "corrupt bestand maakte toch een sessie aan");
    // Zichtbaar voor de gebruiker in het importoverzicht.
    const lijst = await api("GET", "/api/activity-imports");
    const failed = (lijst.body?.imports ?? []).filter(
      (i: { status: string }) => i.status === "failed",
    );
    assert(failed.length >= 3, "mislukte imports niet zichtbaar in overzicht");
  });

  // 6) Ontbrekende hartslag/vermogen/cadans blijven eerlijk leeg ─────────────
  const dagKaal = localDate(-4);
  await scenario("eerlijkheid: ontbrekende sensordata wordt nooit verzonnen", async () => {
    const gpxKaal = buildGpx({ startIso: startAt(dagKaal, 10), points: 60, sensors: false });
    const res = await api("POST", "/api/activity-imports", {
      fileName: "kale-rit.gpx",
      content: gpxKaal,
    });
    assert(res.status === 201 && res.body?.import?.status === "linked", "kale rit niet verwerkt");
    const rows = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagKaal,
    );
    assert(rows.length === 1, "kale rit ontbreekt");
    const s = rows[0]!;
    assert(s.avgHR == null, "hartslag verzonnen");
    assert(s.avgPower == null, "vermogen verzonnen");
    assert(s.avgCadence == null, "cadans verzonnen");
    assert(s.tss == null, "belastingscore verzonnen zonder vermogen");
  });

  // 8) Herverwerking zonder dubbele belasting ────────────────────────────────
  await scenario("herverwerking: opnieuw uploaden verandert belasting niet", async () => {
    const before = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagImport,
    );
    const tssBefore = before[0]!.tss;
    const res = await api("POST", "/api/activity-imports", {
      fileName: "ketentest-rit-opnieuw.gpx",
      content: gpxA,
    });
    assert(res.status === 201, "herupload faalde");
    const after = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagImport,
    );
    assert(after.length === 1, `herverwerking maakte een dubbele sessie (${after.length})`);
    assert(after[0]!.tss === tssBefore, `belastingscore veranderde: ${tssBefore} → ${after[0]!.tss}`);
  });

  // 10) Correcte bronherkomst ────────────────────────────────────────────────
  await scenario("herkomst: iedere activiteit kent haar oorspronkelijke bron", async () => {
    const rows = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === dagImport,
    );
    const s = rows[0]!;
    assert(s.source === "file", `oorspronkelijke bron klopt niet: ${s.source}`);
    assert(s.externalRef?.startsWith("file:"), "externalRef mist bestandsherkomst");
    const prov = (await provenanceOf(SYNTH_CLERK_ID)).filter(
      (p) => p.normalizedSessionId === s.id,
    );
    const providers = prov.map((p) => p.provider).sort();
    assert(
      providers.includes("file") && providers.includes("strava"),
      `herkomstrijen onvolledig: ${JSON.stringify(providers)}`,
    );
    assert(
      prov.every((p) => p.importedAt != null),
      "tijdstip laatste verwerking ontbreekt op herkomstrij",
    );
  });

  // 11) Synthetische ketentest: import → berekening → Vandaag ────────────────
  await scenario("keten: synthetische atleet van import tot Vandaag", async () => {
    const vandaag = localDate(0);
    const gpxVandaag = buildGpx({
      startIso: startAt(vandaag, 7),
      points: 120,
      sensors: true,
      name: "Ochtendrit ketentest",
    });
    const res = await api("POST", "/api/activity-imports", {
      fileName: "vandaag.gpx",
      content: gpxVandaag,
    });
    assert(res.status === 201 && res.body?.import?.status === "linked", "import van vandaag faalde");
    const rows = (await sessionsOf(SYNTH_CLERK_ID)).filter(
      (r) => r.sessionDate === vandaag,
    );
    assert(rows.length === 1, "sessie van vandaag ontbreekt");
    // Berekening: vermogen + FTP=250 ⇒ afgeleide belastingscore (nooit verzonnen).
    assert(rows[0]!.tss != null && rows[0]!.tss! > 0, "belastingscore niet afgeleid");
    // Vandaag-oppervlak: het dashboard ziet de sessie van vandaag echt.
    const dash = await api("GET", "/api/athlete/dashboard");
    assert(dash.status === 200, `dashboard faalde (${dash.status})`);
    const dashJson = JSON.stringify(dash.body);
    assert(
      dashJson.includes(vandaag),
      "de rit van vandaag is niet zichtbaar op het Vandaag-oppervlak",
    );
  });

  // 12) Rollen en privacy blijven afgeschermd ────────────────────────────────
  await scenario("privacy: een andere gebruiker ziet niets van de testatleet", async () => {
    const lijst = await api("GET", "/api/activity-imports", undefined, OTHER_CLERK_ID);
    assert(lijst.status === 200, "importlijst buurman faalde");
    assert((lijst.body?.imports ?? []).length === 0, "buurman ziet andermans imports");
    const eigen = (await sessionsOf(SYNTH_CLERK_ID))[0]!;
    const detail = await api(
      "GET",
      `/api/athlete/sessions/${eigen.id}`,
      undefined,
      OTHER_CLERK_ID,
    );
    assert(
      detail.status === 404 || detail.status === 403,
      `buurman kan andermans sessie lezen (${detail.status})`,
    );
    const buurmanSessies = await sessionsOf(OTHER_CLERK_ID);
    assert(buurmanSessies.length === 0, "data lekte naar de buurman");
  });

  // 13) Centrale foutafhandeling: request-id, geen stacktrace ────────────────
  await scenario("foutafhandeling: request-id zichtbaar, geen stacktrace", async () => {
    const res = await api("GET", "/api/activity-imports");
    assert(res.headers.get("x-request-id"), "X-Request-Id ontbreekt op respons");
    // Kapotte JSON triggert de body-parser-fout → centrale afhandeling.
    const raw = await fetch(`${baseUrl}/api/activity-imports`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-clerk-id": SYNTH_CLERK_ID,
      },
      body: "{kapot json",
    });
    assert(raw.status >= 400, "kapotte JSON gaf geen foutstatus");
    const text = await raw.text();
    assert(!/at\s+\S+\s+\(.*:\d+:\d+\)/.test(text), "stacktrace lekt naar de interface");
  });

  // 14) Admin Health kent de nieuwe pipelinecontroles ────────────────────────
  await scenario("beheer: gezondheidschecks voor bronnen, imports en duplicaten", async () => {
    const keys = healthCheckDefinitions.map((d) => d.key);
    for (const k of ["data_hub_sync", "activity_import_errors", "duplicate_activities"]) {
      assert(keys.includes(k), `check ${k} niet geregistreerd`);
    }
    const dupCheck = healthCheckDefinitions.find((d) => d.key === "duplicate_activities")!;
    const r = await dupCheck.probe();
    assert(r.status === "green" || r.status === "red", "duplicatencheck gaf geen echt oordeel");
    assert(r.status === "green", `duplicaten gevonden waar er geen horen te zijn: ${r.message}`);
    const syncCheck = healthCheckDefinitions.find((d) => d.key === "data_hub_sync")!;
    const rs = await syncCheck.probe();
    assert(rs.message, "synccheck zonder uitleg");
  });

  await stopServer();
  await cleanup();

  let failed = 0;
  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : "❌";
    console.log(`${icon} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Testrun crashte:", err);
  process.exit(1);
});
