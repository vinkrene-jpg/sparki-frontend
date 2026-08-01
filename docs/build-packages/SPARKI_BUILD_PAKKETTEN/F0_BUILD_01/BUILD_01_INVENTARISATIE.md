# BUILD_01 F0 — Inventarisatie (werkelijkheid, geen wensbeeld)

**Pakket:** SPARKI_BUILD_01 — Fundament, veiligheid en toegang · **Fase:** F0 (nul regels productiecode)
**Datum:** 01-08-2026 · **Basis-SHA:** b012a18f028f6496bbe0b60e3cb90436d5f52969
**Methode:** vijf onafhankelijke code-verkenningen over de F0-scope; elke "aanwezig"-claim draagt bestand/tabel/functie, elke "afwezig"-claim de uitgevoerde zoekactie.

## 1. Consentmodel en -statussen — AANWEZIG (verspreid, niet één service)

- `legal_acceptances` (lib/db/src/schema/legal-acceptances.ts) — append-only bewijslaag: clerk_id, kind (terms/privacy/gezondheid), version, accepted_at, source, revoked_at.
- `privacy_settings` (lib/db/src/schema/privacy.ts) — per gebruiker: `parent_consent_required`, `parent_consent_status` (not_required/pending/accepted/declined), `data_sharing_parent` (none/safety_only/summary), AI-toestemmingsvlaggen.
- `parent_athlete_links` (lib/db/src/schema/links.ts) — status (pending/accepted), permissions (jsonb per categorie), `age_tier_at_consent`, `consent_confirmed_at`.
- `consent_audit_log` (schema/privacy.ts) — audit van privacy-wijzigingen; daarnaast `writeAudit` met event `consent_change` in routes/legal.ts.
- Handhaving: `artifacts/api-server/src/lib/consent.ts` — fail-closed (ontbrekend bewijs of versie-mismatch = geen toegang).
- **Gat t.o.v. BB-01/4.1:** er is GEEN tabel `consent_grant` met grantor/grondslag/geldig-tot, en GEEN gedeelde éné consent-status-enumeratie: frontend (`use-parent.ts` e.a.) herdefinieert types naast `@workspace/db`. Consentkennis is verdeeld over drie tabellen + parent-permissions-logica.

## 2. Leeftijdsbepaling — AANWEZIG

- `athlete_profiles.birth_date` (bron, exact) met `birth_year` als fallback; berekening centraal in `artifacts/api-server/src/lib/age.ts` (`computeAge`, verjaardag-correct).
- Tiers `u16` / `16_17` / `adult` / `unknown` in schema/parent.ts; rechten per tier in `lib/parent-permissions.ts` (u16: ouder beheert; 16–17: ouder alleen-lezen; 18+: alle oudertoegang vervalt tot herbevestiging). Herbevestiging is event-gebaseerd bij tier-wissel (`reconfirmRequired`), niet tijdgebaseerd (zoekactie: "reconfirm", interval-termen — geen tijdscadans gevonden).
- **Gat:** geen `reconfirmation_due_at`; bij `unknown` leeftijd geldt het strengste regime alleen op de paden die daar expliciet op clampen (o.a. ouderomgeving); geen centrale "age_class"-service die overal wordt geconsumeerd.

## 3. Relatietabellen en endedAt — GEMENGD

| Relatie | Tabel | Einde-veld | Scope-filter |
|---|---|---|---|
| Trainer–sporter | `coach_athlete_links` | **GEEN endedAt** (status pending/accepted; ontkoppelen = rijmutatie) | status='accepted' (lib/account.ts:52, lib/passport.ts:318) |
| Ouder–kind | `parent_athlete_links` | **GEEN endedAt** | status='accepted' (lib/account.ts:64, lib/sharing.ts:338) |
| Teamlid | `club_team_members` | `endedAt` ✔ | isNull(endedAt) (lib/sharing.ts:171, world-social/access.ts:188) |
| Clublid | `club_members` | `endedAt` ✔ | isNull(endedAt) (lib/club-permissions.ts:48) |
| Groepslid | `club_group_members` | `endedAt` ✔ | isNull(endedAt) (lib/sharing.ts:181) |
| Vriendschap | `friend_links` | **GEEN endedAt** | status='accepted' (lib/profile-privacy.ts:176) |
| Klant/abonnement | `billing_subscriptions` | status/graceUntil/currentPeriodEnd | entitlements-resolutie |

- `startedAt` bestaat nergens als aparte kolom; overal `createdAt`/`joinedAt`.
- Eerdere isolatie-tests bestaan al: test-links-end-isolation, test-links-unlink-isolation, test-cross-account-isolation (workflows, groen op basis-SHA).

## 4. Server-side rolwaarden — AANWEZIG (twee niveaus)

- Globaal: `user_profiles.active_role` met `validRoles = athlete | coach | parent` (lib/db/src/schema/users.ts).
- Clubcontext: `club_members.role` (`clubRoles`, schema/club.ts) — owner/admin/hoofdtrainer/trainer/teammanager/ploegleider/mechanieker/soigneur/`medical_staff`/vrijwilliger e.a. (rolmapping definitief sinds Team-abonnement: ploegleider aparte rol, medic→medical_staff).
- Trainerlaag: `club_trainer_assignments` + hasCoachAccess = directe link ∪ clubtoewijzing (memory: trainer-werkruimte WP-01).
- **`nutrition_specialist`: AFWEZIG** — zoekactie op "nutrition_specialist", "voedingsdeskundige" over schema en routes: alleen in de nieuwe pakket-docs. Rolwaarde bestaat server-side niet (MUX-75: dus ook geen rolscherm).

## 5. Startschermen per rol en terugvalgedrag — AANWEZIG, met terugval-risico's

- Athlete: volledige 5-tab-navigatie (Vandaag · Activiteiten · Ontdekken · Trainen · Jij) — bottom-nav.tsx.
- Coach: EIGEN nav-set `COACH_NAV` met **3 posities** (Vandaag `/`, Uitnodigen, Profiel) — wijkt af van BB-06 (vijf posities).
- Parent: 5 posities (Kinderen, Vandaag, Meldingen, Toestemmingen, Meer).
- Clubrollen (ploegleider, mechanieker, soigneur, medical_staff, teammanager, vrijwilliger): **geen eigen startpunt**; zij landen in de athlete-shell met clubpagina's — dit is de door BB-08 verboden terugval. (Vindplaats: bottom-nav.tsx:51-52 kiest alleen op coach/parent; al het andere = athlete-set.)

## 6. Contextmechanisme — DEELS

- `user_profiles.active_role` is server-side en wordt per request geresolven; er is GEEN `active_context`-tabel met rol+organisatie+team (zoekactie: "active_context", "context switch" — alleen rolwissel, geen organisatie/team-dimensie).
- Clubrechten worden per club-ID gecheckt (club-permissions), maar er is geen expliciete "actieve organisatie"-selectie; meerdere clubs = per-pagina keuze.

## 7. Navigatiestructuur — AANWEZIG

- ScreenShell + CommercialShell zijn de enige chrome-eigenaren (memory: gedeelde layout-shell); bottom nav vast 5 (athlete), Meer-menu chapters SSOT in core-meer.ts met navigatiecontracttest (test:navigation).
- Afwijkingen t.o.v. BB-06: coach-nav heeft 3 posities; positie-betekenissen (1 startpunt … 5 Meer) zijn nooit als contract vastgelegd.

## 8. Trainings- en agendastructuur — LOSSE STRUCTUREN, GEEN CENTRALE EVENTLAAG

- `planned_workouts` (scheduledDate, structure jsonb, source sparki/coach, coachClerkId), `races` (raceDate, priority, koppeling planned_workout), `life_events` (leefagenda, kind/startDate/endDate/impact; afwezigheid = life event), `club_trainings` (trainingDate, locationId, teamId/groupId), `club_race_events` (verzamelpunten/transport).
- **Herhaling/recurrence: AFWEZIG** — zoekactie "recurrence", "rrule", "herhaal" over schema: geen kolommen. `training_series` bestaat niet.
- **Centrale `event`-laag (PD-1): AFWEZIG** — geen tabel met source_module/source_record_id.

## 9. VOG-registratie — AFWEZIG

- Zoekactie "vog", "verklaring omtrent gedrag" over schema, routes en scripts: alleen beleids-/pakketdocumenten. Geen `vog_record`-tabel, geen koppelweigering op jeugdgroepen.

## 10. Communicatielaag en bijlagen — DEELS

- `support_tickets` + `support_ticket_messages` (helpdesk-engine, humanSendRequired voor gevoelige onderwerpen); `parent_messages`/`parent_reports`; club-communicatie via meldingen.
- Bijlagen: `attachmentUrl` + `attachmentConsent` op tickets; materiaal-/voeding-/fietsscanfoto's via object storage met owner-checked serve (memory: materiaalcoach, Input Center ACL-timing).
- **AFWEZIG:** virusscan, centrale bestandstypecontrole, retentiecategorie, checksum-duplicaatherkenning (zoekactie "virus", "scan_status", "checksum" in schema: alleen bike_scan-domein).

## 11. Documentopslag — VERSPREID, GEEN CENTRALE `file`-LAAG

- Object storage-paden in JSONB (`nutrition_hydration_logs.photo_paths`, `material_analyses.photo_paths`), eigen tabellen (`bike_scan_frames`, `document_analyses`), juridische teksten als Markdown in DB (`legal_documents.bodyMd`). Elke module heeft de facto zijn eigen uploadpad (PD-4 bestaat niet).

## 12. Notificatielaag — AANWEZIG, dicht bij PD-5

- Centrale `notifications`-tabel (lib/db/src/schema/notifications.ts): audience (athlete/coach/parent/club), categorieën (veiligheid/privacy/…), `readAt` én `resolvedAt` + `resolutionKey` (≈ handled), kritieke meldingen niet uitschakelbaar; reminder-levering idempotent (dedupeKey+sentAt), daily fold, stille web-push-regels (memory: reminders & meldingen).
- **Gat t.o.v. PD-5:** geen `active_role`+organisatie/team-context op de melding, geen bundeling/stilte-uren als expliciet model, geen tien-soorten-taxonomie, `safe_preview` niet als apart veld (pushtekst-discipline bestaat wel als conventie).

## 13. Contacten/relaties — GEEN CENTRALE LAAG (PD-3 afwezig)

- Losse personenlijsten: `friend_links`, `follow_links`, `club_members`, `club_team_members`, `club_group_members`, `emergency_contacts`, `parent_athlete_links`, `coach_athlete_links`, coachingsprofielen. Geen `contact`-record per identiteit, geen relatietypen-register, geen duplicaatherkenning.

## 14. Plekken waar rechten client-side (mede) worden bepaald

Server-side is leidend op data (clerkId-scoping is doctrine, zie cross-account-tests), maar UI-rechten leunen op client-rolwaarden:
- bottom-nav.tsx:51-52 (nav-set per rol), main-menu.tsx:208, club.tsx:252-253 (`canManage` uit client-dashboardobject), club-beheer.tsx:1317, meer.tsx:32, screen-shell.tsx:105-107, commercial-shell.tsx:134-136.
- Risico is beperkt tot zichtbaarheid (endpoints checken zelf), maar BB-vereiste "onbevoegd = onzichtbaar, óók niet uitgegrijsd" is nergens als contract getest.

## 15. Bestaande fundamenten die F1+ MOETEN hergebruiken

- Clubrechtenlaag `CLUB_RECHTEN_01` (club-permissions, least-privilege, memory: clubomgeving) — uitbreiden, nooit dupliceren.
- AccountGate (elke ingelogde surface, memory: account-readiness), Clerk-auth met rollen in eigen DB, entitlements-laag (AND met flags), ouderomgeving-rechtenlaag (één laag voor alle ouder-routes), sharing-levels coach/parent, e2e-harness + governor-fixtures voor roltesten.
