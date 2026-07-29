// Golf 28 — Machtigingenlaag voor de mobiele app.
//
// Eén centrale plek die per machtiging in gewoon Nederlands uitlegt WAAROM
// Sparki die nodig heeft, wat er gebeurt als je weigert (de app blijft werken,
// alleen die ene functie niet) en hoe je de keuze later wijzigt. De teksten
// hier zijn de enige bron — schermen halen hun uitleg uit dit register zodat
// de uitleg overal gelijk en eerlijk is.

import { Linking, Platform } from "react-native";

export type PermissionKey = "locatie" | "achtergrondlocatie" | "bluetooth";

export type PermissionUitleg = {
  key: PermissionKey;
  titel: string;
  // Waarom Sparki dit vraagt — alleen voor de functie die de renner zelf start.
  doel: string;
  // Wat er gebeurt bij weigeren: de app blijft bruikbaar, dit valt weg.
  gevolgWeigeren: string;
  // Hoe je de keuze later omzet.
  wijzigen: string;
};

const WIJZIGEN =
  Platform.OS === "ios"
    ? "Je kunt dit altijd wijzigen via Instellingen → Sparki op je iPhone."
    : "Je kunt dit altijd wijzigen via Instellingen → Apps → Sparki → Rechten.";

export const PERMISSIE_UITLEG: Record<PermissionKey, PermissionUitleg> = {
  locatie: {
    key: "locatie",
    titel: "Locatie",
    doel:
      "Sparki gebruikt je locatie om te navigeren en je rit vast te leggen. Dit gebeurt alleen tijdens een rit die jij zelf start — nooit stiekem op de achtergrond.",
    gevolgWeigeren:
      "Zonder locatietoegang kun je geen rit opnemen of navigeren. De rest van de app blijft gewoon werken.",
    wijzigen: WIJZIGEN,
  },
  achtergrondlocatie: {
    key: "achtergrondlocatie",
    titel: "Locatie op de achtergrond",
    doel:
      "Met achtergrondtoegang blijft je rit doorlopen als het scherm op slot gaat. Zolang je rijdt zie je een melding dat de opname loopt; na het stoppen stopt ook de locatiebepaling.",
    gevolgWeigeren:
      "Zonder achtergrondtoegang wordt je rit alleen opgenomen zolang het scherm aan staat. Dat zie je dan tijdens de rit.",
    wijzigen: WIJZIGEN,
  },
  bluetooth: {
    key: "bluetooth",
    titel: "Bluetooth (apparaten in de buurt)",
    doel:
      "Sparki gebruikt Bluetooth om je wattagemeter, hartslagband of cadanssensor live uit te lezen tijdens een rit.",
    gevolgWeigeren:
      "Zonder Bluetooth-toegang kun je geen sensoren koppelen. Ritten opnemen en navigeren blijven gewoon werken.",
    wijzigen: WIJZIGEN,
  },
};

/**
 * Batterij-optimalisatie-hint (alleen Android relevant): agressieve
 * energiebesparing kan de achtergrondopname alsnog stoppen. Eerlijke uitleg,
 * geen belofte dat het altijd goed gaat.
 */
export function batterijHint(os: string = Platform.OS): string | null {
  if (os !== "android") return null;
  return (
    "Let op: op sommige Android-telefoons kan strenge batterijbesparing de opname alsnog onderbreken. " +
    "Zet batterij-optimalisatie voor Sparki op \u201cNiet beperken\u201d (Instellingen \u2192 Apps \u2192 Sparki \u2192 Batterij) voor lange ritten."
  );
}

/** Open het systeeminstellingenscherm van de app, zodat de renner een eerder geweigerde machtiging kan aanzetten. */
export async function openAppInstellingen(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
