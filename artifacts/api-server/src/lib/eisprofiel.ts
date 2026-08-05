// ANALYSE_UITBREIDING §2 — Eisprofiel wedstrijd (vierde kaart, spoor V).
//
// Wat de koers waar je voor traint van je vraagt, tegen je huidige curve.
// Eerlijk by construction:
// - de "eis" is geen verzonnen norm maar een deterministische selectie van
//   curve-vensters die voor dat wedstrijdtype tellen;
// - de vergelijking is altijd tegen je EIGEN beste waarde (recent 42-dagenblok
//   vs ooit), nooit tegen een gefabriceerde wattage-norm;
// - geen wedstrijd, geen vermogensdata of een ontbrekend venster ⇒ benoemde
//   reden in plaats van een getal.

import { db, racesTable, trainingSessionsTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { powerBestPeriods, localDateStr } from "./analysis-periods";

// Welke vensters (seconden) tellen per wedstrijdtype — deterministisch register.
// Sleutels volgen races.race_type / discipline (vrije tekst → genormaliseerd).
const EIS_REGISTER: Array<{
  match: RegExp;
  label: string;
  vensters: Array<{ sec: number; rol: string }>;
}> = [
  {
    match: /criterium|crit/i,
    label: "Criterium",
    vensters: [
      { sec: 15, rol: "sprint uit de bocht" },
      { sec: 60, rol: "herstart na herstart volhouden" },
      { sec: 300, rol: "vlucht of slotfase" },
    ],
  },
  {
    match: /tijdrit|tt\b|time.?trial/i,
    label: "Tijdrit",
    vensters: [
      { sec: 1200, rol: "constant hoog vermogen" },
      { sec: 300, rol: "start en oplopende stukken" },
    ],
  },
  {
    match: /klim|berg|heuvel/i,
    label: "Klimkoers",
    vensters: [
      { sec: 1200, rol: "lange klimmen" },
      { sec: 300, rol: "steile stroken" },
      { sec: 60, rol: "aanzetten op de klim" },
    ],
  },
  {
    match: /veld|cyclocross|cx\b|gravel|mtb|mountain/i,
    label: "Veld/gravel",
    vensters: [
      { sec: 20, rol: "explosief uit technische stukken" },
      { sec: 60, rol: "korte krachtstukken" },
      { sec: 300, rol: "tempoblokken" },
    ],
  },
  {
    // Vangnet: wegwedstrijd / onbekend type.
    match: /./,
    label: "Wegwedstrijd",
    vensters: [
      { sec: 60, rol: "aanvallen volgen" },
      { sec: 300, rol: "waaiers en kuitenbijters" },
      { sec: 1200, rol: "lange druk in de finale" },
    ],
  },
];

export type EisprofielVenster = {
  sec: number;
  rol: string;
  recentWatts: number | null;
  besteWatts: number | null;
  /** recent t.o.v. eigen beste (0–1); null als een van beide ontbreekt. */
  verhouding: number | null;
  reden: string | null;
};

export type Eisprofiel =
  | { beschikbaar: false; reden: string }
  | {
      beschikbaar: true;
      wedstrijd: { id: number; name: string; raceDate: string; typeLabel: string };
      vensters: EisprofielVenster[];
      /** Venster met de laagste verhouding — waar je curve nu het meest tekortschiet. */
      zwaksteVenster: number | null;
    };

export async function computeEisprofiel(clerkId: string): Promise<Eisprofiel> {
  const vandaag = localDateStr();
  const races = await db
    .select({
      id: racesTable.id,
      name: racesTable.name,
      raceDate: racesTable.raceDate,
      priority: racesTable.priority,
      raceType: racesTable.raceType,
      discipline: racesTable.discipline,
      course: racesTable.course,
    })
    .from(racesTable)
    .where(
      and(
        eq(racesTable.clerkId, clerkId),
        eq(racesTable.status, "gepland"),
        gte(racesTable.raceDate, vandaag),
      ),
    );
  if (races.length === 0) {
    return {
      beschikbaar: false,
      reden: "Geen geplande wedstrijd — plan een wedstrijd om je curve tegen het eisprofiel te leggen.",
    };
  }
  // Doelwedstrijd: hoogste prioriteit (A > B > C), daarbinnen de eerstvolgende.
  const prioriteit = (p: string) => (p === "A" ? 0 : p === "B" ? 1 : 2);
  races.sort(
    (a, b) => prioriteit(a.priority) - prioriteit(b.priority) || a.raceDate.localeCompare(b.raceDate),
  );
  const race = races[0]!;
  const typeTekst = [race.raceType, race.discipline, race.course].filter(Boolean).join(" ");
  const register = EIS_REGISTER.find((r) => r.match.test(typeTekst || "weg"))!;

  const rows = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      powerBests: trainingSessionsTable.powerBests,
    })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, clerkId));

  const { recentStart } = powerBestPeriods(vandaag);
  const beste: Record<string, number> = {};
  const recent: Record<string, number> = {};
  let metBests = 0;
  for (const row of rows) {
    if (!row.powerBests || typeof row.powerBests !== "object") continue;
    metBests += 1;
    for (const [win, watts] of Object.entries(row.powerBests)) {
      if (typeof watts !== "number" || !Number.isFinite(watts)) continue;
      if (!beste[win] || watts > beste[win]!) beste[win] = watts;
      if (row.sessionDate >= recentStart && (!recent[win] || watts > recent[win]!)) {
        recent[win] = watts;
      }
    }
  }
  if (metBests === 0) {
    return {
      beschikbaar: false,
      reden: "Geen ritten met echte vermogens-samples — het eisprofiel vergelijkt alleen gemeten waarden.",
    };
  }

  const vensters: EisprofielVenster[] = register.vensters.map(({ sec, rol }) => {
    const b = beste[String(sec)] ?? null;
    const r = recent[String(sec)] ?? null;
    if (b == null) {
      return { sec, rol, recentWatts: r, besteWatts: null, verhouding: null, reden: "Geen gemeten waarde voor dit venster." };
    }
    if (r == null) {
      return { sec, rol, recentWatts: null, besteWatts: b, verhouding: null, reden: "Geen recente meting (laatste 42 dagen) voor dit venster." };
    }
    return { sec, rol, recentWatts: r, besteWatts: b, verhouding: Math.round((r / b) * 100) / 100, reden: null };
  });
  const meetbaar = vensters.filter((v) => v.verhouding != null);
  const zwakste = meetbaar.length
    ? meetbaar.reduce((min, v) => (v.verhouding! < min.verhouding! ? v : min)).sec
    : null;

  return {
    beschikbaar: true,
    wedstrijd: { id: race.id, name: race.name, raceDate: race.raceDate, typeLabel: register.label },
    vensters,
    zwaksteVenster: zwakste,
  };
}
