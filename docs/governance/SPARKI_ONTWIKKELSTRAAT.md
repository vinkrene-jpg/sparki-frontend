# SPARKI — DEFINITIEVE ONTWIKKELSTRAAT

**Status:** bindend
**Vastgelegd:** 31 juli 2026
**Product Owner:** René

## 1. Doel

Deze werkwijze geldt voor alle Sparki-bouwopdrachten, herstelopdrachten, domeinpakketten en releases.

De kern is:

> Replit bouwt volledig. GitHub bewaart de bron. Mirror toetst onafhankelijk. René geeft vrij.

Geen AI-systeem, testagent of bouwer mag namens René een product- of releasevrijgave geven.

## 2. Rollen

### René — Product Owner en enige vrijgever

René:

- neemt productbesluiten;
- bepaalt prioriteiten;
- geeft opdrachten vrij voor uitvoering;
- beoordeelt Mirror-rapporten;
- besluit na een afkeuring over herstel, aanpassing of uitbreiding;
- geeft als enige de definitieve product- en releasevrijgave.

### ChatGPT — regie en samenhang

ChatGPT:

- bewaakt de totale productlijn;
- schrijft of controleert complete bouwpakketten;
- bewaakt afhankelijkheden en overlap;
- verwerkt nieuwe besluiten in de documentatie;
- vertaalt opleveringen en Mirror-rapporten naar de volgende uitvoerbare stap;
- neemt geen productbesluit namens René.

### Claude — uitwerking en onafhankelijke ondersteuning

Claude:

- werkt complete bouwpakketten uit;
- schrijft aanvullende Replit-opdrachten en Mirror-toetsen;
- kan inhoudelijke en technische verbeteringen voorstellen;
- neemt geen zelfstandig productbesluit;
- geeft geen definitieve vrijgave.

### Replit — volledige uitvoering

Replit:

- voert iedere vrijgegeven bouwopdracht volledig uit;
- levert frontend, backend, database, rechten, communicatie, foutafhandeling, mobiel, desktop en tests op wanneer die in de opdracht staan;
- bouwt geen parallel systeem wanneer bestaande architectuur herbruikbaar is;
- neemt geen eigen productbesluiten;
- commit en pusht alle code en documentatie naar GitHub;
- levert een vaste eindcommit met bewijs;
- verklaart een opdracht niet definitief vrijgegeven.

### Mirror — onafhankelijke toets

Mirror:

- toetst uitsluitend gecommitte en gepushte code op een vaste commit-SHA;
- wijzigt geen code;
- start geen bouwopdracht;
- neemt geen productbesluit;
- geeft per scenario PASS, FAIL of NIET BEWIJSBAAR;
- levert één eindoordeel: GOEDGEKEURD, AFGEKEURD MET CONCRETE BLOKKADE of NIET BEWIJSBAAR;
- geeft geen product- of releasevrijgave.

## 3. Vaste flow

1. René geeft een productbesluit of bouwopdracht vrij.
2. ChatGPT of Claude levert een compleet bouwpakket.
3. Replit voert het volledige pakket uit.
4. Replit commit en pusht alles naar GitHub.
5. Replit levert start-SHA, eind-SHA, gewijzigde bestanden, migraties, tests, exitcodes en bewijs.
6. Mirror toetst de vaste eindcommit onafhankelijk.
7. Mirror levert een toetsrapport.
8. René besluit:
   - goedkeuren;
   - gerichte herstelactie;
   - aanvullende bouw;
   - productbesluit aanpassen;
   - niet vrijgeven.
9. Alleen na expliciete goedkeuring door René krijgt het pakket de status `RENE_APPROVED`.
10. Pas daarna mag de volgende afhankelijke opdracht starten of mag productie-vrijgave plaatsvinden.

## 4. Harde regels

- Een opdracht is niet afgerond omdat Replit zegt dat hij klaar is.
- Een opdracht is niet afgerond omdat tests groen zijn.
- Een opdracht is niet afgerond omdat Mirror technisch goedkeurt.
- Een opdracht is pas definitief afgerond na expliciete vrijgave door René.
- Mirror-goedkeuring en René-vrijgave zijn twee verschillende statussen.
- Geen toets zonder vaste gecommitte en gepushte SHA.
- Geen lokale-only bouwdocumenten: alles wordt in GitHub opgeslagen.
- Geen wijziging van tests, acceptatiecriteria of productregels om een afkeuring te laten verdwijnen.
- Herstel uitsluitend de concrete blokkade, tenzij de gedeelde architectuur aantoonbaar breder geraakt is.

## 5. Statussen

Gebruik uitsluitend deze statussen:

- `DRAFT`
- `READY_FOR_RENE`
- `RENE_RELEASED_FOR_BUILD`
- `IN_BUILD`
- `BUILD_DELIVERED`
- `IN_MIRROR_REVIEW`
- `MIRROR_FAILED`
- `MIRROR_NOT_PROVABLE`
- `MIRROR_PROVEN`
- `RENE_APPROVED`
- `RELEASED`
- `SUPERSEDED`
- `ARCHIVED`

`MIRROR_PROVEN` betekent uitsluitend dat Mirror de afgesproken toets heeft goedgekeurd.

`RENE_APPROVED` betekent dat René het resultaat inhoudelijk en productmatig heeft vrijgegeven.

`RELEASED` betekent dat de goedgekeurde versie daadwerkelijk in de bedoelde omgeving is vrijgegeven.

## 6. Automatische doorloop

Replit mag alleen automatisch naar een volgende opdracht doorgaan wanneer:

- René de reeks vooraf expliciet heeft vrijgegeven;
- de volgende opdracht geen nieuwe productkeuze vraagt;
- alle harde technische voorgangers op de vereiste status staan;
- de vorige opdracht volledig is opgeleverd;
- een vereiste Mirror-poort is gepasseerd;
- de opdracht niet expliciet om afzonderlijke René-vrijgave vraagt.

Bij twijfel stopt Replit en legt één concrete vraag voor. Het verzint geen besluit.
