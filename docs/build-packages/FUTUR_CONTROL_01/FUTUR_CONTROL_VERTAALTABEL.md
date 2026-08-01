# FUTUR_CONTROL_VERTAALTABEL

**Van:** `SPARKI_CONTROL_01_BOUWPAKKET v1.1` (1 augustus 2026)
**Naar:** `FUTUR_CONTROL_01` (generieke kern) + `SPARKI_CONTROL_CONNECTOR_01` (eerste productconnector)
**Datum:** 1 augustus 2026

**Uitgangspunt:** er gaat **niets verloren**. Elk onderdeel van v1.1 komt terug, met vermelding waar. `SPARKI_CONTROL_01 v1.1` blijft als bronpakket bestaan en wordt **niet ingetrokken** zonder expliciet besluit (`FC-B01`).

---

## 1. Regels

| v1.1 | Onderwerp | Nu | Wijziging |
|---|---|---|---|
| CTL-01 | Geen tweede adminarchitectuur | FCV-03, FCA-09, FCM-10 | Verbreed van "geen tweede adminarchitectuur binnen Sparki" naar "geen tweede beheerarchitectuur naast Futur Control" |
| CTL-02 | René enige vrijgever | FCV-07, FCS-03, AGV-03 | Ongewijzigd, nu productoverstijgend |
| CTL-03 | Vrijgaveketen | FCV §8, F9b | Ongewijzigd |
| CTL-04 | Append-only audit | FCV-12, FCS-21..25, F2 | Verbreed naar alle producten en infrastructuur |
| CTL-05 | Geen vals groen | FCV-08, HCK-06, FCM-11 | Ongewijzigd |
| CTL-06 | Agentverboden | FCS §4, AGV §3 | Uitgebreid met connectorrechten, secrets en infrastructuurcommando's |
| CTL-07 | Wat agents wel mogen | AGV §2 | Ongewijzigd |
| CTL-08 | Zaakgebonden minimale inzage | FCS-09, F9a | Ongewijzigd |
| CTL-09 | Mobiele UX-standaard | FUX §1, FCV §10 | Ongewijzigd |
| CTL-10 | Rapportstandaard | FCA-18 | Uitgebreid met infrastructuur- en noodrapporten |
| CTL-11 | Noodstop overal bereikbaar | AGV-09..12, FUX-15 | Verbreed naar **productoverstijgend** en naar de lokale runtime |
| CTL-12 | Overdraagbaarheid | FCV-04, FCC §2, FCM-27 | Ongewijzigd |
| CTL-13 | Geen mockdata | FCV-16, FCM-15 | Ongewijzigd |
| CTL-14 | Geen kopie van de productiedatabase | FCA-03, INF-04 | Uitgebreid naar de NAS |
| CTL-15 | Lerende organisatie / kennisitems | AGV §7, F6c | Verbreed: kennisitems dragen hun herkomstproduct mee |

## 2. Fasen

| v1.1 | Onderwerp | Nu | Laag |
|---|---|---|---|
| F0 | Inventarisatie | F0 (generiek) + SCC-F0 (Sparki) | kern + connector |
| F1 | Auditfundament | **F1B** | kern |
| F2 | Systeemstatusdashboard | **F5a** | kern |
| F2A | Product Health | **F7a** | kern |
| F3 | Incidentregister | **F6a** | kern |
| F3A | Kennisitems | **F6c** | kern |
| F4 | Agentbesturing | **F8** | kern |
| F5 | Supportinbox | **F9a** | kern |
| F6 | Releaseoverzicht | **F9b** | kern |
| F6A | Capability Matrix | **F7b** | kern |
| F7 | Mobiele beheeromgeving | **F10b** | kern |
| F8 | Continuïteit en noodmodus | **F11A** (observatie en voorbereiding) + **F11B** (externe noodhandelingen, `DEFERRED`) | kern + infra |
| F8A | Vandaag als beheerder | **F10a** (desktop) + **F10b** (mobiel) | kern |
| F9 | Sluitfase en bewijsbundel | **F12** | alle |
| — | *nieuw* | **F1A** beveiligde bootstrap · **F1B** append-only audit · **F1C** rechten- en beheerschil | kern |
| — | *nieuw* | **F3a/b/c** product-, dependency- en infrastructuurregister | kern |
| — | *nieuw* | **F4a/b** Sparki read-only connector | connector |
| — | *nieuw* | **F5b** functionele healthchecks · **F5c** infrastructuurcontroles | kern + infra |
| — | *nieuw* | **F6b** impactketen | kern |

**Belangrijkste verschuiving:** in v1.1 begon het bouwen met audit. Nu komt **F1A beveiligde bootstrap** ervóór, omdat een append-only spoor zonder betrouwbare identiteit niet vaststelt wíe iets deed — en volgt daarna **F1B append-only audit**, met de harde regel dat er geen functionele Control-handeling bestaat vóór F1B `MIRROR_PROVEN`. **Registers en connector (F3, F4)** komen vóór de statusschermen, omdat een status zonder geregistreerde bron een aanname is.

**Tweede verschuiving:** de basisversie is **read-only naar buiten**. Alles wat een effect zou hebben in een product, op infrastructuur of bij een externe dienst is uit de eerste bouwreeks gehaald en verplaatst naar een afzonderlijke toekomstige reeks achter de mutatiepoort.

## 3. Onderdelen van v1.1 die bewaard blijven

| Onderdeel | Waar het nu staat |
|---|---|
| F0-inventarisatie | Roadmap F0 + `SPARKI_CONNECTOR_INVENTARISATIE` in SCC-F0 |
| Auditfundament | F2 + `FUTUR_CONTROL_SECURITY_MODEL.md` §8 |
| Systeemstatus | F5a + `FUTUR_CONTROL_HEALTHCHECK_STANDARD.md` |
| Product Health (16 indicatoren, geen totaalcijfer) | F7a + HCK §5 |
| Incidentregister (alle velden, statusflow) | F6a |
| Kennisitems (10 velden, versiebeheer) | F6c + AGV §7 |
| Agentbesturing (voorstel, conceptdiff, noodstop) | F8 + `FUTUR_CONTROL_AGENT_GOVERNANCE.md` |
| Supportinbox | F9a |
| Releaseketen | F9b |
| Capability Matrix (12 kolommen, geen roadmap) | F7b |
| Mobiele beheeromgeving | F10b + `FUTUR_CONTROL_MOBILE_DESKTOP_UX.md` |
| Continuïteit en noodmodus | F11 + `FUTUR_CONTROL_CONTINUITY_STANDARD.md` |
| Vandaag als beheerder (12 kaarten, vaste volgorde) | F10a/b + FUX §3 |
| Mirror-toetsen (CTLM-A..M) | `FUTUR_CONTROL_MIRROR_TESTSTANDARD.md` FCM-10..27 |
| Herstelprotocol | Roadmap Deel 4 + SCC Deel 4 |
| Synchronisatiepatch | Roadmap Deel 5 + SCC Deel 5 |

**Niets uit v1.1 is geschrapt.** Wat verdwijnt is uitsluitend de aanname dat er precies één product is.

## 4. Mirror-toetsen

| v1.1 | Onderwerp | Nu |
|---|---|---|
| CTLM-A | Geen tweede architectuur | FCM-10 |
| CTLM-B | Geen vals groen | FCM-11 |
| CTLM-C | Server-side rechten | FCM-13 |
| CTLM-D | Auditdekking | FCM-14 |
| CTLM-E | Geen mockdata | FCM-15 |
| CTLM-F | Scope | FCM-16 |
| CTLM-G | Matrix volledig | FCM-17 + F7b |
| CTLM-H | Echte bronnen, geen totaalcijfer | FCM-19 |
| CTLM-I | Geen voorbeelddata op *Vandaag* | FCM-15 + F10a |
| CTLM-J | Kennis uit echte incidenten | FCM-24 |
| CTLM-K | Geen stilzwijgende agentwijziging | FCM-24, AGV-23 |
| CTLM-L | Ontbrekende data is `Onbekend` | FCM-11, FCM-23 |
| CTLM-M | Geen tweede architectuur (kennis/matrix/health) | FCM-10 |
| — | *nieuw* | FCM-12 geen schatting · FCM-18 isolatie · FCM-20 fail-closed · FCM-21 degradatie zichtbaar · FCM-22 secrets · FCM-25 noodstop · FCM-26 contractnaleving · FCM-27 overdraagbaarheid · `IMT-01..29` infrastructuur |

## 5. Keuzes

| v1.1 | Onderwerp | Nu | Status |
|---|---|---|---|
| CTL-B1 | Overlap met `31_HELPDESK_01`, `32_ADMIN_OPERATIONS_01`, `33_CONTINUITEIT_01`, `RELEASE_01` | **FC-B01** | **BESLOTEN = C** — F0 levert per pakket een voorstel; René beslist; F1A start pas daarna |
| CTL-B2 | Waar draait Control | **FC-B02** | **BESLOTEN: aparte deployment** (FCA-01) |
| CTL-B3 | Beheerdersidentiteit | **FC-B03** | **BESLOTEN = A** — aparte Control-identiteit met sterke authenticatie; uit de open besluiten verwijderd |
| CTL-B4 | Wat is een agent | **FC-B04** | **BESLOTEN = B** — analist en voorstelmaker (AGV-01) |
| CTL-B5 | Grens supportinbox vs. AI-helpdesk | **FC-B05** | **OPEN** |
| CTL-B6 | Wat mag mobiel goedkeuren | **FC-B06** | **OPEN** |
| CTL-B7 | Noodmodus en contactpersoon | **FC-B07** | **OPEN** — zelfde vraag als P-4; gaat over wie beslist, niet over wat Control mag doen |
| — | Positie van Forge | **FC-B08** | **BESLOTEN = C met harde grens** — beheerd product, nooit een tweede beheerlaag, geen kernafhankelijkheid |
| — | Periodiciteit hersteltest | **FC-B09** | **OPEN tot F0** de gegevenssoorten en herstelomgeving heeft geïnventariseerd |
| — | Naam en registratie van Futur Control | **FC-B10** | **OPEN, niet blokkerend** |
| — | Wat zijn Guardian en Governor | **FC-B11** | **OPEN** — blokkeert alleen F13 |
| — | Noodmodus onder de blokkade | **FC-B12** | **BESLOTEN** — F11A basisversie, F11B `DEFERRED` |
| — | Replicatiepauze bij ransomwaresignaal | **FC-B13** | **BESLOTEN** — geen Control-commando; detecteren, alarmeren, voorstellen, menselijke procedure; native NAS-bescherming alleen registreren en observeren |

Volledige uitwerking met gevolgen: `FUTUR_CONTROL_OPEN_BESLUITEN.md`.

## 6. Naamgeving

| Oud | Nieuw |
|---|---|
| `SPARKI_CONTROL_01` | `FUTUR_CONTROL_01` (kern) + `SPARKI_CONTROL_CONNECTOR_01` (connector) |
| `CTL-nn` regels | `FCV/FCA/FCS/PCS/DEP/HCK/AGV/FUX/FCC/FCM/INF/NAS/LSV/HYB/IMT-nn`, per domein |
| `CTL-Bn` keuzes | `FC-Bnn` |
| `CTLM-x` Mirror | `FCM-nn` |
| Doelmap `docs/build-packages/35_SPARKI_CONTROL_01/` | `docs/build-packages/35_FUTUR_CONTROL_01/` + `36_SPARKI_CONTROL_CONNECTOR_01/` — **mapnummering ter bevestiging aan ChatGPT**, die de nummering beheert |

**Let op:** `SPARKI_CONTROL_01 v1.1` blijft als document bestaan met de status `bronpakket, opgevolgd door FUTUR_CONTROL_01` — niet `INGETROKKEN`, zolang `FC-B01` openstaat.
