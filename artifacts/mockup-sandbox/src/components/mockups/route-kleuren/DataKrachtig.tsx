import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Data Krachtig",
  "hypothese": "Analyse-eerst: witte datawerkruimte met zwart letterwerk en zware verzadigde categoriekleuren — nooit meer lichtgrijs op wit.",
  "mapBg": "#f8fafc",
  "mapLand": "#e7edf4",
  "routeLine": "#1D4ED8",
  "routeCasing": "#bcd0f7",
  "meetpunt": "#F59E0B",
  "meetpuntRing": "rgba(245,158,11,0.3)",
  "fietserBg": "#1D4ED8",
  "fietserFg": "#ffffff",
  "warnBg": "#DC2626",
  "warnFg": "#ffffff",
  "startBg": "#0f172a",
  "startFg": "#ffffff",
  "paneelBg": "#ffffff",
  "paneelBorder": "#0f172a",
  "tekst": "#0f172a",
  "gedempt": "#334155",
  "chartFit": "#1D4ED8",
  "chartVermoeid": "#EA580C",
  "chartVorm": "#059669",
  "chartGrid": "#dbe3ec",
  "as": "#0f172a"
};

export function DataKrachtig() {
  return <KleurDemo p={palet} />;
}
