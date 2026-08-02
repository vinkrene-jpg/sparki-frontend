# F7 — Communicatie met bijlagen

**Pakket:** SPARKI_BUILD_01
**Fase:** F7 — Communicatie met bijlagen
**Nagekeken tegen:** main `e67ccc40`, 2 augustus 2026
**Status:** gecorrigeerd. De oorspronkelijke specificatie gaat uit van een berichtenlaag die niet bestaat.

---

## Belangrijkste correctie — lees dit eerst

De oorspronkelijke opdracht luidt: berichten kunnen bijlagen bevatten, en bouw geen tweede berichtenkanaal.

**Gemeten in het databaseschema: er is geen berichtenlaag.** Er bestaat geen `club_messages` of enige andere berichtentabel. Wat er wel is:

- `virtual_posts` in `lib/db/src/schema/sparki-world.ts` — hoort bij de wereldfunctie, geen clubcommunicatie
- `attachment_url` en `attachment_consent` in `lib/db/src/schema/support.ts` — supporttickets
- een `attachments`-veld als JSON in `lib/db/src/schema/input-center.ts`

Er is dus niets om een bijlage aan te hangen. F7 is daarmee geen aanvulling maar een nieuwe laag: **clubcommunicatie inclusief bijlagen.**

**Besluit — geen open eind.** F7 bouwt die berichtenlaag zelf. Er is geen ander pakket in de wachtrij dat het doet; wachten betekent hier nooit. Niet doorschuiven, niet afsplitsen.

**De omvang ligt vast — het communicatiemodel van René (02-08-2026):**

| Wie | Naar wie | Richting |
|---|---|---|
| Clubtrainer | zijn groep | **één richting** — hij stuurt, de groep ontvangt |
| Zelfstandige trainer | zijn sporter | twee richtingen |
| Clubbeheer ↔ hoofdtrainer ↔ trainers | elkaar | twee richtingen, ook onderling |
| Team: staf en renners | elkaar | twee richtingen, onderling |

Elk bericht kan bijlagen hebben (bestanden, afbeeldingen, links), reacties waar de richting dat toelaat, en een gelezenstatus per ontvanger. Eén jaar bewaard.

**Harde grens — dit is een veiligheidsregel, geen instelling:**

**Onder de 16 bestaat er nooit een gesprek met een volwassene waar de ouder buiten staat.** Server-side afgedwongen, niet in het scherm verborgen. Een poging levert een geweigerd verzoek op, geen stil genegeerd bericht.

Concreet:

- **Ongevraagd contact van een volwassene naar een jeugdrenner onder de 16 bestaat niet.** Er is geen manier om zo'n renner aan te schrijven zonder bestaande koppeling.
- **Een zelfstandige trainer en zijn gekoppelde sporter onder de 16 mogen wél twee kanten op berichten sturen — en de ouder ziet alle berichten mee.** Volledig, niet samengevat, zoals bij de adviezen.
- **Hetzelfde geldt in de ploeg:** staf en een renner onder de 16 kunnen elkaar bereiken, met de ouder als meelezer.
- **De clubtrainer naar zijn groep blijft één richting**, ongeacht leeftijd. Daar is geen antwoordpad, dus ook geen ouderinzage nodig.

**Wat er niet in zit:** geen open chat tussen leden onderling, geen privéberichten buiten de vier lijnen hierboven.

---

## Tweede correctie — de bestandslaag bestaat niet

De oorspronkelijke tekst zegt dat dit later moet aansluiten op de centrale bestands- en medialaag uit F11.

**Gemeten: F11 bestaat niet.** Er is geen centrale bestandslaag. Wat er is, is functiegebonden: `photo_lab_uploads` en `virtual_media`. Die zijn geen basis om op verder te bouwen.

Gevolg: als F7 nu een eigen uploadoplossing bouwt, moet F11 die later omzetten. Dat is voorzien in het oorspronkelijke pakket, maar het is dubbel werk.

Bepaal en meld terug: bouw je in F7 direct het generieke bestandsmodel dat F11 later overneemt — één `file`-record met eigenaar, type, grootte, versie, ingetrokken-status en retentiecategorie — of bouw je iets tijdelijks? Het eerste kost nu iets meer en scheelt later een migratie.

Advies: **bouw meteen het generieke model**, en beperk F7 tot het gebruik ervan.

---

## Derde correctie — er is geen virusscan

De oorspronkelijke tekst eist een veiligheidscontrole vóór een bestand downloadbaar wordt.

**Gemeten: er is nergens in de codebasis een virus- of malwarescan.** Niet in de app, niet in de server, niet in een bestaande uploadfunctie.

Dat is geen bouwtaak maar een keuze met kosten en een externe afhankelijkheid. Tot die keuze is gemaakt geldt dit als minimum, en het is voldoende om F7 mee af te ronden:

- strikte lijst met toegestane bestandstypen, gecontroleerd op de werkelijke inhoud en niet op de bestandsnaam
- maximale bestandsgrootte
- geen uitvoerbare bestanden, geen archieven, geen documenten met macro's
- afbeeldingen worden opnieuw gecodeerd bij opslag, zodat meegestuurde inhoud verdwijnt
- bestanden worden geserveerd vanaf een aparte oorsprong met een download-header, nooit uitgevoerd in de context van de app

Bouw het scanmoment wel als een expliciete stap in de keten, zodat er later een echte scanner in past zonder de rest te verbouwen.

---

## Eindtoestand die bereikt moet zijn

**Berichten.** Een clubbericht met afzender, ontvangergroep, tekst, tijdstip en gelezenstatus. Rechten volgen de bestaande clubrollen; geen tweede rechtenlaag.

**Bijlagen.** Eén of meer per bericht: bestanden, afbeeldingen, links. Op het bericht zelf, niet op een werkobject — de werkobjectlaag is `SPARKI_BUILD_02` en staat hier los van.

**Rechten.** Alleen wie het bericht mag zien, kan de bijlage openen of downloaden. Een ingetrokken bestand is niet meer bereikbaar, ook niet via een oudere link.

**Retentie.** Clubberichten en reacties worden één jaar bewaard — besluit van 1 augustus. Bijlagen volgen het bericht. Bouw de termijn configureerbaar, met deze waarde ingevuld.

**Notificaties.** Gebruik de bestaande notificatielaag in `lib/db/src/schema/notifications.ts`; bouw geen tweede meldingssysteem. **Geen gevoelige inhoud in een pushmelding** — niet de tekst van het bericht en niet de bestandsnaam. Openen brengt de gebruiker in de juiste rol en context.

---

## Wat er niet bij hoort

Geen chatfunctie of tweede berichtenkanaal naast dit ene · geen uploadoplossing per module · geen werkobjectlaag · geen tweede rechten- of meldingssysteem · geen opslag van bestanden in de database zelf.

---

## Acceptatiecriteria

- Een clubbeheerder verstuurt een bericht met bijlage; de ontvangers zien het en kunnen de bijlage openen.
- Een gebruiker zonder recht op het bericht kan de bijlage niet zien én niet downloaden, ook niet via een directe aanroep met de bestands-id.
- Een ingetrokken bestand is niet meer downloadbaar, ook niet via een link die eerder werkte.
- Een geweigerd bestandstype geeft een duidelijke melding en wordt niet opgeslagen.
- Een bestand dat zich voordoet als een toegestaan type maar dat niet is, wordt geweigerd op inhoud.
- De pushmelding bevat noch de berichttekst noch de bestandsnaam.
- Gelezenstatus werkt per ontvanger.
- De bewaartermijn van één jaar staat als configuratiewaarde en is niet hardcoded.

---

## Instructie aan Replit

Meet eerst wat er werkelijk staat aan communicatie, bestanden, rechten en notificaties — de meting hierboven is van `e67ccc40` en kan inmiddels achterhaald zijn.

De omvang ligt vast (zie boven): F7 bouwt de berichtenlaag zelf. Meld alleen terug of je meteen het generieke bestandsmodel bouwt, voordat je begint.

Bouw of herstel alleen wat de eindtoestand nog niet dekt. Lever daarna de bewijsbundel voor deze fase, met de vaste SHA erbij.
