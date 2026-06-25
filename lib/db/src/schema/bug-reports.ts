import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Tester bug reports. Page URL + role are auto-captured; screenshot is an
// optional uploaded image URL (v1 — no automated capture required).
export const bugReportStatuses = [
  "new",
  "triaged",
  "fixed",
  "rejected",
] as const;
export type BugReportStatus = (typeof bugReportStatuses)[number];

// What kind of feedback a report is: a bug, an idea/suggestion, or something
// else. Defaults to "bug" for backward compatibility with older rows.
export const bugReportKinds = ["bug", "idea", "other"] as const;
export type BugReportKind = (typeof bugReportKinds)[number];

export const bugReportsTable = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  userRole: text("user_role"),
  kind: text("kind").notNull().default("bug"),
  pageUrl: text("page_url"),
  description: text("description").notNull(),
  screenshotUrl: text("screenshot_url"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertBugReportSchema = createInsertSchema(bugReportsTable).omit({
  id: true,
});
export const selectBugReportSchema = createSelectSchema(bugReportsTable);

export type BugReport = typeof bugReportsTable.$inferSelect;
export type InsertBugReport = z.infer<typeof insertBugReportSchema>;
