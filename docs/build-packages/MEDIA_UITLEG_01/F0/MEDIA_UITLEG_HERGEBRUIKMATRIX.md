# MEDIA_UITLEG_01 — F0 HERGEBRUIKMATRIX

**Fase:** `MEDIA_UITLEG_01_F0` · **Datum:** 2026-08-01
Besluitregel: HERGEBRUIKEN waar het bestaat en past · UITBREIDEN waar de kern bestaat maar velden/gedrag ontbreken · NIEUW alleen waar niets bestaat. Geen tweede architectuur.

| Gebied | Besluit | Basis | Reden |
|---|---|---|---|
| Animatielaag (F1) | **UITBREIDEN** | CSS-transities/keyframes in `index.css` + reeds geïnstalleerde `framer-motion` | CSS-conventie is de bestaande praktijk; framer-motion is al een dependency met eigen chunk maar ongebruikt — F1 kiest definitief (voorkeur: CSS + kleine util, framer-motion alleen indien aantoonbaar nodig; géén nieuwe bibliotheek, geen 3D) |
| Reduced-motion-detectie | **HERGEBRUIKEN** | `@media (prefers-reduced-motion)` app-breed vangnet (`index.css` r276–295) + `matchMedia`-patroon | bestaat en is getest (`reduced-motion.test.ts`) |
| Sparki-instelling "Verminder beweging" | **NIEUW (klein)** | voorkeurpatroon van `audio_preferences`/`nav_settings` (`lib/db/src/schema/`) | server-side voorkeur ontbreekt; zelfde één-rij-per-gebruiker-patroon hergebruiken, geen nieuw voorkeurensysteem |
| Kaartcomponent (CMP-40) | **UITBREIDEN** | `DsCard` (`components/ds/card.tsx`) | pakket eist expliciet uitbreiden van de bestaande kaart; tilt/diepte bestaat nog nergens |
| "Training voltooid"-moment | **HERGEBRUIKEN** | `train/today-layer.tsx` ("SESSIE VOLTOOID") + afrondflow `core-plan.tsx` | bestaand, stabiel, hoge frequentie — pilotdoel F2 |
| Mediaspeler (CMP-41) | **NIEUW** | HTML5 `<video>` + `<track>` (ondertiteling), posterattribuut | geen herbruikbare speler aanwezig; bouwen op platformstandaard, niet op een externe playerbibliotheek |
| Ondertiteling | **NIEUW** | WebVTT via `<track>` | geen bestaande speler-ondertiteling; race-room-FFmpeg-overlay is server-side rendering, ongeschikt als speler |
| Media-opslag | **HERGEBRUIKEN** | GCS + presign-flow (`routes/storage.ts`, `lib/objectStorage.ts`, `lib/objectAcl.ts`) | volledig aanwezig incl. ACL-doctrine (ACL pas na bytes) |
| Contentmodel | **UITBREIDEN via KENNIS_01** | `knowledge_items` + kennisgovernance (publish=tx+snapshot) | eigenaar is KENNIS_01 (O-1); weergavelaag consumeert, bouwt géén parallelle contentdatabase |
| Gebruikersstatus (deel 3 §2) | **NIEUW (één tabel)** | patroon `mental_card_depths` (per-user per-content rij) | generieke content-statusrij ontbreekt; één tabel voor alle mediacontent, geen status per module |
| Uitlegflow-basis (CMP-42) | **HERGEBRUIKEN + UITBREIDEN** | uitleg-registry `lib/uitleg-content.ts` + `UitlegDot` + overlay-back-patroon | registry en niveaustructuur (Wat/Waarom/Hoe) bestaan; flow-status en versievastheid komen erbij |
| Academy-omgeving (F8) | **UITBREIDEN** | Hulp & ondersteuning (`pages/support.tsx`, chapter in `core-meer.ts`) + kennisleeslaag (`knowledge.tsx`/intel-reader) | vastgesteld besluit: onder Hulp & ondersteuning; support-artikelen + kennisreader leveren lijst/zoek/detail-patronen; geen zesde hoofditem, geen tweede helpomgeving |
| Zoeken in Academy | **HERGEBRUIKEN** | `GET /api/search` + `zoek-overlay.tsx` | app-brede zoek bestaat en indexeert al kennisitems |
| Favorieten/laatst bekeken | **HERGEBRUIKEN** | route-`favorite` + intel-`saved`-patroon | O-11 vervalt niet: patroon bestaat aantoonbaar |
| Coachmelding (CMP-44) | **UITBREIDEN** | `CoachAnalysisCard` + `decideCoach`/`CoachDecisionContext` | echte deterministische adviesgrond bestaat; CMP-44 is presentatie-uitbreiding (uitstellen/niet-meer-tonen), nooit een tweede coachlaag |
| Acute meldingen | **NIET AANRAKEN** | health-flow + val-alarm | blijven volledig in bestaande veiligheidslaag |
| Oefenkaart (CMP-43) | **NIEUW (weergave) + HERGEBRUIKEN (status)** | statuspatroon mentale kaarten; inhoud uit KENNIS_01 | fysieke oefenweergave bestaat niet; inhoudseigendom blijft bij KENNIS_01 |
| Entitlementcontrole | **HERGEBRUIKEN** | `lib/entitlements.ts` + `requireCommercialFeature` | verplicht: één rechtenlaag, server-side, fail-closed |
| Jeugd/toestemming | **HERGEBRUIKEN** | `lib/age.ts`, `isMinorOrUnknown`, `lib/parent-permissions.ts`, `consentGate` | fail-closed jeugdlaag bestaat volledig |
| Logging motionfouten | **HERGEBRUIKEN** | pino + bestaande clientlog-hooks | metadata-only, geen persoonlijke inhoud (AI-gateway-doctrine) |
| Mobiele-datatoestemming (O-8) | **NIEUW (klein)** | per-apparaat instelling; voorkeurpatroon | besluit ligt vast; per-apparaat betekent client-side opslag + serverbevestiging |

**Expliciet niet bouwen (bevestigd t.o.v. inventaris):** parallelle contentdatabase (KENNIS_01 bestaat) · tweede rechtenlaag (`lib/entitlements.ts` bestaat) · videobibliotheek per module · motion-engine per scherm · helpomgeving per functie (`/support` bestaat) · nieuwe MUX/CMP/PAT/MTS-codes · zware 3D-engine (bestaande three.js blijft beperkt tot bike-3d).
