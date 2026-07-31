---
name: Sparki Team-abonnement (tier TEAM)
description: Centrale facturatie club↔Stripe — lessen over tier-verbreding, terminale sync en exclusiviteit
---

- Tier TEAM (€149/mnd, €1.490/jr) is een persoonlijke Stripe-subscription van de clubeigenaar met `club_id`-metadata; de webhook-processor synct `club_subscriptions` (pakket `team`).
- **Waarom fail-closed eigendomscheck:** metadata is geen autorisatie — de sync eist `club.ownerClerkId === clerkId`, anders kaapt iedereen met een sub een club.
- **Tier-verbreding is gevaarlijk:** `isPaidTier` verbreden naar TEAM liet TEAM meteen door op ALLE persoonlijke paden (trial/checkout/change). Elke consumer moest expliciet TEAM weigeren, incl. `change` als BRON (TEAM wegwijzigen naar GO zou de club op een goedkopere tier actief laten).
- **Terminale overgangen moeten mee:** `customer.subscription.deleted`, volledige refund én `expireBillingStates` updaten alleen billing/profiel — de club bleef `team/active`. Elke terminale route moet `endTeamClubByBillingRef` (of equivalent) aanroepen.
- **Exclusiviteit per club:** webhook-sync weigert een andere sub zolang de gekoppelde `billingRef`-rij nog active/grace is; checkout geeft 409 bij levende koppeling. Event-id-dedupe beschermt NIET tegen concurrerende subscriptions.
- Geconfigureerde ledenlimiet nooit terugzetten: alleen eerste activering zet 50/10; daarna is `maxMembers` van de club leidend.
- TEAM heeft bewust géén `tier_feature_grants`-rijen: teamrechten zijn club-scoped via rollen, niet persoonlijke features.
- Rollen soigneur/medic zijn additief least-privilege (geen beheer, geen consent-data); web-`ClubRole`-union + `ROLE_LABELS` moeten elke nieuwe rol expliciet meekrijgen of de UI kan hem niet tonen/toewijzen.
- Testles: persoonlijke billing-routes zitten achter allowlist+flags — geef de testeigenaar `userFlagOverrides` of je test alleen de allowlist-poort (403) i.p.v. de tier-guard.
