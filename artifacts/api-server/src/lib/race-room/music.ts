import path from "node:path";
import { existsSync } from "node:fs";

// Music beds for Wedstrijd-room compilations. These are REAL pre-generated
// instrumental tracks committed under artifacts/api-server/assets/music. Music is
// optional: if a bed file is missing at render time the montage is still produced
// without audio (and we say so) — we never fake a soundtrack.

export type MusicTrackKey = "energiek" | "episch" | "rustig";

export type MusicTrack = {
  key: MusicTrackKey;
  label: string;
  description: string;
};

export const MUSIC_TRACKS: MusicTrack[] = [
  { key: "energiek", label: "Energiek", description: "Stuwend en sportief" },
  { key: "episch", label: "Episch", description: "Filmisch en groots" },
  { key: "rustig", label: "Rustig", description: "Warm en ingetogen" },
];

export function isMusicKey(v: unknown): v is MusicTrackKey {
  return typeof v === "string" && MUSIC_TRACKS.some((t) => t.key === v);
}

function musicDir(): string {
  return (
    process.env.RACE_ROOM_MUSIC_DIR ||
    path.join(process.cwd(), "assets", "music")
  );
}

// Absolute path to a bed file, or null when the requested track is unknown or
// the file is not present on disk.
export function musicFilePath(key: string): string | null {
  const track = MUSIC_TRACKS.find((t) => t.key === key);
  if (!track) return null;
  const p = path.join(musicDir(), `${track.key}.mp3`);
  return existsSync(p) ? p : null;
}

// Deterministic auto-pick (so the same room+day always proposes the same bed).
export function autoPickMusic(seed: number): MusicTrackKey {
  const i = Math.abs(Math.trunc(seed || 0)) % MUSIC_TRACKS.length;
  return MUSIC_TRACKS[i]!.key;
}
