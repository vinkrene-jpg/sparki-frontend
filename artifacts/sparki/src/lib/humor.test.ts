// Tests voor de centrale humorlaag (pure functies — geen DOM/localStorage).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HUMOR_LEVELS,
  HUMOR_LEVEL_LABELS,
  HUMOR_LEVEL_BLURBS,
  poolFor,
  pickHumorLine,
  type HumorContext,
  type HumorLevel,
} from "./humor";

const CONTEXTS: HumorContext[] = [
  "empty_feed",
  "empty_social",
  "empty_routes",
  "empty_garage",
  "empty_training",
  "success_save",
  "training_done",
  "loading",
  "recovery_day",
  "route_planning",
  "maintenance_check",
  "profile",
  "onboarding_light",
  "notification_minor",
];

test("niveau 'uit' geeft altijd een lege pool en null", () => {
  for (const ctx of CONTEXTS) {
    assert.equal(poolFor(ctx, "uit").length, 0);
    assert.equal(pickHumorLine(ctx, "uit", 0), null);
  }
});

test("pools zijn cumulatief: subtiel ⊂ normaal ⊂ uitgesproken", () => {
  for (const ctx of CONTEXTS) {
    const s = poolFor(ctx, "subtiel");
    const n = poolFor(ctx, "normaal");
    const u = poolFor(ctx, "uitgesproken");
    assert.ok(s.length >= 1, `${ctx}: subtiel heeft minstens één regel`);
    assert.ok(n.length > s.length, `${ctx}: normaal > subtiel`);
    assert.ok(u.length > n.length, `${ctx}: uitgesproken > normaal`);
    for (const line of s) assert.ok(n.includes(line));
    for (const line of n) assert.ok(u.includes(line));
  }
});

test("elke regel is niet-lege tekst zonder emoji-regen", () => {
  for (const ctx of CONTEXTS) {
    for (const line of poolFor(ctx, "uitgesproken")) {
      assert.ok(line.trim().length > 4, `${ctx}: regel te kort: "${line}"`);
      assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(line), `${ctx}: emoji in "${line}"`);
    }
  }
});

test("pickHumorLine kiest deterministisch op seed en roteert", () => {
  const pool = poolFor("loading", "uitgesproken");
  const seen = new Set<string>();
  for (let seed = 0; seed < pool.length; seed++) {
    const line = pickHumorLine("loading", "uitgesproken", seed);
    assert.ok(line && pool.includes(line));
    seen.add(line);
  }
  assert.equal(seen.size, pool.length, "alle seeds samen dekken de hele pool");
  assert.equal(
    pickHumorLine("loading", "normaal", 7),
    pickHumorLine("loading", "normaal", 7),
    "zelfde seed ⇒ zelfde regel",
  );
});

test("anti-herhaling: recent getoonde regels worden gemeden", () => {
  const pool = poolFor("empty_feed", "uitgesproken");
  const first = pickHumorLine("empty_feed", "uitgesproken", 3)!;
  const second = pickHumorLine("empty_feed", "uitgesproken", 3, [first]);
  assert.ok(second && second !== first, "recente regel wordt overgeslagen");
  // Alles recent ⇒ minst recent gebruikte komt terug (nooit null bij niet-lege pool).
  const all = pickHumorLine("empty_feed", "uitgesproken", 3, pool);
  assert.ok(all && pool.includes(all));
  assert.equal(all, pool.find((l) => pool.indexOf(l) === 0));
});

test("labels en toelichtingen bestaan voor elk niveau", () => {
  for (const level of HUMOR_LEVELS) {
    assert.ok(HUMOR_LEVEL_LABELS[level as HumorLevel].length > 0);
    assert.ok(HUMOR_LEVEL_BLURBS[level as HumorLevel].length > 0);
  }
});
