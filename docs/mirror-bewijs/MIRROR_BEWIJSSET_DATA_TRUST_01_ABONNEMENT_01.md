# MIRROR-BEWIJSSET — DATA_TRUST_01 + ABONNEMENT_01 (voorbereid 01-08-2026)

**Doel:** Mirror kan met dit document de hertoets van DATA_TRUST_01, ABONNEMENT_01
en de gekoppelde keten uitvoeren op een vaste, gepushte SHA. Vrijgave van
ABONNEE_ADMIN_01 volgt pas na een succesvolle Mirror-hertoets (statusbesluit
01-08-2026 in het besluitregister).

## 1. Vaste toets-SHA

- Te toetsen SHA: de eindcommit van deze documentatiesynchronisatie op `main`
  (zie eindrapport in de chat; documentcommits ná deze SHA wijzigen de technische
  status niet — besluitendocument 01-08-2026 §7).
- Repo: `vinkrene-jpg/sparki-frontend`, branch `main`.

## 2. Toetsdocumenten

- `docs/build-packages/DATA_TRUST_01/DATA_TRUST_01_MIRROR_TOETS.md`
- `docs/build-packages/ABONNEMENT_01/ABONNEMENT_01_MIRROR_TOETS.md`

## 3. Reeds beschikbaar bewijs (BUILD_DELIVERED, niet door Mirror getoetst)

- Sanityrapporten (Poort 5b, verdict deliverable):
  - `docs/PRODUCT_PROMISES/sanity-checks/SANITY_5B_2026-07-31_data-trust-classificatie.yaml`
  - `docs/PRODUCT_PROMISES/sanity-checks/SANITY_5B_2026-07-31_abonnement-01-levenscyclus.yaml`
  - `docs/PRODUCT_PROMISES/sanity-checks/SANITY_5B_2026-07-31_wp2-abonnement-vs-weergave.yaml`
  - `docs/PRODUCT_PROMISES/sanity-checks/SANITY_5B_2026-07-31_team-abonnement.yaml`
  - `docs/PRODUCT_PROMISES/sanity-checks/SANITY_5B_2026-08-01_team-abonnement-herstel.yaml`
- Bewijsarchief: `bewijsarchief/` (SHA-256-inventaris; o.a. `team-abonnement-herstel/`).

## 4. Door Mirror zelf te draaien controles (op de vaste SHA)

Alle api-server-tests via `node ./scripts/run-test.mjs <naam>` met
`NODE_ENV=development` + `DEV_AUTH_BYPASS=true`; testheader `x-dev-clerk-id`.

- Datavertrouwen/herkomst: `test:cross-account-isolation`, provenance-endpoints
  (constante tabel-allowlist), lege-toestanden per schoon account (toetsdoc A–C).
- Abonnement: Stripe **testmodus** verplicht (sleutels `sk_test_`/`rk_test_`);
  webhook-idempotentie (dubbele events), grace/incomplete/paused-paden,
  downgrade-gedrag routes (SPARKI-BESLUIT-2026-009: alles zichtbaar, alleen-lezen,
  gebruiker kiest drie actieve).
- Keten: `test:team-abonnement`, `test:team-organisatie`, `test:club`,
  `test:club-onboarding`, `admin-smoke`, `typecheck-api`-workflowcommando.

## 5. Eerlijke beperkingen / openstaande punten

1. **Legacy-migratie:** uitsluitend dry-run uitgevoerd; niets gemigreerd.
   Per-account-migratie is een besluit van René per account
   (SPARKI-BESLUIT-2026-012). `legacy_unrestricted`-accounts behouden toegang.
2. **Degraded-gedrag rechtenlaag:** gemaakte veiligheidskeuze (onleesbare bron
   telt niet mee; leesbare bronnen blijven gelden — docs/SPARKI_ABONNEMENTSFLOW.md §3)
   wacht nog op expliciete bevestiging van René (open keuze 19).
3. **Echte Stripe-testsleutels:** de live doorloop van de betaalflow met echte
   testsleutels staat als aparte taak open; tests draaien met fake gateway +
   echte HMAC-verificatie.
4. Mirror meldt niet-uitvoerbare toestanden als **niet getoetst** met reden;
   er worden geen benaderingen gebouwd.

## 6. Uitkomstregistratie

Mirror rapporteert per rubriek van de toetsdocumenten: goedgekeurd / bevinding /
niet getoetst (+reden), met de vaste SHA in de kop. Alleen René geeft daarna vrij.
