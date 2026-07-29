# Reviewset 04 — Routes, ontdekken, klimmen en navigatie

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).

## Representatieve screenshots (max 8)
Basis: `artifacts/product-governor/fase1/7e2f1983/screenshots/`
1. `routes/1440x900/boven.jpg` — kaart + acties boven de vouw (V-06)
2. `routes/390x844/boven.jpg` — mobiele routesomgeving
3. `routes/390x844/fullpage.jpg` — bibliotheek + tabs (5)
4. `klimmen/390x844/boven.jpg` — klim-verkenner
5. `feed/390x844/boven.jpg` — Ontdekken-kaartenfeed
6. `feed/390x844/fullpage.jpg` — feedlengte + Renners-reel
7. `kennis/390x844/boven.jpg` — kennis/intel-omgeving
8. `sprinten/390x844/boven.jpg` — bordjes-sprinten (aanpalend)

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — routegeneratie (p95 ≤3s), routebibliotheek met kwaliteitspoorten, eigen-routebouwer (punten tikken/slepen + verzamelpunten), GPX-export, route-paspoort/POI's/wegtypen, klim-verkenner.
2. **PROVEN_PRESENT** — Ontdekken-feed (pure engine + per-apparaat voorkeuren), Renners-reel met dwell-gated leren, in-app nieuwslezer met bronvermelding.
3. **PROVEN_PRESENT** — mobiele navigatie-HUD met audio-cues, off-route/rejoin, BLE-sensoren, val-alarm, volgauto — **LOGISCHE_APPARAATVARIANT** (uitvoering hoort mobiel).
4. **PROVEN_PRESENT** — eerlijkheidsregels: routewens alleen in uitleg (ORS kan wegen niet sturen, eerlijk "kan niet + alternatief"); geen gefabriceerde plaatsen.
5. **REVIEW_NODIG** — Ontdekken zit desktop direct in de zijbalk maar mobiel als tab met andere inhoudsmix; geen kernfunctieverlies vastgesteld, wel structuurvraag (hangt aan besluit-02).
6. **PROVEN_CONTENT_PROBLEM** — provider-compliance-risico's eerder vastgelegd (tegel-licenties, Open-Meteo non-commercial) — commercieel relevant vóór betaalde uitrol; hoort bij reviewset 09.
7. **PROVEN_PRESENT** — routesopruiming/archief en gereden-routes-op-kaart conform eerder René-besluit (2026-07-22) aanwezig.
8. **EVIDENCE_INSUFFICIENT** — mobiele schermen niet in de 470 web-screenshots (Expo apart); nulmeting mobiel beperkt tot codebewijs + bestaande tests.
9. **DEFERRED_BY_DECISION** — bordjes-sprinten aanwezig, eerder als niet-kern gemarkeerd.
10. **PROVEN_PRESENT** — 30-dagen-opruiming van niet-gereden voorstellen werkt volgens eerder besluit.

## Automatische herstelkandidaten (max 5)
1. — geen urgente; grafische/uitleg-punten van deze reis liften mee met reviewset 03-kandidaten.

## Echte René-besluiten (max 3)
1. — geen eigenstandige; navigatieplaatsing Ontdekken valt onder besluit-02.
