// WEDSTRIJDDOEL_BASIS Laag 0 — het basisprofiel wielrennen.
//
// Vier waarden die elke wedstrijdrenner nodig heeft, ongeacht koerssoort
// (klassieke vier-durationsindeling, Allen & Coggan):
//   - drempelvermogen   (bestaande FTP/eFTP uit het profiel)
//   - aeroob maximum    (beste 5 min uit training_sessions.power_bests)
//   - anaerobe capaciteit (beste 1 min)
//   - piekvermogen      (beste 5 sec)
//
// Principes uit het bouwdocument:
//   - alle vier tegelijk bewaakt: gaat één omhoog terwijl een ander wegzakt,
//     dan wordt dat expliciet benoemd (geen weging — dat is de uitbouw);
//   - absolute watts, identiek voor U17/U19/mannen/vrouwen;
//   - meetniveau vraagt "pro" (vermogensmeter). Op "hartslag" een sterk
//     vereenvoudigde versie zonder wattwaarden; op "tijd_gevoel" en
//     "aanwezigheid" eerlijk niet beschikbaar;
//   - eerlijke gaten: geen data in een venster = null, nooit 0 of geschat.
//
// Alles is een leeslaag over bestaande opslag; er wordt niets nieuws bewaard.

import { and, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  ftpHistoryTable,
  trainingSessionsTable,
} from "@workspace/db";

/** Vergelijkingsvenster: huidige waarde = beste in de laatste 90 dagen. */
export const BASISPROFIEL_VENSTER_DAGEN = 90;
/** Boven/onder dit percentage verschil heet een waarde gestegen/gezakt. */
const STABIEL_MARGE_PCT = 2;

export type BasisWaardeSleutel =
  | "drempelvermogen"
  | "aeroob_maximum"
  | "anaerobe_capaciteit"
  | "piekvermogen";

export type BasisWaarde = {
  sleutel: BasisWaardeSleutel;
  label: string;
  /** Vensterduur in seconden; null voor drempel (FTP is geen venster-best). */
  vensterSeconden: number | null;
  /** Huidige waarde in absolute watts; null = eerlijk onbekend. */
  watts: number | null;
  /** Waarde in het vorige venster (dag 91–180), voor de bewaking. */
  vorigeWatts: number | null;
  herkomst: string;
  richting: "gestegen" | "gezakt" | "stabiel" | "onbekend";
  verschilPct: number | null;
};

export type Basisprofiel = {
  status: "volledig" | "vereenvoudigd" | "niet_beschikbaar";
  meetniveau: string | null;
  vensterDagen: number;
  waarden: BasisWaarde[];
  /** Benoemde scheefgroei: minstens één waarde stijgt terwijl een ander zakt. */
  bewaking: { scheefgroei: boolean; toelichting: string | null };
  toelichting: string;
};

const WINDOW_BY_KEY: Record<
  Exclude<BasisWaardeSleutel, "drempelvermogen">,
  { sec: number; label: string }
> = {
  aeroob_maximum: { sec: 300, label: "Aeroob maximum (beste 5 min)" },
  anaerobe_capaciteit: { sec: 60, label: "Anaerobe capaciteit (beste 1 min)" },
  piekvermogen: { sec: 5, label: "Piekvermogen (beste 5 sec)" },
};

function richting(
  nu: number | null,
  vorige: number | null,
): { richting: BasisWaarde["richting"]; verschilPct: number | null } {
  if (nu == null || vorige == null || vorige <= 0) {
    return { richting: "onbekend", verschilPct: null };
  }
  const pct = ((nu - vorige) / vorige) * 100;
  const afgerond = Math.round(pct * 10) / 10;
  if (pct > STABIEL_MARGE_PCT) return { richting: "gestegen", verschilPct: afgerond };
  if (pct < -STABIEL_MARGE_PCT) return { richting: "gezakt", verschilPct: afgerond };
  return { richting: "stabiel", verschilPct: afgerond };
}

/** Beste watt per venster uit power_bests binnen [van, tot). */
function besteUit(
  rows: { powerBests: Record<string, number> | null }[],
  sec: number,
): number | null {
  let best: number | null = null;
  for (const r of rows) {
    const w = r.powerBests?.[String(sec)];
    if (typeof w === "number" && Number.isFinite(w) && w > 0) {
      if (best == null || w > best) best = w;
    }
  }
  return best;
}

export async function computeBasisprofiel(
  clerkId: string,
): Promise<Basisprofiel | null> {
  const [profile] = await db
    .select({
      ftp: athleteProfilesTable.ftp,
      ftpEstimated: athleteProfilesTable.ftpEstimated,
      measurementLevel: athleteProfilesTable.measurementLevel,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile) return null;

  const nu = Date.now();
  const vensterMs = BASISPROFIEL_VENSTER_DAGEN * 86400000;
  const vanRecent = new Date(nu - vensterMs).toISOString().slice(0, 10);
  const vanVorig = new Date(nu - 2 * vensterMs).toISOString().slice(0, 10);

  const sessies = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      powerBests: trainingSessionsTable.powerBests,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        eq(trainingSessionsTable.sport, "cycling"),
        isNotNull(trainingSessionsTable.powerBests),
        gte(trainingSessionsTable.sessionDate, vanVorig),
      ),
    );
  const recent = sessies.filter((s) => s.sessionDate >= vanRecent);
  const vorig = sessies.filter((s) => s.sessionDate < vanRecent);

  const heeftVermogen = recent.length > 0 || vorig.length > 0;

  // Meetniveau-poort. Zonder expliciet gekozen niveau geldt de data zelf als
  // bewijs: echte power_bests bestaan alleen als er met een meter is gereden.
  const meetniveau = profile.measurementLevel ?? null;
  const effectiefPro = meetniveau === "pro" || (meetniveau == null && heeftVermogen);
  if (!effectiefPro) {
    const vereenvoudigd = meetniveau === "hartslag";
    return {
      status: vereenvoudigd ? "vereenvoudigd" : "niet_beschikbaar",
      meetniveau,
      vensterDagen: BASISPROFIEL_VENSTER_DAGEN,
      waarden: [],
      bewaking: { scheefgroei: false, toelichting: null },
      toelichting: vereenvoudigd
        ? "Op meetniveau hartslag is geen wattprofiel mogelijk. Een vereenvoudigd beeld (duur en herhaling) kan wel; wattwaarden vragen een vermogensmeter."
        : "Het basisprofiel vraagt vermogensdata (meetniveau pro). Er is nog geen rit met vermogensmeter ingelezen.",
    };
  }

  // Drempel: huidige FTP + de laatst bekende waarde van vóór het venster.
  let vorigeFtp: number | null = null;
  const grens = vanRecent;
  const [oudeFtp] = await db
    .select({ ftpWatts: ftpHistoryTable.ftpWatts })
    .from(ftpHistoryTable)
    .where(
      and(eq(ftpHistoryTable.clerkId, clerkId), lt(ftpHistoryTable.measuredAt, grens)),
    )
    .orderBy(desc(ftpHistoryTable.measuredAt), desc(ftpHistoryTable.id))
    .limit(1);
  if (oudeFtp) vorigeFtp = oudeFtp.ftpWatts;

  const waarden: BasisWaarde[] = [];
  const ftpNu = typeof profile.ftp === "number" && profile.ftp > 0 ? profile.ftp : null;
  waarden.push({
    sleutel: "drempelvermogen",
    label: "Drempelvermogen",
    vensterSeconden: null,
    watts: ftpNu,
    vorigeWatts: vorigeFtp,
    herkomst:
      ftpNu == null
        ? "geen FTP bekend"
        : profile.ftpEstimated
          ? "eFTP (geschat)"
          : "FTP (ingesteld/gemeten)",
    ...richting(ftpNu, vorigeFtp),
  });

  for (const sleutel of [
    "aeroob_maximum",
    "anaerobe_capaciteit",
    "piekvermogen",
  ] as const) {
    const { sec, label } = WINDOW_BY_KEY[sleutel];
    const nuBest = besteUit(recent, sec);
    const vorigBest = besteUit(vorig, sec);
    waarden.push({
      sleutel,
      label,
      vensterSeconden: sec,
      watts: nuBest,
      vorigeWatts: vorigBest,
      herkomst:
        nuBest == null
          ? `geen rit met vermogensdata in de laatste ${BASISPROFIEL_VENSTER_DAGEN} dagen`
          : "beste venster uit ingelezen ritten (power_bests)",
      ...richting(nuBest, vorigBest),
    });
  }

  // Bewaking: alle vier tellen even zwaar. Stijgt er één terwijl een ander
  // zakt, dan wordt dat benoemd — zonder oordeel over welke belangrijker is.
  const gestegen = waarden.filter((w) => w.richting === "gestegen");
  const gezakt = waarden.filter((w) => w.richting === "gezakt");
  const scheefgroei = gestegen.length > 0 && gezakt.length > 0;

  return {
    status: "volledig",
    meetniveau,
    vensterDagen: BASISPROFIEL_VENSTER_DAGEN,
    waarden,
    bewaking: {
      scheefgroei,
      toelichting: scheefgroei
        ? `${gestegen.map((w) => w.label).join(" en ")} ${gestegen.length === 1 ? "stijgt" : "stijgen"}, maar ${gezakt.map((w) => w.label).join(" en ")} ${gezakt.length === 1 ? "zakt" : "zakken"} weg. In het basisprofiel tellen alle vier de waarden even zwaar.`
        : null,
    },
    toelichting: `Vier waarden in absolute watts, vergeleken met de ${BASISPROFIEL_VENSTER_DAGEN} dagen ervoor. Geen weging naar koerssoort — dat is de uitbouw.`,
  };
}
