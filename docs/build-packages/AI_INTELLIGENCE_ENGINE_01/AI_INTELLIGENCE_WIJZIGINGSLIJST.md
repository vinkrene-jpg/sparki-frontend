# AI_INTELLIGENCE_ENGINE_01 — WIJZIGINGSLIJST v1.1

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Datum:** 1 augustus 2026 · Uitsluitend de drie opgedragen correcties verwerkt. Geen nieuwe AIE-codes, geen code, geen Master Plan, verder niets aangeraakt.

---

## 1. F1 — overgang bestaande adviezen

| Document | Wijziging |
|---|---|
| Replit-opdrachten, **F0** | scope uitgebreid: **alle bestaande adviesvormen en hun opslag** inventariseren — hoe ze tot stand komen, waar ze worden bewaard, welke velden ze dragen, wat de gebruiker ervan ziet |
| Replit-opdrachten, **F1** | nieuw bindend onderdeel "Overgang bestaande adviezen": nieuwe adviezen altijd volledig dossier · bestaande **niet** aanvullen met verzonnen waarden · status `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` · UI benoemt dat eerlijk waar relevant · **migratie- en overgangsplan** verplicht · "advies zonder dossier niet tonen" alleen voor **nieuwe** adviezen en pas **na bewezen overgang** · geen regressie van bestaande deterministische adviezen |
| Replit-opdrachten, F1 tests en Mirror | uitgebreid met de overgangstoetsen |
| Adviesherleidbaarheid (deel 10), **AIE-56** | tekst aangevuld met de overgangsregel. *Geen nieuwe code — de bestaande regel is genuanceerd, niet vervangen.* |
| README, **AIE-02** | overgangsregel als toelichting toegevoegd |
| Mirror-toetsen, **F1** | overgangstoets als even zware toets ernaast, met drie eigen afkeurgronden |
| Herstelprotocol | nieuw hoofdstuk 2a: bij verlies van een bestaand advies geldt **eerst terugzetten, dan onderzoeken**; een legacy-advies wordt nooit hersteld door ontbrekende velden alsnog af te leiden |
| Herstelprotocol, schijnoplossingen | vier regels toegevoegd |
| Afhankelijkheden | F0-regel voor de adviesinventarisatie; F1-regel voor het migratieplan vóór activering |
| Open punten | **O-11** toegevoegd: welke bestaande vormen alsnog een dossier kunnen krijgen en welke definitief legacy blijven — beantwoord in F1 op basis van F0, niet vooraf aangenomen |

## 2. F7 — conflict herkennen versus oplossen

| Document | Wijziging |
|---|---|
| Replit-opdrachten, **F7** | scope gesplitst. **Vóór besluit O-2 al bouwen:** conflictdetectie · beide bronwaarden · per waarde bron, tijdstip, actualiteit en betrouwbaarheid · geen stille samenvoeging · **geen persoonlijk advies op het betwiste gegeven** · waar passend om menselijke bevestiging vragen. **Geblokkeerd tot O-2:** uitsluitend automatische bronkeuze en conflictbeslechting |
| Replit-opdrachten, F7 blokkerende input | beperkt tot alleen het beslechtingsdeel |
| Afhankelijkheden | F7-regel aangepast: blokkerend "uitsluitend voor automatische bronkeuze en conflictbeslechting — detectie en weergave mogen vooruit" |
| Mirror-toetsen, **F7** | toetspunten uitgebreid met beide waarden, de vier kenmerken per waarde, het verbod op advies op het betwiste gegeven, en de bevestigingsvraag. Afkeurgrond toegevoegd voor automatische beslechting vóór O-2 |
| Open punten, **O-2** | herschreven: blokkeert nu expliciet alleen het beslechtingsdeel |
| Herstelprotocol | schijnoplossing toegevoegd: automatisch conflict beslechten "om de gebruiker te helpen" |

## 3. Vrijgavevolgorde

| Document | Wijziging |
|---|---|
| README, stopregel | uitgebreid met de volledige volgorde: alleen F0 · daarna commit, push, vaste eind-SHA, Mirror-toets · **en stop** · F1 start niet automatisch · eerst beoordeling van hergebruikmatrix, risico's en open besluiten door ChatGPT en René · **geen versnelde automatische F0–F13-bouwstraat** |
| Replit-opdrachten, inleiding | zes genummerde stappen van de vrijgavevolgorde, plus de regel dat een fase die "logisch volgt" geen vrijgegeven fase is |
| Replit-opdrachten, F0 Mirror | "Na F0: commit, push, vaste SHA, Mirror-toets — en stop" |
| Afhankelijkheden | nieuw hoofdstuk 1a met de volgorde; F1-regel dat de beoordeling door ChatGPT en René een blokkerende voorwaarde is |
| Mirror-toetsen, F0 | toegevoegd: **Mirror geeft geen vrijgave voor F1** — dat is een besluit van René |
| Open punten | slothoofdstuk herschreven met de volledige volgorde |
| Herstelprotocol | schijnoplossing toegevoegd: doorgaan met F1 terwijl de overgang nog niet bewezen is |

---

## Niet gewijzigd

Alle overige documenten, alle AIE-codes, de tien productbeloftes, de faseindeling F0–F13, en alle overige regels. **Geen nieuwe AIE-code toegevoegd**; waar een bestaande regel genuanceerd moest worden (AIE-56), is de tekst van die regel aangevuld en niet vervangen door een nieuwe code.

---

# KLAAR VOOR CHATGPT-EINDCONTROLE

---

*Niets gecommit. Niets gepusht. Geen Replit-taak gestart.*
