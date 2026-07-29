# Sparki Governor Fase 1 — Content- en data-analyse

**Audit-commit:** `7e2f1983` · Machineleesbaar: `governance/content-data-rules.json`

## Tekst en content (fase 6)

| # | Vindplaats | Classificatie | Bevinding |
|---|---|---|---|
| C-01 | training-day-home.tsx:485,532 (IF, CTL/ATL/TSB) | TE_TECHNISCH | Technische termen zonder UitlegDot op een hoofdscherm. |
| C-02 | training-day-home.tsx:151-491 + train.tsx:66-68 (TSS, W NP) | TE_TECHNISCH | TSS/NP zonder uitleg in sessie-eigenschappen. |
| C-03 | core-analyse.tsx:1702-1807 | TE_TECHNISCH | Tabelheaders/kerncijfers zonder directe uitleg (elders op de pagina wel UitlegDots). |
| C-04 | UI-breed | BEGRIJPELIJK | Foutmeldingen en lege toestanden zijn Nederlands, begrijpelijk en met vervolgstap (DsState/MissingInputNotice-patroon). |
| C-05 | /train paginatitel "Plan" vs menu-label "Trainen" | VERKEERDE_CONTEXT (licht) | Naamgeving scherm ≠ menu-item; consistentiebesluit nodig. |
| C-06 | upgrade-nudge.tsx | BEGRIJPELIJK | Claims kloppen met geleverde GO-features; expliciet "gratis onderdelen blijven werken". |
| C-07 | health-flow-section.tsx | BEGRIJPELIJK | "Registratie is géén medisch dossier"; onderscheid zelfgerapporteerd/medisch bevestigd. Geen medisch-juridisch risico aangetroffen. |
| C-08 | UI-breed | MASTER_PLAN_CONFLICT | Alle copy hard-coded NL (geen i18n-catalog) — zie verschilregister. |
| C-09 | nieuws/feed | BEGRIJPELIJK | Relevantiefilter (woordgrenzen) voorkomt niet-wielercontent; in-app reader met excerpt+attributie. |

**Tekst-/contentbevindingen: 9** (3 TE_TECHNISCH, 1 licht VERKEERDE_CONTEXT, 1 MASTER_PLAN_CONFLICT, 4 positief vastgelegd).

## Data, grafieken en analyses (fase 7)

Volledige inventaris: 11 grafiektypen (zie screen-component-inventory.json). Alle voeden uit `useLoad`/`computeLoadSeries` (één belastingsmodel, SSOT), `useSessions`, `useFtpHistory`, `useAthleteExtendedProfile`. Tijdzone: Amsterdamse lokale dagen (localISODate, na WP-A05).

| # | Grafiek | Classificatie | Toelichting |
|---|---|---|---|
| D-01 | Belastingsverloop CTL/ATL | CORRECT_EN_HERLEIDBAAR, maar ONDUIDELIJKE_AS_OF_EENHEID | Y-as zonder eenheidslabel (geldt voor vrijwel alle Recharts-grafieken; eenheid alleen in tooltip/titel). |
| D-02 | Vormbalans TSB | CORRECT_EN_HERLEIDBAAR | Kleurcodering + legenda aanwezig. |
| D-03 | Volume, Gewicht/W-kg, FTP-progressie | CORRECT_EN_HERLEIDBAAR + ONDUIDELIJKE_AS_OF_EENHEID | Zelfde as-labelpunt. |
| D-04 | Performance-radar | CORRECT_EN_HERLEIDBAAR | Assen zonder data = null + reden (nooit 0.5-fake); sr-only samenvatting aanwezig. |
| D-05 | StreamChart sessiedetail | CORRECT_EN_HERLEIDBAAR | connectNulls=false; oude sessies honest-null (geen backfill). |
| D-06 | Sportpaspoort CTL/ATL | GEEN_DUBBELE_ENGINE | Zelfde useLoad-bron als Analyse; alleen presentatie verschilt. |
| D-07 | Materiaalcoach-advies | UNKNOWN_STUURT_TOCH_ADVIES | Bij confidence=unknown ("Niet te beoordelen") wordt toch een advies-samenvatting getoond. RENE_REVIEW_NODIG. |
| D-08 | Train-intelligence verdicts | CORRECT | Bij 'onbekend' volgt een needs-advies ("voeg doel toe"), geen prestatie-oordeel — eerlijk patroon. |

**Data-/grafiekbevindingen: 8** (1 UNKNOWN_STUURT_TOCH_ADVIES, 1 systematisch as-labelpunt over ~7 grafieken, geen dubbele engines, geen grafiek-tekstconflicten aangetroffen).
