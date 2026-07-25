---
name: Sparki bewijsarchief
description: Convention for handling delivery/audit evidence files (zips, bundles, screenshots)
---

Rule: all delivery/audit evidence (rejected-delivery zips, review bundles, UX audit screenshots, correction packages, source exports, git-bundle backups) lives in `bewijsarchief/` at repo root, with `bewijsarchief/INVENTARIS.md` listing original path, purpose, size and SHA-256 per file.

**Why:** RENE treats these files as formal evidence of (rejected) deliveries. On 25 jul 2026 he explicitly ordered: never delete or modify evidence files; inventory-with-SHA-256 first; move to ONE non-public archive folder; public export-zips (in `artifacts/sparki/public/`) may only be removed after a byte-identical private copy is hash-verified.

**How to apply:** when new evidence bundles appear (or old ones are found in public/), add them to `bewijsarchief/` + INVENTARIS.md with SHA-256, never overwrite existing entries, and never place evidence in `artifacts/sparki/public/`. Note: the two `.local/exports/BF_00*` zips stayed in `.local/exports/` (already non-public, outside git, 167 MB); `exports/BF_00_evidence.zip` and `.local/exports/BF_00_evidence.zip` have DIFFERENT content despite the same name. R1-YAML (`docs/UX_00B_FIGMA_CODE_MAPPING.yaml`) stays in docs/ as active werkdocument with a byte-identical archive copy.
