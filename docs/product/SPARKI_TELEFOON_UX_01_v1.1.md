# SPARKI_TELEFOON_UX_01 — v1.1

**Type:** bindende UX-standaard voor de telefoonapp
**Status:** vastgesteld door René, 2 augustus 2026
**Vervangt:** v1.0 van dezelfde dag
**Geldt voor:** `MOBIEL_ROLLEN_01`, `MEDIA_UITLEG_01` en elk pakket dat een mobiel scherm bouwt
**Verhouding tot `MOBILE_UX_STANDARD_01` v1.4:** die blijft gelden voor gedrag en regels. Dit document gaat over vorm en opbouw, en wint bij tegenspraak.

---

## 1. Uitgangspunt

`TUX-01` — De app is **geen verkleinde website**. Een scherm dat voor een muis is ontworpen en daarna smaller wordt gemaakt, is niet acceptabel — ook niet als het uit dezelfde code komt.

`TUX-02` — Uitgangspunt bij elk scherm: één hand, in beweging, buiten, met zon op het scherm. Bediening in het onderste deel, waar de duim komt.

`TUX-03` — De eerste release is een test **mét betalende klanten**. De app mag er niet uitzien als een prototype.

`TUX-04` — **Geen verschillen tussen de omgevingen.** Na publicatie tonen app en browser dezelfde functies, dezelfde uitstraling en dezelfde diepte- en bewegingslaag. Een functie die in de ene omgeving bestaat en in de andere ontbreekt, is een defect — geen fasering.

`TUX-05` — Sfeer: **licht en rustig.**

---

## 2. Het startscherm

`TUX-06` — Voor de **sporterrol** is het startscherm de **kaart**, beeldvullend, ongeveer 80% van het scherm. Zoals Komoot. Geen formulier met invulvelden.

`TUX-07` — Elke andere rol houdt zijn eigen eerste scherm zoals vastgelegd: Trainer → Trainingen · Hoofdtrainer → Groepen · Clubbeheerder → Organisatie · Teammanager → Teams · Ploegleider → Wedstrijddag · Mechanieker → Materiaal · Soigneur → Voeding · Medische staf → Gezondheid · Voedingsdeskundige → Voeding · Ouder → Kind · Gast → Introductie · Admin → Systeemstatus.

`TUX-08` — Wie meerdere rollen heeft, landt op de rol waarin hij het laatst was.

`TUX-09` — Bovenop de kaart: een zoekveld en een driepuntsmenu. Rechtsonder de kaartbediening.

---

## 3. Het onderblad — één scherm, drie diepten

`TUX-10` — Onderin zit een blad dat je omhoog sleept. **De kaart is voor iedereen gelijk; de inhoud van het blad verschilt per pakket.** Er worden geen drie aparte startschermen gebouwd. Wie upgradet ziet hetzelfde scherm rijker worden, niet veranderen.

| Pakket | Inhoud van het blad |
|---|---|
| **Gratis** | zoeken, en je drie bewaarde routes |
| **Go** | het routevoorstel van vandaag, met de reden erbij, plus je bibliotheek |
| **Compleet** | **de training van vandaag bovenaan**, met de bijpassende route eronder |

`TUX-11` — Het blad toont routes die in beeld zijn, met foto's erbij.

`TUX-12` — **Rustdag.** Heeft een Compleet-gebruiker vandaag geen training, dan staat er geen kale mededeling maar een **terugblik op zijn week**: afstand, hoogtemeters en tijd, met de ritten van die week als lijnen op de kaart erachter. Alleen de tekst "rustdag" is niet genoeg.

---

## 4. Kiezen wat voor route het wordt

`TUX-13` — **Drie knoppen op de kaart**, niet meer. Meer wordt een formulier.

`TUX-14` — **Trainingstype staat vooraan.** Bij Komoot staat op die plek de sport; dat ene woord is in één blik het verschil tussen beide producten.

`TUX-15` — Daarnaast **afstand**.

`TUX-16` — En **klimmen** — maar die knop **filtert niet, hij kiest**: je pikt een klim uit de buurt van de route. Daarom wordt hij **apart vormgegeven** en ziet hij er niet uit als de andere twee. Drie knoppen die er hetzelfde uitzien maar zich anders gedragen, is waar mensen op vastlopen.

`TUX-17` — Het paneel met invulvelden voor afstand, hoogtemeters, ondergrond, drempels, rotondes, spoorwegovergangen, verkeerslichten, wind en temperatuur verdwijnt uit het hoofdscherm. Dat is concurreren op routeberekening, en daar wint Sparki niet op.

---

## 5. Van voorstel naar rit

`TUX-18` — Tikken op het routevoorstel **toont de route op de kaart**. Het start niet meteen de navigatie.

`TUX-19` — Start je de route, dan legt de navigatielaag zich **over dezelfde kaart**. Geen apart navigatiescherm: de planningsbediening verdwijnt, de navigatiebediening komt ervoor in de plaats.

---

## 6. Onderweg

`TUX-20` — **Elk trainingstype krijgt een eigen onderwegscherm** — niet dezelfde indeling met wisselende inhoud.

> *Aantekening bij dit besluit:* het risico is dat je bij hoge snelheid moet zoeken waar een waarde staat, en dat vier typen ook vier schermen betekent die gebouwd, getest en tussen app en browser gelijk gehouden moeten worden. Wahoo en Garmin houden daarom de indeling vast en wisselen alleen de inhoud. René heeft hier bewust anders gekozen.

`TUX-21` — Wat er te zien is hangt af van wie je bent: wandelen toont afstand gelopen, te gaan, totaal en snelheid · een gewone fietser daarbij eventueel de accu · wielrenner, mtb en gravel daarbij alles wat via ANT+ en Bluetooth binnenkomt.

`TUX-22` — **Bij een intervaltraining neemt het scherm je mee door het blok.** Niet alleen de route tonen.

`TUX-23` — Die begeleiding loopt via **spraak én geluid met één groot getal**. Tijdens een blok kijk je niet op je telefoon; een intervalfunctie die alleen op het scherm werkt, werkt alleen thuis op de bank.

---

## 7. Eén scherm, geen scrollverplichting

`TUX-24` — Een scherm laat **hoofdzakelijk alles zien wat je nodig hebt** zonder te scrollen. Scrollen mag voor extra's en historie, nooit voor de hoofdhandeling.

`TUX-25` — Past het niet, dan is het scherm te vol — niet het toestel te klein. Splitsen, achter een stap zetten, of weglaten. Niet naar beneden duwen.

`TUX-26` — Toetssteen: op het kleinste ondersteunde toestel staan de hoofdhandeling en de kerninformatie in beeld bij openen.

---

## 8. Stappen als vensters

`TUX-27` — Een proces met meerdere stappen wordt getoond als een **stappenvenster over het scherm heen**: één vraag of keuze per stap, zichtbaar waar je bent, altijd terug kunnen, altijd kunnen sluiten.

`TUX-28` — Niet: een lang formulier waar je doorheen scrolt. Niet: naar een ander scherm springen en de weg terug kwijtraken.

`TUX-29` — Elke stap heeft een duidelijke volgende actie. Een stappenvenster eindigt nooit doodlopend.

`TUX-30` — Dit vervangt de eerdere regel dat een "popup met stappen" niet bestaat in Sparki. Wat daar een wizard of bottom sheet heette, is precies wat hier bedoeld wordt — de naam was het enige verschil.

---

## 9. Diepte en sfeer

`TUX-31` — De app krijgt dezelfde **dieptelaag en 3D-elementen** als de webversie: kaarten die licht zweven, zachte kanteling, drukanimatie. Sfeer, geen versiering — het is het verschil tussen een formulier en een product.

`TUX-32` — Licht en rustig sluit diepte niet uit, maar wel de filmische donkere variant. Diepte wordt hier: zachte schaduwen, bladen die over elkaar schuiven, kaarten die iets loskomen bij aanraking.

`TUX-33` — Gemeten: die laag bestaat al in `artifacts/sparki` (`zweefkaart.ts`, `card.tsx`, `screen-shell.tsx`, `cinematic-scene.tsx`, `bike-3d.tsx`, `use-motion-preference.ts`). Hij wordt **verplaatst naar de gedeelde laag**, niet nagebouwd.

`TUX-34` — Diepte en beweging alleen bij een aanleiding: persoonlijk record · training voltooid · route opgeslagen of gestart · een detail openen · wedstrijddag · niet-acute coachmelding · eerste uitleg. Nooit bij doorlopende navigatie, lijstitems of acute meldingen.

`TUX-35` — Alles blijft volledig bruikbaar met beweging uitgeschakeld. Geen armere variant voor wie dat aanzet.

---

## 10. De pakketgrens die dit ontwerp draagt

`TUX-36` — **Go kijkt één dag terug en één dag vooruit. Compleet kijkt weken.**

`TUX-37` — Go mag daarom op basis van ritgegevens — duur, afstand, hoogtemeters — zeggen *"je reed gisteren zwaar, vandaag iets rustigs"* en daar een route bij voorstellen. Dat is wat Go onderscheidt van Gratis, en het is waarom het routevoorstel jóú kent in plaats van alleen het gebied.

`TUX-38` — Go doet níét: opbouw over meerdere weken · toewerken naar een doel · iets met slaap of hartslagvariatie · waarschuwen voor structurele overbelasting. Dat blijft Compleet.

`TUX-39` — Gratis, Go en Compleet werken alle drie op telefoon **én** desktop. De rem zit in de acht routes per maand, niet in het apparaat.

---

## 11. Directe herstelgronden

`TUX-40` — Een hoofdhandeling die alleen bereikbaar is na scrollen.
`TUX-41` — Een meerstapsproces als één lang formulier.
`TUX-42` — Een stappenvenster zonder uitweg of zonder volgende actie.
`TUX-43` — Een scherm in de app dat zichtbaar een versmalde webpagina is.
`TUX-44` — Een sfeer- of diepte-element dat in de browser wel en in de app niet bestaat, of omgekeerd.
`TUX-45` — Een routeplanner waarvan de kaart minder dan ongeveer 80% van het scherm beslaat.
`TUX-46` — Een invulveldenpaneel als hoofdscherm van de routeplanner.
`TUX-47` — Meer dan drie keuzeknoppen op de kaart.
`TUX-48` — De klimmen-knop vormgegeven als de andere twee.
`TUX-49` — Een rustdag met alleen een mededeling erin.
`TUX-50` — Intervalbegeleiding die alleen op het scherm werkt.
`TUX-51` — Bediening buiten duimbereik bij een handeling die je rijdend of lopend doet.
`TUX-52` — Een functie die onbruikbaar wordt met beweging uitgeschakeld.
`TUX-53` — Een advies in Go dat verder kijkt dan één dag terug of één dag vooruit.

---

## 12. Wat nog niet ontworpen is

- **Het einde van de rit** — wat zie je als je stopt, hoe sla je op, wat gebeurt er met bidons en eetmomenten.
- **De rolschermen zelf** — trainer, club, ouder, ploegleider en de rest. `MOBIEL_ROLLEN_01` beschrijft de volgorde, niet de vorm.
- **De bibliotheek** — hoe je door je eigen routes en die van anderen bladert.
- **Vrienden op de kaart** — grofmazig en alleen tijdens een rit; de weergave is nog niet uitgewerkt.

---

## 13. Volgorde

Deze standaard geldt vanaf de gedeelde schil van `MOBIEL_ROLLEN_01`. Bestaande schermen worden er bij aanraking op bijgewerkt. De routeplanner gaat eerst, want dat is wat een renner dagelijks gebruikt en het is het enige onderdeel dat vandaag al te testen valt.
