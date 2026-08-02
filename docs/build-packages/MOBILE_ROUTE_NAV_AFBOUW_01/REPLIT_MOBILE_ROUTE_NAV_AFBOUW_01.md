# REPLIT-OPDRACHT — MOBIELE ROUTE EN NAVIGATIE AFBOUWEN

Technische code: `MOBILE_ROUTE_NAV_AFBOUW_01`
Datum: 1 augustus 2026

**Waarom dit voorrang heeft:** route en navigatie op de telefoon is het enige onderdeel dat een wielrenner direct kan beoordelen, op de fiets, in de praktijk. Alles wat daarna komt leunt op de vraag of dít deugt.

Bindend ernaast: `SPARKI_ROUTEPLANNER_RICHTING_01` (productrichting) en `SPARKI_MOBILE_UX_STANDARD_v1.4` (MUX-regels).

---

## 0. Wat er al staat

Niet opnieuw bouwen. `artifacts/sparki-mobile/` bevat onder meer:

- `navigate/[id].tsx` — 2477 regels navigatie
- `record.tsx` — 1192 regels rit opnemen
- `route-aanvraag.tsx` — 550 regels
- `rides.tsx`, `ride/[id].tsx`, `gpx-import.tsx`
- `RouteMap.tsx`, `TrackMap.tsx`

**F0 is geen inventarisatieronde.** Leg deze opdracht naast wat er staat, meld in één rapport wat al klaar is en begin dan te bouwen. Geen aparte auditfase.

---

## 1. Het schermmodel en de drie ingangen

**Staand, kaart op circa 80% van het scherm.** Zoekveld, driepuntsmenu en filterbolletjes liggen bovenop de kaart; kaartbediening rechtsonder; onderaan een sleep-open blad in drie hoogtes; daaronder het vaste menu van vijf. Volledig uitgewerkt in `SPARKI_ROUTEPLANNER_RICHTING_01` hoofdstuk 2a, inclusief beeldgebruik.

**Het eerste filterbolletje is het trainingstype**, niet de sport.

**Bij het starten van een route wisselt de weergave op dezelfde kaart:** de navigatielaag komt over de planningslaag heen. Geen apart navigatiescherm.

Het routescherm opent niet met een formulier. Drie manieren om te beginnen, als tabbladen in het sleepblad:

**1.1 Voorstel van vandaag.** Staat er een training in het schema, dan toont Sparki één routevoorstel dat daarbij past. Overslaan moet met één tik.

**1.2 De bibliotheek.** Hoofdingang. Kiezen uit routes die er al zijn.

**1.3 Filteren.** Voor wie iets nieuws wil — zie hoofdstuk 3.

Zelf tekenen vanaf niets is geen ingang. Aanpassen van een gekozen route wel, zie hoofdstuk 4.

---

## 2. De bibliotheek vullen

Mag bij eerste opening niet leeg zijn. Bronnen, in volgorde van belang:

1. **Import van Strava en Garmin** — dragend onderdeel, niet een extraatje. Wie koppelt krijgt vaak honderden ritten mee; die worden meteen bruikbare routes
2. eigen eerdere ritten uit Sparki
3. routes van andere Sparki-gebruikers
4. door Sparki samengesteld

Toon per route wat een fietser nodig heeft om te kiezen: afstand, hoogtemeters, ondergrond, en de informatie uit hoofdstuk 3.

---

## 3. Filters terugbrengen, de rest tonen

Dit is het kleinste werk met de grootste winst — ook technisch, want elke filtereis vooraf kost kaartaanvragen.

**Blijft filter:**
- trainingstype, of "vrije rit"
- afstand of duur
- startpunt
- ondergrond en fietstype

**Wordt informatie bij de route, geen filter meer:**
- aantal verkeerslichten · spoorwegovergangen · rotondes · drempels
- wind onderweg · temperatuur · kans op neerslag

Niet vooraf "geen rotondes" aanvinken. Wel bij een route zien: *veertien verkeerslichten, twee spoorwegovergangen, tegenwind op de terugweg*.

---

## 4. Een route aanpassen

Vier handelingen op de kaart, met de vinger:

1. punt verslepen
2. waypoint toevoegen
3. inkorten of verlengen
4. **een klim toevoegen** — kiezen uit klimmen in de buurt van de route. Niet zoeken op naam. De Klimmenverkenner levert de gegevens en bestaat al

---

## 5. De training stuurt de route

Voor gebruikers met Compleet past de gegenereerde route zich aan:

| Training | Route |
|---|---|
| interval | na de warming-up zoveel mogelijk rechte stukken, weinig bochten |
| duurtraining | mag recreatief zijn, met bezienswaardigheden onderweg |
| herstel | zeker geen heuvels |

**Vaste regel ongeacht training: geen woonwijken.**

---

## 6. Onderweg — de fietscomputer

Wat je ziet hangt af van het profiel:

| Profiel | Toont |
|---|---|
| wandelen | afstand gelopen · afstand te gaan · totaal · snelheid |
| gewone fietser | idem plus accustand en bereik bij een e-bike |
| wielrenner, mtb, gravel | idem plus alles wat via ANT+ en Bluetooth binnenkomt |

E-bikebereik toont **"onbekend"** zolang er geen bron is. Nooit een geschat getal.

---

## 6a. Privacy-instellingen bij het profiel

Bij het profiel komt één hoofdstuk "Privacy" waar de gebruiker zelf zijn AVG-gevoelige keuzes maakt — dit is de enige plek voor die keuzes, ook in de app:

- privacyzones beheren (huisadres altijd impliciet gemaskeerd; maskering is een lees-transformatie en werkt dus ook op al gedeelde routes);
- of eigen routes deelbaar/openbaar mogen zijn — standaard uit;
- live zichtbaarheid voor vrienden: standaard uit, per vriend, alleen tijdens een rit, grofmazig; voor jeugd bestaat de keuze niet (fail-closed);
- vindplaats van de bestaande deelregels (trainer/ouder) en van export/verwijdering.

Regels voor de bouw: veiligste stand als standaard, uitzetten werkt direct en met terugwerkende kracht door op alle lees-paden, en nieuwe functies voegen geen losse schakelaars elders toe maar registreren hun keuze in deze ene laag.

---

## 7. Buiten scope in deze ronde

- vrienden op de kaart — apart traject, raakt privacy en jeugd
- bezienswaardigheden uit de kaartbron — komt na de kern
- club-, team-, ouder- en ploegleiderschermen in de app
- offline werken — is bewust naar een tweede update geschoven

---

## 8. Wat niet verandert

- de fail-closed blokkadecontrole uit taak #505
- de bibliotheekpoorten
- de gedeelde Overpass-client uit `ROUTE_OVERPASS_STABILITEIT_01`
- geen zesde hoofditem in de navigatie (MUX-14, BB-07)

---

## 9. Bewijs

Op productie, vanuit het account van René, op de telefoon, op één vaste SHA:

1. planner openen — de drie ingangen zijn zichtbaar zonder scrollen
2. route kiezen uit de bibliotheek en rijden
3. route aanpassen: punt verslepen, waypoint toevoegen, klim toevoegen
4. route genereren met een trainingstype en zien dat de route erop aansluit
5. navigatie starten en de juiste gegevens zien voor het gekozen profiel
6. rit opslaan en terugvinden

Geen testrapport. Schermafdrukken van de telefoon, met de SHA erbij.

---

## 10. Volgorde

Hoofdstuk 3 eerst — dat is het minste werk, geeft direct winst in snelheid, en maakt het scherm meteen lichter. Daarna 1, 2, 4, 5, 6.
