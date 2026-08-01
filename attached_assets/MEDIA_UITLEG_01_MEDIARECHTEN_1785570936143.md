# MEDIA_UITLEG_01 — MEDIARECHTEN EN PUBLICATIEPOORT

**Deel 7 van 20**

---

## 1. De poort

Geen enkel mediabestand wordt publiceerbaar zonder **alle** onderstaande gegevens. Ontbreekt er één, dan blijft de content op een eerdere status staan en verschijnt hij niet.

| Gegeven | Waarom |
|---|---|
| maker | wie het gemaakt heeft |
| bron | waar het vandaan komt |
| licentie | onder welke voorwaarden |
| gebruiksrecht | of Sparki het zo mag gebruiken |
| toegestane landen | indien de licentie dat beperkt |
| toegestane doelgroep | wie het mag zien |
| geldigheidsduur | indien de licentie aflooptt |
| versie | welke versie dit is |
| datum laatste controle | wanneer het is nagekeken |
| verantwoordelijke beoordelaar | wie het heeft goedgekeurd |
| ondertiteling | toegankelijkheidseis |
| tekstalternatief | toegankelijkheidseis |
| leeftijdsclassificatie | jeugdpoort |
| veiligheidscontrole | bij oefen- en techniekinhoud |

Eigenaar van deze gegevens: `KENNIS_01`. De weergavelaag controleert alleen of ze er zijn.

---

## 2. Statussen

```
concept
  → inhoudelijk beoordeeld
    → rechten gecontroleerd
      → toegankelijkheid gecontroleerd
        → technisch getest
          → gepubliceerd
            → ingetrokken
```

**Regels**
- De volgorde wordt niet overgeslagen. Technisch getest zonder rechtencontrole bestaat niet.
- Alleen `gepubliceerd` is zichtbaar voor gebruikers.
- `ingetrokken` is een eindstatus; heruitgave gebeurt als nieuwe versie.
- Elke statuswijziging legt vast: wie, wanneer, en op welke grond.

---

## 3. Intrekken

**I-1** Intrekken stopt **nieuwe** vertoning onmiddellijk.
**I-2** Een bestaande verwijzing toont een eerlijke niet-beschikbaarstatus: wat er stond, waarom het weg is, wie dat kan oplossen, en wat de gebruiker nu doet.
**I-3** **Geen gebroken leeg vlak**, geen gebroken-beeldicoon, geen stille verdwijning.
**I-4** Voortgang blijft als historie bestaan. Wie de oefening had afgevinkt, houdt dat.
**I-5** Vervangende content kan expliciet worden gekoppeld; dan wijst de niet-beschikbaarstatus daarnaar.
**I-6** Een reeds gedownload bestand op een toestel kan Sparki niet terughalen — dat wordt in de app ook niet gesuggereerd.

---

## 4. Pilotmedia

Tijdelijke testmedia mag in de eerste pilot **uitsluitend** wanneer alle vijf gelden:

1. de rechten zijn aantoonbaar;
2. het bestand is duidelijk als pilotasset geregistreerd;
3. het bevat geen mock- of verzonnen persoonlijke gegevens;
4. het is niet publiek buiten de pilot;
5. het is vervangbaar **zonder codewijziging** — dus via het contentmodel, niet via een verwijzing in de frontend.

Voldoet één punt niet, dan gaat de pilot zonder media door. De tekstvariant is dan de volledige inhoud.

---

## 5. Directe afkeurgronden

- Media zonder aantoonbare rechten.
- Publicatie zonder ondertiteling of zonder volwaardig tekstalternatief.
- Een mediabestand dat in de frontend is vastgelegd in plaats van via het contentmodel.
- Een ingetrokken bestand dat nog vertoond wordt.
- Een gebroken leeg vlak waar ingetrokken content stond.

---

*Deel 7 van 20.*
