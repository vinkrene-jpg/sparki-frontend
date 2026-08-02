# F12 — Centrale inbox en notificaties — Bewijsbundel

**Datum:** 2026-08-02
**Basis-SHA (vóór F12-wijzigingen):** `a46dcb1ad4a07c601d026370541670e8d1b4972f`
**Bindend document:** `attached_assets/F12_INBOX_EN_NOTIFICATIES_1785683562086.md`

Meting bevestigd: schema (12 categorieën, audience, readAt, resolvedAt/
resolutionKey, expiresAt, dedupeKey, priority) is compleet; inbox-UI
(`notification-bell.tsx`) bestaat met rolwissel, gelezen-stip, daily-fold; stille
uren + kritiek-passage in `engines/reminders/preferences.ts`. Alleen de vier
gaten (NOT-01, NOT-03, NOT-05, plus NOT-02/04-verificatie) zijn gebouwd.

---

## Gekozen drempel & venster (NOT-01) — met reden

| Parameter | Waarde | Env-override | Reden |
|---|---|---|---|
| Bundeldrempel | **3** meldingen | `NOTIF_BUNDLE_THRESHOLD` | Onder de drie afzonderlijke wijzigingen is elke melding nog op zichzelf informatief; een bundel is dan eerder verwarrend dan behulpzaam. Vanaf de derde wijziging aan hetzelfde object verliest de losse lijst zijn waarde en wint één samenvattende regel. |
| Bundelvenster | **24** uur | `NOTIF_BUNDLE_WINDOW_HOURS` | Wijzigingen aan één plan komen in golven; een etmaal vangt een normale bewerkingssessie én een dag-erna-correctie, zonder oude, afgesloten situaties er alsnog bij te trekken. |

Beide zijn configureerbaar via omgeving (env), zonder codewijziging bij te
stellen; gedocumenteerd in `lib/notifications.ts` (`BUNDLE_THRESHOLD`,
`BUNDLE_WINDOW_HOURS`, `envInt`).

**Bundelsleutel:** `category:source:object-referentie`, waarbij de
object-referentie uit `dedupeKey` (voorkeur) of het pad van `actionUrl` (zonder
query/hash, ≥ 2 padsegmenten) komt. Zonder betrouwbare object-referentie ⇒ geen
bundeling (losse rijen). Producenten kunnen ook expliciet `bundleKey` +
`bundleLabel` meegeven.

**Centraal in de aanmaak-helper:** de bundeling zit in `createNotification`
(`artifacts/api-server/src/lib/notifications.ts`), zodat ALLE producenten
(reminders, coach, club, parent, materiaal, sync, …) automatisch meedoen.

**Kritiek nooit bundelen:** `deriveBundleKey` geeft `null` voor de kritieke
categorieën `privacy`/`veiligheid`; die worden dus nooit gebundeld, ook niet met
een expliciete `bundleKey`.

**Geen dubbeling met de daily-fold:** de bel-fold (`groupNotificationsByDay`) is
puur presentatie per KALENDERDAG en verandert de rijen niet. Bundeling is per
OBJECT en gebeurt in de datalaag (één rij groeit; overtollige losse siblings
worden `resolvedAt` gezet). De bundel-rij is daarna één gewone rij die de fold
verder normaal verwerkt.

**Concurrency-veilig (reviewfix NOT-01).** De eerdere read-then-write kon onder
gelijktijdige producenten dubbel bundelen of een increment verliezen. Nu draait
de HELE bundelbeslissing — inclusief de eventuele losse insert onder de drempel
— in ÉÉN transactie (`bundleOrInsert`) achter een
`pg_advisory_xact_lock(hashtext('notif-bundle:'||clerkId||':'||bundleKey))`.
Zo is de verwerking per logisch object serieel over de hele cluster, en valt de
lock automatisch vrij bij commit/rollback (lock op één tx-verbinding — dezelfde
pattern als `routes/parent.ts` noodcontacten). De teller wordt ATOMAIR in SQL
opgehoogd (`bundle_count = bundle_count + 1`) en de body wordt in dezelfde
statement uit die nieuwe waarde opgebouwd, nooit uit een vooraf in JS berekend
getal. Omdat óók de losse insert onder de lock valt, kan een gelijktijdige
producent die insert altijd meetellen — het vouwmoment wordt nooit gemist.
- Test `concurrency: 10 parallelle producenten` (`Promise.all` van 10 ×
  `createNotification` op dezelfde bundleKey): exact **1** open rij,
  `bundleCount=10`, body `"10 wijzigingen in …"`, geen tweede (losse) rij.
- Test `concurrency rond de drempel`: `drempel+4` events parallel ⇒ 1 rij met
  count exact gelijk aan het aantal events — geen verloren increment.

**Vouwbeleid (bewuste keuze).** Bij het vouwen tellen alléén **actieve, nog
ONGELEZEN** losse rijen mee (`resolvedAt IS NULL` én `readAt IS NULL`; binnen het
venster). Motivatie: een al-gelezen losse melding heeft de gebruiker al gezien en
afgedaan; die met terugwerkende kracht in een nieuwe bundel trekken zou een reeds
verwerkt item onterecht weer als "ongelezen samenvatting" terugbrengen. Al
opgeloste rijen (`resolvedAt` gezet) worden **nooit** gevouwen — die vallen al
buiten de open-selectie. Groei van een BESTAANDE bundel gebeurt ongeacht de
lees-status (een lopende bundel blijft de bron van waarheid voor dat object en
springt bij groei terug op ongelezen).
- Test `beleid: al-GELEZEN losse rijen worden NIET met terugwerkende kracht
  gevouwen`: twee gelezen losse rijen + één nieuwe wijziging ⇒ geen fold, alle
  rijen blijven los (`bundleCount=1`) en geen enkele gelezen rij wordt opgeslokt.

---

## Acceptatiecriteria (7) — uitkomst

### 1. Tien wijzigingen in hetzelfde object ⇒ één gebundelde melding — ✅
Test `bundeling: 3 of meer wijzigingen zelfde object ⇒ 1 bundel`: 10 × dezelfde
`bundleKey` ⇒ exact **1** open rij, `bundleCount=10`, body
`"10 wijzigingen in je wedstrijdplan"`, laatste `actionUrl` bewaard
(`/races/f12-plan-1?rev=9`). Onder de drempel (`3-1=2`) ⇒ 2 losse rijen
(`bundleCount=1`). Groei reset `readAt` naar ongelezen en bewaart de hoogste
priority.

### 2. Een melding opent de juiste rol en context — ✅ (bestaand, geverifieerd)
`actionUrl` + `audience` waren al aanwezig; `notification-bell.tsx` wisselt bij
openen naar de juiste rol (`roleForPath` / `switchRole`) en navigeert dan.
Bundel-rij bewaart de LAATSTE `actionUrl` zodat de gebruiker bij de meest
recente wijziging landt. Geen UI-wijziging nodig; de bundel-body rendert in de
bestaande `NotificationRow`.

### 3. Gelezen is aantoonbaar iets anders dan afgehandeld — ✅
Test `gelezen ≠ afgehandeld`: alleen `readAt` zetten laat `resolvedAt` NULL;
`resolveNotifications` zet `resolvedAt` en laat `readAt` intact. Twee
onafhankelijke kolommen, los zet- en filterbaar (leespad filtert op
`activeNotificationFilter` = niet-resolved/niet-verlopen; ongelezen op `readAt`).

### 4. Geen enkele pushtekst bevat berichtinhoud/bestandsnaam/gezondheids- of
prestatiegegeven — ✅ (met één gedocumenteerde uitzondering, zie hieronder)
Tests `pushpayload bevat GEEN trainingstitel`, `… GEEN wedstrijdnaam/locatie` en
`connection-health pushpayload bevat GEEN providernaam/status/getallen`: assert op
de daadwerkelijk opgebouwde payload. De in-app `body` MAG specifiek blijven;
`pushTitle`/`pushBody`/`emailSubject`/`emailBody` zijn neutraal. De laatste test
bewijst dat de specifieke `brokenLinkCopy` (met providernaam) nooit de push wordt
en dat `neutralLinkPushPayload` — óók zijn default — geen providernaam
(Strava/Garmin/Wahoo), status ("toestemming verlopen") of getallen ("24 uur") bevat.

**Alle `sendPush`-oproepen gedekt (grep `rg "sendPush" -t ts`):** vier
oproeplocaties. (1) `engines/reminders/deliver.ts` → neutrale
`pushTitle`/`pushBody`. (2) `engines/data-hub/connection-health.ts` → neutrale
`neutralLinkPushPayload`. (3) `routes/alerts.ts` (val-alarm) → bewuste
life-safety-uitzondering (zie tabel). (4) `lib/push.ts` = de definitie zelf.
Elke opbouwplek is dus of neutraal, of een gedocumenteerde uitzondering.

### 5. Stille uren gerespecteerd; urgente veiligheidsmelding komt er wél door — ✅
Ongewijzigd en groen: `test:attention-notifications` 10/10 (o.a.
`channelAllowed: kritiek passeert, niet-kritiek respecteert alles`,
`stille uren: gewoon venster + over middernacht`). NOT-01/03/05 raken dit pad
niet.

### 6. Melding voor ingetrokken rol niet zichtbaar/actief, ook via directe
aanroep — ✅
Test `audience: coach-melding onzichtbaar + niet-PATCHbaar na rolverlies`:
met coach-rol is de melding zichtbaar in de lijst; na intrekken van de rol
(`roles: ["athlete"]`) is ze onzichtbaar in `GET /api/notifications` én levert
`PATCH /:id/read` **404** (geen 403-lek), en de rij blijft ongelezen
(fail-closed). Directe aanroep met `x-dev-clerk-id`. Audience-loos = altijd
zichtbaar voor de eigenaar (aparte test). Enforcement op ALLE lees-/schrijfpaden
(`GET /`, `PATCH /:id/read`, `POST /read-batch`, `POST /read-all`) via
`visibleAudiences` + `audienceFilter`, fail-closed (bij fout alleen
`["athlete"]`).

### 7. Geen module voert nog een eigen meldingenlijst — ✅ (geverifieerd)
Zie NOT-02/04 hieronder.

---

## NOT-03 — pushtekst per payload-opbouwplek

| Plek | Bevinding & maatregel |
|---|---|
| `engines/reminders/build.ts` | Elke `ReminderItem` heeft nu naast (specifieke) `title`/`body` óók NEUTRALE `pushTitle`/`pushBody`/`emailBody`. Training ⇒ "Je training van vandaag staat klaar"; wedstrijd ⇒ "Je hebt binnenkort een wedstrijd — bekijk je voorbereiding"; something_new ⇒ geen item-titel; profielvraag ⇒ "Maak je profiel compleet"; check-in ⇒ geen gemoeds-/gezondheidsinhoud. |
| `engines/reminders/deliver.ts` (web-push) | `sendPush` gebruikt nu `item.pushTitle`/`item.pushBody` i.p.v. `item.title`/`item.body`. De in-app rij (insert in dezelfde loop) houdt de specifieke `title`/`body`. |
| `engines/reminders/deliver.ts` (e-mail via Resend) | `emailText` gebruikt nu `item.emailBody` (neutraal) i.p.v. `item.body`; e-mailonderwerpen neutraal (tevens "Sparki: <werkwoord>" verwijderd). |
| `engines/data-hub/connection-health.ts` (web-push) | **Reviewfix NOT-03.** Eerder stuurde `notifyWithPush` de SPECIFIEKE in-app titel/body letterlijk mee — inclusief providernaam en status (bv. "Strava-koppeling lijkt stuk", "toestemming verlopen", "meer dan 24 uur"). Dat lekt. Nu neemt `notifyWithPush` optionele `pushTitle`/`pushBody`; de pushtekst komt uit de pure functie `neutralLinkPushPayload` met neutrale default ("Er is iets met een koppeling" / "Je synchronisatie heeft aandacht nodig — open de app."), terwijl de in-app rij (`title`/`body`) specifiek blijft. Beide oproepen (`runConnectionHealthCheck` én `engines/data-hub/index.ts` sync-fout) geven expliciet neutrale pushtekst mee. |
| `routes/alerts.ts` (val-alarm, web-push) | **Bewuste, beargumenteerde uitzondering.** Dit is een life-safety `veiligheid`-melding naar VOLWASSEN gekoppelde coach/ouder: bij een mogelijke val moet de ontvanger direct weten WIE en WAAR, want een neutrale push die eerst geopend moet worden kost bij een noodgeval kritieke tijd. Naam + laatst bekende locatie zijn hier het minimale, noodzakelijke signaal om te kunnen handelen; zelfgekozen gezondheids-noodinfo wordt alleen meegestuurd als de sporter dat expliciet aanzette (`shareWithContacts`). Dit is de enige plek waar naam+signaal in de push staat, en uitsluitend voor een echte noodsituatie. |

---

## NOT-02 / NOT-04 — geen tweede meldingssysteem

**Alle producenten gaan door `createNotification`** (centrale laag): geverifieerd
met `rg "createNotification"` — reminders, `routes/coach-messages.ts`,
`routes/club.ts`, `routes/parent.ts`, `routes/work-objects.ts`,
`routes/route-proposals.ts`, `routes/invitations.ts`, `routes/links.ts`,
`routes/goals.ts`, `routes/alerts.ts`, `engines/social/*`,
`engines/data-hub/*`, `lib/material/nudge.ts`, `lib/parent-age-transition.ts`,
`lib/billing/*` enz.

**Coach-berichten en uitnodigingen zijn DOMEINlijsten, geen tweede
meldingssysteem:** `coach_messages`/`invitations` zijn conversatie-/
uitnodigingsdomeinen; de bijbehorende MELDING wordt via `createNotification`
(neutraal, met `audience`) in de centrale laag gemaakt en verwijst met
`actionUrl` naar de domeinlijst. Geen module houdt een eigen meldingen-LIJST
naast `notifications` bij. Geen omzetting nodig.

**NOT-04 (inbox zelf):** `notification-bell.tsx` bestaat en werkt per rol/context
(rolwissel bij openen, gelezen-stip, daily-fold, resolved/expired uitgefilterd
op het leespad). Alleen bevestigd; niet herbouwd.

**Universaliteit — reminders en bundeling (reviewfix, bewuste keuze).**
`engines/reminders/deliver.ts` maakt zijn in-app rij met een eigen
`insert … onConflictDoNothing … returning`, dus BUITEN `createNotification` —
reminders bundelen dus niet mee. Dat is een **beargumenteerde uitzondering**, om
twee redenen:
1. **Er valt niets te bundelen.** Elke reminder is per constructie al
   1-per-object-per-venster via een unieke `dedupeKey`
   (`reminder:training:<workoutId>`, `reminder:race:<raceId>`,
   `reminder:checkin:<datum>` enz.). Verschillende reminders horen bij
   verschillende objecten en krijgen dus verschillende (zouden-zijn)
   bundelsleutels; er ontstaat nooit een stapel van ≥ drempel meldingen voor
   HETZELFDE object die je zou willen samenvatten. Routeren door de centrale
   helper zou geen enkel gedrag veranderen.
2. **Least-breaking / idempotentie.** Het reminder-afleverpad hangt af van het
   RETURNING-id (verse-rij-signaal) én van `sentAt`-tracking voor de eenmalige
   e-mail/push-aflevering. `createNotification` geeft alleen een boolean terug en
   kent geen `sentAt`-boekhouding; die er doorheen routeren zou de door
   `email-channel`/`scheduled-tasks`-tests afgedekte aflever-idempotentie
   omzetten met reëel regressierisico, zónder functionele winst (zie punt 1).

De overige producenten (coach, club, parent, materiaal, sync/data-hub, social,
goals, billing) lopen wél via `createNotification` en doen dus volledig mee aan
bundeling, neutrale push en audience-afdwinging.

---

## Testlogs

`node ./scripts/run-test.mjs f12-inbox --dev-auth` (nieuw):

```
✅ bundeling: 3 of meer wijzigingen zelfde object ⇒ 1 bundel
✅ bundeling: groei reset readAt (bundel wordt weer ongelezen)
✅ onder de drempel ⇒ losse meldingen (geen bundel)
✅ kritieke categorieën worden NOOIT gebundeld
✅ concurrency: 10 parallelle producenten ⇒ exact 1 bundel, count=10, geen verloren events
✅ concurrency rond de drempel: parallelle events verliezen niets
✅ beleid: al-GELEZEN losse rijen worden NIET met terugwerkende kracht gevouwen
✅ gelezen ≠ afgehandeld: readAt en resolvedAt los zetbaar
✅ pushpayload bevat GEEN trainingstitel
✅ pushpayload bevat GEEN wedstrijdnaam/locatie
✅ connection-health pushpayload bevat GEEN providernaam/status/getallen
✅ audience: coach-melding onzichtbaar + niet-PATCHbaar na rolverlies
✅ audience-loos = altijd zichtbaar voor eigenaar
✅ config: drempel en venster leesbaar/onderbouwd
14/14 scenario's geslaagd (drempel=3, venster=24u)
```

> De audience-scenario's doen een LIVE `fetch` naar de draaiende API; die
> passeren nu de API-server op de nieuwe build. De bundel-/concurrency-/
> payload-scenario's zijn niet server-afhankelijk (directe datalaag/pure functies).

`node ./scripts/run-test.mjs attention-notifications --dev-auth`: **10/10** — stille
uren + kritiek-passage ongebroken; o.a. `resolutionKey race-veilig` blijft groen.

`node ./scripts/run-test.mjs connection-health`: **12/12** — koppeling-meldingen
ongebroken na de neutrale-push-refactor.

`node ./scripts/run-test.mjs data-hub`: **10/10** · `email-channel`: **6/6** ·
`scheduled-tasks`: **25/25** (reminder-aflever-idempotentie ongebroken).

Typecheck/build: `pnpm run typecheck:libs` ✓ · `@workspace/api-server typecheck`
✓ · `@workspace/db build` ✓ · api-server `build` ✓ · sparki `typecheck` ✓ ·
`node scripts/check-brand-copy.mjs` ✓ ("geen verboden merkvermeldingen").

## Schema/migratie
`migrations/0020_f12_notification_bundling.sql` (idempotent) toegepast +
`drizzle-kit push` gesynchroniseerd. Kolommen `bundle_key` (text, NULL = niet
bundelbaar), `bundle_count` (int, default 1) + partiële index
`notif_clerk_bundle_idx` op `(clerk_id, bundle_key, created_at) WHERE bundle_key
IS NOT NULL AND resolved_at IS NULL`.
