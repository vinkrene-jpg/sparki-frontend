/**
 * Sparki design tokens — dark, premium, cyan/neon accent.
 * Mirrors the web artifact's cinematic blue-black language so the mobile app
 * shares one visual identity. Applied for both light and dark device schemes:
 * Sparki is always dark.
 */

const sparki = {
  // Legacy aliases
  text: "#e6f7fb",
  tint: "#2fd0e6",

  // Core surfaces
  background: "#05070e",
  foreground: "#e6f7fb",

  // Cards / elevated surfaces (frosted-glass feel over the dark base)
  card: "#0b131f",
  cardForeground: "#e6f7fb",

  // Primary action (cyan neon accent)
  primary: "#2fd0e6",
  primaryForeground: "#04121a",

  // Secondary / less-emphasis interactive surfaces
  secondary: "#111a26",
  secondaryForeground: "#cfe9f0",

  // Muted / subdued (dividers, timestamps, placeholders)
  muted: "#0e1622",
  mutedForeground: "#8aa0b0",

  // Accent highlights
  accent: "#123544",
  accentForeground: "#bff0fa",

  // Destructive
  destructive: "#ff5c6a",
  destructiveForeground: "#ffffff",

  // Borders and input outlines (light, so the dark base shows through)
  border: "rgba(148,190,210,0.16)",
  input: "rgba(148,190,210,0.24)",
};

const colors = {
  light: sparki,
  dark: sparki,
  radius: 16,
};

export default colors;
