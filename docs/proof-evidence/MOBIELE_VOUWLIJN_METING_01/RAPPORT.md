# MOBIELE_VOUWLIJN_METING_01 — meetrapport

**Datum:** 03-08-2026 · **Toets-SHA:** `569effe2` · **Alleen gemeten, niets gewijzigd aan het ontwerp.**

**Methode:** `e2e/tests/vouwlijn-meting.mjs` op de bestaande harness (`e2e/harness.mjs`).
Viewport per meting door de harness gezet (402×874 en 375×667), identiteit per
pakket via de TESTCONTEXT-kiezer op de bestaande governor-fixtures stand A
(Gratis), B (Go), C (Compleet); identiteit server-side geverifieerd via
`/api/auth/me`. Per pagina is met `getBoundingClientRect()` (code, niet het
oog) de **eerste zichtbare primaire actieknop** in de hoofdinhoud gemeten:
`y`, `y + height`, vensterhoogte en of de knop volledig binnen beeld valt.
Ruwe metingen: `meting.json`; schermafdrukken (24) in deze map.

**Let op omgeving:** de webworkflow serveerde een oude niet-accept-build;
één workflow-herstart (verse accept-build) was nodig om de TESTCONTEXT-kiezer
te krijgen. Geen codewijziging.

## Uitkomst: 24 van 24 metingen JA — de eerste actieknop valt overal volledig binnen beeld.

| Pagina | Pakket | Eerste actieknop | 402×874: y / y+h / binnen | 375×667: y / y+h / binnen |
|---|---|---|---|---|
| Dashboard | Gratis | "+" (kaartlanding) | 45 / 75 / **JA** | 45 / 75 / **JA** |
| Dashboard | Go | "+" (kaartlanding) | 45 / 75 / **JA** | 45 / 75 / **JA** |
| Dashboard | Compleet | "Training toevoegen" | 502 / 546 / **JA** | 523 / 567 / **JA** |
| Trainen | Gratis | "Training toevoegen" | 295 / 339 / **JA** | 295 / 339 / **JA** |
| Trainen | Go | "Training toevoegen" | 295 / 339 / **JA** | 295 / 339 / **JA** |
| Trainen | Compleet | "Training toevoegen" | 295 / 339 / **JA** | 295 / 339 / **JA** |
| Rijden | Gratis | "Maken" | 153 / 191 / **JA** | 153 / 191 / **JA** |
| Rijden | Go | "Maken" | 153 / 191 / **JA** | 153 / 191 / **JA** |
| Rijden | Compleet | "Maken" | 153 / 191 / **JA** | 153 / 191 / **JA** |
| Analyse | Gratis | "Bekijk je abonnement" | 333 / 370 / **JA** | 376 / 414 / **JA** |
| Analyse | Go | "Bekijk je abonnement" | 333 / 370 / **JA** | 376 / 414 / **JA** |
| Analyse | Compleet | "Bekijk je abonnement" | 333 / 370 / **JA** | 376 / 414 / **JA** |

Zoals verwacht verschilt de eerste actie per pakket (Gratis/Go landen op de
kaart met "+", Compleet op het sporterdashboard met "Training toevoegen") —
dat verschil is per rij apart gemeten en vertroebelt de uitkomst niet.
Er waren geen "nee"-gevallen, dus er is niets te melden over elementen boven
de vouwlijn.
