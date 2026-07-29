# Sparki Governor Fase 1B — ChatGPT-reviewpakket V2

**Eindstatus:** `GOVERNOR_FASE1B_REVIEWSETS_READY`
**Audit-commit:** `7e2f1983` · fase-1-commit `2a709b5a` · live `68df60f9` · datum 2026-07-29
**Baselineregel:** de app blijft CURRENT_AUDIT_SOURCE; nergens APPROVED_BASELINE / PRODUCT_APPROVED / RENE_APPROVED_*; bij twijfel PENDING_RENE_REVIEW.

## 1. Correcties op fase 1 (verkeerd geformuleerde open besluiten)
De fase-1-cockpit en het fase-1-pakket stelden vragen die vaststaande koers zijn. Correcties (fase-1-bestanden blijven als historisch meetdocument staan; deze V2 en de cockpit V2 zijn leidend):
1. **Club/Team** was "productbesluit ja/nee" → gecorrigeerd: in scope, Club = acquisitie-/clublaag, Team = betaald professioneel product. Ontbrekende abonnementen/entitlements = **PROVEN_SUBSCRIPTION_GAP**. Alleen prijs + live Stripe blijven beslispoort.
2. **Rollen** ("welke van de 8 wil René echt") → gecorrigeerd: alle 8 rollen staan vast; ontbrekende werkruimtes = **PROVEN_ROLE_GAP** (bouwgat).
3. **"/analyse desktop moet donker"** → gecorrigeerd: feitelijke classificatie "visuele inconsistentie tussen schermen"; de eindrichting (donker/licht/instelbaar) is besliskaart 01 — huidige donkere shell is géén eindrichting.
4. **Desktop≠mobiel** als afwijking → geherclassificeerd: werkverdeling web/mobiel = LOGISCHE_APPARAATVARIANT; Wedstrijd desktop-afwezig = KERNFUNCTIE_ONTBREEKT; overige zijbalk/onderbalk-verschillen = REVIEW_NODIG (besliskaart 02).
5. **GO vs COMPLETE** → kader vastgezet (abonnement=diepte, doel=prioriteit, taalniveau=terminologie, één analyse-architectuur). Afwijking exact: code verdeelt op feature-aan/uit (4 GO-keys: autonomous_training, race_intel, ai_observations, performance_lab), COMPLETE leeg, geen dieptemodel. Geen prijs-/verdeelbesluit zonder René (besliskaart 03).
6. **Geen nieuwe goedkeuringen**: niets uit code/opdrachten/screenshots geldt als René-akkoord; overal PENDING_RENE_REVIEW toegepast.

## 2. De negen reviewsets
`reports/governor-fase1b/review-01…09.md` — elk met ≤8 screenshots, ≤10 bevindingen (gecategoriseerd), ≤5 automatische herstelkandidaten, ≤3 echte René-besluiten. Screenshotselecties per reis: `artifacts/product-governor/fase1b/7e2f1983/<reis>/manifest.md` (verwijzingen naar de bestaande 470 fase-1-screenshots; niets gekopieerd).

## 3. Bevindingen per categorie (totaal over alle reizen)
- PROVEN_PRESENT: 28 · PROVEN_MISSING: 7 · PROVEN_HIDDEN: 3 (photo-lab, privacy, voorwaarden)
- PROVEN_MISPLACED: 0 hard bewezen (kandidaten zitten onder REVIEW_NODIG navigatie)
- PROVEN_ROLE_GAP: 5 (hoofdtrainer, clubbeheerder, ploegleider, mechanieker, trainer-extra's)
- PROVEN_SUBSCRIPTION_GAP: 4 (Compleet leeg, Club, Team, aan/uit-i.p.v.-diepte)
- PROVEN_CONTENT_PROBLEM: 7 · PROVEN_DATA_PRESENTATION_PROBLEM: 3
- AUTOMATIC_REPAIR_CANDIDATE: 13 (uniek; lijst in cockpit V2 §5)
- CHATGPT_PRODUCT_REVIEW_REQUIRED: 6 · RENE_DECISION_REQUIRED: 4 (kaarten)
- EVIDENCE_INSUFFICIENT: 7 (vooral: geen rol-/tier-testaccounts, mobiel geen web-screenshots)
- DEFERRED_BY_DECISION: 4 (multisport, bordjes-niet-kern, Stripe-live, Club/Team-prijs)
- Functioneel defect: geen hard bewijs gevonden in deze nulmeting (crawl 100% 200; materiaalcoach-unknown is een eerlijkheidsprobleem, geen crash).

## 4. Vragen die ChatGPT zelf kan oplossen (vóór René)
1. Dieptevoorstel per functie voor Gratis/Go/Compleet (input besliskaart 03, optie C).
2. Feature-verdeling Club vs Team op basis van Master Plan v3.02.
3. Bevoegdhedenmodel hoofdtrainer vs trainer.
4. Herverdeling bestaande bouwstenen naar rol-werkruimtes (08).
5. Toets 11-hoofdstukkenstructuur tegen 8 rollen (01).
6. Ouder-nav vs Master Plan-ouderreis (06).

## 5. Echte René-beslispunten
`reports/governor-fase1b/rene-decisions/`: besluit-01 visuele eindrichting · besluit-02 navigatie-eindmodel · besluit-03 diepteverdeling abonnementen · besluit-04 bouwvolgorde rollen. Elk met huidige situatie, screenshots, Master Plan-regel, eerdere besluiten, advies, ≤3 keuzes + gevolgen + wat daarna automatisch kan.

## 6. Tegenstrijdigheden code ↔ Master Plan ↔ Build Pack
1. Coaching-diepte: code onder GO, Master Plan onder COMPLETE.
2. Dark-theme-regel Master Plan ↔ geparkeerde lichte-look-wens René/Dylan (28-07) ↔ licht /analyse-desktop in code.
3. Club/Team: opdrachten noemen ze, entitlements-model kent ze niet.
4. 8 rollen vereist, 3 (+admin) gebouwd.
5. i18n "nu vereist" (plan) ↔ hard-coded NL (code, incl. LLM-prompts).
6. Geluid/photo-lab/rit-verhaal/bordjes/world: wel gebouwd op eerdere René-opdrachten, geen expliciete v3.02-regel (SOURCE_EVIDENCE_MISSING — geen conflict, wel dekkingsgat in het plan).

## 7. Eerste reviewset (fase 7)
**Reviewset 01 — Algemene productstructuur en navigatie.**
- *Waarom eerst:* besliskaarten 01+02 (visueel + navigatie) bepalen de beoordelingslat en het herstel voor alle andere reizen; 02–04 delen de shell, 05–08 krijgen straks nav-ingangen, 09 raakt de zichtbaarheid van juridische/commerciële pagina's.
- *Afhankelijk:* alle overige reizen (shell/nav); besluit-04 kan pas zinnig na 01.
- *Nu niet nodig:* prijzen, Club/Team-verdeling, rolbouw-detail, Stripe-livegang.
- *Later automatisch herstelbaar:* de 13 herstelkandidaten (cockpit V2 §5) — uitvoerbaar zodra de betreffende richting vaststaat; 6 ervan zijn richtingsonafhankelijk (uitleg, eenheden, links, titel, materiaalcoach-gate, attributie).

## 8. Bewijs dat geen productcode is gewijzigd
Fase 1B voegde uitsluitend documentatie toe onder `reports/governor-fase1b/`, `reports/SPARKI_RENE_PRODUCTCOCKPIT_V2.md`, dit pakket en manifesten onder `artifacts/product-governor/fase1b/`. Geen wijziging in artifacts/sparki*, api-server, packages of database; controleerbaar via `git show --stat` van de fase-1B-commit (SHA in de oplevering). Niets gestart: geen herstel, geen fase 2, geen WP-A06A/WP-A07, geen release, geen nieuwe baseline.
