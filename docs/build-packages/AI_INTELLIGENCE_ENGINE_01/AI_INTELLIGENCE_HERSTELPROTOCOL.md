# AI_INTELLIGENCE — HERSTELPROTOCOL

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Deel 18 van 21**

---

## 1. Bij een bevinding

1. **Codeer.** AIE-code, fase, en de bewering die het raakt.
2. **Weeg.** Directe afkeurgrond of herstel nodig.
3. **Herstel binnen dezelfde fase.** Een tekortkoming schuift niet door.
4. **Hertoets de hele bewering**, niet alleen het gerepareerde geval. Een reparatie aan de confidence vereist opnieuw alle F2-scenario's.
5. **Nieuwe SHA.** Het eerdere bewijs vervalt voor de betrokken bewering.

---

## 2. Bij een directe herstelgrond

Geen gedeeltelijke goedkeuring. De fase blijft `AFGEKEURD` tot de grond weg is. Met name:

- **verzonnen persoonlijke data** → de bron wordt losgekoppeld, niet gemarkeerd als "voorlopig";
- **verzonnen citatie** → de wetenschapslaag gaat uit, niet in een waarschuwingskader;
- **taalmodel overschrijft een berekening** → de aanroep vervalt; niet repareren met een strengere prompt;
- **consentlek** → onmiddellijk dicht, en vaststellen wat er is uitgelekt.

---

## 2a. Bij verlies van een bestaand advies

Verdwijnt een bestaand, werkend advies door de invoering van het adviesdossier, dan geldt de omgekeerde volgorde: **eerst terugzetten, dan onderzoeken.** De herleidbaarheidslaag is een toevoeging; hij mag geen bestaande begeleiding wegnemen.

Een legacy-advies wordt **nooit** hersteld door de ontbrekende velden alsnog in te vullen met afgeleide of geschatte waarden. Het houdt zijn status `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` tot het door een nieuw advies wordt vervangen.

## 3. Bij regressie in bestaande functionaliteit

**Eerst terugdraaien, dan onderzoeken.** Deze laag is een toevoeging aan een werkend product. Hij mag nooit de reden zijn dat iets bestaands stukgaat.

---

## 4. Wat nooit als herstel telt

| Schijnoplossing | Waarom niet |
|---|---|
| Een strengere prompt om een verzinnend model te temmen | het model blijft de bron van de fout; de regel is dat het niet mag verzinnen, niet dat het minder moet verzinnen |
| Een drempel verlagen zodat "onvoldoende basis" minder vaak optreedt | dat maakt B10 onwaar |
| Een confidencegetal invoeren dat "ongeveer klopt" | een niet-berekend getal is een verzonnen getal |
| Een conflict oplossen door één bron standaard voorrang te geven | dat is de bronhiërarchie, en dat is een productbesluit |
| Een verouderde observatie "nog even" als actueel laten staan | dat is precies de afkeurgrond |
| Een advies tonen zonder dossier omdat het dossier later komt | zonder dossier bestaat het advies niet |
| Een providercall buiten de gateway toestaan voor een test | één uitzondering maakt de poort geen poort meer |
| Ontbrekende velden van een legacy-advies invullen met afgeleide waarden | dat is verzonnen persoonlijke waarheid met een net jasje |
| Een bestaand advies verbergen omdat het geen dossier heeft | dat is geen herstel maar verlies van begeleiding |
| Doorgaan met F1 terwijl de overgang nog niet bewezen is | de activering van "niet tonen zonder dossier" is juist de laatste stap |
| Automatisch conflict beslechten "om de gebruiker te helpen" | dat is besluit O-2, en dat ligt bij René |

---

## 5. Terugdraaien

Elke fase afzonderlijk. **Uitzondering:** F1 terugdraaien betekent alle volgende fasen terugdraaien, omdat het adviesdossier eronder ligt. Daarom is F1 klein gehouden.

Half afgebouwd blijft niet staan achter een schakelaar; het gaat terug.

---

## 6. Bij een pauze tussen fasen

De laatste `MIRROR_PROVEN` SHA is het vertrekpunt. Openstaande bevindingen blijven met hun AIE-codes op de herstellijst. De statustabel wordt bijgewerkt: waar het stopte en waarom.

---

*Deel 18 van 21.*
