# Sparki Governor Fase 1 — Ontbrekende en verdwenen functies

**Audit-commit:** `7e2f1983` · Status: CURRENT_AUDIT_SOURCE

## 1. Verweesd / verborgen (bestaat, maar niet of nauwelijks bereikbaar)

| Onderdeel | Classificatie | Toelichting |
|---|---|---|
| /photo-lab | VERWEESD | Route + werkende pagina (Gemini-relight), nergens gelinkt. Mogelijk per ongeluk uit UX verdwenen → productbesluit. |
| /privacy, /voorwaarden | ALLEEN_VIA_DIRECTE_URL | Juridische pagina's zonder interne link/footer. René-review: footer- of Meer-link toevoegen is een productbesluit (fase 1 herstelt niets). |
| /profiel/:clerkId | ALLEEN_VIA_DIRECTE_URL | Alleen via dynamische links in feed/samen — patroon acceptabel, geregistreerd. |
| Wedstrijd op desktop | BELANGRIJKE_INFO_VERSTOPT | Desktop-zijbalk mist Wedstrijd; alleen via URL of mobiel patroon. |

## 2. In Master Plan maar niet gebouwd (top-selectie; volledig register in MASTERPLAN_VERSCHILLEN)

| Functie | Master Plan-status | Classificatie |
|---|---|---|
| i18n-fundament (key-catalog, 24 EU-talen) | ARCHITECTURE_FOUNDATION_REQUIRED_NOW | MASTER_PLAN_MISSING |
| Krachttraining (CYCLING_STRENGTH_TRAINING) | Specification ready | MASTER_PLAN_MISSING |
| Trainer-paspoort, Trainer-campus, Trainer-search/onboarding | Level B | MASTER_PLAN_MISSING |
| Rollen TRAINER≠COACH, hoofdtrainer, CLUB_ADMIN, TEAM_LEADER, MECHANIC als platformrol | roles.platform_roles | PARTIAL_IMPLEMENTATION |
| Gebruikersconfigureerbare navigatie + restore-to-V0 | interface_contract | MASTER_PLAN_MISSING |
| Club/Team-abonnement (Governor-opdracht noemt ze) | Niet in commercial_subscription_model als tier | CONFLICT_REQUIRES_REVIEW |
| Jeugd/minderjarige release-blocking scope | SCOPE_REINSTATEMENT | PARTIAL_IMPLEMENTATION (ouderomgeving/consents bestaan; volledige jeugdrelease-eisen niet geverifieerd) |
| Landensites/country-marketing | REQUIRED | MASTER_PLAN_MISSING |
| GO vs COMPLETE feature-verdeling (GO=navigatie, COMPLETE=coaching) | commercial_subscription_model | CONFLICT_REQUIRES_REVIEW — code plaatst coaching-features onder GO_FEATURE_KEYS |

## 3. Bewust uitgesteld / verwijderd (géén defect)

| Functie | Besluit |
|---|---|
| Game-laag (Tiles, duels, e.d.) | REMOVED_FROM_ACTIVE_ROADMAP; bestaand runtime-gedrag (bordjes-sprinten, klimmenverkenner, Sparki World) bewust behouden |
| Multisport | DEFERRED tot wielrennen compleet/commercieel sterk |
| Adult dating-scope | REMOVED_BY_USER_DECISION (nooit gebouwd) |
| Stripe live checkout | Flags uit; wacht op expliciet akkoord (taak #379) — DEFERRED_BY_DECISION |

## 4. Eerder verdwenen en hersteld (historisch bewijs)

- `/samen` verdween stil uit het Meer-menu (filter(Boolean)-regressie) en is in WP-A05 hersteld; menucontract-test bewaakt dit nu.
- Geen andere verdwenen menu-items aangetroffen bij vergelijking chapters.ts ↔ router ↔ historische rapporten.

## 5. Gebouwd maar niet in Master Plan terug te vinden

| Functie | Classificatie |
|---|---|
| Geluid/wekker (/geluid), Photo Lab, Rit-verhaal, Bordjes-sprinten, Sparki World | SOURCE_EVIDENCE_MISSING in v3.02-domeinregister als expliciete eis; bestaan wel als eerdere René-opdrachten. Niet gokken → registreren voor review. |
