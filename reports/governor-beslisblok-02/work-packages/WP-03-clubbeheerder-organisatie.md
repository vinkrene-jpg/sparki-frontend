# WP-03 — Clubbeheerder + organisatie-uitbreidingen

**Scope:** volwaardige beheeromgeving (leden, rollen, teams, uitnodigingen, limieten, audit-inzage) + de additieve schema-uitbreidingen uit fase 3: `clubs.organisation_kind`, `club_teams.parent_team_id` (selecties), `club_seasons` + season_id op toewijzingen, generalisatie toewijzingen naar rol×team-scope.
**Hergebruik:** /club/beheer, club-permissions (canManageClub), invitations, club_subscriptions-limieten (óók bij accept), club_audit_log.
**Niet wijzigen:** bestaand lidmaatschapsgedrag; alle migraties additief (guarded ADD).
**API:** beheer-routes uitbreiden (rolwijziging met audit; seizoenen; selecties); migratiepad assignments: nieuwe tabel + data-copy, oude leespaden tot omschakeling.
**UX:** beheerder ziet géén trainings-/gezondheidsdata zonder expliciete consent-scope.
**Rechten:** owner/admin per club; jeugdregels onaangetast.
**Tests:** limieten bij accept, rolwijziging-audit, seizoen-verloop sluit toewijzing, club A/B-isolatie.
**Bewijs:** migratie-diff (additief) + testoutput.
**Risico:** assignments-generalisatie raakt WP-01/02-paden → volgorde bewaken, data-copy verifiëren.
**Stopcondities:** migratie kan niet additief; tweede organisatie-model nodig.
**Afhankelijkheden:** WP-01. **Complexiteit:** L.
