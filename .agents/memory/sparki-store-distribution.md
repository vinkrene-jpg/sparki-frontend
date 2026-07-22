---
name: Sparki store-distributie (Golf 28)
description: App Store/Google Play distributielaag — kanaalplafond, update-advies, 426-uitstel tijdens rit, storecontroles.
---

# Store-distributie

- **Kanaal→releasegroep is een PLAFOND, geen groepstoewijzing.** Mobiele builds sturen `x-sparki-kanaal` (uit `EXPO_PUBLIC_CHANNEL` in eas.json); server capt de effectieve releasegroep met `leastPermissive`. Onbekend kanaal ⇒ productie (fail-closed); ontbrekende header (web/oude builds) ⇒ geen plafond.
  - **Why:** een productie-storebuild moet zich als productie gedragen, ook voor interne gebruikers — maar web stuurt geen kanaal, dus fail-closed op ontbreken zou web breken.
  - **Beperking (bewust):** dit is best-effort — de header komt van de client; harde handhaving zou server-attestatie vergen (architect-noted, geaccepteerd).
- **Versieblokkade (426) nooit tijdens een actieve rit.** De blokkade wordt gelatcht en pas gemeld na stop/reset (`setRideActive` in mobiel `lib/release.ts`, gekoppeld in `useRideRecorder`). Veiligheid > versiehandhaving.
- **Aanbevolen versie ≠ minimum.** `recommended_version` (additief) geeft alleen een rustig, wegtikbaar advies via `/api/release/version-check` — die route mag NOOIT blokkeren (catch ⇒ `ok:true`).
- **Storecontroles zijn tweetraps:** mobiel-lokaal (`check-prod-config.mjs`: app.json/eas.json/machtigingen/secrets) + repo-breed (`scripts/store-release-check.mjs`: kanaal↔server-mapping, publieke legal-routes, accountverwijdering, dev-domeinscan) + geprinte checklist van stappen die alleen buiten de repo kunnen (ondertekening via EAS, formulieren, testaccount).
- Publieke legal-pagina's (`/privacy`, `/voorwaarden`) renderen dezelfde DB-teksten als in-app; markdown-renderer is React-tekst-only (geen HTML-sink).
