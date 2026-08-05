// Eigen Normalized Power-berekening (DATABRONNEN_EN_FTP_01 §3).
//
// Coggan-definitie: 30-seconden voortschrijdend gemiddelde van het vermogen,
// elke waarde tot de vierde macht, het gemiddelde daarvan, dan de
// vierdemachtswortel.
//
// Gedocumenteerde keuzes voor gaten en nulwaarden (D-T3, bewust en expliciet):
//   • De reeks wordt eerst naar een 1 Hz-raster gebracht op basis van de
//     opgenomen tijdstempels.
//   • Een gat van ≤ GAP_FILL_MAX_SEC seconden tussen twee samples geldt als
//     sensor-hapering: de laatste bekende waarde wordt herhaald.
//   • Een langer gat geldt als pauze (auto-stop): die seconden tellen NIET mee
//     — zelfde "moving time"-semantiek als de duurbepaling. Het 30s-venster
//     loopt over de pauze heen gewoon door in samples (niet in klokseconden),
//     zodat een koffiestop de NP niet kunstmatig drukt of tilt.
//   • Een sample zonder vermogenswaarde (null) binnen actieve opname telt als
//     0 W (freewheelen): nullen horen in de NP, dat is de definitie.
//   • Minder dan MIN_ACTIVE_SEC actieve seconden → null (te weinig echte data
//     voor een betekenisvolle NP; eerlijk geen waarde).
//
// Deze functie is de enige NP-bron van Sparki: de waarde van een koppeling is
// uitsluitend terugvaloptie wanneer er geen reeks is, en dan zichtbaar als
// zodanig (bronvermelding — nooit stilzwijgend mengen).

const WINDOW_SEC = 30;
const GAP_FILL_MAX_SEC = 3;
const MIN_ACTIVE_SEC = 300;

export function computeNormalizedPower(
  tSec: number[],
  watts: Array<number | null>,
): number | null {
  if (!Array.isArray(tSec) || !Array.isArray(watts)) return null;
  const n = Math.min(tSec.length, watts.length);
  if (n === 0) return null;

  // 1 Hz-raster opbouwen met gat-beleid.
  const series: number[] = [];
  let prevT: number | null = null;
  let prevW = 0;
  for (let i = 0; i < n; i++) {
    const t = tSec[i];
    if (!Number.isFinite(t)) continue;
    const raw = watts[i];
    const w =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.min(raw, 3000)
        : 0;
    if (prevT != null) {
      const gap = Math.round(t - prevT);
      if (gap <= 0) {
        prevT = t;
        prevW = w;
        continue; // dubbele/teruglopende tijdstempel — sla over
      }
      if (gap > 1 && gap <= GAP_FILL_MAX_SEC) {
        for (let k = 1; k < gap; k++) series.push(prevW); // hapering: herhaal
      }
      // gap > GAP_FILL_MAX_SEC: pauze — niets invullen, venster loopt in
      // samples door.
    }
    series.push(w);
    prevT = t;
    prevW = w;
  }

  if (series.length < MIN_ACTIVE_SEC || series.length < WINDOW_SEC) return null;

  // 30s voortschrijdend gemiddelde → vierde machten → gemiddelde → 4√.
  let windowSum = 0;
  let fourthSum = 0;
  let count = 0;
  for (let i = 0; i < series.length; i++) {
    windowSum += series[i];
    if (i >= WINDOW_SEC) windowSum -= series[i - WINDOW_SEC];
    if (i >= WINDOW_SEC - 1) {
      const avg = windowSum / WINDOW_SEC;
      fourthSum += avg * avg * avg * avg;
      count++;
    }
  }
  if (count === 0) return null;
  const np = Math.pow(fourthSum / count, 0.25);
  if (!Number.isFinite(np) || np <= 0) return null;
  return Math.round(np);
}
