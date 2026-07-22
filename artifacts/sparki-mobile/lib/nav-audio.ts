// Audio-uitvoer voor navigatie-cues (native): korte tonen via expo-audio en
// gesproken aanwijzingen via expo-speech (Nederlandse systeemstem).
//
// Eerlijkheid/etiquette:
// - iOS-stilschakelaar en het mediavolume worden gerespecteerd
//   (playsInSilentMode: false) — staat de telefoon op stil, dan klinkt er niets.
// - shouldPlayInBackground zodat aanwijzingen ook met het scherm uit of de app
//   op de achtergrond doorklinken tijdens een rit.
// - Elke fout is best-effort stil: audio mag navigatie nooit breken.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";

import type { CueSound } from "@/lib/nav-cues";

const SOURCES: Record<CueSound, number> = {
  turn: require("../assets/sounds/turn.wav"),
  sharp: require("../assets/sounds/sharp.wav"),
  offroute: require("../assets/sounds/offroute.wav"),
  arrive: require("../assets/sounds/arrive.wav"),
};

let players: Partial<Record<CueSound, AudioPlayer>> = {};
let prepared = false;

export async function prepareNavAudio(): Promise<void> {
  if (prepared) return;
  prepared = true;
  try {
    await setAudioModeAsync({
      // Respecteer de stilschakelaar: op stil = geen tonen/spraak.
      playsInSilentMode: false,
      // Blijf hoorbaar met scherm uit / app op achtergrond tijdens de rit.
      shouldPlayInBackground: true,
      // Duck andere audio (muziek/podcast) kort in plaats van te stoppen.
      interruptionMode: "duckOthers",
      interruptionModeAndroid: "duckOthers",
    });
  } catch {
    // Best-effort: zonder audiomodus spelen we alsnog met systeemgedrag.
  }
}

export function playCueSound(sound: CueSound): void {
  try {
    let p = players[sound];
    if (!p) {
      p = createAudioPlayer(SOURCES[sound]);
      players[sound] = p;
    }
    p.seekTo(0);
    p.play();
  } catch {
    // Stil falen: een gemiste toon mag de navigatie nooit verstoren.
  }
}

export function speakCue(text: string): void {
  try {
    // Nieuwe aanwijzing vervangt een eventueel nog lopende (niet stapelen).
    Speech.stop();
    Speech.speak(text, { language: "nl-NL" });
  } catch {
    // Stil falen.
  }
}

export function releaseNavAudio(): void {
  try {
    Speech.stop();
  } catch {
    // negeren
  }
  for (const p of Object.values(players)) {
    try {
      p?.remove();
    } catch {
      // negeren
    }
  }
  players = {};
  prepared = false;
}
