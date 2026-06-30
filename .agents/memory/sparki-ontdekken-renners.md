---
name: Ontdekken Renners reel + dwell-gated learning
description: World swipe-reel surfaced in /feed; view events must dwell-gate or fast scroll pollutes affinity.
---

The full-screen one-photo-at-a-time Sparki World reel (`world-reel.tsx`, also at
`/wereld`) is surfaced inside Ontdekken (`/feed`) as a "Renners" filter pill. The
existing stream + KnowledgeFeedSection are gated behind the non-renners branch.

**Durable rule — dwell-gate feed view events that feed preference learning.**
A view that fires the instant a slide mounts/scrolls past pollutes affinity
learning (every flash-by counts as interest). The reel records a view only after
~1.4s of genuine attention (IntersectionObserver ≥0.6, timer cleared on early
leave, fires once per post). Backend `learnAffinity`/`scoreFeedItem` are unchanged
— the fix is purely at the client view-firing edge.

**Why:** affinity is rebuilt from view/like/comment/save/share/follow weights;
ungated views drown the signal so personalization stops being targeted.

**How to apply:** any new "instant" view-fire on a swipeable/auto-advancing feed
must dwell-gate before recording, and preload the next 1-2 media for fast switching.

**Durable rule — when a single-active reel becomes a multi-card carousel, the
dwell-gate MUST move to one parent-owned active card.** The reel is now a compact
HORIZONTAL card carousel (4:5 cards, several visible at once with peeking
neighbours) instead of one full-screen photo. With per-slide IntersectionObservers
each recording its own view, multiple visible cards each fire → affinity pollution.
Fix: slides only *report* their coverage ratio up (`onVisible(index, ratio)`); the
parent keeps a ratios array, picks the argmax (≥0.6) as the single `activeIndex`,
and runs ONE dwell timer there. Only the centered card records a view.
**Why:** the original dwell guard implicitly relied on only one card ever being
≥0.6 visible (full-screen vertical); horizontal small cards break that assumption.

**Handedness is a pure interaction preference, not athlete data.** Swipe direction
is stored in localStorage (`sparki:reel-handedness`, default right) and flips the
carousel container `dir` between `ltr` (swipe right-to-left, right-handed) and
`rtl` (mirror, left-handed). Each slide is forced back to `dir="ltr"` so RTL never
mirrors the card's Dutch text/layout — only the scroll direction flips. Never store
this as profile/DB data; it's UI ergonomics.
