# SPARKI — Statuscorrectie na WP-000

**Uitgevoerd:** 2026-07-29, na WP-000 (`docs/SPARKI_WP000_BRONBASIS_EN_TAAKONTDUBBELING.md`).
**Karakter:** alleen statusadministratie. Geen applicatiecode gewijzigd, geen databasecorrectie uitgevoerd, geen nieuwe functionele bouw gestart.

---

## 1. Bronbasis (bijgewerkt)

| Veld | Waarde |
|---|---|
| Branch | `main` |
| Actuele bron-SHA | `ddeb9408` (`ddeb94089f3a73109412f38ebd09cad02d7e0a32`) |
| Kandidaat-SHA `666b702` | **VEROUDERD** — 884 commits achter, afgewezen als bronbasis |
| WP-000 | **VERIFIED_FOR_R1** |
| Sindsdien gemerged (na WP-000-controle) | #390 (`94ff1d78`), #402 (`231c449d`) — main staat nu op `231c449d`; typecheck + api-serverbuild na deze merges groen |

Kanttekening: `SPARKI_AI_MASTER_PLAN_v3_02.yaml` ontbreekt **nog steeds** in de werkruimte (nieuwste aanwezige versie: v2_89). Zolang v3.02 niet is aangeleverd, blijft dit een ontbrekend bewijsstuk in de bronbasis.

## 2. Opdracht #382 / WP-A01

**Status: VERIFIED_FOR_R1 — afgerond en gemerged. Geen nieuwe uitvoering.**

Bewijsverwijzingen:
- Taak #382 staat op Gemerged in het Replit-takenregister.
- Codebewijs in main: centrale afleiding belastingscore bij ingest + zelfherstel bij opstart, `[achterhaald]`-filter op FTP-historie, idempotente per-dag-historie (o.a. `artifacts/api-server/src/lib/` load/TSS-keten en `derived-load-backfill.ts`).
- Testbewijs: sessie-/contract- en isolatietestsuites in `artifacts/api-server/src/tests/` dekken de keten; typecheck groen op `ddeb9408` en op `231c449d`.

## 3. Opdracht #383 / WP-A02

**Status: VERIFIED_FOR_R1 (bijgewerkt 29 jul na productiepublicatie — zie `docs/SPARKI_WPA02_PRODUCTIEVERIFICATIE.md`).** De hertelling ná publicatie levert exact **38 actief / 82 outdated**; de onderstaande BLOCKED-analyse is daarmee bevestigd en opgeheven. Oorspronkelijke bevinding (historisch):

- #390 (productie-uitvoering) is **volledig gemerged** (commit `94ff1d78`) — de code staat in main.
- **Productiehertelling uitgevoerd (read-only, 29 jul):** voor `user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp` staan er in productie **120 observaties met status `new`** — verwacht was **38 actief**.
- **Exacte verklaring van het verschil:** de merge zet de opschoningscode in main, maar de productieomgeving draait nog de build van vóór die merge. De opschoning draait in productie pas na een nieuwe publicatie (daarna automatisch via de dagelijkse sweep, of direct via het admin-endpoint `POST /api/admin/observation-cleanup`).
- **Vereiste volgorde vóór VERIFIED_FOR_R1:** (1) opnieuw publiceren, (2) opschoning laten draaien, (3) taak #399 (her-telling) uitvoeren met verwachte uitkomst 38 actief / 82 gemarkeerd, (4) herkomst-, dedupe- en isolatiebewijs vastleggen. Taak #399 is dus **nog niet** uitgevoerd — terecht, want #390 is pas net gemerged en nog niet gepubliceerd.

## 4. WP-B14 — Analyse-grafiekstyling

**Status: BUILT_NOT_VERIFIED (gebouwd op 29 jul, commit `7cab2e5c`; vandaag aangevuld met de lichte Trainingsverloop-variant in `ddeb9408`).**

Al gecontroleerd (deze sessie, dev):
- Cijfers/berekeningen/assen ongewijzigd: de restyling is presentatielaag; bronseries komen onveranderd uit `useLoad`/`useSessions` en `lib/analyse-dashboard.ts`; typecheck + bestaande tests groen.
- Desktop- en smal-viewport-screenshots van Analyse (Overzicht + Progressie) tonen correcte assen, legenda's en waarden (CTL 35, ATL 32, TSB +3, FTP-ontwikkeling 268 W).
- Donkere weergave: de donkere variant is codepad-onaangetast (standaardvariant blijft "donker"; alleen Analyse gebruikt expliciet "licht").
Nog open vóór VERIFIED_FOR_R1: contrastmeting (WCAG) en een expliciete scenario-vergelijking (leeg/dun/vol) — niet gestart, hoort bij een verificatiepakket.

## 5. WP-A06A — Team-billing en testmode

**Status: DEELS_AL_BESTAAND. Geen aanvullende bouw gestart.**

Bestaat al (gemerged):
- Stripe-testomgeving: flag+allowlist-grendels, idempotente webhook-verwerking in transactie, HMAC-signatuurverificatie, testbetaalflow (#385 e.o.).
- Gratis vs Go: entitlements-laag (`variant_feature_grants`, AND-semantiek met flags, `legacy_unrestricted`-carve-out), `requireCommercialFeature`-middleware (403 fail-closed), Nederlandse UpgradeNudge + Go-gates op de vier Go-schermen, 19/19 entitlement-tests groen.
- Abonnementenpaneel in /you en upgrade-verwijzingen (#396).

Ontbreekt nog:
- Team-/clubniveau-billing (facturatie per club/selectie i.p.v. per individu).
- Productie-activering: echte Stripe-testsleutels + live doorlopen betaalflow = bestaande taak #379 (beslispoort WP-A06B, wacht op René).
- Definitieve prijszetting (idem WP-A06B).

## 6. Productiearchitectuur (besluit vastgelegd)

- **Replit** = huidige ontwikkel-, test- en **tijdelijke** publicatieomgeving.
- **GitHub** (`vinkrene-jpg/sparki-frontend`, branch `main`) = bron van waarheid.
- **TransIP sparki-vps2** = beoogde zelfstandige productieomgeving.
- **Track INFRA blijft bestaan** en wordt niet geschrapt op basis van de huidige Replit-publicatie; de WP-000-kwalificatie "architectuurconflict" is hiermee vervangen door dit besluit.
- **INFRA-01 mag starten** (inventarisatie/baseline). Geen migratie of DNS-wijziging in deze statusopdracht; kanttekening uit WP-000 blijft staan dat de VPS vanuit deze werkruimte niet bereikbaar is — INFRA-01 vergt VPS-toegang of aanlevering van de baselinegegevens.

## 7. Track B — geldigheid bestaande VIS-audit tegen `ddeb9408`

| Onderdeel van de VIS-audit | Status |
|---|---|
| Bevindingen over datakwaliteit/bronnen (load-/sessieseries, herkomst) | GELDIG — onderliggende datalaag ongewijzigd |
| Bevindingen over grafiekstyling/leesbaarheid Analyse | GEDEELTELIJK_VEROUDERD — grafiek-designspec (WP-B14-werk, `7cab2e5c` + `ddeb9408`) heeft dit deel ingehaald |
| Bevindingen over /you-kerngrafieken en gedeelde dashboard-engine | OPNIEUW_CONTROLEREN — sindsdien is `lib/analyse-dashboard.ts` de gedeelde bron geworden |
| Aanbevelingen die uitgaan van de oude donkere Analyse-weergave | VERVALLEN |

Geen VIS-bouw gestart; WP-B02/B03 blijven wachten op akkoord op de (her)audit.

## 8. Eerstvolgende uitvoerreeks

**READY_TO_START:**
- ~~WP-A02-productiecontrole~~ — UITGEVOERD 29 jul (publicatie + #399-hertelling = 38; zie §3).
- INFRA-01 — mits VPS-toegang beschikbaar wordt gemaakt.
- MARKT-01 — geen afhankelijkheden.

**WACHT:**
- Track B (WP-B01-akkoord + geldigheidscontrole §7) — geen bouw.
- MARKT-03/websitebouw — pas na MARKT-01 en MARKT-02.
- WP-A06B (#379), WP-B07/B08/B16, WP-A29 — beslispoorten René.
- Master Plan v3.02 — moet nog aangeleverd worden.

## 9. Gewijzigde documenten in deze statusopdracht

- `docs/SPARKI_POST_WP000_STATUSCORRECTIE.md` (nieuw — dit register: statusregister, besluitenregister §6, bronbasis §1, uitvoerreeks §8).
- Geen wijziging aan applicatiecode, database, Build Pack-bronbestand of Master Plan-bestanden.
