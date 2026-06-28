// Daily notification fold — pure-function contract test.
//
// Locks down `groupNotificationsByDay` in `../lib/notifications.ts`, the logic
// the in-app bell relies on for EVERY signed-in user: it folds many rows into
// at-most-one combined entry per athlete calendar day (Europe/Amsterdam), labels
// only *today's* fold "Je hebt N dingen voor vandaag", bubbles the highest
// priority, and keeps members in input order. A silent regression in the
// grouping, the timezone day boundary, or the per-day fold would distort the
// bell for everyone, so this test pins the behaviour down.
//
// These are PURE assertions — no database, no server, no network. The function
// takes plain `Notification[]` + an injected `now`, so the harness builds
// in-memory fixtures and feeds a fixed clock to make the day boundary
// deterministic across DST.
//
// Run: `pnpm --filter @workspace/api-server run test:notifications`
// Exits non-zero on any failure.

import {
  groupNotificationsByDay,
  type NotificationGroup,
} from "../lib/notifications";
import type { Notification, NotificationPriority } from "@workspace/db";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// In-memory Notification fixture. Only createdAt / readAt / priority matter to
// the function under test; the rest are filled with valid placeholders.
let idCounter = 1;
function notif(
  over: Partial<Notification> & { createdAt: Date },
): Notification {
  return {
    id: idCounter++,
    clerkId: "u1",
    athleteClerkId: null,
    type: "system",
    title: "Melding",
    body: null,
    priority: "normal",
    readAt: null,
    actionUrl: null,
    dedupeKey: null,
    sentAt: null,
    ...over,
  } as Notification;
}

// Narrowing helpers so failures read clearly instead of TS-casting noise.
function asDay(
  g: NotificationGroup,
): Extract<NotificationGroup, { kind: "day" }> {
  assert(g.kind === "day", `expected a folded "day" group, got "${g.kind}"`);
  return g as Extract<NotificationGroup, { kind: "day" }>;
}
function asSingle(
  g: NotificationGroup,
): Extract<NotificationGroup, { kind: "single" }> {
  assert(g.kind === "single", `expected an unwrapped "single", got "${g.kind}"`);
  return g as Extract<NotificationGroup, { kind: "single" }>;
}

// A fixed "now": 2026-06-28 12:00 in Amsterdam (CEST, UTC+2) = 10:00Z.
const NOW_SUMMER = new Date("2026-06-28T10:00:00Z");
// A fixed winter "now": 2026-01-15 12:00 in Amsterdam (CET, UTC+1) = 11:00Z.
const NOW_WINTER = new Date("2026-01-15T11:00:00Z");

function main() {
  // 1. Empty input yields no groups (no crash, no phantom entry).
  scenario("lege invoer levert geen groepen", () => {
    const out = groupNotificationsByDay([], NOW_SUMMER);
    assert(Array.isArray(out) && out.length === 0, "expected [] for empty input");
  });

  // 2. A day with one notification is returned UNWRAPPED (no "1 ding" fold).
  scenario("dag met één melding blijft uitgepakt (single)", () => {
    const n = notif({ createdAt: new Date("2026-06-28T08:00:00Z") });
    const out = groupNotificationsByDay([n], NOW_SUMMER);
    assert(out.length === 1, `expected 1 group, got ${out.length}`);
    const s = asSingle(out[0]!);
    assert(s.notification.id === n.id, "single must carry the original row");
  });

  // 3. A day with several notifications folds into ONE combined "day" entry.
  scenario("dag met meerdere meldingen vouwt tot één entry", () => {
    const a = notif({ createdAt: new Date("2026-06-28T07:00:00Z") });
    const b = notif({ createdAt: new Date("2026-06-28T08:00:00Z") });
    const c = notif({ createdAt: new Date("2026-06-28T09:00:00Z") });
    const out = groupNotificationsByDay([a, b, c], NOW_SUMMER);
    assert(out.length === 1, `expected 1 folded group, got ${out.length}`);
    const d = asDay(out[0]!);
    assert(d.count === 3, `count should be 3, got ${d.count}`);
    assert(d.members.length === 3, `members should hold all 3 rows`);
    assert(d.isToday === true, "this fold is today");
  });

  // 4. The "Je hebt N dingen voor vandaag" title is ONLY for today.
  scenario('"… dingen voor vandaag" titel alleen voor vandaag', () => {
    const today = [
      notif({ createdAt: new Date("2026-06-28T07:00:00Z") }),
      notif({ createdAt: new Date("2026-06-28T08:00:00Z") }),
    ];
    const earlier = [
      // 2026-06-26 (two days ago): a multi-row day that is NOT today.
      notif({ createdAt: new Date("2026-06-26T07:00:00Z") }),
      notif({ createdAt: new Date("2026-06-26T08:00:00Z") }),
    ];
    const out = groupNotificationsByDay([...today, ...earlier], NOW_SUMMER);
    assert(out.length === 2, `expected 2 day-groups, got ${out.length}`);

    const todayGroup = asDay(out[0]!);
    assert(todayGroup.isToday === true, "first group should be today");
    assert(
      todayGroup.title === "Je hebt 2 dingen voor vandaag",
      `today title wrong: "${todayGroup.title}"`,
    );

    const olderGroup = asDay(out[1]!);
    assert(olderGroup.isToday === false, "second group is not today");
    assert(
      olderGroup.title === "2 meldingen",
      `non-today fold must use neutral title, got "${olderGroup.title}"`,
    );
  });

  // 5. Priority bubbling: the fold reports the HIGHEST member priority.
  scenario("hoogste prioriteit borrelt op in de vouw", () => {
    const mk = (p: NotificationPriority, h: number) =>
      notif({ priority: p, createdAt: new Date(`2026-06-28T0${h}:00:00Z`) });

    const lowOnly = groupNotificationsByDay(
      [mk("low", 7), mk("low", 8)],
      NOW_SUMMER,
    );
    assert(asDay(lowOnly[0]!).priority === "low", "all-low should stay low");

    const mixed = groupNotificationsByDay(
      [mk("low", 7), mk("high", 8), mk("normal", 9)],
      NOW_SUMMER,
    );
    assert(
      asDay(mixed[0]!).priority === "high",
      `mixed fold must surface high, got ${asDay(mixed[0]!).priority}`,
    );

    const normalMax = groupNotificationsByDay(
      [mk("low", 7), mk("normal", 8)],
      NOW_SUMMER,
    );
    assert(
      asDay(normalMax[0]!).priority === "normal",
      "low+normal should surface normal",
    );
  });

  // 6. Members keep INPUT order within a folded day (no resorting).
  scenario("leden behouden invoervolgorde binnen een dag", () => {
    const first = notif({ createdAt: new Date("2026-06-28T09:00:00Z") });
    const second = notif({ createdAt: new Date("2026-06-28T07:00:00Z") });
    const third = notif({ createdAt: new Date("2026-06-28T08:00:00Z") });
    const out = groupNotificationsByDay([first, second, third], NOW_SUMMER);
    const d = asDay(out[0]!);
    assert(
      d.members[0]!.id === first.id &&
        d.members[1]!.id === second.id &&
        d.members[2]!.id === third.id,
      "members must preserve the order they were supplied in",
    );
  });

  // 7. Day groups appear in first-seen input order (newest-day-first when the
  //    caller supplies newest first), each distinct day kept separate.
  scenario("dag-groepen volgen invoervolgorde van de dagen", () => {
    const out = groupNotificationsByDay(
      [
        notif({ createdAt: new Date("2026-06-28T09:00:00Z") }), // today
        notif({ createdAt: new Date("2026-06-28T08:00:00Z") }), // today
        notif({ createdAt: new Date("2026-06-27T09:00:00Z") }), // yesterday
      ],
      NOW_SUMMER,
    );
    assert(out.length === 2, `expected 2 groups (today fold + single), got ${out.length}`);
    assert(out[0]!.kind === "day", "first group should be today's fold");
    assert(out[1]!.kind === "single", "second should be yesterday's single");
    const y = asSingle(out[1]!);
    assert(y.notification.createdAt instanceof Date, "single carries its row");
  });

  // 8. unreadCount counts only unread (readAt == null) members; count = total.
  scenario("unreadCount telt alleen ongelezen leden", () => {
    const out = groupNotificationsByDay(
      [
        notif({ createdAt: new Date("2026-06-28T07:00:00Z"), readAt: null }),
        notif({
          createdAt: new Date("2026-06-28T08:00:00Z"),
          readAt: new Date("2026-06-28T08:30:00Z"),
        }),
        notif({ createdAt: new Date("2026-06-28T09:00:00Z"), readAt: null }),
      ],
      NOW_SUMMER,
    );
    const d = asDay(out[0]!);
    assert(d.count === 3, `count should be 3 (all members), got ${d.count}`);
    assert(
      d.unreadCount === 2,
      `unreadCount should be 2 (one is read), got ${d.unreadCount}`,
    );
  });

  // 9. Day boundary in SUMMER (Ams = UTC+2): local midnight is 22:00Z the
  //    previous UTC day. Two notifications straddling it must land on different
  //    Amsterdam calendar days — NOT be lumped together by UTC date.
  scenario("dag-grens rond middernacht (zomertijd, UTC+2)", () => {
    const justBefore = notif({
      // 23:59 Amsterdam on 2026-06-27.
      createdAt: new Date("2026-06-27T21:59:00Z"),
    });
    const justAfter = notif({
      // 00:01 Amsterdam on 2026-06-28 (today).
      createdAt: new Date("2026-06-27T22:01:00Z"),
    });
    const out = groupNotificationsByDay([justAfter, justBefore], NOW_SUMMER);
    // If the boundary were computed in UTC, both fall on 2026-06-27 and would
    // fold into ONE group. Correct (Amsterdam) handling keeps them apart.
    assert(
      out.length === 2,
      `straddling rows must be on separate Ams days, got ${out.length} group(s)`,
    );
    const todaySingle = asSingle(out[0]!);
    assert(
      todaySingle.notification.id === justAfter.id,
      "00:01 Ams row belongs to today (2026-06-28)",
    );
  });

  // 10. Day boundary in WINTER (Ams = UTC+1): local midnight is 23:00Z the
  //     previous UTC day. Confirms the boundary tracks DST, not a fixed offset.
  scenario("dag-grens rond middernacht (wintertijd, UTC+1)", () => {
    const justBefore = notif({
      // 23:59 Amsterdam on 2026-01-14.
      createdAt: new Date("2026-01-14T22:59:00Z"),
    });
    const justAfter = notif({
      // 00:01 Amsterdam on 2026-01-15 (today).
      createdAt: new Date("2026-01-14T23:01:00Z"),
    });
    const out = groupNotificationsByDay([justAfter, justBefore], NOW_WINTER);
    assert(
      out.length === 2,
      `winter straddling rows must split across Ams days, got ${out.length}`,
    );
    const todaySingle = asSingle(out[0]!);
    assert(
      todaySingle.notification.id === justAfter.id,
      "00:01 Ams row belongs to today (2026-01-15) in winter too",
    );
  });
}

main();
const failed = results.filter((r) => r.status === "fail");
console.log("\n=== daily notification fold — test results ===");
for (const r of results) {
  const mark = r.status === "pass" ? "PASS" : "FAIL";
  console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
process.exit(failed.length > 0 ? 1 : 0);
