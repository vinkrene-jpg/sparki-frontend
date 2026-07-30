import { KleurDemo, type Palet } from "./_shared/KleurDemo";

const palet: Palet = {
  "naam": "Retro Koers",
  "hypothese": "Jaren-70 wielerposter: crème ondergrond, bordeaux route, petrol accenten — warm karakter i.p.v. techniek-koelte.",
  "mapBg": "#f6efe0",
  "mapLand": "#e8dcc2",
  "routeLine": "#8E1B32",
  "routeCasing": "#f0e2c8",
  "meetpunt": "#C98A19",
  "meetpuntRing": "rgba(201,138,25,0.3)",
  "fietserBg": "#134E4A",
  "fietserFg": "#f6efe0",
  "warnBg": "#B4451F",
  "warnFg": "#f6efe0",
  "startBg": "#8E1B32",
  "startFg": "#f6efe0",
  "paneelBg": "#f6efe0",
  "paneelBorder": "#2c2418",
  "tekst": "#2c2418",
  "gedempt": "#6e6350",
  "chartFit": "#8E1B32",
  "chartVermoeid": "#134E4A",
  "chartVorm": "#C98A19",
  "chartGrid": "#e1d5ba",
  "as": "#4c4434"
};

export function RetroKoers() {
  return <KleurDemo p={palet} />;
}
