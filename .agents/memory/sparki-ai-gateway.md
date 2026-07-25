---
name: Sparki central AI gateway
description: One central gateway for all model calls; gates, logging, and traps hit while wiring 16 call sites.
---
Rule: every model call goes through `aiMessage(purpose, clerkId, params)`; no call site talks to the SDK directly, and per-site `{timeout,maxRetries}` second args must be removed (gateway owns them).

**Why:** consent revocation, kill switch, redaction and metadata logging only hold if there is exactly one port; a single bypassing call site silently breaks the privacy contract.

**How to apply:**
- Purpose registry entries separate `sensitive` (requires aiSensitiveAnalysisEnabled toggle) from `minorBlocked` (hard youth block). Nutrition purposes are sensitive but NOT minor-blocked — youth safety already lives in age-tuned prompts/deterministic engines; blocking would regress deliberately youth-safe flows.
- Logs (`ai_call_logs`) are metadata-only: never prompt/answer content; errorCode ≤120 chars.
- `UPLOAD_DATA_RULE` must be appended to the system/user prompt of every purpose that reads uploaded/foreign content (documents, photos, articles, input-center attachments).
- Trap: api-server cannot resolve `import type Anthropic from "@anthropic-ai/sdk"` when the SDK is only a dep of the integrations package — add it as a direct api-server dependency (same version).
- Kill switches have no setter helper; tests upsert `kill_switches` row + `invalidateKillSwitchCache()`.
- Test mechanism for unused gates (e.g. minorBlocked with no live purpose): temporarily mutate the AI_PURPOSES entry and restore in finally.
- **Routes must map AiBlockedError to an honest 4xx, never a generic 500.** The gateway throws AiBlockedError(reason, Dutch message) on consent/minor/killswitch blocks; every route whose response IS the model output needs `if (err instanceof AiBlockedError) res.status(403).json({error: err.message, reason: err.reason})` in its catch (ai.ts brief/ask/workout-explain*/; support.ts uses 503). Routes with a deterministic fallback (workout-adjust) just log and fall back.
- **Why:** a QA user with coaching consent off turned every /feed load into a 500 — a deliberate privacy block is not a server error.
