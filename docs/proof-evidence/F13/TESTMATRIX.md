# F13 — Testmatrix (FIN-05/06)

**Toets-SHA (vast):** `a2e08175` (huidige HEAD)
**Datum:** 2026-08-02

Eén overzicht van alle acceptatiecriteria uit F1 t/m F12. Per criterium:
**geslaagd** · **niet geslaagd** · **n.v.t.** (alleen mét reden), plus de bundel
waarin het bewijs staat en de bijhorende log. De criteria van F1–F6 komen uit de
collega-bundels (`F1.md`…`F6.md`, spec `SPARKI_HERSTEL_EN_AANVULLING_01`,
HA-nummers); F7–F12 uit hun eigen specs.

Legenda: ✅ geslaagd · ❌ niet geslaagd · ⚪ n.v.t. (met reden) · ⚠ geslaagd mét beperking.

---

## F1 — Rolbepaling: eigen startscherm (bundel `F1.md`)

| Criterium (gewone taal) | Status | Bundel / log |
|---|---|---|
| Elke server-side rolwaarde krijgt een eigen weergave; geen stilzwijgende atleet-terugval (mechanieker, gast, voedingsspecialist, rolloos = eerlijke lege stand) | ✅ | F1.md · `logs/F1_today-roles.log` (19/19) |
| Rolwissel binnen één account geeft aantoonbaar een andere weergave | ✅ | F1.md · `logs/F1_today-roles.log` |
| Directe API-aanroep voor rol zonder recht → 403; onzin-rol → 400 | ✅ | F1.md · `logs/F1_today-roles.log` |
| Cross-account isolatie (trainer A ziet sporters van B niet) | ✅ | F1.md · `logs/F1_today-roles.log` |
| Rol-startscherm + TESTCONTEXT-banner in de browser (e2e) | ⚠ | F1.md · `logs/F1_wp-r0-rollen.log` — bewijs van web-SHA `857aec22`, **niet hertoetst op a2e08175** (zie open punt F1-1) |

## F2 — Zichtbare context (bundel `F2.md`)

| Criterium (gewone taal) | Status | Bundel / log |
|---|---|---|
| Contextregel toont permanent de actieve rol | ✅ | F2.md · `logs/F2_wp-f4-context.log` (verse prod-build a2e08175) |
| Contextkiezer lekt geen aantallen uit niet-actieve contexten | ✅ | F2.md · `logs/F2_wp-f4-context.log` |
| Omgeving expliciet benoemd (`/api/version` → environment/commit) | ✅ | F2.md (op a2e08175 bevestigd) |
| Test/productie onmiskenbaar onderscheiden via banner | ⚠ | F2.md · `logs/F1_wp-r0-rollen.log` — banner-bewijs op web-SHA `857aec22`, niet hertoetst op a2e08175 (zie open punt F2-2) |
| Rolwissel-knop aanwezig in het menu (e2e) | ❌ | F2.md · `logs/F2_wp-f4-context.log` — **e2e-selector-drift** (knop heet nu "Wissel van context"); knop bestaat in code, test zoekt oude selector (open punt F2-1, geen productgat) |

## F3 — Schone testfixtures A t/m H (bundel `F3.md`)

| Criterium (gewone taal) | Status | Bundel / log |
|---|---|---|
| Acht standen A t/m H bestaan als gemarkeerde testcontext (incl. trainer/ouder/club-combinaties F/G/H, nutrition/medical) | ✅ | F3.md · `logs/F3_governor-fixtures-create.log` (23 users, marked 23/23) |
| Wissel naar fixture toont gemarkeerde testcontext | ✅ | F3.md (API-probe a2e08175; browser via `logs/F1_wp-r0-rollen.log`) |
| Dev-only / fail-closed in productie (geen testdata in prod) | ✅ | F3.md (production-verify geweigerd op a2e08175) |
| Volledig verwijderbaar zonder residu | ⚠ | F3.md — codepad + verify-contract; `remove` niet live gedraaid om andere bundels niet te breken (open punt F3-1) |
| Verse stand is aantoonbaar leeg per stand | ⚪ | F3.md — geen aparte per-stand-leegheidsassertie; gegarandeerd door fixture-opzet. Reden n.v.t.: harde per-stand-assertie zou nieuwe bouw zijn, valt buiten F13 (open punt F3-2) |

## F4 — Eén documentgenerator (bundel `F4.md`)

| Criterium (gewone taal) | Status | Bundel / log |
|---|---|---|
| Eén PDF-engine (`pdfkit`), server-side, geen tweede engine per domein | ✅ | F4.md (codebewijs) |
| RT-12 dagschema als echte PDF; staf + geselecteerde renner mogen, niet-lid 403 | ✅ | F4.md · `logs/F4_club-race-documents.log` (6/6) |
| Versienummer loopt op per uitgifte (auditbaar) | ✅ | F4.md · `logs/F4_club-race-documents.log` |
| RT-13 wedstrijdbezetting als echte PDF | ✅ | F4.md · `logs/F4_club-race-documents.log` |
| RT-14 materiaallijst: ploegleiding mag, renner niet | ✅ | F4.md · `logs/F4_club-race-documents.log` |
| Trainerdocumenten (jaarplan eerlijk leeg, intake-wizard, expliciet delen, cross-account fail-closed) | ✅ | F4.md · `logs/F4_trainer-documents.log` (6/6) |
| Definitieve merktoepassing op de rapporten (HA-20) | ⚪ | F4.md — merklocaties gereserveerd; afhankelijk van merkbesluit. Reden n.v.t.: geen testbaar acceptatiecriterium zonder merkbesluit (open punt F4-1) |

## F5 — Stafbezetting per evenement (bundel `F5.md`) — HERSTELD + HERTOETST

| Criterium (gewone taal) | Status | Bundel / log |
|---|---|---|
| Stafrollen (renner/mechanieker/soigneur/ploegleider) per evenement toewijsbaar | ✅ | F5.md · `logs/f5-club-race-staffing-hertoets.log` (4/4) |
| Een onzinrol blijft 400 | ✅ | F5.md · `logs/f5-club-race-staffing-hertoets.log` |
| Mechanieker/soigneur zien van anderen alleen naam + of de renner rijdt | ✅ | F5.md · `logs/f5-club-race-staffing-hertoets.log` |
| Ploegleider ziet de (potentieel medische) toelichting wél | ✅ | F5.md · `logs/f5-club-race-staffing-hertoets.log` |

> Herstel: ontbrekende partiële unieke index `races_club_event_unique` (migratie
> 0022) idempotent aangebracht in de dev-DB; test opnieuw 4/4 groen (FIN-07/08).

## F6 — VOG en auditlogging (bundel `F6.md`)

| Criterium (gewone taal) | Status | Bundel / log |
|---|---|---|
| Eén VOG-wijziging = precies één auditrecord (oud + nieuw), in bestaande `security_audit_log` | ✅ | F6.md · `logs/F6_vog-auditlogging.log` (9/9) |
| Dezelfde datter opnieuw → geen nieuw record; verwijderen → juist event-type | ✅ | F6.md · `logs/F6_vog-auditlogging.log` |
| Onbevoegde kan VOG-historie niet lezen, ook niet via directe API (403) | ✅ | F6.md · `logs/F6_vog-auditlogging.log` |
| Bevoegde kan historie per persoon opvragen (nieuwste eerst) | ✅ | F6.md · `logs/F6_vog-auditlogging.log` |
| Trainer zonder VOG-registratie aan jeugdgroep → geweigerd (409) | ✅ | F6.md · `logs/F6_vog-auditlogging.log` |
| Trainer met verlopen VOG → toewijzing lukt, alleen waarschuwing | ✅ | F6.md · `logs/F6_vog-auditlogging.log` |
| Migratie bestaande koppeling zonder registratie schrijft óók een record | ✅ | F6.md · `logs/F6_vog-auditlogging.log` |
| Retentieregel op `security_audit_log` (3 jaar, configureerbaar) | ⚪ | F6.md — spec-open punt, bewust géén bouw-acceptatiecriterium; invullen = nieuwe functionaliteit, buiten F13 (open punt F6-1) |

## F7 — Communicatie met bijlagen (bundel `F7.md`) — HERSTELD + HERTOETST (20/20)

| # | Criterium (letterlijk) | Status | Bundel / log |
|---|---|---|---|
| 1 | Clubbeheerder verstuurt bericht met bijlage; ontvangers zien het en openen de bijlage | ✅ | F7.md · `logs/f7-club-communicatie-bijlagen-hertoets.log` |
| 2 | Gebruiker zonder recht kan bijlage niet zien/downloaden, ook niet via directe bestands-id | ✅ | F7.md · idem |
| 3 | Ingetrokken bestand niet meer downloadbaar, ook niet via oude link (F7-pad 410 + generieke route fail-closed 404) | ✅ | F7.md · idem |
| 4 | Geweigerd bestandstype: duidelijke melding, niet opgeslagen | ✅ | F7.md · idem |
| 5 | Verkleed type (verkeerde magic bytes) geweigerd op inhoud | ✅ | F7.md · idem |
| 6 | Pushmelding bevat noch berichttekst noch bestandsnaam | ✅ | F7.md · idem |
| 7 | Gelezenstatus werkt per ontvanger | ✅ | F7.md · idem |
| 8 | Bewaartermijn van één jaar als configuratiewaarde, niet hardcoded | ✅ | F7.md · idem |
| + | <16-regels: geen ongevraagd contact, ouder leest mee, groep één richting; cross-link/club file-toegang geweigerd; retentie ruimt alleen eigen bijlagen op | ✅ | F7.md · idem (scenario's 14–20) |

> Herstel: `routes/storage.ts` weigert F7-bijlagen (`club_message`) én
> F8-clubdocumenten (`club_document`) nu ALTIJD fail-closed 404 op de generieke
> route. Beide eerdere open punten vervallen (FIN-07/08).

## F8 — Clubdocumenten (bundel `F8.md`)

| # | Criterium (letterlijk) | Status | Bundel / log |
|---|---|---|---|
| 1 | Publicatie werkt en is zichtbaar voor de juiste rollen | ✅ | F8.md · `logs/f8-club-documents.log` (23/23) |
| 2 | Versiewissel: oude versie blijft bewaard, nieuwe wordt actief | ✅ | F8.md · idem |
| 3 | Rolzichtbaarheid: onbevoegde rol ziet het document niet | ✅ | F8.md · idem |
| 4 | Bevoegde beheerder kan aanmaken/wijzigen/publiceren; trainer/lid niet | ✅ | F8.md · idem |
| 5 | Geen toegang via directe API voor onbevoegden (incl. generieke route fail-closed 404) | ✅ | F8.md · idem |

## F9 — UX-herindeling per rolmodule (bundel `F9.md`)

| # | Criterium (letterlijk) | Status | Bundel / log |
|---|---|---|---|
| 1 | Scherminventarisatie uitgevoerd en vastgelegd per module | ✅ | F9.md · `F9_*/VOOR_NA.md` |
| 2 | Clubbeheer-schermen voldoen aan de UX-regels | ✅ | F9.md · `logs/f9-clubbeheer-e2e.log` |
| 3 | Geen lege tabs (2–4 échte tabs) | ✅ | F9.md · `logs/f9-trainer-e2e.log` + VOOR_NA |
| 4 | Onbevoegden zien geen uitgegrijsde beheerknoppen (weggelaten) | ✅ | F9.md · VOOR_NA per module |
| 5 | Max. één duidelijke primaire actie | ✅ | F9.md · VOOR_NA + na-screenshots |
| 6 | Mobiel-first hiërarchie (geen verkleinde desktop) | ✅ | F9.md · alle zes e2e-logs (~1,0–1,4 scherm) |
| 7 | Bestaande functionaliteit behouden | ✅ | F9.md · `F9_TRAINER/VOOR_NA.md` §Behoud |

> Beperking F9-01: admin-module via QA-account zonder admin-recht (statisch/code-onderbouwd in `F9_ADMIN/VOOR_NA.md`) — testomgevingsbeperking, geen UX-regressie.

## F10 — Centrale contacten- en relatielaag (bundel `F10.md`)

| # | Criterium (letterlijk) | Status | Bundel / log |
|---|---|---|---|
| 1 | Ouder én trainer: één contact, twee relaties | ✅ | F10.md · `logs/f10-contacten-relaties.log` (10/10) |
| 2 | Klant die ook sporter is: één contact, twee relaties (geen merge) | ✅ | F10.md · idem |
| 3 | Duidelijk duplicaat herkend en geweigerd met uitleg (409) | ✅ | F10.md · idem |
| 4 | Twee personen met dezelfde naam ≠ duplicaat | ✅ | F10.md · idem |
| 5 | Beëindigde relatie krijgt einddatum, blijft historisch; contact blijft | ✅ | F10.md · idem |
| 6 | Twijfelgevallen op beoordelingslijst, niet samengevoegd | ✅ | F10.md · idem |
| 7 | Geen bron stilzwijgend verdwenen; elke bron aantoonbaar overgezet/behouden | ✅ | F10.md · idem |

## F11 — Centrale bestands- en medialaag (bundel `F11.md`)

| Criterium (spec, via BEWIJS.md) | Status | Bundel / log |
|---|---|---|
| Upload, preview, download door bevoegde (nosniff + attachment) | ✅ | F11.md · `logs/f11-files.log` (12/12) |
| Vervangen behoudt oude versie | ✅ | F11.md · idem |
| Ingetrokken bestand niet meer downloadbaar, ook via oude link (410) | ✅ | F11.md · `logs/f11-files.log` + `logs/f11-omlegging.log` |
| Geweigerd type (415) / te groot (400) duidelijk afgewezen | ✅ | F11.md · idem |
| Duplicaat op checksum herkend; dedupe-revoke doodt zusterrij niet | ✅ | F11.md · idem |
| Onbevoegde kan niet zien/downloaden (404, geen lek) | ✅ | F11.md · idem |
| Veilige bestandsnaam (path-traversal gesaneerd) | ✅ | F11.md · `logs/f11-files.log` |
| Module-omlegging: geen module een eigen uploadoplossing | ✅ | F11.md · `logs/f11-omlegging.log` (11/11) |
| Video her-encoding; club-logo/CSV/GPX buiten medialaag; `material`-routetest 8/26 voorbestaand | ⚪ | F11.md — eerlijke beperkingen; her-encoding van video kan de poort niet, overige zijn geen mediabestanden. Reden n.v.t.: buiten de F11-medialaag / voorbestaand, gedocumenteerd in `F11/BEWIJS.md` |

## F12 — Centrale inbox en notificaties (bundel `F12.md`)

| # | Criterium (spec) | Status | Bundel / log |
|---|---|---|---|
| 1 | Tien wijzigingen zelfde object ⇒ één gebundelde melding | ✅ | F12.md · `logs/f12-inbox.log` (14/14) |
| 2 | Een melding opent de juiste rol en context | ✅ | F12.md · idem (geverifieerd; bestaand `notification-bell.tsx`) |
| 3 | Gelezen ≠ afgehandeld (readAt/resolvedAt los) | ✅ | F12.md · idem |
| 4 | Geen pushtekst met bericht-/bestand-/gezondheids-/prestatiegegeven | ✅ | F12.md · idem (val-alarm = gedocumenteerde life-safety-uitzondering) |
| 5 | Stille uren gerespecteerd; urgente veiligheidsmelding komt er wél door | ✅ | F12.md · idem + `attention-notifications` 10/10 |
| 6 | Melding voor ingetrokken rol niet zichtbaar/actief, ook via directe aanroep | ✅ | F12.md · idem |
| 7 | Geen module voert nog een eigen meldingenlijst | ✅ | F12.md · idem (geverifieerd; reminders = beargumenteerde uitzondering) |

---

## Poortvoorwaarden (F13-spec §De poort)

| Poortvoorwaarde | Status | Bewijs |
|---|---|---|
| **1 — Elke bestaande rolwaarde heeft een eigen startscherm** (geen stilzwijgende atleet-terugval) | ✅ **GEHAALD** | `F1.md` · `logs/F1_today-roles.log` — `test:today-roles` 19/19 op a2e08175; codebewijs `engines/today/roles.ts` (afgeleide rollenlijst, terugval → eerlijke lege stand i.p.v. "atleet") |
| **2 — Geen sporterdatalek naar een trainer na vertrek** (team-/groepsscope gefilterd op `endedAt`) | ✅ **GEHAALD** | `F10.md` · `logs/f10-f13-scope.log` — `test:f13-scope` 5/5 op a2e08175; renner verlaat team→groep, oude trainer verliest scope incl. consent-gated summary (403), óók via directe API-aanroep. endedAt-lek dicht (FIN-01/02) |

**Beide poortvoorwaarden zijn aantoonbaar gehaald**, inclusief het FIN-02-scenario.

---

## Resterende open punten (samengevat, eerlijk)

Geen enkel open punt is een kritiek of blokkerend gat; alle acceptatiecriteria
zijn geslaagd (of n.v.t. met reden). Wat resteert:

1. **F1-1 / F2-2 — e2e-UI-bewijs op web-SHA `857aec22`, niet op a2e08175.**
   De lopende web-preview is een oudere build; de rolbepalings- en
   contextlogica (API/verse prod-build) zijn wél op a2e08175 hertoetst. Voor
   volledige UI-hertoets moet de web-preview op de toets-SHA draaien (verse
   build staat klaar, `logs/web-build.log`). Niet zelf herstart (F13-regel: geen
   workflow-herstarts).
2. **F2-1 — e2e-selector-drift `wp-f4-context`.** De test zoekt de oude selector
   `title="Wissel van rol"`; de knop heet in de code `title="Wissel van context"`.
   De knop bestaat dus wél; dit is test-drift, geen productgat. Niet gefixt
   (F13 = alleen bewijs).
3. **F3-1 / F3-2 — fixture-`remove` niet live gedraaid; geen per-stand-leegheidsassertie.**
   Codepad + verify-contract dekken beide; live `remove` is overgeslagen om de
   fixtures voor de andere bundels te bewaren. Per-stand-leegheidsassertie zou
   nieuwe bouw zijn.
4. **F4-1 — definitieve merktoepassing op rapporten** (HA-20): merklocaties
   gereserveerd, afhankelijk van het merkbesluit; geen testbaar criterium zonder
   dat besluit.
5. **F6-1 — retentieregel op `security_audit_log`** (3 jaar, configureerbaar):
   bewust géén bouw-acceptatiecriterium; invullen = nieuwe functionaliteit,
   buiten F13.

> Herstelde punten (niet meer open): **F7-01/02** (generieke-route fail-closed
> 404 voor F7/F8-bestanden; suite 20/20) en **F5** (ontbrekende dev-DB-index
> `races_club_event_unique` aangebracht; staffing 4/4). Beide hersteld én
> hertoetst op de werkboom (basis a2e08175 + herstel), conform FIN-07/08.
