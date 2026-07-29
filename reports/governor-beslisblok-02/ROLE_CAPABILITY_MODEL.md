# BESLISBLOK 02 — FASE 2: DEFINITIEF ROLLEN- EN BEVOEGDHEDENMODEL (VOORSTEL)

Datum: 29 juli 2026 · Machineleesbaar: `governance/role-capability-matrix-v1.json` · CSV: `ROLE_CAPABILITY_MATRIX.csv`.
Status: voorstel binnen het fundament; huidige schermen blijven CURRENT_STATE_NOT_APPROVED.

## Kernbesluit van het model: platformrollen + contextrollen, geen duplicatie

De code kent vandaag twee lagen die we tot één samenhangend model verheffen — zonder een tweede model te bouwen:

1. **Platformrollen** (`user_profiles.roles[]` + `active_role`): **athlete, coach, parent**. Deze bepalen identiteit, menu (chaptersForRole) en de basiswerkruimte. Dit blijft zo — géén nieuwe platformrollen.
2. **Contextrollen** (`club_members.role`, 12 waarden incl. `owner`, `admin`, `hoofdtrainer`, `trainer`, `teammanager`, `mechanieker`): bepalen wat iemand **binnen één organisatie/team/selectie** mag. Hoofdtrainer, clubbeheerder, ploegleider en mechanieker bestaan **uitsluitend als contextrol** — dit implementeert de regel "geen globale roltoegang wanneer contexttoegang voldoende is".

Mapping van de acht productrollen:

| Productrol | Platformrol | Contextrol | Status vandaag |
|---|---|---|---|
| Sporter | athlete | member (in club) | gebouwd |
| Trainer | coach | trainer (+ club_trainer_assignments) | gebouwd (1-op-1-links); clubscope gebouwd |
| Hoofdtrainer | coach | hoofdtrainer | contextrol bestaat; werkruimte ontbreekt |
| Ouder/verzorger | parent | parent | gebouwd, fail-closed |
| Clubbeheerder | (elke) | owner/admin | rechten gebouwd; eigen cockpit beperkt |
| Ploegleider/teammanager | (elke, meestal coach) | teammanager | contextrol bestaat; werkruimte ontbreekt |
| Mechanieker | (elke) | mechanieker | contextrol bestaat; werkruimte ontbreekt |
| Admin/testbeheer | — (SPARKI_ADMIN_IDS) | — | gebouwd |

## Bevoegdheden per rol (samenvatting; volledige matrix in JSON/CSV)

- **Sporter** — eigenaar van eigen sportdata; beslist over koppelingen en delen; ziet eigen training, analyse, herstel, materiaal en wedstrijden. Technisch: clerkId-filter op elke query (bewezen door cross-account-isolation-tests).
- **Trainer** — begeleidt toegewezen sporters (geaccepteerde link of club-toewijzing); maakt/past plannen aan (source="coach", nooit sessies); ziet alleen gedeelde gegevens (deleniveau none/summary/full); privénotities alleen voor zichzelf; géén clubbrede beheeracties.
- **Hoofdtrainer** — alles van trainer + beheert trainers/toewijzingen binnen de eigen organisatiecontext; bewaakt plankwaliteit; mag trainerwerk beoordelen en aanpassen maar **nooit stil overschrijven**: elke aanpassing van andermans trainerwerk schrijft een audittrail-regel (club_audit_log) met oud/nieuw. Geen extra inzage in medische/privédata boven het deleniveau.
- **Ouder/verzorger** — ziet alleen wettelijk + expliciet gedeelde jeugdgegevens (EffectiveParentAccess op leesmoment); geen automatisch volledig dossier; consent en leeftijd fail-closed (onbekend = veiligheidsminimum, 18+ = alles dicht); jonge sporter houdt passende eigen regie.
- **Clubbeheerder** — beheert club, leden, groepen, rollen en uitnodigingen (met ledenlimieten óók bij accept); ziet operationele clubgegevens; krijgt **niet** automatisch trainings-/gezondheidsdata (alleen via expliciete consent-scope); koppelt trainers, hoofdtrainers, ploegleiders en mechaniekers.
- **Ploegleider/teammanager** — werkt binnen toegewezen team/selectie: wedstrijdplanning, logistiek, aanwezigheid, live koerscontext, volgauto. Live locatie alleen met consent + hercheck per read; geen herstel-/medische details.
- **Mechanieker** — beheert toegewezen fietsen/materiaalprofielen/defecten/onderhoud; ziet materiaalstatus per renner/team; geen trainings-/herstel-/medische inhoud behalve functioneel noodzakelijke materiaalcontext. Km blijft afgeleid, nooit teller.
- **Admin/testbeheer** — technisch beheer, healthchecks, testrollen, audit; geen stil gebruik van persoonlijke data buiten expliciete supportflow (alles gelogd).

## Dwarsregels (gelden voor alle rollen)

1. **Intrekking is onmiddellijk:** endedAt / ingetrokken consent / verwijderd lidmaatschap sluit toegang op de eerstvolgende read (bewezen patroon: links-end/unlink-isolation).
2. **Multi-role = unie + strengste filter:** capabilities uit alle actieve contexten worden verenigd; consent-, jeugd- en deleniveauregels blijven per object gelden.
3. **Rolwissel ververst menu en API-toegang** (bestaande rolwissel-regressietest uit Beslisblok 01).
4. **Jeugd fail-closed** in élke context (coach, club, ploegleider, live locatie).
5. **Audit bij beheer- en inzage-acties** op andermans data (security_audit_log / club_audit_log).
6. **Organisatie-isolatie:** club A kan club B nooit lezen; alle checks club-scoped (getClubContext).

## Wat dit model expliciet NIET doet

- Geen nieuwe platformrollen (geen `validRoles`-uitbreiding nodig voor hoofdtrainer/ploegleider/mechanieker/clubbeheerder).
- Geen tweede rechtenlaag naast `club-permissions`/`sharing`/`parent-permissions` — het fundament formaliseert en test de bestaande laag.
- Geen wijziging aan bestaande 1-op-1 coach- en ouderlinks; clubcontext komt ernaast, met dezelfde consentregels.
