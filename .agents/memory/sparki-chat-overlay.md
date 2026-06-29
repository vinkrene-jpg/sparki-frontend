---
name: Sparki chat overlay & session-scoped thread
description: How the "Vraag Sparki" chat is entered and why its visible thread resets per app open while memory persists.
---

# Sparki chat (Input Center) — entry point & session scoping

The "Vraag Sparki" conversation is the Input Center (`SparkiInputCenter`,
`sparki_input_messages`). It is opened from the **SPARKI mark in the ScreenShell
header** (the blue-dot wordmark, present on every screen), which is a button that
mounts `SparkiChatOverlay`.

## Decisions worth keeping

- **Visible thread is session-scoped; memory is permanent.** The chat shows only
  turns created during the current app-open. A module-level `SESSION_START =
  Date.now()` filters `turns` by `createdAt >= SESSION_START`. All turns still
  persist in the DB (Sparki's memory) for privacy-gated analysis — they are just
  not rendered on a fresh open.
  - **Why:** user explicitly chose "begin met een schoon, leeg gesprek bij elke
    nieuwe keer dat ik de app open — oudere berichten verdwijnen uit beeld, maar
    blijven wél bewaard in Sparki's geheugen" (matches the open-choices decision
    "chat mag uit beeld verdwijnen na sluiten, maar blijft in Sparki's geheugen").
  - **How to apply:** never delete chat rows to achieve "fresh start" — hide at
    the render layer only. SPA route changes keep the module value (thread stays);
    a reload/reopen re-evaluates the module → empty thread. Clock-skew is a
    non-issue because SESSION_START predates any message sent that session.

- **Overlay must portal to body at z-[80]+.** The bottom nav is z-50; a plain
  fixed modal at z-50 collides with it (buttons hidden). Use `createPortal` +
  `z-[80]`. (Same lesson as the modal-layering note.)

- **Composer is two rows by request:** row 1 = text input + send, row 2 =
  attachment options (paperclip/camera/link). Keep this order.

- **Single source:** the chat lives ONLY in the header overlay now. Do not also
  embed `SparkiInputCenter` inside a page (it was removed from the feed page).
