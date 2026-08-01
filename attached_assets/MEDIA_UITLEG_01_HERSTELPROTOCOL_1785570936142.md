# MEDIA_UITLEG_01 — HERSTELPROTOCOL

**Deel 13 van 20**

---

## 1. Bij een gevonden tekortkoming

1. **Codeer de bevinding.** MTS-code plus de onderliggende CMP-, PAT- of MUX-code. Zonder codes terug naar de indiener.
2. **Bepaal de zwaarte.** Directe afkeurgrond (deel 10, lijst van 21) of tekortkoming na weging.
3. **Herstel binnen dezelfde fase.** Een tekortkoming uit F3 gaat niet mee naar F4; de fase blijft open.
4. **Hertoets de hele dimensie**, niet alleen het gerepareerde scherm. Een reparatie aan de speler vereist opnieuw alle F3-scenario's.
5. **Nieuwe SHA.** Herstel levert een nieuwe vaste SHA; het eerdere bewijs vervalt voor de betrokken dimensie.

---

## 2. Bij een directe afkeurgrond

Geen gedeeltelijke goedkeuring, geen "we lossen het volgende fase op". De fase blijft `BUILT_UNPROVEN` tot de grond weg is. Met name:

- **media zonder rechtenbewijs** → verwijderen uit de weergave, niet tijdelijk toestaan;
- **coachadvies uit verzonnen gegevens** → de melding uitzetten, niet als voorbeeld markeren;
- **acute melding permanent onderdrukbaar** → geen release van F7;
- **functie onbruikbaar zonder animatie** → zie hoofdstuk 4.

---

## 3. Bij regressie in bestaande functionaliteit

**Eerst terugdraaien, dan onderzoeken.** Deze laag is een toevoeging; hij mag nooit de reden zijn dat iets bestaands stukgaat. De volgorde is hier omgekeerd aan het normale herstel.

---

## 4. Wat nooit als herstel telt

| Schijnoplossing | Waarom niet |
|---|---|
| Een extra knop toevoegen om een functie bereikbaar te maken die zonder animatie verdween | dat is een tweede product, geen herstel |
| De tekstvariant inkorten tot een samenvatting om hem sneller te laten laden | dan is toegankelijkheid een vinkje geworden |
| Een melding onderdrukken in plaats van hem correct te laten verschijnen | het probleem verdwijnt uit beeld, niet uit de app |
| Een oefening zonder rechten "voorlopig" laten staan met een notitie | een notitie is geen licentie |
| Autoplay achter een instelling zetten | het blijft autoplay |
| Een aparte, eenvoudigere reduced-motionvariant bouwen | expliciete afkeurgrond |
| Een verouderde uitleg laten staan met een waarschuwing erbij | verouderde uitleg is erger dan geen uitleg |

---

## 5. Terugdraaien

Iedere fase is afzonderlijk terug te draaien zonder de vorige te raken. Daarom is F1 klein en staan de componenten daarna los: valt F6 om, dan blijven F2 en F3 overeind.

**Uitzondering:** F1 terugdraaien betekent alle volgende fasen terugdraaien.

**Half afgebouwd blijft niet staan.** Een component dat niet af is, gaat terug — niet in productie met een schakelaar eromheen.

---

## 6. Bij een pauze tussen fasen

- De laatste `MIRROR_PROVEN` SHA is het vertrekpunt bij hervatting.
- De statustabel in het README wordt bijgewerkt: waar het stopte en waarom.
- Openstaande bevindingen blijven met hun codes op de herstellijst staan.

---

*Deel 13 van 20.*
