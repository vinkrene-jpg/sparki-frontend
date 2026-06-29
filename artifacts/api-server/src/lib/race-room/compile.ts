import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { downloadObjectToBuffer, uploadRenderedVideo } from "./storage";
import {
  type MusicTrackKey,
  isMusicKey,
  musicFilePath,
  autoPickMusic,
} from "./music";

const execFileAsync = promisify(execFile);

// Real ffmpeg montage engine for Wedstrijd-room day compilations.
//
// Honesty contract: this NEVER fabricates a result. A day with no usable media
// returns { status: "empty" } with a plain-Dutch reason; a render error returns
// { status: "failed" }. A successful render is a genuine montage of the athlete's
// own uploaded photos/clips with their caption text and an optional music bed.

const W = 1280;
const H = 720;
const FPS = 30;
const IMAGE_SEC = 3.5;
const VIDEO_MAX_SEC = 6;
const VIDEO_MIN_SEC = 2;
const INTRO_SEC = 2.6;
const UPDATE_BASE_SEC = 2.6;
const UPDATE_MAX_SEC = 6;
const MAX_CLIPS = 24; // bound render time for a synchronous request

export type CompileItem = {
  kind: string; // "media" | "update"
  objectPath?: string | null;
  mediaType?: string | null;
  caption?: string | null;
  text?: string | null;
  durationSec?: number | null;
};

export type CompileInput = {
  ownerClerkId: string;
  roomTitle: string;
  dayIndex: number;
  dayLabel?: string | null; // e.g. "Dag 2 — 12 juli"
  items: CompileItem[]; // chronological order
  musicKey?: string | null; // null/undefined => auto-pick; "geen" => no music
};

export type CompileResult =
  | { status: "empty"; reason: string }
  | { status: "failed"; reason: string }
  | {
      status: "ready";
      objectPath: string;
      durationSec: number;
      musicTrack: MusicTrackKey | null;
      itemCount: number;
    };

const isImage = (mt?: string | null): boolean => !!mt && mt.startsWith("image/");
const isVideo = (mt?: string | null): boolean => !!mt && mt.startsWith("video/");

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];

function drawFontPrefix(): string {
  const found = FONT_CANDIDATES.find((p) => existsSync(p));
  // Fall back to a fontconfig family name when no concrete file is present;
  // ffmpeg here is built with libfontconfig.
  return found ? `fontfile=${found}` : `font=Sans`;
}

// Wrap text into at most `maxLines` lines of ~maxChars characters.
function wrapText(text: string, maxChars: number, maxLines: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.join("\n");
}

async function run(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", args, {
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

const anull = "anullsrc=channel_layout=stereo:sample_rate=44100";

function commonEncode(t: number): string[] {
  return [
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-t",
    String(t),
    "-shortest",
  ];
}

export async function compileDay(input: CompileInput): Promise<CompileResult> {
  const { ownerClerkId, roomTitle, items } = input;

  const visuals = items.filter(
    (it) =>
      it.kind === "media" &&
      it.objectPath &&
      (isImage(it.mediaType) || isVideo(it.mediaType)),
  );
  if (visuals.length === 0) {
    return {
      status: "empty",
      reason:
        "Nog geen foto's of video's voor deze dag. Upload eerst beeld om een compilatie te maken.",
    };
  }

  // Keep only items that contribute a clip (media + non-empty updates), capped.
  const sequence = items.filter(
    (it) =>
      (it.kind === "media" &&
        it.objectPath &&
        (isImage(it.mediaType) || isVideo(it.mediaType))) ||
      (it.kind === "update" && (it.text || "").trim().length > 0),
  );

  let musicKey: MusicTrackKey | null;
  if (input.musicKey === "geen") {
    musicKey = null;
  } else if (isMusicKey(input.musicKey)) {
    musicKey = input.musicKey;
  } else {
    musicKey = autoPickMusic(input.dayIndex + visuals.length);
  }

  const font = drawFontPrefix();
  let dir = "";
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "rr-compile-"));
    const clipFiles: string[] = [];
    const durations: number[] = [];

    // Intro card: room title + day label.
    {
      const titleFile = path.join(dir, "intro-title.txt");
      const subFile = path.join(dir, "intro-sub.txt");
      await writeFile(titleFile, wrapText(roomTitle || "Wedstrijd", 26, 2), "utf8");
      await writeFile(
        subFile,
        input.dayLabel || `Dag ${input.dayIndex}`,
        "utf8",
      );
      const out = path.join(dir, "clip-000-intro.mp4");
      const vf =
        `drawtext=${font}:textfile=${titleFile}:fontcolor=white:fontsize=58:line_spacing=10:` +
        `x=(w-text_w)/2:y=(h/2)-text_h-6,` +
        `drawtext=${font}:textfile=${subFile}:fontcolor=0x59d6e6:fontsize=34:` +
        `x=(w-text_w)/2:y=(h/2)+14,format=yuv420p`;
      await run([
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-t",
        String(INTRO_SEC),
        "-i",
        `color=c=0x05070e:s=${W}x${H}:r=${FPS}`,
        "-f",
        "lavfi",
        "-t",
        String(INTRO_SEC),
        "-i",
        anull,
        "-vf",
        vf,
        "-map",
        "0:v",
        "-map",
        "1:a",
        ...commonEncode(INTRO_SEC),
        out,
      ]);
      clipFiles.push(out);
      durations.push(INTRO_SEC);
    }

    let idx = 0;
    for (const it of sequence) {
      if (clipFiles.length - 1 >= MAX_CLIPS) break; // -1 for intro
      idx += 1;
      const tag = String(idx).padStart(3, "0");

      if (it.kind === "update") {
        const t = Math.min(
          UPDATE_MAX_SEC,
          UPDATE_BASE_SEC + (it.text || "").trim().length * 0.035,
        );
        const txtFile = path.join(dir, `upd-${tag}.txt`);
        await writeFile(txtFile, wrapText((it.text || "").trim(), 34, 6), "utf8");
        const out = path.join(dir, `clip-${tag}-upd.mp4`);
        const vf =
          `drawtext=${font}:textfile=${txtFile}:fontcolor=white:fontsize=44:line_spacing=12:` +
          `x=(w-text_w)/2:y=(h-text_h)/2,format=yuv420p`;
        await run([
          "-y",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-t",
          String(t),
          "-i",
          `color=c=0x070d16:s=${W}x${H}:r=${FPS}`,
          "-f",
          "lavfi",
          "-t",
          String(t),
          "-i",
          anull,
          "-vf",
          vf,
          "-map",
          "0:v",
          "-map",
          "1:a",
          ...commonEncode(t),
          out,
        ]);
        clipFiles.push(out);
        durations.push(t);
        continue;
      }

      // media
      const { buffer } = await downloadObjectToBuffer(it.objectPath!);
      const ext = isVideo(it.mediaType) ? "src.mp4" : "src.img";
      const srcPath = path.join(dir, `media-${tag}.${ext}`);
      await writeFile(srcPath, buffer);

      const capFile = path.join(dir, `cap-${tag}.txt`);
      const hasCaption = (it.caption || "").trim().length > 0;
      if (hasCaption) {
        await writeFile(capFile, wrapText((it.caption || "").trim(), 38, 3), "utf8");
      }
      const caption = hasCaption
        ? `,drawtext=${font}:textfile=${capFile}:fontcolor=white:fontsize=40:line_spacing=8:` +
          `x=(w-text_w)/2:y=h-text_h-64:box=1:boxcolor=0x05070e@0.55:boxborderw=22`
        : "";

      const out = path.join(dir, `clip-${tag}-media.mp4`);

      if (isImage(it.mediaType)) {
        const t = IMAGE_SEC;
        const frames = Math.round(t * FPS);
        const vf =
          `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
          `zoompan=z='min(zoom+0.0010,1.20)':d=${frames}:` +
          `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},` +
          `setsar=1,format=yuv420p${caption}`;
        await run([
          "-y",
          "-loglevel",
          "error",
          "-loop",
          "1",
          "-t",
          String(t),
          "-i",
          srcPath,
          "-f",
          "lavfi",
          "-t",
          String(t),
          "-i",
          anull,
          "-vf",
          vf,
          "-map",
          "0:v",
          "-map",
          "1:a",
          ...commonEncode(t),
          out,
        ]);
        clipFiles.push(out);
        durations.push(t);
      } else {
        const raw =
          it.durationSec && it.durationSec > 0
            ? Number(it.durationSec)
            : VIDEO_MAX_SEC;
        const t = Math.max(VIDEO_MIN_SEC, Math.min(VIDEO_MAX_SEC, raw));
        const vf =
          `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
          `fps=${FPS},setsar=1,format=yuv420p${caption}`;
        await run([
          "-y",
          "-loglevel",
          "error",
          "-ss",
          "0",
          "-t",
          String(t),
          "-i",
          srcPath,
          "-f",
          "lavfi",
          "-t",
          String(t),
          "-i",
          anull,
          "-vf",
          vf,
          "-map",
          "0:v",
          "-map",
          "1:a",
          ...commonEncode(t),
          out,
        ]);
        clipFiles.push(out);
        durations.push(t);
      }
    }

    if (clipFiles.length === 0) {
      return {
        status: "empty",
        reason: "Geen bruikbaar beeld gevonden voor deze dag.",
      };
    }

    // Concat list.
    const listFile = path.join(dir, "list.txt");
    await writeFile(
      listFile,
      clipFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf8",
    );

    const total = durations.reduce((a, b) => a + b, 0);
    const fadeStart = Math.max(0, total - 2);
    const bedPath = musicKey ? musicFilePath(musicKey) : null;
    if (musicKey && !bedPath) {
      // Requested/auto bed missing on disk: render without audio rather than fake it.
      musicKey = null;
    }

    const out = path.join(dir, "compilation.mp4");
    const finalArgs: string[] = [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
    ];
    if (musicKey && bedPath) {
      finalArgs.push(
        "-stream_loop",
        "-1",
        "-i",
        bedPath,
        "-filter_complex",
        `[1:a]volume=0.55,afade=t=out:st=${fadeStart.toFixed(2)}:d=2[a]`,
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-shortest",
      );
    } else {
      finalArgs.push("-map", "0:v", "-an");
    }
    finalArgs.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
    );
    if (musicKey && bedPath) {
      finalArgs.push("-c:a", "aac", "-b:a", "160k");
    }
    finalArgs.push("-t", String(total), out);

    await run(finalArgs);

    const rendered = await readFile(out);
    const objectPath = await uploadRenderedVideo(ownerClerkId, rendered);

    return {
      status: "ready",
      objectPath,
      durationSec: Math.round(total * 100) / 100,
      musicTrack: musicKey,
      itemCount: clipFiles.length - 1, // exclude intro
    };
  } catch (err) {
    return {
      status: "failed",
      reason:
        "De compilatie kon niet worden gemaakt. Probeer het later opnieuw of verwijder een beschadigd bestand.",
    };
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
