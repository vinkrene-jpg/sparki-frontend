# WP-01 — STAP 2: TRAINERWERKRUIMTE-INGANG

## Bestaand (hergebruikt, ongewijzigd)
- Ingang: bestaande rolwisselaar (Instellingen-sheet → `PUT /api/auth/me/role`, server weigert rollen die niet in `profile.roles` staan → geen trainerdata zonder trainercontext).
- Rolwissel ververst direct: `App.tsx` rendert CoachHome bij `activeRole==='coach'`, BottomNav + chapters wisselen mee (`chaptersForRole`); alle data-hooks zijn user-gebonden react-query keys.
- Desktop en mobiel delen dezelfde componenten en dezelfde server-side capabilitycontrole (`requireCoach`/`hasRole`).
- Startpagina toonde al: toegewezen sporters (dashboard, geprioriteerd), eerstvolgende training/aandachtspunt (todayWorkout + topSignal), ingangen naar cockpit, bulkplanner en berichten (unread-badge), eerlijke lege staat.

## Toegevoegd (één beperkte wijziging)
- `coach-home.tsx`: blok **"Open uitnodigingen"** — pending `coach_athlete`-invites van deze trainer (via bestaand `GET /api/invitations`, server filtert op inviter), met vervaldatum en link naar beheer. Geen nieuwe API, geen mock-data; blok verdwijnt eerlijk als er niets open staat.

## Controle
- Web typecheck: 0 fouten. Geen tweede navigatiesysteem, geen los traineraccount, geen nieuw model.
