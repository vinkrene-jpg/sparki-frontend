import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { userProfilesTable } from "./users";

// ── Golf 27 — AI-helpdesk & supportautomatisering ───────────────────────────
// Uitbreiding op het bestaande supportproces (bug_reports blijft bestaan voor
// tester-feedback). Deze tabellen dragen de helpdesk-flow: vraag → context →
// betrouwbaar antwoord → ticket → menselijke opvolging → kennisverbetering.

export const supportCategories = [
  "technisch",
  "gebruik",
  "account_privacy",
  "koppelingen_sync",
  "training_analyse",
  "mechanieker",
  "club_coach",
  "abonnement_betaling",
] as const;
export type SupportCategory = (typeof supportCategories)[number];

// Antwoordstatussen van de helpdesk (opdracht 5).
export const helpdeskAnswerStatuses = [
  "direct", // direct betrouwbaar antwoord
  "beperkt", // antwoord met beperkte zekerheid
  "meer_info", // extra gebruikersinformatie nodig
  "mens", // menselijke beoordeling vereist
  "storing_bekend", // bekende storing
  "opgelost", // probleem opgelost (na feedback)
] as const;
export type HelpdeskAnswerStatus = (typeof helpdeskAnswerStatuses)[number];

export const helpdeskFeedbackValues = [
  "opgelost",
  "deels",
  "niet_geholpen",
  "onjuist",
] as const;
export type HelpdeskFeedback = (typeof helpdeskFeedbackValues)[number];

// Eén helpdesk-beurt: vraag + deterministische context + antwoord + status.
export const helpdeskTurnsTable = pgTable(
  "helpdesk_turns",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role"), // rol op moment van vragen
    category: text("category").notNull(), // supportCategories
    question: text("question").notNull(),
    // Context (niet-gevoelig, server-side bepaald):
    screen: text("screen"),
    appVersion: text("app_version"),
    platform: text("platform"),
    correlationId: text("correlation_id"),
    errorGroupId: integer("error_group_id"),
    knownIssueId: integer("known_issue_id"),
    // Antwoord:
    answerStatus: text("answer_status").notNull(), // helpdeskAnswerStatuses
    answer: text("answer"), // null = geen veilig antwoord mogelijk
    sourceRefs: text("source_refs"), // JSON-array van gebruikte bronnen (artikel-ids e.d.)
    ticketId: integer("ticket_id"),
    feedback: text("feedback"), // helpdeskFeedbackValues
    feedbackAt: timestamp("feedback_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("helpdesk_turns_user_idx").on(t.clerkId, t.createdAt)],
);

export const supportTicketStatuses = [
  "open",
  "in_behandeling",
  "wacht_op_gebruiker",
  "opgelost",
  "gesloten",
  "heropend",
  "samengevoegd",
] as const;
export type SupportTicketStatus = (typeof supportTicketStatuses)[number];

export const supportPriorities = ["laag", "normaal", "hoog", "urgent"] as const;
export type SupportPriority = (typeof supportPriorities)[number];

// Redenen waarom menselijke verzending verplicht is (opdracht 10).
export const humanRequiredReasons = [
  "privacy",
  "betaling",
  "accountverwijdering",
  "minderjarig",
  "gezondheid_veiligheid",
  "klacht_juridisch",
] as const;
export type HumanRequiredReason = (typeof humanRequiredReasons)[number];

export const supportTicketsTable = pgTable(
  "support_tickets",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role"),
    category: text("category").notNull(),
    priority: text("priority").notNull().default("normaal"),
    status: text("status").notNull().default("open"),
    assignee: text("assignee"), // clerkId van verantwoordelijke beheerder
    summary: text("summary").notNull(),
    screen: text("screen"),
    appVersion: text("app_version"),
    correlationId: text("correlation_id"),
    errorGroupId: integer("error_group_id"),
    knownIssueId: integer("known_issue_id"),
    // Bijlage alleen met expliciete toestemming van de gebruiker.
    attachmentUrl: text("attachment_url"),
    attachmentConsent: boolean("attachment_consent").notNull().default(false),
    // Waarom dit ticket menselijke afhandeling vereist (null = regulier).
    humanRequiredReason: text("human_required_reason"),
    source: text("source").notNull().default("helpdesk"), // helpdesk | feedback | handmatig
    mergedIntoId: integer("merged_into_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("support_tickets_user_idx").on(t.clerkId, t.createdAt),
    index("support_tickets_status_idx").on(t.status, t.priority),
    index("support_tickets_error_group_idx").on(t.errorGroupId),
  ],
);

export const ticketAuthorRoles = ["gebruiker", "beheerder", "systeem"] as const;
export type TicketAuthorRole = (typeof ticketAuthorRoles)[number];

export const supportTicketMessagesTable = pgTable(
  "support_ticket_messages",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => supportTicketsTable.id, { onDelete: "cascade" }),
    authorClerkId: text("author_clerk_id"),
    authorRole: text("author_role").notNull(), // ticketAuthorRoles
    body: text("body").notNull(),
    // Interne notitie: alleen zichtbaar voor beheerders.
    internal: boolean("internal").notNull().default(false),
    // AI-conceptantwoord: nooit direct zichtbaar voor de gebruiker; een
    // beheerder bewerkt en verzendt (sentAt gezet) of verwerpt het.
    isDraft: boolean("is_draft").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("support_ticket_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

// Bekende storingen (opdracht 11) — gekoppeld aan foutgroepen/releaseversies.
export const supportKnownIssuesTable = pgTable(
  "support_known_issues",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category"),
    releaseVersion: text("release_version"),
    errorFingerprint: text("error_fingerprint"),
    status: text("status").notNull().default("actief"), // actief | opgelost
    createdBy: text("created_by").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("support_known_issues_status_idx").on(t.status)],
);

// Beheerde support-kennisbank (opdracht 12) — apart van knowledge_items
// (literatuur). Publicatie vereist menselijke controle; iedere publicatie
// verhoogt het versienummer.
export const supportArticleStatuses = ["concept", "gepubliceerd", "gearchiveerd"] as const;
export type SupportArticleStatus = (typeof supportArticleStatuses)[number];

export const supportArticlesTable = pgTable(
  "support_articles",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: text("category").notNull(),
    keywords: text("keywords"), // spatie/komma-gescheiden zoektermen
    // Rolbeperking: null = alle rollen; anders JSON-array van rollen die dit
    // artikel mogen zien (least privilege in de retrieval).
    audienceRoles: text("audience_roles"),
    status: text("status").notNull().default("concept"),
    version: integer("version").notNull().default(0), // 0 = nooit gepubliceerd
    sourceTicketId: integer("source_ticket_id"),
    createdBy: text("created_by").notNull(),
    publishedBy: text("published_by"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("support_articles_slug_uq").on(t.slug),
    index("support_articles_status_idx").on(t.status, t.category),
  ],
);

export const insertHelpdeskTurnSchema = createInsertSchema(helpdeskTurnsTable).omit({ id: true });
export const selectHelpdeskTurnSchema = createSelectSchema(helpdeskTurnsTable);
export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true });
export const selectSupportTicketSchema = createSelectSchema(supportTicketsTable);
export const selectSupportArticleSchema = createSelectSchema(supportArticlesTable);

export type HelpdeskTurn = typeof helpdeskTurnsTable.$inferSelect;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type SupportTicketMessage = typeof supportTicketMessagesTable.$inferSelect;
export type SupportKnownIssue = typeof supportKnownIssuesTable.$inferSelect;
export type SupportArticle = typeof supportArticlesTable.$inferSelect;
