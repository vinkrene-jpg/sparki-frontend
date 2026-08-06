// RIJDEN_02 §3 (C4): één naam per handeling — de woordenlijst is bindend en
// leeft op precies één plek. Elke knop/menu-ingang gebruikt deze constanten;
// vervallen varianten ("Zelf plannen", "Automatisch laten maken", "Direct een
// route", "Sparki laat maken", "Bewaard") mogen nergens meer voorkomen.
export const WOORD = {
  /** Sparki kiest en maakt de route — de escape, altijd onderaan (C6). */
  sparkiMaaktHem: "Sparki maakt hem",
  /** De gebruiker zet zelf punten uit. */
  zelfMaken: "Zelf maken",
  /** Een rit vastleggen zonder route vooraf. */
  opnemen: "Opnemen",
  /** Eerder bewaarde routes openen. */
  bewaardeRoutes: "Bewaarde routes",
  /** Een gemaakte keuze aanscherpen (één vraag per keer, §2). */
  verfijnen: "Verfijnen",
  /** De gekozen route vastleggen en afsluiten. */
  klaar: "Klaar",
} as const
