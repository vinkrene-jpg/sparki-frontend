# SPARKI — WP-A04: Onafhankelijke data-trust-verificatie (afsluitende kwaliteitspoort WP-A01/A02/A03)

**Uitgevoerd:** 29 juli 2026. **Bronbasis:** `main` @ `603e1865` (bevat WP-A01 t/m WP-A03). Productie-database uitsluitend **alleen-lezen** benaderd (read-replica); geen enkele schrijfactie, geen code gewijzigd — de verificatie vond **geen defecten**.

**Onafhankelijkheid:** de hertellingen zijn niet via de bestaande engines gedaan, maar via een eigen, los opgebouwde SQL-herberekening (TSS/IF met dezelfde gepubliceerde regels) en een eigen script (CTL/ATL/TSB-EWMA), rechtstreeks op productie-brondata.

## 1. Fase 1 — Hercontrole WP-A01 (historische afgeleide belasting): BEVESTIGD

- **Volledige hertelling in plaats van alleen steekproef:** alle **349** productiesessies met vermogensdata (beide gebruikers) zijn onafhankelijk herberekend met de FTP-tijdlijnregels (nieuwste geldige FTP op of vóór de ritdatum; ouder dan eerste meting → eerste meting; `[achterhaald]`-gemarkeerde derived-rijen uitgesloten; zelfde-dag-tiebreak hoogste watt). **0 TSS-afwijkingen, 0 IF-afwijkingen.**
- Vereiste steekproeven zitten daarbinnen expliciet vastgelegd (CSV S01–S06): drie eerder foutieve sessies (2022, destijds op 331 W berekend — nu correct op 250 W), één oudere correcte NP-sessie, het "geen FTP-snapshot"-scenario (0 power-sessies zonder FTP-historie; 42 sessies zonder vermogen hebben allemaal eerlijk TSS = NULL) en één sessie van de andere gebruiker (eigen tijdlijn 272 W, niet die van René).
- **Geen tweede rekenpad:** `deriveTss`/`ftpAtDate` in `lib/derived-load.ts` is de enige implementatie (ingest + idempotente boot-backfill gebruiken dezelfde functies).
- **Idempotentie:** de boot-backfill is sinds de fix meermaals gedraaid (elke serverstart/publicatie); waarden zijn exact stabiel — 0 afwijkingen.
- **Actuele FTP ongewijzigd:** ftp_history nieuwste geldige rij 258 W (Strava 26-06) == profiel-FTP 258 W.

## 2. Fase 2 — Hercontrole WP-A02 (observatie-opschoning): BEVESTIGD

| Controle | Verwacht | Gemeten (prod, read-only) |
|---|---|---|
| Actieve observaties René | 38 | **38** |
| Outdated René | 82 | **82** |
| Actieve 331 W-verwijzingen (tekst/titel/samenvatting) | 0 | **0** |
| Actieve inhoudelijke duplicaatgroepen | 0 | **0** |
| Herkomst (engine/source_type) actieve observaties | 100% | **62/62** |
| Isolatie: andere gebruiker | eigen sweep | **24 new / 17 outdated**, apart |

- **Herstart veroorzaakt geen duplicaten:** sinds de opschoning zijn er meerdere serverstarts geweest; tellingen zijn exact stabiel.
- **Idempotentie:** de dagelijkse opschoningsjob heeft de outdated-rijen op 29-07 opnieuw aangeraakt zonder enige tellingverschuiving; `test:observation-cleanup`-suite groen.

## 3. Fase 3 — Hercontrole WP-A03 (mock/fallback-fixes): BEVESTIGD

- Lege gebruiker / ontbrekende FTP / ontbrekende hersteldata: eerlijke lege toestanden bevestigd in WP-A03 (inventaris F10/F11/F15/F17) en niet gewijzigd sindsdien.
- Mislukte API-call onboarding: nieuwe foutstaat + retry + expliciete doorgaan-keuze aanwezig (`onboarding-gap-fill.tsx`), incl. dubbelklik-grendel; `test:onboarding-resume` groen (geen regressie op de onboarding-flow).
- Verbindingsverlies volgauto: haper-indicator bij beide rollen aanwezig; typecheck mobiel + `test:ride-tracker` groen (vorige beurt, zelfde commit).
- Onbekende Bluetooth-sensor: `usedFallback`-melding "andere sensor dan je gekoppelde" door de hele keten aanwezig.
- Geen fallback als persoonlijke data en geen cross-user/cross-club-mockdata: WP-A03-inventaris (18 bevindingen) herbevestigd; 0 onveilige fallbacks.

## 4. Fase 4 — Account- en clubisolatie: BEVESTIGD

Alle suites deze beurt opnieuw gedraaid (shell, zelfde commit):

| Suite | Dekt | Resultaat |
|---|---|---|
| test:cross-account-isolation | A ziet geen FTP/observaties/activiteiten/herstel/routes/materiaal/plannen van B | groen |
| test:club | clubrechten least-privilege, club A ↛ club B, fail-closed bij ontbrekende rechten | groen |
| test:coach-parent-link-isolation / sharing-levels / private-memory / share-nothing / shared-raw-fields | ouder/trainer ziet alleen wat rechten toestaan; share-nothing fail-closed | groen |
| test:links-unlink-isolation / links-end-isolation | rolwissel/ontkoppelen lekt geen oude-gebruikersdata | groen |
| test:health-endpoints | herstelstatus (raises-only, resume-gate) | groen |
| test:day-type + test:onboarding-resume | regressie kernflows | groen |

Aanvullend prod-bewijs: 0 eigenaarloze rijen in de vijf kerntabellen (S14); observaties, sessies en FTP-tijdlijnen per gebruiker strikt gescheiden (S06, S11).

## 5. Fase 5 — Historische afgeleide data (steekproeven)

Volledige vastlegging in `docs/SPARKI_WPA04_HISTORISCHE_STEEKPROEF.csv` — **15 steekproeven/hertellingen, alle PASS**: FTP (S08), zones (S09, deterministisch %×FTP zonder aparte opslag), TSS/IF (S01–S07: 349/349 exact), CTL/ATL/TSB (S10: onafhankelijk nagerekend met het 42d/7d-EWMA-model op de prod-TSS-serie — identiek resultaat), herstelstatus/opschoning (S15), observaties (S11–S13), plan-/trainingshistorie-eigenaarschap (S14).

## 6. Fase 6 — Tests

| Poort | Resultaat |
|---|---|
| Typecheck web / mobiel / API | groen (zelfde commit, vorige beurt) |
| Serverbuild (esbuild) + productiebuild web (vite) | groen (zelfde commit, vorige beurt) |
| Accountisolatie + clubisolatie + coach/ouder + links (9 suites) | groen (deze beurt) |
| Idempotentie WP-A01 (boot-backfill, prod-hertelling) en WP-A02 (observation-cleanup-suite + prod-tellingen) | groen |
| Regressie WP-A03-fixes (onboarding-resume, ride-tracker, typechecks) | groen |
| Desktop/mobiel | web-build groen (desktop); mobiele wijzigingen via typecheck + suite (native build buiten deze omgeving) |

## 7. Conclusie

- **Steekproeven totaal:** 15 vastgelegd (waarvan één een volledige hertelling van 349 sessies omvat) — 0 afwijkingen.
- **Gevonden defecten:** geen. **Gerichte fixes:** geen nodig. **Gewijzigde bestanden:** alleen deze twee rapportbestanden.
- **Stopcondities:** geen enkele geraakt.
- **Commit-SHA:** volgt in de rapportage (alleen documenten toegevoegd bovenop `603e1865`).
- **Publicatie nodig: nee** voor WP-A04 zelf (geen codewijziging). NB uit WP-A03 staat nog open dat de webfix (onboarding-foutstaat) bij de eerstvolgende publicatie meegaat.

## EINDSTATUS: **VERIFIED_FOR_R1**

WP-A01, WP-A02 en WP-A03 zijn onafhankelijk bevestigd; er staat geen data-, privacy-, rechten- of isolatieprobleem open. WP-A05 is conform de opdracht **niet** gestart.
