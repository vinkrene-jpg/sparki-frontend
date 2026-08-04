// Meetniveau-engine — pure rekenlaag (geen IO).
//
// Regels (MEETNIVEAU_EN_UITLEG_01 §3.2):
// - kijk naar de laatste 10 activiteiten
// - ≥6 met vermogenssignaal  → vermogensspoor actief (intern SPOOR_V)
// - ≥6 met hartslagsignaal   → hartslagspoor actief (intern SPOOR_H)
// - beide                    → intern SPOOR_VH
// - rusthartslag/HRV op ≥3 van de laatste 7 dagen → herstelspoor waargenomen
//   (onafhankelijk van de ritsporen: het is een eigen draagbare-waarneming, B2)
// - het NIVEAU HERSTEL_R (§3 tabel) vereist bovendien beide ritsporen (B1) —
//   die koppeling zit in interneCode, niet in de waarneming zelf.
//
// Het niveau is levend: het zakt en stijgt mee met wat er binnenkomt.

import type { MeetniveauCode, SpoorWaarneming } from "./types";

export type ActiviteitSignalen = { power: boolean; hr: boolean };

const VENSTER = 10;
const SPOOR_DREMPEL = 6;
const HERSTEL_DREMPEL = 3;

export function computeSporen(
  laatsteActiviteiten: ActiviteitSignalen[],
  hersteldagen: number,
): SpoorWaarneming {
  const bekeken = laatsteActiviteiten.slice(0, VENSTER);
  const vermogen =
    bekeken.filter((a) => a.power).length >= SPOOR_DREMPEL;
  const hartslag = bekeken.filter((a) => a.hr).length >= SPOOR_DREMPEL;
  const herstel = hersteldagen >= HERSTEL_DREMPEL;
  return {
    vermogen,
    hartslag,
    herstel,
    activiteitenBekeken: bekeken.length,
    hersteldagen,
  };
}

/** Interne code — alleen voor logging/tests, nooit richting gebruiker (B4). */
export function interneCode(w: SpoorWaarneming): MeetniveauCode {
  // HERSTEL_R als niveau vereist SPOOR_VH (B1) — de herstel-waarneming zelf
  // staat daar los van.
  if (w.herstel && w.vermogen && w.hartslag) return "HERSTEL_R";
  if (w.vermogen && w.hartslag) return "SPOOR_VH";
  if (w.vermogen) return "SPOOR_V";
  if (w.hartslag) return "SPOOR_H";
  return "BASIS";
}

// ── Profielregel (§7) ────────────────────────────────────────────────────────
// Eén regel: wat Sparki van deze gebruiker ziet, met wat ontbreekt erbij en
// waarom. Geen niveaunaam, geen rang, geen kleurcode.

export function profielregel(w: SpoorWaarneming): string {
  const ziet: string[] = [];
  if (w.vermogen) ziet.push("vermogen");
  if (w.hartslag) ziet.push("hartslag");
  if (w.herstel) ziet.push("je herstel");

  const mist: string[] = [];
  if (!w.vermogen)
    mist.push("je vermogen — daarvoor is een vermogensmeter nodig");
  if (!w.hartslag)
    mist.push("je hartslag — daarvoor is een hartslagband nodig");
  if (!w.herstel)
    mist.push(
      "je herstel — daarvoor is een horloge of ring nodig die je 's nachts draagt",
    );

  const zietZin =
    ziet.length === 0
      ? w.activiteitenBekeken > 0
        ? "Sparki ziet van jou je ritten: duur, afstand en hoogtemeters."
        : "Er zijn nog geen activiteiten van je binnengekomen."
      : `Sparki ziet van jou ${formatteerLijst(
          ziet.filter((z) => z !== "je herstel").map((z) => `${z} per rit`),
        )}${w.herstel ? " en je herstel" : ""}.`;

  if (mist.length === 0) return zietZin;
  return `${zietZin} Nog niet: ${mist.join("; ")}.`;
}

function formatteerLijst(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

// ── Melding bij wegvallen van een spoor (§3.2) ───────────────────────────────
// Eén melding per wegval-episode, datapoort-toon: welke sensor hapert en wat
// dat betekent. NOOIT het woord "upgraden" (§4) — dit is geen pakketprobleem.

export type SpoorNaam = "vermogen" | "hartslag" | "herstel";

export function wegvalMelding(spoor: SpoorNaam): { title: string; body: string } {
  switch (spoor) {
    case "vermogen":
      return {
        title: "Geen vermogen meer in je ritten",
        body:
          "In je laatste ritten kwam geen vermogen meer binnen. Controleer je vermogensmeter of de koppeling — zodra er weer vermogen binnenkomt, groeit je analyse vanzelf mee.",
      };
    case "hartslag":
      return {
        title: "Geen hartslag meer in je ritten",
        body:
          "In je laatste ritten kwam geen hartslag meer binnen. Controleer je hartslagband of de koppeling — zodra er weer hartslag binnenkomt, groeit je analyse vanzelf mee.",
      };
    case "herstel":
      return {
        title: "Geen herstelmetingen meer",
        body:
          "Er kwamen de afgelopen week te weinig rusthartslag- of HRV-metingen binnen. Controleer je horloge of ring — zodra de metingen terugkomen, telt je herstel vanzelf weer mee.",
      };
  }
}
