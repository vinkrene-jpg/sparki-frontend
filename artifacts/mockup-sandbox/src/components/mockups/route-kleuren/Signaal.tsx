import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Signaal",
  "hypothese": "Verkeerslicht-logica: verzadigd groen/geel/rood op diep zwart. Elke kleur is een betekenis, niets is decoratie.",
  "mapBg": "#000000",
  "mapLand": "#101010",
  "routeLine": "#00E676",
  "routeCasing": "#003b1f",
  "meetpunt": "#FFD600",
  "meetpuntRing": "rgba(255,214,0,0.35)",
  "fietserBg": "#FFD600",
  "fietserFg": "#000000",
  "warnBg": "#FF1744",
  "warnFg": "#ffffff",
  "startBg": "#00E676",
  "startFg": "#00210f",
  "paneelBg": "#0a0a0a",
  "paneelBorder": "rgba(255,255,255,0.28)",
  "tekst": "#ffffff",
  "gedempt": "#b8b8b8",
  "chartFit": "#00E676",
  "chartVermoeid": "#FF1744",
  "chartVorm": "#FFD600",
  "chartGrid": "rgba(255,255,255,0.16)",
  "as": "#d4d4d4"
};

export function Signaal() {
  return <KleurDemo p={palet} />;
}
