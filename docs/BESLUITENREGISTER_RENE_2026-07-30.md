# Besluitenregister René — 30 juli 2026 (aanvullende opdracht)

Canonieke verwerking van de besluiten uit de aanvullende opdracht van 30-07-2026
(bron: `attached_assets/Pasted-AANVULLENDE-OPDRACHT-AAN-REPLIT-Besluiten-Ren-verwerken_1785471262933.txt`).
Oudere tegenstrijdige aannames vervallen. Per besluit: besluit, gevolgen,
betrokken rollen, migraties, test-/acceptatiecriteria en status.

Statuswaarden: `besloten` · `in uitvoering` · `bewezen` · `open`.

---

## B1 — Rechtenlek assignment-only trainer (individuele berichten)
- **Besluit (30-07-2026):** een trainer met uitsluitend een club-/teamtoewijzing
  (geen directe geaccepteerde coach-sporterlink) heeft alléén de vastgelegde
  lees-/begeleidingsrechten en mag géén individuele berichten schrijven of
  andere individuele schrijfacties doen. Alleen een knop verbergen is onvoldoende;
  server-side afdwingen + manipulatietests + auditcontrole zonder gegevens te wissen.
- **Gevolgen:** server-side gates op alle individuele coach-routes (directe link
  vereist); UI biedt de individuele cockpit niet meer aan voor toegewezen sporters;
  oud taak-412-contract ("toewijzing mag ook schrijven") is definitief omgeklapt.
- **Rollen:** trainer (alle contexten), sporter, clubbeheerder.
- **Migraties:** geen (autorisatielaag + tests + UI).
- **Acceptatiecriteria / bewijs:** `test:trainer-assignment-messages` 9/9 groen
  (endpoint-manipulatie, nul-rijen-controles, positieve controles);
  `test:trainer-assignment-write-contract` 5/5 groen met omgeklapte verwachting
  (assignment-only = 403 + nul rijen); DB-audit dev + productie: 0 berichten van
  coaches zonder geaccepteerde link (read-only, niets gewist). Poort 5b-rapport:
  `docs/PRODUCT_PROMISES/sanity-checks/SANITY_5B_2026-07-31_trainer-berichtenrechten.yaml`.
- **Status:** **bewezen** (31-07-2026, commits 1d5fa874 + 380f05ab).

## B2 — Externe coach en extern trainingsplan
- **Besluit:** externe-coachfunctionaliteit is vrijgegeven om nu te bouwen:
  expliciet herkomstsysteem (Sparki-plan / gekoppelde trainer / externe coach /
  geïmporteerd extern plan / handmatig / later door Sparki aangepast), plan-upload,
  versie-/wijzigingshistorie, zichtbare verantwoordelijkheid en begeleidingsmodus,
  veilige bestandsverwerking, geen stille omzetting van herkomst. Veiligheidsrisico
  in extern plan: nadrukkelijk waarschuwen + uitleggen + veiliger alternatief
  voorstellen, gebruiker NIET automatisch blokkeren, geen medische zekerheid,
  waarschuwing + gebruikersbeslissing loggen.
- **Gevolgen:** herkomst-enum + versiehistorie op plannen/trainingen; uploadpad;
  waarschuwen-niet-blokkeren-flow met logging. `planned_workouts.source` mag niet
  langer hard naar coach|sparki genormaliseerd worden.
- **Rollen:** sporter, externe coach (herkomstlabel, geen accountrol), trainer.
- **Migraties:** ja — herkomstveld(en) + versie-/wijzigingshistorie + logtabel
  (details bij ontwerp stap D).
- **Acceptatiecriteria:** herkomst blijft door de hele keten zichtbaar en wijzigt
  nooit stil; upload-round-trip bewezen; waarschuwingsflow gelogd en getest.
- **Status:** besloten; uitvoering gepland (§15 stap D).

## B3 — VOG-registratiemodel
- **Besluit:** nooit een kopie/afbeelding van een VOG opslaan; uitsluitend metadata
  (status, controledatum, wie registreerde/controleerde, verval-/hercontroledatum,
  context, auditlog). Zelfstandige/teamtrainer registreert zelf; clubbeheerder
  registreert/controleert in clubcontext. UI maakt onderscheid zelf-geregistreerd
  vs door clubbeheerder gecontroleerd duidelijk.
- **Rollen:** trainer, clubbeheerder. **Migraties:** ja (metadata + auditlog) bij bouw.
- **Acceptatiecriteria:** geen bestands-/beeldopslagpad voor VOG bestaat; UI-onderscheid
  zichtbaar; audittrail per statuswijziging.
- **Status:** besloten; nog niet gebouwd.

## B4 — Teamtrainer en individuele sportdata
- **Besluit:** teamtrainer mag individuele sportdata bekijken zonder voorafgaande
  goedkeuring per inzage door de ploegleider, mits relatie/rechten dit toestaan.
  Verplicht: logging van individuele inzage (minimaal trainer, sporter, datatype,
  tijdstip, context); ploegleider kan die logging achteraf inzien; geen toegang
  buiten eigen team/geldige relatie; privacy-/leeftijdsregels blijven gelden.
- **Migraties:** ja — inzagelogtabel. **Rollen:** teamtrainer, ploegleider/hoofdtrainer, sporter.
- **Acceptatiecriteria:** elke individuele inzage produceert een logrij; ploegleider-
  overzicht toont ze; buiten-team-toegang bewijsbaar 403.
- **Status:** besloten; uitvoering gepland (§15 stap E).

## B5 — Clubomgeving "algemene voortgang"
- **Besluit:** omvat groepsgemiddelden, teamontwikkeling, individuele TSS/belasting
  en individuele afwijkingen/aandachtspunten — met rolrechten en privacy; niet elke
  clubrol ziet automatisch alle individuele details.
- **Status:** besloten; uitvoering gepland (§15 stap E). Migraties: n.t.b. bij ontwerp.

## B6 — Routeplanner vier weergaven, hoogste niveau heet "Wedstrijd"
- **Besluit:** vier weergaveniveaus: 1. Gratis, 2. Go gewone fietser,
  3. Go wielrenner/MTB/gravel, 4. **Wedstrijd** (uitdrukkelijk NIET "Compleet",
  om verwarring met abonnement Sparki Complete te voorkomen). Weergave wordt
  automatisch voorgesteld (profiel/ervaring/gebruik), is altijd handmatig
  aanpasbaar, staat volledig los van het abonnement, bewaart de keuze en biedt
  terug-naar-automatisch. Compleet-abonnee mag de eenvoudigste weergave kiezen;
  ander abonnement mag uitgebreider kijken voor zover betaalde functies binnen de
  rechten vallen. **Veiligheid is nooit premium**: blokkadepoort, eindverificatie,
  wegdek-/routewaarschuwingen, oncontroleerbare-routewaarschuwing en het verbod op
  opslaan/navigeren van niet-goedgekeurde kandidaten gelden op élk niveau.
  Wedstrijd-weergave wordt nu meegebouwd, geen latere losse taak.
- **Migraties:** `athlete_profiles.planner_view` (tekst, NULL = automatisch;
  migratie `0006_athlete_planner_view.sql`). **Status:** gebouwd 31-07-2026 —
  weergavekiezer in de Maken-tab (`planner-view-switcher.tsx`), voorstel-logica
  in `lib/planner-view.ts` (deterministisch uit profiel), keuze bewaard via
  `PUT /api/athlete/profile` (enum-whitelist, null = terug naar automatisch).
  Verborgen opties sturen nooit stiekem mee (effectieve waarden); veiligheid op
  élk niveau ongemoeid. Fundament: Bewaard-tabblad één lijst (Poort 5b 31-07);
  #505 en #506 zijn afgerond en bewezen.

## B7 — Individuele vermogenszones naast FTP-zones
- **Besluit:** individuele zones náást (niet in plaats van) generieke FTP-zones;
  gebruiker kiest zichtbaar/actief; methode altijd getoond; analyses wisselen nooit
  ongemerkt van methode; historische analyses bewaren de destijds gebruikte zones;
  trainerrechten en gebruikersbeslissingsrecht gerespecteerd.
- **Migraties:** zones-methode + historische vastlegging (n.t.b.).
- **Status:** besloten; uitvoering gepland (§15 stap F).

## B8 — Power Duration Curve: instelbaar tijdvenster
- **Besluit:** PDC-tijdvenster door gebruiker instelbaar (recente periode, seizoen,
  kalenderjaar, aangepast, volledige historie); geen hard vast venster als enige optie.
  Toon gekozen venster, databeschikbaarheid, ontbrekende backfill, betrouwbaarheid;
  geen schijnprecisie bij te weinig maximale inspanningen.
- **Status:** besloten; uitvoering gepland (§15 stap F). Migraties: geen verwacht.

## B9 — Ramp-rate-veiligheidsgrens
- **Besluit:** eerst een onderbouwd VOORSTEL (definitie/berekening, onderbouwing,
  differentiatie leeftijd/ervaring/niveau, omgang met dunne data, waarschuwings-
  niveaus, voorbeelden, foutpositieven/-negatieven, relatie trainerbegeleiding,
  gebruikerstekst). Bouwen pas na expliciete goedkeuring van René.
- **Status:** **open** (voorstel gepland §15 stap G; grens niet bouwen zonder akkoord).

## B10 — Samen-pagina
- **Besluit:** "Samen trainen" bovenaan de Samen-pagina. Positie van Samen op het
  eerste navigatieniveau is NIET besloten — hoofdnavigatie niet wijzigen op aanname.
- **Status:** besloten (volgorde); nav-positie **open**.

## B11 — KnowledgeIsWatt
- **Besluit:** uitsluitend de gratis signaallaag. Zonder nieuw besluit niet: betaald
  abonnement, overname betaalde inhoud, paywall-omzeiling, opslaan/reproduceren van
  beschermde artikelen. Wel: gratis signalen/previews als aanwijzing, bronverwijzing,
  onderwerpherkenning, eigen analyses op eigen/rechtmatige data.
- **Status:** besloten (beleidsgrens; geldt per direct voor alle kennis-ingestie).

## B12 — Koolhydraat-pilot
- **Besluit:** doorgaan zoals gepland. 30–60 g/u gevestigd; 60–90 g/u gevestigd voor
  langer/intensiever afhankelijk van sporter/tolerantie; ≥100 g/u uitsluitend
  gelabeld "in ontwikkeling". Personaliseren op duur/intensiteit/ervaring/tolerantie;
  geen universele opdracht; maag-darm en gewenning meenemen; bij jongeren extra
  terughoudend; bron/confidence/reden tonen; geen medische claims.
- **Status:** besloten; uitvoering gepland (§15 stap F). Sluit aan op bestaande
  fueling-engine (deterministische richtwaarden, jeugd-no-numbers, consent fail-closed).

## B13 — Wielercategorieën: bronhiërarchie (HERZIEN 31-07-2026)
- **Besluit (René, 31-07-2026; vervangt "wacht op KNWU-verificatie"):** bindende
  bronhiërarchie: **1. UCI** (primair/leidend: internationale categorieën,
  leeftijdsgrenzen, disciplineregels) → **2. UEC** (Europese toepassing binnen het
  UCI-kader) → **3. KNWU** (Nederlandse vertaling: licenties, nationale wedstrijden,
  pakketten, lokale benamingen). Gevolgen: geen KNWU-indeling als universele waarheid
  coderen; internationale categorie en nationale licentiecontext als **gescheiden
  velden** bewaren (bv. U19/U23/Elite ≠ KNWU Licentie U17/17+/Basis-Plus-Premium —
  nooit één categorieveld); verschillen per discipline en seizoen ondersteunen; bron,
  versie, ingangsdatum en land vastleggen; geen hardcoded categorie zonder
  geldigheidsperiode; een NL-licentienaam overschrijft nooit de UCI-categorie;
  nationale uitzonderingen blijven herkenbaar nationaal. Model + bronmatrix:
  `docs/SPARKI_CATEGORIE_LICENTIEMODEL.md`.
- **Status:** **bronhiërarchie besloten; exacte categorie- en disciplinemapping nog te
  valideren tegen actuele UCI-, UEC- en KNWU-reglementen.** Geen definitieve mapping
  bouwen op basis van alleen een KNWU-webpagina; eerst de bronmatrix (geleverd
  31-07-2026, 🔎-punten open).

---

## Open blijven uitsluitend (per opdracht §14)
1. exacte categorie- en disciplinemapping (B13 — bronhiërarchie zelf is 31-07 besloten;
   validatie tegen actuele UCI-/UEC-/KNWU-reglementen open);
2. wel/geen Samen op het eerste navigatieniveau (B10);
3. definitieve ramp-rate-grens na voorstel + goedkeuring (B9).

## Oplevervolgorde (§15, bindend)
A rechtenlek (✅ bewezen 31-07) → B dit register + doc-updates → C routeplanner
vier weergaven incl. Wedstrijd → D externe coach/planherkomst → E logging
teamtrainerinzage + clubvoortgang → F zones/PDC/koolhydraat → G ramp-rate-voorstel
→ H overige UX-/documentatiebewijzen.

---

## SPARKI-BESLUIT-2026-009 — Downgrade-gedrag routes (besluit D1, 31-07-2026)

- **Besluit (René, via ABONNEMENT_01/prioriteitsdocument 31-07-2026):** bij een
  downgrade blijven **alle opgeslagen routes zichtbaar en alleen-lezen** totdat de
  gebruiker zelf kiest welke drie routes actief blijven. Er verdwijnt niets, er wordt
  niets automatisch verwijderd of onbereikbaar gemaakt.
- **Gevolg:** hiermee is de laatste blokkade voor `ROUTE_PAKKET_02c` (opslag, verval
  en downgrade) vervallen. De keuzeflow zelf wordt gebouwd in `ABONNEMENT_01`
  (alleen de flow) en `02c` (opslag/verval); beide starten pas na expliciete vrijgave.
