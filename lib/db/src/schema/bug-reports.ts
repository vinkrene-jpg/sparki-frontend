import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
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
  // Golf 14 — automatisch meegestuurde, niet-gevoelige context: scherm,
  // appversie en correlation-id (server-side afgeleid uit headers/request).
  screen: text("screen"),
  appVersion: text("app_version"),
  correlationId: text("correlation_id"),
  // Expliciete toestemming van de melder om extra (mogelijk gevoelige)
  // context mee te sturen. Zonder toestemming wordt NIETS extra's bewaard.
  contextConsent: boolean("context_consent").notNull().default(false),
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

// A follow-up thread on a report: a tester can add a missing detail or answer a
// question, and an admin can reply/ask back. `authorRole` records whether each
// message came from the reporter or from an admin (rendered as "Sparki" to the
// tester), so the thread reads as a simple chronological back-and-forth.
export const bugReportCommentAuthors = ["reporter", "admin"] as const;
export type BugReportCommentAuthor = (typeof bugReportCommentAuthors)[number];

export const bugReportCommentsTable = pgTable(
  "bug_report_comments",
  {
    id: serial("id").primaryKey(),
    bugReportId: integer("bug_report_id")
      .notNull()
      .references(() => bugReportsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    authorRole: text("author_role").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bug_report_comments_report_idx").on(t.bugReportId)],
);

export const insertBugReportCommentSchema = createInsertSchema(
  bugReportCommentsTable,
).omit({ id: true });
export const selectBugReportCommentSchema = createSelectSchema(
  bugReportCommentsTable,
);

export type BugReportComment = typeof bugReportCommentsTable.$inferSelect;
export type InsertBugReportComment = z.infer<
  typeof insertBugReportCommentSchema
>;
