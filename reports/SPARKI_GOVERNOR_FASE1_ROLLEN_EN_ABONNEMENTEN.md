# Sparki Governor Fase 1 — Rollen en abonnementen

**Audit-commit:** `7e2f1983` · Status: CURRENT_AUDIT_SOURCE
Machineleesbaar: `governance/role-subscription-matrix.json`

## Methode en eerlijke beperking

Alles hieronder komt uit statische code-analyse (chapters.ts, bottom-nav.tsx, entitlements.ts, server-gates). **Live per-rol/per-abonnement browsertests waren niet mogelijk:** de workspace-Clerk is een dev-instance (sk_test) en er bestaan geen vaste testaccounts per rol/abonnement. Dat is precies wat Governor fase 3 moet opzetten.

## Rollenmatrix (8 vereiste rollen)

| Rol (opdracht) | In code | Eigen interface | Oordeel |
|---|---|---|---|
| Sporter | `athlete` | Volledige app, 5-item onderbalk, 11 hoofdstukken | COMPLEET |
| Ouder/verzorger | `parent` | ParentHome + 4-item onderbalk; één rechtenlaag, minor fail-closed | AANWEZIG |
| Trainer | `coach` (geen onderscheid) | CoachHome, cockpit per sporter, bulk-planner, invitations | AANWEZIG — trainer≠hoofdtrainer bestaat niet |
| Hoofdtrainer/coach | ontbreekt | — | NIET_GEBOUWD (rolafwijking) |
| Clubbeheerder | geen platformrol; clubrechten least-privilege | /club/beheer | GEDEELTELIJK (rolafwijking) |
| Ploegleider/teammanager | ontbreekt | Volgauto-chauffeursmodus (mobiel), wedstrijd-room | GEDEELTELIJK (rolafwijking) |
| Mechanieker | geen rol | /mechanieker is sporter-hoofdstuk | NIET_ALS_ROL (rolafwijking) |
| Admin/testbeheerder | boolean (SPARKI_ADMIN_IDS) | /admin, /admin/ops, health, tester-QR | AANWEZIG |

**Rolafwijkingen: 4.** Rolwissel bestaat (switchRole; menu's afgeleid van rol-state); een expliciete regressietest "menu ververst na rolwissel" ontbreekt (STATUS_ONBEKEND).

## Abonnementsmatrix (Gratis/Go/Compleet/Club/Team)

| Abonnement | In code | Oordeel |
|---|---|---|
| Gratis (FREE) | Basisapp; Go-onderdelen tonen upgrade-nudge; server 403 fail-closed | AANWEZIG |
| Go (GO) | 4 feature-keys: autonomous_training, race_intel, ai_observations, performance_lab | AANWEZIG — **maar conflicteert met Master Plan** (daar is GO navigatie-plus en zit coaching in COMPLETE) |
| Compleet (COMPLETE) | Tier bestaat (commercialTier), maar geen eigen feature-verdeling; commercial_tiers-flag uit | GEDEELTELIJK |
| Club | bestaat niet als abonnement | NIET_GEBOUWD |
| Team | bestaat niet als abonnement | NIET_GEBOUWD |

**Abonnementsafwijkingen: 3** (GO/COMPLETE-verdeling conflicteert met Master Plan; Club en Team ontbreken). Verder: `legacy_unrestricted` geeft bestaande gebruikers bewust alles (gedocumenteerd besluit).

## Expliciete controles

- Eén Analyse-architectuur: ✔ (lib/analyse-dashboard.ts SSOT; geen drie engines).
- Basisbegrijpelijkheid niet achter betaalmuur: ✔ (uitleglaag ongegate).
- Geen lege pagina's door verkeerde entitlement: ✔ in statische controle (UI fail-open met nudge).
- Upgradebanner op inbegrepen functie: niet aangetroffen statisch; live-test vereist (fase 3).
- Geen prijs-ID's/abonnementsnamen hardcoded in client: ✔ steekproef (upgrade-nudge bevat productnamen "Sparki Go" — copy, geen prijs-ID's; prijsvermelding komt via billing-API).
