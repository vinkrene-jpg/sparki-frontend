import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Terra",
  "hypothese": "Buitenwereld-tinten: mosgroene kaart, terracotta route, zand en amber — natuurlijk maar vol verzadiging, nooit vaal.",
  "mapBg": "#1e2a1c",
  "mapLand": "#2c3d27",
  "routeLine": "#E2725B",
  "routeCasing": "#3f1f17",
  "meetpunt": "#F2B705",
  "meetpuntRing": "rgba(242,183,5,0.35)",
  "fietserBg": "#F2B705",
  "fietserFg": "#2c2000",
  "warnBg": "#D64541",
  "warnFg": "#ffffff",
  "startBg": "#EDE6D6",
  "startFg": "#1e2a1c",
  "paneelBg": "#20241c",
  "paneelBorder": "rgba(237,230,214,0.35)",
  "tekst": "#EDE6D6",
  "gedempt": "#a8ab93",
  "chartFit": "#E2725B",
  "chartVermoeid": "#8FBF4D",
  "chartVorm": "#F2B705",
  "chartGrid": "rgba(237,230,214,0.14)",
  "as": "#c0c2ac"
};

export function Terra() {
  return <KleurDemo p={palet} />;
}
