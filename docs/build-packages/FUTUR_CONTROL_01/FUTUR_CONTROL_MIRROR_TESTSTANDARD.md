# FUTUR_CONTROL_MIRROR_TESTSTANDARD

> **Vaste werkinstructie:** `docs/product/MIRROR_WERKWIJZE_01.md` (MW-01 t/m MW-20) geldt
> automatisch mee bij elke Mirror-opdracht: rapporteer herstelpunten aan Replit,
> samenhangvragen aan Claude, René krijgt per pakket één regel in gewone taal;
> nooit stilstaan, niets zelf oplossen.
>
> **Vast contextblok (02-08-2026 — geldt voor elke Mirror-toets)**
> Lees vóór het toetsen eerst `docs/besluiten/BESLUITEN_VOOR_REPLIT_2026-08-02.md` en
> `docs/besluiten/BOUWSTRAAT_2026-08-02.md`. Daarin staat wat als productbesluit vastligt
> en waar het te toetsen onderdeel in de bouwvolgorde zit.
>
> **Deze stukken zijn context, geen bewijs.** Ze vertellen wat de bedoeling en de prioriteit
> is — ze zeggen niets over wat er werkelijk gebouwd is. Wat Mirror toetst, stelt Mirror
> zelf vast op een vaste SHA. Wijkt de werkelijkheid af van een besluit, dan is dat een
> **bevinding**, geen aanleiding om het besluit aan te passen.
>
> Komt Mirror iets tegen dat buiten de opdracht valt maar wél een besluit raakt, dan meldt
> Mirror dat apart onder **"Signalen buiten scope"** — Mirror lost het niet zelf op.


**Regelcodes:** `FCM-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Onafhankelijke toetsing van Futur Control. Infrastructuur wordt getoetst met `FUTUR_CONTROL_INFRASTRUCTURE_MIRROR_TESTSTANDARD.md`.

---

## 1. Toetsprincipes

| Code | Principe |
|---|---|
| FCM-01 | Mirror toetst uitsluitend op een **vaste gepushte SHA**. Een mondelinge of geschreven bewering van de bouwer is geen bewijs. |
| FCM-02 | Mirror neemt niets over: elke bevinding berust op eigen waarneming, met de handeling erbij zodat zij herhaalbaar is. |
| FCM-03 | Mirror toetst **gedrag**, niet code-esthetiek. |
| FCM-04 | Rechten worden getoetst door ze te **overtreden**. Een geweigerde poging is het bewijs; een verborgen knop is dat niet. |
| FCM-05 | Een fase zonder Mirror-bewijs is `BUILT_UNPROVEN` en geeft geen doorgang. |
| FCM-06 | Bij twijfel keurt Mirror af. Het is goedkoper om een fase te herbewijzen dan om vals groen te ontdekken tijdens een storing. |

## 2. Toetsomgeving

**FCM-07:** toetsing gebeurt in een omgeving die aantoonbaar gescheiden is van productie, met eigen secrets en eigen connectordoelen.
**FCM-08:** Mirror gebruikt een eigen identiteit met precies de rechten van de rol die getoetst wordt — nooit de identiteit van de eindverantwoordelijke.
**FCM-09:** een toets die echte gebruikersdata zou raken wordt niet uitgevoerd maar als **niet toetsbaar** gerapporteerd, met reden.

## 3. Algemene toetsdimensies

Van toepassing op elke fase, tenzij de fase het onderwerp niet raakt.

| Code | Dimensie | Wat Mirror doet |
|---|---|---|
| FCM-10 | Geen tweede architectuur | Controleert dat wat herbruikbaar was is hergebruikt en dat elk nieuw onderdeel als onvermijdelijk in de hergebruikmatrix staat |
| FCM-11 | Geen vals groen | Knijpt bronnen af, laat houdbaarheid verlopen, en zoekt elk pad waarop ontbrekende data `Gezond` wordt |
| FCM-12 | Geen schatting | Zoekt benaderingen, voorlopige getallen, indicatieve waarden en handmatige invoer in velden die als gemeten worden gepresenteerd |
| FCM-13 | Server-side rechten | Overtreedt elke verboden handeling per identiteit en controleert weigering plus auditregel |
| FCM-14 | Auditdekking | Voert een handeling uit en zoekt haar terug; probeert update en delete op auditrecords |
| FCM-15 | Geen mockdata | Zoekt fictieve producten, incidenten, gebruikers en verzonnen aantallen |
| FCM-16 | Scope | Controleert dat de diff niets buiten de fase bevat |
| FCM-17 | Bronherleidbaarheid | Volgt vijf willekeurige getoonde waarden tot hun bron |
| FCM-18 | Isolatie | Zet een product uit en controleert dat Control blijft werken; zet Control uit en controleert dat het product blijft werken |
| FCM-19 | Geen totaalcijfer | Zoekt in UI én API-antwoorden naar samengestelde scores op elk niveau |
| FCM-20 | Fail-closed | Maakt een bron onleesbaar en controleert dat er geen rechten of zekerheid bij komen |
| FCM-21 | Degradatie zichtbaar | Controleert dat `degraded:true` zichtbaar is voor beheer én support, niet alleen in een log |
| FCM-22 | Geen secret zichtbaar | Doorzoekt schermen, logs, exports, rapporten, notificaties en nooddocumentatie |
| FCM-23 | Onbekend versus leeg | Controleert dat *er is niets* en *we weten het niet* zichtbaar verschillen |
| FCM-24 | Kennisherkomst | Controleert dat elk kennisitem terugvoert op een echte gesloten zaak en elk agentvoorstel zijn bronnen noemt |
| FCM-25 | Noodstop | Test vanaf minstens drie schermen, tijdens een lopende agenttaak, op elk aangesloten product en op de lokale runtime |
| FCM-26 | Contractnaleving | Laat een connector meer opvragen dan zijn contract en controleert weigering; verwijdert de contractversie en controleert weigering |
| FCM-27 | Overdraagbaarheid | Zoekt persoonsafhankelijke configuratie en secrets in documentatie |

| FCM-30 | Read-only naar buiten | Zoekt naar elk technisch aanwezig schrijf-, deploy-, herstart-, configuratie-, commando- of rechtenpad richting product, dienst of infrastructuur — inclusief ongebruikte schrijfscopes. Aanwezig zonder vrijgave = afkeur, ook als het niet gebruikt wordt |
| FCM-31 | Ketentoets | Voor het vrijgeven van een externe muterende functie gelden aanvullend `MUT-07..15`. Dit is een **zwaardere** toets dan de gewone fasetoets en wordt niet erdoor vervangen |
| FCM-32 | Intern versus extern | Controleert dat interne mutaties (incidentstatus, notities, kennisitemversies, supportconcepten, goedkeuringen, blokkades) werken, en dat geen enkele daarvan een waarneembaar effect buiten Control veroorzaakt |

## 4. Fasegerichte toetsen

Per fase gelden de scenario's en afkeurgronden in `FUTUR_CONTROL_BUILD_ROADMAP.md`, Deel 1. Mirror voegt daar per fase minstens één **eigen** scenario aan toe dat niet in het bouwpakket staat, zodat er niet uitsluitend naar de eigen huiswerkopgave wordt gekeken.

## 5. Directe afkeurgronden

Bij één van deze waarnemingen keurt Mirror af zonder weging:

1. Ontbrekende, verouderde of onbereikbare data verschijnt als `Gezond`.
2. Een schatting, benadering of handmatige waarde staat in een veld dat als gemeten wordt gepresenteerd.
3. Een verboden handeling slaagt, of wordt alleen in de interface geblokkeerd.
4. Een auditrecord kan worden gewijzigd of verwijderd.
5. Een handeling laat geen auditspoor na.
6. Een secret is zichtbaar in enig scherm, log, export, rapport of document.
7. Een connector schrijft naar een product of levert data buiten zijn contract.
8. De noodstop is onbereikbaar, traag, of door een agent te beïnvloeden.
9. Een agent voert iets uit, of wijzigt een kennisitem zonder versie, auteur, datum en audit.
10. Er bestaat een samengesteld totaalcijfer.
11. `RENE_APPROVED` kan door een andere identiteit worden gegeven, of een deploy lukt zonder.
12. Fail-open: een onleesbare bron leidt tot ruimere rechten of tot doorgang.
13. Een betalende gebruiker valt door degradatie stil terug naar Gratis.
14. Mockdata, fictieve producten of verzonnen aantallen in een scherm dat als echt wordt gepresenteerd.
15. Mobiel is een responsive kopie van de desktop, of een handeling komt offline in een wachtrij.
16. Break-glass geeft vrijgave- of deployrecht, of meldt en logt niet.
17. Livebewijs zonder aantoonbare koppeling tussen draaiende omgeving en bekende SHA.
18. Test- en liveobjecten raken vermengd bij betalingen.
19. Een muterend pad richting product, dienst of infrastructuur bestaat technisch zonder dat de vrijgavepoort voor die functie is doorlopen — inclusief een ongebruikte schrijfscope.
20. Bij een ketentoets: een van de twaalf onderdelen ontbreekt, of bewijs is samengevoegd uit verschillende SHA's of omgevingen.
21. De basisversie veroorzaakt enig waarneembaar effect in een aangesloten product, op infrastructuur of bij een externe dienst.
22. Een functionele Control-handeling is mogelijk vóór `F1B MIRROR_PROVEN`.

## 6. Afkeurgronden na weging

Deze leiden tot afkeur tenzij René ze expliciet als restpunt accepteert:

trage schermen zonder eerste bruikbare interactie · ontbrekende trend bij een indicator met historie · een kaart zonder auditlink · een controle zonder vastgelegde houdbaarheid · een dienst zonder risicoklasse · een register zonder herkomst per veld · een incident zonder impactketen · een conceptkennisitem dat structureel leeg blijft · een connector op een lager niveau dan geclaimd · ontbrekend bewijs van een geslaagde hersteltest · een scenario zonder benoemde herstelstappen · onduidelijke of vage foutmeldingen richting de beheerder.

## 7. Bevindingssjabloon

```
Bevinding <nummer>
Fase:            F<n>
Dimensie:        FCM-<nn> of directe afkeurgrond <n>
Scenario:        wat is gedaan, stap voor stap
Waarneming:      wat gebeurde er werkelijk
Verwacht:        wat had moeten gebeuren
Bewijs:          SHA, tijdstip, scherm of respons
Ernst:           blokkerend / herstel vóór volgende fase / restpunt
Reikwijdte:      lokaal in deze fase / raakt eerdere fase / raakt product
```

## 8. De poort

**FCM-28:** Mirror sluit elke fase af met precies één uitkomst: `MIRROR_PROVEN` · `PARTIAL` (met genummerde restpunten) · `AFGEKEURD`. Er bestaat geen tussenoordeel en geen voorwaardelijke goedkeuring.
**FCM-29:** `MIRROR_PROVEN` betekent uitsluitend dat het getoetste gedrag klopt op die SHA. Het is geen productgoedkeuring; die blijft `RENE_APPROVED`.
