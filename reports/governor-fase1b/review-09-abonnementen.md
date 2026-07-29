# Reviewset 09 — Abonnementen, toegang en commerciële flows

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).
**Vaste productregel (kader, geen vraag):** abonnement bepaalt diepte · doel bepaalt prioriteit · taalniveau bepaalt terminologie · Gratis/Go/Compleet delen één Analyse-architectuur en dezelfde centrale engines.

## Representatieve screenshots (max 8)
1. `vandaag/390x844/boven.jpg` — gratis basiservaring met upgrade-nudges
2. `paspoort/390x844/boven.jpg` — sportpaspoort (herkomstlaag)
3. `connect/390x844/boven.jpg` — koppelingen (datatoegang)
4. `admin/1440x900/boven.jpg` — beheer/entitlements-zicht
5. `privacy/390x844/boven.jpg` + 6. `voorwaarden/390x844/boven.jpg` — juridische basis (nu verborgen)
7. `support/390x844/boven.jpg` — helpdesk (gratis-plicht: opzeggen/veiligheid altijd bereikbaar)

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — entitlements-fundament: tiers FREE/GO/COMPLETE, AND-koppeling met flags, legacy_unrestricted als bewuste overgang, server-side handhaving op alle gecontroleerde endpoints.
2. **PROVEN_PRESENT** — Stripe-testomgeving met dubbele grendels (flag+allowlist), idempotente webhooks, echte HMAC-verificatie; bewust nog niet live (taak #379 wacht op akkoord).
3. **Afwijking van de vaste regel (feitelijk):** code deelt niet op **diepte** maar op **feature-aan/uit**: 4 GO-keys (autonomous_training, race_intel, ai_observations, performance_lab) zijn binair gate'd. Zelfde engines/Analyse-architectuur: klopt wél. Waar de diepte-lijn per tier ligt = besluit-03 (géén prijsbesluit nu).
4. **PROVEN_SUBSCRIPTION_GAP** — COMPLETE heeft geen eigen feature-/diepteverdeling (commercial_tiers uit): tier bestaat, inhoud niet.
5. **PROVEN_SUBSCRIPTION_GAP** — Club- en Team-abonnementen ontbreken volledig (vaste koers: productgat; zie reviewset 07).
6. **PROVEN_CONTENT_PROBLEM** — /privacy en /voorwaarden onvindbaar via UI; juridisch nodig vóór commerciële uitrol.
7. **PROVEN_CONTENT_PROBLEM** — provider-compliance vóór betaald gebruik: karttegels (CARTO/OSM/Esri) en Open-Meteo free tier zijn niet-commercieel; mobiel mist Mapbox-attributie.
8. **PROVEN_MISSING** — i18n-fundament ontbreekt terwijl EU-brede uitrol vaststaat (copy hard-coded NL, ook in LLM-prompts) — raakt "taalniveau bepaalt terminologie" op termijn.
9. **EVIDENCE_INSUFFICIENT** — geen per-tier-testaccounts: gedragsverschil FREE↔GO↔COMPLETE niet live geverifieerd (statische analyse wel).
10. **DEFERRED_BY_DECISION** — live Stripe-sleutels en trial: expliciet wachtend op René-akkoord.

## Automatische herstelkandidaten (max 5)
1. Privacy/voorwaarden-links in Meer/footer (gedeeld met reviewset 01).
2. Per-tier-testaccounts in dev — testfundament.
3. Mapbox-attributie mobiel toevoegen — kleine, veilige compliance-fix.
4. — (tegel-/weerlicenties zijn contractwerk, geen code-herstel.)

## Echte René-besluiten (max 3)
1. **Diepteverdeling per abonnement** (welke diepte bij Gratis/Go/Compleet; kader ligt vast, invulling niet) → `rene-decisions/besluit-03-diepteverdeling-abonnementen.md`.
2. **Livegang betalen/trial** — bestaande beslispoort (taak #379), geen nieuwe kaart.
