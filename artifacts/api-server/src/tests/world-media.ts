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
  buildVideoPrompt,
  resolveMedia,
  mediaUrl,
  highlightKeyFor,
  getOrCreateHighlight,
  readyHighlightUrls,
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

scenario("video prompt is realistic, loop-friendly and fictional", () => {
  const p = buildVideoPrompt("highlight", { discipline: "weg", scene: "climb" });
  assert(/clip/i.test(p), "must describe a video clip");
  assert(/loop/i.test(p), "highlight clip must be loop-friendly");
  assert(/fictional/i.test(p), "must mark the cyclist as fictional");
  assert(!/cartoon|illustration/i.test(p), "must not request cartoon style");
});

scenario("highlight key carries athlete identity", () => {
  const a = highlightKeyFor({ slug: "lotte", discipline: "weg", archetype: "klimmer" });
  const b = highlightKeyFor({ slug: "sanne", discipline: "weg", archetype: "klimmer" });
  assert(a !== b, "different athletes must get different highlight keys");
  assert(/^highlight\|/.test(a), "key must be scoped to the highlight purpose");
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

  await scenarioAsync(
    "highlight clip is stored as a video and reused on a cache hit",
    async () => {
      let generateCalls = 0;
      const deps: MediaDeps = {
        generate: async () => {
          generateCalls += 1;
          return { b64_json: "ZmFrZQ==", mimeType: "video/mp4" };
        },
        upload: async () => `/objects/uploads/${tag}-clip`,
      };
      const athlete = { slug: `${tag}-hero`, discipline: "weg", archetype: "klimmer" };
      const first = await getOrCreateHighlight(athlete, deps);
      cleanupKeys.push(first.promptKey);
      const second = await getOrCreateHighlight(athlete, deps);
      assert(generateCalls === 1, `generate ran ${generateCalls}× (want 1)`);
      assert(first.kind === "video", "highlight must persist as a video");
      assert(first.purpose === "highlight", "purpose must be highlight");
      assert(first.status === "ready", "first must be ready");
      assert(second.id === first.id, "second must reuse the same row");

      // A ready highlight is surfaced by the slug→url lookup …
      const ready = await readyHighlightUrls([athlete]);
      assert(
        ready.get(athlete.slug) === "/api/storage/objects/uploads/" + tag + "-clip",
        "ready highlight must be returned with its serve URL",
      );
      // … and an athlete without a clip is simply omitted (graceful fallback).
      const none = await readyHighlightUrls([{ slug: `${tag}-nobody` }]);
      assert(none.size === 0, "athletes without a clip must be omitted, never faked");
    },
  );

  await scenarioAsync("highlight generation failure is honest", async () => {
    const deps: MediaDeps = {
      generate: async () => {
        throw new Error("video onbereikbaar");
      },
    };
    const athlete = { slug: `${tag}-broke`, discipline: "mtb", archetype: "klimmer" };
    const row = await getOrCreateHighlight(athlete, deps);
    cleanupKeys.push(row.promptKey);
    assert(row.status === "failed", "must record a failed status");
    assert(row.objectPath === null, "failed clip must have no object path");
    const ready = await readyHighlightUrls([athlete]);
    assert(ready.size === 0, "a failed clip must not surface as ready");
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
