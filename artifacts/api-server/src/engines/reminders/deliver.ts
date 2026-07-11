// Reminder delivery — the core the scheduled job runs.
//
// For every athlete with reminders enabled, it builds the genuinely-due
// reminders, honours the athlete's preferences, and for each item:
//   1. creates the in-app notification row exactly once (idempotent via the
//      partial unique index on (clerkId, dedupeKey));
//   2. sends the email through the real channel and marks `sentAt` once it goes
//      out — so a re-run never double-sends, but a previous *failed* send is
//      retried (the row exists with sentAt still NULL).
//
// Honesty: when the email channel is not configured (or only "limited" — no
// verified domain), in-app reminders are still created, but no email is sent and
// the run reports it plainly. Nothing fake is ever delivered.

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  notificationsTable,
  pushSubscriptionsTable,
  userProfilesTable,
  type ReminderKind,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import { emailChannelStatus, sendEmail } from "../../lib/email";
import { pushChannelStatus, sendPush } from "../../lib/push";
import { buildDueReminders, type ReminderItem } from "./build";
import { getPrefs, allows } from "./preferences";

export type DeliverOptions = {
  now?: Date;
  // Cap how many athletes are processed in a single run (safety valve).
  maxAthletes?: number;
  // When true, build + create in-app rows but never send email (dry run).
  skipEmail?: boolean;
};

export type DeliverSummary = {
  emailState: string;
  pushState: string;
  athletesConsidered: number;
  athletesWithReminders: number;
  itemsDue: number;
  inAppCreated: number;
  emailsSent: number;
  emailsFailed: number;
  emailsSkipped: number;
  pushesSent: number;
  pushesFailed: number;
  subscriptionsPruned: number;
};

// Recipients = athletes (roles include "athlete") who have an email on file.
async function listAthletes(limit: number) {
  const rows = await db
    .select({
      clerkId: userProfilesTable.clerkId,
      email: userProfilesTable.email,
      displayName: userProfilesTable.displayName,
      roles: userProfilesTable.roles,
    })
    .from(userProfilesTable);
  return rows
    .filter((r) => (r.roles ?? []).includes("athlete"))
    .slice(0, limit);
}

// Greeting line for an email — first name when we have a display name.
function greeting(displayName: string | null): string {
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? `Hoi ${first},` : "Hoi,";
}

function emailText(item: ReminderItem, displayName: string | null): string {
  return [
    greeting(displayName),
    "",
    item.body,
    "",
    "Open Sparki om verder te gaan.",
    "",
    "— Sparki",
    "",
    "Je kunt herinneringen aanpassen of uitzetten in Sparki onder Profiel → Instellingen → Herinneringen.",
  ].join("\n");
}

export async function deliverReminders(
  opts: DeliverOptions = {},
): Promise<DeliverSummary> {
  const now = opts.now ?? new Date();
  const maxAthletes = opts.maxAthletes ?? 5000;

  const status = await emailChannelStatus();
  const canEmail = status.state === "ready" && !opts.skipEmail;

  const pushStatus = pushChannelStatus();
  const canPush = pushStatus.state === "ready";

  const summary: DeliverSummary = {
    emailState: status.state,
    pushState: pushStatus.state,
    athletesConsidered: 0,
    athletesWithReminders: 0,
    itemsDue: 0,
    inAppCreated: 0,
    emailsSent: 0,
    emailsFailed: 0,
    emailsSkipped: 0,
    pushesSent: 0,
    pushesFailed: 0,
    subscriptionsPruned: 0,
  };

  const athletes = await listAthletes(maxAthletes);
  summary.athletesConsidered = athletes.length;

  for (const athlete of athletes) {
    const prefs = await getPrefs(athlete.clerkId);
    if (!prefs.enabled) continue;

    let due: ReminderItem[];
    try {
      due = await buildDueReminders(athlete.clerkId, now);
    } catch (err) {
      logger.warn(
        { err, clerkId: athlete.clerkId },
        "reminders: build failed for athlete",
      );
      continue;
    }
    const allowed = due.filter((it) => allows(prefs, it.kind as ReminderKind));
    if (allowed.length === 0) continue;
    summary.athletesWithReminders++;
    summary.itemsDue += allowed.length;

    // The athlete's active push subscriptions (one per device/browser). Loaded
    // once per athlete; only consulted when the push channel is configured.
    let subs: Array<{
      id: number;
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = [];
    if (canPush) {
      subs = await db
        .select({
          id: pushSubscriptionsTable.id,
          endpoint: pushSubscriptionsTable.endpoint,
          p256dh: pushSubscriptionsTable.p256dh,
          auth: pushSubscriptionsTable.auth,
        })
        .from(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.clerkId, athlete.clerkId));
    }

    for (const item of allowed) {
      // 1. Create the in-app row exactly once (idempotent on dedupeKey). The
      //    RETURNING set is non-empty ONLY when this row was freshly inserted —
      //    that is our signal to push (and email) exactly once, never on re-runs.
      let inserted: Array<{ id: number }>;
      try {
        inserted = await db
          .insert(notificationsTable)
          .values({
            clerkId: athlete.clerkId,
            athleteClerkId: athlete.clerkId,
            type: item.type,
            title: item.title,
            body: item.body,
            actionUrl: item.actionUrl,
            dedupeKey: item.dedupeKey,
          })
          .onConflictDoNothing({
            target: [notificationsTable.clerkId, notificationsTable.dedupeKey],
            // The unique index is partial; drizzle's onConflictDoNothing emits
            // the arbiter predicate from `where` (only onConflictDoUpdate uses
            // `targetWhere`). Must match the index's WHERE to be honoured.
            where: sql`${notificationsTable.dedupeKey} IS NOT NULL`,
          })
          .returning({ id: notificationsTable.id });
      } catch (err) {
        logger.warn(
          { err, dedupeKey: item.dedupeKey },
          "reminders: in-app insert failed",
        );
        continue;
      }
      const freshlyCreated = inserted.length > 0;

      // 2. Push to every device — but only for a freshly-created notification, so
      //    a re-run never re-pushes. Dead endpoints (404/410) are pruned. Push is
      //    independent of email: it can land even when email is unconfigured.
      if (freshlyCreated && canPush && subs.length > 0) {
        for (const sub of subs) {
          const r = await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            {
              title: item.title,
              body: item.body,
              url: item.actionUrl,
              tag: item.dedupeKey,
            },
          );
          if (r.ok) {
            summary.pushesSent++;
          } else {
            summary.pushesFailed++;
            if (r.prune) {
              await db
                .delete(pushSubscriptionsTable)
                .where(eq(pushSubscriptionsTable.id, sub.id));
              summary.subscriptionsPruned++;
            }
          }
        }
      }

      // Load the (now guaranteed) row to read its delivery state.
      const [row] = await db
        .select({
          id: notificationsTable.id,
          sentAt: notificationsTable.sentAt,
        })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.clerkId, athlete.clerkId),
            eq(notificationsTable.dedupeKey, item.dedupeKey),
          ),
        )
        .limit(1);
      if (!row) continue;
      summary.inAppCreated += row.sentAt ? 0 : 1; // count freshly-pending only

      if (row.sentAt) continue; // already delivered by email — never resend

      if (!canEmail || !athlete.email) {
        summary.emailsSkipped++;
        continue;
      }

      const result = await sendEmail({
        to: athlete.email,
        subject: item.emailSubject,
        text: emailText(item, athlete.displayName),
      });
      if (result.ok) {
        await db
          .update(notificationsTable)
          .set({ sentAt: new Date() })
          .where(eq(notificationsTable.id, row.id));
        summary.emailsSent++;
      } else {
        summary.emailsFailed++;
        logger.warn(
          { error: result.error, dedupeKey: item.dedupeKey },
          "reminders: email send failed (will retry next run)",
        );
      }
    }
  }

  return summary;
}

// Small helper for tests / admin: how many reminder rows are still awaiting
// email delivery (created in-app but not yet sent).
export async function pendingEmailCount(): Promise<number> {
  const rows = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        isNull(notificationsTable.sentAt),
        inArray(notificationsTable.type, [
          "checkin_reminder",
          "followup_question",
          "training_reminder",
          "race_reminder",
          "profile_nudge",
          "something_new",
        ]),
      ),
    );
  return rows.length;
}
