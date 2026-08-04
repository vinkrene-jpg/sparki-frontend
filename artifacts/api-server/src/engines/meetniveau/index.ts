// Meetniveau-engine — public facade (MEETNIVEAU_EN_UITLEG_01 §3).
//
// Het meetniveau is een waarneming, geen instelling: afgeleid uit de laatste
// 10 activiteiten en de laatste 7 dagen herstelmetingen. Levend niveau; één
// melding bij het wegvallen van een spoor, stil terug-groeien. Interne codes
// (SPOOR_*) verlaten de server nooit (B4). Routes en de Data Hub importeren
// vanaf hier, niet uit de internals.

export {
  computeSporen,
  interneCode,
  profielregel,
  wegvalMelding,
  type ActiviteitSignalen,
  type SpoorNaam,
} from "./compute";
export {
  observeSporen,
  refreshMeetniveau,
  type MeetniveauResultaat,
} from "./derive";
export type { MeetniveauCode, SpoorWaarneming, ObservedSporen } from "./types";
