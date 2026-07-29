# WP-03 — Clubbeheerder en organisatiestructuur — EINDRAPPORT

**Status: WP_03_CLUB_ORGANISATION_READY**

## Wat is gebouwd (per stap)

1. **Bestandsopname** — `01_EXISTING_CLUB_FLOW_MAP.md`: één bestaand organisatiemodel; additief uitbreiden, geen tweede model.
2. **Additieve migratie** — `02_ADDITIVE_MIGRATION_PLAN.md`: `clubs.organisation_kind` (default 'club'), nieuwe tabel `club_seasons` (partial unique: max één actief seizoen per club), `club_teams.parent_team_id/season_id`, `club_trainer_assignments.starts_on/ends_on/season_id` — allemaal nullable/gedefault, nul dataverlies; drift-check schoon; rollbackplan in het rapport.
3. **Leden/rollen/toewijzingen** — `activeAssignmentWindow()` (endsOn null of ≥ vandaag Amsterdam) op alle leespaden (club-permissions, sharing, hoofdtrainer-overview, berichten-scopes); rolwijzigings-audit met lid/van/naar/reden; toewijzing beëindigen = endsOn zetten (nooit DELETE, 409 bij dubbel); ledenlijst met zoek/rolfilter/historie (historie alleen beheer).
4. **Seizoenen & selecties** — seizoenen aanmaken/activeren/afsluiten (max één actief; afgesloten definitief en read-only, ook team-edits); selecties via `parentTeamId` (max één niveau); afsluiten beëindigt de seizoenstoewijzingen (historie blijft).
5. **Uitnodigingen & limieten** — pakketlimiet óók bij accept; laatste-plek-race afgedekt met één gedeelde advisory xact-lock `(881100, clubId)` voor join én accept; intrekken blokkeert accept; server-side beheeroverzicht `GET /api/clubs/:clubId/invitations`; geen echte mails in dev/tests.
6. **Beheerdashboard** — inrichtingssignalen uit echte data (geen actief seizoen, geen teams, limiet (bijna) vol); screenshots leeg + ingericht, mobiel + desktop in `screenshots/` (`03_BEHEER_DASHBOARD.md`).
7. **Tests** — `club-organisation` O1–O18 **18/18 groen**, dekt de 20 spec-punten samen met bestaande suites (zie hieronder).
8. **Architect-/securityreview** — 1 herstelronde: venster-filter op berichten-scopes, lock-key-unificatie, server-side uitnodigingenendpoint. Daarna geen open ernstige punten.

## Spec-testdekking (20 punten)
1–2 club A/B-isolatie: O14 + bestaande clubtests · 3 trainer-rolwijziging 403: O2 · 4 hoofdtrainer: hoofdtrainer-workspace 6/6 · 5 ploegleider: O6 · 6 mechanieker: O15 · 7 rol-audit: O1 · 8 audit zonder gevoelige inhoud: O16 · 9 beëindigd lidmaatschap direct dicht: O3 · 10 afgesloten seizoen historie/geen toegang: O10+O13 · 11 team A/B-lek: trainer-rights + assignedAthleteIds clubjoin · 12 jeugd fail-closed: bestaande consenttests (ongewijzigd pad) · 13 limiet bij accept: O11 · 14 gelijktijdige accept: O17 · 15 ingetrokken uitnodiging: O12 · 16 legacy-gelijkwaardigheid: O18 · 17 idempotente migratie: drift-check (stap 2, no-op bij herhaalde push) · 18 WP-01: governor-role-foundation 11/11 · 19 WP-01C: trainer-rights 20/20 · 20 WP-02: hoofdtrainer-workspace 6/6.

## Regressie (alles groen)
Web typecheck ✓ · API typecheck ✓ · prod build web ✓ · prod build API ✓ · governor-role-foundation 11/11 · trainer-workspace-isolation 6/6 · trainer-rights 20/20 · hoofdtrainer-workspace 6/6 · cross-account-isolation 19/19 · coach-parent-link-isolation 13/13 · links-end-isolation 3/3 · club-organisation 18/18 · admin-smoke 12/12.

## Herstelcontrole na agentfout + merge taak #411 (29-07-2026)
Volledige statuscontrole uitgevoerd na een agent-onderbreking én de merge van taak #411 (`8e7ad2c9`, club-trainer toegangstiers):
- **WP-03-stappen 1–9: allemaal afgerond, gecommit en gepusht** (t/m `85aa28cb`). Geen half toegepaste WP-03-wijzigingen gevonden; enige ongecommitte file was een auto-gegenereerd sandbox-bestand.
- **Alle drie de reviewbevindingen opgelost** in `1badb35c` (venster-filter berichten-scopes, gedeelde advisory-lock `(881100, clubId)`, server-side uitnodigingenendpoint).
- **Geen test veroorzaakte de fout**; de onderbreking trof alleen een verkennings-subagent, geen bouwwerk.
- **Herverificatie ná merge #411, alles groen:** libs+api+web typecheck, api esbuild, web prod build, club-organisation 18/18, governor-role-foundation 11/11, trainer-workspace-isolation 6/6, trainer-rights 20/20, hoofdtrainer 6/6, cross-account 19/19, coach-parent-link 13/13, links-end 3/3, admin-smoke 12/12.
- **Migratiestatus schoon:** `scripts/check-schema-drift.mjs` → "Geen echte drift — alleen bekende no-op-lussen (catalogus-geverifieerd)"; migratie `0004_coach_private_notes.sql` uit #411 is toegepast.

## Bewuste keuzes
- Geen FK-references op de nieuwe nullable kolommen (additief, legacy-veilig); integriteit afgedwongen in de routes.
- Eén organisatiemodel; `organisation_kind` maakt latere verenigingsvormen mogelijk zonder migratie.
- Uitnodigingsmails blijven uit in development/tests (link-gebaseerd).
