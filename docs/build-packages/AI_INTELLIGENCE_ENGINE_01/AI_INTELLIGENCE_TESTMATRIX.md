# AI_INTELLIGENCE — TESTMATRIX

**Deel 19 van 21**

---

## 0. Uitgangspunt

**AIE-97** Getest wordt met **gecontroleerde echte testdata**. Geen publiek zichtbare mockdata, en nooit testdata die als gebruikerswaarheid in beeld komt.

Per fase geldt de relevante doorsnede; F12 draait de volledige matrix. Een cel die niet van toepassing is, wordt met reden vastgelegd — "niet getest" is geen uitkomst.

---

## 1. De twaalf pilotscenario's

| # | Scenario | Wat het bewijst | Zwaarste toets |
|---|---|---|---|
| 1 | actief wedstrijddoel + planning + herstel | B1, B3, B4 | advies noemt alle drie als bron |
| 2 | gemiste training + extra ongeplande rit | B3 | de ongeplande rit telt mee, wordt niet als fout behandeld |
| 3 | slecht herstel versus zware trainerstraining | B3, B5 | trainer blijft leidend waar vastgelegd; signaal komt aan |
| 4 | twee conflicterende databronnen | B2 | conflict getoond, niet stil samengevoegd |
| 5 | dubbele activiteit | B2 | duplicaat herkend, één keer geteld, keuze zichtbaar |
| 6 | verouderde hersteldata | B2 | gemarkeerd als verouderd, zekerheid daalt |
| 7 | trainer past voorstel aan | B5 | sporter ziet **wat** de trainer aanpaste |
| 8 | sporter negeert advies | B9 | keuze blijft staan, niet herhaald, in het audittrail |
| 9 | eerdere observatie later hergebruikt | B8 | reden voor hergebruik ingevuld |
| 10 | wetenschappelijke vraag buiten de kennisbank | B6 | eerlijk "redactionele kennis", of een beoordeelde bron |
| 11 | minderjarige met veiligheidsmelding | B10 | niet te negeren, met een **echt** minderjarig account |
| 12 | toestemming wordt ingetrokken | B5 | toegang vervalt onmiddellijk, adviezen erop ingetrokken |

---

## 2. Gebruikers

gast · sporter volwassen · **sporter minderjarig** · sporter zonder gekoppelde trainer · sporter met één trainer · sporter met meerdere trainers · trainer · hoofdtrainer · clubbeheerder · teammanager · ploegleider · mechanieker · soigneur · `medical_staff` · ouder of verzorger · admin · gebruiker zonder toestemming · gebruiker in meerdere teams · gebruiker met meerdere rollen.

## 3. Datatoestanden

alle bronnen aanwezig en actueel · één bron ontbreekt · meerdere bronnen ontbreken · alle bronnen verouderd · twee bronnen in conflict · duplicaat aanwezig · handmatige invoer aanwezig · alleen handmatige invoer · geen historie · lange historie · onderbroken historie · koppeling net gelegd · koppeling net verbroken.

## 4. Situaties

rustmoment · actieve navigatie · actieve training · wedstrijddagmodus · onboarding · formulier · acute melding actief · medische waarschuwing actief · direct na een activiteit · dag vóór een wedstrijd · in een herstelweek · na een geblesseerde periode.

## 5. Systeemtoestanden

taalmodel beschikbaar · taalmodel traag · taalmodel uitgevallen · engine uitgevallen · bronkoppeling uitgevallen · zoektechniek niet beschikbaar · consent ingetrokken tijdens gebruik · rol ingetrokken tijdens gebruik.

---

## 6. Verplichte kruisingen

Deze worden altijd gedraaid, ook bij een kleine fase:

| Kruising | Waarom |
|---|---|
| minderjarig account × acute melding | de jeugdgrens |
| geen enkele bron × adviesverzoek | B10: "onvoldoende basis" moet echt werken |
| twee conflicterende bronnen × advies | B2 zonder stille samenvoeging |
| taalmodel uitgevallen × adviesverzoek | eerlijke fout of deterministische terugval |
| consent ingetrokken × lopend advies | intrekking werkt vooruit én terug |
| ploegleider × sporter met beperking | uitsluitend inzetbaarheid, geen reden |
| meerdere rollen × één advies | geen samengevoegd beeld |
| verouderde observatie × nieuw advies | niet als actueel gepresenteerd |

---

*Deel 19 van 21.*
