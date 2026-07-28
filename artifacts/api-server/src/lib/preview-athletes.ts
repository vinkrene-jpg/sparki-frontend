// Canonical registry of the dev-preview gebruikers (atleten + persona's),
// seeded by `scripts/seed-preview-athletes.ts`. Kept in a tiny,
// dependency-free module so both the seed script and the dev-only
// `/api/dev/preview-athletes` route reference the exact same set without
// importing (and thereby executing) the self-running seed script. This is dev
// tooling only — never used in production auth/data paths.
//
// Uitbreidbaar: nieuwe rollen/pakketten (ploegleider, diëtist, trainer, …)
// krijgen hier een regel + een spec in de seed zodra de rol echt bestaat in
// het systeem. We faken geen rollen die de app nog niet kent.

export type PreviewPersonaGroup = "Atleten" | "Abonnement" | "Rol & leeftijd";

export type PreviewPersona = {
  clerkId: string;
  group: PreviewPersonaGroup;
};

export const PREVIEW_PERSONAS: readonly PreviewPersona[] = [
  // Drie atleten met verschillend dataprofiel (bestonden al).
  { clerkId: "seed_preview_dylan", group: "Atleten" },
  { clerkId: "seed_preview_recreatief", group: "Atleten" },
  { clerkId: "seed_preview_ervaren", group: "Atleten" },
  // Abonnementsvarianten (entitlement-laag; grants zijn bewust nog leeg tot
  // sales-start, dus verschillen worden pas zichtbaar zodra die gevuld worden).
  { clerkId: "seed_persona_gratis", group: "Abonnement" },
  { clerkId: "seed_persona_go", group: "Abonnement" },
  { clerkId: "seed_persona_basic", group: "Abonnement" },
  { clerkId: "seed_persona_performance", group: "Abonnement" },
  { clerkId: "seed_persona_pro", group: "Abonnement" },
  // Rollen & leeftijden die het systeem vandaag echt kent.
  { clerkId: "seed_persona_jeugd14", group: "Rol & leeftijd" },
  { clerkId: "seed_persona_jeugd17", group: "Rol & leeftijd" },
  { clerkId: "seed_persona_renster", group: "Rol & leeftijd" },
  { clerkId: "seed_persona_coach", group: "Rol & leeftijd" },
  { clerkId: "seed_persona_ouder", group: "Rol & leeftijd" },
] as const;

export const PREVIEW_CLERK_IDS = PREVIEW_PERSONAS.map((p) => p.clerkId);
