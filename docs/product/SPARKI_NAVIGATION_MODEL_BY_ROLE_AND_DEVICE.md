# Sparki — Navigatiemodel per rol en apparaat

**Datum:** 31-07-2026 · **Status:** VOORSTEL, ter goedkeuring aan René (niets gebouwd).
Taakcategorieën per item: **P** primaire taak · **D** dagelijkse taak · **B** beheer · **A** profiel/account · **T** test/ontwikkel.

## Harde regels (uit de opdracht, bindend)
1. Testdashboard, tester-QR en ontwikkelhulpmiddelen (T) nooit in normale gebruikersnavigatie — alleen in de admin-omgeving.
2. "Samen trainen" niet als eerste onderdeel van Profiel (hoort bovenaan de Samen-pagina — besluit 30-07).
3. Profiel bevat persoonlijke en accountgerichte gegevens.
4. Lichaamsgegevens direct vindbaar; gewicht krijgt een expliciete actie **"Nieuw weegmoment"**.
5. Uitnodigingen staan in de omgeving van de rol die mag uitnodigen.
6. Interne termen ("rol-uitnodiging", relatie-enums) nooit als primaire gebruikerstaal.

## Sporter — telefoon (primair)
Onderbalk (5): **Vandaag (P) · Trainen (P) · Rijden (P) · Activiteiten (D) · Meer**.
Wijziging t.o.v. nu: Activiteiten vervangt Analyse in de onderbalk (dagelijkse taak vóór verdieping); Analyse blijft één tik diep in Meer/Vandaag-doorklik.
Meer-menu behoudt de zes hoofdstukgroepen, maar groep "Beheer" bevat uitsluitend gebruikersbeheer (privacy, voorwaarden) — admin-items verdwijnen naar de admin-omgeving.
Profiel (Jij): 1) Wie jij bent + jouw getallen (A), 2) **Lichaam** met "Nieuw weegmoment" (D), 3) Sportpaspoort (A), 4) Instellingen/account (A). "Samen trainen" verhuist naar Samen.

## Sporter — desktop (companion)
Zijbalk: Vandaag · Trainen · Rijden · Wedstrijd · Activiteiten · Analyse · Ontdekken · Meer (huidig, blijft). Zelfde volgorde-principes; routeplanning en analyse mogen hier breder zijn.

## Jeugdrenner
Zelfde structuur als sporter; inhoudelijke verschillen (copy, gating) komen uit bestaande jeugdregels, niet uit een ander menu.

## Ouder — telefoon (primair)
Onderbalk (3–4): **Kind(eren) (P) · Meldingen (D) · Profiel (A)** (+ Hulp in Meer/Profiel).
Uitnodigen ("Nodig de andere ouder uit", "Koppel je kind") staat in de ouderomgeving (regel 5).

## Trainer — desktop (primair)
Vaste zijbalk: **Sporters (P) · Planning (P) · Voorstellen (D) · Uitnodigingen (B) · Profiel (A)**.
Sporterslijst als tabel met filters/aandachtsmarkering; cockpit/plan als rechterpaneel of detail. Bulk waar zinnig (bv. week goedkeuren).
## Trainer — telefoon (compact)
Alleen: aandachtslijst + rolvandaag (D), voorstel accepteren/afwijzen (D), sporter uitnodigen (B, deelmenu). Geen tabellen/bulk.

## Hoofdtrainer — desktop (primair)
Zijbalk: **Teams (P) · Trainers (P) · Toewijzingen (B) · Profiel (A)**. Nooit individuele sportersdata. Telefoon: alleen organisatorische signalen (team zonder trainer).

## Clubbeheerder — desktop (primair)
Zijbalk: **Overzicht (P) · Leden (B) · Teams (B) · Uitnodigingen (B) · Instellingen (B) · Profiel (A)**. Telefoon: kernacties (accepteren, intrekken, code delen).

## Mechanieker — telefoon (primair, WP-S9)
Minimaal: **Werkplaats (P: materiaalmeldingen) · Fietsen (D) · Profiel (A)**.

## Admin/tester — gescheiden
`/admin` is de enige ingang voor T-functies (health, ops, tester-QR, gegevensbeheer). Tester-extra's in gebruikersschermen (zoals de Vandaag-onderbouwing) blijven server-gated (`debugAllowed`) en duidelijk gelabeld "tester".

## Samenhang telefoon ↔ desktop
Eén navigatieregister per rol (labels, volgorde, rechtenvereiste) als SSOT waar beide apparaatvarianten uit renderen — de presentatie verschilt (onderbalk vs. zijbalk), de inhoud en rechten nooit. Dit register is bouwwerk voor WP-S3 en wordt hier alleen voorgesteld.
