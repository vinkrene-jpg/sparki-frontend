# JEUGD_EN_PLOEGLEIDER_HERSTEL_01

**Datum:** 03-08-2026
**Gemeten op:** commit `6689ea04` (main, 2 aug 22:55)
**Uitvoeringsregel:** `CONTINUOUS_BUILD_GOVERNANCE_01` — deze goedkeuring is volledige uitvoeringsvrijgave voor de hele straat: code, migraties, tests, commits, pushes en productiepublicatie. Mirror loopt parallel en blokkeert niet.
**Goedkeuring:** RENE_APPROVED 03-08-2026

---

## 0. Waarom deze opdracht bestaat

Vier bevindingen uit de basistoets op `6689ea04`. Drie raken de veiligheid van minderjarigen, één is een rechtenlek in de wedstrijdlaag. Alle vier zijn feitelijk in de code aangewezen — geen vermoedens.

---

## 1. Geboortedatum wordt verplicht

**Bestand:** `artifacts/api-server/src/lib/connectors/missing-data.ts`

**Bevinding:** `REQUIRED_FIELDS` bevat exact zes velden — naam, discipline, gewicht, FTP, trainingsuren per week, beschikbare trainingsdagen. Geboortedatum ontbreekt. Gewicht is dus verplicht en leeftijd niet, terwijl de gewichtssturing juist een leeftijdspoort heeft die zonder geboortejaar fail-closed dichtgaat.

**Opdracht:**

1. Voeg `birthDate` toe aan `REQUIRED_FIELDS`, met een eigen `RequiredFieldSpec` (type `date`, label "Geboortedatum").
2. `getMissingOnboardingData` telt het veld als aanwezig zodra `athleteProfilesTable.birthDate` óf `birthYear` gevuld is — een bestaand geboortejaar mag niet opnieuw uitgevraagd worden.
3. Bestaande accounts zonder geboortedatum krijgen het veld bij de eerstvolgende sessie voorgelegd via dezelfde `missing-data`-stap. Geen aparte migratie, geen geraden waarde, geen standaardwaarde.
4. Zolang de datum ontbreekt blijven de betrokken functies fail-closed weigeren met de bestaande eerlijke tekst, niet met een technische fout.

**Verboden:** een geboortedatum afleiden uit een connector, uit een leeftijdscategorie of uit wedstrijduitslagen. Ontbrekend blijft zichtbaar ontbrekend.

---

## 2. Jeugdblokkade aan op de twee gevoelige AI-doelen

**Bestand:** `artifacts/api-server/src/lib/ai/gateway.ts`

**Bevinding:** `AI_PURPOSES` telt 22 doelen. De fail-closed vlag `minorBlocked` bestaat en werkt aantoonbaar (bewezen in `tests/ai-gateway.ts` scenario 5), maar staat bij **alle 22 doelen op `false`** — inclusief `nutrition_photo`, precies het doel dat die test als voorbeeld gebruikt.

**Opdracht:**

1. Zet `minorBlocked: true` bij `nutrition_photo` en `nutrition_text`. Dat zijn de enige twee doelen met `sensitive: true`.
2. Laat de overige twintig doelen op `false`. Uitdrukkelijk niet blokkeren: `brief`, `ask`, `workout_explain`, `route_rationale` en de andere niet-gevoelige doelen — jeugd houdt gewone coaching en uitleg.
3. Controleer dat de weigering een leesbare melding oplevert en geen lege of stukke UI. Bij onbekende leeftijd verwijst de melding naar het invullen van de geboortedatum (zie deel 1).

**Let op:** `goal_translate` blijft op `false`. De 18-grens voor gewichtsdoelen zit daar al via `blockWeightRelated` in `lib/goal-translate.ts`, inclusief het filter op de modeloutput (DOE-15/16). Niet dubbel bouwen.

---

## 3. Gewichtssturing van 17 naar 18

**Bestand:** `artifacts/api-server/src/lib/season-goal.ts`

**Bevinding:** `SEASON_GOAL_MIN_AGE = 17`. De productregel is: **gewichtssturing vanaf 18, voedingsbegeleiding vanaf 17.** De 18-grens bestaat al in het doelenpad; alleen het seizoensdoel loopt nog achter.

**Opdracht:**

1. `SEASON_GOAL_MIN_AGE` van `17` naar `18`.
2. Pas beide weigerteksten in `seasonGoalIneligible` aan naar de nieuwe grens. Behoud de toon: uitleggen waaróm, niet alleen weigeren.
3. Laat de RED-S-toelichting in de commentaarregels kloppen met de nieuwe waarde.
4. **Voedingsbegeleiding blijft op 17.** Als er ergens een gedeelde constante wordt gebruikt voor beide, splits die in twee benoemde constanten zodat gewicht en voeding niet meer aan elkaar vastzitten.

**Bestaande rijen:** een sporter van 17 met een lopend streefgewicht valt na deze wijziging automatisch buiten `loadSeasonGoalSteering` (fail-closed). Geen rij verwijderen — het doel wordt niet doorgevoerd en komt vanzelf terug bij 18.

---

## 4. Rechtenlek ploegleider

**Bestand:** `artifacts/api-server/src/routes/club.ts`, rond regel 2730

**Bevinding:** de blokkade "een ploegleider mag een overrule van de teammanager niet terugdraaien" toetst letterlijk:

```
if (existing.overruledAt != null && ctx.membership.role === "ploegleider")
```

De bevoegdheid om een wedstrijd te beheren loopt echter via `canManageRaceEvent`, die ook een vervanger toelaat op `deputyClerkId`. Een vervanger met een andere clubrol kan de overrule dus wél terugdraaien.

**Opdracht:**

1. Vervang de letterlijke rolvergelijking door de bevoegdheidscontrole: iedereen die dit evenement beheert via `canManageRaceEvent` — inclusief de vervanger op `deputyClerkId` — valt onder dezelfde blokkade, tenzij hij de teammanager zelf is.
2. Zoek in `routes/club.ts` naar alle overige plaatsen waar een recht via een letterlijke rolnaam wordt bepaald in plaats van via een bevoegdheidsfunctie, en meld die in de rapportage. Alleen deze ene repareren; de rest is inventarisatie.
3. De foutmelding blijft inhoudelijk gelijk, maar noemt niet langer alleen "de ploegleider".

---

## 5. Bewijs

Per deel een test die faalt op de oude code en slaagt op de nieuwe.

| # | Bewijs |
|---|---|
| 1 | Account zonder geboortedatum → `missing-data` bevat `birthDate`. Account met alleen `birthYear` → veld wordt **niet** opnieuw gevraagd. Na invullen verdwijnt het uit de lijst |
| 2 | Minderjarige roept `nutrition_photo` en `nutrition_text` aan → geweigerd, leesbare melding. Dezelfde minderjarige roept `brief` en `ask` aan → werkt gewoon. Gebruiker zonder geboortedatum → geweigerd met verwijzing naar het profiel |
| 3 | Sporter van 17 met streefgewicht → `loadSeasonGoalSteering` geeft `null` en het seizoensdoel wordt nergens doorgevoerd. Sporter van 18 → werkt. Voedingsbegeleiding op 17 → werkt nog steeds |
| 4 | Vervanger op `deputyClerkId` met een andere clubrol probeert een overrule van de teammanager terug te draaien → 403. Teammanager zelf → toegestaan |

Bewijsbundel in `docs/proof-evidence/JEUGD_EN_PLOEGLEIDER_HERSTEL_01/`, met de toets-SHA erbij.

---

## 6. Directe afkeurgronden

- een geboortedatum die door het systeem is geraden, afgeleid of standaard ingevuld
- een minderjarige die alsnog een voedingsanalyse of gewichtsdoel krijgt
- een meerderjarige die door deze wijziging zijn gewone coaching kwijtraakt
- een weigering die als technische fout of leeg scherm binnenkomt in plaats van als uitleg
- een tweede leeftijdspoort naast `season-goal` of `goal-translate`
- een rechtencontrole die na deze wijziging nog steeds op een letterlijke rolnaam berust op de gerepareerde plek

---

## 7. Rapportage

Eén bericht terug met: gewijzigde bestanden, de vier testuitkomsten, de inventarisatie uit deel 4.2, en of er accounts zijn die door deel 1 een aanvulstap krijgen — met aantal.
