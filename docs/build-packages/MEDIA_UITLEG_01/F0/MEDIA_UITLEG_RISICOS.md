# MEDIA_UITLEG_01 — F0 RISICO'S

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Fase:** `MEDIA_UITLEG_01_F0` · **Datum:** 2026-08-01

| # | Risico | Grond (inventaris) | Raakt | Beheersing |
|---|---|---|---|---|
| R-1 | Contentmodel bestaat niet — vertoningscontract (deel 3 §1) kan door niets worden gevoed | `knowledge_items` mist vrijwel alle blokkerende velden (rights, licentie, versie, leeftijd, ondertiteling, tekstalternatief) | F6, F8, elke echte publicatie | O-1 bij KENNIS_01 houden; weergavelaag bouwt tegen het contract en toont eerlijk "niet beschikbaar" (PAT-35) zolang velden ontbreken |
| R-2 | Geen mediarechtenregistratie in de repo | geen `rights_status`/licentiemodel in schema's | F3 t/m F9 | F3 start pas met één aantoonbaar rechtenvrij testasset (O-3); geen `PARTIAL`-doorgang |
| R-3 | framer-motion is geïnstalleerd maar ongebruikt — twee motionconventies dreigen | `package.json` r107 + chunk vs CSS-conventie | F1 | F1 kiest expliciet één laag en legt dat in het opleverrapport vast; de andere route wordt verboden per config, niet per afspraak |
| R-4 | PWA heeft geen offline/lage-bandbreedtefundament | `sw.js` = alleen push; geen `navigator.connection` | F3, F10 | lage-bandbreedtegedrag in de speler zelf afhandelen (poster + tekstvariant, afgebroken download); geen offline-belofte doen |
| R-5 | iOS-autoplay/energiebeperkingen niet eerder geraakt | geen bestaande speler | F3, F10 | geen autoplay (staat al in afkeurlijst); user-gesture-start; toets op fysieke iPhone (O-13) |
| R-6 | Schermversiebepaling ontbreekt — CMP-42 kan uitleg niet versievast blokkeren | alleen app-brede `version.json`; geen per-scherm versie | F5 | O-6: per-schermversie definiëren in F5-ontwerp (kleinst mogelijk: registry-veld per uitlegdoel), besluit-input uit F0 §5 |
| R-7 | Referentietoestellen/meetmiddelen niet vastgelegd | geen devicetelemetrie; toestellen onbekend | F10 | O-13 terug naar René vóór F10; meetvoorstel staat in inventarisatie §11 |
| R-8 | "Training voltooid" leunt op TodayLayer die shell-componenten niet mag dupliceren | today-layer/ScreenShell-doctrine (CoachAnalysisCard is shell-eigendom) | F2, F9 | CMP-40 als uitbreiding van `DsCard`, toegepast ín het bestaande voltooid-blok; coachmelding pas na F7 zelfstandig MIRROR_PROVEN |
| R-9 | Jeugdregels: `do_not_show_again` verboden voor minderjarigen (D-2) botst met generiek UI-gedrag | fail-closed jeugdlaag bestaat, maar niet gekoppeld aan meldingspresentatie | F4, F7 | statuslaag (F4) dwingt D-1/D-2 server-side af; UI toont de optie niet eens client-side |
| R-10 | Tweede helpomgeving sluipt erin via Academy | `/support` bestaat al met artikelen + AI-helpdesk | F8 | Academy als onderdeel binnen het bestaande Hulp & ondersteuning-chapter; support-artikelen en Academy-inhoud krijgen één vindbaarheid via bestaande `/api/search` |
| R-11 | Motionfoutlogging kan persoonlijke inhoud lekken | pino-logging bestaat, maar geen media-specifieke logdiscipline | F1+ | metadata-only loggen (contentId, event, foutcode) conform AI-gateway-logdoctrine |
| R-12 | Entitlement client-side nabouwen (directe herstelgrond) | UI heeft her en der flag-gedreven zichtbaarheid | F8 | alle Academy-entitlement via `requireCommercialFeature`-pad; UI verbergt nooit als vervanging van een servercheck |
