import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  notificationsTable,
  type NotificationType,
  type NotificationPriority,
} from "@workspace/db";

// Small reusable notification service. In-app only for now (no push/email).
// Recipient = clerkId; athleteClerkId is who the notification is *about*.

export type CreateNotificationInput = {
  clerkId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  priority?: NotificationPriority;
  athleteClerkId?: string | null;
  actionUrl?: string | null;
  // When set, skip creating a duplicate if an unread notification with the same
  // (clerkId, type, dedupeBody) already exists. Keeps the center from flooding.
  dedupeWithin?: { type: NotificationType; matchBody: string };
};

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    if (input.dedupeWithin) {
      const [existing] = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.clerkId, input.clerkId),
            eq(notificationsTable.type, input.dedupeWithin.type),
            eq(notificationsTable.body, input.dedupeWithin.matchBody),
            isNull(notificationsTable.readAt),
          ),
        )
        .limit(1);
      if (existing) return;
    }

    await db.insert(notificationsTable).values({
      clerkId: input.clerkId,
      athleteClerkId: input.athleteClerkId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      priority: input.priority ?? "normal",
      actionUrl: input.actionUrl ?? null,
    });
  } catch {
    // Notifications are best-effort: never let a failure here break the caller.
  }
}

export async function getUnreadCount(clerkId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        isNull(notificationsTable.readAt),
      ),
    );
  return row?.count ?? 0;
}
