import { and, desc, eq, gt, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  notificationsTable,
  userProfilesTable,
  clubMembersTable,
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
  route_proposal: "sociaal",
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

// ── F12 (NOT-01): bundeling van meldingen per logisch object ─────────────────
//
// Meerdere meldingen over HETZELFDE logische object (bijv. één wedstrijdplan)
// binnen een tijdvenster groeien uit tot ÉÉN gebundelde melding ("7 wijzigingen
// in wedstrijdplan X"), niet losse rijen. Dit is iets anders dan de bel-fold
// (groupNotificationsByDay): fold is per KALENDERDAG en puur presentatie;
// bundeling is per OBJECT en verandert de onderliggende rijen.
//
// Keuze (onderbouwd): drempel 3, venster 24 uur.
//   • Drempel 3: onder de drie afzonderlijke wijzigingen is elke melding nog
//     op zichzelf informatief en is een bundel eerder verwarrend dan behulpzaam.
//     Vanaf de derde wijziging aan hetzelfde object verliest de losse lijst zijn
//     waarde en wint één samenvattende regel ("3 wijzigingen …").
//   • Venster 24 uur: wijzigingen aan één plan komen in golven; een etmaal vangt
//     een normale bewerkingssessie én een dag-erna-correctie zonder oude,
//     afgesloten situaties er alsnog bij te trekken.
// Beide zijn configureerbaar via env (NOTIF_BUNDLE_THRESHOLD /
// NOTIF_BUNDLE_WINDOW_HOURS) zodat de drempel/venster zonder codewijziging
// bijgesteld kan worden.
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const BUNDLE_THRESHOLD = envInt("NOTIF_BUNDLE_THRESHOLD", 3);
export const BUNDLE_WINDOW_HOURS = envInt("NOTIF_BUNDLE_WINDOW_HOURS", 24);

// Leid een bundelsleutel af voor een logisch object. Voorkeur: expliciete
// `bundleKey`. Anders category + source + object-referentie, waarbij de
// object-referentie uit dedupeKey of actionUrl komt (het pad zonder query/hash
// identificeert het object). Geen betrouwbare object-referentie ⇒ null (niet
// bundelbaar: losse rijen). Kritieke categorieën bundelen NOOIT.
export function deriveBundleKey(input: {
  category: NotificationCategory;
  source?: string | null;
  actionUrl?: string | null;
  dedupeKey?: string | null;
  bundleKey?: string | null;
}): string | null {
  if (CRITICAL_CATEGORIES.has(input.category)) return null;
  if (input.bundleKey) return input.bundleKey;
  // Object-referentie: dedupeKey (zonder trailing volgnummer) of het pad van
  // actionUrl (zonder query/hash). dedupeKey heeft de voorkeur want die is
  // stabiel en bevat geen gevoelige inhoud.
  let objectRef: string | null = null;
  if (input.dedupeKey) {
    objectRef = input.dedupeKey;
  } else if (input.actionUrl) {
    const path = input.actionUrl.split(/[?#]/)[0] ?? "";
    // Alleen een pad dat naar een specifiek object wijst (met een segment na de
    // eerste) is bundelbaar; een kaal "/train" is te grof om als object te tellen.
    objectRef = path && path.replace(/\/+$/, "").split("/").filter(Boolean).length >= 2
      ? path
      : null;
  }
  if (!objectRef) return null;
  return `${input.category}:${input.source ?? "-"}:${objectRef}`;
}

// De zichtbare tekst van een gebundelde melding — telwoord in de body, geen
// gevoelige inhoud (die stond al in de individuele in-app rijen, en de push is
// sowieso neutraal). `label` is een korte, niet-gevoelige objectaanduiding.
function bundleBody(count: number, label: string): string {
  return `${count} wijzigingen in ${label}`;
}

const BUNDLE_PRIORITY_RANK: Record<NotificationPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
};

function higherPriority(
  a: NotificationPriority,
  b: NotificationPriority,
): NotificationPriority {
  return BUNDLE_PRIORITY_RANK[a] >= BUNDLE_PRIORITY_RANK[b] ? a : b;
}

// Uitkomst van het gebundelde aanmaakpad. `created` = of er ÉCHT een nieuwe,
// zichtbare rij bijkwam (contract van createNotification: true = nieuw event dat
// hoogstens één keer een push mag triggeren).
type BundleResult = { handled: true; created: boolean } | { handled: false };

// Maak/verwerk een bundelbare melding ATOMAIR (reviewfix NOT-01).
//
// Read-then-write per bundelsleutel is niet veilig zonder serialisatie — twee
// gelijktijdige producenten zouden dubbel kunnen bundelen of een increment
// kunnen verliezen. Daarom draait de HELE beslissing — inclusief de eventuele
// insert van een losse rij — in ÉÉN transactie achter een
// `pg_advisory_xact_lock` op hash(clerkId, bundleKey): per logisch object
// serieel over de hele cluster, met automatische vrijgave bij commit/rollback
// (lock op één tx-verbinding — memory-les). De teller wordt in SQL opgehoogd
// (`bundle_count + 1`), nooit met een in JS berekende waarde.
//
// Uitkomsten binnen de lock:
//   • bestaande bundel (count ≥ drempel)      ⇒ groeien, geen nieuwe rij
//   • losse siblings + deze ≥ drempel          ⇒ vouwen tot één bundel-rij
//   • daaronder                                ⇒ gewone losse insert (in de tx)
async function bundleOrInsert(args: {
  input: CreateNotificationInput;
  category: NotificationCategory;
  priority: NotificationPriority;
  bundleKey: string;
  label: string;
}): Promise<BundleResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - BUNDLE_WINDOW_HOURS * 3_600_000);
  const { input, category, priority, bundleKey, label } = args;
  const lockName = `notif-bundle:${input.clerkId}:${bundleKey}`;

  return db.transaction(async (tx): Promise<BundleResult> => {
    // Serialiseer alle bundelbeslissingen voor dit ene logische object.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockName}))`);

    // Alle open (niet-opgeloste, niet-verlopen) rijen voor dit object binnen het
    // venster, nieuwste eerst. Gelezen ONDER de lock ⇒ geen andere schrijver
    // kan tussendoor bundelen.
    const open = await tx
      .select({
        id: notificationsTable.id,
        bundleCount: notificationsTable.bundleCount,
        priority: notificationsTable.priority,
        readAt: notificationsTable.readAt,
      })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, input.clerkId),
          eq(notificationsTable.bundleKey, bundleKey),
          isNull(notificationsTable.resolvedAt),
          gte(notificationsTable.createdAt, windowStart),
          activeNotificationFilter(now),
        ),
      )
      .orderBy(desc(notificationsTable.createdAt));

    // Bestaat er al een bundel-rij (count ≥ drempel)? Dan laten we die groeien.
    const existingBundle = open.find((r) => r.bundleCount >= BUNDLE_THRESHOLD);
    if (existingBundle) {
      const newPriority = higherPriority(
        existingBundle.priority as NotificationPriority,
        priority,
      );
      // Teller ATOMAIR in SQL ophogen; de body wordt uit de nieuwe waarde
      // opgebouwd binnen dezelfde statement zodat count en tekst nooit
      // uiteenlopen.
      await tx
        .update(notificationsTable)
        .set({
          bundleCount: sql`${notificationsTable.bundleCount} + 1`,
          body: sql`(${notificationsTable.bundleCount} + 1)::text || ' wijzigingen in ' || ${label}`,
          // Laatste actie-URL brengt naar de meest recente wijziging.
          actionUrl: input.actionUrl ?? null,
          priority: newPriority,
          // Groei = weer relevant: de bundel springt terug op ongelezen.
          readAt: null,
        })
        .where(eq(notificationsTable.id, existingBundle.id));
      // Groei is geen nieuw zichtbaar item ⇒ geen extra push.
      return { handled: true, created: false };
    }

    // Nog geen bundel. Alleen ACTIEVE, nog-ONGELEZEN losse rijen tellen mee voor
    // het vouwen (beleidskeuze, zie BEWIJS.md): al-gelezen rijen zijn door de
    // gebruiker afgedaan en worden niet met terugwerkende kracht in een nieuwe
    // bundel getrokken; al-geresolvede rijen vallen sowieso al buiten `open`.
    const loose = open.filter(
      (r) => r.bundleCount === 1 && r.readAt == null,
    );
    if (loose.length + 1 >= BUNDLE_THRESHOLD) {
      const count = loose.length + 1;
      const highest = loose.reduce<NotificationPriority>(
        (acc, r) => higherPriority(acc, r.priority as NotificationPriority),
        priority,
      );
      // De oudste losse rij wordt de bundel-rij (blijft op zijn plek in de
      // tijdlijn); de overige worden opgeslokt (resolved = uit bel/tellers).
      const keep = loose[loose.length - 1]!;
      const absorb = loose.filter((r) => r.id !== keep.id).map((r) => r.id);
      if (absorb.length > 0) {
        await tx
          .update(notificationsTable)
          .set({ resolvedAt: now })
          .where(inArray(notificationsTable.id, absorb));
      }
      // `count` is hier veilig JS-berekend: onder de lock kan het aantal losse
      // siblings niet meer wijzigen tussen de telling en de update.
      await tx
        .update(notificationsTable)
        .set({
          bundleCount: count,
          body: bundleBody(count, label),
          actionUrl: input.actionUrl ?? null,
          priority: highest,
          readAt: null,
        })
        .where(eq(notificationsTable.id, keep.id));
      // Nieuw samengevatte bundel ⇒ telt als nieuw zichtbaar item.
      return { handled: true, created: true };
    }

    // Onder de drempel: gewone losse insert BINNEN de tx (dus onder de lock),
    // zodat een gelijktijdige producent 'm meetelt en het vouwen niet mist.
    const inserted = await tx
      .insert(notificationsTable)
      .values({
        clerkId: input.clerkId,
        athleteClerkId: input.athleteClerkId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        priority,
        actionUrl: input.actionUrl ?? null,
        category,
        source: input.source ?? null,
        audience: input.audience ?? "athlete",
        expiresAt: input.expiresAt ?? null,
        resolutionKey: input.resolutionKey ?? null,
        dedupeKey: input.dedupeKey ?? null,
        bundleKey,
        bundleCount: 1,
      })
      .onConflictDoNothing()
      .returning({ id: notificationsTable.id });
    return { handled: true, created: inserted.length > 0 };
  });
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
  // F12 (NOT-01): expliciete bundelsleutel voor HETZELFDE logische object. Laat
  // leeg om 'm automatisch af te leiden (category+source+object-referentie uit
  // dedupeKey/actionUrl). NULL/leeg + geen afleidbare referentie ⇒ niet bundelen.
  bundleKey?: string | null;
  // Korte, niet-gevoelige aanduiding van het object voor de bundel-body (bijv.
  // "je wedstrijdplan", "de clubagenda"). Valt terug op de titel.
  bundleLabel?: string;
};

/**
 * Maak één in-app melding. Geeft `true` terug wanneer er ÉCHT een nieuwe rij is
 * aangemaakt (dus niet gededupliceerd/overgeslagen) — zodat een aanroeper
 * hoogstens één keer per storing een push kan sturen, nooit per poging.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<boolean> {
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
      if (existing) return false;
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
      if (open) return false;
    }

    const category = input.category ?? TYPE_CATEGORY[input.type] ?? "systeem";
    const priority = input.priority ?? "normal";
    // F12 (NOT-01): kan deze melding bij een lopende/nieuwe bundel horen?
    // Kritieke categorieën leveren null en worden dus NOOIT gebundeld.
    const bundleKey = deriveBundleKey({
      category,
      source: input.source,
      actionUrl: input.actionUrl,
      dedupeKey: input.dedupeKey,
      bundleKey: input.bundleKey,
    });

    if (bundleKey) {
      // Bundelbaar: het hele bundel-/insertpad draait atomair achter een
      // advisory lock op (clerkId, bundleKey). Zie bundleOrInsert.
      const result = await bundleOrInsert({
        input,
        category,
        priority,
        bundleKey,
        label: input.bundleLabel ?? input.title,
      });
      if (result.handled) return result.created;
    }

    const inserted = await db
      .insert(notificationsTable)
      .values({
        clerkId: input.clerkId,
        athleteClerkId: input.athleteClerkId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        priority,
        actionUrl: input.actionUrl ?? null,
        category,
        source: input.source ?? null,
        audience: input.audience ?? "athlete",
        expiresAt: input.expiresAt ?? null,
        resolutionKey: input.resolutionKey ?? null,
        dedupeKey: input.dedupeKey ?? null,
        bundleKey: bundleKey ?? null,
        bundleCount: 1,
      })
      .onConflictDoNothing()
      .returning({ id: notificationsTable.id });
    return inserted.length > 0;
  } catch {
    // Notifications are best-effort: never let a failure here break the caller.
    return false;
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

// ── F12 (NOT-05): audience-afdwinging (fail-closed) ──────────────────────────
//
// Een melding met `audience` gezet mag alleen zichtbaar/afhandelbaar zijn voor
// iemand die die rol NÚ heeft (rollen uit de eigen DB). Trekt iemand een rol
// in, dan verdwijnt de bijbehorende melding — ook via een directe aanroep
// (404, geen 403-lek). `audience` NULL/leeg = altijd zichtbaar voor de
// eigenaar. Fail-closed: bij twijfel/fout tonen we alleen de eigen (athlete +
// audience-loze) meldingen.
//
// Rollen ⇒ audiences: iedereen is eigenaar/athlete; coach/parent volgen de
// `roles`-array; "club" geldt zodra iemand actief lid is van minstens één club.
export async function visibleAudiences(clerkId: string): Promise<string[]> {
  const audiences = new Set<string>(["athlete"]);
  try {
    const [profile] = await db
      .select({ roles: userProfilesTable.roles })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId))
      .limit(1);
    const roles = profile?.roles ?? [];
    if (roles.includes("coach")) audiences.add("coach");
    if (roles.includes("parent")) audiences.add("parent");
    // Actief clublidmaatschap ⇒ club-audience.
    const [club] = await db
      .select({ id: clubMembersTable.id })
      .from(clubMembersTable)
      .where(
        and(
          eq(clubMembersTable.clerkId, clerkId),
          isNull(clubMembersTable.endedAt),
        ),
      )
      .limit(1);
    if (club) audiences.add("club");
  } catch {
    // Fail-closed: bij een fout alleen de eigen, audience-loze meldingen.
    return ["athlete"];
  }
  return Array.from(audiences);
}

// SQL-filter: een melding is zichtbaar wanneer haar `audience` NULL/leeg is
// (altijd zichtbaar voor de eigenaar) OF valt binnen de audiences die de
// gebruiker nú heeft.
export function audienceFilter(audiences: string[]): SQL {
  return or(
    isNull(notificationsTable.audience),
    eq(notificationsTable.audience, ""),
    inArray(notificationsTable.audience, audiences),
  )!;
}

export async function getUnreadCount(
  clerkId: string,
  audiences?: string[],
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        isNull(notificationsTable.readAt),
        activeNotificationFilter(),
        audiences ? audienceFilter(audiences) : undefined,
      ),
    );
  return row?.count ?? 0;
}

// The bell folds many notifications into one combined row per calendar day, so
// the unread badge must count *days that have an unread notification* (max one
// per day) — never the raw row total. Counted in the athlete's local timezone
// (Europe/Amsterdam) so the day boundary matches what "vandaag" means to them.
export async function getUnreadDayCount(
  clerkId: string,
  audiences?: string[],
): Promise<number> {
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
        audiences ? audienceFilter(audiences) : undefined,
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
