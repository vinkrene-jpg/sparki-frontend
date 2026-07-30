import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Huidig (referentie)",
  "hypothese": "De huidige kleuren uit de app: cyaan accent, donkere markers, slate-grijze kaders — de vergelijkingsbasis.",
  "mapBg": "#05070e",
  "mapLand": "#0b1622",
  "routeLine": "#22d3ee",
  "routeCasing": "#0a1420",
  "meetpunt": "rgba(255,170,70,0.95)",
  "meetpuntRing": "rgba(255,170,70,0.35)",
  "fietserBg": "#0b1622",
  "fietserFg": "rgba(120,210,230,1)",
  "warnBg": "rgba(255,160,90,0.95)",
  "warnFg": "#1a0f05",
  "startBg": "#05070e",
  "startFg": "rgba(120,230,140,0.95)",
  "paneelBg": "#05070e",
  "paneelBorder": "rgba(226,232,240,0.18)",
  "tekst": "rgba(255,255,255,0.88)",
  "gedempt": "rgba(148,163,184,0.9)",
  "chartFit": "#2563EB",
  "chartVermoeid": "#EA580C",
  "chartVorm": "#16A34A",
  "chartGrid": "rgba(226,232,240,0.14)",
  "as": "#94a3b8"
};

export function Huidig() {
  return <KleurDemo p={palet} />;
}
