# SPARKI_BUILD_04 — F15 Eindbewijs

**Datum:** 02-08-2026 · **Basis:** main na commit "SPARKI_BUILD_04 F14 (UI)".
**Vorm:** bewijsbundel per fase + de veertien ketens van het minimale betaalde
product (de Mirror-kernen F0–F13), elk end-to-end aangetoond met een echte,
zelfstandig draaibare test tegen de echte database. Elke regel hieronder is
letterlijk zo uitgevoerd; exitcodes zijn de werkelijke procescodes.

## 1. Uitgevoerde testsuites (alle via shell, strikt sequentieel)

| Suite | Commando | Resultaat | Exit |
|---|---|---|---|
| Registratie zelfstandig trainer | `pnpm --filter @workspace/api-server run test:trainer-register` | 5/5 passed | 0 |
| Klantadministratie | `pnpm --filter @workspace/api-server run test:trainer-clients` | 5/5 passed | 0 |
| Groepen | `pnpm --filter @workspace/api-server run test:trainer-groups` | 5/5 passed | 0 |
| Werkobjecten/documenten | `pnpm --filter @workspace/api-server run test:trainer-documents` | 6/6 passed | 0 |
| Facturatiekern (F5–F11) | `pnpm --filter @workspace/api-server run test:trainer-billing` | 16/16 passed | 0 |
| Ouder/minderjarige (F12) | `pnpm --filter @workspace/api-server run test:trainer-parent-minor` | 4/4 passed | 0 |
| AI-concepten (F13) | `pnpm --filter @workspace/api-server run test:trainer-ai-drafts` | 4/4 passed | 0 |
| Werkplek/opvolging (F14) | `pnpm --filter @workspace/api-server run test:trainer-followup` | 5/5 passed | 0 |
| Rechten: schrijfcontract | `pnpm --filter @workspace/api-server run test:trainer-assignment-write-contract` | 5/5 scenario's | 0 |
| Rechten: berichten | `pnpm --filter @workspace/api-server run test:trainer-assignment-messages` | 9/9 scenario's | 0 |

Totaal: **64 scenario's, 0 gefaald.** Poorten daarnaast groen:
`pnpm --filter @workspace/api-server run typecheck` (0 fouten, exit 0) ·
`pnpm --filter @workspace/sparki exec tsc -b` (0 fouten, exit 0) ·
`pnpm --filter @workspace/sparki run test:navigation` (fail 0, exit 0) ·
`node scripts/check-brand-copy.mjs` (geen verboden merkvermeldingen, exit 0).

## 2. De veertien ketens (Mirror-kernen F0–F13), end-to-end

| # | Keten | Bewijs (suite · scenario) |
|---|---|---|
| 1 | F0 — de zelfstandige trainer bestaat als rol | trainer-register: rol via server-side registratie, geen club vereist |
| 2 | F1 — registratie zonder organisatie | trainer-register: registratie zonder club slaagt; rechten alleen op eigen data |
| 3 | F2 — klant en sporter zijn aparte records | trainer-clients: klant zonder sporter, sporterkoppeling apart via client_athlete_links |
| 4 | F3 — rechten vanaf acceptatie; ontkoppelen onmiddellijk | trainer-assignment-write-contract 5/5 + trainer-assignment-messages 9/9 (assignment-only 403, directe link werkt, beëindigd = direct dicht) |
| 5 | F4 — documenten op de werkobjectlaag | trainer-documents: geen eigen documentmodel; owner-checked serve |
| 6 | F5 — concept blijft concept zonder handeling | trainer-billing "concept onaangeroerd" + trainer-ai-drafts "concept blijft concept" |
| 7 | F6 — losse dienst met meerdere regels | trainer-billing: factuur met meerdere regels uit dienstencatalogus |
| 8 | F7 — oude factuur ongewijzigd na nieuwe upload | trainer-billing: bevroren klant-/bedrijfsgegevens bij verzending |
| 9 | F8 — nummering, KOR, geen verwijdering, creditnota | trainer-billing: nummer server-side bij verzending (BB-64/68), verwijderpoging 409, gedeeltelijke creditnota, KOR-regel |
| 10 | F9 — geen geldstroom over Sparki | structureel: er bestaat geen betaalpad in de code (BB-63); mark-paid is registratie door de trainer zelf (trainer-billing + trainer-followup) |
| 11 | F10 — export compleet incl. creditreferentie | trainer-billing: export per kwartaal met creditnotaregels |
| 12 | F11 — archief read-only | trainer-billing: verzonden factuur onaantastbaar; correctie alleen via creditnota |
| 13 | F12 — veiligheidsinformatie nooit geblokkeerd bij betaalprobleem | trainer-parent-minor: verlopen onbetaalde factuur blokkeert parent-reports/overview nooit (BB-71) |
| 14 | F13 — geen gegevens van een andere klant in een concept | trainer-ai-drafts: kruisbestuivingstest, context strikt per owner-checked klant |

F14 (twaalf blokken · één primaire actie · geen automatische aanmaning) is
apart bewezen in trainer-followup 5/5; automatische aanmaning/incasso bestaat
niet als codepad en betaalgedrag is uitsluitend feiten (geen score/kleurcode).

## 3. Migratieregels M-1…M-5

- M-1/M-2: geen enkel migratiepad maakt sporters klant of trainers zelfstandig; er bestaat geen zo'n migratie.
- M-3: enige schema-migraties (0033/0034) zijn idempotent (IF NOT EXISTS) en niet-destructief; telling voor/na n.v.t. (geen datamigratie).
- M-4: documentomzetting niet aan de orde (werkobjectlaag was nieuw; geen bestaande documenten omgezet).
- M-5: er is geen codepad dat facturen uit historische gegevens aanmaakt; facturen ontstaan uitsluitend uit expliciete trainer-acties.

## 4. Openstaande punten buiten scope van dit bewijs

- PDF-uitdraai van facturen wacht op de centrale documentgenerator uit
  SPARKI_HERSTEL_EN_AANVULLING_01 F4 (HA-16…HA-21) — bewust géén tweede
  PDF-engine in BUILD_04 gebouwd.
- UI-matrixpunten 360 dp / 200% tekst / schermlezer / trage verbinding zijn
  niet geautomatiseerd afgedekt; de werkplek volgt de bestaande ScreenShell-
  en tokenlaag. Praktijktoetsing loopt via Mirror, niet via dit bundel.
