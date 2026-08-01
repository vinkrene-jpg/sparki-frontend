# FUTUR_CONTROL_AGENT_GOVERNANCE

**Regelcodes:** `AGV-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Wat agents in Futur Control mogen, niet mogen, en hoe dat aantoonbaar is.

---

## 1. Vastgelegde positie

**AGV-01:** agents zijn **analist en voorstelmaker**. Zij voeren in deze fase niets uit.
**AGV-02:** eventuele uitvoerrechten komen uitsluitend in een **apart toekomstig pakket** met eigen rechtenbewijs en eigen Mirror-toets. Ze worden hier niet voorbereid als verborgen mogelijkheid.
**AGV-03:** **René blijft de enige definitieve vrijgever.** Geen agent geeft `RENE_APPROVED` af, in geen enkele omstandigheid.
**AGV-04:** dit is de voortzetting van het besluit `CTL-B4 = B` uit `SPARKI_CONTROL_01 v1.1`, nu productoverstijgend.

## 2. Wat een agent zelfstandig mag

logs lezen · code onderzoeken · tests draaien · bestanden vergelijken · metingen opvragen · kennisitems raadplegen · een analyse schrijven · een herstelvoorstel maken · een **conceptdiff** maken · documentatie voorbereiden · rapporteren.

**AGV-05:** een agent werkt altijd binnen een **agenttaak** met een opdracht, een reikwijdte en een aanleiding. Een agent zonder taak draait niet.
**AGV-06:** de reikwijdte is expliciet: welk product, welke omgeving, welke bronnen. Buiten de reikwijdte lezen is een bevinding.

## 3. Wat geen agent mag

naar productie deployen · databasegegevens verwijderen of wijzigen · rechten of beveiliging wijzigen · abonnementen aanpassen · betalingen of terugbetalingen uitvoeren · gebruikersdata exporteren · definitieve e-mails versturen · rollback uitvoeren · noodmodus activeren · kennisitems wijzigen · connectorrechten uitbreiden · secrets lezen of wijzigen · infrastructuurcommando's uitvoeren · een andere agent starten met ruimere rechten dan de eigen taak.

**AGV-07:** deze weigering is **server-side**. Het verbergen van een knop is geen bewijs; het bewijs is een geweigerde poging met auditregel.
**AGV-08:** een agent kan zijn eigen rechten niet uitbreiden, ook niet door een voorstel dat daarom vraagt goedgekeurd te krijgen — rechtenuitbreiding loopt buiten de agentstroom om.

## 4. Noodstop

**AGV-09:** de noodstop werkt **productoverstijgend**: één handeling zet alle agents, op alle producten, op alle omgevingen en op de lokale runtime onmiddellijk stil.
**AGV-10:** de noodstop is op **elk** scherm bereikbaar, desktop en mobiel, en werkt onder wedstrijddagomstandigheden (grote knop, bruikbaar met handschoenen, leesbaar in zonlicht).
**AGV-11:** geen agent kan de noodstop blokkeren, vertragen of ongedaan maken. Opheffen is een menselijke handeling met reden en auditregel.
**AGV-12:** na een noodstop blijft lopend werk als **conceptvoorstel** bewaard; er wordt niets half uitgevoerd, want er wordt niets uitgevoerd.

## 5. Zichtbaarheid

**AGV-13:** agentactiviteit is zichtbaar **per product** en **per incident**, en samengevat op *Vandaag als beheerder* onder de kaart *Agents wachten*.
**AGV-14:** per agenttaak zichtbaar: opdracht · reikwijdte · gebruikte bronnen · geraadpleegde kennisitems met ID en versie · duur · uitkomst · status.
**AGV-15:** een agentvoorstel dat een kennisitem gebruikt **noemt** dat kennisitem. Een voorstel zonder bronvermelding wordt niet ter goedkeuring aangeboden.
**AGV-16:** een agent maakt zijn onzekerheid expliciet: wat is waargenomen, wat is afgeleid, wat is niet onderzocht. Een voorstel zonder die driedeling is onvolledig.

## 6. Voorstel en goedkeuring

Stroom: **aanleiding → agenttaak → analyse → voorstel met conceptdiff → beoordeling door René → goedgekeurd of afgewezen met reden**.

**AGV-17:** goedkeuring betekent uitsluitend *dit voorstel mag verder in de keten*. Er wordt door de goedkeuring zelf niets uitgevoerd.
**AGV-18:** afwijzen zonder reden is onmogelijk. De reden gaat naar het auditspoor en is bruikbaar als kennisitem.
**AGV-19:** een goedgekeurd voorstel wordt door een **mens** of door een expliciet daarvoor ingerichte bouwstroom (Replit) uitgevoerd, nooit door de agent die het voorstelde.
**AGV-20:** de uitvoering van een goedgekeurd voorstel volgt de normale vrijgaveketen `BUILT → TESTED → MIRROR_PROVEN → RENE_APPROVED → DEPLOYED → LIVE_VERIFIED`.

## 7. Kennisitems

**AGV-21:** iedere afgeronde storing, bug, supportzaak, release-incident, beveiligingsincident en synchronisatieprobleem wordt omgezet naar een kennisitem met minimaal: oorzaak · oplossing · getroffen onderdelen · bewijs · herstelduur · regressietests · voorkomen in de toekomst · relevante documentatie · relevante bouwpakketten · relevante Mirror-toetsen.
**AGV-22:** een zaak kan niet worden gesloten zonder conceptkennisitem; publicatie vraagt menselijke bevestiging.
**AGV-23:** agents mogen kennis **gebruiken** bij incidentanalyse, support, regressiecontrole en voorstelvorming, maar mogen haar **niet stilzwijgend wijzigen**. Iedere wijziging krijgt versie, auteur, datum en auditspoor.
**AGV-24:** een agent mag wél een **wijzigingsvoorstel** op een kennisitem indienen; dat loopt door dezelfde goedkeuringsstroom.
**AGV-25:** kennisitems zijn productoverstijgend doorzoekbaar, maar dragen altijd hun herkomstproduct mee. Een oplossing uit Sparki wordt nooit als bewezen gepresenteerd voor FPS Connect.

## 8. Lokale agents (NAS en mini-server)

**AGV-26:** een lokale agent mag uitsluitend: systeemstatus lezen · logs verzamelen · back-ups controleren · tests draaien · herstelvoorstellen maken · bestanden vergelijken · rapporteren.
**AGV-27:** een lokale agent mag **niet** zelfstandig: bestanden verwijderen · NAS-volumes wijzigen · RAID herstellen · poorten openen · firewallregels wijzigen · updates installeren · productiegegevens terugzetten · servers herstarten · secrets wijzigen. Hiervoor blijft expliciete goedkeuring vereist.
**AGV-28:** de lokale agent werkt met **uitgaande** verbindingen en ontvangt geen opdrachten via een open inkomende poort.
**AGV-29:** de lokale agent valt onder dezelfde noodstop als de overige agents.

## 9. Audit

**AGV-30:** iedere agentactie staat in het auditspoor: taak · actor · handeling · onderwerp · gebruikte bronnen · resultaat · duur · reikwijdte.
**AGV-31:** een geweigerde poging wordt **ook** gelogd, met de reden van weigering. Weigeringen zijn het bewijsmateriaal voor de rechtenmatrix.
**AGV-32:** agentkosten en -verbruik worden geregistreerd per taak, zodat zichtbaar is wat analyse kost. Geen schatting: wat niet gemeten wordt, is `Onbekend`.

## 9a. Verhouding tot de vrijgavepoort

**AGV-33:** het openen van de vrijgavepoort voor een externe muterende functie (`FUTUR_CONTROL_MUTATION_GATE.md`) verandert **niets** aan de positie van agents. De poort betreft de **keten**, niet de agent. Ook na `MIRROR_PROVEN` en `RENE_APPROVED` blijft een agent analist en voorstelmaker; uitvoerrechten voor agents zijn en blijven een apart toekomstig pakket met eigen rechtenbewijs en eigen Mirror-toets. Wie dit verwart, geeft een agent uitvoerrechten op grond van bewijs dat daar niet over ging.

**AGV-34:** in de basisversie mag Control **agents stoppen binnen Control** — dat is een interne handeling en valt niet onder de poort. Wat een agent **niet** mag, is enig waarneembaar effect veroorzaken in een aangesloten product, op infrastructuur of bij een externe dienst. Een agent die een NAS-commando, een herstart, een configuratiewijziging of een externe melding zou versturen, wordt geweigerd omdat dat pad niet bestaat.

## 10. Directe afkeurgronden

- Een agent voert een handeling uit die effect heeft buiten zijn eigen taakrecords.
- De vrijgave van een muterende functie wordt gebruikt om agentrechten uit te breiden.
- Een verboden handeling wordt alleen in de interface geblokkeerd, niet server-side.
- Een kennisitem verandert zonder versie, auteur, datum of auditregel.
- Een agentvoorstel gebruikt kennis zonder bronvermelding.
- De noodstop is niet op elk scherm bereikbaar, of een agent kan hem beïnvloeden.
- Een agent breidt zijn eigen reikwijdte of rechten uit.
- Een lokale agent voert een van de negen verboden lokale handelingen uit.
- Agentactiviteit is niet herleidbaar tot product en incident.
