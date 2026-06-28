import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  notificationsTable,
  type Notification,
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

// The bell folds many notifications into one combined row per calendar day, so
// the unread badge must count *days that have an unread notification* (max one
// per day) — never the raw row total. Counted in the athlete's local timezone
// (Europe/Amsterdam) so the day boundary matches what "vandaag" means to them.
export async function getUnreadDayCount(clerkId: string): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(distinct (${notificationsTable.createdAt} at time zone 'Europe/Amsterdam')::date)::int`,
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        isNull(notificationsTable.readAt),
      ),
    );
  return row?.count ?? 0;
}

// ── Day grouping (in-app bell only) ──────────────────────────────────────────
// Pure presentation layer: the underlying rows are never altered (they stay for
// email delivery, dedupe and history). We only fold them into at-most-one entry
// per calendar day for the bell.

const AMS_TZ = "Europe/Amsterdam";
const PRIORITY_RANK: Record<NotificationPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
};

// YYYY-MM-DD for a date in the athlete's local timezone (en-CA renders ISO).
function amsDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AMS_TZ }).format(d);
}

function dayLabel(dayKey: string, todayKey: string, yesterdayKey: string): string {
  if (dayKey === todayKey) return "Vandaag";
  if (dayKey === yesterdayKey) return "Gisteren";
  // Noon UTC keeps us on the same calendar day after the Ams offset is applied.
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString("nl-NL", {
    timeZone: AMS_TZ,
    day: "numeric",
    month: "short",
  });
}

export type NotificationGroup =
  | { kind: "single"; notification: Notification }
  | {
      kind: "day";
      dayKey: string;
      dayLabel: string;
      isToday: boolean;
      title: string;
      priority: NotificationPriority;
      count: number;
      unreadCount: number;
      members: Notification[];
    };

// Group recent notifications by the athlete's calendar day, newest day first.
// A day with a single notification is returned unwrapped (no "1 ding" wrapper);
// a day with several is folded into one combined entry with its members listed.
export function groupNotificationsByDay(
  notifications: Notification[],
  now: Date = new Date(),
): NotificationGroup[] {
  const todayKey = amsDayKey(now);
  const yesterdayKey = amsDayKey(new Date(now.getTime() - 86_400_000));

  const order: string[] = [];
  const byDay = new Map<string, Notification[]>();
  for (const n of notifications) {
    const key = amsDayKey(new Date(n.createdAt));
    let bucket = byDay.get(key);
    if (!bucket) {
      bucket = [];
      byDay.set(key, bucket);
      order.push(key);
    }
    bucket.push(n);
  }

  const groups: NotificationGroup[] = [];
  for (const key of order) {
    const members = byDay.get(key)!;
    if (members.length === 1) {
      groups.push({ kind: "single", notification: members[0]! });
      continue;
    }
    const isToday = key === todayKey;
    const count = members.length;
    const unreadCount = members.filter((m) => m.readAt == null).length;
    const priority = members.reduce<NotificationPriority>(
      (hi, m) =>
        PRIORITY_RANK[m.priority as NotificationPriority] > PRIORITY_RANK[hi]
          ? (m.priority as NotificationPriority)
          : hi,
      "low",
    );
    const title = isToday
      ? `Je hebt ${count} dingen voor vandaag`
      : `${count} meldingen`;
    groups.push({
      kind: "day",
      dayKey: key,
      dayLabel: dayLabel(key, todayKey, yesterdayKey),
      isToday,
      title,
      priority,
      count,
      unreadCount,
      members,
    });
  }
  return groups;
}
