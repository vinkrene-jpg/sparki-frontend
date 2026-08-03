---
name: Sparki marketingsite (artifacts/site)
description: Marketingsite-architectuur, prerender/SSG, gedeelde prijzenbron, rol-eigen productschermen, laadtijdbewijs.
---

# Sparki marketingsite

- **Gedeelde prijzenbron**: `lib/pricing` (`@workspace/pricing`) is de SSOT voor alle abonnementsprijzen (site, app, Stripe-gateway). Stripe-gateway her-exporteert met compile-time dekking-check. **Why:** MKT-22 — prijs op site mag nooit afwijken van afrekening. **Let op (open):** trainer-STAFFELS (t/m 25 / t/m 50 / +€9,90 p.s.) staan in de bron en de site-calculator, maar de facturatie rekent nog alleen het basistarief — staffelfacturatie hoort bij COMMERCIE_01; tot dan is dit een bekende, bewust geaccepteerde kloof.
- **Prerender (MKT-18)**: `prerender.mjs` + `src/entry-server.tsx` (wouter `ssrPath`-prop op App) + `ssrPageMeta`-collector in use-page-meta; main.tsx hydrateert als #root kinderen heeft. Build-script zet BASE_PATH/PORT-defaults zelf. Effects draaien niet in SSR — meta komt uit de collector die tijdens render vult.
- **Asset-paden**: alles via `import.meta.env.BASE_URL` (root-relatieve `/screens/...` 404't onder `/site/`).
- **Rol-eigen schermen (MKT-28)**: geschoten met governor-rol-fixtures via DEV-Preview-impersonatie (`localStorage["sparki.dev.previewAthlete"]` → x-dev-clerk-id), zie e2e/tests/wp-r0-rollen.mjs-patroon. trainer/clubtrainer/club/ouder gevuld; ploegleider==team (zelfde clubwedstrijdscherm), staf/specialist eerlijk leeg met bijschrift. TESTFIXTURE-namen zijn echte fixture-data, bewust niet weggepoetst.
- **Fonts** self-hosted @fontsource/inter; laadtijdbewijs in `docs/proof-evidence/MARKETINGSITE_01/` (4G FCP < 1 s; traag 3G eerlijk > 1 s).
- **Valkuil**: `git stash -u` stashte `artifacts/site` → platform deregistreerde het artifact + workflow en at `artifact.toml` in de artifact-root; herstel = `verifyAndReplaceArtifactToml` met identieke `.replit-artifact/artifact.toml`. Nooit stash -u gebruiken op een boom met een ongecommit artifact.
