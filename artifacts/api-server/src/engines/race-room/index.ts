// Wedstrijd-room engine facade. Routes import from here, not from lib/* directly.

export {
  compileDay,
  type CompileItem,
  type CompileInput,
  type CompileResult,
} from "../../lib/race-room/compile";

export {
  MUSIC_TRACKS,
  isMusicKey,
  autoPickMusic,
  type MusicTrack,
  type MusicTrackKey,
} from "../../lib/race-room/music";

export {
  downloadObjectToBuffer,
  uploadRenderedVideo,
} from "../../lib/race-room/storage";
