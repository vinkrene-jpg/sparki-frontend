# E2E-browsertestomgeving (WP-S1)

Echte browserkliks tegen de draaiende Sparki-app, met échte Clerk-login.
Gebouwd als harde eis van WP-S1 (besluit René 31-07-2026): zonder echte
browserklik geldt een werkpakket niet als afgerond en mag DEV Preview niet
als acceptatiebewijs worden gebruikt.

## Wat de omgeving garandeert
- **Echt inloggen:** Clerk ticket-login (éénmalig token per browsercontext)
  met een dedicated QA-account (`sparki-e2e-qa+clerk_test@example.com`) —
  nooit het account van een echt persoon.
- **Rolcontext:** `verifyIdentity()` controleert `/api/auth/me` op het
  verwachte clerkId én de verwachte rol en **faalt hard** bij een afwijking
  (o.a. de dev-fallback-valkuil: mislukte sessie valt stil terug op de
  geseedde QA-gebruiker).
- **Echte kliks:** `clickAndVerify()` klikt uitsluitend zichtbare elementen,
  maakt screenshots vóór en na, en controleert URL-pad, paginatitel en
  zichtbare inhoud. Verkeerde pagina of ontbrekende inhoud = FAIL.
- **Twee formaten:** telefoon 402×874 en desktop 1440×900 (`VIEWPORTS`).

## Waarom tegen een productiebuild
De dev-server rendert ALTIJD DevPreview met een **eigen routetabel**
(`dev-preview.tsx`) — dev-schermbewijs kan dus afwijken van de echte router.
`serve-prod.mjs` serveert `artifacts/sparki/dist/public` (SPA-fallback) en
proxyt `/api/*` naar de draaiende api-server. Bouw eerst:

```
cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build
```

## Draaien
```
node e2e/tests/meer-privacy.mjs
```
Browser: Nix-chromium (`which chromium`) — de bundled Playwright-browsers
missen systeemlibs op NixOS. Screenshots landen in `e2e/evidence/<test>/`.

## Eerste proef: Meer → Privacy
- Prod-build mobiel + desktop: klik op "Privacy" in Meer landt op `/privacy`
  met zichtbare kop "Privacyverklaring Sparki".
- Dev-preview-proef: reproduceerde de door René gevonden fout — vóór de
  WP-S1-fix ontbrak `/privacy` in de dev-preview-routetabel en landde de klik
  stil op de StartPage-fallback (bewijs:
  `e2e/evidence/meer-privacy/devpreview-OUD-…`). Na de fix rendert ook DEV
  Preview de echte Privacyverklaring.

## Sporen & opruimen
Elke run laat in Clerk een sign-in token + sessie voor het QA-account achter
en (eenmalig) geaccepteerde juridische documenten van dát QA-account. Tickets
worden nooit gelogd. Er wordt geen `storageState`-cookiebestand bewaard.
