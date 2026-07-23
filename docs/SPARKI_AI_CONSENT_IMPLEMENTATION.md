# Sparki — aparte, intrekbare AI-toestemmingen (OPDRACHT 0B)

## Model

Vijf aparte, per-gebruiker intrekbare toestemmingen in `privacy_settings`
(alle standaard **UIT**, fail-closed — geen rij of toggle uit = geen toestemming):

| Kolom | Toestemmingssoort | Dekt |
| --- | --- | --- |
| `ai_memory_enabled` | `ai_memory` | geheugen/observaties over de sporter |
| `ai_health_analysis_enabled` | `ai_health` + alle `sensitive: true`-doelen | gezondheid, mentaal, voeding |
| `ai_vision_enabled` | `ai_vision` | foto-/beeldanalyse (materiaal, voeding, Foto-lab) |
| `ai_document_analysis_enabled` | `ai_document` | documentanalyse (wedstrijdgidsen e.d.) |
| `ai_coaching_enabled` | `ai_coaching` | gepersonaliseerde coaching-formulering |

Bestaande kolommen `ai_memory_enabled` en `ai_sensitive_analysis_enabled`
kregen default `false` (waarden van bestaande rijen blijven onaangetast;
`ai_sensitive_analysis_enabled` blijft bestaan maar de gevoelig-poort gebruikt
voortaan `ai_health_analysis_enabled`).

## Afdwinging (server-side, één plek)

`artifacts/api-server/src/lib/ai/gateway.ts`:

- `enforceGates()` — gedeeld door `aiMessage` (tekst) en `aiMediaCall`
  (beeld/video): kill switch → toestemming (per aanroep vers gelezen, dus
  intrekken werkt direct) → jeugdcheck → rate limit (30/5min per gebruiker per
  doel). Persoonsgebonden toestemmingssoort zonder `clerkId` = blokkade.
- `CONSENT_FIELD` koppelt toestemmingssoort → privacy-kolom; `explicit_action`
  en `system` hebben geen aparte toggle (gebruikersactie resp. geen atleetdata).
- `aiMediaCall(purpose, clerkId, fn)` — nieuwe mediapoort: zelfde poorten,
  timeout-bewaking, metadata-only logging, `AiUnavailableError` bij falen.
- Nieuwe doelen: `photo_style` (`ai_vision`), `world_media_image` /
  `world_media_video` (`system`, fictieve scènes zonder atleetdata).

Deterministische engines (dag-type, readiness, voeding-rekenkern, planengine,
enz.) raken geen model aan en blijven volledig bruikbaar zonder toestemmingen;
call sites vangen `AiBlockedError`/`AiUnavailableError` en tonen hun bestaande
eerlijke fallback.

## Migratie

`lib/db/migrations/0003_ai_consents.sql` — puur additief: vier nieuwe
boolean-kolommen (`DEFAULT false`) + defaults van de twee bestaande kolommen op
`false`. Geen data, relaties of historie verwijderd. Toegepast op de dev-DB.

## Frontend

`artifacts/sparki/src/components/sparki/privacy-settings.tsx` — vier nieuwe
toggles in "Privacy & toestemming" (plat Nederlands, geen "AI"-woord):
Gezondheid & mentaal, Foto-analyse, Documentanalyse, Persoonlijke coaching.
Naast de bestaande Sparki-geheugen en Gevoelige analyse.

## Tests

- `test:ai-consent` (`src/tests/ai-consent.ts`, nieuw): standaard-uit,
  per-toestemming aan/uit, direct intrekken, cross-gebruiker-isolatie, geen
  provider-aanroep zonder toestemming (injecteerbare provider), Foto-lab via
  gateway, kill switch op mediapaden, rate limit, eerlijk gatewayfalen.
- `test:ai-gateway` (bestaand, bijgewerkt naar het nieuwe model): kill switch,
  jeugd fail-closed, redactie, dedupe, metadata-only logging, call-paden.
- Er wordt in geen enkele test een echt model aangeroepen (injecteerbaar
  transport / injecteerbare provider-functies).
