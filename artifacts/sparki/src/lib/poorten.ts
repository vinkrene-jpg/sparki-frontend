// Twee gescheiden poorten — MEETNIVEAU_EN_UITLEG_01 §4.
//
// Pakketpoort: heeft deze gebruiker het juiste pakket (Compleet/Trainer)?
// Datapoort:   levert zijn apparatuur deze gegevens?
//
// De belangrijkste eis: ze tonen NOOIT dezelfde melding en lopen nooit door
// elkaar. Bij een sensorprobleem valt het woord "upgraden" niet; bij een
// pakketprobleem staat er nooit "koppel een band".

export type PoortBesluit = "open" | "pakket" | "data";

export type PoortInput = {
  /** Pakketpoort: ontsluit het abonnement dit onderdeel? */
  pakketOk: boolean;
  /** Is het pakketantwoord betrouwbaar bekend? Onbekend ⇒ poort valt open (fail-open UI). */
  pakketBekend: boolean;
  /** Datapoort: levert de apparatuur de benodigde gegevens? */
  dataOk: boolean;
  /** Is de waarneming al binnen? Onbekend ⇒ poort valt open. */
  dataBekend: boolean;
};

/**
 * Precies één uitkomst. Pakket gaat vóór data: zonder pakket is de
 * sensorvraag nog niet aan de orde — zo kan er nooit een dubbele of gemengde
 * melding ontstaan. Onbekende antwoorden blokkeren nooit (fail-open UI;
 * server-side rechten blijven leidend).
 */
export function bepaalPoort(input: PoortInput): PoortBesluit {
  if (input.pakketBekend && !input.pakketOk) return "pakket";
  if (input.dataBekend && !input.dataOk) return "data";
  return "open";
}

// ── Meldingsteksten ──────────────────────────────────────────────────────────
// Eén bron voor beide meldingsvormen, zodat de scheiding toetsbaar is.

export type SensorSoort = "vermogensmeter" | "hartslagband" | "draagbare";

/** Pakketmelding: wat het pakket toevoegt + pad naar upgraden. Nooit sensortaal. */
export function pakketMelding(onderdeel: string): {
  titel: string;
  body: string;
  actieLabel: string;
  actieHref: string;
} {
  return {
    titel: "Onderdeel van Sparki Compleet",
    body: `${onderdeel} hoort bij Sparki Compleet. Met dat pakket krijg je de diepe analyse van je training — bekijk wat het toevoegt en waar je kunt upgraden.`,
    actieLabel: "Bekijk Sparki Compleet",
    actieHref: "/abonnement",
  };
}

/** Datamelding: welke sensor ontbreekt + wat die zou opleveren. Nooit "upgraden". */
export function dataMelding(sensor: SensorSoort): { titel: string; body: string } {
  switch (sensor) {
    case "vermogensmeter":
      return {
        titel: "Hiervoor is vermogen nodig",
        body: "In je recente ritten zit geen vermogen. Met een vermogensmeter komen hier je powercurve, zoneverdeling en belastingscore te staan.",
      };
    case "hartslagband":
      return {
        titel: "Hiervoor is hartslag nodig",
        body: "In je recente ritten zit geen hartslag. Met een hartslagband komen hier je hartslagzones en interne belasting te staan.",
      };
    case "draagbare":
      return {
        titel: "Hiervoor zijn nachtmetingen nodig",
        body: "Er komen nog geen rusthartslag- of HRV-metingen binnen. Met een horloge of ring die je 's nachts draagt kan hier je herstel gevolgd worden.",
      };
  }
}
