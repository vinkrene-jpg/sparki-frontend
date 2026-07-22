---
name: Sparki plan-uitvoering & adaptieve voorstellen (Golf 23)
description: Execution-link layer (session↔planned workout) + deterministic adjust proposals; key honesty/race rules.
---

- Execution link: only same calendar day, own session, status planned/modified, sessionId null. Auto-link is a CONDITIONAL update (`sessionId IS NULL` + status guard) so a manual link always wins race-free.
- Verdict is deterministic (70–130% of duration/TSS margin ⇒ completed; <70% partial; >130% adjusted). No targets ⇒ completed with an honest "geen doelwaarden" reason — never a fabricated judgment.
- Overdue self-heal is lazy on the READ path (markOverdueAsMissed before /workouts reads) — no nightly job; linked past workouts are never marked missed.
- Adjustment proposals: decision (recommendation/changes/basis/confidence) computed server-side in lib/adjust-rules.ts; the LLM only words {title,message} with a Dutch deterministic fallback. Tests stub the wording and pin the deterministic numbers.
- **Why:** LLM-decided plan changes are unverifiable and can fabricate; the decision layer must be testable and honest.
- Behavioural derivation trap: "done" feedback combined with completion "gedeeltelijk"/"niet" contradicts completed-as-planned — derivation must gate on completion too or the coaching profile gets a false "structured" signal.
- History (`planned_workout_changes`) is append-only; cancel is a soft status flip (row survives), coach-owned workouts are 403 for content edits AND cancel; linking/status registration stays allowed (registration ≠ reprogramming).
