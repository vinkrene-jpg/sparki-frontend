import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Hoog Contrast",
  "hypothese": "Buitenlicht-eerst: puur zwart-wit met één signaalgeel. Op een stuur in fel zonlicht wint contrast van kleurpracht.",
  "mapBg": "#ffffff",
  "mapLand": "#ededed",
  "routeLine": "#000000",
  "routeCasing": "#ffffff",
  "meetpunt": "#FFD600",
  "meetpuntRing": "#000000",
  "fietserBg": "#000000",
  "fietserFg": "#FFD600",
  "warnBg": "#FFD600",
  "warnFg": "#000000",
  "startBg": "#000000",
  "startFg": "#ffffff",
  "paneelBg": "#ffffff",
  "paneelBorder": "#000000",
  "tekst": "#000000",
  "gedempt": "#3d3d3d",
  "chartFit": "#000000",
  "chartVermoeid": "#FFD600",
  "chartVorm": "#6b6b6b",
  "chartGrid": "#e5e5e5",
  "as": "#1a1a1a"
};

export function HoogContrast() {
  return <KleurDemo p={palet} />;
}
