import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Hollands Oranje",
  "hypothese": "Koersidentiteit: leidend oranje op diep marineblauw, wit voor letters — trots en direct herkenbaar.",
  "mapBg": "#0a1a33",
  "mapLand": "#12294d",
  "routeLine": "#FF6D00",
  "routeCasing": "#5b2600",
  "meetpunt": "#FFC400",
  "meetpuntRing": "rgba(255,196,0,0.35)",
  "fietserBg": "#FF6D00",
  "fietserFg": "#ffffff",
  "warnBg": "#FF3D00",
  "warnFg": "#ffffff",
  "startBg": "#ffffff",
  "startFg": "#0a1a33",
  "paneelBg": "#0a1a33",
  "paneelBorder": "rgba(255,255,255,0.3)",
  "tekst": "#ffffff",
  "gedempt": "#9db4d6",
  "chartFit": "#FF6D00",
  "chartVermoeid": "#40C4FF",
  "chartVorm": "#FFC400",
  "chartGrid": "rgba(255,255,255,0.14)",
  "as": "#c5d5ee"
};

export function HollandsOranje() {
  return <KleurDemo p={palet} />;
}
