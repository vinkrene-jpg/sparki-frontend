# Sparki — inventaris externe modelaanroepen (OPDRACHT 0B)

Peildatum: 23 juli 2026. Alle aanroepen naar externe modellen (Anthropic-tekst,
Gemini-beeld/video) lopen via de centrale gateway in
`artifacts/api-server/src/lib/ai/gateway.ts` (`aiMessage` voor tekst,
`aiMediaCall` voor beeld/video).

## Aanroepen via de gateway (aiMessage)

| Doel (purpose) | Toestemmingssoort | Gevoelig | Call sites |
| --- | --- | --- | --- |
| `brief` | `ai_coaching` | nee | dagupdate/Home |
| `ask` | `ai_coaching` | nee | Vraag Sparki chat |
| `helpdesk` | `explicit_action` | nee | supportautomatisering |
| `workout_explain` / `workout_explain_extended` | `ai_coaching` | nee | trainingsuitleg |
| `workout_adjust` | `ai_coaching` | nee | adaptieve voorstellen |
| `observation_extract` | `ai_memory` | nee | geheugen/observaties |
| `plan_proposals` | `ai_coaching` | nee | planvoorstellen |
| `material_photo` | `ai_vision` | nee | materiaalfoto-analyse |
| `nutrition_photo` | `ai_vision` | ja (gezondheid) | voedingsfoto |
| `nutrition_text` | `ai_health` | ja (gezondheid) | maaltijdtekst |
| `document_analysis` | `ai_document` | nee | wedstrijdgids/document |
| `knowledge_scan` | `system` | nee | kennisbank-ingestie (geen atleetdata) |
| `ride_story` | `explicit_action` | nee | rit-verhaal (door gebruiker gestart) |
| `route_rationale` | `ai_coaching` | nee | route-uitleg |
| `input_center` | `ai_coaching` | nee | centrale composer |
| `health_probe` | `system` | nee | admin-verbindingscontrole |

Bestanden die `aiMessage` aanroepen (16): o.a. `lib/ai-memory.ts`,
`lib/material/analyze.ts`, `lib/document-analysis`, `engines/knowledge-scan`,
`engines/context-memory`, routes voor brief/ask/workout/plan/route/input-center,
helpdesk, ride-story en health-check.

## Directe aanroepen buiten de gateway — gevonden en verholpen

| # | Plek | Aanroep | Status |
| --- | --- | --- | --- |
| 1 | `lib/photo-style/index.ts` (Foto-lab) | `editImage` (Gemini) | ✅ via `aiMediaCall("photo_style", clerkId, …)` — toestemming `ai_vision` |
| 2 | `engines/world-media/index.ts` `resolveMedia` | `generateImage` (Gemini) | ✅ via `aiMediaCall("world_media_image", null, …)` — `system` (fictieve scènes, geen atleetdata) |
| 3 | `engines/world-media/index.ts` `resolveMedia` | `generateVideo` (Veo) | ✅ via `aiMediaCall("world_media_video", null, …)` |
| 4 | `engines/world-media/index.ts` post-generator | `editImage` (avatar-consistentie) | ✅ via `aiMediaCall("world_media_image", null, …)` |

Totaal: **4 directe aanroepen gevonden, 4 verholpen.** `scripts/backfill-world-highlights.ts`
gaat via de world-media-engine en lift automatisch mee.

## Poorten die de gateway afdwingt (tekst én media)

1. Kill switch `ai_processing` (direct, gecachet met invalidatie).
2. Toestemming per doel — per aanroep uit de database gelezen (intrekken werkt
   direct), fail-closed: geen rij of toggle uit = blokkade.
3. Jeugdbegrenzing (`minorBlocked`, onbekende leeftijd = minderjarig).
4. Rate limit: 30 aanroepen per 5 minuten per gebruiker per doel.
5. Dataminimalisatie: vangnet-redactie van sleutels/e-mail/tokens (tekstpad).
6. Timeout + retry-begrenzing (max 1).
7. Metadata-only logging in `ai_call_logs` — nooit prompt- of antwoordinhoud.
8. Eerlijk falen: `AiBlockedError` (bewust niet uitgevoerd) of
   `AiUnavailableError` (provider faalde) — nooit een verzonnen resultaat.
