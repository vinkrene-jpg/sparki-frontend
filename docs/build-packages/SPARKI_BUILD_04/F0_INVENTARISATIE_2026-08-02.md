# SPARKI_BUILD_04 — F0 Inventarisatie (02-08-2026)

Geen code gewijzigd. Per vraag: bevinding + vindplaats.

## 1. Kan een trainer zich registreren zonder club of team?
**Deels.** De rol `coach` bestaat los van clubs (in `userProfilesTable.roles`), maar er is
géén publiek zelfregistratiepad: de rol komt alleen via een uitnodiging
(admin-invite `relationship: 'none'` + `targetRole: 'coach'`, `routes/invitations.ts`
±248–265 en 410–416; club-invite `club_trainer` geeft rol + clublidmaatschap).
Rolwissel via `PUT /api/auth/me/role` (`routes/auth.ts` ±158–227).
→ F1 bouwt het ontbrekende zelfstandige registratiepad.

## 2. Bestaat er een trainer-sporterrelatie buiten een organisatie?
**Ja.** `coach_athlete_links` (`lib/db/src/schema/links.ts` 6–30), zonder club/team-verwijzing;
aangemaakt via invitation `coach_athlete` (`routes/invitations.ts` ±132–138, 419–434);
overal gebruikt als toegangsbron (o.a. `lib/passport.ts`). → F2/F3 hergebruiken deze laag.

## 3. Bestaat er een entitlement dat aan de trainer hangt?
**Nee, niet individueel.** Tiers zijn FREE/GO/COMPLETE/TEAM (`lib/db/src/schema/billing.ts` L20).
TEAM hangt aan een club (webhook-processor L384: `club_subscriptions`, maxTrainers 10).
`nutrition_specialist` heeft een configureerbare tier-plaats (`lib/entitlements.ts` L106, leeg).
→ F1 voegt de tier TRAINER toe aan de bestáánde entitlementlaag (geen tweede engine),
prijzen uit besluitenpatch hoofdstuk E (€99/€990 tot 25 · €179/€1.790 tot 50 · €9,90 p/s vanaf 51).

## 4. Bestaat er een zakelijk profiel (bedrijfsnaam, KvK, btw, IBAN, briefpapier)?
**Nee.** Nergens in `lib/db/src/schema` of api-server; gezocht op kvk/btw/vat/iban/letterhead/
briefpapier/business. → F1 bouwt `trainer_business` (4.1).

## 5. Bestaat er enige facturatie?
**Nee.** Geen invoice/factuur/creditnota-tabellen of -routes. Stripe-billing (abonnementen
Sparki↔gebruiker, geldstroom A) staat in `routes/billing.ts` + `lib/billing/*` (testmodus,
fake gateway + echte HMAC, webhook idempotent-in-tx). Geldstroom B (klant→trainer) bestaat
niet en blijft conform BB-63 zonder geld over Sparki. → F5–F10.

## 6. Huidige Stripe-inrichting
Fase 2 testmodus, `sk_test_` only; `GET /status`, `POST /checkout` (TEAM uitgesloten,
loopt club-specifiek), `POST /portal`; webhook-processor met idempotentie in transactie.

## 7. Bestaande trainerdocumenten
Werkobjectlaag (`lib/db/src/schema/work-objects.ts`; `routes/work-objects.ts`) met
objectTypes `koersplan`/`trainingsweek`/`materiaalplan`/`ouderbriefing`, secties,
sjablonen (`work_object_templates`), historie, status concept→gedeeld→afgerond.
→ F4 voegt de rolcatalogi G–M als objectTypes/weergaven toe — géén eigen documentmodel.

## 8. Bestaande intake
Onboarding-flows (quick-start, narratief V2, progressief, ouder-intake, coaching-mode)
in `routes/onboarding.ts` + `engines/onboarding.ts`. Een trainer-klant-intake bestaat niet.
→ F4 bouwt de intake als werkobjecttype met wizard-weergave.

## 9. Bestaande rapportage
Race-day report, RaceDossier, race-evaluatie (`lib/race-intel.ts`, `race-dossier.ts`,
`race-evaluation.ts`). Er is géén generieke PDF-rapportgenerator/templatebibliotheek.
De factuur-PDF (technische afhankelijkheid uit de kop van BUILD_04) heeft dus nog geen
bestaande generator om op te leunen — dit wordt bij F7/F8 als één gedeelde
PDF-laag gebouwd die ook voor rapporten bruikbaar is (geen tweede generator daarna).

## Conclusie F0 (Mirror-kernvraag: bestaat de zelfstandige trainer als rol?)
De rol coach bestaat en de één-op-één trainer-sporterlaag bestaat; wat ontbreekt is:
zelfstandige registratie, zakelijk profiel, trainer-entitlement, klant/betaler-entiteiten
en de volledige facturatie. F1 start direct (rapportage is geen wachtmoment).
