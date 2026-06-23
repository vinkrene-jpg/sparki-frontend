---
name: Sparki Circle unified feed
description: How the /samen Circle experience aggregates memory follow-ups, friend activity, races, club identity and news into one stream.
---

# Sparki Circle

The /samen page is the single "Circle" home: relational memory follow-ups, friend
activity, own races, club/team identity, joint-training proposals, and sport news.

- **Backend aggregator**: `getCircleFeed(clerkId)` (engines/social) merges friend
  activity (`getFriendFeed`), own upcoming races (`my_race`), and due memory
  follow-ups (`getDueFollowUps` → `follow_up`). Follow-ups are pinned first, the
  rest recent-first, capped at 40. Served at `GET /api/social/circle-feed`,
  auth-scoped; friend privacy stays fail-closed via `getFriendFeed`.
- **Frontend merges news client-side**: `CircleFeed` in `samen.tsx` combines
  `useCircleFeed()` + `useFeedNews(6)` into one sorted stream. Follow-up cards
  answer inline (`useAnswerFollowUp`/`useDismissFollowUp`) and invalidate
  circle-feed.

## Follow-up double-ask trap
The global login `FollowUpPrompt` modal lives in `ScreenShell` and pops on EVERY
page load with no persistence. The Circle feed surfaces the same due follow-ups as
calm cards, so the modal is suppressed on the Circle route only via
`section.toLowerCase() !== "samen"`.
**Why:** otherwise the user is asked the same question twice (interrupt modal +
feed card). **How to apply:** gate on the ScreenShell `section` prop, NOT `scene`
— samen's `scene` maps to `"feed"` (SECTION_SCENE), so gating on scene silently
never matches.

## Plain-Dutch naming
"Circle-feed" is English jargon and is banned in user-facing copy. The section
renders as "Jouw overzicht"; the API error is "Kon je overzicht niet laden." The
internal route/key name "circle-feed" stays English (code identifier, fine).

## Honest-failure requirement
`CircleFeed` must read `isError` from both `useCircleFeed` and `useFeedNews` and
show explicit failure copy — never collapse a fetch error into the empty-state
("Nog niets te zien"). Partial (news-only) failure shows an inline sub-note.
