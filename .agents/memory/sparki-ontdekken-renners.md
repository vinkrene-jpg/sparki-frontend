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
