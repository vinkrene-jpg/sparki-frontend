# BUILD_01 F0 — Risico's

Basis-SHA b012a18f · 01-08-2026.

**R1 — endedAt-migratie op linktabellen.** `coach_athlete_links`/`parent_athlete_links`/`friend_links` kennen nu ontkoppelen als rijmutatie; historie bestaat deels niet meer. Migratie kan alleen vooruit eerlijk zijn (bestaande rijen: endedAt=NULL). Verwijderde historie wordt NIET gereconstrueerd (M-2: markeren, nooit verzinnen).

**R2 — BB-08 raakt de hele club-UX.** Alle clubrollen landen nu in de athlete-shell. Eigen startpunten per rol (F3) verschuiven navigatie voor bestaande gebruikers; zonder active_context (F4) is "equivalent scherm na rolwissel" niet definieerbaar. F3 en F4 zijn de facto één samenhangend blok.

**R3 — coach-nav 3 → 5 posities (BB-06).** Bestaande coach-gebruikers krijgen een andere navigatie. Inhoudelijke invulling van positie 2–4 voor coach vereist een productkeuze (welke labels) — besluit René nodig vóór F4-oplevering, anders bouwen we een raadsel.

**R4 — consent-enum-unificatie kan bestaande flows breken.** parent_consent_status, sharing-levels en legal-acceptance-kinds zijn drie levende systemen met eigen tests. Unificatie moet mapping-based (oude waarden blijven leesbaar), M-3: onbekend → strengste regime.

**R5 — centrale diensten (PD-1..5) zijn pakketoverstijgend.** Terugdraaien raakt pakket 02–04 (§13 pakket). Elke PD-fase eist dus een extra strenge migratie-/rollbackproef vóór afhankelijke pakketten erop bouwen.

**R6 — geen tweede agenda: verleidelijk om planned_workouts te kopiëren.** PD-1 moet verwijzen (source_module/source_record_id), nooit dupliceren; anders ontstaat de dubbele waarheid die het pakket verbiedt. Bestaande engines (day-type, today-orchestrator) blijven op de brontabellen draaien.

**R7 — notificatie-uitbreiding vs. bestaande honesty-regels.** Bestaande lessen (idempotente dedupeKey, daily fold, attention-rotatie, geen gevoelige pushinhoud) zijn hard verworven; PD-5-uitbreiding mag die paden niet regressen. safe_preview moet de BESTAANDE pushtekst-discipline formaliseren, niet vervangen.

**R8 — nutrition_specialist grenzen.** Jeugd: geen gewichts-/caloriedoelen — dit raakt de bestaande fueling-engine (jeugd-no-numbers bestaat al) en het seizoensdoel (17+ only). De nieuwe rol moet die bestaande fail-closed-regels consumeren, niet herimplementeren.

**R9 — client-side zichtbaarheidsguards.** Endpoints zijn server-side gescoped, maar "onbevoegd = onzichtbaar" is geen getest contract. F2/F9 moeten per rolmodule een negatieve zichtbaarheidstest toevoegen (governor-fixtures + e2e-harness bestaan hiervoor al).

**R10 — workflowlimiet & testvolume.** Het pakket eist veel nieuwe tests; workflow-slots zijn op. Nieuwe tests draaien via shell (bestaande afspraak), e2e via e2e/tests/.

**R11 — parallelle bouwstromen.** ABONNEE_ADMIN_01 (taak #537) draait als taakagent op klant/lidnummer-terrein dat F10 (contactenlaag) raakt. Afstemming nodig vóór F10 start: contact-identiteit mag lidnummer-model niet dupliceren.

**R12 — Mirror-parallel op fase-SHA's.** Acceptatieomgeving draait mee op main; elke fase-SHA verschuift het label. Zelfde afspraak als TESTDEPLOY_SYNC_01 hanteren (inhoudelijke diff-bewijzen bij docs-only stappen).
