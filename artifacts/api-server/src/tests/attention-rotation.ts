// Aandacht-rotatie — DB-backed contract test.
//
// Regels onder test (src/lib/attention-rotation.ts):
// - recordImpression is idempotent per Amsterdamse kalenderdag (dubbele
//   aanroepen op één dag tellen als één dag).
// - Na ATTENTION_SHOW_DAYS verschillende dagen gaat een item in pauze:
//   snoozedUntil = laatst-getoonde-dag + ATTENTION_PAUSE_DAYS, dagenteller
//   reset naar 0, timesSnoozed telt op.
// - getSuppressedKeys onderdrukt alleen zolang snoozedUntil ná vandaag ligt;
//   op de snoozedUntil-dag zelf mag het item weer terug (nooit voorgoed weg).
// - Tijdens de pauze is recordImpression een no-op (teller loopt niet door).
// - isValidAttentionKey accepteert alleen niet-kritieke families en weigert
//   vastgesteld defect / veiligheid / privacy.
//
// Run: `pnpm --filter @workspace/api-server run test:attention-rotation`
// Requires: DATABASE_URL. Exits non-zero on any failure. Each run uses a unique
// clerkId and cleans up its seeded rows, so it is safe against a shared DB.

import {
  db,
  pool,
  attentionImpressionsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  ATTENTION_PAUSE_DAYS,
  ATTENTION_SHOW_DAYS,
  addDays,
  amsterdamToday,
  getSuppressedKeys,
  isValidAttentionKey,
  recordImpression,
} from "../lib/attention-rotation";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
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

const RUN = `test_attention_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}

async function getRow(clerkId: string, itemKey: string) {
  const rows = await db
    .select()
    .from(attentionImpressionsTable)
    .where(
      and(
        eq(attentionImpressionsTable.clerkId, clerkId),
        eq(attentionImpressionsTable.itemKey, itemKey),
      ),
    );
  return rows[0] ?? null;
}

async function cleanup() {
  if (ids.length === 0) return;
  await db
    .delete(attentionImpressionsTable)
    .where(inArray(attentionImpressionsTable.clerkId, ids));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  // Vaste, DST-neutrale testdagen (de motor werkt op YYYY-MM-DD strings).
  const d1 = "2026-07-01";
  const d2 = "2026-07-02";
  const d3 = "2026-07-03";

  // 1. Idempotent per dag: twee meldingen op dezelfde dag tellen als één.
  await scenario("dubbele melding op één dag telt als één dag", async () => {
    const id = newId("idem");
    await ensureAccount(id, `${id}@example.test`, "Idem", silentLogger);
    const key = "nudge:materiaal:ketting:1";
    await recordImpression(id, key, d1);
    await recordImpression(id, key, d1);
    const row = await getRow(id, key);
    assert(row, "rij ontbreekt na eerste melding");
    assert(row!.daysSeen === 1, `daysSeen ${row!.daysSeen}, verwacht 1`);
    assert(row!.firstSeenOn === d1 && row!.lastSeenOn === d1, "dagen kloppen niet");
    assert(row!.snoozedUntil === null, "mag nog niet pauzeren");
  });

  // 2. Volledige cyclus: 3 dagen tonen → pauze van PAUSE_DAYS, teller reset.
  await scenario(
    `na ${ATTENTION_SHOW_DAYS} dagen → pauze tot dag+${ATTENTION_PAUSE_DAYS}, teller reset`,
    async () => {
      const id = newId("cycle");
      await ensureAccount(id, `${id}@example.test`, "Cycle", silentLogger);
      const key = "nudge:materiaal:ketting:2";
      await recordImpression(id, key, d1);
      await recordImpression(id, key, d2);
      let row = await getRow(id, key);
      assert(row!.daysSeen === 2, `dag 2: daysSeen ${row!.daysSeen}, verwacht 2`);
      assert(row!.snoozedUntil === null, "dag 2: mag nog niet pauzeren");

      await recordImpression(id, key, d3);
      row = await getRow(id, key);
      const expectedSnooze = addDays(d3, ATTENTION_PAUSE_DAYS);
      assert(row!.daysSeen === 0, `na pauze: daysSeen ${row!.daysSeen}, verwacht 0`);
      assert(
        row!.snoozedUntil === expectedSnooze,
        `snoozedUntil ${row!.snoozedUntil}, verwacht ${expectedSnooze}`,
      );
      assert(row!.timesSnoozed === 1, `timesSnoozed ${row!.timesSnoozed}, verwacht 1`);
    },
  );

  // 3. Onderdrukking: tijdens de pauze onderdrukt, op de pauze-einddag weer vrij.
  await scenario("onderdrukt tijdens pauze, weer vrij op de einddag", async () => {
    const id = newId("supp");
    await ensureAccount(id, `${id}@example.test`, "Supp", silentLogger);
    const key = "release:99";
    for (const day of [d1, d2, d3]) await recordImpression(id, key, day);
    const snoozeEnd = addDays(d3, ATTENTION_PAUSE_DAYS);

    const during = await getSuppressedKeys(id, addDays(d3, 1));
    assert(during.includes(key), "moet onderdrukt zijn dag na pauzestart");
    const lastPausedDay = addDays(snoozeEnd, -1);
    const nearEnd = await getSuppressedKeys(id, lastPausedDay);
    assert(nearEnd.includes(key), "moet onderdrukt zijn op laatste pauzedag");
    const atEnd = await getSuppressedKeys(id, snoozeEnd);
    assert(!atEnd.includes(key), "moet weer vrij zijn op de pauze-einddag");
  });

  // 4. Tijdens de pauze is een melding een no-op (teller loopt niet door).
  await scenario("melding tijdens pauze verandert niets", async () => {
    const id = newId("noop");
    await ensureAccount(id, `${id}@example.test`, "Noop", silentLogger);
    const key = "onderhoud:controleadvies:7";
    for (const day of [d1, d2, d3]) await recordImpression(id, key, day);
    const before = await getRow(id, key);

    await recordImpression(id, key, addDays(d3, 1));
    const after = await getRow(id, key);
    assert(after!.daysSeen === before!.daysSeen, "daysSeen mag niet wijzigen in pauze");
    assert(after!.lastSeenOn === before!.lastSeenOn, "lastSeenOn mag niet wijzigen in pauze");
    assert(
      after!.snoozedUntil === before!.snoozedUntil,
      "snoozedUntil mag niet wijzigen in pauze",
    );
  });

  // 5. Na de pauze begint een verse cyclus (dag 1 van opnieuw SHOW_DAYS).
  await scenario("na de pauze start een verse cyclus", async () => {
    const id = newId("fresh");
    await ensureAccount(id, `${id}@example.test`, "Fresh", silentLogger);
    const key = "nudge:profielvraag:doel";
    for (const day of [d1, d2, d3]) await recordImpression(id, key, day);
    const snoozeEnd = addDays(d3, ATTENTION_PAUSE_DAYS);

    await recordImpression(id, key, snoozeEnd);
    const row = await getRow(id, key);
    assert(row!.daysSeen === 1, `verse cyclus: daysSeen ${row!.daysSeen}, verwacht 1`);
    assert(row!.lastSeenOn === snoozeEnd, "lastSeenOn moet de einddag zijn");
    assert(row!.timesSnoozed === 1, "timesSnoozed blijft 1 tot de volgende pauze");
  });

  // 6. Twee gebruikers en twee sleutels blijven strikt gescheiden.
  await scenario("isolatie per gebruiker en per sleutel", async () => {
    const a = newId("isoA");
    const b = newId("isoB");
    await ensureAccount(a, `${a}@example.test`, "IsoA", silentLogger);
    await ensureAccount(b, `${b}@example.test`, "IsoB", silentLogger);
    const key = "nudge:herinnering:5";
    for (const day of [d1, d2, d3]) await recordImpression(a, key, day);
    await recordImpression(b, key, d1);

    const aSupp = await getSuppressedKeys(a, addDays(d3, 1));
    const bSupp = await getSuppressedKeys(b, addDays(d3, 1));
    assert(aSupp.includes(key), "A moet onderdrukt zijn");
    assert(!bSupp.includes(key), "B mag niet meeliften op A's pauze");

    const otherKey = "nudge:herinnering:6";
    await recordImpression(a, otherKey, d1);
    const aSupp2 = await getSuppressedKeys(a, addDays(d3, 1));
    assert(!aSupp2.includes(otherKey), "andere sleutel mag niet onderdrukt zijn");
  });

  // 7. Sleutelvalidatie: alleen niet-kritieke families, kritiek altijd geweigerd.
  await scenario("sleutelvalidatie weigert kritieke families", async () => {
    assert(isValidAttentionKey("nudge:materiaal:ketting:123"), "materiaal moet mogen");
    assert(isValidAttentionKey("release:45"), "release moet mogen");
    assert(
      isValidAttentionKey("onderhoud:controleadvies:12"),
      "controleadvies moet mogen",
    );
    assert(
      isValidAttentionKey("onderhoud:vermoedelijke_slijtage:fiets-3"),
      "vermoedelijke slijtage moet mogen",
    );
    assert(
      !isValidAttentionKey("onderhoud:vastgesteld_defect:12"),
      "vastgesteld defect mag NOOIT rouleren",
    );
    assert(!isValidAttentionKey("gezondheid:status"), "gezondheid mag niet");
    assert(!isValidAttentionKey("nudge:veiligheid:x"), "veiligheid mag niet");
    assert(!isValidAttentionKey("release:privacy-1"), "privacy mag niet");
    assert(!isValidAttentionKey(""), "lege sleutel mag niet");
    assert(!isValidAttentionKey("x".repeat(200)), "te lange sleutel mag niet");
    assert(!isValidAttentionKey(42 as unknown), "niet-string mag niet");
  });

  // 8. Datumhulpen: Amsterdamse dag is ISO-gevormd, optellen is DST-veilig.
  await scenario("datumhulpen: vorm en optellen kloppen", async () => {
    const today = amsterdamToday();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(today), `vandaag '${today}' is geen YYYY-MM-DD`);
    assert(addDays("2026-03-28", 3) === "2026-03-31", "optellen over DST-overgang");
    assert(addDays("2026-12-30", 4) === "2027-01-03", "optellen over jaargrens");
  });
}

async function shutdown(code: number) {
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== aandacht-rotatie — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} passed.\n`,
    );
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
