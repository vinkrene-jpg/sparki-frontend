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

---

## SPARKI-BESLUIT-2026-010 — Definitieve rolmapping teamorganisatie (HERSTEL TEAM_ABONNEMENT_01, 01-08-2026)

- **Besluit (René, herstelopdracht 01-08-2026):** de eerdere Replit-aanname
  "ploegleider = teammanager" is **SUPERSEDED**. Ploegleider is een APARTE
  server-side rolwaarde (`ploegleider`) naast `teammanager`. `medic` heet
  voortaan `medical_staff`, met een beschrijvend functietype
  (arts/fysiotherapeut/diëtist/sportpsycholoog/inspanningsfysioloog/overig)
  dat GEEN zelfstandige rechten geeft. Gebruikersnamen: `member` = "Sporter",
  `alleen_lezen` = "Gast". CLUB_RECHTEN_01 blijft eigenaar van het rollenmodel.
- **Migratie:** op wijzigingsmoment 0 rijen met rol medic/teammanager/member/
  alleen_lezen in dev én productie → geen datamigratie; migratie 0012 bevat een
  idempotent vangnet (medic→medical_staff) en de kolom `medical_specialty`.
- **Synchronisatie:** geldt voor CLUB_RECHTEN_01, TEAM_ABONNEMENT_01,
  TEAM_ONBOARDING_01, PLOEGLEIDER_01, TEAM_MECHANIEKER_01 en hoofdstuk J.

---

## SPARKI-BESLUIT-2026-011 — Geschatte FTP (keuze 17, 01-08-2026)

- **Besluit (René):** een geschatte FTP mag worden gebruikt voor **voorlopige
  trainingszones en een voorlopig trainingsplan**, onder voorwaarden:
  altijd zichtbaar als "Geschatte FTP"; bron, datum en betrouwbaarheid vastgelegd;
  nooit gepresenteerd als gemeten of bevestigde FTP; gebruiker kan bevestigen,
  aanpassen of vervangen; nieuwe betrouwbare data levert een wijzigingsVOORSTEL op
  (geen stille wijziging); bij gekoppelde trainer blijft de trainer leidend;
  bij onvoldoende betrouwbare data vraagt Sparki om een FTP-test of handmatige invoer.
- **Productregel:** een geschatte FTP mag Sparki bruikbaar maken, maar nooit een
  sportfeit suggereren dat niet bewezen is.
- **Gevolg:** huidige gedrag (zones/plan/pacing op geschatte profiel-FTP; belasting-
  scores en Vermogen-as sluiten schattingen uit) blijft; labels en voorstel-flow
  toetsen tegen deze voorwaarden bij de eerstvolgende relevante bouwronde.

---

## SPARKI-BESLUIT-2026-012 — Legacy-migratie per account (keuze 18, 01-08-2026)

- **Besluit (René):** legacy-migratie gebeurt **per account**, nooit als één globale
  migratie. Verplicht: inventarisatie + dry-run per account; preview van over te
  nemen gegevens; volledige herleidbaarheid naar bron; idempotent; nooit nieuwere of
  betrouwbaardere data overschrijven; conflicten zichtbaar houden; migratiestatus
  per account; auditlog + herstelmogelijkheid; gefaseerde uitrol na bewezen test.
- **Productregel:** migratie is een gecontroleerde accounttransformatie, geen
  database-import.
- **Status:** er is nog níéts gemigreerd (alleen dry-run-inventarisatie);
  `legacy_unrestricted`-accounts behouden volledige toegang tot per-account akkoord.

---

## Statusbesluit 01-08-2026 — ABONNEE_ADMIN_01 blijft geblokkeerd

Vrijgave volgt pas na een succesvolle Mirror-hertoets van DATA_TRUST_01,
ABONNEMENT_01 en de volledige gekoppelde keten (geen mock/seed/fallback zichtbaar;
rechten uitsluitend uit echte abonnementstoestand; Stripe-events deterministisch;
dubbele webhooks veilig; typecheck/build/tests groen; negatieve tests uitgevoerd;
audittrail compleet).

---

## SPARKI-BESLUIT-2026-013 — Brand-identity-voorbereiding (01-08-2026)

- **Aanleiding:** forensisch Mirror-onderzoek naar het Sparki-beeldmerk.
  Uitkomst: het enige bewezen productiebeeldmerk is de **bliksemschicht**; er
  bestaat één S-concept in Figma (niet-geproduceerde mock-up); er is géén bewijs
  voor een officiële Sparki-"S" opgebouwd uit richtingspijlen.
- **Besluit (René):**
  1. BRAND_IDENTITY_01 blijft tijdelijk gepauzeerd.
  2. Er wordt niet verder gezocht naar een historisch beeldmerk.
  3. Er wordt geen nieuw logo tussentijds ontworpen.
  4. Na afronding van de Mobile UX-documenten start een afzonderlijk traject
     "BRAND_IDENTITY_01".
  5. Dat traject ontwerpt meerdere professionele logo-richtingen.
  6. René kiest één definitieve merkidentiteit.
  7. Pas daarna worden favicon, PWA-iconen, splashscreens, PDF-rapporten,
     Academy, website, social media en overige merkuitingen aangepast.
  8. Tot die tijd blijft het huidige productiebeeldmerk (bliksemschicht) de
     enige officiële identiteit.
- **Productregel:** geen enkele merkuiting wordt tussentijds gewijzigd of
  "alvast" aangepast; de bliksemschicht is tot het BRAND_IDENTITY_01-besluit de
  enige officiële identiteit.
- **Status:** BRAND_IDENTITY_01 = DEFERRED tot na Mobile UX (zie statusregister
  en docs/build-packages/BRAND_IDENTITY_01/).

---

## Mobiele UX-besluiten MUX-B1 t/m MUX-B4 (01-08-2026 — bewust nog ONGENUMMERD)

Bron: `docs/product/SPARKI_MOBILE_UX_STANDARD_v1.4.md`, hoofdstuk 17. Conform de
afspraak van 01-08-2026 krijgen deze besluiten pas een definitief
`SPARKI-BESLUIT-2026-nnn`-nummer nadat de reeks is opgeschoond en `-006` t/m
`-013` betrouwbaar zijn vastgesteld. Tot die tijd gelden de letters.

| Tijdelijk | Besluit (René, 01-08-2026) |
|---|---|
| MUX-B1 | Mobiel is de web/PWA-ervaring op telefoonbreedte. Apparaatdoctrine WP-R0..R8 bevestigd: web/PWA-eerst, jeugd- en ouderdomein mobiel alleen-lezen-eerst. Routeplanner blijft in v1 een mobiele webpagina. |
| MUX-B2 | Offline betekent in v1 uitsluitend dat een gestarte navigatie doorloopt. Geen offline schrijfacties, geen wachtrij, geen lokale bevestiging zonder server. Uitgebreidere offlinelaag = afzonderlijk toekomstig pakket. |
| MUX-B3 | Geen rolgestuurd scherm bouwen voordat de rolwaarde server-side bestaat. Vooruit ontwerpen mag wel. |
| MUX-B4 | `MOBILE_UX_STANDARD_01` is bindend voor alle mobiele schermen. Afwijken alleen met expliciete productgoedkeuring van René, vastgelegd met vermelding van de MUX-code. |

---

## Tijdelijk besluit MUX-B5 — Plaats van Uitleg en Academy (01-08-2026, bewust ONGENUMMERD)

Conform dezelfde afspraak als MUX-B1 t/m B4: pas een definitief
`SPARKI-BESLUIT-2026-nnn`-nummer nadat de reeks is opgeschoond.

- **Besluit (René):** Uitleg en Academy wordt **geen** extra (zesde)
  hoofdnavigatie-item; de vijf vaste hoofditems blijven intact (MUX-14).
  Definitieve plaats: **Hulp & ondersteuning → Uitleg en Academy**, daarbinnen:
  1. **Sparki gebruiken** — gratis: productuitleg, onboarding, routeplanner,
     GPX, navigatie, training, analyses, instellingen, abonnementen,
     veiligheid, toegankelijkheid.
  2. **Beter fietsen en trainen** — Sparki Compleet: FTP, zones, herstel,
     intervaltraining, klimmen, dalen, voeding, wedstrijdvoorbereiding,
     kracht, mobiliteit.
- **Harde regels:** geen nieuwe navigatiearchitectuur; de grens gratis/Compleet
  komt uitsluitend uit de centrale entitlementlaag.
- **Doorwerking:** `docs/product/SPARKI_MEDIA_UITLEG_PRODUCTBESLUIT.md`
  (open afhankelijkheid 6 vervallen).
