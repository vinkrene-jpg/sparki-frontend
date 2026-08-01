import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  clerkId: text("clerk_id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  roles: text("roles").array().notNull().default(["athlete"]),
  activeRole: text("active_role").notNull().default("athlete"),
  // Founding Athlete program — a stable sequential number assigned once, the
  // first time onboarding V2 completes. Unique; NULL until earned (Postgres
  // allows many NULLs under a UNIQUE constraint). Assigned atomically.
  foundingNumber: integer("founding_number").unique(),
  // Head-tester ("Hoofdtester") flag — set when a head-tester invite is
  // accepted. Drives Sparki's running self-deprecating tester joke.
  isHeadTester: boolean("is_head_tester").notNull().default(false),
  // Sequential head-tester badge ("Head Tester #001"), assigned exactly once
  // when the first head-tester invite is accepted. Unique; NULL until earned
  // (Postgres allows many NULLs under UNIQUE). Assigned atomically (MAX+1).
  headTesterNumber: integer("head_tester_number").unique(),
  // Lightweight session telemetry, refreshed on every /api/auth/me + /sync.
  // Honest gaps: NULL until the user has actually been seen / sent the data.
  // lastPlatform is parsed from the User-Agent ("iPhone" | "iPad" | "Android" |
  // "Desktop" | NULL when unknown). appVersion is the client build version sent
  // in the X-Sparki-App-Version header.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastPlatform: text("last_platform"),
  appVersion: text("app_version"),
  // Tester lifecycle: when an admin marks a tester as "Klaar" (done testing).
  // NULL = still Actief/Uitgenodigd. Set/cleared from the tester overview.
  testerCompletedAt: timestamp("tester_completed_at", { withTimezone: true }),
  // Releasegroep voor gecontroleerde uitrol: intern | test | pilot | productie.
  // Default "productie" = de meest beperkte groep (fail-closed voor nieuwe features).
  releaseGroup: text("release_group").notNull().default("productie"),
  // Commerciële entitlementmodus. Bestaande gebruikers blijven
  // "legacy_unrestricted": hun toegang blijft exact zoals vóór de invoering
  // van entitlements (lege entitlementtabellen veranderen niets).
  // "subscription" = fail-closed: toegang alleen met commercieel recht.
  entitlementMode: text("entitlement_mode")
    .notNull()
    .default("legacy_unrestricted"),
  // Productvariant (sparki_go|sparki_basic|sparki_performance|sparki_pro).
  // NULL voor legacy-gebruikers; alleen verplicht bij mode=subscription.
  // BEWUST niet automatisch gevuld voor bestaande gebruikers.
  productVariant: text("product_variant"),
  // Nieuw commercieel stelsel (fase ≥2, Stripe-testmodus): FREE|GO|COMPLETE.
  // NULL = "nog niet in het nieuwe stelsel" — bestaand gedrag (incl.
  // legacy_unrestricted) blijft dan exact gelijk. Onbekende/corrupte waarde
  // wordt fail-closed als FREE-zonder-rechten behandeld, nooit als betaald.
  commercialTier: text("commercial_tier"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable);
export const selectUserProfileSchema = createSelectSchema(userProfilesTable);

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;

// BB-14 (SPARKI_BUILD_01 F3): nutrition_specialist is een echte server-side
// rolwaarde met een eigen rolcontext en startscherm (eerste prioriteit:
// Voeding). Toekenning loopt via de bestaande admin-roluitnodiging
// (relationship "none" + targetRole) — geen tweede toekenningspad.
export const validRoles = [
  "athlete",
  "coach",
  "parent",
  "nutrition_specialist",
] as const;
export type Role = (typeof validRoles)[number];
