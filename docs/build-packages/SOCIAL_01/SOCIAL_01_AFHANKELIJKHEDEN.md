# SOCIAL_01 — AFHANKELIJKHEDEN

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


## 1. Exact nodig
| Nodig | Vindplaats | Waarvoor | Zonder dit |
|---|---|---|---|
| Toegangscontrole | `lib/world-social/access.ts` | zichtbaarheid per kijker | tweede toegangscontrole |
| Feed-engine | `engines/world-feed/` | feedopbouw uitbreiden | tweede feed |
| Deelmechanisme | `schema/route-shares.ts`, `routes/share.ts` | bestaand delen behouden | tweede deelmechanisme |
| Privacyzones | bestaande zonelogica | locatie in gedeelde inhoud | huisadres lekt |
| Herkomst van inhoud | wereldsimulatie- en seedmarkering | echt en gesimuleerd bij de bron scheiden | **stopconditie** |
| Jeugd- en toestemmingsregels | `JEUGD_OUDER_01`, bestaande oudertoestemming | minderjarigen | openbare jeugdprofielen |
| Activiteiten met herleidbare bron | `ACTIVITEITEN_01` | challenges eerlijk meten | verzonnen klassementen |

## 2. Verplicht MIRROR_PROVEN vóór start
1. `DATA_TRUST_01` — de kern van dit pakket is dat er niets verzonnen in de feed staat.
2. `ACTIVITEITEN_01` — challenges meten op activiteiten; dubbel getelde ritten leveren een oneerlijk klassement.
3. `TRAINER_CLUB_01` en `JEUGD_OUDER_01` — rol- en jeugdgrenzen; de feed mag geen achterdeur worden.
4. `ROUTE_PAKKET_01` — rechtenresolver en niet-legacy testidentiteiten.

## 3. Restpunten die niet blokkeren
| Restpunt | Gevolg |
|---|---|
| Moderatierol nog niet toegewezen | melden werkt en verbergt voor de melder; beoordeling wacht |
| `DOCUMENTEN_COMMUNICATIE_01` nog niet uitgevoerd | eenvoudige meldingen volstaan |
| Wandelen nog niet geactiveerd | wandelactiviteiten verschijnen nog niet in challenges |
| `KENNIS_01` nog niet uitgevoerd | geen kennisinhoud in de feed |

Een restpunt is pas een blokkade wanneer het punt 1 t/m 4 raakt.

## 4. Uitdrukkelijk géén afhankelijkheid
De **clubomgeving**. Een club is een echte organisatie met trainers en rollen, geen sociale groep. Dit pakket voegt daar niets aan toe en leent er niets van.
