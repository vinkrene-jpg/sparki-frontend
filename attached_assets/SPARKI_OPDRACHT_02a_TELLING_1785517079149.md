# OPDRACHT 02a — TELLING VAN ROUTEGEBRUIK

**Technische code:** `ROUTE_PAKKET_02A`
**Voor:** Replit
**Vast te leggen als:** `SPARKI-BESLUIT-2026-003` — Besluit René 31-07-2026
**Volgorde:** start pas ná afronding **én** Mirror-goedkeuring van Opdracht 2 (`SPARKI-BESLUIT-2026-002`, sleutels en poorten routes/navigatie). Beide raken de entitlement- en pakketlogica; ze mogen niet tegelijk lopen.
**Bouwen tegen:** de HEAD van `main` op het moment van starten. Noem die SHA in je oplevering.

---

## DOEL

Bouw de telling van routegebruik. Alleen meten. Nog niets blokkeren, nog geen limiet, nog geen melding aan de gebruiker.

Na deze opdracht moet aantoonbaar waar zijn:

1. Elke gebruikte route wordt server-side geregistreerd, met een sluitende reden waarom hij telt.
2. Dezelfde route telt maximaal één keer per kalendermaand, ongeacht hoe vaak of via welke weg hij wordt gebruikt.
3. Plannen, aanpassen en bekijken tellen nooit.
4. Er wordt gemeten voor **alle** pakketten — Gratis, Go en Compleet — en er wordt voor niemand iets geblokkeerd.
5. De teller is uitleesbaar, zodat Mirror hem kan controleren.

Dat vierde punt is bewust. De telling is straks ook de bron voor het meten van werkelijk functiegebruik; later alsnog voor Go en Compleet gaan tellen is een migratie die je nu voor niets voorkomt.

---

## BUITEN SCOPE — NIET BOUWEN

- De limiet van 8 en het blokkeren daarvan → 02b
- Reserveringen bij navigatie → 02b
- Meldingen aan de gebruiker ("X van 8") → 02b
- De opslaglimiet van 3 routes, de bewaartermijn van 30 dagen, vervallen, soft delete, downgradegedrag → 02c
- Adminweergave en fair-usemeting → 02d

Bouw hier niets van vooruit. Een half aangelegde limiet die nog niet werkt is gevaarlijker dan geen limiet.

---

## PRODUCTREGELS VOOR DE TELLING

Een route telt als **één gebruikte route** zodra één van deze drie gebeurtenissen plaatsvindt:

| usageType | Gebeurtenis |
|---|---|
| `SAVED` | De route wordt definitief opgeslagen |
| `GPX_EXPORTED` | De route wordt succesvol als GPX geëxporteerd |
| `RIDDEN_20_PERCENT` | De gebruiker heeft minimaal 20% van de route in Sparki gereden |

Verder geldt:

1. Route plannen is onbeperkt en telt niet.
2. Routepunten verschuiven en opnieuw laten berekenen telt niet.
3. Een route bekijken telt niet.
4. Dezelfde route telt binnen dezelfde kalendermaand maar één keer. Opslaan én daarna exporteren is samen één. Exporteren én daarna 20% rijden is samen één.
5. Een mislukte opslag telt niet. Een mislukte export telt niet. Een rit onder 20% telt niet.
6. Een kopie of wezenlijk gewijzigde route krijgt een eigen route-ID en telt afzonderlijk.
7. Kalendermaanden en resets gaan expliciet op **`Europe/Amsterdam`**, niet op UTC en niet op de tijdzone van het apparaat.

Bij punt 6: leg vast hoe "wezenlijk gewijzigd" in de huidige architectuur wordt herkend, en gebruik bestaande versie- of duplicatielogica. Bestaat die niet, dan is dat een bevinding — niet iets om zelf te verzinnen.

---

## DE 20%-TRIGGER STAAT APART

`RIDDEN_20_PERCENT` is technisch het moeilijkst en mag de rest niet gijzelen.

Bouw daarom de registratie generiek over `usageType`, en lever `SAVED` en `GPX_EXPORTED` als harde eis. Zet `RIDDEN_20_PERCENT` achter een operationele vlag die apart aan en uit kan.

Het percentage wordt berekend op **werkelijk afgelegde routeafstand** — de afstand die op de geplande route is gereden — en niet op verstreken tijd, aantal GPS-punten of totaal gereden kilometers.

Kun je dat niet betrouwbaar bepalen met de bestaande rit- en navigatiegegevens: **zet de vlag uit, lever de andere twee op, en rapporteer wat er ontbreekt.** De opdracht geldt dan alsnog als afgerond, met dat punt als expliciet restpunt. Ga niet gokken en bouw geen benadering die er precies genoeg uitziet.

---

## EXACT TE BOUWEN RESULTAAT

### 1. Eén centrale registratiefunctie

Alle telling loopt server-side via één functie. Frontendwaarden zijn nooit leidend.

Per registratie minimaal:

`userId` · `routeId` · `usageType` · `occurredAt` · `calendarMonth` (afgeleid in `Europe/Amsterdam`) · `subscriptionTier` op het moment van gebruik · `source` · `idempotencyKey`

`subscriptionTier` wordt vastgelegd zoals hij op dat moment was, en niet later herrekend. Anders verandert de historie mee met een upgrade.

### 2. Idempotentie en gelijktijdigheid

- Een herhaald verzoek, een retry of een herladen mag niet dubbel tellen.
- Twee gelijktijdige verzoeken voor dezelfde route mogen samen niet twee registraties opleveren. Los dat op met een unieke sleutel in de database, niet met een controle in applicatiecode.
- De uniciteit geldt op de combinatie gebruiker + route + kalendermaand.

### 3. Uitleesbare teller

Een server-side endpoint dat per gebruiker teruggeeft: de huidige kalendermaand, het aantal gebruikte routes, en de onderliggende registraties met `usageType` en tijdstip.

Zonder dit kan Mirror niets vaststellen, dus dit is onderdeel van de opdracht en niet van 02d.

### 4. Bestaande gegevens

- Bestaande routes, exports en ritten leiden **niet** met terugwerkende kracht tot registraties. De telling begint bij ingebruikname.
- Mock-, seed-, demo- en fallbackdata mogen nooit als echt gebruik worden geregistreerd.
- Beschrijf in je oplevering expliciet hoe je met historische routes bent omgegaan.

### 5. Geen blokkade

Er wordt in deze opdracht voor niemand iets geweigerd, verborgen of beperkt. Een gratis account dat vijftien routes gebruikt, gebruikt er vijftien en merkt niets. Dat is een acceptatiecriterium, geen tussenstand.

---

## HERGEBRUIKEN, NIET VERVANGEN

Onderzoek eerst de bestaande route-, export-, navigatie- en abonnementsgegevens. Hergebruik bestaande tabellen en services. Maak alleen een migratie wanneer de bestaande structuren aantoonbaar niet volstaan, en motiveer dat dan.

Geen parallel systeem, geen herschrijving van route-, navigatie-, export- of abonnementslogica.

---

## STOPCONDITIES

Stop en rapporteer, zonder te gokken, wanneer:

- de abonnementsstatus niet betrouwbaar server-side beschikbaar is;
- route-ID's niet stabiel zijn tussen plannen, opslaan, exporteren en navigeren;
- bestaande productiegegevens door een migratie verloren kunnen gaan;
- een noodzakelijke wijziging een grote architectuurherschrijving vereist.

Het niet betrouwbaar kunnen bepalen van het gereden percentage is **geen** stopconditie — dan zet je de vlag uit en lever je de rest op.

---

## AUTOMATISCHE TESTS

1. Plannen telt niet.
2. Routepunten verschuiven en herberekenen telt niet.
3. Een route bekijken telt niet.
4. Succesvol opslaan telt één keer.
5. Mislukte opslag telt niet.
6. Succesvolle GPX-export telt één keer.
7. Mislukte GPX-export telt niet.
8. 19,9% gereden telt niet.
9. 20,0% gereden telt wel.
10. Dezelfde route opslaan en daarna exporteren telt samen één keer.
11. Dezelfde route exporteren en daarna 20% rijden telt samen één keer.
12. Een dubbele API-aanroep telt niet dubbel.
13. Twee gelijktijdige verzoeken leveren samen één registratie op.
14. Een nieuwe kalendermaand begint op nul.
15. Maandgrens: gebruik op 31 juli 23.30 uur Amsterdamse tijd valt in juli, gebruik op 1 augustus 00.30 uur valt in augustus — ook wanneer de server op UTC draait.
16. Mock-, seed- of fallbackdata beïnvloedt de telling niet.
17. Een Go-account en een Compleet-account worden ook geteld.
18. Een gratis account kan twaalf routes gebruiken zonder dat er iets wordt geblokkeerd.
19. Een kopie of wezenlijk gewijzigde route telt afzonderlijk.
20. Met de 20%-vlag uit blijven tests 4 tot en met 7 en 10 groen.

Test 8 en 9 en 11 vervallen wanneer de 20%-vlag uitstaat; meld dat dan expliciet.

---

## WAT MIRROR TOETST

1. Een gratis gebruiker plant vijf routes en verschuift punten — de teller blijft op nul.
2. Een route bekijken — de teller blijft staan.
3. Eén route exporteren — de teller gaat naar 1.
4. Dezelfde route daarna opslaan — de teller blijft 1.
5. Een tweede route opslaan — de teller gaat naar 2.
6. Een route voor 10% rijden telt niet, voor 20% wel (vervalt als de vlag uitstaat).
7. Een Go-account en een Compleet-account worden ook geteld.
8. Een gratis account gaat door tot twaalf gebruikte routes en wordt nergens geblokkeerd of gewaarschuwd.
9. Geen mock-, demo-, seed- of fallbackgegevens zichtbaar als echt gebruik.

Desktop en mobiel.

---

## BEWIJS DAT JE OPLEVERT

Geen verslag. Per regel: commando, resultaat, exitcode.

- De nieuwe testset, met het aantal groene tests
- `pnpm --filter @workspace/api-server run test:entitlements`
- `pnpm --filter @workspace/api-server run test:stripe-billing`
- De routetestset — noem welke je hebt gedraaid
- `pnpm run typecheck:libs` en de typecheck van api-server
- Uitlezing van de teller voor drie accounts (gratis, Go, Compleet) na een reeks handelingen
- Stand van de 20%-vlag: aan of uit, en waarom

Plus: gewijzigde bestanden, gebruikte bestaande componenten en services, eventuele migratie, het API-contract van de tellerendpoint, de startcommit en de eindcommit.

---

## ACCEPTATIECRITERIA

1. Opslaan, succesvolle export en (indien aan) 20% gereden leiden tot precies één registratie per route per kalendermaand.
2. Plannen, aanpassen en bekijken leiden nooit tot een registratie.
3. Dubbele en gelijktijdige verzoeken leiden niet tot dubbele registraties.
4. Maandgrenzen volgen `Europe/Amsterdam`.
5. Er wordt geteld voor alle drie de pakketten.
6. Er wordt voor niemand iets geblokkeerd, beperkt of gewaarschuwd.
7. De teller is uitleesbaar per gebruiker.
8. Alle genoemde tests groen, typecheck exit 0.
9. Geen wijziging buiten de telling.

---

## DOCUMENTATIE

Maak of werk bij: `docs/SPARKI_ROUTE_USAGE_LIMITS.md` — alleen het hoofdstuk over telling. De hoofdstukken over limieten, opslag en admin komen bij 02b, 02c en 02d.

---

## VERVOLGVOLGORDE

Elke stap wordt eerst door Mirror bewezen voordat de volgende begint.

- **02b — limiet en reserveringen.** De 8 per kalendermaand server-side afdwingen. Navigatiesessies reserveren **altijd**, niet alleen bij de laatste route; vrijgeven bij afbreken onder 20%, bij niet starten, of bij verlopen. Meldingen bij 7 van 8 en bij 8 van 8, waarbij plannen, aanpassen en bekijken blijven werken.
- **02c — opslag, verval en downgrade.** Maximaal 3 bewaarde routes bij Gratis. Bewaartermijn 30 dagen met soft delete en een waarschuwing 7 dagen vooraf. Bij vervallen geldt één regel: **gedeelde links vervallen mee en de gebruiker wordt vooraf gewaarschuwd; een navigatie die al is gestart blijft werken tot die rit is afgelopen.** Bij downgrade naar Gratis wordt vooraf getoond welke routes buiten de limiet vallen en wat ermee gebeurt; niets wordt stilzwijgend verwijderd.
- **02d — admin en fair-usemeting.** Admininzicht per gebruiker: gebruikte routes per maand, aantal opgeslagen routes, vervaldatums, telling per `usageType`, openstaande reserveringen, verdachte registraties, routeberekeningen per dag en maand. Fair use uitsluitend meten en loggen — geen zichtbare limiet, geen blokkade voor normale gebruikers. Geen knop die zonder bevestiging alle tellingen wist.

---

## WERKREGELS

1. Alleen de telling. Geen limiet, geen melding, geen opslagregel.
2. Geen nieuwe architectuur, geen refactor zonder aantoonbare noodzaak.
3. Bij twijfel: melden, niet zelf beslissen.
4. Geen productbesluit nemen dat hier niet staat.
5. Nederlandse namen in de interface, technische sleutel klein erachter.
6. Meld eerlijk wat je niet hebt kunnen testen.
