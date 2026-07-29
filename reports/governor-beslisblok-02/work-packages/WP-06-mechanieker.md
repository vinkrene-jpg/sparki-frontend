# WP-06 — Mechanieker-werkruimte

**Scope:** mechanieker beheert toegewezen fietsen/materiaal: materiaalstatus per renner/team, defecten, onderhoudslog, km-slijtage (afgeleid), materiaalchecks rond wedstrijden.
**Hergebruik:** clubrol `mechanieker`, garage/material-engine, mechanieker-domeinregels (km altijd afgeleid, defect alleen uit eigen registratie), rol×team/renner-scope uit WP-03.
**Niet wijzigen:** materiaal blijft sporter-eigen; mechanieker krijgt werk-toegang, geen eigendom.
**API:** scoped lees-/schrijfroutes op garage-objecten van toegewezen renners (owner-checked + scope-checked); onderhoudsregistratie met auteur.
**UX:** werklijst per team; geen trainings-/herstel-/medische inhoud.
**Rechten:** toewijzing per team of renner; einde toewijzing sluit direct; jeugd: alleen materiaal, nooit persoonsdata er omheen.
**Tests:** mechanieker ziet alleen toegewezen materiaal; schrijfacties gelogd met auteur; isolatie tussen clubs.
**Bewijs:** testoutput fixturecontext.
**Risico:** dubbele schrijfpaden sporter/mechanieker op zelfde object → last-write met audit, nooit stil overschrijven.
**Stopcondities:** vereist eigendomsoverdracht van materiaal (onduidelijk data-eigenaarschap).
**Afhankelijkheden:** WP-03 (WP-05 nuttig). **Complexiteit:** M.
