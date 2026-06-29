---
name: Sparki Wedstrijd-room (race-day media montage)
description: Phase-1 single-user race-room feature — conventions and the two non-obvious traps it hit.
---

# Wedstrijd-room

Single-user feature: athlete creates a room (optionally tied to a race), uploads
media + writes text updates per race day, then generates a REAL ffmpeg montage of a
day's media+captions+music and downloads it. Real-or-honest: compile returns
`empty` (no usable visuals — returns BEFORE any ffmpeg/storage IO) / `failed` /
`ready`; never fabricated.

## dayIndex is 1-based end-to-end
Backend stores and clamps dayIndex to `Math.max(1, Math.min(room.days, raw))`, so
day 1..room.days. The frontend MUST also be 1-based (tab state, filtering with
exact `===`, dayDate offset `dayIndex - 1`, filename). A 0-based frontend collides
day 1 & 2 (both coerce to 1) and the UI item filter never matches the DB's 1-based
rows. Remount `RoomDetail` with `key={selectedId}` so day state resets per room.

## ScreenShell leaks the coach card on some sections
`ScreenShell` renders the home/training `CoachAnalysisCard` (plus FollowUpPrompt,
profile prompts) for any section in `COACH_CARD_SECTIONS` (`home/train/lab/races`).
A focused sub-page that reuses `section="Races"` therefore gets the daily coach
analysis dumped on top, pushing its own content below the fold. Fix: use a
dedicated section + the `bare` prop (e.g. `section="wedstrijd-room" bare`, matching
the geluid/tester-welcome pattern) and register a `SECTION_DISPLAY` label. `bare`
strips all the home-only widgets but keeps header + background + children + nav.

**Why:** both bugs were invisible in a quick glance (page "rendered", just wrong)
and only surfaced via screenshot + a real curl end-to-end.

See also: [Local-date UTC off-by-one trap](local-date-utc-trap.md) — the page also
hit the `toISOString().slice(0,10)` off-by-one.
