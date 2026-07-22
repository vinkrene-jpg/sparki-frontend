// Source-quality register test: deterministic pure assessment.
//
// Locks in the honesty contract of the central bronnenregister: an empty
// account yields "ontbreekt" + invalid for every source (never a fabricated
// value), fresh complete data earns "goed", stale data degrades to "matig",
// a connector in error state marks measurement channels "onbetrouwbaar", and
// every invalid source carries a plain-Dutch reason.
//
// Run: `pnpm --filter @workspace/api-server run test:source-quality`
// Exits non-zero on any failure. Pure — no database rows are read or written.

import { assessSources, SOURCE_KEYS } from "../engines/source-quality";
import type { SourceQualityInput } from "../engines/source-quality";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

const TODAY = "2026-07-22";

function emptyInput(): SourceQualityInput {
  return {
    today: TODAY,
    profile: {
      exists: false,
      ftp: null,
      ftpEstimated: false,
      weightKg: null,
      birthDate: null,
      weeklyHours: null,
      sport: null,
      developmentGoal: null,
      homeLat: null,
      homeLon: null,
      updatedAt: null,
    },
    sessions: [],
    windowDays: 28,
    metrics: [],
    nutritionLogDates: [],
    ftpMeasurements: [],
    upcomingRaceCount: 0,
    feedbackCount: 0,
    sensors: { power: false, heartRate: false, cadence: false },
    connectors: [],
    garageBikeCount: 0,
    hasActiveCoachLink: false,
  };
}

function richInput(): SourceQualityInput {
  const sessions = [0, 2, 4, 6, 9, 12].map((d) => {
    const dt = new Date(`${TODAY}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - d);
    return {
      date: dt.toISOString().split("T")[0]!,
      hasPower: true,
      hasHeartRate: true,
      hasCadence: true,
      hasTss: true,
      source: "strava",
    };
  });
  const metrics = [0, 1, 2, 3, 4].map((d) => {
    const dt = new Date(`${TODAY}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - d);
    return {
      date: dt.toISOString().split("T")[0]!,
      hrv: 60,
      restingHR: 48,
      sleepHours: 8,
      feelScore: 4,
      fatigueScore: 2,
    };
  });
  return {
    ...emptyInput(),
    profile: {
      exists: true,
      ftp: 250,
      ftpEstimated: false,
      weightKg: 68,
      birthDate: "2008-03-01",
      weeklyHours: 8,
      sport: "cycling",
      developmentGoal: "duurvermogen",
      homeLat: 52.1,
      homeLon: 5.2,
      updatedAt: `${TODAY}T08:00:00Z`,
    },
    sessions,
    metrics,
    nutritionLogDates: sessions.slice(0, 4).map((s) => s.date),
    ftpMeasurements: [{ measuredAt: `${TODAY}T00:00:00Z` }],
    upcomingRaceCount: 2,
    feedbackCount: 5,
    sensors: { power: true, heartRate: true, cadence: true },
    connectors: [{ provider: "strava", status: "connected" }],
    garageBikeCount: 1,
    hasActiveCoachLink: true,
  };
}

function byKey(list: ReturnType<typeof assessSources>, key: string) {
  const found = list.find((s) => s.source === key);
  assert(found, `bron ${key} ontbreekt in register`);
  return found!;
}

scenario("register dekt alle bronnen, precies één rij per bron", () => {
  const reg = assessSources(emptyInput());
  assert(reg.length === SOURCE_KEYS.length, `verwacht ${SOURCE_KEYS.length} rijen, kreeg ${reg.length}`);
  for (const key of SOURCE_KEYS) byKey(reg, key);
});

scenario("leeg account: alles ontbreekt, invalid, met Nederlandse reden — niets verzonnen", () => {
  const reg = assessSources(emptyInput());
  for (const s of reg) {
    assert(s.reliability === "ontbreekt", `${s.source} zou ontbreken, is ${s.reliability}`);
    assert(s.valid === false, `${s.source} mag niet geldig zijn`);
    assert(s.completeness === 0, `${s.source} volledigheid moet 0 zijn`);
    assert(s.lastMeasuredAt === null, `${s.source} mag geen meettijd verzinnen`);
    assert(s.origin === null, `${s.source} mag geen bron verzinnen`);
    assert(typeof s.reason === "string" && s.reason.length > 0, `${s.source} mist een reden`);
  }
});

scenario("rijk vers account: kernbronnen goed en geldig, met meettijd en bron", () => {
  const reg = assessSources(richInput());
  for (const key of ["profiel", "trainingen", "vermogen", "hartslag", "cadans", "herstel", "slaap", "voeding", "doelen", "wedstrijden", "materiaal", "trainer_club", "omstandigheden"] as const) {
    const s = byKey(reg, key);
    assert(s.valid, `${key} zou geldig moeten zijn (${s.reliability}: ${s.reason})`);
  }
  const power = byKey(reg, "vermogen");
  assert(power.reliability === "goed", `vermogen zou goed zijn, is ${power.reliability}`);
  assert(power.origin === "meting", "vermogen komt uit meting");
  assert(power.sensorStatus === "actief", "vermogenssensor is actief");
  assert(power.lastMeasuredAt === TODAY, "meettijd is de nieuwste rit");
  assert(power.completeness === 1, "alle ritten hebben vermogen");
});

scenario("verouderde data degradeert eerlijk naar matig", () => {
  const input = richInput();
  input.sessions = input.sessions.map((s, i) => ({
    ...s,
    date: `2026-06-${String(20 - i).padStart(2, "0")}`,
  }));
  input.metrics = input.metrics.map((m, i) => ({
    ...m,
    date: `2026-06-${String(20 - i).padStart(2, "0")}`,
  }));
  const reg = assessSources(input);
  for (const key of ["trainingen", "vermogen", "hartslag", "herstel", "slaap"] as const) {
    const s = byKey(reg, key);
    assert(s.reliability === "matig", `${key} zou matig zijn, is ${s.reliability}`);
    assert(s.valid, `${key} blijft bruikbaar maar met slag om de arm`);
    assert(s.reason && /dagen/.test(s.reason), `${key} noemt de ouderdom in de reden`);
  }
});

scenario("connector-storing maakt meetkanalen onbetrouwbaar en ongeldig", () => {
  const input = richInput();
  input.connectors = [{ provider: "strava", status: "error" }];
  input.sensors = { power: false, heartRate: false, cadence: false };
  const reg = assessSources(input);
  for (const key of ["vermogen", "hartslag", "cadans"] as const) {
    const s = byKey(reg, key);
    assert(s.reliability === "onbetrouwbaar", `${key} zou onbetrouwbaar zijn, is ${s.reliability}`);
    assert(s.valid === false, `${key} mag geen conclusies voeden`);
    assert(s.sensorStatus === "storing", `${key} sensorstatus zou storing zijn`);
    assert(s.reason && s.reason.includes("storing"), `${key} legt de storing uit`);
  }
});

scenario("gedeeltelijke data: weinig ritten met meting ⇒ matig, nooit goed", () => {
  const input = richInput();
  input.sessions = input.sessions.map((s, i) => ({
    ...s,
    hasPower: i === 0,
  }));
  const reg = assessSources(input);
  const power = byKey(reg, "vermogen");
  assert(power.reliability === "matig", `vermogen zou matig zijn, is ${power.reliability}`);
  assert(power.completeness < 0.5, "volledigheid weerspiegelt het gat");
});

scenario("gekoppeld platform zonder sensor en zonder kanaaldata ⇒ niet_gekoppeld, nooit actief", () => {
  const input = emptyInput();
  input.connectors = [{ provider: "strava", status: "connected" }];
  const reg = assessSources(input);
  for (const key of ["vermogen", "hartslag", "cadans"] as const) {
    const s = byKey(reg, key);
    assert(s.sensorStatus === "niet_gekoppeld", `${key} sensorstatus zou niet_gekoppeld zijn, is ${s.sensorStatus}`);
    assert(s.reliability === "ontbreekt", `${key} zou ontbreken`);
    assert(s.valid === false, `${key} mag niet geldig zijn`);
  }
});

scenario("deterministisch: zelfde input ⇒ identiek register", () => {
  const a = JSON.stringify(assessSources(richInput()));
  const b = JSON.stringify(assessSources(richInput()));
  assert(a === b, "register is niet deterministisch");
});

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "PASS" : "FAIL"} — ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
process.exit(failed.length > 0 ? 1 : 0);
