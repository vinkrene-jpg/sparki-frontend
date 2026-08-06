---
name: Sparki hand-rolled modal layering
description: Why custom fixed-position dialogs must portal to body and out-rank the bottom nav.
---

# Hand-rolled modal layering (portal + z-index)

Custom (non-Radix) `fixed inset-0` dialogs rendered *inside* a Radix Sheet/Dialog
(which itself lives in a portal and has its own stacking/animation context) must:

1. Render via `createPortal(..., document.body)` so they escape the Sheet's
   stacking/transform context and are truly viewport-relative.
2. Use a z-index **above the bottom nav and sheets**. The bottom nav and the
   shadcn Sheet/Dialog/Drawer overlays are all `z-50`; a custom modal at `z-50`
   collides and (on mobile, with `items-end`) its action buttons land behind the
   bottom nav — visible dialog, unreachable button. Use `z-[70]`+.
3. Add `overflow-y-auto` + `max-h-[calc(100dvh-2rem)]` so tall content (e.g. many
   data-type chips) still lets the user scroll to the confirm button on short
   phones.

**Why:** The connectors `ConsentDialog` (Strava "Ga naar Strava") was a plain
`fixed z-50` div nested in the `/you` Instellingen Sheet. On mobile its confirm
button sat behind the `z-50` bottom nav, so tapping did nothing — the OAuth start
(`GET /api/connectors/strava/authorize`) never fired. Diagnosed purely from prod
logs showing the authorize request was absent. Fix = portal to body + `z-[70]` +
scroll safety.

**How to apply:** Any time you build a custom overlay/modal by hand (not the
shadcn primitives), assume it may be mounted inside a Sheet and ship it portaled
to `document.body` with z-index above 50 from the start.

## Zusterlagen met gelijke z-index (routescherm)
Op het nieuwe routescherm zijn topbalk en filterbolletjes-rij zusters met z-[500]; de latere DOM-zuster wint, dus een dropdown ín de topbalk lag ónder de bolletjes en tikken op menukeuzes kwamen op de chips terecht (geen console-fout, "er gebeurt niets").
**Why:** gelijke z-index tussen zusters = DOM-volgorde beslist; een genest menu erft het stacking-context-plafond van zijn ouder.
**How to apply:** geef de laag die een dropdown/menu bevat een hogere z dan latere zusterlagen (topbalk nu z-[520]); bij "klik komt niet aan" eerst Playwright-interceptielog lezen — die noemt de afvangende laag letterlijk.
