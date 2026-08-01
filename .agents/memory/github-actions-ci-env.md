---
name: GitHub Actions CI-omgeving voor Sparki
description: Waarom CI-runs falen die lokaal slagen, en de workflow-scope-grens van de Replit GitHub-koppeling.
---

## Regels
- **Workflow-bestanden pushen kan niet via de Replit GitHub-koppeling.** De connector-scopes (repo, read:org, …) bevatten géén `workflow`-scope en die is ook niet aan te zetten; elke push die `.github/workflows/` wijzigt wordt geweigerd (PUSH_REJECTED). Oplossing: de gebruiker plakt het bestand via de GitHub-webeditor (edit-URL geven), of een fine-grained PAT met Workflows-rechten.
  - **Why:** GitHub eist de aparte `workflow`-OAuth-scope voor workflow-wijzigingen; Replit's connector biedt die niet aan.
- **De api-server crasht in een kale CI bij het laden**, vóór enige test: `lib/integrations-anthropic-ai`/`-gemini-ai` gooien bij import als `AI_INTEGRATIONS_*_BASE_URL/API_KEY` ontbreken, en Clerk-middleware gooit per request zonder `CLERK_SECRET_KEY`. Nep-waarden in het juiste formaat (sk_test_…/pk_test_… en dummy-URL's) volstaan: dev-bypass handelt auth af, AI wordt in smoke-tests nooit echt aangeroepen. Plus: verse DB heeft geen users → `DEV_AUTH_CLERK_ID` + één geseede user_profiles-rij nodig; en validators-jobs eisen `pnpm install` (scripts importeren workspace-pakketten).
  - **How to apply:** bij elke nieuwe CI-job die de echte app boot: DATABASE_URL(verse pg-service) + SESSION_SECRET + NODE_ENV=development + DEV_AUTH_BYPASS + DEV_AUTH_CLERK_ID + seed-rij + dummy Clerk/AI-vars. Job-logs zijn met het connector-token niet leesbaar (403 admin) — reproduceer lokaal in een worktree met `env -i` en een scratch-DB.
