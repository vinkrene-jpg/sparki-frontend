# AI_INTELLIGENCE — DATA TRUST

**Deel 5 van 21**

---

## 1. Bronnen

Twintig bronnen die de Intelligence-laag combineert. F0 stelt vast welke er werkelijk zijn, hoe ze heten en waar ze staan.

profiel · actieve doelen · trainingsplan · uitgevoerde activiteiten · CTL/ATL/TSB · FTP en zones · slaap · herstel · subjectieve feedback · blessures en beperkingen · wedstrijden · routes en hoogteprofiel · materiaal · trainerinput · handmatige invoer · Strava · Garmin · Whoop · bestandsimport · (F0 vult aan wat hier ontbreekt)

---

## 2. Wat per bron wordt vastgelegd

| Veld | Betekenis |
|---|---|
| herkomst | welk systeem of welke persoon |
| tijdstip | wanneer gemeten of ingevoerd |
| actualiteit | hoe oud, afgezet tegen de geldigheidsduur van dit soort gegeven |
| betrouwbaarheid | wat er bekend is over de kwaliteit van deze bron |
| invoerder | gebruiker of systeem |
| conflicten | met welke andere bron, op welk punt |
| duplicaten | welke andere registratie hetzelfde gebeuren beschrijft |
| ontbrekende waarden | welke velden leeg zijn |
| toestemming | op welke grond dit gegeven gebruikt mag worden |
| gebruiksdoel | waarvoor het in dit advies is gebruikt |

---

## 3. Harde regels

**AIE-19** Geen mock-, seed- of fallbackdata als persoonlijke waarheid. Een testwaarde die als gebruikersgegeven wordt gepresenteerd, is een directe afkeurgrond.

**AIE-20** Een ontbrekende bron **verlaagt de zekerheid**. Hij wordt niet vervangen, geschat of geïnterpoleerd.

**AIE-21** Een verouderde bron wordt als verouderd gemarkeerd, met de leeftijd erbij. Wat "verouderd" is, verschilt per soort gegeven en wordt in F2 per brontype vastgelegd — niet per advies bepaald.

**AIE-22** Conflicterende bronnen worden **niet stil samengevoegd**. Het conflict wordt getoond, met beide waarden en hun herkomst. Wordt er toch één gekozen, dan staat de reden erbij.

**AIE-23** Duplicaten worden aantoonbaar herkend: dezelfde rit uit Strava en Garmin telt één keer mee, en het advies laat zien welke registratie is aangehouden.

**AIE-24** Handmatige invoer blijft herkenbaar als handmatig, ook nadat hij is verwerkt.

**AIE-25 — De bronhiërarchie wordt niet door Replit verzonnen.** Welke bron voorgaat bij een conflict, is een productbesluit. Tot dat besluit er is, toont het systeem het conflict en kiest het niet. Zie de open punten.

---

## 4. Verhouding tot de bestaande Data Trust-regels

Deze laag **past de bestaande regels toe**; hij vervangt ze niet en breidt ze niet uit zonder besluit. F0 stelt vast welke regels er al zijn en waar ze worden toegepast. Blijkt een regel te ontbreken die hier nodig is, dan is dat een bevinding — geen invulopdracht.

---

*Deel 5 van 21.*
