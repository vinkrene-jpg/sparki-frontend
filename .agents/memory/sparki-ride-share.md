---
name: Sparki rit delen
description: Honest ride-share design — Strava manual upload (no fabricated timestamps), share-menu-only social, RN image share constraints.
---

- **Strava upload is a MANUAL activity** (`POST /api/v3/activities` with real totals), never a GPX upload: raw files/per-point timestamps are not retained, and Sparki never fabricates timestamps. No real startTime (from the linked activity import) ⇒ honest refusal.
- **Honesty ladder for upload capability:** platform-sourced ride ⇒ duplicate refusal; not connected ⇒ koppel prompt; connected without `activity:write` ⇒ reconnect prompt (existing connections keep old scopes after a scope addition — never assume new scopes apply retroactively).
- **Social platforms (Instagram/FB/WhatsApp/X) have no official personal-account publish API** — the only honest route is the device/OS share menu (Web Share API / RN Share / expo-sharing). Never build fake "publiceer" buttons.
- **RN image sharing:** `Share.share({url})` is iOS-only for files; cross-platform file share needs `expo-sharing` (but it shares the file WITHOUT text — text and image are separate share actions). Capture a real stats `<View>` via `react-native-view-shot` `captureRef` (`collapsable={false}` on the target view).
- Locked by integration test `test:share-honesty` (run via shell, not a workflow — workflow limit reached).
