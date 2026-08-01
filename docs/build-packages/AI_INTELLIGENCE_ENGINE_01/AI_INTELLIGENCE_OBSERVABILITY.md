# AI_INTELLIGENCE — OBSERVATIE EN PRODUCT HEALTH

**Deel 14 van 21**

---

## 1. Wat gemeten wordt

| Meting | Waarvoor het dient |
|---|---|
| aantal adviezen | volume |
| deterministisch versus taalmodel | of de verhouding klopt met AIE-13 |
| adviezen met onvoldoende data | of B10 werkelijk werkt |
| adviezen zonder vervolgactie | schending van "geen advies zonder vervolgstap" |
| geweigerde outputs | of de veiligheidsgrenzen daadwerkelijk bijten |
| escalaties naar mens | of het systeem op tijd overdraagt |
| ongebruikte adviezen | of adviezen aankomen |
| geaccepteerde adviezen | of ze bruikbaar zijn |
| genegeerde adviezen | of ze passend zijn |
| later tegengesproken adviezen | de belangrijkste kwaliteitsmaat |
| geheugenhergebruik | of B8 werkelijk werkt |
| foutpercentages | technische kwaliteit |
| latency | ervaring |
| kosten | beheersbaarheid |
| bronzoekfouten | betrouwbaarheid van F9 |
| consentweigeringen | of de rechtenlaag bijt |

**AIE-91** "Later tegengesproken adviezen" is de meting die het meeste zegt en het minst vleit. Hij wordt niet weggelaten omdat hij ongemakkelijk is.

---

## 2. Wat nooit gemeten wordt

**AIE-92** Geen gevoelige inhoud in algemene analytics: geen gezondheidsinhoud, geen medische reden, geen inhoud van een advies of melding, geen vrije tekst van de gebruiker.

**AIE-93** Metingen zijn doelgebonden en minimaal: het type, het advies-ID, de uitkomst. Nooit de tekst.

---

## 3. Verhouding tot Futur Control

**AIE-94** Deze metingen zijn **later aansluitbaar** op Product Health in Futur Control. Futur Control is **geen bouwvoorwaarde** voor dit pakket; er wordt hier geen koppeling gebouwd en geen afhankelijkheid gecreëerd.

**AIE-95** Waar een meetbron nog niet bestaat, toont de meting expliciet `Onbekend`. Geen schattingen, geen benaderingen, geen tijdelijk handmatig ingevoerde waarden.

---

*Deel 14 van 21.*
