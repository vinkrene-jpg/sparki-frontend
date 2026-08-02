/**
 * Sparki design tokens — ÉÉN licht thema (besluit LICHT_THEMA_01, 3 aug 2026).
 *
 * Deze waarden zijn de exacte sRGB-omzetting van de web-tokens in
 * `artifacts/sparki/src/index.css` (@theme, oklch). Er is GEEN verschil tussen
 * app en browser (regel LT-05/LT-14): dezelfde kleurwaarden op beide platforms.
 * Er is één thema, licht — geen licht/donker-schakelaar. Beide device-schema's
 * (`light` en `dark`) verwijzen daarom naar hetzelfde lichte palet.
 *
 * Lichte-laag-principes (waarom licht ≠ donker omgedraaid, gelijk aan web):
 * • Achtergrond is warm gebroken wit (#fbfaf7), nooit klinisch #fff.
 * • Tekst is donker met warme ondertoon (#16181d), niet puur #000.
 * • Diepte komt van ECHTE schaduw (zachte box-shadows op kaarten), niet van
 *   gloed. Kaartvlak is dekkend wit (#ffffff) zodat het van de body afsteekt.
 * • Randen zijn subtiel en donkergetint (voorgrond met lage dekking).
 * • Accent (cyaan) is DONKERDER gemaakt (#008f9f) zodat het leesbaar
 *   contrasteert op licht — een lichte cyaan verdwijnt op wit.
 *
 * UITZONDERINGEN (bewust donker, gelijk aan web — NIET via dit palet):
 * • Kaart-/navigatie-HUD boven de donkere CARTO-tegels (route-navigator).
 * • Camera-viewfinder.
 * Die schermen zetten hun eigen donkere HUD-kleuren lokaal en gebruiken dit
 * lichte palet bewust niet.
 */

const sparki = {
  // Legacy aliases
  text: "#16181d",        // = foreground (donkere tekst)
  tint: "#008f9f",        // = accent-cyan (donkerder cyaan voor licht)

  // Core surfaces
  background: "#fbfaf7",  // warm gebroken wit (body) — oklch(0.985 0.004 95)
  foreground: "#16181d",  // donkere tekst — oklch(0.21 0.01 260)

  // Cards / elevated surfaces (dekkend wit; diepte via schaduw, niet gloed)
  card: "#ffffff",        // oklch(1 0 0)
  cardForeground: "#16181d",

  // Primary action (donker vlak met lichte tekst)
  primary: "#1c1f25",     // oklch(0.24 0.012 260)
  primaryForeground: "#fbfaf7",

  // Secondary / less-emphasis interactive surfaces (zacht grijs-wit)
  secondary: "#efeeeb",   // oklch(0.95 0.004 95)
  secondaryForeground: "#1c1f25",

  // Muted / subdued (dividers, timestamps, placeholders)
  muted: "#f1f0ed",       // oklch(0.955 0.004 95)
  mutedForeground: "#4f5358", // oklch(0.44 0.01 260) — leesbaar op licht

  // Accent highlights (licht cyaan-getint oppervlak)
  accent: "#e0f3f4",      // oklch(0.95 0.02 200)
  accentForeground: "#1c1f25",

  // Destructive (donkerder rood voor licht)
  destructive: "#cc272e", // oklch(0.55 0.2 25)
  destructiveForeground: "#ffffff",

  // Borders and input outlines (donkergetint met lage dekking, op licht)
  border: "rgba(22,24,29,0.12)",  // foreground / 12%
  input: "rgba(22,24,29,0.18)",   // foreground / 18%
};

const colors = {
  // Eén thema, licht: beide device-schema's wijzen naar hetzelfde palet.
  light: sparki,
  dark: sparki,
  radius: 16,
};

export default colors;
