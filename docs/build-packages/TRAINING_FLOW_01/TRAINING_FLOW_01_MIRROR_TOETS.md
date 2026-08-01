# MIRROR-TOETS — TRAINING_FLOW_01

**Toetser:** Mirror · **Voorwaarde:** oplevering met eindcommit en bewijs

## Vooraf vaststellen
1. Vraag de **koppelregels** op: op welke velden wordt gematcht en onder welke drempel wordt bewust niet gekoppeld.
2. Noteer welke acute signalen server-side beschikbaar zijn (`2026-014`).
3. Bevestig dat bestaande plannen, sessies en koppelingen na migratie compleet zijn.

**Accounts nodig:** sporter met Compleet en echte activiteiten · sporter met Go · sporter met Gratis · sporter met gekoppelde trainer · trainer · sporter zonder enige data.

## Wat deze toets moet vaststellen
Of gepland en uitgevoerd **gescheiden blijven** en alleen worden gekoppeld wanneer dat terecht is — en of er nergens een getal verschijnt dat niet is gemeten.

## A. Ontwerp
1. Maak een training met blokken en herstelpauzes. 2. Maak er een zonder blokken: geldig. 3. Zet doelwaarden in vermogen, hartslag, RPE en cadans — alle vier mogelijk.

## B. Plannen
4. Plan in, verplaats, verwijder. 5. Verplaats **zonder slepen**, via het datumveld. 6. Koppel aan een route en aan een toestel.

## C. Koppelen — het zwaartepunt
7. Rijd of importeer een activiteit die duidelijk bij de geplande training hoort. Automatisch gekoppeld. 8. Maak een activiteit die er maar half op lijkt — andere dag, andere duur. **Niet** automatisch gekoppeld. 9. Koppel die handmatig. 10. Ontkoppel: gepland en uitgevoerd bestaan beide nog, volledig. 11. Controleer dat er nergens één samengevoegde rij is ontstaan.

## D. Gepland versus uitgevoerd
12. Bekijk het overzicht: verschillen per veld zichtbaar. 13. Een activiteit zonder vermogensmeting laat dat veld **leeg** — geen schatting. 14. De afwijking wordt getoond zonder oordeel: geen score, geen schuldtaal.

## E. Gemist en extra
15. Laat een training verlopen zonder uitvoering. Zichtbaar als gemist, met verplaatsen of afvinken. 16. Rijd een extra rit die niet gepland was. Telt mee in de historie, **niet** als afwijking van het plan.

## F. Feedback en privacy
17. Trainerfeedback zichtbaar voor sporter en trainer. 18. Markeer sporterfeedback als privé. De trainer ziet hem niet — controleer ook via directe API-aanroep.

## G. Acute signalen (besluit 2026-014)
19. Zet een ziekte- of pijnmelding, of forceer een veiligheidsblokkade op de route. De zware sessie wordt **niet ingepland**, met zichtbare reden. 20. Controleer dat er niets wordt verboden: de sporter kan alsnog rijden. 21. Controleer dat onderliggende medische details niet zichtbaar zijn voor wie daar geen recht op heeft.

## H. Rechten
22. Trainer plant binnen zijn bevoegdheid; buiten zijn bevoegdheid geweigerd. 23. Ouder en club zien alleen wat toegestaan is. 24. Herhaal 22 en 23 via **directe API-aanroepen**.

## I. Toestanden, meldingen, apparaten
25. Acht lege- en fouttoestanden zijn onderscheiden. 26. Notificaties zijn uit te zetten en bevatten geen aansporing of schuldgevoel — beoordeel de exacte tekst. 27. Mobiel biedt dezelfde handelingen, inclusief verplaatsen.

## J. Migratie en regressie
28. Bestaande plannen, sessies en koppelingen zijn compleet; bestaande koppelingen hebben herkomst `onbekend`, geen geraden waarde. 29. Bestaande plan-, uitvoerings- en belastingtests aanwezig en groen. 30. Mirror-bewezen onderdelen uit eerdere pakketten onaangetast.

## Afkeuringsgronden
Gepland en uitgevoerd samengevoegd tot één rij · een automatische koppeling bij onvoldoende zekerheid · ontkoppelen dat iets beschadigt · een geschatte waarde waar niet is gemeten · een afwijking die als oordeel of score wordt gepresenteerd · een gemiste training die verdwijnt · een extra rit die als planafwijking leest · privé feedback zichtbaar voor de trainer · een acuut signaal dat wordt genegeerd, of dat iets verbiedt · schuldtaal in een notificatie · een verloren plan of koppeling na migratie.

## Rapportvorm
Per scenario: verwacht, werkelijk, oordeel. Voeg het gepland-versus-uitgevoerd overzicht toe en het geval waarin bewust niet is gekoppeld. Eindoordeel: goedgekeurd of afgekeurd met concrete blokkade.

## Uitzonderingslijst voor herstel
Raakt een fix de koppelfunctie, de scheiding gepland/uitgevoerd, de acute-signaalcontrole of de migratie, dan wordt deze toets **volledig** hernomen. Anders: de betrokken rubriek plus rubriek J.
