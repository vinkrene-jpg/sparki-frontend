# MOBILE_UX_IMPLEMENTATION_RECOVERY_01 — F0 Werkelijkheidsaudit

**Start-SHA:** bc767cfd3a1efd476d2a3a6bc5642c2e9cfd1b21 · 01-08-2026 · geen productcode gewijzigd.
Classificatiematrix: `MOBILE_UX_REALITY_MATRIX.csv` (zelfde map).

## Kernconclusie
De "niet zichtbaar als samenhangende telefoonervaring" heeft één hoofdoorzaak en drie restgebieden — er is GEEN grote voorraad gebouwde-maar-niet-aangesloten mobiele componenten.

1. **Hoofdoorzaak: flag `commercial_shell`.** De hele mobiel-eerst Core-ervaring (CommercialShell + DsMobileNav + core-*-schermen) zit achter deze flag. Zonder flag valt de gebruiker terug op de oudere shell. Dit is de "eerder gebouwde maar niet aangesloten" laag — hij bestaat en werkt, maar is niet standaard actief. Bekende bijvangst (memory): één 403 op /api/flags tijdens Clerk-settling schakelt ALLES uit — dat oogt als "mobiele UX verdwenen".
2. **Routeplanner** is het grootste RESPONSIVE_MAAR_DESKTOP-scherm → wordt hersteld via MOBILE_ROUTE_WALKING_01 (F4 van deze opdracht verwijst daarnaar; geen dubbel werk).
3. **Analyse** (core-analyse.tsx) is het enige overige kern-scherm met echte desktop-restanten: brede 4-koloms tabel in `overflow-x-auto` + desktop-grafieken.
4. **Rolmodules**: atleet/coach/ouder/mechanieker/clubbeheer zijn MOBILE_NATIVE; Ploegleider/Soigneur/Medical Staff hebben geen eigen werkplek (GEDEELTELIJK/NIET_GEBOUWD) en Team geen eigen scherm. **Let op overlap:** eigen werkplekken per clubfunctie + documenten + facturatie zijn exact de scope van SPARKI_BUILD_01 pakketten 02/04 (werkobjecten, begeleiding/facturatie). Die hier bouwen zou dubbel werk zijn → in deze opdracht alleen mobiel-klaar maken wat bestaat; nieuwe rolwerkplekken volgen de bouwpakketten.

## Gebouwd maar niet (volledig) aangesloten
- **CMP-40 t/m CMP-44** (dieptekaart, toegankelijke mediaspeler e.a. uit SPARKI_MOBILE_COMPONENT_LIBRARY.md) — grotendeels placeholders (bv. today-layer.tsx r64); verborgen achter flags `media_uitleg_motion` en `media_uitleg_dieptekaart` (lib/feature-flags/src/index.ts r60/62). Hoort bij MEDIA_UITLEG_01 (F7 gepauzeerd) — niet hier heropenen zonder besluit.
- **Oude `bottom-nav.tsx`** leeft nog in dev-preview.tsx naast DsMobileNav — opruimkandidaat F1.
- Flags die mobiele ervaring verbergen: `commercial_shell` (hoofdschakel), `media_uitleg_*`.

## Bindende bronnen — bestaan bevestigd
`docs/product/`: SPARKI_MOBILE_UX_STANDARD_v1.4.md, SPARKI_MOBILE_COMPONENT_LIBRARY.md, SPARKI_MOBILE_PATTERNS.md, SPARKI_ROLE_BASED_MOBILE_FLOWS.md, SPARKI_MIRROR_MOBILE_TESTSTANDARD.md aanwezig; plus mobile-testprotocol.md. (Eerdere audit-subagent zocht alleen in artifacts/sparki en miste ze.)

## Schermen NIET_TOETSBAAR / NIET_GEBOUWD
- Facturatie (trainerfacturatie): NIET_GEBOUWD — bewuste afhankelijkheid van bouwpakket 04.
- Documentenbibliotheek (club/bestanden): NIET_GEBOUWD — bouwpakket 02 (centrale bestandslaag ontbreekt, zie F0 BUILD_01).
- Soigneur/Medical Staff/Ploegleider-werkplek: NIET_GEBOUWD — bouwpakket 02/03.

## Herstelplan (fasen binnen deze opdracht)
- F1 shell-controle: bottom-nav/safe-area/terugactie/rolcontext nalopen tegen MUX-standaard; BB-08-breuk (clubrollen vallen terug op atleet-shell — al vastgesteld in F0 BUILD_01) markeren als afhankelijkheid van BUILD_01, niet hier dubbel fixen.
- F2 hoofdschermen: alleen Analyse hercomposeren voor telefoon (tabel → kaartlijst, grafieken → mobiele varianten); overige kernschermen zijn al MOBILE_NATIVE (bewijs per scherm in matrix).
- F3 rolmodules: bestaande rolschermen toetsen aan SPARKI_ROLE_BASED_MOBILE_FLOWS; nieuwe werkplekken expliciet NIET hier (bouwpakketten).
- F4 routeplanner/navigatie: via MOBILE_ROUTE_WALKING_01.
- F5 documenten/professioneel: alleen mobiele weergave van wat bestaat (kennisbibliotheek is al mobiel); rest wacht op pakketten 02/04.
- F6 integrale toets: e2e-harness viewports uitbreiden (kleine/grote iPhone/Android), overflow-checks per hoofdscherm, 200% tekst, rolwissel.
