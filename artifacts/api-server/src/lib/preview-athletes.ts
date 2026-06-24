// Canonical clerkIds for the three dev-preview athletes seeded by
// `scripts/seed-preview-athletes.ts`. Kept in a tiny, dependency-free module so
// both the seed script and the dev-only `/api/dev/preview-athletes` route can
// reference the exact same set without importing (and thereby executing) the
// self-running seed script. This is dev tooling only — never used in production
// auth/data paths.
export const PREVIEW_CLERK_IDS = [
  "seed_preview_dylan",
  "seed_preview_recreatief",
  "seed_preview_ervaren",
] as const;
