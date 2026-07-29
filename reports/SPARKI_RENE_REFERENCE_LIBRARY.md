# SPARKI — René Reference Library (patronen, geen pixels)

Status: **RENE_APPROVED_PATTERN** · Goedgekeurd door: **René** · Datum: **2026-07-29**
Bron: Governor Fase 1 audit-commit `7e2f1983` + Fase 1B reviewsets-commit `4e37204c`.

> Belangrijk: dit zijn **richtingpatronen**. Geen enkel huidig scherm is hiermee
> goedgekeurd als visuele referentie — de hele app blijft
> `CURRENT_AUDIT_SOURCE / CURRENT_STATE_NOT_APPROVED`.
> Machineleesbare vorm: `governance/rene-approved-references.json`.

## 1. REF-NAV-01 — Apparaat-eigen navigatie met gegarandeerde kernset
- **Bindend:** mobiel en desktop mogen elk hun eigen navigatievorm hebben; er is één kernset bestemmingen die overal logisch bereikbaar is; **Wedstrijd hoort op desktop bereikbaar te zijn**; desktop krijgt een **Meer-equivalent** (zelfde inhoud, geen mobiele kopie).
- **Geen pixelreferentie:** de huidige onderbalk/zijbalk-styling.
- **Toegestane variatie:** volgorde, iconen, presentatie per apparaat. Configureerbare navigatie = latere fase.
- **Master Plan:** navigatieconsolidatie vóór rolwerkruimtes; veilige fixes 8 en 9 uit dit blok zijn de eerste stap.
- **Reviewset:** `reports/governor-fase1b/review-01.md`, besliskaart `besluit-01.md`.

## 2. REF-VIS-01 — LICHT_RUSTIG_STRAK_SPORTIEF als eindrichting
- **Bindend:** eindbeeld is wit/rustig/helder en strak, met sportieve sfeer via beelden, kaarten en profielen. **Geen restyling in dit pakket** — migratie later via een apart gefaseerd migratieplan met eigen beslispoorten.
- **Geen pixelreferentie:** geen enkel bestaand licht of donker scherm.
- **Toegestane variatie:** accent, beeldgebruik en dichtheid per hoofdstuk binnen de richting.
- **Master Plan:** apart visueel migratieplan (nog op te stellen).
- **Reviewset:** `reports/governor-fase1b/review-02.md`, besliskaart `besluit-02.md`.

## 3. REF-ABO-01 — Gedeelde functies met oplopende diepte
- **Bindend:** Gratis = basisinzicht · Go = praktische begeleiding/routes/herstel · Compleet = volledige coaching-, scenario- en wedstrijd-diepte. **Veiligheid, privacy, export en opzeggen altijd gratis.** Prijzen + Stripe = aparte beslispoort; **nu geen entitlements ombouwen**.
- **Geen pixelreferentie:** huidige Gratis/Go-implementatie en teksten.
- **Toegestane variatie:** exacte functietoewijzing per laag, per beslispoort te bekrachtigen.
- **Master Plan:** entitlement-uitbouw ná rolfase 1; Stripe via bestaande aparte taak.
- **Reviewset:** `reports/governor-fase1b/review-03.md`, besliskaart `besluit-03.md`.

## 4. REF-ROL-01 — Bouwvolgorde rollen
- **Bindend:** 1) trainer/hoofdtrainer → 2) clubbeheerder + ouder/jeugd → 3) ploegleider → 4) mechanieker → 5) admin consolideren. In dit pakket worden geen rolwerkruimtes gebouwd.
- **Geen pixelreferentie:** bestaande coach-/ouder-/adminschermen.
- **Toegestane variatie:** scope-details per rol per fase.
- **Master Plan:** elke rolfase krijgt een eigen beslispoort.
- **Reviewset:** `reports/governor-fase1b/review-04.md`, besliskaart `besluit-04.md`.
