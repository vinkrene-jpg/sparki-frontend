---
name: Sparki ouderomgeving (Golf 12)
description: Per-categorie ouderrechten, leeftijdstiers, herbevestiging — fail-closed regels en test-valkuilen.
---

# Ouderomgeving — per-categorie rechten

- Rechtenlaag (`effectiveParentAccess`) is de ENIGE waarheid voor ouder-leestoegang. Elke ouder-route (ook legacy rosters/context) moet erdoorheen; gaten op oude routes = privacy-bypass. **Why:** architect-review vond legacy routes die alleen op `parentSharingLevel` gateden en zo uitgeschakelde categorieën lekten.
- **Onbekende leeftijd is fail-closed op het veiligheidsminimum** — óók als er eerder bredere rechten bevestigd zijn: clamp naar safety-only vóór de reconfirm-logica. `tier !== "unknown"`-skip in reconfirm is niet genoeg.
- Onbevestigde rechten (geen `consentConfirmedAt`) mogen nooit boven safety-only uitkomen. Bestaande tests die "summary ⇒ schedule zichtbaar" aannamen, moeten nu expliciet consent bevestigen (link: `consentConfirmedAt` + `ageTierAtConsent`) én de sporter een echte volwassen geboortedatum geven.
- Limieten met count-then-insert (bv. max 5 noodcontacten) racen: doe count+insert in één transactie achter `pg_advisory_xact_lock(hashtext(key))`.
- **How to apply:** bij nieuwe ouder-datastromen altijd per categorie gaten op `access.permissions.<categorie>`, nooit alleen op sharing-level; regressietest gelijktijdigheid met `Promise.all` van 8 posts en tel 201's.

## WP-R1 Ouderomgeving (jul 2026)
- Ouderonderbalk is bindend: Kinderen · Vandaag · Meldingen · Toestemmingen · Meer (PARENT_NAV_ENTRIES in lib/chapters.ts is de SSOT). Beide schillen (ScreenShell én CommercialShell) kiezen hun desktop+mobiele nav via `profile.activeRole` — nieuwe schil-chrome MOET rol-bewust zijn, anders lekt de sporternav naar ouders.
- **DEV Preview heeft een EIGEN routetabel** (dev-preview.tsx, startsWith-keten met StartPage-fallback): elke nieuwe pagina daar óók registreren, anders "werkt" hij in prod-router maar valt hij in preview/e2e stil terug op StartPage (zelfde valkuil eerder met /privacy).
- Ouder-writes zijn server-side geblokkeerd via één guard (parent-write-block) op /athlete, /races, /goals, /training-plan ⇒ 403 `parent_write_blocked`; GET blijft vrij. Geen parallel rechtenmodel: leestoegang blijft `effectiveParentAccess`.
- Ouderstart: POST /api/onboarding/parent-start (rol additief, idempotent) — een parent-rol slaat de sporteronboarding volledig over (rol zelf is het bewijs).
- Kindkiezer: localStorage-keuze (lib/parent-selected-child); bij precies één kind géén chips. e2e-valkuilen: DsMobileNav rendert <button> niet <a>; getByText matcht eerst de verborgen desktop-zijbalk op mobiel — altijd `visible=true`-filter.

## WP-04-aanscherping (jul 2026)
- Onbevestigde (legacy) ouderkoppeling ⇒ strikt SAFETY_CATEGORIES (gezondheid+herstel), nooit slaap/summary-extra's; die bredere defaults gelden alleen ná consentConfirmedAt.
- tier=adult zonder bij de adult-tier bevestigde keuze ⇒ reconfirmRequired en ALLES dicht; alleen expliciete herbevestiging door de sporter heropent.
