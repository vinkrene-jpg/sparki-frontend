---
name: Prod-account toegang & schrijfacties
description: Hoe je met toestemming iets op een prod-account wijzigt — e2e-proof-ticket, want workspace Clerk-keys horen bij een ANDERE instance dan productie.
---

- De workspace-secrets CLERK_SECRET_KEY én CLERK_SECRET_KEY_LIVE wijzen naar dezelfde dev-instance; de échte prod-Clerk-key bestaat alleen ín de deployment en is niet uitleesbaar. Prod-clerkIds (user_3FXo…) zijn dus NIET te vinden via api.clerk.com met workspace-keys.
- Werkend prod-schrijfpad (alleen met expliciete opdracht van de gebruiker): POST https://sparki-frontend.replit.app/api/e2e/proof-ticket met header x-e2e-proof-token (waarde = prod-env-var E2E_PROOF_TOKEN, zichtbaar via viewEnvVars environment production). Munt een eenmalig ticket voor uitsluitend E2E_PROOF_EMAIL. Daarna nix-chromium + Clerk.client.signIn.create({strategy:'ticket'}) en fetch met credentials tegen /api/… — altijd eerst /api/auth/me tegen verwacht clerkId verifiëren.
- **Why:** ticket-mint via workspace-keys gaf 404 "no user found"; alleen de server met de deployment-key kan tickets munten. Zo is 02-08 het per ongeluk gezette developmentGoal ("recreatief") op Renés prod-profiel via PUT /api/athlete/profile {developmentGoal:null} teruggezet.
- **How to apply:** elk prod-schrijfverzoek op een account → dit pad; prod-DB via executeSql is read-only. Sporen melden: Clerk-token/sessie + lastSeenAt.
