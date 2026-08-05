// Coach-cockpit — route-contracttest voor Afbouwgolf 6 (coachomgeving).
//
// Boot de ECHTE Express-app en test het volledige cockpitcontract:
//   • Dashboard: gekoppelde sporters met prioriteit/topsignaal; "deelt niet"
//     verschijnt als eerlijke basisvermelding zonder data.
//   • Signaalbesluiten: afwijzen/parkeren VEREISEN een notitie (400 zonder);
//     accepteren slaat idempotent op (upsert per coach+atleet+signalKey).
//   • "Markeer als beoordeeld" werkt alleen op een geaccepteerde koppeling.
//   • Planning: coach maakt trainingen met source="coach" status="planned";
//     Sparki-/sportertrainingen zijn NIET aanpasbaar (403); andermans training
//     404; herhalen kloont inhoud op extra datums; bulk plant voor delende
//     sporters en slaat geen_koppeling/deelt_niet eerlijk over.
//   • Voorstellen: Sparki past een coachtraining nooit zelf aan — besluit via
//     de coach; afwijzen vereist reden; accepteren past het voorstel toe op de
//     training; een afgehandeld voorstel geeft 409.
//   • Berichten: vereisen alleen een geaccepteerde koppeling (praten kan óók
//     bij sharing none); ongekoppelde coach 403; sporter kan antwoorden.
//   • Coachcontext: CRUD door de coach, transparant zichtbaar voor de sporter
//     via /context-items/about-me; verwijderen alleen door de eigenaar.
//   • Toegangsgates fail-closed: geen coach-rol 403, geen koppeling 403,
//     sharing none 403 op datasurfaces.
//
// Run: `pnpm --filter @workspace/api-server run test:coach-cockpit`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  coachAthleteLinksTable,
  userProfilesTable,
  privacySettingsTable,
  plannedWorkoutsTable,
  coachSignalActionsTable,
  coachMessagesTable,
  coachContextItemsTable,
  coachChangeProposalsTable,
  trainingSessionsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_cockpit_${Date.now()}`;
const clerkCoach = `${RUN}_coach`;
const clerkCoachB = `${RUN}_coach_b`; // tweede coach, NIET gekoppeld
const clerkAthlete = `${RUN}_ath_full`; // deelt (default summary)
const clerkAthleteNone = `${RUN}_ath_none`; // gekoppeld maar deelt niet
const clerkStranger = `${RUN}_ath_stranger`; // geen koppeling

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  for (const c of [clerkAthlete, clerkAthleteNone, clerkStranger]) {
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, c)).catch(() => {});
  }
  for (const t of [
    { table: plannedWorkoutsTable, col: plannedWorkoutsTable.clerkId, ids: [clerkAthlete, clerkAthleteNone, clerkStranger] },
  ]) {
    for (const id of t.ids) {
      await db.delete(t.table).where(eq(t.col, id)).catch(() => {});
    }
  }
  await db.delete(coachSignalActionsTable).where(eq(coachSignalActionsTable.coachClerkId, clerkCoach)).catch(() => {});
  await db.delete(coachMessagesTable).where(eq(coachMessagesTable.coachClerkId, clerkCoach)).catch(() => {});
  await db.delete(coachContextItemsTable).where(eq(coachContextItemsTable.coachClerkId, clerkCoach)).catch(() => {});
  await db.delete(coachChangeProposalsTable).where(eq(coachChangeProposalsTable.athleteClerkId, clerkAthlete)).catch(() => {});
  await db.delete(coachAthleteLinksTable).where(eq(coachAthleteLinksTable.coachClerkId, clerkCoach)).catch(() => {});
  await db.delete(coachAthleteLinksTable).where(eq(coachAthleteLinksTable.coachClerkId, clerkCoachB)).catch(() => {});
  for (const c of [clerkAthlete, clerkAthleteNone, clerkStranger]) {
    await db.delete(privacySettingsTable).where(eq(privacySettingsTable.clerkId, c)).catch(() => {});
  }
  for (const c of [clerkCoach, clerkCoachB, clerkAthlete, clerkAthleteNone, clerkStranger]) {
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, c)).catch(() => {});
  }
}

async function main() {
  await startServer();

  await ensureAccount(clerkCoach, `${clerkCoach}@example.test`, "Coach A", silentLogger);
  await ensureAccount(clerkCoachB, `${clerkCoachB}@example.test`, "Coach B", silentLogger);
  await ensureAccount(clerkAthlete, `${clerkAthlete}@example.test`, "Atleet Deelt", silentLogger);
  await ensureAccount(clerkAthleteNone, `${clerkAthleteNone}@example.test`, "Atleet Niet", silentLogger);
  await ensureAccount(clerkStranger, `${clerkStranger}@example.test`, "Atleet Los", silentLogger);

  for (const c of [clerkCoach, clerkCoachB]) {
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete", "coach"] })
      .where(eq(userProfilesTable.clerkId, c));
  }

  await db.insert(coachAthleteLinksTable).values([
    { coachClerkId: clerkCoach, athleteClerkId: clerkAthlete, status: "accepted" },
    { coachClerkId: clerkCoach, athleteClerkId: clerkAthleteNone, status: "accepted" },
  ]);
  await db
    .insert(privacySettingsTable)
    .values({ clerkId: clerkAthleteNone, dataSharingCoach: "none" })
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: { dataSharingCoach: "none" },
    });

  // ── Dashboard ──────────────────────────────────────────────────────────────
  await scenario("dashboard toont gekoppelde sporters; deelt-niet is base-only", async () => {
    const r = await req("GET", "/api/coach/dashboard", clerkCoach);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const athletes: any[] = r.json?.athletes ?? [];
    const full = athletes.find((a) => a.athleteClerkId === clerkAthlete);
    const none = athletes.find((a) => a.athleteClerkId === clerkAthleteNone);
    assert(full, "delende sporter ontbreekt op dashboard");
    assert(none, "niet-delende sporter ontbreekt (moet als base-vermelding blijven)");
    assert(none.sharing === "none", "sharing none niet gemarkeerd");
    assert(none.topSignal == null && none.readiness == null, "deelt-niet lekt data op dashboard");
  });

  await scenario("dashboard 403 zonder coach-rol", async () => {
    const r = await req("GET", "/api/coach/dashboard", clerkStranger);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  // ── Naleving: gepland vs. uitgevoerd ──────────────────────────────────────
  await scenario("naleving: groen via link, rood zonder rit, extra ongepland; gates fail-closed", async () => {
    const iso = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    // Eergisteren: rit + gekoppelde geplande training (completed) → groen.
    const [ses] = await db
      .insert(trainingSessionsTable)
      .values({ clerkId: clerkAthlete, sessionDate: iso(-2), title: "Duurrit", durationMin: 90, tss: 80 })
      .returning({ id: trainingSessionsTable.id });
    await db.insert(plannedWorkoutsTable).values({
      clerkId: clerkAthlete,
      scheduledDate: iso(-2),
      title: "Duurtraining",
      targetDurationMin: 90,
      targetTSS: 80,
      status: "completed",
      sessionId: ses!.id,
      source: "sparki",
    });
    // Gisteren: gepland maar geen rit → lazy zelfheling maakt hem missed (rood).
    await db.insert(plannedWorkoutsTable).values({
      clerkId: clerkAthlete,
      scheduledDate: iso(-1),
      title: "Intervallen",
      targetDurationMin: 60,
      status: "planned",
      source: "sparki",
    });
    // Gisteren óók een losse, ongekoppelde rit → telt eerlijk als extra.
    await db
      .insert(trainingSessionsTable)
      .values({ clerkId: clerkAthlete, sessionDate: iso(-1), title: "Losse rit", durationMin: 45 });

    const r = await req("GET", `/api/coach/athletes/${clerkAthlete}/compliance`, clerkCoach);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const entries: any[] = r.json?.entries ?? [];
    const groen = entries.find((e) => e.planned?.title === "Duurtraining");
    assert(groen?.status === "groen" && groen.executed?.sessionId === ses!.id, "gekoppelde training moet groen zijn met rit erbij");
    const rood = entries.find((e) => e.planned?.title === "Intervallen");
    assert(rood?.status === "rood", "verstreken training zonder rit moet rood zijn");
    assert(typeof rood.reason === "string" && rood.reason.includes("Geen rit"), "rood moet eerlijk 'geen rit' als reden dragen");
    const extra = entries.find((e) => e.extra === true);
    assert(extra?.executed?.title === "Losse rit" && extra.planned == null, "ongekoppelde rit moet als extra verschijnen");
    assert(r.json?.summary?.groen >= 1 && r.json?.summary?.rood >= 1 && r.json?.summary?.extra >= 1, "samenvatting telt groen/rood/extra");

    // Gates: ongekoppeld en deelt-niet fail-closed.
    const a = await req("GET", `/api/coach/athletes/${clerkStranger}/compliance`, clerkCoach);
    assert(a.status === 403, `ongekoppeld: verwacht 403, kreeg ${a.status}`);
    const b = await req("GET", `/api/coach/athletes/${clerkAthleteNone}/compliance`, clerkCoach);
    assert(b.status === 403, `deelt niet: verwacht 403, kreeg ${b.status}`);

    // Overzicht: delende sporter mét cijfers, deelt-niet eerlijk zonder.
    const o = await req("GET", "/api/coach/compliance/overview", clerkCoach);
    assert(o.status === 200, `overzicht: verwacht 200, kreeg ${o.status}`);
    const rows: any[] = o.json?.athletes ?? [];
    const rowFull = rows.find((x) => x.athleteClerkId === clerkAthlete);
    const rowNone = rows.find((x) => x.athleteClerkId === clerkAthleteNone);
    assert(rowFull?.summary != null, "delende sporter moet cijfers hebben in het overzicht");
    assert(rowNone && rowNone.summary == null, "deelt-niet moet zonder cijfers in het overzicht staan");
    const oNoRole = await req("GET", "/api/coach/compliance/overview", clerkStranger);
    assert(oNoRole.status === 403, `zonder coach-rol: verwacht 403, kreeg ${oNoRole.status}`);
  });

  // ── Workoutbouwer: stappen + export .zwo/.fit ─────────────────────────────
  await scenario("workoutbouwer: stappen opslaan, valideren, exporteren als .zwo en .fit", async () => {
    const iso = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const create = await req("POST", `/api/coach/athletes/${clerkAthlete}/workouts`, clerkCoach, {
      scheduledDate: iso(3),
      title: "Blokken 4x4",
      steps: [
        { soort: "warmup", duurMin: 10, ftpLowPct: 45, ftpHighPct: 65 },
        { soort: "werk", duurMin: 4, ftpLowPct: 105, ftpHighPct: 115, herhaal: 4, rustMin: 3 },
        { soort: "cooldown", duurMin: 10, ftpLowPct: 60, ftpHighPct: 40 },
      ],
    });
    assert(create.status === 400, "cooldown met onder>boven moet 400 geven");
    const ok = await req("POST", `/api/coach/athletes/${clerkAthlete}/workouts`, clerkCoach, {
      scheduledDate: iso(3),
      title: "Blokken 4x4",
      steps: [
        { soort: "warmup", duurMin: 10, ftpLowPct: 45, ftpHighPct: 65 },
        { soort: "werk", duurMin: 4, ftpLowPct: 105, ftpHighPct: 115, herhaal: 4, rustMin: 3 },
        { soort: "vrij", duurMin: 10 },
      ],
    });
    assert(ok.status === 201, `verwacht 201, kreeg ${ok.status}`);
    const wid = ok.json?.workout?.id;
    assert(Array.isArray(ok.json?.workout?.structure?.steps), "stappen moeten in structure staan");
    // Zonder losse duur: opgetelde stappenduur (10 + 4×4 + 3×4 + 10 = 48).
    assert(ok.json?.workout?.targetDurationMin === 48, `duur uit stappen verwacht 48, kreeg ${ok.json?.workout?.targetDurationMin}`);

    const zwo = await fetch(`${baseUrl}/api/coach/athletes/${clerkAthlete}/workouts/${wid}/export?format=zwo`, {
      headers: { "x-dev-clerk-id": clerkCoach },
    });
    assert(zwo.status === 200, `zwo-export: verwacht 200, kreeg ${zwo.status}`);
    const xml = await zwo.text();
    assert(xml.includes("<IntervalsT Repeat=\"4\""), "zwo mist het intervalblok");
    assert(xml.includes("<FreeRide"), "vrije stap moet FreeRide zijn (geen verzonnen vermogensband)");
    assert(!xml.includes("watt"), "zwo mag geen watts bevatten — alleen FTP-fracties");

    const fit = await fetch(`${baseUrl}/api/coach/athletes/${clerkAthlete}/workouts/${wid}/export?format=fit`, {
      headers: { "x-dev-clerk-id": clerkCoach },
    });
    assert(fit.status === 200, `fit-export: verwacht 200, kreeg ${fit.status}`);
    const bytes = new Uint8Array(await fit.arrayBuffer());
    assert(bytes.length > 14 && bytes[0] === 14, "fit-header moet 14 bytes zijn");
    assert(String.fromCharCode(...bytes.slice(8, 12)) === ".FIT", "fit-magic ontbreekt");
    const dataLen = bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24);
    assert(bytes.length === 14 + dataLen + 2, "fit-datalengte klopt niet met bestandsgrootte");
    // CRC-16-verificatie (gedocumenteerd FIT-algoritme) over header + data.
    const crcTable = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
    const crcOf = (arr: Uint8Array, start: number, end: number) => {
      let crc = 0;
      for (let i = start; i < end; i++) {
        const b = arr[i]!;
        let tmp = crcTable[crc & 0xf]!;
        crc = ((crc >> 4) & 0x0fff) ^ tmp ^ crcTable[b & 0xf]!;
        tmp = crcTable[crc & 0xf]!;
        crc = ((crc >> 4) & 0x0fff) ^ tmp ^ crcTable[(b >> 4) & 0xf]!;
      }
      return crc;
    };
    const headerCrc = bytes[12]! | (bytes[13]! << 8);
    assert(crcOf(bytes, 0, 12) === headerCrc, "fit-header-CRC klopt niet");
    const fileCrc = bytes[14 + dataLen]! | (bytes[15 + dataLen]! << 8);
    assert(crcOf(bytes, 0, 14 + dataLen) === fileCrc, "fit-bestands-CRC klopt niet");
    // Definitiecheck: file_id.serial_number moet base type uint32z (0x8c) zijn.
    assert(bytes.includes(0x8c), "fit-definities missen uint32z-basistype");

    // Training zonder stappen exporteren = eerlijke 400.
    const plain = await req("POST", `/api/coach/athletes/${clerkAthlete}/workouts`, clerkCoach, {
      scheduledDate: iso(4),
      title: "Losse duurtraining",
    });
    const noSteps = await fetch(`${baseUrl}/api/coach/athletes/${clerkAthlete}/workouts/${plain.json?.workout?.id}/export?format=zwo`, {
      headers: { "x-dev-clerk-id": clerkCoach },
    });
    assert(noSteps.status === 400, `zonder stappen: verwacht 400, kreeg ${noSteps.status}`);
  });

  // ── Signalen + besluiten ───────────────────────────────────────────────────
  await scenario("signalen: gate fail-closed (geen koppeling 403, deelt niet 403)", async () => {
    const a = await req("GET", `/api/coach/athletes/${clerkStranger}/signals`, clerkCoach);
    assert(a.status === 403, `ongekoppeld: verwacht 403, kreeg ${a.status}`);
    const b = await req("GET", `/api/coach/athletes/${clerkAthleteNone}/signals`, clerkCoach);
    assert(b.status === 403, `deelt niet: verwacht 403, kreeg ${b.status}`);
    const c = await req("GET", `/api/coach/athletes/${clerkAthlete}/signals`, clerkCoach);
    assert(c.status === 200 && Array.isArray(c.json?.signals), "delende sporter: signalen moeten laden");
  });

  await scenario("signaalbesluit: afwijzen/parkeren vereisen notitie (400), accepteren niet", async () => {
    const key = `sig_${RUN}`;
    const noNote = await req("POST", `/api/coach/athletes/${clerkAthlete}/signals/action`, clerkCoach, {
      signalKey: key,
      action: "afwijzen",
    });
    assert(noNote.status === 400, `afwijzen zonder notitie: verwacht 400, kreeg ${noNote.status}`);
    const park = await req("POST", `/api/coach/athletes/${clerkAthlete}/signals/action`, clerkCoach, {
      signalKey: key,
      action: "parkeren",
    });
    assert(park.status === 400, `parkeren zonder notitie: verwacht 400, kreeg ${park.status}`);
    const ok = await req("POST", `/api/coach/athletes/${clerkAthlete}/signals/action`, clerkCoach, {
      signalKey: key,
      action: "accepteren",
    });
    assert(ok.status === 201, `accepteren: verwacht 201, kreeg ${ok.status}`);
    // Idempotent: tweede besluit op dezelfde key overschrijft, geen dubbele rij.
    const again = await req("POST", `/api/coach/athletes/${clerkAthlete}/signals/action`, clerkCoach, {
      signalKey: key,
      action: "parkeren",
      note: "even wachten op herstel",
    });
    assert(again.status === 201, `upsert: verwacht 201, kreeg ${again.status}`);
    const rows = await db
      .select({ id: coachSignalActionsTable.id, action: coachSignalActionsTable.action })
      .from(coachSignalActionsTable)
      .where(
        and(
          eq(coachSignalActionsTable.coachClerkId, clerkCoach),
          eq(coachSignalActionsTable.signalKey, key),
        ),
      );
    assert(rows.length === 1, `verwacht 1 besluit-rij, kreeg ${rows.length}`);
    assert(rows[0].action === "parkeren", "upsert heeft besluit niet bijgewerkt");
  });

  await scenario("markeer als beoordeeld: alleen op geaccepteerde koppeling", async () => {
    const ok = await req("POST", `/api/coach/athletes/${clerkAthlete}/review`, clerkCoach);
    assert(ok.status === 200 && ok.json?.lastReviewedAt, "review moet lastReviewedAt zetten");
    const nolink = await req("POST", `/api/coach/athletes/${clerkStranger}/review`, clerkCoach);
    assert(nolink.status === 403, `ongekoppeld: verwacht 403, kreeg ${nolink.status}`);
  });

  // ── Planning ───────────────────────────────────────────────────────────────
  let coachWorkoutId = 0;
  await scenario("coach maakt training: source=coach, status=planned; validatie 400", async () => {
    const bad = await req("POST", `/api/coach/athletes/${clerkAthlete}/workouts`, clerkCoach, {
      scheduledDate: "morgen",
      title: "X",
    });
    assert(bad.status === 400, `ongeldige datum: verwacht 400, kreeg ${bad.status}`);
    const r = await req("POST", `/api/coach/athletes/${clerkAthlete}/workouts`, clerkCoach, {
      scheduledDate: isoOffset(2),
      title: `Blokken 4x8 ${RUN}`,
      targetDurationMin: 90,
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    assert(r.json?.workout?.source === "coach", "source moet coach zijn");
    assert(r.json?.workout?.status === "planned", "status moet planned zijn");
    coachWorkoutId = r.json.workout.id;
  });

  await scenario("coach kan Sparki-/sportertraining NIET aanpassen (403); andermans 404", async () => {
    const [sparkiRow] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId: clerkAthlete,
        scheduledDate: isoOffset(3),
        title: `Sparki duurrit ${RUN}`,
        type: "ride",
        status: "planned",
        source: "sparki",
      })
      .returning({ id: plannedWorkoutsTable.id });
    const put = await req(
      "PUT",
      `/api/coach/athletes/${clerkAthlete}/workouts/${sparkiRow.id}`,
      clerkCoach,
      { title: "Overschreven" },
    );
    assert(put.status === 403, `sparki-training wijzigen: verwacht 403, kreeg ${put.status}`);
    const [row] = await db
      .select({ title: plannedWorkoutsTable.title })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, sparkiRow.id));
    assert(row.title.startsWith("Sparki duurrit"), "sparki-training is tóch gewijzigd");
    const wrong = await req(
      "PUT",
      `/api/coach/athletes/${clerkAthlete}/workouts/999999999`,
      clerkCoach,
      { title: "X" },
    );
    assert(wrong.status === 404, `onbekende training: verwacht 404, kreeg ${wrong.status}`);
  });

  await scenario("coach wijzigt/verplaatst/annuleert eigen coachtraining", async () => {
    const move = await req(
      "PUT",
      `/api/coach/athletes/${clerkAthlete}/workouts/${coachWorkoutId}`,
      clerkCoach,
      { scheduledDate: isoOffset(4), title: `Blokken aangepast ${RUN}` },
    );
    assert(move.status === 200 && move.json?.workout?.scheduledDate === isoOffset(4), "verplaatsen mislukt");
    const cancel = await req(
      "PUT",
      `/api/coach/athletes/${clerkAthlete}/workouts/${coachWorkoutId}`,
      clerkCoach,
      { status: "cancelled" },
    );
    assert(cancel.status === 200 && cancel.json?.workout?.status === "cancelled", "annuleren mislukt");
    // terug naar planned voor het voorstel-scenario
    await req("PUT", `/api/coach/athletes/${clerkAthlete}/workouts/${coachWorkoutId}`, clerkCoach, {
      status: "planned",
    });
  });

  await scenario("herhalen kloont de coachtraining op extra datums", async () => {
    const r = await req(
      "POST",
      `/api/coach/athletes/${clerkAthlete}/workouts/${coachWorkoutId}/repeat`,
      clerkCoach,
      { dates: [isoOffset(7), isoOffset(9), isoOffset(9)] },
    );
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    assert((r.json?.created ?? []).length === 2, `dubbele datum moet gededupet: kreeg ${r.json?.created?.length}`);
  });

  await scenario("bulk plant voor delende sporters; skipt geen_koppeling en deelt_niet eerlijk", async () => {
    const r = await req("POST", "/api/coach/workouts/bulk", clerkCoach, {
      athleteClerkIds: [clerkAthlete, clerkAthleteNone, clerkStranger],
      scheduledDate: isoOffset(5),
      title: `Groepstraining ${RUN}`,
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    assert(r.json.created.length === 1 && r.json.created[0] === clerkAthlete, "alleen delende sporter mag ingepland");
    const reasons = Object.fromEntries(
      (r.json.skipped ?? []).map((s: any) => [s.athleteClerkId, s.reason]),
    );
    assert(reasons[clerkStranger] === "geen_koppeling", "stranger moet geen_koppeling zijn");
    assert(reasons[clerkAthleteNone] === "deelt_niet", "none-sporter moet deelt_niet zijn");
    const rows = await db
      .select({ id: plannedWorkoutsTable.id })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkAthleteNone),
          eq(plannedWorkoutsTable.source, "coach"),
        ),
      );
    assert(rows.length === 0, "bulk heeft tóch geschreven bij deelt-niet sporter");
  });

  // ── Voorstellen ────────────────────────────────────────────────────────────
  let proposalId = 0;
  await scenario("voorstel: Sparki wijzigt niets zelf; accepteren past toe", async () => {
    const [p] = await db
      .insert(coachChangeProposalsTable)
      .values({
        athleteClerkId: clerkAthlete,
        workoutId: coachWorkoutId,
        reason: "Sporter meldt zware benen; voorstel: 15 minuten korter.",
        changes: { targetDurationMin: 75 },
        status: "open",
      })
      .returning({ id: coachChangeProposalsTable.id });
    proposalId = p.id;
    // Zolang de coach niets besluit, is de training onveranderd.
    const [before] = await db
      .select({ dur: plannedWorkoutsTable.targetDurationMin })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, coachWorkoutId));
    assert(before.dur === 90, `training mag niet auto-wijzigen (dur=${before.dur})`);
    const r = await req("POST", `/api/coach/proposals/${proposalId}/decision`, clerkCoach, {
      action: "accepteren",
    });
    assert(r.status === 200 && r.json?.applied === true, `accepteren: verwacht applied, kreeg ${r.status}`);
    const [after] = await db
      .select({ dur: plannedWorkoutsTable.targetDurationMin })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, coachWorkoutId));
    assert(after.dur === 75, `voorstel niet toegepast (dur=${after.dur})`);
  });

  await scenario("voorstel: afgehandeld = 409; afwijzen vereist reden", async () => {
    const again = await req("POST", `/api/coach/proposals/${proposalId}/decision`, clerkCoach, {
      action: "afwijzen",
      note: "al besloten",
    });
    assert(again.status === 409, `afgehandeld voorstel: verwacht 409, kreeg ${again.status}`);
    const [p2] = await db
      .insert(coachChangeProposalsTable)
      .values({
        athleteClerkId: clerkAthlete,
        workoutId: coachWorkoutId,
        reason: "Voorstel 2",
        changes: { cancel: true },
        status: "open",
      })
      .returning({ id: coachChangeProposalsTable.id });
    const noReason = await req("POST", `/api/coach/proposals/${p2.id}/decision`, clerkCoach, {
      action: "afwijzen",
    });
    assert(noReason.status === 400, `afwijzen zonder reden: verwacht 400, kreeg ${noReason.status}`);
    const rejected = await req("POST", `/api/coach/proposals/${p2.id}/decision`, clerkCoach, {
      action: "afwijzen",
      note: "training blijft staan",
    });
    assert(rejected.status === 200 && rejected.json?.applied === false, "afwijzen mag niets toepassen");
    const [w] = await db
      .select({ status: plannedWorkoutsTable.status })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, coachWorkoutId));
    assert(w.status === "planned", "afgewezen voorstel heeft training tóch geannuleerd");
  });

  await scenario("voorstel-besluit door NIET-gekoppelde coach 403", async () => {
    const [p3] = await db
      .insert(coachChangeProposalsTable)
      .values({
        athleteClerkId: clerkAthlete,
        workoutId: coachWorkoutId,
        reason: "Voorstel 3",
        changes: { targetDurationMin: 60 },
        status: "open",
      })
      .returning({ id: coachChangeProposalsTable.id });
    const r = await req("POST", `/api/coach/proposals/${p3.id}/decision`, clerkCoachB, {
      action: "accepteren",
    });
    assert(r.status === 403, `vreemde coach: verwacht 403, kreeg ${r.status}`);
  });

  // ── Cross-coach isolatie (twee gekoppelde coaches) ─────────────────────────
  await scenario("tweede gekoppelde coach kan trainingen van coach A niet aanraken", async () => {
    // Koppel coach B óók aan de sporter (accepted) — de gate laat B nu door,
    // maar eigendom van de training blijft bij coach A.
    await db.insert(coachAthleteLinksTable).values({
      coachClerkId: clerkCoachB,
      athleteClerkId: clerkAthlete,
      status: "accepted",
    });
    const put = await req(
      "PUT",
      `/api/coach/athletes/${clerkAthlete}/workouts/${coachWorkoutId}`,
      clerkCoachB,
      { title: "Gekaapt" },
    );
    assert(put.status === 403, `wijzigen door coach B: verwacht 403, kreeg ${put.status}`);
    const rep = await req(
      "POST",
      `/api/coach/athletes/${clerkAthlete}/workouts/${coachWorkoutId}/repeat`,
      clerkCoachB,
      { dates: [isoOffset(21)] },
    );
    assert(rep.status === 404, `herhalen door coach B: verwacht 404, kreeg ${rep.status}`);
    // Export van andermans training is óók afgeschermd (data-lek anders).
    const exp = await fetch(
      `${baseUrl}/api/coach/athletes/${clerkAthlete}/workouts/${coachWorkoutId}/export?format=zwo`,
      { headers: { "x-dev-clerk-id": clerkCoachB } },
    );
    assert(exp.status === 403, `export door coach B: verwacht 403, kreeg ${exp.status}`);
    // Voorstel op training van coach A: B ziet het niet in de lijst en mag niet beslissen.
    const [pb] = await db
      .insert(coachChangeProposalsTable)
      .values({
        athleteClerkId: clerkAthlete,
        workoutId: coachWorkoutId,
        reason: "Isolatietest",
        changes: { targetDurationMin: 45 },
        status: "open",
      })
      .onConflictDoNothing()
      .returning({ id: coachChangeProposalsTable.id });
    const listB = await req("GET", `/api/coach/athletes/${clerkAthlete}/proposals`, clerkCoachB);
    assert(listB.status === 200, `voorstellenlijst B: verwacht 200, kreeg ${listB.status}`);
    assert(
      !(listB.json?.proposals ?? []).some((p: any) => p.workoutId === coachWorkoutId),
      "coach B ziet voorstellen op trainingen van coach A",
    );
    if (pb) {
      const dec = await req("POST", `/api/coach/proposals/${pb.id}/decision`, clerkCoachB, {
        action: "accepteren",
      });
      assert(dec.status === 403, `besluit door coach B: verwacht 403, kreeg ${dec.status}`);
      await db.delete(coachChangeProposalsTable).where(eq(coachChangeProposalsTable.id, pb.id));
    }
    await db
      .delete(coachAthleteLinksTable)
      .where(eq(coachAthleteLinksTable.coachClerkId, clerkCoachB));
  });

  // ── Berichten ──────────────────────────────────────────────────────────────
  await scenario("berichten: koppeling volstaat (ook bij sharing none); ongekoppeld 403", async () => {
    const toNone = await req("POST", `/api/coach/athletes/${clerkAthleteNone}/messages`, clerkCoach, {
      body: "Hoe gaat het met je?",
    });
    assert(toNone.status === 201, `bericht aan deelt-niet sporter: verwacht 201, kreeg ${toNone.status}`);
    const noLink = await req("POST", `/api/coach/athletes/${clerkStranger}/messages`, clerkCoach, {
      body: "Hallo",
    });
    assert(noLink.status === 403, `ongekoppeld: verwacht 403, kreeg ${noLink.status}`);
    const empty = await req("POST", `/api/coach/athletes/${clerkAthlete}/messages`, clerkCoach, {
      body: "  ",
    });
    assert(empty.status === 400, `leeg bericht: verwacht 400, kreeg ${empty.status}`);
  });

  await scenario("sporter leest en beantwoordt; antwoord aan vreemde coach 403", async () => {
    await req("POST", `/api/coach/athletes/${clerkAthlete}/messages`, clerkCoach, {
      body: `Vraag van coach ${RUN}`,
    });
    const mine = await req("GET", "/api/coach/messages", clerkAthlete);
    assert(mine.status === 200, `verwacht 200, kreeg ${mine.status}`);
    assert(
      (mine.json?.messages ?? []).some((m: any) => m.body === `Vraag van coach ${RUN}`),
      "sporter ziet coachbericht niet",
    );
    const reply = await req("POST", "/api/coach/messages/reply", clerkAthlete, {
      coachClerkId: clerkCoach,
      body: "Gaat goed!",
    });
    assert(reply.status === 201, `antwoord: verwacht 201, kreeg ${reply.status}`);
    const badReply = await req("POST", "/api/coach/messages/reply", clerkAthlete, {
      coachClerkId: clerkCoachB,
      body: "Hallo?",
    });
    assert(badReply.status === 403, `vreemde coach: verwacht 403, kreeg ${badReply.status}`);
  });

  await scenario("sporter zonder coaches/berichten krijgt 200 met lege lijst", async () => {
    const r = await req("GET", "/api/coach/messages", clerkStranger);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert((r.json?.messages ?? []).length === 0, "verwacht lege berichtenlijst");
  });

  // ── Coachcontext ───────────────────────────────────────────────────────────
  await scenario("coachcontext: CRUD + transparantie voor de sporter", async () => {
    const bad = await req("POST", `/api/coach/athletes/${clerkAthlete}/context-items`, clerkCoach, {
      kind: "onzin",
      body: "x",
    });
    assert(bad.status === 400, `ongeldige soort: verwacht 400, kreeg ${bad.status}`);
    const created = await req("POST", `/api/coach/athletes/${clerkAthlete}/context-items`, clerkCoach, {
      kind: "blessure_afspraak",
      body: `Max 60 min tot knieklachten weg zijn ${RUN}`,
      endDate: isoOffset(14),
    });
    assert(created.status === 201, `verwacht 201, kreeg ${created.status}`);
    const itemId = created.json.item.id;
    const upd = await req("PUT", `/api/coach/context-items/${itemId}`, clerkCoach, {
      body: `Max 75 min ${RUN}`,
    });
    assert(upd.status === 200 && String(upd.json?.item?.body).startsWith("Max 75"), "wijzigen mislukt");
    const aboutMe = await req("GET", "/api/coach/context-items/about-me", clerkAthlete);
    assert(
      (aboutMe.json?.items ?? []).some((i: any) => i.id === itemId),
      "sporter ziet coachcontext over zichzelf niet",
    );
    const delByOther = await req("DELETE", `/api/coach/context-items/${itemId}`, clerkCoachB);
    assert(delByOther.status === 404, `vreemde coach verwijderen: verwacht 404, kreeg ${delByOther.status}`);
    const del = await req("DELETE", `/api/coach/context-items/${itemId}`, clerkCoach);
    assert(del.status === 200, `verwijderen: verwacht 200, kreeg ${del.status}`);
  });

  await scenario("context-items gate: deelt-niet sporter 403", async () => {
    const r = await req("POST", `/api/coach/athletes/${clerkAthleteNone}/context-items`, clerkCoach, {
      kind: "instructie",
      body: "Rustig aan",
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  await cleanup();
  await stopServer();

  // ── Rapport ────────────────────────────────────────────────────────────────
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
