import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Neon Nacht",
  "hypothese": "OLED-zwart met elektrische limoen-route en magenta fietser: maximaal sprekend in het donker, nul flets.",
  "mapBg": "#04030a",
  "mapLand": "#0d0a1c",
  "routeLine": "#C6FF00",
  "routeCasing": "#2a3300",
  "meetpunt": "#FF00E5",
  "meetpuntRing": "rgba(255,0,229,0.3)",
  "fietserBg": "#FF00E5",
  "fietserFg": "#ffffff",
  "warnBg": "#FF9100",
  "warnFg": "#1a0e00",
  "startBg": "#C6FF00",
  "startFg": "#1f2600",
  "paneelBg": "#07060f",
  "paneelBorder": "rgba(198,255,0,0.35)",
  "tekst": "#f4f4ff",
  "gedempt": "#9d97c4",
  "chartFit": "#C6FF00",
  "chartVermoeid": "#FF00E5",
  "chartVorm": "#00E5FF",
  "chartGrid": "rgba(198,255,0,0.12)",
  "as": "#b6b0dd"
};

export function NeonNacht() {
  return <KleurDemo p={palet} />;
}
