// Voorbeeldsporter-seed (ANALYSE_UITBREIDING_EN_ZANDBAK_01 §5.1).
//
// Genereert ÉÉN volledig gevulde, fictieve sporter met een jaar aan
// realistische data: ritten met streams (activity_imports.parsed_summary),
// FTP-historie, dagmetingen, doelen en wedstrijden.
//
// Bindende regels uit het document:
// - deterministisch: vaste PRNG-startwaarde; twee runs op DEZELFDE dag geven
//   byte-identieke data (B6). Het anker is de lokale datum, zodat de grafieken
//   (laatste 42/90 dagen) altijd gevuld zijn — de dagen zijn relatief.
// - duidelijk gemarkeerd als voorbeeld: gereserveerd clerkId, naam
//   "Voorbeeldsporter (fictief)", .invalid-mail, source "voorbeeld" op elke rij.
// - nooit koppelbaar aan een echte gebruiker (Clerk kan .invalid nooit uitgeven).
// - GEEN tweede berekening: TSS via deriveTss, streams via buildStreams,
//   powerbests via createPowerSampleCollector — dezelfde paden als echte ingest.
//
// Run: `pnpm --filter @workspace/api-server run seed:voorbeeld`

import {
  db,
  pool,
  athleteProfilesTable,
  privacySettingsTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  racesTable,
  athleteGoalsTable,
  activityImportsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import { deriveTss, ftpAtDate } from "../lib/derived-load";
import { buildStreams, type StreamSample } from "../lib/activity-streams";
import { createPowerSampleCollector } from "../lib/power-bests";
import {
  VOORBEELD_CLERK_ID,
  VOORBEELD_EMAIL,
  VOORBEELD_NAAM,
} from "../lib/voorbeeldsporter";

// ── Deterministische PRNG (mulberry32, vaste startwaarde) ────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lokale (Amsterdam) datum als YYYY-MM-DD — nooit toISOString (UTC-val).
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

type SessieSoort = "interval" | "duur" | "lang" | "herstel";

function sessieStreams(
  rnd: () => number,
  soort: SessieSoort,
  durMin: number,
  ftp: number,
): { samples: StreamSample[]; startHour: number } {
  const samples: StreamSample[] = [];
  const dt = 10; // 10s-resolutie; buildStreams bucket't zelf
  const n = Math.floor((durMin * 60) / dt);
  const startHour = soort === "lang" ? 9 : 18;
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const frac = i / n;
    let target: number;
    if (soort === "interval") {
      // opwarmen → 5 blokken 3min @112% met 3min rust @55% → uitrijden
      const warm = 12 * 60;
      const cool = (durMin - 10) * 60;
      if (t < warm) target = ftp * (0.5 + 0.25 * (t / warm));
      else if (t > cool) target = ftp * 0.5;
      else {
        const cyc = Math.floor((t - warm) / 360);
        const inBlok = (t - warm) % 360 < 180 && cyc < 5;
        target = inBlok ? ftp * 1.12 : ftp * 0.55;
      }
    } else if (soort === "duur") {
      target = ftp * (0.68 + 0.06 * Math.sin(frac * 6));
    } else if (soort === "lang") {
      target = ftp * (0.62 + 0.08 * Math.sin(frac * 10) + 0.04 * Math.sin(frac * 37));
    } else {
      target = ftp * 0.48;
    }
    const p = Math.max(0, Math.round(target + (rnd() - 0.5) * 30));
    // Hartslag volgt vermogen met traagheid + drift naarmate de rit vordert.
    const hrBase = 58 + (p / ftp) * 108;
    const drift = soort === "lang" ? frac * 8 : frac * 4;
    const hr = Math.round(Math.min(196, hrBase + drift + (rnd() - 0.5) * 6));
    const cad = p < ftp * 0.2 ? 0 : Math.round(88 + (rnd() - 0.5) * 10);
    const speed = Math.max(8, 10 + (p / ftp) * 24 + (rnd() - 0.5) * 3);
    dist += (speed / 3.6) * dt;
    samples.push({
      tSec: t,
      power: p,
      heartRate: hr,
      cadence: cad,
      speedKph: Math.round(speed * 10) / 10,
      distanceM: Math.round(dist),
    });
  }
  return { samples, startHour };
}

async function main() {
  const rnd = mulberry32(20260805);

  console.log(`Voorbeeldsporter seeden (${VOORBEELD_CLERK_ID}) …`);
  const profile = await ensureAccount(
    VOORBEELD_CLERK_ID,
    VOORBEELD_EMAIL,
    VOORBEELD_NAAM,
    silentLogger,
  );
  if (!profile) throw new Error("ensureAccount gaf geen profiel terug");

  // Analyse op verzoek (§3) moet op de voorbeeldsporter demonstreerbaar zijn:
  // AI-coaching-toestemming expliciet aan (fictief account, geen echte data).
  await db
    .insert(privacySettingsTable)
    .values({ clerkId: VOORBEELD_CLERK_ID, aiCoachingEnabled: true })
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: { aiCoachingEnabled: true },
    });

  // Idempotent: alle kindrijen eerst weg (identieke uitkomst per run).
  await db.delete(activityImportsTable).where(eq(activityImportsTable.clerkId, VOORBEELD_CLERK_ID));
  await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, VOORBEELD_CLERK_ID));
  await db.delete(athleteDailyMetricsTable).where(eq(athleteDailyMetricsTable.clerkId, VOORBEELD_CLERK_ID));
  await db.delete(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, VOORBEELD_CLERK_ID));
  await db.delete(racesTable).where(eq(racesTable.clerkId, VOORBEELD_CLERK_ID));
  await db.delete(athleteGoalsTable).where(eq(athleteGoalsTable.clerkId, VOORBEELD_CLERK_ID));

  // Sportprofiel.
  const THIS_YEAR = new Date().getFullYear();
  await db
    .insert(athleteProfilesTable)
    .values({
      clerkId: VOORBEELD_CLERK_ID,
      sport: "cycling",
      experienceLevel: "intermediate",
      birthYear: THIS_YEAR - 28,
      ftp: 281,
      weightKg: "72.0",
      goals: "Voorbeelddoel: sterker de zomer in (fictief)",
      weeklyHourTarget: 9,
    } as typeof athleteProfilesTable.$inferInsert)
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: { ftp: 281, weightKg: "72.0" },
    });

  // FTP-historie: rustig stijgend jaar.
  const ftpPunten: Array<{ agoDays: number; watts: number }> = [
    { agoDays: 364, watts: 250 },
    { agoDays: 270, watts: 258 },
    { agoDays: 180, watts: 266 },
    { agoDays: 84, watts: 274 },
    { agoDays: 21, watts: 281 },
  ];
  const ftpEntries = ftpPunten.map((p) => ({
    measuredAt: localDateStr(daysAgo(p.agoDays)),
    ftpWatts: p.watts,
  }));
  await db.insert(ftpHistoryTable).values(
    ftpEntries.map((e) => ({
      clerkId: VOORBEELD_CLERK_ID,
      measuredAt: e.measuredAt,
      ftpWatts: e.ftpWatts,
      testType: "manual",
      notes: "Voorbeelddata (fictief)",
    })),
  );

  // ── Ritten: 52 weken, 3+1-ritme (3 opbouwweken, 1 rustweek) ────────────────
  let sessies = 0;
  const weekTss: number[] = [];
  for (let week = 51; week >= 0; week--) {
    const rustweek = week % 4 === 3;
    const dagen: Array<{ offset: number; soort: SessieSoort; durMin: number }> = rustweek
      ? [
          { offset: 5, soort: "herstel", durMin: 60 },
          { offset: 2, soort: "duur", durMin: 75 },
          { offset: 0, soort: "herstel", durMin: 50 },
        ]
      : [
          { offset: 5, soort: "interval", durMin: 75 },
          { offset: 3, soort: "duur", durMin: 90 },
          { offset: 1, soort: "lang", durMin: 150 + Math.round(rnd() * 6) * 10 },
          { offset: 0, soort: "herstel", durMin: 60 },
        ];
    let wkTss = 0;
    for (const d of dagen) {
      const ago = week * 7 + d.offset;
      if (ago < 0) continue;
      const date = daysAgo(ago);
      const dateStr = localDateStr(date);
      const ftp = ftpAtDate(ftpEntries, dateStr, 281) ?? 281;
      const { samples, startHour } = sessieStreams(rnd, d.soort, d.durMin, ftp);
      const streams = buildStreams(samples);
      if (!streams) continue;

      // Zelfde afgeleiden als echte ingest: bests per seconde, NP 30s-rolling.
      const bests = createPowerSampleCollector();
      for (const s of samples) {
        for (let k = 0; k < 10; k++) bests.add(s.tSec + k, s.power ?? 0);
      }
      const powers = samples.map((s) => s.power ?? 0);
      // NP op 10s-samples: 30s rollend gemiddelde (3 samples), 4e macht.
      let sum4 = 0;
      let cnt = 0;
      for (let i = 2; i < powers.length; i++) {
        const avg = (powers[i]! + powers[i - 1]! + powers[i - 2]!) / 3;
        sum4 += avg ** 4;
        cnt++;
      }
      const np = cnt > 0 ? Math.round((sum4 / cnt) ** 0.25) : null;
      const avgPower = Math.round(powers.reduce((a, b) => a + b, 0) / powers.length);
      const hrs = samples.map((s) => s.heartRate ?? 0);
      const avgHR = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
      const maxHR = Math.max(...hrs);
      const distanceKm = (samples[samples.length - 1]!.distanceM ?? 0) / 1000;
      const derived = deriveTss({
        durationMin: d.durMin,
        normalizedPower: np,
        avgPower,
        ftp,
      });
      wkTss += derived?.tss ?? 0;

      const titel =
        d.soort === "interval"
          ? "Intervaltraining (voorbeeld)"
          : d.soort === "lang"
            ? "Lange duurrit (voorbeeld)"
            : d.soort === "duur"
              ? "Duurrit (voorbeeld)"
              : "Herstelrit (voorbeeld)";

      const [sessie] = await db
        .insert(trainingSessionsTable)
        .values({
          clerkId: VOORBEELD_CLERK_ID,
          sessionDate: dateStr,
          type: "ride",
          sport: "cycling",
          title: titel,
          durationMin: d.durMin,
          distanceKm: distanceKm.toFixed(2),
          elevationM: Math.round(distanceKm * (3 + rnd() * 5)),
          normalizedPower: np,
          avgPower,
          avgHR,
          maxHR,
          avgCadence: 89,
          avgSpeedKph: (distanceKm / (d.durMin / 60)).toFixed(2),
          tss: derived?.tss ?? null,
          intensityFactor: derived ? String(derived.intensityFactor) : null,
          powerBests: bests.finish(),
          signals: { power: true, hr: true, duration: true },
          source: "voorbeeld",
          sources: ["voorbeeld"],
          dedupeKey: `voorbeeld:${dateStr}:${d.soort}`,
          fieldSources: { avgPower: "voorbeeld" },
        })
        .returning({ id: trainingSessionsTable.id });

      await db.insert(activityImportsTable).values({
        clerkId: VOORBEELD_CLERK_ID,
        fileName: `voorbeeld-${dateStr}-${d.soort}.synthetisch`,
        fileType: "unknown",
        source: "voorbeeld",
        status: "parsed",
        dedupeStatus: "new",
        linkedTrainingSessionId: sessie?.id ?? null,
        parsedSummary: {
          sport: "cycling",
          startTime: `${dateStr}T${String(startHour).padStart(2, "0")}:00:00.000Z`,
          durationSec: d.durMin * 60,
          distanceKm,
          voorbeeld: true,
          streams,
        },
      });
      sessies++;
    }
    weekTss.push(wkTss);
  }

  // ── Dagmetingen: heel jaar, gekoppeld aan de belasting ─────────────────────
  const metricRows: (typeof athleteDailyMetricsTable.$inferInsert)[] = [];
  for (let ago = 364; ago >= 0; ago--) {
    const week = Math.floor(ago / 7);
    const zwaar = week % 4 !== 3;
    const hrv = Math.round(62 + (zwaar ? -3 : 3) + (rnd() - 0.5) * 8);
    const rhr = Math.round(47 + (zwaar ? 2 : -1) + (rnd() - 0.5) * 3);
    metricRows.push({
      clerkId: VOORBEELD_CLERK_ID,
      metricDate: localDateStr(daysAgo(ago)),
      hrv,
      restingHR: rhr,
      sleepHours: (7.2 + (rnd() - 0.5) * 1.2).toFixed(2),
      sleepQuality: Math.round(6 + rnd() * 3),
      fatigueScore: zwaar ? Math.round(4 + rnd() * 3) : Math.round(2 + rnd() * 2),
      feelScore: zwaar ? Math.round(5 + rnd() * 3) : Math.round(7 + rnd() * 2),
    });
  }
  // Batch-insert in stukken (Postgres param-limiet).
  for (let i = 0; i < metricRows.length; i += 100) {
    await db.insert(athleteDailyMetricsTable).values(metricRows.slice(i, i + 100));
  }

  // ── Doelen & wedstrijden ───────────────────────────────────────────────────
  await db.insert(athleteGoalsTable).values([
    {
      clerkId: VOORBEELD_CLERK_ID,
      title: "FTP naar 290 W (voorbeeld)",
      horizon: "season",
      status: "active",
      kind: "prestatie",
      targetDate: localDateStr(daysAgo(-60)),
    },
    {
      clerkId: VOORBEELD_CLERK_ID,
      title: "Drie keer per week trainen volhouden (voorbeeld)",
      horizon: "year",
      status: "active",
      kind: "gedrag",
    },
  ] as (typeof athleteGoalsTable.$inferInsert)[]);

  await db.insert(racesTable).values([
    {
      clerkId: VOORBEELD_CLERK_ID,
      name: "Voorjaarsklassieker (voorbeeld)",
      raceDate: localDateStr(daysAgo(120)),
      priority: "B",
      status: "afgerond",
    },
    {
      clerkId: VOORBEELD_CLERK_ID,
      name: "Clubkampioenschap (voorbeeld)",
      raceDate: localDateStr(daysAgo(-35)),
      priority: "A",
      status: "gepland",
    },
    {
      clerkId: VOORBEELD_CLERK_ID,
      name: "Najaarstocht (voorbeeld)",
      raceDate: localDateStr(daysAgo(-90)),
      priority: "C",
      status: "gepland",
    },
  ] as (typeof racesTable.$inferInsert)[]);

  const totTss = weekTss.reduce((a, b) => a + b, 0);
  console.log(
    `Klaar: ${sessies} ritten (met streams + powerbests), ${metricRows.length} dagmetingen, ` +
      `${ftpEntries.length} FTP-punten, 2 doelen, 3 wedstrijden. Jaar-TSS ≈ ${totTss}.`,
  );
}

main()
  .catch((err) => {
    console.error("Seed mislukt:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
