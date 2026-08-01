---
name: Club-wedstrijdlaag (BUILD_03)
description: Één-wedstrijd-sync naar persoonlijke races, vervanger zonder spoor, noodinfo-inzagelog, dagschema/vervoer/materiaal, wedstrijddag-inhoud + app-only dagmodus.
---

# Club-wedstrijdlaag (patch hoofdstuk D)

- **Eén wedstrijd voor iedereen**: selectie renner/reserve upsert een persoonlijke `races`-rij met `clubEventId` (partial unique index ⇒ `targetWhere: isNotNull(clubEventId)` verplicht). Begeleider krijgt géén rij. Afmelden verwijdert de rij; reserve schuift NOOIT automatisch door. `propagateEventUpdate` zet naam/datum/locatie/route/annulering door.
- **Vervanger (deputyClerkId)**: teammanager activeert; ploegleider alleen als club geen actieve teammanager heeft. Rechten via `canManageRaceEvent(ctx, event)` — gebruik die in ALLE event-scoped routes (check ná event-load!). Beëindigen wist het veld: bewust géén spoor/audit met naam.
- **Noodinformatie**: alleen ploegleider/teammanager/medical_staff (+beheer); elke inzage → rij in `club_noodinfo_views`; sporter/ouder leest het log. `availabilityNote` in de wedstrijdlijst genuld voor rollen zonder noodinfo-recht (status blijft zichtbaar) — medische lek-preventie.
- **Dagschema**: per persoon, vertrektijd+verzamelpunt verplicht; verschuiven eist `confirm: true` van ploegleider → hele ploeg bericht. Renner ziet alleen eigen regel; staf alles.
- **Wedstrijddag-inhoud**: briefings per audience; opdrachten upsert ZONDER origineel-bewaring, wijziging op wedstrijddag (Ams-datum!) ⇒ direct bericht; uitslag ook door renner zelf → `races.result` is een RaceResult-JSONB (niet string!); evaluatie sluit +7 dagen; taak-weigeren = declinedAt+reden, blijft open. Gast: token-link zonder auth (`/api/race-guest/:token`), verplicht `responsible: true` vinkje, vervalt ná raceDate (410), intrekbaar, audit toont e-mail.
- **Wedstrijddagmodus app-only**: server `/day-mode` aggregate (403 buiten ploegleider/teammanager); mobiel scherm `app/(app)/wedstrijddag.tsx`, ingang via Instellingen. Mobiel: clubs listen via `GET /api/clubs` (memberships+club-shape); `/api/clubs/mine` bestaat niet. `useColors().muted` is bg-token — tekst = `mutedForeground`.
- `writeClubAudit` neemt ÉÉN object-argument.

**Why:** patch D is bindend besloten (o.a. geen spoor van vervanger, origineel opdracht niet bewaren) — niet "verbeteren".
**How to apply:** elke nieuwe event-scoped route: rechten via canManageRaceEvent ná event-load; sync-writes altijd door club-race-sync helpers.
