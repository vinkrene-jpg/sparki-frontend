# MEDIA_UITLEG_01 — F0 OPEN AFHANKELIJKHEDEN (stand na inventarisatie)

**Fase:** `MEDIA_UITLEG_01_F0` · **Datum:** 2026-08-01
Bron: deel 18 van het pakket; hieronder de F0-stand per punt. F0 beslist niets — het stelt alleen vast.

| Punt | Stand na F0 | Toelichting |
|---|---|---|
| O-1 Contentmodel KENNIS_01 | **OPEN — blokkeert F6, F8** | `knowledge_items` bestaat maar mist vrijwel alle blokkerende contractvelden (zie inventarisatie §7); eigenaar KENNIS_01 |
| O-2 Bevoegde inhoudelijke beoordelaar | **OPEN — blokkeert F6** | geen kandidaat in de repo aangetroffen; besluit René |
| O-3 Rechtenvrij testasset F3 | **OPEN — blokkeert F3 volledig** | geen rechtenregistratie of testasset aanwezig; eigenaar René |
| O-3b Mediabron + rechten echte inhoud | **OPEN — blokkeert elke echte publicatie** | geen bron vastgesteld; geen rights/licentiemodel in schema's |
| O-4 Echte adviesgrond coachmelding | **VERVULD (vastgesteld in F0)** | deterministische coachlaag `decideCoach` + `CoachAnalysisCard` levert reden/data/onzekerheid; F7 mag bouwen zodra vrijgegeven, zonder demo-advies |
| O-5 Academy-locatie | **GESLOTEN (was al besloten)** | technische route vastgesteld: Meer-menu-chapter (`src/lib/core-meer.ts`) → Hulp & ondersteuning (`pages/support.tsx`); herbruikbare Help-code aanwezig (artikelen, zoek, hooks) |
| O-6 Schermversiebepaling | **OPEN — blokkeert F5** | alleen app-brede `version.json`; per-scherm/per-uitlegdoel versie ontbreekt; F0-input geleverd (registry-veld als kleinste oplossing), ontwerpkeuze in F5-vrijgave |
| O-7 Beeldmerk/vormtaal | **OPEN, niet blokkerend** | BRAND_IDENTITY_01 blijft DEFERRED; CMP-40-gedrag ligt vast |
| O-8 Mobiele data | **GESLOTEN (besluit lag vast)** | technisch: per-apparaat toestemming = client-side opslag + serverbevestiging; geen bestaand prefetch-mechanisme dat uitgezet moet worden (geen autoplay/prefetch aangetroffen) |
| O-9 Bewaartermijnen | **OPEN, blokkeert alleen betaalde publieke release** | verwijzing naar bestaand bewaarbeleid; zes termijnen bij jurist/accountant |
| O-10 Pilotset oefeningen | **OPEN** | idee vastgelegd, geen inhoudsopdracht |
| O-11 Favorieten in Academy | **VERVULD — mag gebouwd worden** | favorietenpatroon bestaat aantoonbaar (route-`favorite` in `route-library.tsx`/`use-routes.ts`; intel-`saved` in `intel-reader.tsx`) |
| O-12 Beheeromgeving | **OPEN** | geen beheeromgeving voor gedeelde media aangetroffen (alleen persoonlijke uploads, owner-gated); of de schermen in dit pakket of apart komen = besluit René bij F8-vrijgave |
| O-13 Referentietoestellen + meetmiddelen | **OPEN — blokkeert F10-metingen** | fysieke iPhone/Android moeten door René worden aangewezen; aanwezige meetmiddelen zijn beperkt (alleen `performance.now()`); meetvoorstel in inventarisatie §11 |

**Samenvatting:** F1, F2 en F4 kunnen zonder open punten starten (na vrijgave). F3 wacht op O-3; F5 op O-6-ontwerpkeuze; F6 op O-1/O-2; F7 is vrij van inhoudelijke blokkade (O-4 vervuld); F8 wacht op O-1 voor inhoud maar niet voor de omgeving zelf; F10 wacht op O-13.
