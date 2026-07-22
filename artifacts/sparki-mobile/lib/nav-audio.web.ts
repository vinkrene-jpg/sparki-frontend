// Webvariant: bewust leeg. Live navigatie met geluid/spraak werkt in de
// Sparki-app op de telefoon; in de webweergave klinkt er eerlijk niets
// (geen native audiostack, en de navigatiekaart draait daar toch niet).

import type { CueSound } from "@/lib/nav-cues";

export async function prepareNavAudio(): Promise<void> {}

export function playCueSound(_sound: CueSound): void {}

export function speakCue(_text: string): void {}

export function releaseNavAudio(): void {}
