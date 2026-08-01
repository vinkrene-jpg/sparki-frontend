// Client build version. Sent to the API on every authenticated load via the
// X-Sparki-App-Version header so the admin tester overview can show which app
// version each tester is actually running. Bump this on each released build.
export const APP_VERSION = "1.0.0"

// Commit-SHA die tijdens de build is ingebakken (vite define). "onbekend"
// wanneer de buildomgeving geen git-informatie had — eerlijk, nooit verzonnen.
export const BUILD_SHA: string =
  typeof __SPARKI_BUILD_SHA__ === "string" ? __SPARKI_BUILD_SHA__ : "onbekend"

// Eén mobiele waarheid: productie is de gepubliceerde build; al het andere is
// de ontwikkelomgeving (desktop Preview / dev-URL).
export const IS_PRODUCTION_BUILD = import.meta.env.PROD
