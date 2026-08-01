// Route-aanvraag sessiebewaking (taak #519, reviewronde): zoek- en
// generatieresultaten horen bij precies ÉÉN criteria-set. Elke nieuwe
// zoekopdracht en elke criteriawijziging start een nieuwe sessie; uitkomsten
// van een oudere (nog lopende) aanvraag mogen daarna NOOIT meer worden
// toegepast — anders kan de rijder een voorstel van een vorig startpunt of
// een vorige afstand kiezen.

export type AanvraagSessies = {
  /** Start een nieuwe sessie (wist impliciet alle oudere): geeft het token. */
  nieuweSessie(): number;
  /** Maak alle lopende sessies ongeldig zonder een nieuwe te starten. */
  invalideer(): void;
  /** Is dit token nog de actuele sessie? Alleen dan mag een uitkomst landen. */
  isActueel(token: number): boolean;
};

export function createAanvraagSessies(): AanvraagSessies {
  let actueel = 0; // 0 = geen actieve sessie
  let teller = 0;
  return {
    nieuweSessie() {
      teller += 1;
      actueel = teller;
      return actueel;
    },
    invalideer() {
      actueel = 0;
    },
    isActueel(token: number) {
      return token !== 0 && token === actueel;
    },
  };
}
