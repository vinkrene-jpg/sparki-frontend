---
name: Sparki fietsscan
description: Guided bike scan (camera + quality checks), client-side bg removal, honest 360/photo view, product-image provenance.
---

- Background removal runs CLIENT-side via `@imgly/background-removal` (WASM); the vite prod build fails to resolve its internal `onnxruntime-web/webgpu` import unless `onnxruntime-web` is added as a direct sparki dependency.
- **Why:** the package dynamically imports the webgpu entry; pnpm strictness hides the transitive dep from Rollup.
- Capture order matters: save the ORIGINAL frame first, then attempt the cutout — a failed cutout must never cost a captured frame. Count failures honestly in the UI.
- `viewMode` derivation: `draai360` only with ≥8 real around-step cutouts (never simulated); `fotos` whenever ANY frames exist (originals too — architect caught that cutout-only made saved originals invisible); `geen` only with zero frames.
- Quality checks are pure functions on grayscale buffers (luminance / Laplacian variance / frame diff / edge density) in `scan-quality.ts` — testable without a browser; UI calls it "detail in beeld", not object recognition.
- Product images (equipment_assets) require provenance server-side: source enum + license mandatory, sourceUrl mandatory for non-upload sources. Only "upload" is a live source; fabrikant/distributeur/catalogus are honest manual entries — no scraping.
