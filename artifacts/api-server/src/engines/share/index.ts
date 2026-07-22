// Share-engine facade — routes importeren engines, niet losse lib-helpers.
export {
  buildShareText,
  buildDeterministicShareText,
  getShareCapabilities,
  getSessionStartTime,
  loadOwnedSession,
  uploadSessionToStrava,
  PLATFORM_NOTE,
  type ShareCapabilities,
  type StravaUploadResult,
} from "../../lib/share/ride-share";
