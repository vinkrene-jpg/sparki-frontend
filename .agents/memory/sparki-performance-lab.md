---
name: Sparki Performance Lab (Golf 22)
description: SSOT belastingsmodel + eerlijke radar in /lab; regels voor lab-visualisaties
---

# Performance Lab

- **Eén belastingsmodel**: alle CTL/ATL/TSB komt uit `computeLoad`/`computeLoadSeries` (api-server lib/recovery-load). Routes mogen NOOIT inline EWMA herimplementeren — dat was precies de bug die /lab een tweede waarheid gaf. `computeLoadSeries` is pure: 90d pre-warm, per-datum TSS-som (zelfde dag telt één keer), chart-venster geklampt 7–90 (default 42).
- **Eerlijke radar**: `computePerformanceRadar` (sparki lib/performance-radar) geeft per as `level: null + missingReason` als iets niet meetbaar is — nooit een neutrale 0.5. Vermogen vereist FTP én gewicht (W/kg-schaal 2.0–5.5); Gevoel vereist ≥2 scores in 28d; Regelmaat = sessies-28d/12. UI tekent pas bij ≥3 meetbare assen en toont anders/daaronder "nog niet meetbaar"-lijst met redenen.
- **Why:** honesty-doctrine — een radar met verzonnen assen suggereert gemeten prestatie die er niet is.
- **How to apply:** elke nieuwe lab-/dashboard-visualisatie: reken in een pure lib-functie (testbaar zonder DB), haal getallen uit de bestaande SSOT (profile.ftp, /api/athlete/load), en maak onmeetbaarheid expliciet i.p.v. placeholder-waarden.
- FTP in de UI leidt altijd met `profile.ftp` (Sportpaspoort-SSOT); `AthleteProfile` heeft GEEN `ftpEstimated`-veld op het frontend-type — niet aannemen dat het er is.
