---
name: Sparki clubomgeving
description: Club-entiteit met least-privilege rechtenlaag, consent-gated trainerinzage, pakketlimieten en signup-locking
---

**Regels:**
- Club-rechten lopen via één context-resolver (actief lidmaatschap, `endedAt IS NULL`); beheerders zien NOOIT sportdata, trainers alleen expliciet toegewezen sporters mét consent.
- Jeugd-consent fail-closed: <16 óf onbekende leeftijd ⇒ alleen een gekoppelde (accepted) ouder mag toestemmen; zelf-consent geeft 403.
- Coachtrainingen worden nooit automatisch overschreven: club→schema maakt een NIEUWE planned_workouts-rij (source "club"); vervangen van een coach-source geeft 409.
- Pakketlimieten moeten op BEIDE momenten worden afgedwongen: bij uitnodiging maken én bij accepteren (pending invites omzeilen anders de limiet). Capaciteitscheck bij accept via clubId (accepteerder is nog geen lid).
- Cross-club isolatie: team/groep-ID's uit request altijd valideren tegen ctx.club.id, en lookup-helpers defensief joinen op de club-kolom van de parent-tabel — nooit alleen op ID.
- Signup/reserve-promotie serialiseren met een row-lock op de training (`SELECT … FOR UPDATE` in de transactie), anders overboekt gelijktijdig aanmelden.
- Join-met-code: capaciteitscheck + insert in één transactie met advisory lock per club; join-codes DB-uniek (anders kan één code naar meerdere clubs wijzen).
- Niet-actieve clubstatus blokkeert alle schrijfacties (plannen/aanmelden/berichten) met 409 via één guard-helper; bekijken blijft altijd mogelijk.
- Consent-UI: "granted" afleiden uit consent-RIJEN met status granted — nooit uit de lijst beschikbare scopes (die staat altijd vol ⇒ alles lijkt aan).

**Why:** architect-review vond precies deze drie gaten (limiet-bypass via accept, cross-club leakage via assignments, signup-race) nadat 16/16 functionele tests groen waren — functionele tests vangen autorisatie-randen niet vanzelf.

**How to apply:** bij elke nieuwe club-route: context-resolver eerst, ID's club-scopen, consent/leeftijd fail-closed, mutaties met capaciteit of telling in één gelockte transactie. Tests: `test:club` (via shell draaien, workflowlimiet).
