// RIJDEN_01 §3 — het activiteitenregister van de stappenmachine.
//
// Eén bron voor tabel A (welke activiteiten bestaan), tabel B (afstanden per
// activiteit) en tabel C (welke omgevingsfactoren per activiteit bestaan).
// De stappenmachine toont UITSLUITEND wat hier voor de gekozen activiteit
// staat (U6: een keuze die niet van toepassing is, wordt niet getoond — niet
// uitgegrijsd, niet leeg). De afstanden komen uit tabel B van het document;
// bijstellen = alleen deze tabel aanpassen (§10.4).

import type { Sport, BikeType, ElevationPreference } from "@/hooks/use-routes"

export type ActiviteitId =
  | "wandelen"
  | "sightseeing"
  | "hiken"
  | "hardlopen"
  | "fietsen"
  | "racefiets"
  | "mtb"
  | "gravel"

/** Sportkaartlaag (§2) die bij de activiteit hoort. */
export type SportKaartLaag = "wandelen" | "fietsen" | "mtb" | "gravel"

export type OndergrondKeuze = "geen" | "verhard" | "onverhard"

export type Activiteit = {
  id: ActiviteitId
  label: string
  /** Sportwaarde voor de route-engine (gedeelde datalaag). */
  sport: Sport
  /** Fietstype voor de engine — alleen bij fietsactiviteiten met vast type. */
  bikeType: BikeType | null
  /** Tabel B: schuifbalkbereik + standaard bij "Sparki laat maken". */
  afstand: { minKm: number; maxKm: number; standaardKm: number }
  /** Sportkaartlaag die bij deze activiteit standaard aangaat (§2). */
  kaartlaag: SportKaartLaag
  /** Tabel C — alleen factoren die hier `true` zijn, bestaan bij de stap. */
  factoren: {
    /** Vorm bestaat overal (Rondje · Heen en terug · A naar B). */
    vorm: true
    /** Ondergrondkeuze; `vast` = geen keuze, ligt vast (racefiets/MTB). */
    ondergrond: { keuze: boolean; vast: OndergrondKeuze | null }
    hoogte: boolean
    drukkeWegenVermijden: boolean
    /** Onderweg (koffie/eten/bezienswaardigheden); `standaardAan` = sightseeing. */
    onderweg: { beschikbaar: boolean; standaardAan: boolean }
    klimToevoegen: boolean
    /** Vast aan bij álle activiteiten, geen keuze (tabel C laatste rij). */
    geenWoonwijken: true
  }
}

const F = (opts: {
  ondergrondKeuze?: boolean
  ondergrondVast?: OndergrondKeuze | null
  hoogte?: boolean
  drukkeWegen?: boolean
  onderweg?: boolean
  onderwegStandaardAan?: boolean
  klim?: boolean
}): Activiteit["factoren"] => ({
  vorm: true,
  ondergrond: {
    keuze: opts.ondergrondKeuze ?? false,
    vast: opts.ondergrondVast ?? null,
  },
  hoogte: opts.hoogte ?? false,
  drukkeWegenVermijden: opts.drukkeWegen ?? false,
  onderweg: {
    beschikbaar: opts.onderweg ?? false,
    standaardAan: opts.onderwegStandaardAan ?? false,
  },
  klimToevoegen: opts.klim ?? false,
  geenWoonwijken: true,
})

export const ACTIVITEITEN: readonly Activiteit[] = [
  {
    id: "wandelen",
    label: "Wandelen",
    sport: "walking",
    bikeType: null,
    afstand: { minKm: 2, maxKm: 50, standaardKm: 8 },
    kaartlaag: "wandelen",
    factoren: F({ ondergrondKeuze: true, hoogte: true, onderweg: true }),
  },
  {
    id: "sightseeing",
    label: "Sightseeing",
    sport: "walking",
    bikeType: null,
    afstand: { minKm: 1, maxKm: 20, standaardKm: 5 },
    kaartlaag: "wandelen",
    factoren: F({
      ondergrondKeuze: true,
      drukkeWegen: true,
      onderweg: true,
      onderwegStandaardAan: true,
    }),
  },
  {
    id: "hiken",
    label: "Hiken",
    sport: "hiking",
    bikeType: null,
    afstand: { minKm: 5, maxKm: 60, standaardKm: 15 },
    kaartlaag: "wandelen",
    factoren: F({ ondergrondKeuze: true, hoogte: true, onderweg: true, klim: true }),
  },
  {
    id: "hardlopen",
    label: "Hardlopen",
    sport: "running",
    bikeType: null,
    afstand: { minKm: 3, maxKm: 60, standaardKm: 10 },
    kaartlaag: "wandelen",
    factoren: F({ ondergrondKeuze: true, hoogte: true, drukkeWegen: true }),
  },
  {
    id: "fietsen",
    label: "Fietsen",
    sport: "cycling",
    bikeType: null,
    afstand: { minKm: 10, maxKm: 200, standaardKm: 35 },
    kaartlaag: "fietsen",
    factoren: F({
      ondergrondKeuze: true,
      hoogte: true,
      drukkeWegen: true,
      onderweg: true,
    }),
  },
  {
    id: "racefiets",
    label: "Racefiets",
    sport: "cycling",
    bikeType: "racefiets",
    afstand: { minKm: 20, maxKm: 300, standaardKm: 70 },
    kaartlaag: "fietsen",
    factoren: F({ ondergrondVast: "verhard", hoogte: true, klim: true }),
  },
  {
    id: "mtb",
    label: "MTB",
    sport: "cycling",
    bikeType: "mtb",
    afstand: { minKm: 10, maxKm: 150, standaardKm: 35 },
    kaartlaag: "mtb",
    factoren: F({ ondergrondVast: "onverhard", hoogte: true, klim: true }),
  },
  {
    id: "gravel",
    label: "Gravel",
    sport: "cycling",
    bikeType: "gravel",
    afstand: { minKm: 15, maxKm: 250, standaardKm: 60 },
    kaartlaag: "gravel",
    factoren: F({
      ondergrondKeuze: true,
      hoogte: true,
      onderweg: true,
      klim: true,
    }),
  },
]

export function activiteit(id: ActiviteitId): Activiteit {
  const a = ACTIVITEITEN.find((x) => x.id === id)
  if (!a) throw new Error(`Onbekende activiteit: ${id}`)
  return a
}

/** Vorm-opties (tabel C, rij 1) — overal beschikbaar. */
export type VormKeuze = "rondje" | "heen-terug" | "a-naar-b"
export const VORMEN: { id: VormKeuze; label: string }[] = [
  { id: "rondje", label: "Rondje" },
  { id: "heen-terug", label: "Heen en terug" },
  { id: "a-naar-b", label: "A naar B" },
]

/** Hoogte-opties (tabel C) → engine ElevationPreference. */
export type HoogteKeuze = "vlak" | "heuvelachtig" | "veel-klim"
export const HOOGTES: { id: HoogteKeuze; label: string; engine: ElevationPreference }[] = [
  { id: "vlak", label: "Vlak", engine: "flat" },
  { id: "heuvelachtig", label: "Heuvelachtig", engine: "hilly" },
  { id: "veel-klim", label: "Veel klim", engine: "hilly" },
]

/** Klem een (trainings)afstand binnen het tabel B-bereik van de activiteit. */
export function klemAfstand(a: Activiteit, km: number): number {
  return Math.min(a.afstand.maxKm, Math.max(a.afstand.minKm, Math.round(km)))
}

/**
 * Standaardafstand voor "Sparki laat maken": staat er vandaag een training
 * met een bruikbare afstand, dan wint die (geklemd op tabel B); anders de
 * tabel B-standaard. Geeft ook terug of het een trainingsvoorstel is, zodat
 * de regel "Sparki's voorstel voor je training: … km" eerlijk getoond wordt.
 */
export function standaardAfstand(
  a: Activiteit,
  trainingKm: number | null,
): { km: number; uitTraining: boolean } {
  if (trainingKm != null && Number.isFinite(trainingKm) && trainingKm > 0) {
    return { km: klemAfstand(a, trainingKm), uitTraining: true }
  }
  return { km: a.afstand.standaardKm, uitTraining: false }
}

/**
 * Vormkeuze → generate-payload (RIJDEN_01 stap 3-Z). Pure functie zodat het
 * contract testbaar is: elke vorm levert een ANDERE geldige payload op.
 * - rondje      → mode "loop" (de lusgenerator)
 * - heen-terug  → mode "out_and_back" (server plant start → keerpunt → start)
 * - a-naar-b    → mode "ptp" + destinationText (server geocodeert de
 *                 bestemming en weigert eerlijk met 422 als die niet bestaat)
 * Zonder bestemming is A-naar-B geen geldige aanvraag — dan komt er een
 * eerlijke fout terug in plaats van een stil teruggevallen rondje.
 */
export type VormPayload =
  | { mode: "loop" }
  | { mode: "out_and_back" }
  | { mode: "ptp"; destinationText: string }

export function vormGeneratePayload(
  vorm: VormKeuze,
  bestemming?: string,
): { ok: true; payload: VormPayload } | { ok: false; fout: string } {
  if (vorm === "a-naar-b") {
    const b = (bestemming ?? "").trim()
    if (!b) {
      return {
        ok: false,
        fout: "Vul een bestemming in voor een A-naar-B-route.",
      }
    }
    return { ok: true, payload: { mode: "ptp", destinationText: b } }
  }
  if (vorm === "heen-terug") return { ok: true, payload: { mode: "out_and_back" } }
  return { ok: true, payload: { mode: "loop" } }
}
