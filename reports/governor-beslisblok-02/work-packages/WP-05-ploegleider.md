# WP-05 — Ploegleider/teammanager-werkruimte

**Scope:** teammanager werkt binnen toegewezen team(s): wedstrijdplanning (club_race_events + selecties), logistiek/aanwezigheid, race-room-teamfase, live koerscontext (consent-gated), volgauto-koppeling per team.
**Hergebruik:** clubrol `teammanager` + club_teams.managerClerkId, race_rooms (single-user → teamfase), live-location audience-checks, volgauto, rol×team-scope uit WP-03.
**Niet wijzigen:** races blijven sporter-eigen (clerkId); `races.team_riders` (vrije jsonb) vervangen door echte selectie-verwijzingen = onderdeel van dit pakket, additief met migratiepad.
**API:** team-scoped endpoints voor selecties/logistiek; race-room multi-user met rolonderscheid.
**UX:** ploegleider ziet koers-/logistiekcontext, géén herstel-/medische details.
**Rechten:** alleen toegewezen teams; live locatie alleen met sporter-consent, hercheck per read; einde toewijzing sluit direct.
**Tests:** ploegleider ziet alleen eigen team; live-locatie zonder consent dicht; team A ≠ team B binnen dezelfde club.
**Bewijs:** testoutput + fixture-scenario met beide teams.
**Risico:** FOUTIEF_GEKOPPELDE team_riders-jsonb → dubbele bron; migreren naar verwijzingen, jsonb read-only laten tot omschakeling.
**Stopcondities:** teamproduct vereist tweede organisatiemodel; consent-hercheck niet inpasbaar.
**Afhankelijkheden:** WP-03. **Complexiteit:** L.
