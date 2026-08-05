---
name: Club-afronding C1–C4 lessen
description: Herhalende clubtrainingen, clubrol-navigatie, beheer-tabs, selectie-overrule — valkuilen en besluiten
---

- **races upsert-index**: club-race-sync upsert op (clerk_id, club_event_id) eist de partiële unieke index `races_clerk_club_event_uq` (predicaat club_event_id IS NOT NULL). Die stond nooit in schema/DB ⇒ elke selectie-POST 500'de. Migratie 0058 incl. dedup-preflight (nieuwste rij wint, alleen sync-rijen). **Why:** drizzle declareert de index niet vanzelf bij onConflictDoUpdate; onConflict zonder bestaande index faalt pas runtime. **How to apply:** bij elke nieuwe onConflictDoUpdate controleren dat de index in schema + migratie staat, en migraties met UNIQUE altijd een preflight-dedup geven.
- **Overrule-blokkades**: read-then-write autorisatie op een bestaande rij (overruledAt) moet in één transactie met `.for("update")`, anders schrijft een stale lezing langs de blokkade. POST- en DELETE-pad moeten hetzelfde beleid delen (teammanager || canManageClub), anders kan beheer wel zetten maar niet verwijderen.
- **Club-schrijfpoort**: élk nieuw club-schrijfpad (ook aparte routers zoals training-series) moet de status-poort spiegelen (status !== "actief" ⇒ 409); rechten-check alléén is niet genoeg.
- **Clubstand-navigatie (C2)**: onderbalk per clubrol is puur presentatie — localStorage-stand telt alleen als useMyClubs het lidmaatschap bevestigt (fail-closed); rechten blijven server-side. Labels in CLUB_ROLE_NAV_ENTRIES zijn §7-voorstel aan René.
- **C-T6 standaard-clubbalk**: clubnav-keuze is drie-standig (clubstand / expliciet "account" / niets-gekozen). Alleen bij niets-gekozen geldt de standaard (owner/admin krijgt de clubbalk); rolwisselaar naar accountrol MOET expliciet "account" schrijven, anders zet de standaard de clubbalk direct terug. Standaard bewust niet voor lichtere stafrollen (die zijn vaak óók sporter).
- **Beheer-tabs (C3)**: /club/beheer leest ?tab= met §7-namen (organisatie/mensen/structuur/beheer) gemapt op bestaande tabs Overzicht/Leden/Structuur/Instellingen.
