# BUILD_01 F0 — Addendum: afhankelijkheden en zelfstandige fasen

Basis: BUILD_01_INVENTARISATIE.md (SHA e6a0404f) · 01-08-2026.

## 1. Afhankelijkheid DATA_TRUST_01 (herkomst-/provenance-laag)

Bestaat en draait: centrale herkomst-endpoint met constante tabel-allowlist, Data Origin-framework (herkomst/explain-laag, sync-ID alleen bij bewijsbare run-koppeling), bronnenregister met fail-closed promptregel.

Raakt BUILD_01 op:
- **BB-13d (bron van voorinvulling opvraagbaar):** verplicht consumeren van de bestaande herkomstlaag; geen eigen herkomst-administratie in nieuwe formulieren. Nieuwe tabellen (consent_grant, vog_record, contact, file, event) moeten aan de bestaande tabel-allowlist worden toegevoegd — dat is een uitbreiding van DATA_TRUST_01, geen blocker.
- **Wacht op DATA_TRUST_01:** niets hard. F1–F13 kunnen starten; alleen de BB-13d-bewijsvoering per nieuw documenttype gebruikt de bestaande laag.

## 2. Afhankelijkheid ABONNEMENT_01 (entitlements/billing)

Bestaat en draait: entitlement-fundament (rechten = entitlement AND flag, legacy_unrestricted carve-out), `billing_subscriptions`, Team-abonnement (tier TEAM incl. definitieve rolmapping ploegleider/medical_staff), Stripe-testmodus (flag+allowlist AND), Gratis-vs-Go paywall.

Raakt BUILD_01 op:
- **F3/F4 (rol-startpunten + context):** welke rolomgevingen commercieel toegankelijk zijn loopt via de bestaande entitlement-laag; nieuwe rol `nutrition_specialist` heeft een entitlement-besluit nodig (welke tier ontgrendelt de rol) — **besluit René, vóór F3-oplevering**.
- **F10 (contactenlaag):** klant/betaler-contacttypen raken billing_subscriptions én lopende taak **ABONNEE_ADMIN_01 (#537, wacht op input)** — lidnummer/administratief dossier mag niet worden gedupliceerd door het contactmodel. **F10 wacht op afronding of expliciete afbakening van ABONNEE_ADMIN_01.**
- Pakket 04 (facturatie) leunt volledig op deze basis; binnen BUILD_01 is er verder geen harde blokkade.

## 3. Welke fasen kunnen zelfstandig door (na F0 MIRROR_PROVEN)

- **Zelfstandig:** F1 (consentservice, fundament voor alles), daarna F2 (endedAt), F5 (herhalende trainingen), F6 (VOG), F8 (clubdocumenten), F11 (bestandslaag), F12 (inbox-uitbreiding). F7 minimaal, wordt in F11 omgezet.
- **Wacht op besluit René:** F3/F4 — coach-navigatielabels posities 2–4 (R3) en entitlement-plaatsing nutrition_specialist (§2).
- **Wacht op afbakening:** F10 — ABONNEE_ADMIN_01 (#537).
- **Volgordelijk bindend:** F1 vóór F2+ (rollback-koppeling §13 pakket); F13 als laatste.

## 4. Blokkades op dit moment

1. F0 MIRROR_PROVEN ontbreekt — F1 start niet eerder (pakketregel).
2. R3-productkeuze coach-nav (F4).
3. Entitlement-besluit nutrition_specialist (F3).
4. ABONNEE_ADMIN_01-afbakening (F10).
Geen technische blokkades: build/typecheck groen op basis-SHA, omgeving gezond.
