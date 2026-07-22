// Golf 24 — contextuele aandacht & meldingen.
//
// Vergrendelt de centrale meldingslaag + voorkeuren:
//  - TYPE_CATEGORY dekt elk NotificationType; categoryOf valt eerlijk terug
//  - kritieke categorieën (privacy/veiligheid) zijn nooit uitschakelbaar
//  - stille uren (Europe/Amsterdam, ook over middernacht) dempen alleen
//    push/e-mail voor niet-kritiek
//  - channelAllowed: kritiek → push altijd, e-mail volgt schakelaar
//  - resolutionKey: één open situatie = één melding; oplossen laat de rij
//    verdwijnen uit bel/tellers maar bewaart historie
//  - activeNotificationFilter: verlopen en opgeloste rijen tellen niet mee
//
// Run: `pnpm --filter @workspace/api-server run test:attention-notifications`
// (of via shell: node ./scripts/run-test.mjs attention-notifications)

import { and, eq, like } from "drizzle-orm";
import { db, notificationsTable, userProfilesTable } from "@workspace/db";
import {
  TYPE_CATEGORY,
  CRITICAL_CATEGORIES,
  categoryOf,
  createNotification,
  resolveNotifications,
  getUnreadCount,
} from "../lib/notifications";
import {
  DEFAULT_PREFS,
  allowsCategory,
  inQuietHours,
  channelAllowed,
  type EffectivePrefs,
} from "../engines/reminders/preferences";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// 12:00 Amsterdam-zomer = 10:00Z; 23:30 Ams = 21:30Z (juli, CEST = UTC+2).
function amsSummer(hh: number, mm: number): Date {
  const utcH = (hh - 2 + 24) % 24;
  return new Date(Date.UTC(2026, 6, 22, utcH, mm, 0));
}

function prefs(patch: Partial<EffectivePrefs>): EffectivePrefs {
  return { ...DEFAULT_PREFS, ...patch };
}

const TEST_ID = "test_attention_notifications_user";

async function cleanup() {
  await db
    .delete(notificationsTable)
    .where(eq(notificationsTable.clerkId, TEST_ID));
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, TEST_ID));
}

async function main() {
  // ── Pure laag ──────────────────────────────────────────────────────────────
  await scenario("TYPE_CATEGORY dekt elk type en categoryOf valt terug", () => {
    for (const [type, cat] of Object.entries(TYPE_CATEGORY)) {
      assert(typeof cat === "string" && cat.length > 0, `lege categorie voor ${type}`);
      assert(categoryOf({ type }) === cat, `categoryOf(${type}) wijkt af`);
    }
    assert(categoryOf({ type: "onbekend_type" }) === "systeem", "fallback ≠ systeem");
    assert(
      categoryOf({ type: "sync_error", category: "privacy" }) === "privacy",
      "expliciete categorie wint niet",
    );
  });

  await scenario("kritieke categorieën nooit uitschakelbaar", () => {
    const allOff = prefs({
      catCoach: false,
      catClub: false,
      catSocial: false,
      catMaterial: false,
      catSync: false,
    });
    for (const cat of CRITICAL_CATEGORIES) {
      assert(allowsCategory(allOff, cat), `${cat} mag nooit uit`);
    }
    assert(!allowsCategory(allOff, "coach"), "catCoach uit maar toch toegestaan");
    assert(!allowsCategory(allOff, "sync"), "catSync uit maar toch toegestaan");
    assert(allowsCategory(allOff, "training"), "training volgt per-type flags, niet cat*");
  });

  await scenario("stille uren: gewoon venster + over middernacht", () => {
    const p = prefs({ quietHoursStart: "13:00", quietHoursEnd: "15:00" });
    assert(inQuietHours(p, amsSummer(14, 0)), "14:00 hoort in 13–15");
    assert(!inQuietHours(p, amsSummer(15, 0)), "15:00 (einde) is niet stil");
    const nacht = prefs({ quietHoursStart: "22:00", quietHoursEnd: "07:00" });
    assert(inQuietHours(nacht, amsSummer(23, 30)), "23:30 hoort in 22–07");
    assert(inQuietHours(nacht, amsSummer(3, 0)), "03:00 hoort in 22–07");
    assert(!inQuietHours(nacht, amsSummer(12, 0)), "12:00 hoort niet in 22–07");
    assert(
      !inQuietHours(prefs({ quietHoursStart: null, quietHoursEnd: null }), amsSummer(23, 0)),
      "zonder venster nooit stil",
    );
    assert(
      !inQuietHours(prefs({ quietHoursStart: "08:00", quietHoursEnd: "08:00" }), amsSummer(8, 0)),
      "start=einde is geen venster",
    );
    assert(
      !inQuietHours(prefs({ quietHoursStart: "25:99", quietHoursEnd: "07:00" }), amsSummer(23, 0)),
      "ongeldige HH:MM telt niet als venster",
    );
  });

  await scenario("channelAllowed: kritiek passeert, niet-kritiek respecteert alles", () => {
    const noon = amsSummer(12, 0);
    const night = amsSummer(23, 30);
    const quiet = prefs({ quietHoursStart: "22:00", quietHoursEnd: "07:00" });
    // Niet-kritiek: stille uren dempen push + e-mail.
    assert(channelAllowed(quiet, "push", "training", noon), "push overdag moet mogen");
    assert(!channelAllowed(quiet, "push", "training", night), "push in stille uren moet uit");
    assert(!channelAllowed(quiet, "email", "training", night), "e-mail in stille uren moet uit");
    // Kanaal-schakelaar uit ⇒ niet-kritiek nooit.
    const pushOff = prefs({ channelPush: false });
    assert(!channelAllowed(pushOff, "push", "training", noon), "channelPush uit genegeerd");
    // Kritiek: push ALTIJD (ook schakelaar uit, ook stille uren).
    const strict = prefs({ channelPush: false, quietHoursStart: "22:00", quietHoursEnd: "07:00" });
    assert(channelAllowed(strict, "push", "veiligheid", night), "kritieke push moet altijd");
    assert(channelAllowed(strict, "push", "privacy", night), "kritieke push moet altijd");
    // Kritieke e-mail volgt de e-mailschakelaar.
    const emailOff = prefs({ channelEmail: false });
    assert(!channelAllowed(emailOff, "email", "privacy", noon), "kritieke e-mail volgt schakelaar");
    assert(channelAllowed(prefs({}), "email", "privacy", night), "kritieke e-mail passeert stille uren");
  });

  // ── DB-laag ────────────────────────────────────────────────────────────────
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: TEST_ID,
    email: "attention-notifications-test@example.com",
    displayName: "Meldingen Test",
  });

  await scenario("resolutionKey: één open situatie = één melding", async () => {
    const key = "sync:test-conn-1";
    await createNotification({
      clerkId: TEST_ID,
      type: "sync_error",
      title: "Synchronisatie hapert",
      resolutionKey: key,
    });
    await createNotification({
      clerkId: TEST_ID,
      type: "sync_error",
      title: "Synchronisatie hapert (dubbel)",
      resolutionKey: key,
    });
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          eq(notificationsTable.resolutionKey, key),
        ),
      );
    assert(rows.length === 1, `verwacht 1 rij, kreeg ${rows.length}`);
    assert(rows[0]!.category === "sync", "categorie niet uit registry gevuld");
  });

  await scenario("resolveNotifications: rij verdwijnt uit teller, blijft historie", async () => {
    const key = "sync:test-conn-1";
    const before = await getUnreadCount(TEST_ID);
    assert(before >= 1, "open melding telt niet mee vooraf");
    await resolveNotifications(TEST_ID, key);
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          eq(notificationsTable.resolutionKey, key),
        ),
      );
    assert(rows.length === 1 && rows[0]!.resolvedAt != null, "rij weg of niet opgelost");
    const after = await getUnreadCount(TEST_ID);
    assert(after === before - 1, `teller ${before}→${after}, verwacht -1`);
    // Na oplossen mag dezelfde situatie WEER een melding maken (nieuwe storing).
    await createNotification({
      clerkId: TEST_ID,
      type: "sync_error",
      title: "Synchronisatie hapert opnieuw",
      resolutionKey: key,
    });
    const again = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          eq(notificationsTable.resolutionKey, key),
        ),
      );
    assert(again.length === 2, "nieuwe storing na oplossen maakt geen nieuwe melding");
  });

  await scenario("verlopen meldingen tellen niet mee", async () => {
    const before = await getUnreadCount(TEST_ID);
    await createNotification({
      clerkId: TEST_ID,
      type: "access_changed",
      title: "Al verlopen",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const after = await getUnreadCount(TEST_ID);
    assert(after === before, `verlopen rij telde mee (${before}→${after})`);
    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          like(notificationsTable.title, "Al verlopen%"),
        ),
      );
    assert(row != null, "verlopen rij hoort wél in de historie te bestaan");
  });

  await scenario("dedupeKey: zelfde gebeurtenis maakt nooit een tweede rij", async () => {
    const dk = "test:attn:dedupe:1";
    await createNotification({
      clerkId: TEST_ID,
      type: "system",
      title: "Eén keer",
      dedupeKey: dk,
    });
    await createNotification({
      clerkId: TEST_ID,
      type: "system",
      title: "Eén keer (dubbel)",
      dedupeKey: dk,
    });
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          eq(notificationsTable.dedupeKey, dk),
        ),
      );
    assert(rows.length === 1, `verwacht 1 rij, kreeg ${rows.length}`);
  });

  await scenario("resolutionKey race-veilig: gelijktijdige schrijvers ⇒ één open rij", async () => {
    const key = "sync:test-race";
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createNotification({
          clerkId: TEST_ID,
          type: "sync_error",
          title: `Race ${i}`,
          resolutionKey: key,
        }),
      ),
    );
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          eq(notificationsTable.resolutionKey, key),
        ),
      );
    assert(rows.length === 1, `verwacht 1 open rij, kreeg ${rows.length}`);
  });

  await scenario("PUT voorkeuren: half stille-urenvenster wordt geweigerd (samengevoegd)", async () => {
    const base = "http://localhost:8080/api/notifications/preferences";
    const put = (body: unknown) =>
      fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    // Lees huidige waarden zodat we ze kunnen terugzetten.
    const before = (await (await fetch(base)).json()) as {
      preferences: { quietHoursStart: string | null; quietHoursEnd: string | null };
    };
    try {
      const setBoth = await put({ quietHoursStart: "22:00", quietHoursEnd: "07:00" });
      assert(setBoth.status === 200, `venster zetten faalde (${setBoth.status})`);
      // Eén kant leegmaken terwijl de andere gezet blijft ⇒ 400 (samengevoegde check).
      const half = await put({ quietHoursStart: null });
      assert(half.status === 400, `half venster kreeg ${half.status}, verwacht 400`);
      // Eén kant zetten zonder de ander vanuit een leeg venster ⇒ eerst leegmaken…
      const clear = await put({ quietHoursStart: null, quietHoursEnd: null });
      assert(clear.status === 200, "venster leegmaken faalde");
      const oneSide = await put({ quietHoursEnd: "07:00" });
      assert(oneSide.status === 400, `eenzijdig venster kreeg ${oneSide.status}, verwacht 400`);
    } finally {
      await put({
        quietHoursStart: before.preferences.quietHoursStart,
        quietHoursEnd: before.preferences.quietHoursEnd,
      });
    }
  });

  await cleanup();

  // ── Rapport ────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("attention-notifications test crashte:", err);
  process.exit(1);
});
