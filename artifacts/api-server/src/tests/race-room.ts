// Wedstrijd-room engine test.
//
// Exercises the deterministic, IO-free parts of the compilation engine: the
// music registry + auto-pick, and the honest-"empty" grouping path (a day with
// no usable visual media must return { status: "empty" } BEFORE any ffmpeg or
// storage IO — never a fabricated result). The full ffmpeg render was de-risked
// separately and depends on object storage, so it is intentionally out of scope
// here.
//
// Run: `pnpm --filter @workspace/api-server run test:race-room`
// Requires: nothing (no DB, no storage, no ffmpeg). Exits non-zero on failure.

import {
  compileDay,
  MUSIC_TRACKS,
  isMusicKey,
  autoPickMusic,
  type CompileItem,
} from "../engines/race-room";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
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

async function main() {
  // ── Music registry ─────────────────────────────────────────────────────────
  await scenario("music registry is non-empty with unique keys", () => {
    assert(MUSIC_TRACKS.length > 0, "expected at least one music bed");
    const keys = new Set(MUSIC_TRACKS.map((t) => t.key));
    assert(keys.size === MUSIC_TRACKS.length, "music keys must be unique");
    for (const t of MUSIC_TRACKS) {
      assert(t.label.trim().length > 0, `track ${t.key} needs a label`);
      assert(t.description.trim().length > 0, `track ${t.key} needs a description`);
    }
  });

  await scenario("isMusicKey accepts real keys, rejects junk", () => {
    assert(isMusicKey(MUSIC_TRACKS[0]!.key), "first track key should validate");
    assert(!isMusicKey("nope"), "unknown key should be rejected");
    assert(!isMusicKey(""), "empty string should be rejected");
    assert(!isMusicKey(null), "null should be rejected");
    assert(!isMusicKey(42), "number should be rejected");
  });

  await scenario("autoPickMusic is deterministic and in-range", () => {
    for (const seed of [0, 1, 7, 99, -3, 1000]) {
      const a = autoPickMusic(seed);
      const b = autoPickMusic(seed);
      assert(a === b, `auto-pick must be stable for seed ${seed}`);
      assert(isMusicKey(a), `auto-pick must return a real key for seed ${seed}`);
    }
  });

  // ── Honest-empty grouping path (no IO) ──────────────────────────────────────
  await scenario("no items at all → empty", async () => {
    const res = await compileDay({
      ownerClerkId: "test_rr_user",
      roomTitle: "Test",
      dayIndex: 0,
      items: [],
    });
    assert(res.status === "empty", `expected empty, got ${res.status}`);
  });

  await scenario("only text updates (no media) → empty", async () => {
    const items: CompileItem[] = [
      { kind: "update", text: "Mooie warming-up gehad" },
      { kind: "update", text: "Klaar voor de start" },
    ];
    const res = await compileDay({
      ownerClerkId: "test_rr_user",
      roomTitle: "Test",
      dayIndex: 1,
      items,
    });
    assert(res.status === "empty", `expected empty, got ${res.status}`);
    if (res.status === "empty") {
      assert(res.reason.trim().length > 0, "empty result must carry a reason");
    }
  });

  await scenario("media without object path or wrong type → empty", async () => {
    const items: CompileItem[] = [
      { kind: "media", objectPath: null, mediaType: "image/jpeg" },
      { kind: "media", objectPath: "/objects/x", mediaType: "application/pdf" },
    ];
    const res = await compileDay({
      ownerClerkId: "test_rr_user",
      roomTitle: "Test",
      dayIndex: 0,
      items,
    });
    assert(res.status === "empty", `expected empty, got ${res.status}`);
  });

  // ── Report ──────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    const tag = r.status === "pass" ? "PASS" : "FAIL";
    console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(
    `\nrace-room: ${results.length - failed.length}/${results.length} passed`,
  );
  if (failed.length > 0) process.exit(1);
}

void main();
