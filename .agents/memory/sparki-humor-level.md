---
name: Sparki centraal humorniveau
description: App-breed instelbaar humorniveau (Uit/Subtiel/Normaal/Uitgesproken) — architectuur en harde regels.
---

# Centraal humorniveau

**Regel:** Alle luchtige microteksten komen uit ÉÉN centrale laag; componenten bevatten nooit eigen hardcoded grappen.
- Frontend: `artifacts/sparki/src/lib/humor.ts` (contextpools, cumulatief subtiel⊂normaal⊂uitgesproken, pure `pickHumorLine`, localStorage anti-herhaling) + `useHumorLine`/`<HumorLine>`; rendert null bij "uit" of zolang prefs laden.
- Server: voice-engine `isToneAvailable(tone, tier, humorLevel)` — "uit" blokkeert dry_humor/cynical op ELK trust-tier; "uitgesproken" opent dry_humor vanaf kennismaking. Instelling in `ai_preferences.humor_level` (default normaal), via GET/PUT /api/ai/preferences.

**Why:** één instelling moet overal echt gelden; verspreide grapjes zijn niet uitschakelbaar en herhalen zich.

**How to apply:**
- Nieuwe luchtige tekst? Voeg een context/regel toe aan `humor.ts` en plaats `<HumorLine>` — nooit inline grappen.
- Verboden oppervlakken (medisch, veiligheid, privacy, fouten, betalingen, beveiliging, val, wedstrijdwaarschuwingen) importeren de laag simpelweg niet.
- Let op: `/api/voice` stijlvoorbeelden gebruiken forceTone — humorvoorbeelden moeten apart worden onderdrukt als het humorniveau ze op elk tier blokkeert (anders "lekt" humor bij uit).
- Voice-tones zijn observer/supportive/curious/dry_humor/cynical (geen "warm").
