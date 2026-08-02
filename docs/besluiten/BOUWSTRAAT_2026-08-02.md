# Sparki bouwstraat — één volgorde, 2 augustus 2026

**Type:** bouwvolgorde voor Replit
**Status:** vastgesteld door Claude onder de werkwijze van 02-08-2026 (René is uit de beslisfunctie voor uitwerkingsvragen; hij stuurt bij vanuit het testen)
**Vervangt:** de losse wachtrij van Replit én de losse pakketlijst van Claude. Eén straat, geen twee stromen.

**Uitvoeringsregel:** één goedgekeurde bouwopdracht is toestemming voor de hele straat. Replit rapporteert per fase maar wacht niet op antwoord. Mirror loopt parallel en blokkeert niet. Alleen de elf harde stops onderbreken een lijn, en dan alleen de geraakte lijn.

**Leesregel:** golven lopen op volgorde, pakketten binnen een golf mogen parallel. "Poort" betekent: dit moet aantoonbaar werken voordat de volgende golf start.

---

## Eerst: dubbelingen opgeruimd

Beide wachtrijen bevatten pakketten die hetzelfde bouwen. Om te voorkomen dat het twee keer gebouwd wordt, geldt vanaf nu:

| Pakket | Status |
|---|---|
| `CLUB_RECHTEN_01` | **opgaat in `SPARKI_BUILD_01`** (rollen, rechten, scopes zitten daar in F1–F4) |
| `JEUGD_TOESTEMMING_01` | **opgaat in `SPARKI_BUILD_01`** (leeftijds- en consentservice) |
| `CLUB_HERSTEL_01` | **opgaat in `SPARKI_BUILD_01`** (de vijf reparaties, waaronder het `endedAt`-lek) |
| `MULTIROLE_CONTEXT_01` F0–F3 | **opgaat in `SPARKI_BUILD_01`** (multi-role context, vaste vijf posities) |
| `AI_ENGINE_01` · `AI_GRENZEN_01` · `AI_CONTEXT_01` · `AI_KWALITEIT_01` | **opgaan in `AI_INTELLIGENCE_ENGINE_02`** — één intelligentielaag, geen vier |
| `22_PLOEGLEIDER_01` | **wordt de wedstrijdlaag binnen `SPARKI_BUILD_03`**; bouwt géén eigen rechtenarchitectuur |
| `DOCUMENTEN_COMMUNICATIE_01` | blijft bestaan, wordt afgebouwd **binnen de werkobjectlaag** van `SPARKI_BUILD_02` |
| `SPARKI_CLOSURE_01` | **vervalt** — was van ChatGPT en botst met de uitvoeringsregel |
| `FUTUR_CONTROL_01` | **buiten deze straat** — pas oppakken als Sparki bijna release ready is (besluit René) |
| Masterplan + de drie dossiers van 31-07 | **`HISTORISCH — NIET MEER BIJWERKEN`**; uitzondering: `SPARKI_PROMISE_CALIBRATION.yaml` blijft geldig waar niets nieuwers overheen is gegaan |

---

## Golf 0 — nu, parallel, blokkeert alles daarna

**0.1 CI herstellen** (`GITHUB_REQUIRED_CHECKS_RECOVERY_01`)
Branch protection op main eist `validators`, `typecheck` en `admin-smoke`, maar er staat geen `.github/workflows` op main. Gevolg: PR's #2 t/m #5 hangen permanent en er kan niets gemerged worden. Dit is de belangrijkste blokkade van het hele project en niemand merkt het, want het uit zich als "checks pending".

**0.2 Bewijs van de fietsketen** (`KETEN_FIETS_01`)
`ROUTE_OVERPASS_STABILITEIT_01` is gebouwd en gepusht (`c9eb59c6`) maar niet bewezen. Productie mist nog `overpass_query_cache`. Actie van René: publiceren, dan vijf keer achter elkaar de zes stappen, minstens één poging direct na de vorige. Daarna het e2e-proof-endpoint opruimen.

**0.3 Mobiel routepakket afmaken** (loopt)
Hoofdstuk 2 en verder. Dit is het enige onderdeel dat direct testbaar is voor wielrenners.

**0.4 De vier P1-herstelpunten van Mirror**
F3 lege-quotes-bug · CI-oorzaak · productie-versie-endpoint geeft "onbekend" · ontbrekende fixtures `nutrition_specialist` en `medical_staff`. Alle vier opgesteld, geen uitgevoerd.

> **Poort naar golf 1:** CI groen op main, en één volledige routerit end-to-end zonder ingrijpen.

---

## Golf 1 — fundament

**1.1 `SPARKI_BUILD_01`** — loopt al (F1–F4 gedaan, F5 loopt). Afmaken t/m F13.
Bevat: centrale leeftijds- en consentservice · rechtenlekken inclusief `endedAt` in **alle** scopes · rolgestuurde startschermen voor **elke** server-side rolwaarde zonder terugval op atleet · multi-role context met vaste vijf navigatieposities · herhalende trainingen (heel seizoen vooruit) · VOG met afgiftedatum en driejaarswaarschuwing · communicatie met bijlagen · clubdocumenten · UX-herindeling · de vijf platformdiensten agenda, locaties, contacten, bestanden, inbox en notificaties.

Drie defecten die hier gerepareerd worden en die vandaag echt lekken:
- `club-permissions.ts` filtert de trainerscope niet op `endedAt` — een vertrokken renner blijft zichtbaar inclusief consent-gated sportdata
- drie definities van "minderjarig" naast elkaar, waarvan één fail-open bij onbekende geboortedatum
- `dataSharingParent = "none"` zet ook het veiligheidsminimum uit; gezondheid en herstel moeten altijd zichtbaar blijven voor de ouder

**1.2 Wandelen** (`#536`)
Start zodra golf 0.2 bewezen is. Besluit van 01-08: niet wachten op de clubmodules. Inclusief wandelingen terugzien met analyse en vergelijken over tijd.

**1.3 `MEDIA_UITLEG_01` F0–F2**
Alleen de fasen die op niets buiten het pakket wachten: inventarisatie, gedeelde media-basis, dieptekaart en "verminder beweging". De uitlegflow en Academy komen later, want die wachten op `KENNIS_01`.

> **Poort naar golf 2:** elke bestaande rolwaarde heeft een eigen startscherm, en er lekt geen sporterdata meer naar een trainer na vertrek.

---

## Golf 2 — data en geld

**2.1 `DATA_TRUST_01`** — afmaken en bewijzen. Dit is de bodem onder analyse, doelen en de intelligentielaag: brontypes, geldigheidsduur per brontype, verouderde meting met waarschuwing, voorkeursbron bij eerste koppeling, stille verwerking van afwijkingen, dubbele ritten onbeperkt bewaren.

**2.2 `ABONNEMENT_01` + `ABONNEE_ADMIN_02`** — inclusief de clubafname en de scheiding **betaler ≠ gebruiker**, die vandaag helemaal niet bestaat in de billing. Zonder die scheiding kan een club niet voor haar leden betalen en kan een ouder niet voor een jeugdlid betalen. *(02-08: `ABONNEE_ADMIN_01`/taak #537 is INGETROKKEN en vervangen door `docs/build-packages/ABONNEE_ADMIN_02/ABONNEE_ADMIN_02.md` — ABA-01 t/m ABA-52; volgorde ná `ABONNEMENT_01` is een technische afhankelijkheid, geen vrijgavepoort.)*

**2.3 Bewaartermijnen** — toetsvoorstel: de zeven besloten termijnen naast de zes lege configuratiewaarden. Daarna invullen. Dit is de laatste juridische blokkade op een betaalde publieke release.

**2.4 Stripe** — testsleutels aansluiten (taak #379) en de betaalflow end-to-end doorlopen. Vraagt een handeling van René.

> **Poort naar golf 3:** een sporter kan betalen, een club kan voor een lid betalen, en een abonnement kan verlopen zonder dataverlies.

---

## Golf 3 — de werkobjectlaag

**3.1 `WORK_OBJECT_CORE_01`** — de gedeelde kern: status, versie met wijzigingssamenvatting, opmerkingen en taken op objectniveau, rolweergave (hetzelfde object, per rol het eigen deel).

**3.2 `WORK_OBJECT_COLLAB_01`** — opmerkingen, taken, notificaties.

**3.3 `WORK_OBJECT_PILOT_01`** — pilot is het **dagschema**: wijzigt het vaakst, hoogste foutkosten, vier rollen kijken er tegelijk in.

**3.4 `SPARKI_BUILD_02`** — de overige zeven platformdiensten: taken, sjablonen, platformbreed zoeken, goedkeuring en bevestiging, archief en bewaarmatrix, gebruikersaudit, import en export. Plus de documentenbibliotheek op `Meer → Documenten` met contextuele ingangen — **geen bibliotheek per module**.

**3.5 Eén documentgenerator** — er bestaat vandaag nul PDF-functionaliteit in de repo (geen pdfkit, puppeteer of jspdf). Vier rapporttypen die al vastliggen veronderstellen een werkobject dat nog niet bestaat. Eén generator, één templatebibliotheek, geen tweede PDF-engine per domein.

> **Poort naar golf 4:** één plan waar meerdere rollen tegelijk in werken, met versies, opmerkingen en een PDF eruit.

---

## Golf 4 — wedstrijd en team

Volgorde binnen deze golf ligt vast omdat elk pakket op het vorige steunt:

**4.1 `21_CLUB_PLANNING_01`** — clubplanning. Kleinste ingreep, grootste effect op bruikbaarheid.
**4.2 `20_CLUB_COMMUNICATIE_01`** — communicatie met bijlagen. Zolang je niets kunt meesturen, blijft de groepsapp naast Sparki bestaan.
**4.3 `WEDSTRIJDBEZETTING_01`** — `club_race_selections.role` kent nu alleen renner, reserve en begeleider. Ploegleider, mechanieker, soigneur, medical_staff en chauffeur kunnen niet aan een evenement gekoppeld worden. Dit is de moederblokkade van de hele wedstrijdlaag.
**4.4 `WEDSTRIJDDAG_PLANNING_01`** — dagschema, vervoer, materiaal, taken, briefings, renneropdrachten, conflictsignalering, uitslagen, ploegevaluatie.
**4.5 `WEDSTRIJDDAG_MOBIEL_01`** — wedstrijddagmodus voor ploegleider en teammanager.
**4.6 `WEDSTRIJDDAG_NOOD_01`** — noodinformatie met inzagelog voor beide rollen.
**4.7 `23_TEAM_MECHANIEKER_01`** — materiaal en wagenpark.

Ook hier hoort de koppeling `club_race_events` ↔ `races`, zodat een door de ploegleider aangemaakte wedstrijd in de eigen omgeving van de renner verschijnt, plus meerdaagse wedstrijden met etappes.

> **Poort naar golf 5:** een ploegleider kan een volledige wedstrijddag plannen, delen en uitvoeren.

---

## Golf 5 — begeleiding en intelligentie

**5.1 `AI_INTELLIGENCE_ENGINE_02` F0** — de hergebruikmatrix. Blokkerend voor alle volgende fasen van dit pakket, want zonder inventarisatie ontstaat er alsnog een tweede AI-architectuur. Geen code in deze fase.

**5.2 `AI_INTELLIGENCE_ENGINE_02` F1–F13** — adviesdossier, explainability, confidence, contextlaag, analyse en richting, doelbewaking, wetenschapscontrole, veiligheid, delen met de trainer, minderjarigen.

**5.3 `DOELEN_01`** — doelen instellen en beheren, leeftijdsbanden, trainervoorstel. Kan parallel met 5.2 vanaf F1.

**5.4 `TRAINING_FLOW_01` + `COACH_ADAPTIEF_01` + `ANALYSE_BOUW_01`** — trainingsopbouw, adaptieve begeleiding, de diepere analyse voor Compleet en Trainer.

**5.5 `TRAINER_KOPPELING_01` → `ZZP_TRAINER_01` → `TRAINER_INVOICING_01`** — de zelfstandige trainer, in die volgorde. Facturatie als laatste, want die steunt op de documentgenerator uit golf 3.

**5.6 `KENNIS_01`** — de kennisinhoud, daarna `MEDIA_UITLEG_01` F3–F11 inclusief Uitleg en Academy.

**5.7 `ACTIVITEITEN_01` · `INTEGRATIES_01` · `MECHANIEKER_01` · `TRAINER_CLUB_01`**

> **Poort naar golf 6:** een sporter krijgt een advies dat herleidbaar is, en een trainer kan zijn werk doen en factureren.

---

## Golf 6 — afronding

`30_PROFIEL_01` · `31_HELPDESK_01` · `32_ADMIN_OPERATIONS_01` · `33_CONTINUITEIT_01` · `34_TOEGANKELIJKHEID_01` · `NOTIFICATIES_01` · `SOCIAL_01` · `LAB_01` · `19_PLAN_MARKTPLAATS_01` · `SPARKI_TRAINER_ABONNEMENT_01`

Marktplaats en social leveren pas waarde als er gebruikers zijn — daarom achteraan.

**Afsluitend: `RELEASE_01`.** Uitbreiden met rollback, crash reporting, monitoring en alerting, en logging — die vier zitten niet in het huidige pakket.

---

## Wat ik hierin heb beslist

Deze keuzes zijn van mij, niet van René. Ze zijn allemaal met één zin terug te draaien tijdens het testen.

1. **CI herstellen gaat vóór alles.** Zonder werkende checks kan er niets gemerged worden en stapelt alles zich op in hangende PR's.
2. **`CLUB_RECHTEN_01`, `JEUGD_TOESTEMMING_01`, `CLUB_HERSTEL_01` en de eerste fasen van `MULTIROLE_CONTEXT_01` gaan op in `SPARKI_BUILD_01`.** Ze bouwen hetzelfde en `SPARKI_BUILD_01` loopt al.
3. **De vier AI-pakketten worden één pakket.** Vier losse AI-pakketten naast één intelligentielaag levert gegarandeerd een tweede architectuur op.
4. **`SPARKI_CLOSURE_01` vervalt.** Het botst frontaal met de uitvoeringsregel en de opsteller is uit beeld.
5. **De werkobjectlaag gaat vóór de wedstrijdlaag.** Het wedstrijdplan ís een werkobject; andersom bouwen betekent het twee keer bouwen.
6. **De documentgenerator komt in golf 3, niet later.** Er zijn nu vier rapporttypen vastgelegd die nergens uit kunnen komen, en de trainer kan zonder generator niet factureren.
7. **Wandelen en de eerste mediafasen lopen parallel in golf 1** in plaats van achteraan — ze wachten op niets en wandelen was al vrijgegeven zodra de fietsketen bewezen is.
8. **Marktplaats en social gaan naar achteren.** Ze zijn onbruikbaar zonder gebruikersbestand.
9. **Het masterplan en de drie dossiers van 31-07 worden historisch.** Vier documenten synchroon houden kost elke week uren en levert niets op wat het besluitenoverzicht niet ook doet.

---

## Wat alleen René kan doen

- Publiceren en de proefrun van de fietsketen (golf 0.2)
- Stripe-testsleutels aansluiten en de betaalflow doorlopen (golf 2.4)
- Schermafdrukken op productie aan het eind van het mobiele routepakket
- Definitief akkoord op de productie-database vlak vóór een publicatie
- Bekrachtigen van het bewaartermijnen-toetsvoorstel (golf 2.3) — laatste juridische blokkade
