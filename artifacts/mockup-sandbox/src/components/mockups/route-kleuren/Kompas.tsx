import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Kompas",
  "hypothese": "Navigatie-klassieker (Garmin-taal): magenta routelijn op een lichte kaart — de route is onmiskenbaar hét onderwerp.",
  "mapBg": "#f3f1ea",
  "mapLand": "#e0ddd2",
  "routeLine": "#D500F9",
  "routeCasing": "#ffffff",
  "meetpunt": "#2962FF",
  "meetpuntRing": "rgba(41,98,255,0.25)",
  "fietserBg": "#2962FF",
  "fietserFg": "#ffffff",
  "warnBg": "#FF6D00",
  "warnFg": "#ffffff",
  "startBg": "#1b1b1b",
  "startFg": "#ffffff",
  "paneelBg": "#faf9f5",
  "paneelBorder": "#1b1b1b",
  "tekst": "#1b1b1b",
  "gedempt": "#5f5c52",
  "chartFit": "#D500F9",
  "chartVermoeid": "#2962FF",
  "chartVorm": "#00B8D4",
  "chartGrid": "#dcd8ca",
  "as": "#3a3830"
};

export function Kompas() {
  return <KleurDemo p={palet} />;
}
