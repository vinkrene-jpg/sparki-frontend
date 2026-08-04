// Meetniveau-engine — MEETNIVEAU_EN_UITLEG_01 §3.
//
// Het meetniveau is een WAARNEMING, geen instelling: Sparki kijkt naar wat er
// feitelijk binnenkomt (laatste 10 activiteiten + laatste 7 dagen
// herstelmetingen) en leidt daaruit af welke sporen actief zijn. Interne
// codes (BASIS/SPOOR_V/SPOOR_H/SPOOR_VH/HERSTEL_R) verlaten de server nooit
// (besluit B4) — naar buiten gaan alleen betekenisvolle booleans en één
// profielregel in gewone taal (§7).

/** Interne spoorcode — NOOIT naar de gebruiker (B4). */
export type MeetniveauCode =
  | "BASIS"
  | "SPOOR_V"
  | "SPOOR_H"
  | "SPOOR_VH"
  | "HERSTEL_R";

/** Waargenomen sporen. Vermogen en hartslag staan NAAST elkaar (B5). */
export type SpoorWaarneming = {
  /** ≥6 van de laatste 10 activiteiten droegen een vermogenssignaal. */
  vermogen: boolean;
  /** ≥6 van de laatste 10 activiteiten droegen een hartslagsignaal. */
  hartslag: boolean;
  /**
   * Herstel: rusthartslag of HRV op ≥3 van de laatste 7 dagen ÉN beide
   * ritsporen actief (B1/B2: herstel bouwt op het volledige meetniveau).
   */
  herstel: boolean;
  /** Hoeveel activiteiten er meegewogen zijn (≤10; eerlijk bij dunne data). */
  activiteitenBekeken: number;
  /** Op hoeveel van de laatste 7 dagen een herstelmeting aanwezig was. */
  hersteldagen: number;
};

/** Wat in athlete_profiles.observed_sporen bewaard wordt. */
export type ObservedSporen = { v: boolean; h: boolean; r: boolean; sinds: string };
