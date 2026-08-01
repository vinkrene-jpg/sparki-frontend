# SPARKI — ROLGESTUURDE MOBIELE FLOWS v1.2

**Technische code:** `MOBILE_ROLE_FLOWS_01` — oplevering 3 van 5
**Hoort bij:** `SPARKI_MOBILE_UX_STANDARD_v1.4.md` en `SPARKI_MOBILE_COMPONENT_LIBRARY.md` (beide bindend)
**Versie:** v1.2 — media- en uitlegaanvullingen per rol (1 augustus 2026)
**Status:** BINDEND, afgeleid. Geen nieuwe MUX-regels, geen nieuwe componenten, geen productbesluiten.
**Datum:** 1 augustus 2026

---

## 0. Hoe dit document werkt

Dit document beschrijft hoe iedere rol Sparki op de telefoon ervaart. Het bedenkt niets nieuws: het zet bestaande MUX-regels en CMP-componenten om in een rolbeeld.

**Rolbasis eerst.** Hoofdstuk 1 legt vast wat voor *élke* rol geldt — eerste login, hervatten, fouten, offline, contextwissel, toegankelijkheid. Per rol staat daarna alleen wat er **anders** of **specifiek** is. Dat voorkomt dertien keer dezelfde alinea en, belangrijker, voorkomt dat één rol per ongeluk een eis mist.

**Vaste opbouw per rol:** rolstatus · doel · kenmerkentabel · schermprioriteit · situaties met hun keten · wedstrijdmodus · Mirror-toetslijst.

**Wat hier niet staat.** Rechten en zichtbaarheidsregels worden hier *toegepast*, niet vastgesteld — die horen bij `CLUB_RECHTEN_01`. Waar dit document "ziet niet" schrijft, is dat een UX-consequentie van een bestaand besluit, geen nieuw rechtenbesluit.

---

## 1. Rolbasis — wat voor élke rol geldt

**RB-01 Eerste login.** Iedere rol landt op zijn eerste scherm uit MUX-76a met CMP-14 erboven: welke rol, voor welke organisatie, wat je hiermee kunt, wat nog ontbreekt, en één concrete eerste actie (MUX-100). Geen generiek welkom, geen fictieve personen, geen voorbeelddata (MUX-51).

**RB-02 Vaste plattegrond.** Vijf hoofditems, voor alle rollen gelijk in aantal, naam, icoon en volgorde. Alleen de inhoud erachter verschilt (MUX-14, CMP-01). Een item dat een rol niet gebruikt, blijft staan met een lege toestand.

**RB-03 Eerste bruikbare interactie.** De kernbediening van het eerste scherm werkt vóór de zware laag geladen is (MUX-98, CMP-13). Per rol staat hieronder wát dat kernonderdeel is.

**RB-04 Hervatten.** Elke taak van meer dan één stap overleeft onderbreking en opent op de laatst afgeronde stap met een zichtbare regel waar de gebruiker was gebleven (MUX-42, MUX-64).

**RB-05 Fouten.** In gewone taal, bij het veld of bij het onderdeel, zonder codes of veldnamen (MUX-45, MUX-52).

**RB-06 Lege omgeving.** CMP-14 zolang de rol nog geen echte toewijzing én geen echte taak heeft (MUX-100h). Daarna CMP-29 met de vier verplichte elementen (MUX-48).

**RB-07 Geen toestemming.** Nooit stil verbergen. Het scherm zegt dat de gebruiker dit niet mag zien, waarom, en wie het kan oplossen (MUX-48, MUX-49).

**RB-08 Geen actieve taken.** Positief gebracht, niet als leegte (MUX-50). "Er staat niets open" is een uitkomst, geen storing.

**RB-09 Contextwissel.** Rol- en organisatiewissel via één vaste plek, permanent zichtbaar (MUX-62, CMP-02). Wisselen gebeurt nooit vanzelf. Een automatische contextwissel *binnen* een rol mag alleen op een controleerbaar feit en wordt aangekondigd (MUX-97c, MUX-93).

**RB-10 Organisatiewissel.** Na wisselen blijft de gebruiker op het equivalente scherm, niet op een startpagina. Gegevens van twee organisaties worden nooit gemengd getoond.

**RB-11 Offline.** Alleen een gestarte navigatie loopt door (MUX-53). Al het overige toont CMP-30. Geen schrijfacties, geen wachtrij, geen lokale bevestiging zonder server (MUX-54, MUX-55). Bij herstel automatisch opnieuw ophalen met zichtbare uitkomst (MUX-53a).

**RB-12 Zoeken en filters.** Zoekveld zodra een lijst langer is dan één schermhoogte (CMP-17); daaronder filters als chips (CMP-18). Zoekterm en filter blijven staan bij terugkeer.

**RB-13 Meldingen.** Rolgebonden: alleen wat hoort bij de actieve rol, plus wat het eigen account raakt (MUX-79). Iedere melding leidt naar een scherm waar de actie ook echt uitvoerbaar is (MUX-65).

**RB-14 Deeplinks.** Openen het bedoelde scherm met een werkende terugweg, ook als er nog ingelogd moet worden (MUX-63). Een deeplink naar een rol die de gebruiker niet heeft, valt onder RB-07.

**RB-15 AI.** Adviseert, voert niets uit zonder bevestiging, onderbreekt nooit tijdens navigatie, training, wedstrijd, onboarding of een formulier, en onderbouwt elk advies (MUX-89 t/m MUX-92, CMP-34, CMP-35).

**RB-16 Toegankelijkheid.** Tikvlak ≥ 48 dp, contrast ≥ 4,5:1, bruikbaar bij 200% tekstgrootte, status nooit alleen met kleur, elk icoon uitspreekbaar (MUX-66 t/m MUX-69).

**RB-17 Geen doodlopende flow.** Elke flow eindigt met een vervolgstap of een zichtbare terugweg (MUX-88); elke functie benoemt zijn hoofdtaak (MUX-99).

**RB-18 Bouwvolgorde.** Een rolscherm wordt niet gebouwd voordat de rolwaarde server-side bestaat (MUX-75).

---

## 2. Rolstatus

| Rol | Rolwaarde | Bouwstatus | Eerste scherm |
|---|---|---|---|
| Sporter | bestaat | bouwbaar | Vandaag |
| Trainer | bestaat | bouwbaar | Trainingen |
| Hoofdtrainer | bestaat | bouwbaar | Groepen |
| Clubbeheerder | bestaat | bouwbaar | Organisatie |
| Teammanager | bestaat | bouwbaar | Teams |
| Ploegleider | `ploegleider` | bouwbaar | Wedstrijddag |
| Mechanieker | bestaat | bouwbaar | Materiaal |
| Soigneur | `soigneur` | bouwbaar | Voeding |
| Medical Staff | `medical_staff` | bouwbaar | Gezondheid |
| Ouder | bestaat | bouwbaar, alleen-lezen-eerst (MUX-04) | Kind |
| Gast | bestaat | bouwbaar | Introductie |
| Admin | bestaat | bouwbaar | Systeemstatus |
| Eigenaar | relatie `owner`, geen rolwaarde | bouwbaar als CMP-16 | startscherm van de beheerrol |

---

## 3. De rollen

### 3.1 Sporter

**Doel:** vandaag rijden, en begrijpen wat het opleverde.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Vandaag** — één dag, niet de week |
| Kernvraag | wat staat er vandaag, en past dat bij hoe ik erbij zit |
| Primaire hoofdtaak | training of rit starten, uitvoeren en afronden |
| Eerste bruikbare interactie | de startknop van de geplande sessie (CMP-07), vóór grafieken en kaart laden |
| Secundaire taken | route plannen, rit terugkijken, materiaal bijwerken, beschikbaarheid melden |
| Contexten (MUX-97) | dagelijks · trainen · koers · herstel |
| Componenten | CMP-01, 07, 08, 11, 12, 13, 17, 25, 30, 31, 32, 34, 35 |
| AI | plan- en herstelvoorstellen op rustmomenten; zwijgt tijdens de rit (RB-15) |
| Meldingen | wijziging in de eigen planning, terugkoppeling van de trainer, selectie voor een wedstrijd |
| Deeplinks | naar de sessie van vandaag, naar een gedeelde route, naar een wedstrijd |
| Zoeken/filters | routes en activiteiten; filter op type en periode |
| Verboden informatie | gegevens van andere sporters buiten wat een gedeelde groep of wedstrijd toont; eigen medische notities van de medische staf alleen voor zover gedeeld |
| Desktop | **mobiel leidend** — de sessie wordt op de fiets gestart en achteraf op de bank teruggekeken; desktop toont dezelfde dag met meer historie ernaast |

**Schermprioriteit:** 1) een acuut signaal dat de dag raakt · 2) de sessie van vandaag · 3) wat van hem gevraagd wordt (beschikbaarheid, terugkoppeling) · 4) de komende dagen · 5) laatste rit · 6) historie en trends.

**Situaties**

- **Gewone dag** — wil weten of er iets van hem verwacht wordt. Eerste actie: sessie starten of de dag als rustdag bevestigen.
- **Training** — sessie starten, uitvoeren, afronden. Keten: *plan → starten → uitvoeren → afronden → terugkoppelen → analyse.*
- **Route plannen** — gebeurt op de mobiele webpagina (MUX-05). Zoekveld en resultaten eerst, kaart en hoogteprofiel na selectie (MUX-98, CMP-13).
- **Route rijden** — navigatie start; offline loopt de gestarte navigatie door (RB-11).
- **Klim toevoegen aan route** — nooit als losse verkenning. Keten in hoofdstuk 6.
- **Wedstrijd** — programma, eigen rol in de selectie, vertrektijd. In de modus: hoofdstuk 7.
- **Herstel** — subjectieve terugkoppeling in maximaal drie keuzes, geen vrije invoer (MUX-09).
- **Materiaal** — kilometerstand en slijtage; keten naar controle of melding aan de mechanieker.
- **Analyse** — nooit als eindpunt. Keten: *analyse → plan aanpassen* (MUX-99).

**Wedstrijdmodus:** verdwijnt — analyse, historie, marktplaats, AI. Blijft — vertrektijd, eigen rol in de ploeg, verzamelpunt, verbindingstoestand. Vervangen — CMP-01 door CMP-39, CMP-11 door CMP-37.

**Mirror:** eerste scherm is Vandaag · startknop bedienbaar vóór grafieken · geen analyse zonder vervolgstap · rit afronden eindigt niet doodlopend · offline loopt de navigatie door en meldt de rest eerlijk · geen gegevens van andere sporters buiten gedeelde context.

---

### 3.2 Trainer

**Doel:** de sporters die vandaag iets van hem nodig hebben, verder helpen.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Trainingen** |
| Kernvraag | wie wacht vandaag op mij |
| Primaire hoofdtaak | een training goedkeuren, aanpassen of terugkoppeling geven |
| Eerste bruikbare interactie | de lijst met openstaande sporters, aantikbaar vóór grafieken laden |
| Secundaire taken | groep bekijken, wedstrijdvoorbereiding, sporterprofiel raadplegen |
| Contexten (MUX-97) | thuis · training · wedstrijd · onderweg |
| Componenten | CMP-01, 05, 07, 08, 09, 11, 12, 13, 17, 18, 25, 30, 34, 35 |
| AI | voorstellen voor plan­aanpassing; altijd met onderbouwing (CMP-35), nooit zelf uitgevoerd |
| Meldingen | afmelding van een sporter, afgeronde sessie die om terugkoppeling vraagt, acuut signaal binnen zijn groep |
| Deeplinks | naar één sporter, naar één sessie, naar een groep |
| Zoeken/filters | sporters en sessies; filter op groep, status en periode |
| Verboden informatie | medische dossiers zonder expliciete toestemming; betaal- en facturatiegegevens; gegevens van sporters buiten zijn koppeling |
| Desktop | **desktop leidend** voor plannen en periodiseren, **mobiel leidend** voor de dagelijkse afhandeling. Reden: opbouwen kost overzicht, afhandelen kost tijd |

**Schermprioriteit:** 1) acuut signaal in de groep · 2) openstaande terugkoppeling · 3) de sessies van vandaag · 4) komende week · 5) groepsoverzicht · 6) historie.

**Situaties**

- **Training voorbereiden** — keten: *sporter of groep → sessie kiezen → toewijzen → bevestigen*.
- **Training aanpassen** — wijziging is zichtbaar voor de sporter; die krijgt een melding, niet een stilzwijgend gewijzigd plan (MUX-93c).
- **Sporters bekijken** — een profiel is een detail met vervolgstap (CMP-12), nooit alleen informatie.
- **Terugkoppeling** — kort, uit keuzes waar mogelijk; eindigt met CMP-15.
- **Analyse** — keten naar planaanpassing.
- **Wedstrijd** — voorbereiding en nabespreking; de operationele wedstrijdlaag hoort bij de ploegleider, niet hier.

**Wedstrijdmodus:** verdwijnt — analyse, planning verderop dan vandaag, AI. Blijft — eigen sporters in de wedstrijd, vertrektijd, contactweg. Vervangen — CMP-11 door CMP-37.

**Mirror:** eerste scherm is Trainingen · openstaande sporters bedienbaar vóór grafieken · geen medisch dossier zonder toestemming · aangepaste training leidt aantoonbaar tot een melding bij de sporter · terugkoppeling eindigt met een vervolgstap.

---

### 3.3 Hoofdtrainer

**Doel:** zien of iedere groep bemenst en op koers is, en ingrijpen waar dat niet zo is.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Groepen** |
| Kernvraag | welke groep heeft een probleem |
| Primaire hoofdtaak | een trainer aan een groep koppelen, of een signaal doorzetten |
| Eerste bruikbare interactie | de groepenlijst met bezettingsstatus (CMP-09), vóór jaarplanning en trends |
| Secundaire taken | jaarplanning bewaken, wedstrijdselectie voorbereiden, trainers ondersteunen |
| Contexten | geen aparte contexten in v1 (MUX-97g) |
| Componenten | CMP-01, 05, 07, 08, 09, 10, 12, 13, 17, 18, 25, 28, 30 |
| AI | signaleert patronen op groepsniveau; nooit een oordeel over een individuele trainer |
| Meldingen | groep zonder trainer, groep zonder plan, opgeschaald signaal uit een groep |
| Deeplinks | naar één groep, naar één trainer |
| Zoeken/filters | groepen en trainers; filter op bezetting en leeftijdscategorie |
| Verboden informatie | medische dossiers; individuele gezondheidsdata in groepsoverzichten; betaalgegevens |
| Desktop | **uitgebreider op desktop** — jaarplanning en selectie zijn overzichtstaken; mobiel is de signaalkant |

**Schermprioriteit:** 1) groep zonder trainer of zonder plan · 2) opgeschaalde signalen · 3) komende wedstrijdselectie · 4) jaarplanning · 5) trainersoverzicht · 6) historie.

**Situaties**

- **Groepen** — bezetting en status per groep; keten naar koppelen.
- **Trainers** — wie is waaraan gekoppeld en wie heeft te veel.
- **Jaarplanning** — mobiel alleen bekijken en akkoord geven; opbouwen op desktop.
- **Wedstrijdselectie** — voorstel bekijken en vrijgeven; samenstellen op desktop.
- **Signalen** — keten: *signaal → betrokken trainer → actie → afgehandeld*.

**Wedstrijdmodus:** niet van toepassing tenzij hij zelf een operationele rol heeft; dan geldt die rol.

**Mirror:** eerste scherm is Groepen · onbemenste groep staat bovenaan · geen individuele gezondheidsdata in een groepsoverzicht · signaal eindigt aantoonbaar bij een verantwoordelijke.

---

### 3.4 Clubbeheerder

**Doel:** de organisatie ingericht en de mensen op hun plek krijgen.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Organisatie** |
| Kernvraag | wat is nog niet ingericht en wat wacht op mij |
| Primaire hoofdtaak | één openstaand verzoek afhandelen |
| Eerste bruikbare interactie | de lijst met openstaande verzoeken (CMP-11) |
| Secundaire taken | leden beheren, groepen indelen, rollen toekennen, abonnement bekijken |
| Contexten | geen aparte contexten in v1 |
| Componenten | CMP-01, 05, 07, 08, 10, 11, 12, 14, 16, 17, 18, 21, 24, 25, 26, 28, 29, 30 |
| AI | helpt bij inrichting en uitleg; kent geen rollen toe en verstuurt geen uitnodigingen (MUX-89b) |
| Meldingen | inschrijving, toestemmingsverzoek, rol zonder invulling, abonnementsgebeurtenis |
| Deeplinks | naar één lid, naar een uitnodiging, naar het organogram |
| Zoeken/filters | leden; filter op rol, groep en status |
| Verboden informatie | medische dossiers; inhoudelijke gezondheidsdata; trainingsinhoud van individuele sporters buiten wat het beheer vereist |
| Desktop | **desktop leidend** voor inrichten, **mobiel leidend** voor afhandelen. Reden: inrichten is structuurwerk, afhandelen is dagwerk |

**Schermprioriteit:** 1) blokkerende inrichting (ontbrekende toestemming, rol zonder invulling) · 2) openstaande verzoeken · 3) ledenmutaties · 4) groepen · 5) abonnement · 6) historie.

**Situaties**

- **Onboarding** — CMP-21 met maximaal vijf stappen, opslaan per stap, hervatten (MUX-17, MUX-41).
- **Leden** — instroom, mutatie, uitstroom; jeugdtoestemming vóór echte jeugdleden instromen.
- **Groepen** — indelen; keten naar trainer koppelen.
- **Rollen** — toekennen en intrekken. Intrekken is onomkeerbaar genoeg voor CMP-26 en wordt bij de betrokkene zichtbaar (MUX-93c).
- **Abonnement** — bekijken; wijzigen alleen door de eigenaar (CMP-16).
- **Uitnodigingen** — versturen en opvolgen; keten eindigt bij een geactiveerd account, niet bij "verstuurd".

**Wedstrijdmodus:** niet van toepassing.

**Mirror:** eerste scherm is Organisatie · blokkerende inrichting staat bovenaan · rol intrekken vraagt bevestiging én is zichtbaar bij de betrokkene · uitnodigingsketen eindigt bij activering · geen gezondheidsdata zichtbaar.

---

### 3.5 Teammanager

**Doel:** het team compleet en beschikbaar houden.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Teams** |
| Kernvraag | is de bezetting voor het komende blok rond |
| Primaire hoofdtaak | een renner of staflid toevoegen, bevestigen of vervangen |
| Eerste bruikbare interactie | de teamlijst met beschikbaarheidsstatus |
| Secundaire taken | seizoen inrichten, staf beheren, abonnement, meerdere teams |
| Contexten | geen aparte contexten in v1 |
| Componenten | CMP-01, 02, 05, 07, 08, 09, 11, 12, 16, 17, 18, 21, 24, 25, 28, 30 |
| AI | signaleert gaten in bezetting en beschikbaarheid; vult niets in |
| Meldingen | afmelding, ontbrekende bevestiging, wijziging in het programma |
| Deeplinks | naar één team, één renner, één evenement |
| Zoeken/filters | renners en staf; filter op team, beschikbaarheid en rol |
| Verboden informatie | medische dossiers; gezondheidsdata in teamoverzichten (MUX-76a) |
| Desktop | **uitgebreider op desktop** voor seizoen en meerdere teams; mobiel voor bevestigen en vervangen |

**Schermprioriteit:** 1) ontbrekende bevestiging voor het eerstvolgende blok · 2) afmeldingen · 3) bezetting komend blok · 4) seizoensopbouw · 5) staf · 6) historie.

**Situaties**

- **Teams** — samenstelling en beschikbaarheid.
- **Seizoen** — inrichten op desktop, bijstellen op mobiel.
- **Staf** — toewijzen; grens met de operationele wedstrijdlaag ligt bij de ploegleider.
- **Renners** — toevoegen, vervangen, uitschrijven.
- **Abonnement** — bekijken; wijzigen via CMP-16 door de eigenaar.
- **Meerdere teams** — via CMP-02; gegevens worden nooit gemengd (RB-10).

**Wedstrijdmodus:** aangeboden wanneer hij zelf meegaat; anders blijft het normale beeld met een wedstrijdkaart.

**Mirror:** eerste scherm is Teams · ontbrekende bevestiging bovenaan · wisselen tussen twee teams mengt niets · geen gezondheidsdata in het teamoverzicht.

---

### 3.6 Ploegleider

> **Pakketgrens.** `CLUB_RECHTEN_01` is eigenaar van rollen, rechten, scopes en autorisatie — ook van de rolwaarde `ploegleider`. `PLOEGLEIDER_01` bouwt de operationele wedstrijdlaag: wedstrijdbezetting, dagschema, voertuigen, materiaal, taken, rode vlaggen en conflictsignalering. `PLOEGLEIDER_01` bouwt **geen tweede rechtenarchitectuur** en definieert geen eigen rolbegrip. Kort: onboarding maakt de organisatie gereed, de ploegleider maakt de wedstrijd uitvoerbaar, en de rechten komen van één plek.

**Doel:** de wedstrijd uitvoerbaar maken en houden.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Wedstrijddag** |
| Kernvraag | is het eerstvolgende evenement rond, en wat wringt er |
| Primaire hoofdtaak | bezetting bevestigen of een vervanging regelen |
| Eerste bruikbare interactie | de bezettingskaart van het eerstvolgende evenement |
| Secundaire taken | dagschema, voertuigen en materiaal, taken, terugkoppeling, evaluatie |
| Contexten (MUX-97) | voorbereiding · wedstrijddag · koers · evaluatie |
| Componenten | CMP-01, 02, 05, 07, 09, 11, 12, 15, 17, 24, 25, 26, 28, 30, 37, 38, 39 |
| AI | signaleert conflicten in bezetting en schema; wijzigt niets |
| Meldingen | afmelding, conflict, rode vlag, wijziging in het programma |
| Deeplinks | naar één evenement, naar de bezetting, naar het dagschema |
| Zoeken/filters | renners en staf per evenement |
| Verboden informatie | medische dossiers; alleen de geschiktheidsuitkomst, niet de onderliggende gezondheidsgegevens |
| Desktop | **mobiel leidend** — dit is een rol die vrijwel altijd buiten staat; desktop dient voor voorbereiding en evaluatie |

**Schermprioriteit:** 1) rode vlaggen · 2) conflicten en gaten in de bezetting · 3) dagschema van vandaag · 4) materiaal en voertuigen · 5) terugkoppeling · 6) evaluatie en historie.

**Situaties**

- **Voorbereiding** — keten: *evaluatie vorige wedstrijd → selectie → staf → voertuigen en materiaal → dagschema → bevestigen*.
- **Wedstrijddag** — modus actief; taken als CMP-37, noodhandeling als CMP-38.
- **Etappe** — meerdaags; per dag hetzelfde schema, met de vorige dag als context.
- **Trainingskamp** — zelfde modus, langere horizon, meer nadruk op dagschema dan op bezetting.
- **Evaluatie** — keten naar de volgende voorbereiding; nooit een eindpunt (MUX-99).

**Wedstrijdmodus:** verdwijnt — evaluatie, historie, marktplaats, AI, alles buiten dit evenement. Blijft — dagschema, bezetting, verbindingstoestand, noodhandeling. Vervangen — CMP-01 door CMP-39, CMP-11 door CMP-37, CMP-26 door CMP-32 behalve bij de noodhandeling.

**Mirror:** gebruikt de centrale rolwaarde `ploegleider` uit `CLUB_RECHTEN_01`, geen eigen rolbegrip en geen tweede rechtenlaag · eerste scherm is Wedstrijddag · rode vlaggen bovenaan · noodhandeling meldt eerlijk dat er zonder verbinding niets verstuurd is (MUX-96h) · geen onderliggende gezondheidsdata zichtbaar · evaluatie leidt naar de volgende voorbereiding.

---

### 3.7 Mechanieker

**Doel:** materiaal op tijd in orde hebben.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Materiaal** |
| Kernvraag | wat moet er klaar zijn vóór het eerstvolgende vertrek |
| Primaire hoofdtaak | een materiaaltaak afvinken of een defect melden |
| Eerste bruikbare interactie | de takenlijst voor het eerstvolgende evenement (CMP-11) |
| Secundaire taken | controle uitvoeren, voorraad bijhouden, terugkomst afhandelen |
| Contexten (MUX-97) | werkplaats · vertrek · wedstrijd · terugkomst |
| Componenten | CMP-01, 07, 09, 11, 12, 17, 18, 20, 25, 30, 32, 37, 38, 39 |
| AI | signaleert slijtage en herhaalde defecten; bestelt en plant niets |
| Meldingen | nieuw defect, gewijzigde selectie met materiaalgevolg, vertrektijd verschoven |
| Deeplinks | naar één fiets, één defect, één evenement |
| Zoeken/filters | materiaal; filter op renner, type en status |
| Verboden informatie | gezondheidsgegevens; persoonsgegevens buiten wat nodig is om materiaal aan een renner te koppelen |
| Desktop | **mobiel leidend** — dit werk gebeurt met vieze handen naast een fiets |

**Schermprioriteit:** 1) defect dat vertrek blokkeert · 2) taken vóór vertrek · 3) controlelijst · 4) voorraad · 5) terugkomst · 6) historie per fiets.

**Situaties**

- **Materiaal** — overzicht per renner en per fiets; keten naar controle.
- **Controle** — afvinklijst; één tik per punt, geen invoer in de modus (MUX-96g).
- **Defect** — melden met keuze uit oorzaken; keten: *defect → beoordeling → reparatie of vervanging → gereedmelding*.
- **Vertrek** — alles gereed of expliciet niet; nooit stilzwijgend "waarschijnlijk goed" (MUX-10).
- **Terugkomst** — schade en slijtage vastleggen; keten naar de volgende controle.

**Wedstrijdmodus:** verdwijnt — voorraad, historie, AI. Blijft — takenlijst, vertrektijd, defecten, noodhandeling. Vervangen — CMP-11 door CMP-37.

**Mirror:** eerste scherm is Materiaal · blokkerend defect bovenaan · afvinken werkt met één tik en 64 dp in de modus · gereedmelding is nooit lokaal bevestigd zonder server · geen gezondheidsdata zichtbaar.

---

### 3.8 Soigneur

**Doel:** verzorging en bevoorrading op tijd rond hebben.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Voeding** |
| Kernvraag | wat moet er klaar zijn voor het eerstvolgende dagdeel |
| Primaire hoofdtaak | een taak afvinken of een bijzonderheid melden |
| Eerste bruikbare interactie | de taken van het eerstvolgende dagdeel |
| Secundaire taken | bevoorrading klaarzetten, verzorging plannen, herstel ondersteunen |
| Contexten (MUX-97) | voorbereiding · verzorging · voeding · herstel |
| Componenten | CMP-01, 07, 09, 11, 12, 17, 18, 20, 25, 30, 32, 37, 38, 39 |
| AI | signaleert bevoorradingsgaten; geeft geen individueel voedingsadvies |
| Meldingen | wijziging in het dagschema, bijzonderheid bij een renner, vertrektijd verschoven |
| Deeplinks | naar één renner, één dagdeel, één evenement |
| Zoeken/filters | renners en taken; filter op dagdeel |
| Verboden informatie | medische dossiers; **geen gewichts- of calorieadvies bij minderjarigen**, ook niet in deze rolweergave |
| Desktop | **mobiel leidend** — het werk gebeurt in de wagen en in het hotel |

**Schermprioriteit:** 1) bijzonderheid bij een renner · 2) taken voor het eerstvolgende dagdeel · 3) bevoorrading · 4) dagschema · 5) herstel · 6) historie.

**Situaties**

- **Voeding** — wat, voor wie, wanneer. Bij minderjarigen zonder getallen over gewicht of calorieën.
- **Bevoorrading** — aantallen via CMP-20; keten naar gereedmelding.
- **Verzorging** — planning per renner en dagdeel.
- **Herstel** — ondersteunende taken; medische beoordeling ligt bij de medische staf, niet hier.

**Wedstrijdmodus:** verdwijnt — historie, AI, alles buiten het dagdeel. Blijft — taken, dagschema, bijzonderheden, noodhandeling. Vervangen — CMP-11 door CMP-37.

**Mirror:** eerste scherm is Voeding · geen gewichts- of calorieweergave bij een minderjarige · taken afvinkbaar met handschoenen · bijzonderheid bereikt aantoonbaar de juiste persoon · geen medisch dossier zichtbaar.

---

### 3.9 Medical Staff

> **Rolwaarde:** `medical_staff`. De eerdere waarde `medic` is ingetrokken. Een functietype binnen deze rol (arts, fysiotherapeut, verzorgend medewerker) blijft **beschrijvend** en verleent geen rechten — rechten komen uitsluitend van de rolwaarde en de toestemming.

**Doel:** signalen op tijd zien en beoordelen, binnen de toestemming die er is.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Gezondheid** |
| Kernvraag | is er iets acuuts |
| Primaire hoofdtaak | een melding beoordelen en afhandelen |
| Eerste bruikbare interactie | de lijst met acute meldingen (CMP-09) |
| Secundaire taken | toestemming aanvragen, dossier openen, monitoring, herstel volgen |
| Contexten (MUX-97) | monitoring · blessure · herstel · wedstrijd |
| Componenten | CMP-01, 07, 09, 11, 12, 14, 24, 25, 26, 29, 30, 32, 39 |
| AI | signaleert afwijkende patronen; stelt geen diagnose en beoordeelt niets |
| Meldingen | acuut signaal, nieuwe toestemming, gewijzigde beschikbaarheid |
| Deeplinks | uitsluitend naar dossiers waarvoor toestemming bestaat; anders RB-07 |
| Zoeken/filters | binnen de eigen toegestane groep |
| Verboden informatie | alles waarvoor geen toestemming is; gezondheidsdata verschijnen nooit in team- of groepsoverzichten van andere rollen |
| Desktop | **desktop leidend** voor dossier en verslaglegging, **mobiel leidend** voor acute meldingen |

**Schermprioriteit:** 1) acute meldingen · 2) openstaande toestemmingsverzoeken · 3) lopende herstelgevallen · 4) beschikbaarheidsstatus · 5) monitoring · 6) historie.

**Situaties**

- **Toestemming** — zonder toestemming geen dossier; het scherm zegt wie toestemming kan geven (RB-07).
- **Dossier** — alleen na toestemming; toegang wordt gelogd.
- **Monitoring** — signalen zonder oordeel; keten naar beoordeling.
- **Blessure** — keten: *melding → beoordeling → gevolg voor de planning → terugkoppeling*.
- **Herstel** — status en verwachte beschikbaarheid; naar buiten uitsluitend als geschiktheid, niet als gezondheidsgegeven.
- **Rode vlag** — bereikt de ploegleider als geschiktheidsuitkomst, zonder onderliggende gegevens.

**Wedstrijdmodus:** verdwijnt — monitoring, historie, AI. Blijft — acute meldingen, beschikbaarheid, contactweg, noodhandeling.

**Mirror:** eerste scherm is Gezondheid · acute meldingen bovenaan · geen dossier zichtbaar zonder toestemming · doorgifte naar andere rollen bevat alleen geschiktheid · toegang tot een dossier is gelogd.

---

### 3.10 Ouder/verzorger

**Doel:** weten wat er voor het kind speelt, en geven wat er van hem gevraagd wordt.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Kind** |
| Kernvraag | wat staat er gepland en wat wordt er van mij gevraagd |
| Primaire hoofdtaak | toestemming geven of afwezigheid melden |
| Eerste bruikbare interactie | het openstaande toestemmingsverzoek |
| Secundaire taken | planning volgen, contact met de club, meerdere kinderen |
| Contexten | geen aparte contexten in v1 |
| Componenten | CMP-01, 02, 07, 08, 11, 12, 14, 24, 26, 29, 30, 32 |
| AI | legt uit wat iets betekent; geeft geen advies over het kind |
| Meldingen | toestemmingsverzoek, wijziging in de planning, afgelasting |
| Deeplinks | naar het toestemmingsverzoek, naar de planning van het kind |
| Zoeken/filters | beperkt; de omvang is klein genoeg om zonder te kunnen |
| Verboden informatie | gegevens van andere kinderen; trainingsinhoud van andere sporters; medische dossiers tenzij hij daar rechthebbende voor is |
| Desktop | **desktop leidend** voor inrichten en koppelen, **mobiel** voor volgen en bevestigen — dit is de directe consequentie van MUX-04 |

**Schermprioriteit:** 1) toestemming die gevraagd wordt · 2) wijziging in de planning · 3) eerstvolgende activiteit · 4) contact met de club · 5) overzicht van de week · 6) historie.

**Situaties**

- **Planning** — wat staat er en waar.
- **Toestemming** — geven en intrekken; toegestane uitzondering op alleen-lezen-eerst (MUX-04).
- **Afmelden** — met reden uit een korte lijst; keten naar de trainer.
- **Volgen** — resultaat en aanwezigheid; geen prestatiebeoordeling van andere kinderen.
- **Meerdere kinderen** — via CMP-02, nooit gemengd (RB-10).

**Wedstrijdmodus:** niet van toepassing.

**Mirror:** eerste scherm is Kind · toestemmingsverzoek bovenaan · geen schrijfacties buiten toestemming en afmelding · wisselen tussen kinderen mengt niets · geen gegevens van andere kinderen zichtbaar.

---

### 3.11 Gast

**Doel:** begrijpen wat Sparki is en één keer iets nuttigs doen.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Introductie** |
| Kernvraag | wat kan ik hier, en wat kost het me |
| Primaire hoofdtaak | een route plannen, of een account aanmaken |
| Eerste bruikbare interactie | het zoekveld van de routeplanner (CMP-13, CMP-17) |
| Secundaire taken | ontdekken wat er achter aanmelden zit |
| Contexten | geen |
| Componenten | CMP-01, 07, 08, 12, 13, 14, 17, 21, 25, 29, 30, 31 |
| AI | uitsluitend uitleg over het product; geen persoonlijk advies |
| Meldingen | geen |
| Deeplinks | naar een gedeelde route; die opent zonder account met een duidelijke grens |
| Zoeken/filters | routes en klimmen |
| Verboden informatie | alle persoonsgegevens van anderen; alles achter een organisatie |
| Desktop | **identiek** — dezelfde belofte, dezelfde grens; alleen de leeswijdte verschilt |

**Schermprioriteit:** 1) wat je nu kunt doen zonder account · 2) de planner · 3) wat er achter aanmelden zit · 4) uitleg · 5) voorbeeldmodus · 6) niets.

**Situaties**

- **Ontdekken** — een verkenningspagina mag, maar linkt door naar een uitvoerbare taak (MUX-99c).
- **Route plannen** — de kernbelofte; plannen is gratis, gebruiken telt mee volgens de vastgestelde limieten.
- **Account maken** — keten: *route gepland → wil bewaren of exporteren → account → eerste echte taak*.
- **Voorbeeldmodus** — permanent gemarkeerd, nooit mengbaar met een echte organisatie (CMP-33).

**Wedstrijdmodus:** niet van toepassing.

**Mirror:** eerste scherm is Introductie · zoekveld bedienbaar vóór de kaart · geen verkenningspagina zonder uitgang · grens tussen wel en niet zonder account is expliciet · geen persoonsgegevens van anderen zichtbaar.

---

### 3.12 Admin

**Doel:** zien dat het werkt, en ingrijpen als het niet werkt.

| Kenmerk | Invulling |
|---|---|
| Eerste scherm | **Systeemstatus** |
| Kernvraag | is er iets stuk |
| Primaire hoofdtaak | een incident openen of toewijzen |
| Eerste bruikbare interactie | de storingslijst |
| Secundaire taken | mislukte synchronisaties opvolgen, supportzaken behandelen |
| Contexten | geen |
| Componenten | CMP-01, 05, 07, 09, 11, 12, 17, 18, 25, 26, 28, 29, 30 |
| AI | vat incidenten samen; onderneemt niets |
| Meldingen | storing, mislukte synchronisatie, opgeschaalde supportzaak |
| Deeplinks | naar één incident, één supportzaak |
| Zoeken/filters | incidenten en zaken; filter op ernst en status |
| Verboden informatie | inhoudelijke gezondheidsdata; inzage in persoonsgegevens alleen voor zover de zaak dat vereist, en gelogd |
| Desktop | **desktop leidend** — onderzoek en herstel zijn geen telefoontaken; mobiel is de alarmkant |

**Schermprioriteit:** 1) actieve storing · 2) mislukte synchronisaties · 3) opgeschaalde support · 4) openstaande zaken · 5) systeemoverzicht · 6) historie.

**Situaties**

- **Systeem** — status en laatste bijwerktijd (CMP-30).
- **Incident** — keten: *melding → beoordeling → toewijzing → herstel → afsluiting met oorzaak*.
- **Support** — zaak behandelen; inzage in gebruikersgegevens is beperkt, gemotiveerd en gelogd.

**Wedstrijdmodus:** niet van toepassing.

**Mirror:** eerste scherm is Systeemstatus · actieve storing bovenaan · elke inzage in persoonsgegevens is gelogd · incident sluit met een oorzaak, niet met "opgelost".

---

### 3.13 Eigenaar (relatie, geen rol)

**Doel:** eigendom, facturatie en overdracht beheren zonder een aparte werkomgeving.

- Geen eigen rolwaarde, geen eigen navigatie, geen eigen eerste scherm (MUX-77).
- Landt op het startscherm van zijn beheerrol: Clubbeheerder bij `CLUB`, Teammanager bij `TEAM`.
- Ziet daar bovenaan CMP-16 met organisatie, type ("Clubeigenaar" of "Teameigenaar"), abonnement en overdracht.
- Eigendomsoverdracht is een aparte beveiligde handeling, altijd achter CMP-26.
- **Desktop:** desktop leidend — dit zijn zeldzame, zware handelingen.
- **Mirror:** geen apart tabblad of navigatie-item · eigenaarskaart alleen zichtbaar voor de eigenaar · overdracht vraagt expliciete bevestiging · de gebruikersnaam volgt het organisatietype.

---

## 4. Media- en uitlegaanvullingen per rol

Toegevoegd door `MOBILE_MEDIA_COMPONENTS_01`. Alleen de aanvullingen; al het overige per rol blijft ongewijzigd. De inhoud zelf komt uit `KENNIS_01`; hier staat alleen waar en wanneer die in de rolomgeving verschijnt.

| Rol | Aanvulling | Grens |
|---|---|---|
| **Sporter** | uitleg routeplanner (CMP-42) · uitleg navigatie starten · zweefkaart bij training voltooid en bij een persoonlijk record (CMP-40) · oefenkaart (CMP-43) · uitleg om de analyse te begrijpen | geen uitleg of media tijdens de rit of de training (PAT-38); bij een minderjarige geen gewichts-, 1RM- of zware belastingdoelen (CMP-43) |
| **Trainer** | uitleg training plannen · oefening delen met een sporter · coachmelding op een rustmoment (CMP-44) | geen video tijdens een lopende training; gedeelde oefening draagt de leeftijdsclassificatie mee |
| **Hoofdtrainer** | uitleg groepsbeheer en jaarplanning | geen coachmelding over een individuele sporter — die hoort bij de trainer |
| **Clubbeheerder** | uitleg onboarding, rollen en uitnodigingen | geen mediacomponenten in de inrichtingswizard (MUX-90) |
| **Teammanager** | uitleg seizoen en bezetting | idem |
| **Ploegleider** | wedstrijddagkaart met diepte (CMP-40, uitsluitend op CMP-39) · uitleg alleen vooraf of achteraf | tijdens de operatie geen animatie, geen media, geen coachmelding (MUX-96j, PAT-38) |
| **Mechanieker** | korte materiaalinstructie via CMP-41 | handen-vrij: posterbeeld en tekstvariant volstaan altijd; in de modus geen media |
| **Soigneur** | oefen- en verzorgingsinstructie | **geen individuele voedingsvideo voor minderjarigen** zonder passende bron en inhoudelijke controle via `KENNIS_01`; blijft naast de bestaande grens op gewicht en calorieën |
| **Medical Staff** | uitlegmedia uitsluitend bij niet-acute begeleiding, en met toestemming | geen speelse animatie of diepte bij een acute of medische waarschuwing (CMP-40, "wanneer niet") |
| **Ouder** | uitleg toestemming geven en afmelden | **geen gepersonaliseerd coachadvies over het kind**; algemene uitleg mag, advies niet |
| **Gast** | korte productuitleg · routeplanneruitleg · introductie op Uitleg en Academy | geen persoonlijke inhoud, geen coachmelding |
| **Admin** | geen aanvulling | media speelt geen rol in incidentafhandeling |

**Vaste regels voor alle rollen.** Media en uitleg verschijnen nooit tijdens navigatie, actieve training, wedstrijddagmodus, onboarding, een formulier of een acute flow (PAT-38). Elke rolomgeving blijft volledig bruikbaar met animatie uit (PAT-39). Media zonder aantoonbare rechten verschijnt niet (PAT-36).

---

## 5. Live-informatie

Sommige gegevens veranderen terwijl de gebruiker kijkt. Dat is toegestaan, maar niet vrijblijvend.

**Regels** (uitwerking van MUX-93):

1. Nooit het volledige scherm opnieuw laden.
2. Alleen het betreffende component verversen.
3. Geen springende interface — de ruimte was al gereserveerd (MUX-93d, CMP-31).
4. De gebruiker weet wát er veranderd is, niet alleen dát er iets veranderde.
5. Geen verlies van invoer. Wat de gebruiker aan het invullen is, wordt nooit overschreven.
6. Raakt de wijziging de lopende taak, dan onderbreekt hij mét uitleg en een keuze (MUX-93e).

| Wat verandert | Wie merkt het | Wat ververst | Hoe |
|---|---|---|---|
| Renner meldt zich af | teammanager, ploegleider, trainer | bezettings- of groepskaart (CMP-09) | aanduiding "gewijzigd", niet stil vervangen |
| Trainer past training aan | sporter | sessiekaart (CMP-08) | melding + zichtbare wijziging (MUX-93c) |
| Ploegleider wijzigt selectie | betrokken renners en staf | eigen wedstrijdkaart | alleen bij de betrokkenen |
| Materiaal gereedgemeld | ploegleider, teammanager | takenkaart (CMP-11/37) | afvinkstand verandert zichtbaar |
| GPS-status | rijdende gebruiker | navigatiebalk | direct, want het raakt de veiligheid |
| Synchronisatie | iedereen | CMP-30 | vier uitkomsten (MUX-53a) |
| AI-status | de betrokken gebruiker | CMP-34 | pas op een rustmoment (MUX-90) |
| Toestemming ingetrokken | betrokken rollen | het betrokken onderdeel | onderdeel verdwijnt niet stil maar wordt CMP-29 |

---

## 6. Productketens

Iedere functie hoort bij een hoofdtaak (MUX-99). Mirror toetst de keten, niet het losse scherm.

**Klim** — ontdekken → bekijken → toevoegen aan route → route plannen → navigeren → rijden → analyse → plan aanpassen.

**Wedstrijd** — programma → selectie → bezetting → dagschema → wedstrijddag → terugkoppeling → evaluatie → volgende voorbereiding.

**Materiaal** — registratie → slijtage- of defectsignaal → controle → reparatie of vervanging → gereedmelding → vertrek.

**Analyse** — uitgevoerde rit → analyse → inzicht → planaanpassing → volgende sessie.

**AI-advies** — signaal → voorstel met onderbouwing → bekijken → accepteren, aanpassen of negeren → gevolg zichtbaar.

**Jeugdinstroom** — uitnodiging → ouder koppelt → toestemming → account actief → eerste taak.

**Lid worden** — gast plant route → wil bewaren of exporteren → account → rol → eerste echte taak.

Een verkennings- of inspiratiepagina mag bestaan, maar eindigt altijd in één van deze ketens.

---

## 7. Consistentiecontrole

Uitgevoerd op dit document:

- Alle gebruikte MUX-codes bestaan in v1.4 (MUX-04, 05, 09, 10, 14, 17, 41, 42, 45, 48, 49, 50, 51, 52, 53, 53a, 54, 55, 62, 63, 64, 65, 66–69, 75, 76a, 77, 79, 88, 89–93, 96, 97, 98, 99, 100).
- Alle gebruikte CMP-codes bestaan in de componentbibliotheek (CMP-01 t/m 39).
- Geen nieuwe MUX-regels, geen nieuwe componenten, geen nieuwe productbesluiten toegevoegd.
- Iedere rol heeft: eerste scherm uit MUX-76a, één primaire hoofdtaak, een benoemde eerste bruikbare interactie, een schermprioriteit, een desktopverhouding met reden, en een Mirror-toetslijst.
- Alle dertien rollen zijn bouwbaar. Eén rol draagt een expliciete beperking mee: Ouder is mobiel alleen-lezen-eerst (MUX-04), met toestemming geven en afwezigheid melden als toegestane uitzonderingen.

**Open punten:** geen die dit document raken. De eerdere drie (naamkeuze medische rol, bestaan van de rolwaarde `ploegleider`, grens tussen `CLUB_RECHTEN_01` en `PLOEGLEIDER_01`) zijn op 1 augustus 2026 beslist en hierboven verwerkt.

---

## 8. Wijzigingslog

### v1.2 — 1 augustus 2026 (`MOBILE_MEDIA_COMPONENTS_01`)

Nieuw hoofdstuk 4: media- en uitlegaanvullingen per rol, met per rol de aanvulling én de grens. Daaropvolgende hoofdstukken doorgenummerd naar 5 t/m 8. Verder niets gewijzigd; geen nieuwe MUX-regels.

### v1.1 — 1 augustus 2026 (gericht herstel `MOBILE_ROLE_FLOWS_01`)

Uitsluitend verouderde rolstatussen en de pakketgrens bijgewerkt. Geen herschrijving, geen nieuwe MUX- of CMP-codes, overige inhoud ongewijzigd.

| Onderdeel | Wijziging |
|---|---|
| Rolstatustabel (hfst. 2) | Ploegleider: rolwaarde `ploegleider` bestaat server-side sinds commit `30ad85f`, status **bouwbaar**. Medical Staff: rolwaarde `medical_staff`, status bouwbaar zonder voorbehoud. |
| Ploegleider (3.6) | Blokkadetekst vervallen. Vervangen door de pakketgrens: `CLUB_RECHTEN_01` is eigenaar van rollen, rechten, scopes en autorisatie; `PLOEGLEIDER_01` bouwt de operationele wedstrijdlaag en geen tweede rechtenarchitectuur. |
| Ploegleider Mirror | Toetspunt verschoven van "bestaat de rolwaarde" naar "wordt de centrale rolwaarde gebruikt, zonder eigen rolbegrip of tweede rechtenlaag". |
| Medical Staff (3.9) | Naamkeuze niet langer open. `medic` ingetrokken, `medical_staff` is de technische rolwaarde. Functietype toegevoegd als beschrijvend gegeven zonder rechtenwerking. |
| Consistentiecontrole (hfst. 6) | Drie open punten verwijderd. Blokkaderegel vervangen: alle dertien rollen bouwbaar, alleen Ouder houdt de alleen-lezen-eerst-beperking. |

**Nagekomen:** het kerndocument is direct hierna op dezelfde drie punten gepatcht en staat nu op v1.4. Beide documenten dragen dezelfde rolstatus.

---

*Einde `SPARKI_ROLE_BASED_MOBILE_FLOWS.md`. Volgende opleveringen: `SPARKI_MOBILE_PATTERNS.md`, `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md`.*
