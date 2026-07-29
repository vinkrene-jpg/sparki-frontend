import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

// ── Commerciële entitlements — GESCHEIDEN van operationele feature-flags ─────
// Feature-flags (feature_flags/user_flag_overrides) regelen uitsluitend
// operationele beschikbaarheid (rollout, testgroepen, kill-switches).
// Entitlements regelen commerciële gebruikersrechten (variant, add-ons,
// proefrechten, route-/contentaankopen, tijdelijke pakketten).
// Uiteindelijke toegang = commercieel recht AND rolrecht AND operationele
// flag AND geen actieve kill-switch — zie resolveFeatureAccess (api-server).

export const ENTITLEMENT_MODES = ["legacy_unrestricted", "subscription"] as const;
export type EntitlementMode = (typeof ENTITLEMENT_MODES)[number];

export const PRODUCT_VARIANTS = [
  "sparki_go",
  "sparki_basic",
  "sparki_performance",
  "sparki_pro",
] as const;
export type ProductVariant = (typeof PRODUCT_VARIANTS)[number];

export const ENTITLEMENT_TYPES = [
  "base_variant",
  "permanent_addon",
  "temporary_addon",
  "trial",
  "route_content",
  "temporary_package",
] as const;
export type EntitlementType = (typeof ENTITLEMENT_TYPES)[number];

// "expired" wordt afgeleid uit ends_at (nooit als status geschreven);
// onbekende statuswaarden gelden fail-closed als niet-actief.
export const ENTITLEMENT_STATUSES = ["active", "revoked"] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

// Persoonlijke commerciële rechten. Eén rij per toegekend recht, met
// auditbare herkomst (source + createdBy). Tijdelijke rechten hebben ends_at.
export const userEntitlementsTable = pgTable(
  "user_entitlements",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Feature-key (voor addons/trials/pakketten) of content-id
    // (bijv. "route:123" voor route_content). Nooit vrij verzonnen.
    entitlementKey: text("entitlement_key").notNull(),
    entitlementType: text("entitlement_type").notNull(),
    status: text("status").notNull().default("active"),
    // Auditbare herkomst: "admin" | "test" | later "payment" e.d.
    source: text("source").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Actor die het recht toekende (admin-clerkId of systeemreferentie).
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("user_entitlements_clerk_idx").on(t.clerkId)],
);

export type UserEntitlement = typeof userEntitlementsTable.$inferSelect;
export type InsertUserEntitlement = typeof userEntitlementsTable.$inferInsert;

// Koppeling productvariant → feature. Sinds taak 385 gevuld door de
// idempotente boot-seed (api-server ensureGoVariantGrantSeed): sparki_go
// krijgt de vier Go-onderdelen (trainingsplan-engine, race-intelligentie,
// coach-observaties/briefing, Performance Lab); sparki_basic blijft bewust
// leeg. Ontbrekende rij = fail-closed geen recht.
export const variantFeatureGrantsTable = pgTable(
  "variant_feature_grants",
  {
    productVariant: text("product_variant").notNull(),
    featureKey: text("feature_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.productVariant, t.featureKey] })],
);

export type VariantFeatureGrant = typeof variantFeatureGrantsTable.$inferSelect;
