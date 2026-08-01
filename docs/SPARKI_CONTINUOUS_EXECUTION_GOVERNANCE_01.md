# SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 — geldende uitvoeringsregel

**Datum besluit:** 1 augustus 2026 (K1–K6 beslist door René via keuzeformulier).
**Status:** BINDEND. Vervangt de fase-vrijgaveregels in alle bouwpakket- en Mirror-documenten.
**Bron:** correctiepakket `attached_assets/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01_PATCH_*.md`; zelfde regel als `CONTINUOUS_BUILD_GOVERNANCE_01`, verbreed naar de volledige documentatie.
**Besluitaanduiding:** GOV-B1 (definitief nummer volgt bij opschoning van de nummerreeks).

## 0. Uitvoeringsregel (geldig vanaf 1 augustus 2026)

> Zodra René een volledige bouwopdracht aan Replit geeft, is de volledige daarin
> beschreven bouw-, test-, herstel-, migratie-, deployment-, productie- en
> rollbackstraat vrijgegeven. Replit voert alle fasen zelfstandig achter elkaar uit.
>
> Replit rapporteert per fase, maar wacht niet op antwoord. Rapporteren is geen wachtmoment.
>
> Mirror toetst parallel en vormt geen algemene wachtpoort. Mirror geeft geen menselijke
> bouwvrijgave, blokkeert geen onafhankelijke fasen en vraagt geen nieuwe toestemming voor
> reeds goedgekeurde scope. Ontbrekend bewijs is een herstelpunt, geen bouwstop.
>
> Productiepublicatie is een automatische poort met technische voorwaarden, geen menselijke
> goedkeuring: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd ·
> rollback beschikbaar · geen actieve harde stop.
>
> Alleen een aantoonbaar kritisch technisch, data-, privacy-, consent- of veiligheidsprobleem
> mag het direct afhankelijke onderdeel tijdelijk stoppen. Onafhankelijke bouw loopt door.
>
> Fasevolgorde binnen een document is een **technische afhankelijkheid**, geen vrijgavepoort.
> "Eerst X, dan Y" betekent: Y heeft het resultaat van X nodig — niet: Y wacht op toestemming.

Praktische kanttekening (platform): de daadwerkelijke Publish-klik op Replit kan alleen René
uitvoeren. De automatische poort bepaalt wanneer een productie-push **klaarstaat en gemeld
wordt**; er is geen inhoudelijke menselijke goedkeuring meer tussen groen en melden.

## 1. De zes besluiten K1–K6 (René, 01-08-2026)

| # | Besluit | Gevolg |
|---|---|---|
| K1 = **A** | Futur Control uitgezonderd | `FUTUR_CONTROL_01` en `FUTUR_CONTROL_MUTATION_GATE.md` blijven ongewijzigd: mutatiepoort + René-vrijgave blijven daar staan. Control blijft observatie-eerst. |
| K2 = **B** | Reeksen lopen door | Ook de **volgende opdracht in een reeks** start zonder nieuw sein van René. Concreet: `ROUTE_PAKKET_02c/02d` en taak #536 (wandelen) zijn hiermee geautoriseerd zodra hun technische afhankelijkheden vervuld zijn. |
| K3 = **A** | `RENE_APPROVED` uit de deployketen | Statusketen wordt BUILT → TESTED → MIRROR_PROVEN → DEPLOYED. `RENE_APPROVED` blijft uitsluitend bestaan als **product**besluit (release, prijs, merk), nooit als bouwgoedkeuring. |
| K4 = **A** | **Elf** hard stops | Zie §3. De blokkade op betaalde publieke release blijft aan de zes onbepaalde bewaartermijnen hangen (hard stop 10). |
| K5 = **A** | Verplichte tests = benoemde set | Zie §2. Rood = geen publicatie. |
| K6 = **A** | Input ≠ toestemming | Wachten op echte input (rechtenvrij mediabestand met bron/maker/licentie/versie; bronhiërarchiebesluit O-2) blijft. Alleen toestemmingspoorten vervallen. `MEDIA_UITLEG_01` F3 bouwt nooit met een placeholderbestand. |

## 2. Verplichte tests in de automatische productiepoort (K5=A)

Benoemde set — allemaal groen vóór productiepublicatie:
1. **Entitlements** — `test:entitlements` (29 scenario's) + `test:team-abonnement`;
2. **Rechten en scopes** — trainer/club/rollen-tests (o.a. `test:coach-parent-*`, governor-fixtures);
3. **Cross-account en consent** — `test:cross-account-isolation` + `test:links-end-isolation`;
4. **Jeugdtoestemming** — jeugd/ouder-consenttests (fail-closed);
5. **Stripe test/live-scheiding** — `test:stripe-testmode`-dekking (flag+allowlist AND, webhook-idempotentie);
6. **Migratie en rollback** — migraties gevalideerd + rollbackpad aantoonbaar.

Daarnaast blijven de bestaande poorten staan: build groen, `typecheck-api` (incl.
sanity-rapportcontrole en merkcopy-lint), `admin-smoke`, Poort 5b-rapport.

## 3. De elf hard stops (K4=A)

1. Aantoonbaar dataverlies
2. Cross-account-, cross-team- of consentlek
3. Verzonnen persoonlijke gegevens
4. Onveilige medische of jeugdfunctionaliteit (diagnose, gevaarlijk veiligheidsadvies, gewichts- of caloriedoel bij een minderjarige)
5. Mislukte destructieve migratie zonder rollback
6. Betaalstromen die onbedoeld bij Sparki terechtkomen
7. Blijvend rode build, typecheck of verplichte tests
8. Onoplosbare producttegenstrijdigheid waarvoor werkelijk een nieuw besluit nodig is
9. Productiedatabase onbereikbaar
10. Ontbrekende juridische productkeuze — blokkeert de **betaalde publieke release** zolang de zes bewaartermijnen onbepaald zijn
11. Ontbrekende rollback bij een destructieve wijziging, los van punt 5

Bij een hard stop: alleen de afhankelijke lijn stopt · onafhankelijke bouw gaat door ·
één concrete vraag aan René · na antwoord direct hervatten.

## 4. Mirror-uitkomsten (gevolg gewijzigd, woorden blijven)

| Uitkomst | Gevolg |
|---|---|
| `MIRROR_PROVEN` | door |
| `HERSTEL NODIG` | Replit herstelt zelf en gaat door |
| `AFGEKEURD` | alleen de geraakte lijn stopt |
| `NIET BEWIJSBAAR` | bewijs herstellen, bouw ligt niet stil |

Mirror blokkeert nooit op: cosmetisch gebrek · ontbrekend screenshot · oude Queue-kaart ·
ontbrekend tussenrapport · documentatiefout · verouderde versieaanduiding.
"Directe afkeurgronden" heten voortaan **directe herstelgronden**: een herstelgrond stopt de
lijn waarin hij optreedt, niet het pakket. Valt hij samen met een hard stop uit §3, dan geldt
de hard stop. Bewijsintegriteit blijft: bouwen tegen één vaste commit-SHA; Mirror voegt nooit
bewijs samen uit verschillende SHA's of omgevingen.

## 5. Featureflags

Toegestaan, uitsluitend technisch: rollback · compatibele datamigratie · A/B-test ·
tijdelijke providerbeperking · gecontroleerde overgang tussen twee technisch incompatibele varianten.
Verboden: standaard bouwpoort · menselijke vrijgavepoort · permanente verberging van afgeronde
functionaliteit · vervanging voor volledige implementatie.
Volledig gebouwd, getest en binnen goedgekeurde scope = standaardgedrag, zonder vlag.
Inventaris: zie `docs/SPARKI_FEATUREFLAG_INVENTARIS.md`.

## 6. Statuswoorden

`PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED` blijven bestaan als
beschrijving van **bewijsstatus**. `BUILT_UNPROVEN` is een normale tussentoestand, geen tekortkoming.
`SPARKI-BESLUIT-2026-004` (één kleine opdracht tegelijk, vrijgave per opdracht) is
**INGETROKKEN — BESLUIT RENÉ 01-08-2026** (tekst blijft staan in het register).

## 7. Wat NIET wijzigt

- `FUTUR_CONTROL_01` + mutatiepoort (K1=A) — René-vrijgave blijft daar volledig staan.
- `nutrition_specialist` niet simuleren zolang de rolwaarde niet server-side bestaat.
- Geen gewichts- of calorieadvies aan minderjarigen.
- E-bikebereik toont "onbekend" zonder bron.
- Jeugdtoestemming vóór instroom van echte jeugdleden.
- Productvrijgaven blijven productbesluiten van René: publieke Team-lancering (BUILD_03 F12),
  activering betaallink (technische+juridische verificatie, hard stop 10), Stripe-livegang, prijzen, merk.

## 8. Doorwerking in bestaande documenten

Elk geraakt document in `docs/build-packages/` en de Mirror-protocollen draagt bovenaan een
verwijzingsblok naar dit document; daarmee zijn alle in die documenten beschreven wacht- en
vrijgavepoorten (wachten op René, wachten op Mirror, per-fase-vrijgave, flag-als-vrijgavepoort,
`RENE_APPROVED` in de deployketen) vervallen. De volledige lijst geraakte documenten en zinnen:
`docs/audits/GOVERNANCE_CORRECTIE_RAPPORT_2026-08-01.md`.
