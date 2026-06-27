import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Web Push subscriptions. A subscription is a browser/device endpoint the push
// service issued when the athlete granted notification permission. The reminder
// delivery job sends a push to every active subscription of a recipient so a
// nudge reaches the phone lock screen (mirrored on a paired watch).
//
// Honesty: a subscription's mere existence is the athlete's "push aan" signal —
// removing it (unsubscribe, or a dead 404/410 endpoint pruned by the sender) is
// "push uit". Nothing is sent when there is no subscription.

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // The push service endpoint URL — globally unique per subscription.
    endpoint: text("endpoint").notNull(),
    // Encryption keys the push service handed the browser (base64url).
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    // Best-effort device hint for the athlete's own "waar staat dit aan" view.
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("push_sub_clerk_idx").on(t.clerkId),
    uniqueIndex("push_sub_endpoint_idx").on(t.endpoint),
  ],
);

export const insertPushSubscriptionSchema = createInsertSchema(
  pushSubscriptionsTable,
).omit({ id: true });
export const selectPushSubscriptionSchema = createSelectSchema(
  pushSubscriptionsTable,
);

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type InsertPushSubscription = z.infer<
  typeof insertPushSubscriptionSchema
>;
