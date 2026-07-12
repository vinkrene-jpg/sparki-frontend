# Sparki — Huidige informatiearchitectuur

Datum: 12 juli 2026. Bron: `artifacts/sparki/src/App.tsx` (routes, geverifieerd), `components/sparki/bottom-nav.tsx`, `components/sparki/screen-shell.tsx`, explorer-inventarisatie. Onzekerheden: zie `AUDIT_UNCERTAINTIES.md`.

## 1. Primaire navigatie

### Onderbalk (renner) — `bottom-nav.tsx`
1. **VANDAAG** → `/`
2. **ACTIVITEITEN** → `/activiteiten`
3. **ONTDEKKEN** → `/feed`
4. **TRAINEN** → `/train`
5. **JIJ** → `/you`

### Header (ScreenShell) — `screen-shell.tsx`
- **SPARKI-merk** (elke pagina) → opent chat-overlay (portal)
- **Samen-knop** → `/samen`
- **Wereld-knop** → `/wereld`
- **Notificatiebel** (dag-gevouwen)
- **Feedback-knop** → feedback-sheet
- **Rolwisselaar** (alleen bij meerdere rollen) + uitloggen

⚠ Spanning: de nav-labels (VANDAAG/ACTIVITEITEN/ONTDEKKEN/TRAINEN/JIJ) wijken af van de ScreenShell-schermtitels (VANDAAG/TRAINING/RACES/NIEUWS/INZICHT/PROFIEL/SAMEN/WERELD/KENNIS). "ONTDEKKEN" heet op de pagina zelf "NIEUWS"; "JIJ" heet "PROFIEL". Twee vocabulaires door elkaar.

## 2. Volledige routekaart (App.tsx, geverifieerd)

```
/                          HomeRedirect
├── uitgelogd              → LandingPage (pages/landing.tsx)
└── ingelogd (AccountGate) → onboarding? → OnboardingV2
                           → head-tester eerste keer → /welkom-tester
                           → RoleHome:
                              athlete → DayHome
                              coach   → CoachHome
                              parent  → ParentHome
/sign-in/*?                SignInPage            (publiek)
/sign-up/*?                SignUpPage            (publiek)
/train                     TrainPage             (beschermd)
/feed                      FeedPage              (beschermd)
/lab                       LabPage               (beschermd)   ← geen nav-ingang ⚠
/activiteiten              ActiviteitenPage      (beschermd)
/core                      CorePlaygroundPage    (beschermd)   ← geen nav-ingang (prototype)
/photo-lab                 PhotoLabPage          (beschermd)   ← geen nav-ingang (experiment)
/you                       YouPage               (beschermd)
/geluid                    GeluidPage            (beschermd)   ← geen nav-ingang ⚠
/races                     RacesPage             (beschermd)
/wedstrijd-room            WedstrijdRoomPage     (beschermd)
/samen                     SamenPage             (beschermd, header-knop)
/wereld                    WereldPage            (beschermd, header-knop)
/wereld/athlete/:slug      WereldPage (detail)   (beschermd)
/kennis                    KnowledgePage         (beschermd + flag knowledge_base)
/admin                     AdminPage             (beschermd + admin)
/admin/health/:checkKey    AdminHealthDetailPage (beschermd + admin)
/invitations               InvitationsPage       (beschermd; coach/ouder)
/tester-qr                 TesterQrPage          (beschermd; tester-tool)
/welkom-tester             TesterWelcomePage     (beschermd; head-tester eenmalig)
/coach/athletes/:athleteId/plan  CoachAthletePlanPage (beschermd; coach + link)
/invite/:token             InviteRoute           (overleeft sign-in via redirect_url)
(overig)                   NotFound
```

## 3. Schermen per rol

### Renner (athlete)
| Scherm | Bereik | Ingang |
|---|---|---|
| Vandaag (DayHome, dag-type-engine) | direct | nav VANDAAG |
| Training (vier lagen + 3-wekenplan) | direct | nav TRAINEN |
| Activiteiten (+ sessie-drawer, import) | direct | nav ACTIVITEITEN |
| Nieuws/Ontdekken (+ renners-reel) | direct | nav ONTDEKKEN |
| Jij/Profiel (Core, kompas, doelen, instellingen-sheet) | direct | nav JIJ |
| Races (+ kalender-import, race-intel, documentanalyse) | header "RACES"-context via ?focus/links ⚠ geen vast nav-item | via home/links |
| Samen | direct | header-knop |
| Wereld | direct | header-knop |
| Kennis | flag-gated | ⚠ ingang alleen zichtbaar met flag |
| Inzicht (/lab) | routebaar | geverifieerd: geen ingang (enige link vanuit verborgen /core) |
| Voeding | sheet | update-sectie home / `?focus=nutrition` |
| Chat (Vraag Sparki) | overlay | SPARKI-merk header |
| Wedstrijd-room | route | vanuit race-context |
| Geluid | route | via `/you` (geverifieerd) |

### Coach
- Home = roster (`coach-home.tsx`) → renner-detail → plan (`/coach/athletes/:id/plan`, adoptie).
- `/invitations` voor koppelingen. Nieuws/Samen gedeeld.

### Ouder
- Home = welzijnsweergave (`parent-home.tsx`), bewust beperkt (safety_only/summary).
- `/feed` nieuws; `/invitations`.

### Admin
- `/admin` (gezondheidscheck, geplande taken, testers, flags) → `/admin/health/:checkKey` detail.

### Head-tester / tester
- `/welkom-tester` (eenmalig), `/tester-qr`, vroege-toegang-flags.

## 4. Hoe bereikt een gebruiker elk scherm

- **1 tik:** Vandaag, Activiteiten, Ontdekken, Trainen, Jij (onderbalk); Samen, Wereld, chat, bel, feedback (header).
- **2+ tikken / indirect:** Voeding (home-update-sectie), Races (vanuit home-kaarten/links), werkout-/sessie-details (drawers), instellingen (sheet op /you), Kennis (flag), coach-plan (roster → renner → plan).
- **Alleen via directe URL (geen ingang):** `/core`, `/photo-lab` en `/lab` (geverifieerd). `/geluid` bleek wél bereikbaar via `/you`.

## 5. Schermen zonder duidelijke ingang

| Route | Situatie |
|---|---|
| `/lab` (INZICHT) | **Bevestigd onbereikbaar voor normale gebruikers** (grep): de enige interne link komt uit `/core` — zelf een verborgen prototype. Alles wat alleen op /lab leeft (o.a. mentale-veerkracht-kaart) is daarmee effectief verborgen. |
| `/geluid` | Bereikbaar: gelinkt vanuit `/you` (geverifieerd) — geen weesroute. |
| `/core` | Bewust prototype (Core Playground) — geen ingang, correct. |
| `/photo-lab` | Experiment — geen ingang. |
| `/wedstrijd-room` | Alleen contextueel vanuit race; zonder actieve race geen ingang. |
| `GET /api/races/:id/evaluation` | Backend-functie zonder UI-hook (weesfunctie). |

## 6. Functies die op meerdere plaatsen voorkomen

1. **Geplande training van vandaag:** home (StateCard/dagbeeld) + `/train` L3 + werkout-drawer.
2. **Observaties/inzichten:** home-kaart "Wat valt op" + `/lab` + `/you` (lenzen/patronen). Dedupe bestaat op presentatieniveau, maar drie bestemmingen.
3. **Ontwikkeling:** ontwikkelprioriteit-kaart (home) + trainingsverloop (/train) + ontwikkelkompas (/you).
4. **Virtuele renners:** `/wereld` + renners-reel in `/feed`.
5. **Nieuws/kennis/intel:** `/feed`, `/kennis`, intel-module.
6. **Koppelingen:** onboarding connect-stap + `/you?focus=connections` (bewust: één registratie, twee ingangen).

## 7. Interne producttermen in de interface

- **"INZICHT"** en **"Lab"** (routenaam `/lab`) — Engels routewoord, NL label; route zichtbaar in URL.
- **"Core"** ("Sparki Core") — merkterm, voor jeugd mogelijk abstract (geaccepteerde uitzondering in `dutch-copy-exceptions`).
- Rol-labels in de rolwisselaar zijn Nederlands ("Coach", "Ouder") — eerdere melding van Engelse labels is bij verificatie weerlegd.
- Eerdere melding van "Syncing…"/"Error" in `day-detail-drawer.tsx` is bij verificatie weerlegd (geen treffers).
- URL-slugs Engels (`/train`, `/feed`, `/lab`, `/you`) naast NL-slugs (`/activiteiten`, `/wereld`, `/kennis`, `/geluid`, `/samen`) — inconsistent maar intern toegestaan.

## 8. Pagina's die veel doelen tegelijk bedienen

| Pagina | Doelen tegelijk |
|---|---|
| **Vandaag (/)** | toestand, check-in, coachanalyse, coachbeslissing, follow-up, weer, zelf-invoer (training/voeding/gezondheid), materiaal-nudge, ontwikkelprioriteit, leskaart, nudges. Zwaarst belaste scherm — concurrentie om aandacht. |
| **/you (JIJ/PROFIEL)** | levend profiel, ontwikkelkompas, doelen, geheugenbeheer, privacy, koppelingen, instellingen, herinneringen. |
| **/train** | vier lagen + 3-wekenplan + routeplanner (flag) + progressie. |
| **/admin** | gezondheid, geplande taken, testers, flags, QR. (Acceptabel: beheerdersdoelgroep.) |

## 9. Hiërarchische schermkaart (renner)

```
ONDERBALK
├─ VANDAAG (/)
│  ├─ Check-in (inline)
│  ├─ Sparki Core → drill-in "volledige analyse" (TrainingDayHome)
│  │  └─ WorkoutDetailDrawer → Kern-voorspelling
│  ├─ Coachbeslissing / Wat valt op → TieredExplanation "Uitgebreid"
│  ├─ Update-sectie → AddTraining | Voeding-sheet | Gezondheidsstatus
│  ├─ Materiaalcoach-nudge → materiaalflow
│  └─ Leskaart van de dag
├─ ACTIVITEITEN (/activiteiten)
│  ├─ ActivityImportPanel (upload + koppelen)
│  └─ ActivityCard → SessionDetailDrawer (analyse)
├─ ONTDEKKEN (/feed)
│  ├─ Nieuwsitems → in-app lezer
│  └─ Renners-reel (Wereld)
├─ TRAINEN (/train)
│  ├─ L1 bron / L2 doel / L3 vandaag / L4 patronen
│  ├─ 3-wekenplan → DayDetailDrawer → feedback → aanpassingsvoorstel
│  ├─ Routeplanner (flag)
│  └─ Trainingsverloop
└─ JIJ (/you)
   ├─ Sparki Core-profiel (lenzen, identiteit, evolutie)
   ├─ Ontwikkelkompas (?focus=ontwikkelkompas)
   ├─ Doelen-werkblad (?focus=doelen)
   └─ Instellingen-sheet (?focus=ftp|weeklyHours|weight|sportProfile|goal|checkin|connections)
      ├─ FTP-wizard
      ├─ Koppelingen (Strava)
      ├─ Privacy & deelniveaus
      └─ Herinneringen

HEADER
├─ SPARKI → chat-overlay (+ Input Center)
├─ SAMEN (/samen)
├─ WERELD (/wereld → /wereld/athlete/:slug)
├─ Bel (dag-gevouwen notificaties)
└─ Feedback-sheet

CONTEXTUEEL / ZONDER VASTE INGANG
├─ /races → kalender-import, race-intel, documentanalyse → /wedstrijd-room
├─ /kennis (flag) → intel "Voor jou"
├─ /lab (INZICHT) — bevestigd zonder ingang (weesscherm)
├─ /geluid — via /you
├─ /core, /photo-lab (prototypes, bewust zonder ingang)
└─ /invite/:token, /tester-qr, /welkom-tester (flows)
```
