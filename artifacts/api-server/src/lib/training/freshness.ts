// TRAININGSVORMEN_01 F2 — frisheidskost per belastingssoort (TRV-30/31/96).
//
// Dit is uitdrukkelijk een COACHREGEL (coachregel_v1), géén gevalideerd
// model. Elke uitvoer draagt die markering mee en consumenten (UI,
// adviesdossier, rapportage) moeten hem tonen. Wordt deze regel ooit sturend
// voor adviezen, dan valt hij onder de drempel van 02-08 (TRV-96).
//
// Werking:
//  - Per geplande sessie mét bekende belastingssoort één rij in
//    freshness_costs met de STARTKOST (schaal 0–3, opgeslagen ×10).
//  - Verval over dagen is deterministisch en wordt bij het lezen berekend
//    (lineair naar 0 over een vast aantal dagen per soort).
//  - Sessies zonder soort krijgen GEEN rij: geen verzonnen soort (TRV-78),
//    dus ook geen verzonnen kost. De lezer toont "onbekend", nooit 0 (TRV-62).

import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  db,
  freshnessCostsTable,
  plannedWorkoutsTable,
  type Belastingssoort,
} from "@workspace/db";

export const FRESHNESS_METHODE = "coachregel_v1" as const;

// Startkost ×10 (0–30) per soort, afhankelijk van duur in minuten.
// Vaste, uitlegbare tabel — geen formule die precisie suggereert.
export function startkostX10(soort: Belastingssoort, durationMin: number | null): number {
  const dur = durationMin ?? 0;
  switch (soort) {
    case "herstel":
      return 0; // actief herstel kost geen frisheid
    case "techniek_licht":
      return 5;
    case "aeroob_duur":
      if (dur >= 180) return 30;
      if (dur >= 90) return 20;
      return 10;
    case "aeroob_hoog":
      return dur >= 75 ? 25 : 20;
    case "anaeroob":
      return 25;
    case "neuromusculair":
      return 20;
    case "kracht":
      return 20;
  }
}

// Dagen tot de kost lineair op 0 staat (dag 0 = sessiedag, volle kost).
export const VERVALDAGEN: Record<Belastingssoort, number> = {
  herstel: 1,
  techniek_licht: 1,
  aeroob_duur: 3,
  aeroob_hoog: 3,
  anaeroob: 3,
  neuromusculair: 4,
  kracht: 4,
};

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(
    Number(fromISO.slice(0, 4)),
    Number(fromISO.slice(5, 7)) - 1,
    Number(fromISO.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(toISO.slice(0, 4)),
    Number(toISO.slice(5, 7)) - 1,
    Number(toISO.slice(8, 10)),
  );
  return Math.round((b - a) / 86400000);
}

// Restkost ×10 van één bronrij op een gegeven dag (lineair verval).
export function restkostX10(
  startX10: number,
  soort: Belastingssoort,
  sessieDatum: string,
  opDatum: string,
): number {
  const d = daysBetween(sessieDatum, opDatum);
  if (d < 0) return 0; // vóór de sessie telt hij niet
  const D = VERVALDAGEN[soort];
  if (d >= D) return 0;
  return Math.round(startX10 * (1 - d / D));
}

/**
 * Herbereken de freshness_costs-rijen van één sporter uit de geplande
 * trainingen (status "planned"/"completed") met bekende belastingssoort.
 * Idempotent: bestaande rijen worden bijgewerkt, verdwenen bronnen opgeruimd.
 */
export async function recomputeFreshnessForAthlete(clerkId: string): Promise<void> {
  const planned = await db
    .select({
      id: plannedWorkoutsTable.id,
      datum: plannedWorkoutsTable.scheduledDate,
      soort: plannedWorkoutsTable.belastingssoort,
      duur: plannedWorkoutsTable.targetDurationMin,
      status: plannedWorkoutsTable.status,
    })
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, clerkId),
        isNotNull(plannedWorkoutsTable.belastingssoort),
      ),
    );

  const wanted = new Map<string, { datum: string; soort: Belastingssoort; x10: number }>();
  for (const p of planned) {
    if (p.status !== "planned" && p.status !== "completed") continue;
    const soort = p.soort as Belastingssoort;
    wanted.set(`planned:${p.id}`, {
      datum: String(p.datum),
      soort,
      x10: startkostX10(soort, p.duur),
    });
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: freshnessCostsTable.id,
        bron: freshnessCostsTable.afkomstigVan,
        soort: freshnessCostsTable.soort,
        datum: freshnessCostsTable.datum,
        waarde: freshnessCostsTable.waarde,
      })
      .from(freshnessCostsTable)
      .where(eq(freshnessCostsTable.clerkId, clerkId));

    const seen = new Set<string>();
    for (const row of existing) {
      if (!row.bron.startsWith("planned:")) continue; // andere bronnen niet aanraken
      const want = wanted.get(row.bron);
      if (!want || want.soort !== row.soort) {
        await tx.delete(freshnessCostsTable).where(eq(freshnessCostsTable.id, row.id));
        continue;
      }
      seen.add(row.bron);
      if (row.datum !== want.datum || row.waarde !== want.x10) {
        await tx
          .update(freshnessCostsTable)
          .set({ datum: want.datum, waarde: want.x10, updatedAt: sql`now()` })
          .where(eq(freshnessCostsTable.id, row.id));
      }
    }
    for (const [bron, want] of wanted) {
      if (seen.has(bron)) continue;
      await tx
        .insert(freshnessCostsTable)
        .values({
          clerkId,
          datum: want.datum,
          soort: want.soort,
          waarde: want.x10,
          afkomstigVan: bron,
          methode: FRESHNESS_METHODE,
        })
        .onConflictDoUpdate({
          target: [
            freshnessCostsTable.clerkId,
            freshnessCostsTable.afkomstigVan,
            freshnessCostsTable.soort,
          ],
          set: { datum: want.datum, waarde: want.x10, updatedAt: sql`now()` },
        });
    }
  });
}

export type FreshnessDag = {
  datum: string;
  // Som van restkosten per soort, geplafonneerd op 3.0; alleen soorten met
  // een waarde > 0 komen voor. Afwezig = geen bekende kost, niet "0 belasting".
  perSoort: Partial<Record<Belastingssoort, number>>;
};

/** Frisheidskost per soort per dag in [from..to] (beide YYYY-MM-DD). */
export async function freshnessForRange(
  clerkId: string,
  from: string,
  to: string,
): Promise<FreshnessDag[]> {
  const rows = await db
    .select({
      datum: freshnessCostsTable.datum,
      soort: freshnessCostsTable.soort,
      waarde: freshnessCostsTable.waarde,
    })
    .from(freshnessCostsTable)
    .where(eq(freshnessCostsTable.clerkId, clerkId));

  const out: FreshnessDag[] = [];
  const nDays = daysBetween(from, to);
  for (let i = 0; i <= nDays; i++) {
    const day = new Date(Date.UTC(
      Number(from.slice(0, 4)),
      Number(from.slice(5, 7)) - 1,
      Number(from.slice(8, 10)) + i,
    ))
      .toISOString()
      .slice(0, 10);
    const perX10 = new Map<Belastingssoort, number>();
    for (const r of rows) {
      const soort = r.soort as Belastingssoort;
      const rest = restkostX10(r.waarde, soort, r.datum, day);
      if (rest > 0) perX10.set(soort, (perX10.get(soort) ?? 0) + rest);
    }
    const perSoort: FreshnessDag["perSoort"] = {};
    for (const [soort, x10] of perX10) perSoort[soort] = Math.min(30, x10) / 10;
    out.push({ datum: day, perSoort });
  }
  return out;
}
