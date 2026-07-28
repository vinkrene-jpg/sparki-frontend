# SPARKI — CLUB EN JEUGDSPORTER/OUDER: AUDIT EN BUILDPLAN
**Datum:** 2026-07-28 · **Status:** onderzoeksdocument, geen applicatiewijzigingen uitgevoerd

---

## 1. Onderzochte bron

- **Commit-SHA (HEAD van `main`, werkende repository):** `e8b23aa8c1d8ec73f1c5e7de19e985213bf1dd3d` (2026-07-28 15:46 UTC).
- **Repository-ZIP:** ⚠️ **BEWIJS ONTBREEKT.** In `attached_assets/` staat géén nieuwe volledige repository-ZIP; de aanwezige zips zijn oudere defectregister-snapshots en een media-zip. Deze audit is daarom uitsluitend gebaseerd op de actuele repository op bovenstaande SHA. Wanneer de bedoelde ZIP een andere stand bevat, moet dit document daartegen herijkt worden.
- **Masterplan:** als normatief kader gehanteerd voor *wat er zou moeten zijn*; nergens gebruikt als bewijs dat iets bestaat. Alle bestaansclaims hieronder hebben bestands- of endpointverwijzingen.
- **Methode:** vier onafhankelijke code-inventarisaties (club, jeugd/ouder, privacy/audit, UI/PWA/mobiel), gecontroleerd tegen schema-, route-, UI- en testbestanden. Percentages worden nergens op bestandsaantallen gebaseerd.

---

## 2. Huidige status CLUB (code, database, API, UI)

### 2.1 Database (`lib/db/src/schema/club.ts`)
| Tabel | Doel |
|---|---|
| `clubs` | naam, locatie, kleuren, logo, unieke `join_code`, `status` (actief/beperkt/geschorst/beëindigd), `modules` (jsonb) |
| `club_members` | lidmaatschap: `role` (default `member`), vrij `label`, `joined_at`, `ended_at` (historie) |
| `club_teams`, `club_groups` | eenheden met eigen `join_code`, `category`, `level`, `training_days` |
| `club_team_members`, `club_group_members` | toewijzing leden |
| `club_trainings` | titel, datum/tijd, `route_id` (soft ref), `max_participants`, materiaal-/veiligheidsinfo |
| `club_training_signups` | aanmelding + aanwezigheid (aanwezig/afwezig/te_laat) |
| `club_race_events`, `club_race_selections` | wedstrijden, verzamelpunt, selectierollen |
| `club_messages`, `club_message_reads` | berichten met scope (club/team/groep) + leesbevestiging |
| `club_consents` | toestemming per scope (o.a. `training_summary`, `vermogen`, `hartslag`), `granted_by_relation` (self/parent) |
| `club_subscriptions` | pakketlimieten `max_members`/`max_trainers`, status trial/active/blocked |
| `club_audit_log` | append-only beheerlog |
| `club_locations` | herbruikbare locaties/parcoursen |

### 2.2 API (`artifacts/api-server/src/routes/club.ts`)
Alle routes achter `requireAuth`; club-context via één resolver `getClubContext` (`artifacts/api-server/src/lib/club-permissions.ts:35`, actief lidmaatschap = `ended_at IS NULL`).
- Algemeen: `POST /api/club` (aanmaken, proefpakket), `GET /api/club`, `POST /api/club/join` (code).
- Beheer (owner/admin): `PUT /:clubId`, `POST /:clubId/join-code`, `GET /:clubId/members`, `PUT /:clubId/members/:memberId/role`, `GET /:clubId/subscription`, `GET /:clubId/audit`, `GET /:clubId/export`.
- Activiteiten: `POST/GET /:clubId/trainings`, `POST /:clubId/trainings/:id/signup`, `PUT /:clubId/trainings/:id/attendance` (trainer/assistent), `POST /:clubId/races`.
- Consent & sportdata: `GET /:clubId/consents/mine`; trainerinzage via `GET /:clubId/trainer/athletes` en `GET /:clubId/trainer/athletes/:athleteId/summary`, strikt achter `hasClubConsent`/`canViewConsentedData` — consent is vereist voor **elke** trainerinzage in sportdata.

### 2.3 UI (`artifacts/sparki/src/pages/`)
- `club.tsx` (route `/club`): sporterweergave — trainingen inschrijven (met conflictmelding tegen eigen schema), wedstrijdbeschikbaarheid, berichten, consent per scope beheren; bij minderjarigen expliciete melding dat alleen een ouder mag toestemmen (r354). Zonder lidmaatschap: `JoinClubCard`/`StartClubCard`.
- `club-beheer.tsx` (route `/club/beheer`): owner/admin — instellingen, QR/join-code, uitnodigingen, rolwijzigingen, trainingen/wedstrijden aanmaken, pakketbeheer.

### 2.4 Tests
`artifacts/api-server/src/tests/club.ts` (script `test:club`, via shell draaien i.v.m. workflowlimiet): club aanmaken (maker=owner), proefperiode, limiet-afdwinging bij uitnodigen én accepteren, cross-club-isolatie, signup-locking, consent-gated trainerinzage. Zelf-activatie van consent (`routes/club.ts:2038`) is alleen toegestaan als `isLinkedParent` waar is bij jeugd.

---

## 3. Huidige status JEUGDSPORTER/OUDER (code, database, API, UI)

### 3.1 Database
- `parent_athlete_links` (`lib/db/src/schema/links.ts:26`): `permissions` (jsonb, per categorie), `age_tier_at_consent`, `consent_confirmed_at`.
- `parent_reports` (`lib/db/src/schema/parent.ts:48`): ziek/blessure/afwezig (open|gezien|afgerond).
- `emergency_contacts` (`parent.ts:76`): max 5, prioriteit 1..5.
- `parent_confirmations` (`parent.ts:103`): wedstrijd-/trainingsbevestigingen.
- `parent_messages` (`parent.ts:142`).
- Leeftijd: `birthDate` + `birthYear` in `athlete_profiles` (`athlete-profiles.ts:35-36`); DOB is autoritair (zie memory `sparki-exact-age`).

### 3.2 API
- Ouder (`routes/parent.ts`): `GET /api/parent/athletes` (L41), `GET /api/parent/overview` (L211), `PUT /api/parent/athletes/:id/permissions` (L463, **alleen bij sporter <16**), `POST …/reports` (L547), `POST …/confirm` (L795).
- Sporter (`routes/links.ts`): `GET /api/links/parents/manage` (L195), `PUT /api/links/parent/:id/permissions` (L235), `POST /api/links/parent/:id/reconfirm` (L303).
- Autorisatie: **één rechtenlaag** `effectiveParentAccess` (`lib/parent-permissions.ts`) is de enige waarheid voor ouder-leestoegang; elke ouder-route gaat erdoorheen (eerdere legacy-gaten zijn gedicht — zie memory `sparki-parent-environment`).

### 3.3 UI
- Ouder: `components/sparki/parent-home.tsx` — rol `parent` landt hier via `/`/`/vandaag`. Wellbeing (slaap/gevoel), planning vandaag, komende wedstrijden met bevestig-knoppen, noodcontacten, meldingen. Empty state "Nog geen sporter gekoppeld" + uitnodiging versturen (r629-634).
- Sporter: `pages/you.tsx` (ConnectionsSection) — wie is gekoppeld, rechten beheren (16+), herbevestigen bij tier-wissel.

### 3.4 Tests
`test:parent-environment`, `test:coach-parent-sharing-levels`, `test:coach-parent-share-nothing`, `test:coach-parent-private-memory`, `test:coach-parent-link-isolation`, `test:links-unlink-isolation`, `test:links-end-isolation`, `test:cross-account-isolation`.

---

## 4. Bewijs per bestaande functie (verkort overzicht)

| Functie | Bewijs |
|---|---|
| Club aanmaken/joinen met code | `routes/club.ts` `POST /`, `POST /join`; UI `club.tsx`; test `tests/club.ts` |
| Rollen wijzigen | `PUT /:clubId/members/:memberId/role`; UI `club-beheer.tsx` |
| Training plannen + aanmelden + aanwezigheid | `POST /:clubId/trainings`, `…/signup`, `…/attendance`; UI `club.tsx`; row-lock op signup (memory `sparki-club`) |
| Pakketlimieten | `club_subscriptions`; afgedwongen bij invite én accept (test gedekt) |
| Consent-gated trainerinzage | `GET /:clubId/trainer/athletes/:athleteId/summary` + `hasClubConsent` |
| Jeugd-consent alleen via ouder | `routes/club.ts:2038` (`isLinkedParent`); UI-copy `club.tsx:354` |
| Ouderdashboard | `GET /api/parent/overview`; `parent-home.tsx` |
| Per-categorie ouderrechten | `parent_athlete_links.permissions`; `effectiveParentAccess` |
| Herbevestiging bij leeftijdstier-wissel | `POST /api/links/parent/:id/reconfirm`; `parent-permissions.ts:131` |
| Minor fail-closed coach-sharing | `lib/sharing.ts:108-112` |
| Uitnodigingen (ouder/coach/tester) | `/invite/:token`, `pages/invite-accept.tsx`; atomaire accept (memory `sparki-invitations`) |

---

## 5. Clubrollen- en rechtenmatrix

Rollen letterlijk in code (`lib/db/src/schema/club.ts:30`): `owner`, `admin`, `hoofdtrainer`, `trainer`, `assistent`, `teammanager`, `mechanieker`, `member`, `parent`, `vrijwilliger`, `alleen_lezen`.

| Actie | owner | admin | hoofdtrainer | trainer | assistent | teammanager | mechanieker | member | parent | vrijwilliger | alleen_lezen |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Clubinstellingen/join-code | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Rollen wijzigen | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Trainingen plannen | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aanwezigheid registreren | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Materiaalvelden bewerken | — | — | — | — | — | — | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sportdata sporter inzien | ❌* | ❌* | ✅ᶜ | ✅ᶜ | ❌ | ❌ | ❌ | eigen | via ouderlaag | ❌ | ❌ |
| Berichten lezen | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

\* Beheerders zien **nooit** sportdata (least-privilege, `club-permissions.ts`). ᶜ = alleen expliciet toegewezen sporters mét granted consent-rij.
⚠️ **Bewijs deels ontbrekend:** voor `teammanager` en `vrijwilliger` zijn de rolwaarden aanwezig in het schema, maar er is geen route gevonden die deze rollen onderscheidend gebruikt behalve als generiek lid. Dit is een gedeeltelijke implementatie (zie §12).

---

## 6. Jeugdsporter-/ouder-/verzorgerrollenmatrix

| Situatie | Sporter | Ouder (gekoppeld, bevestigd) | Ouder (onbevestigd) |
|---|---|---|---|
| <16 | kan zelf géén consent geven (403); ziet eigen data | beheert rechten (`parentMayEdit`), ziet categorieën volgens `permissions` | alleen safety-only |
| 16–17 | beheert eigen rechten; ouder alleen-lezen volgens toegekende categorieën | leesrechten volgens door sporter toegekende categorieën | safety-only |
| 18+ | volledig zelfbeheer | alles dicht tot sporter herbevestigt (`allOff()`) | niets |
| Leeftijd onbekend | fail-closed: clamp naar veiligheidsminimum vóór reconfirm-logica | safety-only | safety-only |

"Verzorger" bestaat niet als aparte rol: de koppeling is `parent_athlete_links` en dekt feitelijk elke wettelijke vertegenwoordiger. ⚠️ Meerdere ouders per kind zijn technisch mogelijk (meerdere links); een expliciete verzorger-/voogd-typering ontbreekt (open beslispunt §25).

---

## 7. Server-side autorisatie per rol/endpoint

- **Club:** elk endpoint door `getClubContext` (actief lidmaatschap); rolchecks per route (owner/admin voor beheer, trainer/assistent voor aanwezigheid); alle team-/groep-ID's uit requests worden tegen `ctx.club.id` gevalideerd; lookup-helpers joinen defensief op de club-kolom (cross-club-isolatie, testgedekt).
- **Ouder:** elke route door `effectiveParentAccess`; per-categorie gates (`access.permissions.<categorie>`), nooit alleen sharing-level.
- **Coach:** sharing-resolver (`lib/sharing.ts`) met minor fail-closed.
- **Mutatie-veiligheid:** signup/reserve-promotie met `SELECT … FOR UPDATE`; join-met-code capaciteit+insert in één transactie met advisory lock; niet-actieve clubstatus blokkeert alle schrijfacties (409) via één guard.

---

## 8. Toestemmingsmatrix per datatype en functie

| Datatype | Club-trainer | Ouder | Coach (individueel) |
|---|---|---|---|
| Trainingssamenvatting | `club_consents` scope `training_summary` (granted-rij vereist) | categorie in `permissions` | `coachSharingLevel` |
| Vermogen | scope `vermogen` | categorie | sharing-level + shared-raw-fields (testgedekt) |
| Hartslag | scope `hartslag` | categorie | idem |
| Gezondheid/herstel | ❌ geen club-scope | safety-only altijd (minimum) | levels |
| Privénotities/memory | nooit | nooit (testgedekt `coach-parent-private-memory`) | nooit |

Kritieke UI-regel (uit memory, geverifieerd): "granted" wordt afgeleid uit consent-**rijen**, nooit uit de lijst beschikbare scopes.

## 9. Leeftijdsregels

Letterlijk in `lib/parent-permissions.ts` (tiers L74-89) en `lib/sharing.ts:29`:
- **<16 (`u16`):** ouder beheert rechten (L123); zelf-consent club = 403; coach-sharing geforceerd `none` zonder accepted ouderconsent.
- **16–17 (`16_17`):** sporter beheert; ouder alleen-lezen (`routes/parent.ts:480`).
- **Overgang naar 18:** *lazy* bij eerstvolgende request — tier ≠ `ageTierAtConsent` ⇒ `reconfirmRequired`, rechten naar `allOff()` (L159-171) tot de sporter herbevestigt via `POST /reconfirm`. **Er is géén proactieve verjaardags-job**; rechten vervallen dus pas bij het eerste API-contact ná de verjaardag (risico laag: elke lees-route gaat door dezelfde laag).
- **Onbekende leeftijd:** clamp naar veiligheidsminimum vóór alle overige logica.

## 10. Toegang per persona (samengevat)

Sporter: eigen data volledig. Ouder: per-categorie, leeftijdsafhankelijk (§6). Coach: sharing-levels + minor-regel. Trainer: alleen toegewezen sporters mét consent. Clubbeheerder: organisatie, nooit sportdata. Teammanager/vrijwilliger: rolwaarde bestaat, onderscheidend gedrag ontbreekt (§12). Mechanieker: alleen materiaalvelden.

---

## 11. End-to-end aantoonbaar werkend
1. Club oprichten → join-code/QR → lid worden → training plannen → aanmelden (race-safe) → aanwezigheid (UI + API + tests).
2. Pakketlimieten bij invite én accept.
3. Consent-gated trainerinzage incl. jeugd-via-ouder.
4. Ouderkoppeling via invite-token → ouderdashboard → melding/bevestiging → per-categorie rechten → herbevestiging bij tier-wissel (UI + API + tests).
5. Coach-sharing-levels incl. minor fail-closed en privé-memory-afscherming (tests).
6. Account-export/verwijdering met 14-dagen venster en audit (raakt jeugd: geen aparte jeugdregels, zie §14).

## 12. Gedeeltelijk bestaand
- **Rollen `teammanager`, `vrijwilliger`, `alleen_lezen`:** schemawaarden + rolwijziging bestaan; geen route met onderscheidend gedrag gevonden. ⚠️ Bewijs van bedoeld gedrag ontbreekt (masterplan beschrijft het, code niet).
- **Club-audit/export UI:** endpoints `GET /:clubId/audit` en `/export` bestaan; geen knop in `club-beheer.tsx` gevonden.
- **`club_locations`:** tabel bestaat; gebruik in trainingen-UI beperkt/onbevestigd.
- **Ouder-inzage-audit:** `viewed_by_parent` wordt bij sommige leesroutes geschreven (`routes/parent.ts:178`), maar niet aantoonbaar bij **elke** gevoelige leesactie.
- **Club-rolwijziging-audit:** `club_audit_log` bestaat; niet elke rolwijziging schrijft aantoonbaar een rij.

## 13. Volledig ontbrekend
- Mobiele (Expo) UI voor club én ouder — `sparki-mobile` is puur atleet-gericht; instellingen verwijzen naar de webapp (`instellingen.tsx:75`).
- Proactieve 18-jaar-overgang (verjaardags-job + notificatie aan ouder/sporter).
- Verzorger-/voogd-typering en meerouder-conflictregels.
- Club↔ouder-koppelvlak: een ouder ziet clubtrainingen van het kind alleen via het ouderdashboard voor zover categorie "planning" aan staat; er is geen club-specifieke ouderweergave (bijv. wedstrijdselecties bevestigen namens kind is er wél via `parent_confirmations`, maar niet club-scoped).
- Betaal-/facturatielaag voor clubpakketten (subscriptions zijn statusvelden, geen betaalflow).

---

## 14. Privacy-, AVG-, beveiligings- en veiligheidsrisico's
1. **Ouder-leesacties niet overal geauditeerd** (§12) — herleidbaarheid van inzage in kinddata is een AVG-aandachtspunt.
2. **Club-rolwijzigingen zonder gegarandeerde auditrij** — beheerhandelingen op jeugddata-toegang moeten herleidbaar zijn.
3. **Lazy 18-overgang**: theoretisch venster waarin een ouder oude rechten houdt tot het eerste API-contact; laag risico maar benoemen richting gebruikers.
4. **Verwijderflow is accountbreed**: geen aparte afweging voor jeugdaccounts (wie mag verwijdering van een <16-account starten? nu: alleen het account zelf) — open beslispunt.
5. **Positief**: minor fail-closed zit in de resolvers (coach, ouder, AI-gateway `minorBlocked`, social default-uit), niet in losse routes — structureel juist.

## 15. Toestemming: vastleggen, wijzigen, intrekken, bewijzen
- Vastleggen: `club_consents` (met `granted_by_relation`), `parent_athlete_links.permissions` + `consent_confirmed_at` + `age_tier_at_consent`.
- Wijzigen/intrekken: `PUT /permissions` (ouder <16 of sporter 16+), club-consent toggles in `club.tsx`.
- Bewijzen: `consent_audit_log` (privacy-toggles), audit-events `parent_permissions_changed`, `consent_change`; club-consent-wijzigingen ⚠️ niet aantoonbaar overal geauditeerd.

## 16. Auditlog en herleidbaarheid
Vier logs: `security_audit_log`, `consent_audit_log`, `admin_ops_log`, `club_audit_log`. Gedekt: login, export, delete (incl. exceptions-register), legal-accept, rate-limit, parent-permissions/reports. Gaten: zie §12/§14. Audit-writes zijn fire-and-forget (tests moeten ~300 ms wachten).

## 17. Web-, PWA- en mobiele dekking
- Web: volledig (§2/3). PWA: manifest + service worker aanwezig (`public/manifest.webmanifest`, `public/sw.js`, link in `index.html:14`) — club/ouder werken dus als PWA mee.
- Mobiel (Expo): **geen** club/ouder-schermen.

## 18. Fout-, lege-, verlopen-consent- en overgangsstaten
Aanwezig (letterlijke copy): lege trainingen/berichten (`club.tsx:251/307`), geen sporter gekoppeld (`parent-home.tsx:629-634`), jeugd-consent-melding (`club.tsx:354`), account-laadfouten (`App.tsx:219-222`), reconfirm-flow in `/you`. ⚠️ Niet gevonden: expliciete "consent verlopen"-staat in de club-UI (consent kent geen vervaldatum — alleen tier-gebonden herbevestiging aan ouderzijde).

## 19. Gezamenlijk te bouwen
- Audit-dekking (ouder-inzage + club-rolwijzigingen + club-consent) — één patroon, beide systemen.
- 18-jaar-overgangsnotificatie — raakt links, club-consents (`granted_by_relation='parent'` moet dan mee vervallen ⚠️ nu onbevestigd of dat gebeurt: **bewijs ontbreekt**, expliciet natrekken).
- Ouderweergave van clubverplichtingen van het kind.

## 20. Gescheiden houden
- Clubrechten (organisatie) vs. ouderrechten (persoonsgegevens): verschillende resolvers, zo houden.
- Coach-sharing vs. trainer-club-consent: aparte consentmodellen; niet samenvoegen (ander bereik, andere levensduur).
- Mechanieker-materiaal vs. sportdata: strikt gescheiden houden.

## 21. Aantoonbaar af — NIET herbouwen
Club-kern (schema, context-resolver, limieten, locking, isolatie), consent-gated trainerinzage, `effectiveParentAccess` + leeftijdstiers + reconfirm, minor fail-closed sharing, invite-flow, privacy-/export-/deleteflow, alle genoemde contracttests. Elke opdracht hieronder **breidt uit**, herschrijft niets.

---

## 22. Kleine, opeenvolgende Replit-opdrachten

**O1 — Audit-dekking gevoelige handelingen** · Doel: elke club-rolwijziging, club-consent-wijziging en ouder-leesactie schrijft een auditrij. Afbakening: alleen audit-writes + tests; geen gedragswijziging. Hergebruik: `writeAudit`, `club_audit_log`, bestaand fire-and-forget-patroon. Acceptatie: contracttest per handeling vindt de rij (met sleep). Tests: uitbreiding `tests/club.ts` + `parent-environment.ts`. Afhankelijkheden: geen. Rollbackrisico: zeer laag (append-only).

**O2 — 18-jaar-overgang expliciet maken** · Doel: dagelijkse check (bestaand scheduled-tasks-patroon) die tier-wissels detecteert, ouderrechten laat vervallen en beide partijen notificeert; club-consents met `granted_by_relation='parent'` vervallen mee. Hergebruik: `effectiveParentAccess`, reminders-engine (dedupeKey). Acceptatie: gesimuleerde verjaardag ⇒ rechten `allOff`, notificatie, club-consent ingetrokken, audit. Afhankelijk van O1. Rollbackrisico: laag; alleen-vervallen (nooit toekennen).

**O3 — Club-audit/export in beheer-UI** · Doel: bestaande `GET /:clubId/audit` en `/export` ontsluiten in `club-beheer.tsx`. Acceptatie: owner/admin ziet log en kan exporteren; overige rollen 403 (testgedekt). Afhankelijkheden: geen. Rollbackrisico: zeer laag (leesweergave).

**O4 — Rolgedrag teammanager/vrijwilliger** · Doel: onderscheidend gedrag (teammanager: wedstrijdlogistiek team-scoped; vrijwilliger: alleen aanwezigheid ondersteunen) óf de rollen expliciet uit de kiezer halen. **Vereist besluit René (§25.1).** Hergebruik: rolchecks-patroon `club-permissions.ts`. Rollbackrisico: laag.

**O5 — Ouderweergave clubverplichtingen** · Doel: in `parent-home.tsx` clubtrainingen/wedstrijden van het kind tonen achter categorie "planning". Hergebruik: `GET /api/parent/overview` + club-queries; geen nieuwe rechtenlaag — alles door `effectiveParentAccess`. Acceptatie: categorie uit ⇒ niets zichtbaar (test). Afhankelijk van O1. Rollbackrisico: laag.

**O6 — Jeugdaccount-verwijderregels** · Doel: besluit §25.3 implementeren in bestaande deleteflow. Afhankelijk van besluit. Rollbackrisico: middel (raakt destructieve flow) — daarom laatste.

## 23. Testmatrix rolcombinaties

| # | Actor | Doelwit | Verwacht | Status |
|---|---|---|---|---|
| 1 | trainer | toegewezen sporter mét consent | data zichtbaar | ✅ testgedekt |
| 2 | trainer | sporter zonder consent / ander team | 403 | ✅ |
| 3 | admin | sportdata willekeurig lid | 403 | ✅ |
| 4 | sporter <16 | zelf club-consent | 403 | ✅ |
| 5 | gekoppelde ouder | club-consent kind <16 | toegestaan | ✅ |
| 6 | ouder onbevestigd | categorie-data | safety-only | ✅ |
| 7 | ouder na 18e verjaardag kind | categorie-data | dicht na reconfirm-trigger | ✅ (lazy) / ⚠️ proactief ontbreekt |
| 8 | lid club A | resources club B | 404/403 | ✅ |
| 9 | teammanager/vrijwilliger | onderscheidende acties | — | ⚠️ geen gedrag, geen test |
| 10 | mechanieker | materiaalvelden vs. sportdata | edit / 403 | ⚠️ deels — sportdata-weigering niet expliciet getest |
| 11 | ouder | privé-memory kind | nooit | ✅ |
| 12 | coach + ouder combinaties | share-levels | conform level | ✅ (test:coach-parent-*) |

## 24. Prioritering
- **Releaseblokkerend:** O1 (audit-dekking — AVG-herleidbaarheid bij jeugddata).
- **Noodzakelijk voor pilot:** O2 (18-overgang), O3 (club-audit-UI), testmatrix-gaten #9/#10.
- **Commercieel noodzakelijk:** O5 (oudervolwaardigheid), betaalflow clubpakketten (buiten scope van dit plan; aparte opdracht).
- **Latere uitbreiding:** O4-gedrag, mobiele club/ouder-UI, verzorger-typering.

## 25. Open beslispunten voor René
1. **Teammanager/vrijwilliger:** echt gedrag bouwen of rollen (voorlopig) uit de kiezer verwijderen?
2. **Meerdere ouders/voogden:** gelijkwaardige rechten of één hoofdouder? Conflictregel bij tegenstrijdige wijzigingen?
3. **Verwijdering jeugdaccount (<16):** mag alleen de gekoppelde ouder dit starten, alleen het kind, of beiden met wachttijd?
4. **18-overgang en club-consents:** vervallen ouder-gegeven club-consents automatisch (advies: ja, fail-closed) of blijven ze staan tot de sporter ze zelf intrekt?
5. **Ouder-inzage-notificatie:** moet het kind (16-17) kunnen zien wanneer een ouder data heeft bekeken (transparantie-log in `/you`)?
6. **Mobiel:** krijgen ouders/clubbeheer ooit native schermen, of blijft dat bewust web/PWA-only?

---

*Alle regelnummers gelden voor commit `e8b23aa8…`. Waar bewijs ontbreekt is dat expliciet gemarkeerd met ⚠️; er zijn geen aannames als feit opgeschreven en geen mockfunctionaliteit als gebouwd gemarkeerd.*
