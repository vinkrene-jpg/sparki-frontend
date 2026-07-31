# SPARKI MASTER PLAN — FLOWPATCH 31 JULI 2026

**Status:** bindende aanvulling
**Beslisser:** René Vink
**Vervangt:** iedere oudere passage waarin Mirror, Replit, Claude, ChatGPT of een andere agent zelfstandig een product- of releasevrijgave kan geven

## 1. Canonieke ontwikkelstraat

Voor alle nieuwe en lopende opdrachten geldt:

`René geeft bouw vrij → compleet bouwpakket → Replit bouwt volledig → commit en push naar GitHub → Mirror toetst vaste SHA → René beslist → eventueel release`

De volledige uitwerking staat in `docs/governance/SPARKI_ONTWIKKELSTRAAT.md`.

## 2. Statusscheiding

De volgende statussen zijn inhoudelijk verschillend en mogen nooit automatisch in elkaar worden omgezet:

- `BUILD_DELIVERED`: Replit heeft gebouwd, getest, gecommit en gepusht.
- `MIRROR_PROVEN`: Mirror heeft de afgesproken vaste SHA technisch goedgekeurd.
- `RENE_APPROVED`: René heeft het resultaat inhoudelijk en productmatig goedgekeurd.
- `RELEASED`: de door René goedgekeurde versie is daadwerkelijk vrijgegeven.

Groene tests, een Replit-eindrapport, een positief Claude- of ChatGPT-oordeel en een Mirror-goedkeuring zijn geen vervanging voor `RENE_APPROVED`.

## 3. Rollen

### René

- enige Product Owner;
- neemt alle productbesluiten;
- geeft bouwopdrachten of bouwreeksen vrij;
- bepaalt na Mirror-toetsing of wordt goedgekeurd, hersteld, uitgebreid of gestopt;
- geeft als enige `RENE_APPROVED` en productievrijgave.

### ChatGPT

- regie, architectuur en samenhang;
- complete bouwpakketten en uitvoerbare vervolgopdrachten;
- synchronisatie van besluiten en status;
- geen productvrijgave namens René.

### Claude

- uitwerking van complete bouwpakketten;
- onafhankelijke analyse of review;
- geen productbesluit en geen productvrijgave.

### Replit

- volledige uitvoering binnen bestaande architectuur;
- alle code, tests en documentatie naar GitHub;
- vaste eind-SHA met bewijs;
- geen eigen productkeuze en geen definitieve vrijgave.

### Mirror

- onafhankelijke toets van een gecommitte en gepushte vaste SHA;
- geen codewijziging en geen bouwstart;
- PASS, FAIL of NIET BEWIJSBAAR per scenario;
- geen product- of releasevrijgave.

## 4. Voorrang

Bij conflict geldt:

1. recenter expliciet besluit van René;
2. `docs/governance/SPARKI_ONTWIKKELSTRAAT.md`;
3. deze flowpatch;
4. actuele besluitregisters en Master Plan-addenda;
5. bouwpakketten en synchronisatiepatches;
6. oudere opdrachten, drafts en rapporten.

## 5. GitHub als bron van waarheid

- Geen lokale-only bouwopdrachten, Mirror-toetsen, besluiten of synchronisatiepatches.
- Replit commit en pusht iedere oplevering.
- Mirror toetst niets zonder vaste remote SHA.
- Alle goedgekeurde bouwpakketten worden onder een vaste documentatiemap opgenomen.
- Een chatbericht of lokaal Replit-bestand is geen blijvende bron van waarheid.

## 6. Doorloop van een vrijgegeven reeks

Replit mag automatisch doorgaan binnen een door René vooraf vrijgegeven reeks wanneer:

- geen nieuw productbesluit nodig is;
- alle technische voorgangers op de vereiste status staan;
- de vorige opdracht volledig is opgeleverd;
- een verplichte Mirror-poort groen is;
- de reeks niet expliciet per onderdeel René-goedkeuring vereist.

Bij een echte product-, data-, privacy- of architectuurblokkade stopt Replit en stelt precies één concrete vraag.

## 7. Bestaande documenten

Oudere documenten blijven bruikbaar voor inhoudelijke productregels, maar passages over rollen, vrijgave, automatische voortgang en statussen worden door deze flowpatch overschreven wanneer ze hiermee botsen.
