# FUTUR_CONTROL_MOBILE_DESKTOP_UX

**Regelcodes:** `FUX-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Volgt `MOBILE_UX_STANDARD_01` (v1.4), `SPARKI_MOBILE_COMPONENT_LIBRARY.md`, `SPARKI_MOBILE_PATTERNS.md` en `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md`. Dit document beschrijft alleen wat voor de beheeromgeving anders of aanvullend is.

---

## 1. Apparaatdoctrine

| Code | Regel |
|---|---|
| FUX-01 | Mobiel is **geen verkleinde desktop**. Twee ontwerpen, één informatiemodel, dezelfde volgorde. |
| FUX-02 | Desktop is voor **begrijpen en besluiten met volledige context**. Telefoon is voor **merken, begrijpen en ingrijpen**. |
| FUX-03 | Wat op de telefoon niet veilig of niet volledig te beoordelen is, wordt daar niet aangeboden — ook niet in verkorte vorm. |
| FUX-04 | Elke handeling die op de telefoon ontbreekt, verwijst zichtbaar naar waar zij wél kan. Geen doodlopende schermen. |

## 2. Verdeling

### Desktop
diep onderzoek · lange diffs · complexe filters · rapporten · releaseconfiguratie · afhankelijkheidskaarten · productvergelijking · volledige Capability Matrix · auditdoorzoeking · connectorbeheer · infrastructuurdetail · kennisitems bewerken.

### Telefoon
Vandaag als beheerder · kritieke meldingen · incident begrijpen · product en getroffen functie zien · agent pauzeren of stoppen · voorstel beoordelen · blokkeren · supportzaak toewijzen · noodstop · status van externe diensten · contact- en noodhandleiding.

**FUX-05:** de mobiele lijst is een **maximum**, geen minimum. Wat er niet op staat, komt er niet bij zonder expliciet besluit.

## 3. Vandaag als beheerder

**FUX-06:** dit is de startpagina van Futur Control op **beide** apparaten, met dezelfde twaalf kaarten in dezelfde volgorde:

1. Kritieke meldingen · 2. Incidenten · 3. Open goedkeuringen · 4. Agents wachten · 5. Releases · 6. Support · 7. Product Health · 8. Synchronisaties · 9. Back-ups · 10. Mirror-resultaten · 11. Nieuwe waarschuwingen · 12. Planning vandaag

**FUX-07:** iedere kaart heeft vijf vaste elementen: korte samenvatting · **één** primaire actie · detailpagina · auditlink · laatste wijziging (tijdstip én actor).

**FUX-08 — meerdere producten:** elke kaart toont per product een regel zodra er meer dan één product is aangesloten. De volgorde binnen een kaart is: ernst eerst, dan tijd. Niet alfabetisch, niet op productnaam.

**FUX-09 — infrastructuur hoort erbij:** NAS en mini-server verschijnen als eigen regels binnen de kaarten *Back-ups*, *Nieuwe waarschuwingen* en *Product Health*. Zij worden niet weggestopt in een aparte hoek.

**FUX-10 — leeg versus onbekend:** een kaart zonder inhoud toont eerlijk `Geen open incidenten` met tijdstip van de laatste controle. Een kaart waarvan de **bron** ontbreekt toont `Onbekend`. Dat verschil moet in het scherm zichtbaar zijn. Een lege kaart verdwijnt niet.

| | Desktop | Telefoon |
|---|---|---|
| Kaartinhoud | Uitgebreid: samenvatting, cijfers, trend, laatste drie gebeurtenissen, per product | Kort: samenvatting, één getal, één actie |
| Zichtbaarheid | Alle twaalf in beeld | Onder elkaar, kritieke meldingen altijd bovenaan |
| Detail | Zijpaneel of tweede kolom toegestaan | Altijd een apart scherm, nooit uitklap op de kaart |
| Primaire actie | Direct uitvoerbaar met bevestiging | Binnen de mobiele grenzen van §4 |

## 4. Wat mag waar

**FUX-11 — vastgelegd, met open punt:** *blokkeren mag mobiel; vrijgeven vraagt sterke bevestiging.* De vraag of mobiel **überhaupt** definitief mag goedkeuren staat nog open als `FC-B06`.

**FUX-11a — fasegrens:** in de basisversie is elke handeling in de tabel hieronder die effect zou hebben **buiten Control** niet beschikbaar op enig apparaat. Dat betreft: noodmodus activeren (`F11B`, `DEFERRED`), releases vrijgeven en deployen, infrastructuurherstel, en elke configuratie- of rechtenwijziging in een product. Zij staan in de tabel omdat de tabel het **doelbeeld** beschrijft; tot de mutatiepoort `MIRROR_PROVEN` is, staan zij overal op `Nee` en tonen zij zichtbaar waarom (`MUT-05`). Wat wél op beide apparaten werkt, is het **blokkeren**, het **vastleggen** van een besluit en het **stoppen van agents binnen Control** — dat zijn interne handelingen.

| Handeling | Telefoon | Desktop |
|---|---|---|
| Noodstop agents | Ja, altijd bereikbaar | Ja |
| Release **blokkeren** | Ja | Ja |
| Release **vrijgeven** (`RENE_APPROVED`) | Alleen met sterke herbevestiging — afhankelijk van `FC-B06` | Ja |
| Agentvoorstel goedkeuren | Ja, met reden uit keuzelijst | Ja, met vrije reden |
| Agentvoorstel afwijzen | Ja, reden uit keuzelijst | Ja |
| Supportzaak toewijzen of pauzeren | Ja | Ja |
| Supportantwoord schrijven en verzenden | Nee | Ja |
| Volledige diff beoordelen | Nee — alleen samenvatting | Ja |
| Releaseconfiguratie | Nee | Ja |
| Noodmodus activeren | Nee | Ja, met sterke bevestiging |
| Rechten of connectoren wijzigen | Nee | Ja |
| Kennisitem bewerken | Nee — alleen lezen | Ja |
| Infrastructuurherstelhandeling goedkeuren | Nee | Ja |

**FUX-12:** een handeling die op de telefoon "nee" is, wordt daar wel **getoond** met de reden en de plek waar zij kan. Verbergen zonder uitleg is verwarrender dan tonen met grens.

## 5. Offline

**FUX-13:** offline betekent in v1 voor Control: bestaande weergave blijft leesbaar met zichtbare tijdstempel; elke handeling wordt geweigerd met een offlinemelding. Er komen **geen** handelingen in een wachtrij. Een goedkeuring die later automatisch alsnog verstuurt is onaanvaardbaar in een beheeromgeving.
**FUX-14:** na verbindingsherstel volgt automatisch hersynchronisatie met zichtbare uitkomst, geen dubbele sync, geen verborgen achtergrondacties.

## 6. Wedstrijddagomstandigheden, vertaald naar beheer

**FUX-15:** de noodstop en de kaart *Kritieke meldingen* volgen het regime van de wedstrijddagmodus: grote knoppen, bedienbaar met handschoenen, leesbaar in zonlicht, één regel tekst, geen invoer nodig, bruikbaar in beweging. Een storing overkomt je niet op een bureau.

## 7. Meldingen

**FUX-16:** een notificatie bevat nooit gevoelige inhoud en opent bij aantikken exact de bedoelde handeling.
**FUX-17:** drie niveaus: **kritiek** (doorbreekt stilte, alleen bij `Kritiek` met gebruikersimpact of bij break-glass) · **belangrijk** (normale melding) · **stil** (alleen in de app). Het niveau ligt vast per gebeurtenistype, niet per stemming.
**FUX-18:** een agent kan geen melding op kritiek niveau veroorzaken. Alleen gemeten productstatus, beveiligingssignalen en infrastructuur mogen dat.

## 8. Productvergelijking

**FUX-19:** alleen op desktop. Vergelijking toont dezelfde indicatoren naast elkaar per product, met per cel de bron. Er wordt **niet** gerangschikt en er wordt **geen** score gegeven — een product met minder metingen is niet "slechter", het is minder gemeten.

## 9. Mirror-eisen voor de UX

Toetsing volgt `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` (`MTS-01..69`), aangevuld met:
- alle twaalf kaarten aanwezig, in volgorde, op beide apparaten;
- precies één primaire actie per kaart;
- elke auditlink opent het juiste gefilterde spoor;
- minstens één kaart aantoonbaar leeg en minstens één aantoonbaar `Onbekend`, zichtbaar verschillend;
- noodstop bereikbaar op elk scherm, ook tijdens een openstaand detailscherm;
- geen handeling in wachtrij bij offline;
- echt mobiel bewijs op een fysiek toestel, geen desktopbrowser op smal formaat;
- geen voorbeelddata, geen fictieve producten, geen verzonnen aantallen.

## 10. Directe afkeurgronden

- Mobiel is een responsive kopie van de desktop.
- Een kaart ontbreekt, staat verkeerd, of heeft meer dan één primaire actie.
- `Geen` waar `Onbekend` hoort, of andersom.
- Een handeling die mobiel niet mag, is verborgen zonder uitleg of leidt naar een doodlopend scherm.
- Offline zet een handeling in een wachtrij.
- Een notificatie bevat gevoelige inhoud of opent de verkeerde plek.
- Productvergelijking toont een score of rangschikking.
