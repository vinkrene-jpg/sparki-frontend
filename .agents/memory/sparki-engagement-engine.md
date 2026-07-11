---
name: Sparki engagement engine (healthy pull-to-return)
description: FASE 1 foundation — learns real open/click rhythm from tester_events and times an honest "er is iets nieuws" nudge; honesty + no-dark-pattern rules.
---

# Sparki engagement engine — healthy pull-to-return

The engagement engine LEARNS an athlete's own usage rhythm from their REAL
telemetry (`tester_events`) and uses it only to TIME an honest "er is iets
nieuws voor je" nudge — it never invents content, never changes a number, and
never demotes urgent/health notifications.

## Non-negotiable doctrine
- **No addictive tricks.** The nudge fires at most once per Amsterdam calendar
  day, only on a *genuinely new* insight, only when the athlete is likely
  receptive, and is always opt-out. It is a convenience, not a hook.
- **Honesty over a fabricated rhythm.** With thin data the profile says so
  (`confidence` "none"/"low") and falls back to a calm evening **default**
  window (18–21). A learned window is trusted only at "medium"/"high"
  confidence (enough distinct active days), never on a couple of opens.
- **Urgent/health is priority-isolated** — the pulse channel must never suppress
  or delay urgent/health deliveries.

## The recency trap (fixed once, keep it fixed)
`lastOpenAt` / `hoursSinceLastOpen` must be derived from **real opens**
(`screen_view`), falling back to any non-heartbeat interaction, then to all
events — NOT from the newest event of any type.

**Why:** background `heartbeat` events fire while the app sits open. If recency
counted heartbeats, a late heartbeat would falsely mark the athlete as
"recently active" and the reminder gate (`hoursSinceLastOpen >= 8`) would
*suppress a genuinely due nudge*. The receptive-HOUR learning already filtered
to opens; recency originally did not — that asymmetry was the bug.

**How to apply:** any new signal added to the engagement profile that means
"the athlete engaged" must be sourced from real opens/interactions, never from
heartbeat noise. When you touch `computeEngagement`, keep opens→interactions→
all-events as the ordered fallback for *both* recency and hour learning.

## Shape / wiring pointers
- Pure `computeEngagement(events, now)` is the SSOT; test it with the pure
  harness (no DB/network) — cover empty, low-confidence-still-default,
  learned-at-peak, opens-not-heartbeats, and heartbeat-after-open recency.
- The nudge is a reminder of kind "pulse" / notification type "something_new";
  its build gate combines the 8h recency floor, the receptive window, and a
  real whats-new item, deduped per local day (`reminder:whatsnew:<amsterdamYmd>`).
- Scheduler is prod-on by default, dev opt-in, single-flight, idempotent via
  dedupe; the frontend "Jouw ritme" readout is transparency-only with honest
  empty/default copy and a pulse opt-out toggle.
