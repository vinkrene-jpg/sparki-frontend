// Sparki World — Media Engine test.
//
// Proves the engine's reason to exist: AGGRESSIVE REUSE. Pure tests check the
// deterministic key (order-independent; avatars carry identity, scenes don't)
// and that prompts are real photographic text. A DB-backed section uses STUB
// generate/upload deps (no real image model is ever called) to prove that a
// second request with the same key does NOT generate again, that reuseCount
// climbs, and that a generation failure is recorded honestly with a null path.
//
// Run: `pnpm --filter @workspace/api-server run test:world-media`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { db, pool, virtualMediaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  buildPromptKey,
  buildPrompt,
  resolveMedia,
  mediaUrl,
  type MediaDeps,
} from "../engines/world-media";

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

async function scenarioAsync(name: string, fn: () => Promise<void>) {
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

// ── pure: key determinism ─────────────────────────────────────────────────────
scenario("promptKey is order-independent", () => {
  const a = buildPromptKey("scene", {
    discipline: "gravel",
    weather: "rain",
    scene: "climb",
  });
  const b = buildPromptKey("scene", {
    scene: "climb",
    weather: "rain",
    discipline: "gravel",
  });
  assert(a === b, "same attrs in different order must give same key");
});

scenario("promptKey ignores empty/undefined attrs", () => {
  const a = buildPromptKey("scene", { discipline: "weg", weather: "" });
  const b = buildPromptKey("scene", {
    discipline: "weg",
    weather: undefined,
    timeOfDay: null,
  });
  assert(a === b, "blank values must not affect the key");
});

scenario("avatar key carries identity, scene key does not", () => {
  const av1 = buildPromptKey("avatar", { slug: "lotte", gender: "v" });
  const av2 = buildPromptKey("avatar", { slug: "sanne", gender: "v" });
  assert(av1 !== av2, "different athletes must get different avatar keys");
  const sc1 = buildPromptKey("scene", { discipline: "weg", scene: "climb" });
  const sc2 = buildPromptKey("scene", { discipline: "weg", scene: "climb" });
  assert(sc1 === sc2, "equivalent scenes must share one key (reuse)");
});

scenario("prompt is realistic photographic text", () => {
  const p = buildPrompt("scene", {
    discipline: "gravel",
    scene: "gravel_forest",
    weather: "fog",
  });
  assert(/photorealistic/i.test(p), "scene prompt must ask for photorealism");
  assert(!/cartoon|illustration/i.test(p), "must not request cartoon style");
  const a = buildPrompt("avatar", { gender: "v", age: 24 });
  assert(/fictional/i.test(a), "avatar prompt must mark the person fictional");
});

scenario("mediaUrl is null-safe and prefixes the serve route", () => {
  assert(mediaUrl(null) === null, "null path stays null");
  assert(
    mediaUrl("/objects/uploads/x") === "/api/storage/objects/uploads/x",
    "objectPath must map to the serve route",
  );
});

// ── DB-backed: cache-first behaviour with stubbed generation ──────────────────
async function main() {
  const tag = `__test__${Date.now()}`;
  const cleanupKeys: string[] = [];

  await scenarioAsync(
    "second request with same key does NOT generate again",
    async () => {
      let generateCalls = 0;
      let uploadCalls = 0;
      const deps: MediaDeps = {
        generate: async () => {
          generateCalls += 1;
          return { b64_json: "ZmFrZQ==", mimeType: "image/png" };
        },
        upload: async () => {
          uploadCalls += 1;
          return `/objects/uploads/${tag}`;
        },
      };
      const attrs = { discipline: "weg", scene: "climb", tag };
      const first = await resolveMedia(
        { purpose: "scene", attributes: attrs },
        deps,
      );
      cleanupKeys.push(first.promptKey);
      const second = await resolveMedia(
        { purpose: "scene", attributes: attrs },
        deps,
      );
      assert(generateCalls === 1, `generate ran ${generateCalls}× (want 1)`);
      assert(uploadCalls === 1, `upload ran ${uploadCalls}× (want 1)`);
      assert(first.status === "ready", "first must be ready");
      assert(second.id === first.id, "second must reuse the same row");
      assert(
        second.reuseCount > first.reuseCount,
        "reuseCount must climb on a cache hit",
      );
    },
  );

  await scenarioAsync("generation failure is honest (null path)", async () => {
    const deps: MediaDeps = {
      generate: async () => {
        throw new Error("model onbereikbaar");
      },
    };
    const attrs = { discipline: "mtb", scene: "podium", tag };
    const row = await resolveMedia(
      { purpose: "scene", attributes: attrs },
      deps,
    );
    cleanupKeys.push(row.promptKey);
    assert(row.status === "failed", "must record a failed status");
    assert(row.objectPath === null, "failed media must have no object path");
    assert(
      !!row.failureReason && /onbereikbaar/.test(row.failureReason),
      "must keep an honest failure reason",
    );
  });

  // cleanup disposable rows
  for (const key of cleanupKeys) {
    await db.delete(virtualMediaTable).where(eq(virtualMediaTable.promptKey, key));
  }

  const failed = results.filter((r) => r.status === "fail");
  console.log("\nSparki World — Media Engine test\n");
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`  ${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} passed\n`,
  );
  await pool.end();
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
