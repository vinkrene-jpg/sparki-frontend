---
name: Sparki sociale omgeving & profielprivacy
description: Fail-closed sociale laag — neutrale weigeringen, privacy-checks op ALLE ontdekkingspaden, atomair blokkeren
---

## Rules
- `lib/profile-privacy.ts` (relation → audience check) is the ONLY truth; every surface that exposes a person must call `categoryVisible(relation, categories, "profiel")` — not just the profile page.
- **Why:** architect review caught that `searchAthletes` and `sendFriendRequest` skipped the visibility check while `getPublicProfile`/`followUser` had it — hidden profiles leaked via search and could receive requests. Discovery paths (search, contact match, friend request, follow) are as sensitive as the profile view itself.
- **How to apply:** any new endpoint that returns or acts on another user: (1) isBlockedBetween, (2) profiel-category visible, else the SAME neutral refusal as nonexistent ("Deze actie is nu niet mogelijk." / neutral 404). Never a distinct error for blocked vs hidden vs missing.
- blockUser must sever friend + follow links both directions inside ONE db.transaction, or concurrent writes can resurrect a relation post-block.
- Declined friend request: only the decliner may reopen (requester on the declined row may NOT re-send); `verzoekMogelijk` in the profile projection mirrors this.
- Test harness: `ensureAccount(clerkId, email, displayName, silentLogger)` positional args (not an object). Run via shell `node ./scripts/run-test.mjs social-privacy` (workflow limit reached).
