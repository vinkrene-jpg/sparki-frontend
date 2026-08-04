---
name: Sparki session graphs & stream analysis
description: How ride graphs/analyses work — streams at ingest only, honest gaps, comparability gate, estimated maxHR labeling.
---

- Per-sample streams are harvested ONLY at file ingest; raw files are not retained, so older sessions honestly have no streams — UI must keep the honest empty state, never backfill.
- Charts must keep `connectNulls={false}` (recharts): sensor dropouts stay visible gaps. **Why:** the no-fabrication contract — interpolating hides sensor failure.
- Session comparison is gated by `assessComparability` (type / duration ×1.35 / shared meetbasis / terrain m-per-km). Not comparable ⇒ show the plain-Dutch reasons, zero numbers.
- HR zones prefer a profile maxHR; without one they fall back to the age formula and MUST be labeled as a leeftijdsschatting wherever shown.
- Interval-vs-plan comparison joins planned workouts by session link, not by date guessing.

## Weekzones & powercurve (Analyse)
- Zonegrenzen bestaan dubbel (server én frontend): wie er één wijzigt zonder de ander laat verdelingen stil uiteenlopen; de bestaande unit-check dekt maar één kant — bij wijziging beide kanten zelf nalopen.
- "Geen FTP"-meldingen moeten dezelfde FTP-bron zien als de rest van de pagina (profiel ÓF nieuwste geldige meting) — anders toont één kaart "geen FTP" naast een zichtbare FTP elders.
- Periodevergelijkingen (blok vs vorig blok) eisen exact even lange, niet-overlappende blokken; ">= daysAgo(N)" telt N+1 dagen — reviewers wijzen dit af.
