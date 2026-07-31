# Begrippenmatrix — Abonnement ≠ Plannerweergave (WP-2, bindend)

**Datum:** 31-07-2026 · **Status:** bindend (besluit René 30-07-2026)

Twee volledig gescheiden begrippen die nooit door elkaar gebruikt mogen worden:

| | **Abonnement** (wat je betaalt) | **Plannerweergave** (wat je ziet) |
|---|---|---|
| Namen | **Gratis · Go · Compleet** (product "Sparki Complete") | **Gratis · Go gewone fietser · Go wielrenner/MTB/gravel · Wedstrijd** |
| Verboden naamgebruik | "Wedstrijd" is **nooit** een abonnement | "Compleet" is **nooit** een weergave |
| Bepaald door | betaling/entitlement (entitlement-fundament, AND met flags) | automatisch voorstel uit profiel; altijd handmatig aanpasbaar; keuze bewaard in `athlete_profiles.planner_view` (NULL = automatisch) |
| Relatie | geen — volledig onafhankelijk | geen — een Compleet-abonnee mag de eenvoudigste weergave kiezen en andersom |
| Wat het regelt | toegang tot betaalde functies (Go-onderdelen, Compleet-onderdelen) | welke keuzes/velden de routeplanner toont; verborgen opties sturen de routemotor nooit stiekem mee |
| Veiligheid | n.v.t. — veiligheid is nooit premium | n.v.t. — blokkadepoort, eindverificatie en wegdekwaarschuwingen op élk niveau |
| Bron in code | entitlements-laag (`lib/entitlements`, tier-trials Go/COMPLETE) | `artifacts/sparki/src/lib/planner-view.ts` + `planner-view-switcher.tsx` |

## Grep-bewijs (31-07-2026, commit-gebonden)

- `"Wedstrijd" als abonnement`: geen treffers in `artifacts/` of `docs/` (patronen: wedstrijd-abonnement, abonnement wedstrijd, wedstrijdabonnement).
- `"Compleet" als weergave`: geen treffers meer in code; in docs alleen historisch in `ROUTEPLANNER-UX-AUDIT-2026-07-30.md` (voorstel-fase), daar op 31-07 voorzien van expliciete correctie.
- Code-ankers: `planner-view.ts` regel-commentaar «"Wedstrijd" — uitdrukkelijk NIET "Compleet" (dat is de abonnementsnaam)»; switcher-copy «De weergave … staat los van je abonnement».

## Regel voor toekomstige copy

Elke nieuwe tekst die een van beide begrippen noemt, gebruikt uitsluitend de namen uit deze matrix. Bij twijfel: weergave = "hoe de planner eruitziet", abonnement = "wat er betaald is".
