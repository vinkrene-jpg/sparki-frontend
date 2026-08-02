# F6 — Auditlogging bij VOG

**Pakket:** SPARKI_BUILD_01  
**Fase:** F6 — VOG en jeugdveiligheid (auditgedeelte)  
**Status:** Nagekeken tegen main `190d482a` + besluiten 01-08-2026  
**Datum:** 2 augustus 2026

---

## Wat er al is (niet opnieuw bouwen)

- In `lib/db/src/schema/club.ts` (regel 142–144): velden `vogIssuedOn`, `vogRecordedAt`, `vogRecordedByClerkId` op het clublidmaatschap.
- In `routes/club.ts`:
  - Regel 914: driejaarscontrole
  - Regel 980–982: wegschrijven van de wijziging

## Wat ontbreekt (opdracht)

De schrijfactie op regel 980–982 legt **niets** vast in een auditlog.  
Elke wijziging aan de VOG-registratie moet precies één auditrecord opleveren.

---

## Bindende regels

- **Gebruik de bestaande auditlaag** → `security_audit_log`  
  (geen nieuwe tabel, geen tweede auditsysteem)
- **Geen statusmachine**  
  Het besluit van 01-08 is: de club vinkt aan dát een VOG is getoond, mét afgiftedatum.  
  Er is geen `status`-veld. Log alleen of er een registratie is en de afgiftedatum.
- **Gedrag bij ontbreken vs. verlopen**
  - Ontbrekende registratie bij toevoegen van een trainer aan een **jeugdgroep** → **weigeren** met eerlijke foutmelding.
  - Verlopen registratie (ouder dan 3 jaar) → **alleen waarschuwen**, niet blokkeren.
  - Bestaande koppelingen zonder registratie → markeren en melden, **nooit stil verbreken**.

---

## Exacte auditrecord per wijziging

Eén record in `security_audit_log` met:

| Veld             | Inhoud                                                                 |
|------------------|------------------------------------------------------------------------|
| `event`          | `vog_registratie_gewijzigd` · `vog_registratie_verwijderd` · `vog_registratie_gemigreerd` |
| `actorClerkId`   | Wie de wijziging deed                                                  |
| `subjectClerkId` | Over wie het gaat                                                      |
| `meta`           | Rol van de actor · clublidmaatschap + club · oude en nieuwe afgiftedatum · optionele toelichting (alleen gewijzigde velden) |

---

## Gedragseisen

- Append-only (nooit wijzigen of verwijderen)
- Altijd server-side geschreven (ook bij beheer- of migratiescripts)
- Nooit het VOG-document zelf, alleen de registratie + datum
- Leesrechten: alleen clubbeheer en platformbeheer

---

## Acceptatiecriteria

- Eén wijziging = precies één auditrecord
- Record bevat minimaal: tijdstip, actor, subject, oude + nieuwe afgiftedatum
- Onbevoegde kan de auditregels niet zien (ook niet via directe API)
- Clubbeheerder kan de geschiedenis van één persoon opvragen
- Migratie van bestaande koppelingen zonder registratie schrijft ook een record
- Toevoegen van trainer zonder registratie aan jeugdgroep wordt geweigerd
- Verlopen registratie geeft alleen een waarschuwing, geen weigering

---

## Wat er niet bij hoort

- Geen generieke “alles loggen”
- Geen opslag van het VOG-bestand
- Geen client-side logging
- Geen nieuwe audittabel
- Geen statusveld

---

## Open punt (blokkeert niet)

Voor het **clubauditlog** is een bewaartermijn van 3 jaar besloten, ook na verwijdering van de club.
`security_audit_log` is een andere tabel en heeft vandaag géén retentieregel — die termijn is dus nog niet vastgesteld.

Maak de retentie configureerbaar en laat de waarde voorlopig leeg tot René bevestigt. Dit blokkeert de bouw niet.
