# TRAINING_FLOW_01 — TRAINING VAN ONTWERP TOT EVALUATIE

**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas na expliciete vrijgave door René.
**Grondslag:** `SPARKI-BESLUIT-2026-001` (autonomous_training = Compleet) · `SPARKI-BESLUIT-2026-014` (acuut versus niet-acuut)

## Doel
Een training werkt volledig van ontwerp tot evaluatie: maken, inplannen, verplaatsen, uitvoeren, automatisch koppelen aan de werkelijk gereden activiteit, en gepland naast uitgevoerd tonen met feedback van sporter en trainer.

## Scope
Training maken · inplannen · verplaatsen · verwijderen · trainingbouwer · vermogen, hartslag, RPE en cadans · blokken · herstelpauzes · buiten en indoor · koppelen aan route · koppelen aan toestel · uitvoeren · activiteit automatisch koppelen · handmatig koppelen · gepland versus uitgevoerd · afwijkingen · trainerfeedback · sporterfeedback · gemiste training · extra rit · kalender · notificaties.

## Buiten scope
Adaptieve aanpassing van het plan (`COACH_ADAPTIEF_01`) · wedstrijdvoorbereiding (`WEDSTRIJD_01`) · diepteanalyse en trends (`ANALYSE_01`) · voeding (`VOEDING_01`) · de activiteitenlevenscyclus zelf (`ACTIVITEITEN_01`) · periodisering en seizoensplanning.

## Bestaande bouwstenen — hergebruiken
| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Trainingsplan-engine | `artifacts/api-server/src/engines/training-plan/` | planopbouw |
| Planroutes | `routes/training-plan.ts` | bestaande plan-endpoints |
| Geplande trainingen | `lib/db/src/schema/athlete-training.ts` — `planned_workouts` met `routeId` (r147) en `bikeId` | koppeling training ↔ route ↔ fiets |
| Uitgevoerde sessies | idem — `training_sessions` met `source`, `sources`, `fieldSources`, `manualFields`, `mergeLog`, `externalRef`, `dedupeKey` | herkomst van de werkelijke rit |
| Koppellijst | `test:koppellijst-workouts` | bestaande koppeling gepland ↔ uitgevoerd |
| Levenscyclus en uitvoering | `test:plan-lifecycle`, `test:plan-execution`, `test:plan-details` | vertrekpunt |
| Feedback en aanpassing | `test:feedback-adjust`, `engines/observation/feedback.ts` | bestaande feedbacklus |
| Belasting | `test:athlete-load`, `test:derived-load` | belastingberekening |
| Kalender en notificaties | `routes/calendar.ts`, `routes/notifications.ts`, `test:notifications` | bestaande kalender en meldingen |
| Rechtenpoort | `COMPLEET_FEATURE_KEYS` bevat `autonomous_training` | trainingsplan is Compleet |

Geen tweede planmodel, geen tweede koppelmechanisme, geen tweede kalender.

## Productregels
1. **Zelf een training plannen zonder AI-plan** is basis gratis en volledig in Go. Het **adaptieve plan en de autonome AI-trainer** vallen onder Compleet (`autonomous_training`). Deze opdracht raakt die grens niet, maar respecteert hem overal.
2. Een geplande training en een uitgevoerde activiteit zijn twee verschillende dingen. Ze worden gekoppeld, nooit samengevoegd tot één rij.
3. Automatisch koppelen gebeurt op dag, duur en — indien aanwezig — route en toestel. Bij twijfel wordt **niet** gekoppeld: de gebruiker koppelt handmatig.
4. Een automatische koppeling is altijd terug te draaien, en dat ontkoppelen laat beide kanten intact.
5. Een gemiste training verdwijnt niet. Hij blijft zichtbaar als gemist, met de mogelijkheid tot verplaatsen of afvinken.
6. Een extra rit die niet gepland was, telt gewoon mee in de historie en wordt niet als afwijking van het plan gepresenteerd.
7. Afwijkingen tussen gepland en uitgevoerd worden **getoond, niet beoordeeld**. Geen schuldtaal, geen score.
8. Blokken en herstelpauzes zijn onderdeel van één training; een training zonder blokken is geldig.
9. Doelwaarden mogen in vermogen, hartslag, RPE of cadans staan. Ontbreekt de meting bij uitvoering, dan blijft dat veld leeg — **geen geschatte waarde**.
10. Acute signalen volgen `SPARKI-BESLUIT-2026-014`: bij ziekte, pijn, afwijkend rustpatroon of een veiligheidsblokkade op de route wordt een zware sessie **niet ingepland**, met zichtbare reden. Er wordt niets verboden.

## Frontend
Trainingbouwer met blokken en herstelpauzes, waarin doelwaarden per blok in vermogen, hartslag, RPE of cadans kunnen worden gezet. Kalenderweergave waarin gepland en uitgevoerd naast elkaar staan. Verplaatsen via slepen én via een datumveld — slepen mag nooit de enige weg zijn. Duidelijk onderscheid tussen gepland, uitgevoerd, gemist en extra. Op mobiel dezelfde handelingen, met verplaatsen via het datumveld.

## Backend
E�n server-side koppelfunctie die voor een activiteit de best passende geplande training zoekt en bij onvoldoende zekerheid niets koppelt. Eén functie die gepland en uitgevoerd naast elkaar zet met de verschillen per veld. Alle validatie server-side; de frontend rekent niet.

## Database
Additief op `planned_workouts` en `training_sessions`. Nodig: blokstructuur bij een geplande training, koppeling gepland ↔ uitgevoerd met herkomst (automatisch of handmatig) en tijdstip, en een status voor gemist. Bestaande plannen en sessies behouden alles.

## Rechten
Een sporter beheert zijn eigen trainingen. Een gekoppelde trainer plant en geeft feedback binnen de afgesproken bevoegdheid. Ouder en club zien alleen wat toegestaan is. Elke controle server-side; directe aanroep krijgt dezelfde weigering.

## Privacy
Trainerfeedback is zichtbaar voor sporter en trainer. Sporterfeedback die als privé is gemarkeerd blijft privé — ook voor de trainer. Gezondheidssignalen die tot een acute regel leiden worden getoond als reden, zonder onderliggende medische details te delen met wie daar geen recht op heeft.

## Communicatie
Notificaties bij: training ingepland door de trainer, training verplaatst, training gemist, feedback ontvangen. Rustig van toon, geen aansporing, geen schuldgevoel. Elke notificatie is uit te zetten.

## Fout- en lege toestanden
Onderscheiden: nog geen trainingen · geen plan actief · training gepland maar nog niet uitgevoerd · gemist · uitgevoerd zonder meting · koppeling onzeker · geen bevoegdheid · technische fout. Elk met een volgende stap en zonder verzonnen getal.

## Migratie
Bestaande plannen, sessies en koppelingen behouden alles. Bestaande koppelingen krijgen herkomst `onbekend` in plaats van een geraden waarde. Testen op verse database én op een kopie met bestaande data, met rij-aantallen vóór en ná.

## Tests
1. Training maken met blokken en herstelpauzes. 2. Training zonder blokken is geldig. 3. Doelwaarde in vermogen, hartslag, RPE en cadans — vier varianten. 4. Inplannen, verplaatsen en verwijderen. 5. Verplaatsen werkt zonder slepen. 6. Koppelen aan route en aan toestel. 7. Uitvoeren en automatisch koppelen bij duidelijke overeenkomst. 8. Geen automatische koppeling bij twijfel; handmatig koppelen werkt. 9. Ontkoppelen laat gepland en uitgevoerd beide intact. 10. Gepland naast uitgevoerd toont verschillen per veld. 11. Ontbrekende meting blijft leeg, geen schatting. 12. Gemiste training blijft zichtbaar als gemist. 13. Extra rit wordt niet als afwijking van het plan gepresenteerd. 14. Trainerfeedback zichtbaar voor sporter en trainer. 15. Privé sporterfeedback blijft privé, ook voor de trainer. 16. Acuut signaal → zware sessie niet ingepland, reden zichtbaar, niets verboden (`2026-014`). 17. Trainer plant binnen zijn bevoegdheid en niet daarbuiten. 18. Directe API-aanroep krijgt dezelfde weigering. 19. Acht lege- en fouttoestanden zijn onderscheiden. 20. Notificaties zijn uit te zetten en bevatten geen schuldtaal. 21. Migratie behoudt alle plannen, sessies en koppelingen. 22. Mobiel biedt dezelfde handelingen. 23. Geen mock-, seed-, demo- of fallbackdata als echte trainingsdata. 24. Bestaande plan- en belastingtests groen.

## Acceptatiecriteria
1. Een training gaat van ontwerp tot evaluatie zonder handmatig databasewerk. 2. Gepland en uitgevoerd blijven gescheiden en worden alleen gekoppeld. 3. Bij twijfel wordt niet gekoppeld. 4. Ontbrekende metingen blijven leeg. 5. Afwijkingen worden getoond, niet beoordeeld. 6. Acute signalen volgen `2026-014`. 7. Rechten houden in interface én API. 8. Migratie zonder verlies. 9. Alle tests groen, typecheck exit 0. 10. Geen tweede planmodel, koppelmechanisme of kalender.

## Bewijsformat
Per regel: commando, resultaat, exitcode. Verder: de koppelregels met de drempel waaronder niet wordt gekoppeld · een gepland-versus-uitgevoerd overzicht met verschillen per veld · een geval waarin bewust niet is gekoppeld · de weergave van een acuut signaal met reden · migratieuitvoer op verse database én kopie met rij-aantallen · schermafbeeldingen van de acht toestanden op desktop en mobiel · start- en eindcommit · gewijzigde bestanden.

## Stopcondities
- gepland en uitgevoerd zijn in de huidige structuur niet te koppelen zonder samen te voegen;
- de koppeldrempel vereist een productbesluit;
- acute signalen zijn niet betrouwbaar server-side beschikbaar;
- bestaande koppelingen kunnen niet worden behouden;
- een bestaande plan- of belastingtest wordt onhoudbaar.
