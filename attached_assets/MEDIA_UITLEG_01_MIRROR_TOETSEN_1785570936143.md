# MEDIA_UITLEG_01 — MIRROR-TOETSEN

**Deel 10 van 20**

---

## 0. Werkwijze

Mirror toetst per fase, op de vaste gepushte SHA van die fase, met een realistisch gevuld account. Een fase krijgt `MIRROR_PROVEN` of hij krijgt het niet.

**Vier toetsen gelden in élke fase** en worden hieronder niet herhaald: MTS-50 (animatie aan en uit) · MTS-51 (verminder beweging) · MTS-52 (geen functieverlies zonder animatie) · MTS-68 (verbruik en zwaarte).

**Statuswoorden:** `PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED`. Gebouwd zonder toets is `BUILT_UNPROVEN`.

**Bevinding zonder codes** (MTS + CMP/PAT/MUX) gaat terug naar de indiener.

---

## F0 — formele Mirror-poort
Geen code, wél een echte toets op een vaste SHA. **Claude-controle alleen is niet voldoende.**
1. Steekproef van minimaal **vijf** bevindingen "aanwezig", geverifieerd tegen code en repository.
2. Steekproef van minimaal **drie** bevindingen "afwezig", waarbij Mirror **zelf zoekt** in plaats van de vindplaats te lezen.
3. De technische route naar Hulp & ondersteuning en de herbruikbare Help-code zelf vastgesteld — de locatie zelf is een besluit, geen bevinding.
4. De bestaande motion-, media-, toegankelijkheids- en helptechniek zelf vastgesteld.
5. Volledigheid: alle onderwerpen gedekt, elke claim onderbouwd, geen ingevulde aanname.
6. Referentietoestellen en meetmiddelen benoemd.

**F1 mag pas starten na `F0 MIRROR_PROVEN`.**
**Afkeur:** een inventarisatie die iets invult wat niet is aangetroffen · een steekproef die niet klopt · een "afwezig" dat bij zelf zoeken wél blijkt te bestaan.

## F1
1. Systeeminstelling aan → alle beweging uit, alle functies bereikbaar.
2. Eigen instelling aan, systeeminstelling uit → zelfde uitkomst.
3. Beide uit → beweging aanwezig, niets verspringt.
4. Traag netwerk → ruimte gereserveerd vóór inhoud arriveert.
5. Configuratie niet per component overschrijfbaar.
6. Voorkeur overleeft afsluiten en geldt op een tweede toestel.
**Afkeur:** functie alleen via overgang bereikbaar · schakelaar die meer uitzet dan beweging.

## F2 — CMP-40
1. Geen aanraking → geen beweging.
2. Aanraking → lichte kanteling en druk; loslaten → rust.
3. Openen → sluit- en terugactie zichtbaar in het scherm zelf.
4. Beweging uit → gewone kaart, identiek bruikbaar.
5. Licht en donker thema.
6. 360 dp breedte → veilige randen.
7. Toepassing uitsluitend op het vrijgegeven moment.
8. Media of inhoud laadt na → niets verspringt.
**Afkeur:** continue beweging · kanteling zonder aanraking · toepassing op lijst, filter, formulier, navigatie, training of acute melding · layoutshift · systeem-terug als enige uitgang.

## F3 — CMP-41
1. Openen → poster, geen autoplay.
2. Mobiele data zonder toestemming → geen download, geen stille voorbereiding.
3. Trage verbinding → lage-resolutievariant aangeboden, scherm volledig bruikbaar.
4. Download afgebroken → poster en tekst blijven, opnieuw proberen is een keuze.
5. Media ontbreekt → vier elementen, tekstvariant als vervolgstap.
6. Speler faalt → onderliggend scherm volledig bruikbaar.
7. Ondertiteling aan, geluid uit → volledig te volgen.
8. Tekstvariant vergeleken met video → gelijkwaardig, geen samenvatting.
9. Schermlezer → elke knop uitspreekbaar.
10. 0,5× werkt.
11. Navigatie start tijdens afspelen → video pauzeert.
12. Poging tot afspelen in training, wedstrijddag, onboarding, formulier, acute flow → geen start.
13. Entitlement ontbreekt → geen URL afgegeven.
14. Rechtenbewijs van het testasset compleet: bron, maker, licentie, gebruiksrecht, versie.

**Geen `PARTIAL`-doorgang:** zonder rechtenvrij testasset blijft F3 `OPEN`. F4 wacht altijd op volledig `F3 MIRROR_PROVEN`.
**Afkeur:** autoplay · download zonder toestemming · mediafout blokkeert scherm · tekstvariant is samenvatting · URL vóór rechtencontrole.

## F4 — status en binding
1. Statuswisseling overleeft afsluiten en een tweede toestel.
2. Nieuwe contentversie → gecontroleerd opnieuw aangeboden, hoogstens één keer.
3. `do_not_show_again` bij acute melding → server-side geweigerd en gelogd.
4. `do_not_show_again` bij minderjarige → server-side geweigerd en gelogd.
5. Cross-account → voortgang van A nooit zichtbaar bij B.
6. Pakketverlies → voortgang blijft, toegang vervalt.
7. Server onbereikbaar → geen lokale bevestiging.
**Afkeur:** client-side weigering · fictieve voortgang · zichtbaar succes zonder serveropslag.

## F5 — CMP-42
1. Eerste opening → vraag, niet de uitleg.
2. Ja → speelt met ondertiteling; zonder geluid begrijpelijk.
3. Pauzeren en hervatten.
4. Overslaan → vraag komt niet terug.
5. Heropenen via Help werkt.
6. Uitgespeeld → eindigt met één echte uitvoerbare hoofdactie.
7. Actieve taak → verschijnt niet.
8. Offline → niet aangeboden; functie werkt.
9. Status niet op te slaan → geen lokale bevestiging.
10. Uitleg ontbreekt → geen vraag, geen lege speler.
11. Schermversie afwijkend → uitleg geblokkeerd.
12. Testfixture niet bereikbaar voor gewone gebruikers en niet zichtbaar in Preview of productie.

**Afkeur aanvullend:** placeholdervideo, mockuitleg of nagebootste Sparki-inhoud zichtbaar buiten de fixture · fictieve persoonlijke data.
**Afkeur:** automatisch starten · herhalen na overslaan · verouderd of nagebouwd scherm · eindigen zonder vervolgstap.

## F6 — CMP-43
1. Met media → begin/eind, techniek, fouten aanwezig.
2. Zonder media → tekstvariant volledig uitvoerbaar.
3. Stopregel permanent zichtbaar, niet weg te klikken.
4. Leeftijdsclassificatie en waarschuwing bij de oefening.
5. Minderjarig account → geen 1RM, gewichts-, calorie- of zwaar belastingdoel.
6. Toewijzing aan jeugdgroep → door trainer, geauditeerd.
7. Oefening zonder rechten → verschijnt niet.
8. Revalidatie zonder bevoegde begeleiding → wordt niet getoond.
**Afkeur:** ongeschikte jeugdinhoud · media zonder rechtenbewijs · oefening zonder stopregel.

## F7 — CMP-44 (uitsluitend niet-acuut)
1. Niet-acuut op rustmoment → verschijnt, blokkeert primaire actie niet.
2. Bevat reden, gegevens, periode en onzekerheid.
3. Sluiten, uitstellen, niet meer tonen werken.
4. Minderjarig → niet meer tonen bestaat niet.
5. **Acute en medische meldingen komen nooit via CMP-44 in beeld.** Ze blijven in hun bestaande veiligheidslaag, krijgen geen diepte of speelse animatie, worden niet permanent onderdrukbaar, en zijn bij minderjarigen niet negeerbaar waar de bestaande regels dat bepalen. Mirror toetst dit met een echte acute melding, niet met een nagebouwde.
6. Tijdens navigatie, training, wedstrijd, onboarding, formulier → geen melding.
7. Wedstrijddagmodus → volledig stil.
8. Gegevens ontbreken → geen melding, alleen de reden.
9. Geluid uit → volledig te begrijpen.
**Afkeur:** melding tijdens actieve taak · advies zonder onderbouwing · acuut permanent onderdrukbaar · advies uit mock- of verzonnen persoonlijke data · automatische actie.

## F8 — Academy
1. Hoofdnavigatie geteld → vijf items, gelijk voor alle rollen.
2. Route loopt via Hulp & ondersteuning.
3. Gratis → "Sparki gebruiken" volledig toegankelijk.
4. Gratis → "Beter fietsen en trainen" niet als lokkertje.
5. Compleet → beide delen toegankelijk.
6. Overgeslagen uitleg terugvindbaar.
7. Lege categorie → eerlijke lege toestand.
8. Deeplink naar een les → opent met werkende terugweg.
9. Zoekveld bedienbaar vóór de lijst geladen is.
**Afkeur:** zesde hoofditem · uitleg over een functie die de gebruiker niet heeft · nieuwe entitlementlaag.

## F9 — rolgerichte integratie

| Rol | Moet verschijnen | Mag niet verschijnen |
|---|---|---|
| Sporter | uitleg planner · diepte bij training voltooid · oefenkaart | media of uitleg tijdens de rit |
| Trainer | uitleg plannen · oefening delen · coachmelding | video tijdens lopende training |
| Hoofdtrainer | uitleg groepsbeheer | coachmelding over individuele sporter |
| Clubbeheerder · Teammanager | uitleg onboarding en seizoen | media in de inrichtingswizard |
| Ploegleider | diepte op wedstrijddagkaart | animatie, media of melding tijdens operatie |
| Mechanieker | materiaalinstructie met poster en tekst | media in wedstrijddagmodus |
| Soigneur | verzorgingsinstructie | voedingsvideo voor minderjarige zonder bron |
| Medical Staff | uitleg bij niet-acute begeleiding | animatie of diepte bij acute waarschuwing |
| Ouder | uitleg toestemming en afmelding | coachadvies over het kind |
| Gast | productuitleg · Academy-introductie | persoonlijke inhoud · coachmelding |
| Admin | niets | media in incidentafhandeling |

## F10 — regressie
De volledige testmatrix uit deel 11. Per cel een uitkomst; "niet getest" bestaat niet.

**Metingen op de referentietoestellen uit F0**, volgens vooraf vastgelegde scenario's: schermtijd · gedownloade data · CPU/GPU-belasting waar meetbaar · batterijverbruik over een vaste testduur · animatie aan versus uit · video versus tekstvariant.
**Afkeur:** een subjectief oordeel als "lijkt soepel" in plaats van een meting.

## F11 — eindbewijs
De vier beweringen B1 t/m B4 uit het README, elk met bewijs uit de fasen. Zonder bewijs voor B4 (niemand is afhankelijk van animatie of video) is het pakket niet af, ongeacht de rest.

---

## Directe afkeurgronden — elke fase

1. Video of afleidende animatie tijdens actieve navigatie, training, wedstrijddag, onboarding, formulier, acute of medische flow.
2. Functie onbruikbaar zonder animatie.
3. Aparte inferieure reduced-motionvariant.
4. Autoplay zonder expliciete gebruikersactie.
5. Download via mobiele data zonder toestemming.
6. Media zonder aantoonbare rechten.
7. Publicatie zonder ondertiteling of zonder volwaardig tekstalternatief.
8. Coachadvies uit mock-, demo- of verzonnen persoonlijke data.
9. Acute melding permanent onderdrukbaar.
10. Minderjarige kan een relevante veiligheidsmelding permanent onderdrukken.
11. Ongeschikte jeugdinhoud.
12. Mediafout blokkeert het onderliggende scherm.
13. Zware 3D-engine voor normale interface.
14. Layout springt door laat geladen media.
15. Uitleg verwijst naar een verouderd scherm.
16. Entitlement alleen client-side.
17. Cross-account voortgang zichtbaar.
18. Inhoud hardcoded verspreid in de frontend.
19. Tweede Academy-, content- of rechtenarchitectuur.
20. Zichtbaar succes zonder serveropslag.
21. Productbelofte eindigt zonder uitvoerbare vervolgstap.

---

*Deel 10 van 20.*
