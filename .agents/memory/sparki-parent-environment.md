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
