# F10 — Centrale contacten- en relatielaag

**Pakket:** SPARKI_BUILD_01 (platformdienst PD-3)
**Fase:** F10
**Nagekeken tegen:** main `e67ccc40` en `SPARKI_BUILD_01` hoofdstuk PD-3, 2 augustus 2026
**Status:** gecorrigeerd — de oorspronkelijke specificatie draait één besluit om

---

## Correctie 1 — klant en sporter zijn NIET één record

De oorspronkelijke specificatie zegt: *"Klant en sporter zijn hetzelfde record (geen aparte entiteiten)"*, met als acceptatiecriterium dat een klant die ook sporter is één record blijft.

**Dat is het omgekeerde van wat er is vastgelegd.** PD-3 zegt woordelijk: klant en sporter blijven afzonderlijke entiteiten — een contact kan beide rollen dragen, maar dat zijn **twee relaties**, geen samengevoegd record.

Bouw dus: één contactrecord per identiteit, met daaraan gekoppeld meerdere **relaties**. Iemand die klant is én sporter heeft één contact en twee relaties. Voeg die relaties niet samen tot één entiteit.

De verwarring komt uit de scoperegel in hoofdstuk 9, die luidt: *niet bouwen — een tweede personenlijst; klant en sporter als één record*. Beide staan onder "niet bouwen".

---

## Correctie 2 — er is geen contactenlaag

De oorspronkelijke tekst zegt dat er al iets van een contactenlaag aanwezig is.

**Gemeten: die is er niet.** Van de tweeëntachtig tabellen in het schema is er geen enkele voor contacten of relaties.

Wat er wél is, en wat de bronnen voor de migratie zijn:

| Bron | Bestand |
|---|---|
| `user_profiles` | `schema/users.ts` |
| `athlete_profiles` | `schema/athlete-profiles.ts` |
| `coaching_profiles` | `schema/coaching-profile.ts` |
| `clubs`, `club_members`, `club_teams`, `club_groups`, `club_team_members` | `schema/club.ts` |
| `trainer_clients`, `client_athlete_links`, `billing_parties` | `schema/trainer-clients.ts` |
| `trainer_groups`, `trainer_group_members` | `schema/trainer-groups.ts` |
| ouder-kindkoppelingen | `schema/links.ts` |

**De opgave is dus niet "een contactrecord aanmaken" maar "vijf bestaande persoonsadministraties op één identiteit brengen zonder iets kwijt te raken".** Dat is het zwaarste deel van deze fase en verdient de meeste aandacht.

---

## Correctie 3 — de lijst telt twintig typen

PD-3 spreekt van negentien contacttypen maar somt er twintig op. Gebruik de opsomming, niet het getal.

**Contacttypen (20):** sporter · ouder of verzorger · trainer · hoofdtrainer · teammanager · ploegleider · mechanieker · soigneur · `nutrition_specialist` · `medical_staff` · vrijwilliger · klant · betaler · werkgever · sponsor · leverancier · wedstrijdorganisatie · noodcontact · bedrijf · locatiecontact.

**Relatietypen (9), elk met `startedAt` en `endedAt`:** ouder van · trainer van · klant voor · betaler voor · lid van · staf van · noodcontact van · werkzaam bij · leverancier aan.

Een contact kan meerdere typen tegelijk dragen. Een relatie eindigt met een einddatum; het contactrecord blijft bestaan.

---

## Eindtoestand

**Eén contactrecord per identiteit.** Een persoon wordt niet opnieuw als los contact aangemaakt wanneer dezelfde identiteit al bestaat. Dat is de harde regel uit PD-3.

**Geen tweede personenlijst.** De bestaande tabellen blijven bestaan voor hun eigen doel, maar verwijzen naar het contactrecord in plaats van de persoonsgegevens te herhalen.

**Duplicaatherkenning bij aanmaken**, op aantoonbare identiteit — niet op naam alleen. Twee mensen kunnen dezelfde naam hebben.

**Migratie:** samenvoegen mag uitsluitend op aantoonbare identiteit. Bij twijfel komt het geval op een beoordelingslijst. **Nooit automatisch samenvoegen bij twijfel** — een verkeerde samenvoeging is niet terug te draaien zonder dataverlies en raakt direct de privacy van twee mensen.

---

## Wat er niet bij hoort

Geen tweede personenlijst of aparte klantenadministratie · geen automatische samenvoeging bij twijfel · geen nieuwe relatietypen buiten de negen · **klant en sporter niet samenvoegen tot één entiteit**.

---

## Acceptatiecriteria

- dezelfde persoon kan tegelijk ouder én trainer zijn: één contact, twee relaties
- een klant die ook sporter is: **één contact, twee relaties** — niet één samengevoegde entiteit
- een poging tot aanmaken van een duidelijk duplicaat wordt herkend en geweigerd met uitleg
- twee verschillende personen met dezelfde naam worden niet als duplicaat behandeld
- een beëindigde relatie krijgt een einddatum en blijft historisch zichtbaar; het contact blijft bestaan
- twijfelgevallen uit de migratie staan op een beoordelingslijst en zijn niet samengevoegd
- geen enkele bestaande persoonsadministratie is stilzwijgend verdwenen; elke bron is aantoonbaar overgezet of bewust behouden

---

## Instructie aan Replit

Meet eerst de huidige staat — de meting hierboven is van `e67ccc40` en kan achterhaald zijn.

Lever vóór de migratie een overzicht: hoeveel identiteiten per bron, hoeveel vermoedelijke duplicaten, en hoeveel twijfelgevallen. Dat overzicht gaat naar René voordat er iets wordt samengevoegd.

Bouw daarna het contact- en relatiemodel, zet de bronnen om, en lever de bewijsbundel met de vaste SHA en de beoordelingslijst van twijfelgevallen erbij.
