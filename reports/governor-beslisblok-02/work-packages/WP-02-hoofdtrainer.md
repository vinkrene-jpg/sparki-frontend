# WP-02 — Hoofdtrainer (kwaliteitsbewaking + audittrail)

**Scope:** hoofdtrainer beheert trainer-toewijzingen binnen de eigen club; ziet trainerswerk (plannen/voorstellen) van toegewezen teams; mag aanpassen met verplichte audittrail — nooit stil overschrijven.
**Hergebruik:** clubrol `hoofdtrainer` (bestaat), club_trainer_assignments, club_audit_log, WP-01-lijstlogica.
**Niet wijzigen:** trainer-rechten zelf; sporter-consent blijft de bovengrens (hoofdtrainer ziet niets extra's boven deelniveau).
**API:** CRUD op toewijzingen (club-scoped, hoofdtrainer/admin); wijzigingen op andermans plan schrijven audit-rij (oud/nieuw/wie/wanneer).
**UX:** teamoverzicht per trainer + wijzigingshistorie zichtbaar voor betrokken trainer.
**Rechten:** alleen binnen eigen club; multi-club hoofdtrainer = per club aparte context.
**Tests:** toewijzing-beheer alleen door hoofdtrainer/admin (403 voor trainer); audit-rij verplicht bij overschrijven; isolatie club A/B.
**Bewijs:** testoutput + audit-rijen in fixturecontext.
**Risico:** stil overschrijven sluipt in via bestaand PUT-pad → afdwingen in route, niet UI.
**Stopcondities:** audittrail niet afdwingbaar zonder destructieve wijziging.
**Afhankelijkheden:** WP-01. **Complexiteit:** M.
