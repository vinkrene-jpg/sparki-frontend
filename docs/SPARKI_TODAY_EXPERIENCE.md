# SPARKI TODAY EXPERIENCE — productvisie (aangelegd bij WP-T1, 31-07-2026)

## Visie

Vandaag is het persoonlijke etalagevenster van Sparki: per gebruiker, rol, leeftijd, niveau en moment bepaalt de Today Orchestrator wat nú het belangrijkst is. Geen gelijk dashboard voor iedereen; geen levendigheid door willekeur, maar door echte gebeurtenissen (nieuwe rit, herstelstatus, naderende wedstrijd, openstaande actie).

## Paginaopbouw (opdracht §5)

Maximaal: 1 hoofdboodschap/hoofdactie · 1 onderbouwing (uitklapbaar, mét bron) · 1 persoonlijk inzicht · 1 wisselend blok · extra kaarten alleen bij noodzaak. Verboden: herhaalde conclusies, vulkaarten, onverklaarde cijfers, "je gaat vooruit" zonder trenddata.

## Profiel- en rolverschillen

**WP-T1 (geleverd):** atleetvarianten jeugd · wedstrijd · prestatie · recreatief · beginner.
- **Jeugd (<18):** eenvoudige taal, één duidelijke actie, geen trainingsjargon ("gerichte prikkel" e.d.), geen wedstrijdvoorbereidings-rotatie; training vóór weekbelasting in de kaartvolgorde.
- **Beginner (weinig data):** eerlijk beperkt — geen verzonnen inzichten; eenvoud eerst.
- **Wedstrijd/prestatie:** wedstrijd-aftelling in de hoofdboodschap, wedstrijdvoorbereiding in de wisselpool, compacte prestatie-context.
- **Recreatief:** standaardopbouw zonder wedstrijddruk.

**WP-T2 (geleverd 31-07-2026):** eigen Vandaag-prioriteiten per rol via `GET /api/today?rol=…` — trainer (aandachtssporters urgent > gemiste trainingen > open voorstellen > eerlijk all-clear), ouder/verzorger (herbevestiging urgent; uitsluitend toegestane categorieën), clubbeheerder (teams zonder trainer, uitnodigingen, ledenstand) en hoofdtrainer (alleen organisatorisch, nooit individuele sportersdata); ploegleider blijft coach-functie. Rechten server-side (403 zonder recht), zelfde weergavehistorie met rol-geprefixte sleutels. **WP-T3 (geleverd 31-07-2026):** debug-/onderbouwingsweergave (alleen expliciete admin of Hoofdtester, `?debug=1`: profiel, rol, gekozen kaarten + bron/confidence, afgevallen kandidaten, aiUsed, historie/reden van hertoning; gewone gebruikers krijgen nooit debugdetails) + volledige 17-scenario-testmatrix (`test:today-matrix` 21/21) met bewijs van ≥6 aantoonbaar verschillende profiel-/rolweergaven.

## Prioriteringsregels

urgent (gezondheid) > openstaande actie (geplande training) > nieuw/relevant (§7-handelingsperspectief, onderbouwing, echte trend) > wisselend (dag-stabiel, pauze na 3 getoonde dagen zonder interactie). Urgent en openstaand blijven staan; alleen ondersteunend wisselt.

## Meerdere inlogmomenten

Zelfde dag = zelfde selectie (dag-stabiele seed; historie telt de dag maar één keer). Nieuwe dag of nieuwe situatie (nieuwe sleutel) ⇒ verse afweging. Klik/afronding wordt server-side vastgelegd en beïnvloedt herhaling.

## AI-regels

Deterministische regels zijn leidend; AI (later, via centrale aiMessage-poort met cache en fallback) mag alleen formuleren/samenvatten — nooit feiten, vooruitgang of herstel verzinnen, nooit ontbrekende data invullen, nooit trainerbeslissingen overschrijven. WP-T1 draait volledig zonder AI en dat blijft het gegarandeerde fallbackpad.

Technische architectuur: `docs/SPARKI_TODAY_ORCHESTRATOR.md`. Inventaris en hergebruik: `docs/SPARKI_TODAY_CAPABILITY_INVENTORY.md`.
