import { and, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  notificationsTable,
  type Notification,
  type NotificationType,
  type NotificationPriority,
  type NotificationCategory,
} from "@workspace/db";

// Central notification layer (Golf 24). Every notification carries the full
// contract: type + category + priority, validity (expiresAt), source, audience
// (role entitlement), action (actionUrl), read/handled state (readAt/
// resolvedAt) and a dedupe key. Recipient = clerkId; athleteClerkId is who the
// notification is *about*.

export type NotificationAudience = "athlete" | "coach" | "parent" | "club";

// Every type maps to exactly ONE category — the single source of truth used by
// preferences (category toggles), quiet hours and the read path. Old rows with
// category NULL derive it from `type` via this map.
export const TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  ai_observation: "training",
  training_reminder: "training",
  recovery_warning: "herstel",
  race_reminder: "wedstrijd",
  coach_update: "coach",
  parent_update: "ouder",
  system: "systeem",
  checkin_reminder: "herstel",
  followup_question: "training",
  profile_nudge: "systeem",
  something_new: "sociaal",
  club_update: "club",
  world_update: "sociaal",
  parent_report: "ouder",
  consent_required: "ouder",
  access_changed: "privacy",
  sync_error: "sync",
  security_alert: "veiligheid",
};

// Critical categories can never be fully switched off (spec: privacy/security/
// safety). They are delivered restrained (in-app + push only, high priority)
// but always reach the user.
export const CRITICAL_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  "privacy",
  "veiligheid",
]);

export function categoryOf(n: {
  category?: string | null;
  type: string;
}): NotificationCategory {
  if (n.category) return n.category as NotificationCategory;
  return TYPE_CATEGORY[n.type as NotificationType] ?? "systeem";
}

export type CreateNotificationInput = {
  clerkId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  priority?: NotificationPriority;
  athleteClerkId?: string | null;
  actionUrl?: string | null;
  // Category override; defaults to the type's registry category.
  category?: NotificationCategory;
  // Where the notification originated (e.g. "reminders", "data-hub", "coach").
  // Used for delivery/error logging without sensitive content.
  source?: string;
  // Which role the recipient holds for this notification (entitlement guard).
  audience?: NotificationAudience;
  // Validity: after this moment the notification is no longer shown/delivered.
  expiresAt?: Date | null;
  // Resolution key: when the underlying situation is fixed, all open rows with
  // this key are resolved (they disappear). E.g. "sync:<connectionId>".
  resolutionKey?: string | null;
  // Hard idempotency key (partial unique index) — preferred dedupe mechanism:
  // the same event never creates a second row, read or unread.
  dedupeKey?: string | null;
  // Legacy soft-dedupe: skip when an unread row with the same (type, body)
  // exists. Kept for existing producers; new producers should use dedupeKey.
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

    // An unresolved open row for the same situation (resolutionKey) must not be
    // duplicated either — one situation, one notification.
    if (input.resolutionKey) {
      const [open] = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.clerkId, input.clerkId),
            eq(notificationsTable.resolutionKey, input.resolutionKey),
            isNull(notificationsTable.resolvedAt),
          ),
        )
        .limit(1);
      if (open) return;
    }

    await db
      .insert(notificationsTable)
      .values({
        clerkId: input.clerkId,
        athleteClerkId: input.athleteClerkId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        priority: input.priority ?? "normal",
        actionUrl: input.actionUrl ?? null,
        category: input.category ?? TYPE_CATEGORY[input.type] ?? "systeem",
        source: input.source ?? null,
        audience: input.audience ?? "athlete",
        expiresAt: input.expiresAt ?? null,
        resolutionKey: input.resolutionKey ?? null,
        dedupeKey: input.dedupeKey ?? null,
      })
      .onConflictDoNothing();
  } catch {
    // Notifications are best-effort: never let a failure here break the caller.
  }
}

// Resolve every open notification for a situation that is now fixed (sync
// restored, consent granted, material action done, workout changed, …). The
// rows stay for history but disappear from the bell and unread counts.
export async function resolveNotifications(
  clerkId: string,
  resolutionKey: string,
): Promise<void> {
  try {
    const now = new Date();
    await db
      .update(notificationsTable)
      .set({ resolvedAt: now })
      .where(
        and(
          eq(notificationsTable.clerkId, clerkId),
          eq(notificationsTable.resolutionKey, resolutionKey),
          isNull(notificationsTable.resolvedAt),
        ),
      );
  } catch {
    // Best-effort, same contract as createNotification.
  }
}

// Read-path hygiene: only active notifications are shown or counted — not
// expired (validity window) and not resolved (situation fixed).
export function activeNotificationFilter(now: Date = new Date()): SQL {
  return and(
    isNull(notificationsTable.resolvedAt),
    or(
      isNull(notificationsTable.expiresAt),
      gt(notificationsTable.expiresAt, now),
    ),
  )!;
}

export async function getUnreadCount(clerkId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        isNull(notificationsTable.readAt),
        activeNotificationFilter(),
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
        activeNotificationFilter(),
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
