import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Sportief Licht",
  "hypothese": "Lichte werkruimte zonder grijs: kobaltblauw en koraal, gitzwarte letters en harde kaders — fris én leesbaar.",
  "mapBg": "#ffffff",
  "mapLand": "#eef3f9",
  "routeLine": "#0047FF",
  "routeCasing": "#c9d8ff",
  "meetpunt": "#FF3D57",
  "meetpuntRing": "rgba(255,61,87,0.22)",
  "fietserBg": "#0047FF",
  "fietserFg": "#ffffff",
  "warnBg": "#FF3D57",
  "warnFg": "#ffffff",
  "startBg": "#101418",
  "startFg": "#ffffff",
  "paneelBg": "#ffffff",
  "paneelBorder": "#101418",
  "tekst": "#101418",
  "gedempt": "#4a5560",
  "chartFit": "#0047FF",
  "chartVermoeid": "#FF3D57",
  "chartVorm": "#00C48C",
  "chartGrid": "#e3e9f2",
  "as": "#2a323c"
};

export function SportiefLicht() {
  return <KleurDemo p={palet} />;
}
