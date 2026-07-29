---
name: Sparki bewijsarchief
description: Convention for handling delivery/audit evidence files (zips, bundles, screenshots)
---

Rule (final layout per RENE's formal opdracht, 25 jul 2026): evidence files (rejected-delivery zips, review bundles, UX audit screenshots, backups, source exports) stay at their ORIGINAL paths, unchanged. Only zips that sat in `artifacts/sparki/public/` were moved to `docs/evidence/archive/public_exports/`. Inventory with path/size/SHA-256/git-status/category/public-reachable/action lives in `docs/EVIDENCE_ARCHIVE_INVENTORY.md`.

**Why:** RENE treats these files as formal evidence of (rejected) deliveries — never delete or modify them, never place them in `artifacts/sparki/public/` (they get publicly served AND baked into deploy builds). An earlier same-day instruction moved everything to one `bewijsarchief/` folder; the formal opdracht superseded it (evidence stays in place), and everything was restored byte-identically — every step SHA-256-verified before and after.

Update (28 jul 2026, deploy-limiet): grote export-zips (repo-audit + BF_00/BF_00R evidence) zijn extern veiliggesteld in de privé App Storage-bucket onder `.private/bewijsarchief-offload/` — elke kopie vóór lokale verwijdering byte-identiek SHA-256-geverifieerd (teruggelezen uit de bucket). Lokale kopieën verwijderd; inventaris (`docs/EVIDENCE_ARCHIVE_INVENTORY.md`) bijgewerkt met nieuwe locatie + verificatie. LFS-historie intact; `git lfs prune` + `git gc` bracht .git van 4.9→2.6 GiB.

Update (29 jul 2026): checkpoint-herstel bracht verwijderde export-zips én hun LFS-objecten terug (.git groeide naar 5+ GiB). Definitieve opruiming: alles byte-identiek geverifieerd tegen de bucket, `exports/` weg, grote LFS-historie-objecten eerst naar `.private/bewijsarchief-offload/lfs-history/` geüpload (LFS-oid = SHA-256, exacte verificatie) en daarna lokaal uit `.git/lfs` verwijderd; reflog expire + gc. Les: verwijderde grote bestanden komen via checkpoints terug als LFS-objecten — offload het LFS-object zelf, niet alleen het werkbestand.

**How to apply:** new evidence → keep at its delivered path, add a row to `docs/EVIDENCE_ARCHIVE_INVENTORY.md` with SHA-256; never put exports/zips in `public/`. Gotchas: `exports/BF_00_evidence.zip` ≠ `.local/exports/BF_00_evidence.zip` (same name, different content); `attached_assets/` is never touched; removing files from workspace `public/` does NOT remove them from the published deployment — a republish is required; agent cannot run `git mv` (checkpoints commit; byte-identical `mv` preserves rename detection).
