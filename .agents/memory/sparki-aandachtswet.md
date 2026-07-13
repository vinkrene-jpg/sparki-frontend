---
name: Sparki aandachtswet (Vandaag attention law)
description: Fase 2 priority law that makes the Vandaag state surface show exactly one leading Momentblok with gated ride-along content.
---

# De aandachtswet — Vandaag single-leader law

Pure engine `artifacts/sparki/src/lib/aandachtswet.ts` decides the ONE leading
Momentblok on the Vandaag state surface and what may ride along beneath it.
Source of truth: `docs/product/NIEUWE_KERNERVARING.md` §5.1/§5.2.

- Priority chain (first match wins, higher never overridden):
  health > racedag > na-rit > rit-binnen > voorstel > voor-training > herstel > balans.
- Ride-along gates are per-moment and mutually exclusive:
  `weatherAllowed` = voor-training/racedag only; `leskaartAllowed` = herstel/balans only.
- Nudge budget: `pickNudge` returns at most ONE source, fixed rank
  connector>material>engagement>reminder. Health is NOT a nudge — it is prio 1
  in the Momentblok and never competes for the budget.

**Why the "voorstel" rung is real but effectively never leads:** the outstanding
schema-adjustment proposal is exposed ONLY as `RideMoment.story.consequence.status
=== "voorstel"`. The consequence lives inside `story`, which only exists when a
ride `phase` (na-rit/verwerken) is set — so na-rit (prio 3) always co-occurs and
wins over voorstel (prio 5). There is no standalone persisted proposal source.
Wire `hasProposal` to that REAL signal anyway (never hardcode false, never
fabricate a standalone block) so the engine input stays truthful; the proposal is
surfaced inside the na-rit block's consequence.

**How to apply / gotchas:**
- Any ride-along (weather, leskaart, MaterialCoach nudge) MUST be gated at the
  StateDayHome render, not just by importing the helper. Rendering
  `<LeskaartVandaag/>` or `<MaterialCoach n=""/>` (nudge on) unconditionally
  breaks §5.2 — pass `hideNudge` to MaterialCoach and wrap LeskaartVandaag in
  `leskaartAllowed(leadMoment)`.
- Check-in must move OUT of StateCard on this surface via `hideCheckIn` and live
  as a non-blocking `CheckInChip` below the leader (never a blocking top modal).
- StateCard still renders below the leader when a ride/health block leads, so the
  toestand is always reachable — just not as the leader.
- Everything is behind the existing `rit_verhaal` tester flag (via useRideMoment).
