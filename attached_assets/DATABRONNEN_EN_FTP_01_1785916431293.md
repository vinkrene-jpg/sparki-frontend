# DATABRONNEN_EN_FTP_01

**Bouwinstructie — Sparki**
Datum: 5 augustus 2026
Aanleiding: ijking B8 op de rit van Dylan Vink (1 augustus 2026)
Achtste document in de reeks; index staat in `TRAINERSZANDBAK_EN_BLOKKEN_01` §0

---

## 0. Waarom dit document er is

De ijking legde geen rekenfout bloot maar een **bronfout**. De Strava-import heeft
op 5 augustus een handmatig ingevoerde FTP van 345 W overschreven met 272 W uit
het Strava-profiel. Dat profielveld wordt door de sporter niet onderhouden — hij
kijkt uitsluitend in TrainingPeaks en vindt zijn Strava-cijfers betekenisloos. Voor
vrijwel elke renner met een coach geldt hetzelfde.

**Waarom dit zwaar telt:** belasting schaalt met het kwadraat van de
FTP-verhouding. (345/272)² = **1,61**. Elke nieuwe rit telt dus 61% te zwaar, en
binnen een week staat de hele fitheids-, vermoeidheids- en vormcurve verkeerd
zonder dat iemand ziet waarom.

**Onderliggend principe, breder dan FTP:**

> Een extern veld is nog geen waarheid. Ritdata uit een koppeling is meetbaar en
> bruikbaar; profielvelden uit een koppeling zijn wat iemand ooit heeft ingetikt.

---

## 1. Bindende besluiten

| # | Besluit |
|---|---|
| D1 | **FTP wordt niet uit Strava overgenomen** — niet als leidende waarde en niet als voorstel |
| D2 | **Rangorde van bronnen: trainer > sporter > Sparki's eigen afleiding > externe import.** Een lagere bron overschrijft nooit een hogere; hij mag hooguit voorstellen |
| D3 | **Sparki leidt zelf een FTP af** uit de powercurve: beste 20 minuten uit de laatste 6 weken × 0,95, aangeboden als voorstel met de bronrit erbij |
| D4 | **Bij elke gebruikte FTP wordt getoond waar hij vandaan komt**, met datum en bron |
| D5 | Sparki berekent **NP zelf** zodra er secondegegevens zijn; de waarde van een koppeling is terugvaloptie, en dan zichtbaar als zodanig |

---

## 2. Herstelwerk — eerst, want dit is kapotte data

### H1 — De overschreven FTP terugzetten

- zet de FTP van deze sporter vanaf 5 augustus terug op **345 W**, met bron
  "handmatig / trainer"
- markeer de rij van 272 W als afkomstig uit Strava en **niet leidend**
- herbereken de belasting van alle ritten die met 272 W zijn gerekend
- controleer of dit bij meer sporters is gebeurd en rapporteer dat aantal

### H2 — De overschrijving onmogelijk maken

Bij het wegschrijven van een profielwaarde uit een koppeling geldt: bestaat er een
waarde met een hogere rang (D2), dan wordt de geïmporteerde waarde **niet
opgeslagen als leidend**. Vastleggen bij elke FTP-rij: waarde · datum · bron
(`trainer` · `sporter` · `sparki_afgeleid` · `import`) · of hij leidend is.

### H3 — Hartslag uit de import halen

De import levert vandaag **geen hartslag**: TrainingPeaks heeft voor dezelfde rit
gemiddeld 152 en maximaal 187 bpm, Sparki heeft niets. Gevolgen: geen
hartslagzones, geen ontkoppeling, en de meetniveaudetectie ziet ten onrechte een
sporter zónder hartslagband — die krijgt straks een sensormelding voor iets wat hij
wél heeft. Haal de hartslagreeks en de samenvattingswaarden op en vul het
hartslagspoor.

### H4 — Duur in seconden

De duur wordt in hele minuten bewaard (188 in plaats van 187,6). Dat kost ~0,2% in
de TSS. Sla seconden op en reken daarmee.

---

## 3. Eigen NP-berekening

**Bevinding:** voor Strava-ritten neemt Sparki `weighted_average_watts` één-op-één
over (`lib/connectors/providers/strava.ts` r231). Dat is Strava's eigen variant en
verklaart de afwijking van −1,4% ten opzichte van de Coggan-NP van TrainingPeaks
(211 tegenover 214 W). Zonder Strava is er dus **helemaal geen** NP.

**Opdracht:** bereken NP zelf zodra er een vermogensreeks per seconde is —
voortschrijdend gemiddelde over 30 seconden, elke waarde tot de vierde macht, het
gemiddelde daarvan, dan de vierdemachtswortel. Leg vast hoe gaten en nulwaarden
worden behandeld en documenteer die keuze in de code.

Terugval: geen reeks beschikbaar → de waarde van de koppeling gebruiken, met
zichtbare bronvermelding. Nooit stilzwijgend mengen.

---

## 4. Wat de gebruiker ziet

- bij de FTP in het profiel: de waarde, de datum, en waar hij vandaan komt
- bij een afgeleid voorstel: "op basis van je beste 20 minuten op [datum], rit
  [naam]" — aanklikbaar naar die rit, zodat het terugleesbaar is
- een voorstel wordt **nooit stil doorgevoerd**: de sporter of trainer bevestigt
- wijkt het voorstel sterk af van de geldende waarde, dan is dat een melding aan de
  trainer, geen automatische wijziging

Dit is tegelijk een verkoopargument: in TrainingPeaks stond een oude 324 W in het
profiel zonder dat iemand het merkte. Sparki laat zien waar het getal vandaan komt
en wanneer het voor het laatst bevestigd is.

---

## 5. Acceptatietests

| # | Test | Verwacht |
|---|---|---|
| D-T1 | Strava-import bij een sporter met een handmatige FTP | handmatige waarde blijft leidend; import wordt hooguit als niet-leidende rij bewaard |
| D-T2 | De rit van 1 augustus opnieuw beoordelen na herstel | gerekend met 345 W |
| D-T3 | Rit met vermogensreeks | NP zelf berekend, bron zichtbaar als "Sparki" |
| D-T4 | Rit zonder reeks | NP van de koppeling, bron zichtbaar als "Strava" |
| D-T5 | Import van een rit met hartslag | hartslagreeks en gemiddelde/maximum aanwezig; meetniveau herkent het hartslagspoor |
| D-T6 | Duur van een rit van 3:07:37 | in seconden bewaard; TSS gerekend over 187,6 minuten |
| D-T7 | Afgeleid FTP-voorstel | verschijnt als voorstel met bronrit, wijzigt niets tot bevestiging |
| D-T8 | Profiel openen | bij de FTP staan waarde, datum en bron |

---

## 6. Volgorde

1. **H1 en H2** — kapotte data herstellen en de overschrijving dichtzetten
2. **H3** — hartslag uit de import
3. **H4** — duur in seconden
4. **§3** — eigen NP-berekening
5. **D3 en §4** — afgeleid FTP-voorstel met bronvermelding

---

## 7. Wat er níét gebouwd wordt

- geen FTP uit Strava, in welke vorm dan ook
- geen automatische wijziging van een FTP zonder bevestiging
- geen tweede belastingsberekening
- geen stille terugval op een externe waarde zonder zichtbare bron
