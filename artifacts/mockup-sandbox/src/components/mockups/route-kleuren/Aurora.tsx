import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Aurora",
  "hypothese": "Noorderlicht: diep paarsblauwe nachtkaart met turquoise-groene route en ijswitte tekst — sfeer mét verzadiging.",
  "mapBg": "#0c1030",
  "mapLand": "#181d4a",
  "routeLine": "#00FFC6",
  "routeCasing": "#004d3c",
  "meetpunt": "#7C4DFF",
  "meetpuntRing": "rgba(124,77,255,0.35)",
  "fietserBg": "#00FFC6",
  "fietserFg": "#00251b",
  "warnBg": "#FFAB40",
  "warnFg": "#241300",
  "startBg": "#EAF6FF",
  "startFg": "#0c1030",
  "paneelBg": "#0c1030",
  "paneelBorder": "rgba(0,255,198,0.35)",
  "tekst": "#EAF6FF",
  "gedempt": "#8f9bd4",
  "chartFit": "#00FFC6",
  "chartVermoeid": "#7C4DFF",
  "chartVorm": "#40C4FF",
  "chartGrid": "rgba(234,246,255,0.12)",
  "as": "#aab6e8"
};

export function Aurora() {
  return <KleurDemo p={palet} />;
}
