// Sparki Sound Studio — central registry.
//
// This map is the single source of truth for the audio identity. Adding a new
// sound, alarm, or whole pack here is the ONLY change needed: the Sound Manager,
// the wekker and every settings screen read everything from this file. Audio is
// fully original / royalty-free and lives in public/sounds/sparki/<pack>/.
//
// Honesty: an event that has no file in a pack simply makes no sound — nothing
// is faked or substituted.

export const SOUND_EVENTS = [
  "training-start",
  "training-voltooid",
  "record",
  "badge",
  "observatie",
  "doel-bereikt",
  "herinnering",
] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

export type AlarmSound = {
  id: string;
  label: string;
  description: string;
  file: string;
  loop: boolean;
};

export type SoundPack = {
  id: string;
  label: string;
  description: string;
  // event → file name within the pack folder. Absent events make no sound.
  events: Partial<Record<SoundEvent, string>>;
  alarms: AlarmSound[];
};

export const SOUND_PACKS: Record<string, SoundPack> = {
  performance: {
    id: "performance",
    label: "Performance",
    description:
      "Sportief, premium en elektronisch — de eerste eigen Sparki-set.",
    events: {
      "training-voltooid": "training-voltooid.mp3",
      record: "record.mp3",
      observatie: "observatie.mp3",
    },
    alarms: [
      {
        id: "wekker-energie",
        label: "Energie",
        description: "Oplopende elektronische opbouw naar een krachtige finale.",
        file: "wekker-energie.mp3",
        loop: true,
      },
      {
        id: "wekker-sport",
        label: "Sport",
        description: "Triomfantelijke fanfare met stadiongevoel.",
        file: "wekker-sport.mp3",
        loop: false,
      },
      {
        id: "wekker-rust",
        label: "Rust",
        description: "Zachte zonsopkomst — kalm wakker worden.",
        file: "wekker-rust.mp3",
        loop: false,
      },
    ],
  },
};

export const DEFAULT_PACK = "performance";

// BASE_URL already ends with "/" (Vite). Keeps URLs correct under the artifact's
// path prefix — never use a root-relative "/sounds/..." which escapes the prefix.
const BASE = import.meta.env.BASE_URL;

function resolvePack(packId: string): SoundPack {
  return SOUND_PACKS[packId] ?? SOUND_PACKS[DEFAULT_PACK];
}

export function getPack(packId: string): SoundPack {
  return resolvePack(packId);
}

export function listPacks(): SoundPack[] {
  return Object.values(SOUND_PACKS);
}

export function eventUrl(packId: string, event: SoundEvent): string | null {
  const pack = resolvePack(packId);
  const file = pack.events[event];
  return file ? `${BASE}sounds/sparki/${pack.id}/${file}` : null;
}

export function listAlarms(packId: string): AlarmSound[] {
  return resolvePack(packId).alarms;
}

export function resolveAlarm(
  packId: string,
  alarmId: string,
): { url: string; loop: boolean; label: string } | null {
  const pack = resolvePack(packId);
  const a = pack.alarms.find((x) => x.id === alarmId) ?? pack.alarms[0];
  if (!a) return null;
  return {
    url: `${BASE}sounds/sparki/${pack.id}/${a.file}`,
    loop: a.loop,
    label: a.label,
  };
}
