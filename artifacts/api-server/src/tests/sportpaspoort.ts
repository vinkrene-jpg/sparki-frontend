// Golf 20 — Sportpaspoort: herleidbaar profiel bovenop athlete_profiles.
//
// Boot de ECHTE Express-app en bewijst end-to-end:
//   • handmatige invoer via POST /waarde ⇒ waarde + herkomst "handmatig" + event
//   • gemeten FTP ⇒ herkomst "gemeten", ftpEstimated=false én ftp_history-rij
//   • bereikcontrole (FTP 2000) ⇒ eerlijke 400, waarde onaangeroerd
//   • onbekend veld ⇒ 400
//   • bestaand profielpad (PUT /api/athlete/profile) registreert óók events
//   • automatische zones-rakende wijziging wordt een VOORSTEL (nooit stil)
//   • dubbel open voorstel per veld is onmogelijk (idempotent)
//   • accepteren past de waarde toe; berekende FTP blijft een schatting
//   • gekoppelde coach mag meebeslissen; een vreemde krijgt 403
//   • al besloten voorstel opnieuw besluiten ⇒ 409
//   • ontwikkelingsbeeld is eerlijk "onvoldoende" zonder meetpunten en
//     betrouwbaar mét ≥2 FTP-punten
//   • export: lege selectie ⇒ 400; gevoelige secties (gezondheid/locatie/
//     notities) zitten er alleen in als ze bewust gekozen zijn; historie
//     filtert gezondheidsevents zonder gezondheid-sectie
//   • een andere gebruiker ziet nooit andermans paspoort(-events)
//
// Run: `pnpm --filter @workspace/api-server run test:sportpaspoort`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  coachAthleteLinksTable,
  ftpHistoryTable,
  passportValueEventsTable,
  passportProposalsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { createProposal } from "../lib/passport";

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

const RUN = `test_paspoort_${Date.now()}`;
const athlete = `${RUN}_a`;
const coach = `${RUN}_c`;
const stranger = `${RUN}_s`;

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function cleanup() {
  for (const c of [athlete, coach, stranger]) {
    await db
      .delete(passportProposalsTable)
      .where(eq(passportProposalsTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(passportValueEventsTable)
      .where(eq(passportValueEventsTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(coachAthleteLinksTable)
      .where(eq(coachAthleteLinksTable.coachClerkId, c))
      .catch(() => {});
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function profileOf(clerkId: string) {
  const [p] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  return p ?? null;
}

async function main() {
  await cleanup();
  for (const [id, name] of [
    [athlete, "Paspoort Renner"],
    [coach, "Paspoort Coach"],
    [stranger, "Paspoort Vreemde"],
  ] as const) {
    await ensureAccount(id, `${id}@example.test`, name, silentLogger);
  }
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: coach,
    athleteClerkId: athlete,
    status: "accepted",
  });

  await startServer();

  await scenario("handmatige waarde: opslag + herkomst + event", async () => {
    const r = await req("POST", "/api/passport/waarde", athlete, {
      field: "weightKg",
      value: 71.5,
      source: "eigen weegschaal",
    });
    assert(r.status === 200 && r.json?.changed === true, `status ${r.status}`);
    const p = await req("GET", "/api/passport", athlete);
    assert(p.status === 200, `passport GET ${p.status}`);
    const f = p.json.fields.find((x: any) => x.field === "weightKg");
    assert(f?.origin === "handmatig", `origin ${f?.origin}`);
    assert(Number(f?.value) === 71.5, `value ${f?.value}`);
    assert(f?.source === "eigen weegschaal", `source ${f?.source}`);
    const ev = p.json.history.find((e: any) => e.field === "weightKg");
    assert(ev && ev.newValue === "71.5", "event ontbreekt");
  });

  await scenario("gemeten FTP: herkomst gemeten + ftp_history + niet-geschat", async () => {
    const r = await req("POST", "/api/passport/waarde", athlete, {
      field: "ftp",
      value: 250,
      origin: "gemeten",
      source: "20-minutentest",
      measuredAt: "2026-07-20",
    });
    assert(r.status === 200 && r.json?.changed === true, `status ${r.status}`);
    const prof = await profileOf(athlete);
    assert(prof?.ftp === 250 && prof?.ftpEstimated === false, "profiel niet bijgewerkt");
    const rows = await db
      .select()
      .from(ftpHistoryTable)
      .where(
        and(eq(ftpHistoryTable.clerkId, athlete), eq(ftpHistoryTable.measuredAt, "2026-07-20")),
      );
    assert(rows.length === 1 && rows[0].ftpWatts === 250, "ftp_history-rij ontbreekt");
    const p = await req("GET", "/api/passport", athlete);
    const f = p.json.fields.find((x: any) => x.field === "ftp");
    assert(f?.origin === "gemeten" && f?.estimated === false, `origin ${f?.origin}`);
  });

  await scenario("bereikcontrole: FTP 2000 ⇒ 400, waarde onaangeroerd", async () => {
    const r = await req("POST", "/api/passport/waarde", athlete, {
      field: "ftp",
      value: 2000,
    });
    assert(r.status === 400, `status ${r.status}`);
    const prof = await profileOf(athlete);
    assert(prof?.ftp === 250, `ftp is nu ${prof?.ftp}`);
  });

  await scenario("onbekend veld ⇒ 400", async () => {
    const r = await req("POST", "/api/passport/waarde", athlete, {
      field: "schoenmaat",
      value: 44,
    });
    assert(r.status === 400, `status ${r.status}`);
  });

  await scenario("bestaand profielpad registreert óók een event", async () => {
    const r = await req("PUT", "/api/athlete/profile", athlete, {
      weeklyHourTarget: 9,
    });
    assert(r.status === 200, `status ${r.status}`);
    const evs = await db
      .select()
      .from(passportValueEventsTable)
      .where(
        and(
          eq(passportValueEventsTable.clerkId, athlete),
          eq(passportValueEventsTable.field, "weeklyHourTarget"),
        ),
      );
    assert(evs.length >= 1 && evs[evs.length - 1].newValue === "9", "geen event via profiel-PUT");
  });

  let proposalId = 0;
  await scenario("zones-rakende autowijziging wordt een voorstel, nooit stil", async () => {
    const created = await createProposal({
      clerkId: athlete,
      field: "ftp",
      proposedValue: "265",
      origin: "berekend",
      source: "bewezen inspanning",
      reason: "Je hield 265 watt vol; je ingestelde FTP van 250 lijkt te laag.",
      proposedBy: "ftp-ondergrens-engine",
    });
    assert(created.created === true, "voorstel niet aangemaakt");
    const prof = await profileOf(athlete);
    assert(prof?.ftp === 250, "waarde is stiekem al gewijzigd");
    const p = await req("GET", "/api/passport", athlete);
    const open = p.json.proposals.find((x: any) => x.field === "ftp");
    assert(open && open.proposedValue === "265", "voorstel niet zichtbaar");
    proposalId = open.id;
  });

  await scenario("dubbel open voorstel per veld is onmogelijk", async () => {
    const again = await createProposal({
      clerkId: athlete,
      field: "ftp",
      proposedValue: "270",
      origin: "berekend",
      reason: "tweede poging",
      proposedBy: "ftp-ondergrens-engine",
    });
    assert(again.created === false, "tweede open voorstel werd aangemaakt");
  });

  await scenario("vreemde mag niet besluiten ⇒ 403", async () => {
    const r = await req(
      "POST",
      `/api/passport/voorstellen/${proposalId}/besluit`,
      stranger,
      { besluit: "geaccepteerd" },
    );
    assert(r.status === 403, `status ${r.status}`);
  });

  await scenario("accepteren past waarde toe; berekende FTP blijft schatting", async () => {
    const r = await req(
      "POST",
      `/api/passport/voorstellen/${proposalId}/besluit`,
      athlete,
      { besluit: "geaccepteerd" },
    );
    assert(r.status === 200 && r.json?.status === "geaccepteerd", `status ${r.status}`);
    const prof = await profileOf(athlete);
    assert(prof?.ftp === 265, `ftp is ${prof?.ftp}`);
    assert(prof?.ftpEstimated === true, "berekende FTP werd ten onrechte definitief");
  });

  await scenario("al besloten voorstel ⇒ 409", async () => {
    const r = await req(
      "POST",
      `/api/passport/voorstellen/${proposalId}/besluit`,
      athlete,
      { besluit: "afgewezen" },
    );
    assert(r.status === 409, `status ${r.status}`);
  });

  await scenario("gekoppelde coach mag meebeslissen (afwijzen)", async () => {
    const created = await createProposal({
      clerkId: athlete,
      field: "ftp",
      proposedValue: "280",
      origin: "berekend",
      reason: "nieuw bewijs",
      proposedBy: "ftp-ondergrens-engine",
    });
    assert(created.created === true, "voorstel niet aangemaakt");
    const p = await req("GET", "/api/passport", athlete);
    const open = p.json.proposals.find(
      (x: any) => x.field === "ftp" && x.status === "open",
    );
    const r = await req(
      "POST",
      `/api/passport/voorstellen/${open.id}/besluit`,
      coach,
      { besluit: "afgewezen" },
    );
    assert(r.status === 200 && r.json?.status === "afgewezen", `status ${r.status}`);
    const prof = await profileOf(athlete);
    assert(prof?.ftp === 265, "afgewezen voorstel wijzigde toch de waarde");
  });

  await scenario("ontwikkelingsbeeld: eerlijk onvoldoende zonder meetpunten", async () => {
    const r = await req("GET", "/api/passport/ontwikkeling", stranger);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json.reliable === false && typeof r.json.reliableReason === "string",
      "gate ontbreekt");
  });

  await scenario("ontwikkelingsbeeld: betrouwbaar met ≥2 FTP-punten", async () => {
    await db.insert(ftpHistoryTable).values({
      clerkId: athlete,
      measuredAt: "2026-05-01",
      ftpWatts: 240,
      testType: "manual",
    });
    const r = await req("GET", "/api/passport/ontwikkeling", athlete);
    assert(r.status === 200 && r.json.reliable === true, "gate blijft dicht");
    assert(Array.isArray(r.json.ftpSeries) && r.json.ftpSeries.length >= 2, "serie ontbreekt");
  });

  await scenario("export: lege selectie ⇒ 400", async () => {
    const r = await req("POST", "/api/passport/export", athlete, { sections: [] });
    assert(r.status === 400, `status ${r.status}`);
  });

  await scenario("export: gevoelige secties alleen bij bewuste keuze", async () => {
    await req("PUT", "/api/athlete/health-status", athlete, { healthStatus: "sick" });
    const basic = await req("POST", "/api/passport/export", athlete, {
      sections: ["identiteit", "prestaties", "historie"],
    });
    assert(basic.status === 200, `status ${basic.status}`);
    const ex = basic.json.export;
    assert(ex.identiteit && ex.prestaties && Array.isArray(ex.historie), "kern ontbreekt");
    assert(!("gezondheid" in ex) && !("locatie" in ex) && !("notities" in ex),
      "gevoelige sectie lekt zonder keuze");
    assert(
      ex.historie.every((e: any) => e.field !== "healthStatus"),
      "gezondheidsevent lekt in historie",
    );
    const full = await req("POST", "/api/passport/export", athlete, {
      sections: ["historie", "gezondheid"],
    });
    assert(full.status === 200 && full.json.export.gezondheid?.status === "sick",
      "gezondheid mist bij bewuste keuze");
    assert(
      full.json.export.historie.some((e: any) => e.field === "healthStatus"),
      "gezondheidsevent mist in historie mét gezondheid-sectie",
    );
    assert(
      JSON.stringify(basic.json.defaultOff) ===
        JSON.stringify(["gezondheid", "locatie", "notities"]),
      "defaultOff klopt niet",
    );
  });

  await scenario("isolatie: ander ziet nooit andermans paspoort-events", async () => {
    const r = await req("GET", "/api/passport", stranger);
    assert(r.status === 200, `status ${r.status}`);
    assert(
      r.json.history.every((e: any) => e.newValue !== "71.5"),
      "events van de renner lekken naar een ander",
    );
    const f = r.json.fields.find((x: any) => x.field === "ftp");
    assert(f?.value == null || f.value !== "265", "waarde lekt");
  });

  await stopServer();
  await cleanup();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("testrun mislukt:", err);
  process.exit(1);
});
