# WP-04 — Ouder/jeugd-verificatie & herbevestiging — EINDRAPPORT

**Status: WP_04_PARENT_YOUTH_VERIFIED**

## Aanpak
Verificatie van het bestaande model (geen tweede consent- of oudermodel, SAFETY_CATEGORIES-semantiek ongewijzigd, geen nieuwe API-routes — het herbevestigings-endpoint `POST /api/links/parent/:parentClerkId/reconfirm` bestond al). Alleen testen en dichttimmeren; twee gerichte fixes in `lib/parent-permissions.ts`.

## Controle per eis
1. **Toestemming per gegevenscategorie** — aanwezig: `permissions`-record per koppeling (8 categorieën), leesroutes gate'n per categorie. Getest (bestaand).
2. **Leeftijdsovergangen <16 / 16–17 / 18+** — `athleteAgeTier` rekent live uit geboortedatum (`computeAge`) op elk leesmoment, niets gecached. Getest met gecontroleerde geboortedatum-fixtures (u16/teen/adult).
3. **Herbevestiging bij overgang** — `ageTierAtConsent` vs. actuele tier ⇒ `reconfirmRequired`; niet-veiligheid valt dicht; melding met `resolutionKey herbevestiging:<id>` verdwijnt na reconfirm. Getest (bestaand, scenario 7–8).
4. **Veiligheidsminimum intact** — SAFETY_CATEGORIES = gezondheid + herstel, blijft open bij tierwissel (<18) en bij onbekende leeftijd; kill-switch `none` sluit alles. Getest.
5. **18+ sluit oudertoegang** — GAT GEVONDEN EN GEDICHT: een 18+-sporter met legacy-koppeling zónder adult-bevestiging hield het veiligheidsminimum open. Nu: adult zonder bij de adult-tier bevestigde keuze ⇒ alles dicht + `reconfirmRequired`; alleen expliciete herbevestiging door de sporter zelf heropent (eigen regie). Nieuw scenario 9b.
6. **Onbekende leeftijd fail-closed** — clamp naar veiligheidsminimum, `parentMayEdit=false`; in clubcontext telt onbekend als minderjarig. Getest (bestaand).
7. **Clubcontext <16 dicht zonder oudertoestemming** — `isMinorForClub` (onbekend = minderjarig) + consent-grant: self door minderjarige ⇒ 403, alleen gekoppelde ouder mag; trainer-leespaden consent-gated. Getest (bestaand: trainer-workspace-isolation sc. 6).
8. **Legacy zonder consentConfirmedAt = alléén veiligheidsminimum** — GAT GEVONDEN EN GEDICHT: de onbevestigde standaard bevatte ook `slaap`. Nu strikt SAFETY_CATEGORIES; de bredere standaard (incl. slaap/summary-extra's) geldt alleen ná bevestiging. Scenario 2 aangescherpt.
9. **Begrijpelijke uitleg + eigen regie** — ouderzijde (`parent-home`) toont tier/herbevestiging; sporterzijde (`links-section` + `/api/links/parents/manage`) toont per ouder de effectieve toegang met Nederlandstalige categorielabels en eigen beheer vanaf 16. Bestaand, geverifieerd.

## Wijzigingen (klein, gericht)
- `lib/parent-permissions.ts`: (a) onbevestigde koppeling ⇒ strikt veiligheidsminimum; (b) `reconfirmRequired` óók wanneer tier=adult zonder adult-bevestiging.
- `tests/parent-environment.ts`: scenario 2 aangescherpt (slaap dicht bij legacy), nieuw scenario 9b (18+ legacy alles dicht, herbevestiging heropent alleen het minimum).

## Tests (alles groen)
parent-environment 17/17 · coach-parent-link 13/13 · sharing-levels 13/13 · private-memory 3/3 · share-nothing 15/15 · shared-raw-fields 3/3 · links-end 3/3 · links-unlink 5/5 · cross-account 19/19 · club-organisation 18/18 · trainer-workspace-isolation 6/6 · trainer-rights 20/20 · hoofdtrainer 6/6 · governor-role-foundation 11/11 · admin-smoke 12/12 · api+web typecheck · api esbuild + web prod build.

## Commits
- `7512ce26` — beide guards + testaanscherping.
- (dit rapport volgt in een eigen commit)

## Resterende risico's
- De aangescherpte legacy-regel maakt bestaande onbevestigde koppelingen iets strikter (slaap valt dicht; 18+ volledig dicht tot herbevestiging). Dat is bedoeld gedrag; de sporter kan het zelf heropenen. Geen datamigratie nodig, niets destructiefs.

## Publicatie nodig?
**Ja, aan te raden** — de 18+-legacy-fix is een privacyverstrakking die pas werkt zodra hij in productie staat. Kan mee met de eerstvolgende reguliere publicatie; geen spoed (het gaat om het veiligheidsminimum, niet om brede data).
