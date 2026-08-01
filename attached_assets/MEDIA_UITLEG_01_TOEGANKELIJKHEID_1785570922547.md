# MEDIA_UITLEG_01 — TOEGANKELIJKHEID

**Deel 6 van 20**

---

## 1. De harde regel

**Alles blijft volledig bruikbaar met animatie uit én met media uit.** Geen extra tik, geen omweg, geen verdwenen knop, en **geen aparte inferieure variant**. Dit is geen wens maar de eerste directe afkeurgrond.

De reduced-motionstand is niet een uitgeklede versie van de app. Het is dezelfde app, zonder beweging.

---

## 2. Verminder beweging

**T-1** De systeeminstelling `prefers-reduced-motion` wordt gerespecteerd.
**T-2** Sparki heeft daarnaast een eigen instelling, die onafhankelijk werkt. Staat één van beide aan, dan is beweging uit.
**T-3** Bij uitgeschakelde beweging verschijnt **direct de eindtoestand** — niet een snellere animatie en niet een andere layout.
**T-4** De instelling staat op een vindbare plek in de instellingen en wordt server-side bewaard, zodat hij op elk toestel geldt.
**T-5** Overgangen die het begrip dragen (een taak verplaatst zichtbaar naar "afgerond") worden vervangen door een tekstuele bevestiging, niet weggelaten.

---

## 3. Media

**T-6 Ondertiteling** is verplicht bij elke video en animatie met gesproken of tekstuele inhoud. Zonder ondertiteling geen publicatie.
**T-7 Tekstalternatief** is verplicht bij **alle** media, en is **volwaardig**: wie het leest, mist geen informatie. Een samenvatting voldoet niet — dat is een directe afkeurgrond.
**T-8 Zonder geluid begrijpelijk.** Geen informatie die alleen in het geluid zit.
**T-9 Snelheid 1× en 0,5×**, met name voor oefendemonstraties.
**T-10 Schermlezer.** Elke knop van de speler heeft een leesbare naam; de status (spelend, gepauzeerd, voltooid) is uitspreekbaar.
**T-11 Geen autoplay**, in geen enkele situatie — ook niet gedempt.

---

## 4. Algemeen

**T-12** Tikvlakken ≥ 48 dp, met 8 dp tussenruimte.
**T-13** Contrast ≥ 4,5:1 voor tekst, ≥ 3:1 voor betekenisdragende grafische elementen.
**T-14** Bruikbaar bij 200% systeemtekstgrootte: geen afgesneden tekst, geen onbereikbare knop, geen speler die buiten beeld valt.
**T-15** Status nooit alleen met kleur.
**T-16** Geen bediening die fijne motoriek vereist: geen swipe-only, geen dubbeltik, geen slepen als enige weg.
**T-17** Focusvolgorde blijft logisch wanneer een melding of speler opent, en keert terug waar hij vandaan kwam bij sluiten.

---

## 5. Toetsing

Toegankelijkheid wordt niet aan het eind getoetst maar per fase. In F1 wordt de basis bewezen; elke volgende fase toont opnieuw aan dat T-1 t/m T-17 gelden voor wat die fase toevoegt.

Het sluitbewijs is F10: elke flow uit de rolflows, met beweging uit en met media uit, identiek uitvoerbaar.

---

*Deel 6 van 20.*
