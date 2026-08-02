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

import {
  db,
  pool,
  virtualMediaTable,
  filesTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import type { AddressInfo } from "node:net";
import app from "../app";
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
import { revokeFile } from "../lib/files";

process.env["DEV_AUTH_BYPASS"] = "true";

// Echte, geldige 8×8 PNG (her-encodeerbaar door sharp) — gaat door de centrale
// her-encode-poort. Zelfde vaste bytes als de f11-files-test.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPgqjiBFTEMLQkADShSgdHoYMoAAAAASUVORK5CYII=";
// Een tweede, ANDERE geldige PNG (16×16 effen groen). Aparte bytes ⇒ ander
// object ⇒ intrekken raakt geen gedeeld object (dedupe-veilig in de revoke-test).
const PNG_ALT =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVQokWPgOqFBEmIY1XBiNJS4hmvSAADLcvoB1eeAlAAAAABJRU5ErkJggg==";

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
  // Centrale files-rijen die de tests aanmaken en aan het eind opruimen. Vroeg
  // gedeclareerd zodat ook de highlight-test (die centraal registreert) hem kan
  // vullen zonder in een temporal-dead-zone te lopen.
  const createdFileIds: number[] = [];

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
      // Echte centrale registratie (video → raw publiek object + files-rij), zodat
      // de rij een geldige centrale koppeling heeft. Onder de fail-closed regel
      // wordt alleen een centraal gekoppelde clip via de serve-URL gepubliceerd.
      const deps: MediaDeps = {
        generate: async () => {
          generateCalls += 1;
          return { b64_json: "ZmFrZQ==", mimeType: "video/mp4" };
        },
      };
      const athlete = { slug: `${tag}-hero`, discipline: "weg", archetype: "klimmer" };
      const first = await getOrCreateHighlight(athlete, deps);
      cleanupKeys.push(first.promptKey);
      if (first.fileId != null) createdFileIds.push(first.fileId);
      const second = await getOrCreateHighlight(athlete, deps);
      assert(generateCalls === 1, `generate ran ${generateCalls}× (want 1)`);
      assert(first.kind === "video", "highlight must persist as a video");
      assert(first.purpose === "highlight", "purpose must be highlight");
      assert(first.status === "ready", "first must be ready");
      assert(first.fileId != null, "highlight moet centraal gekoppeld zijn (fileId)");
      assert(second.id === first.id, "second must reuse the same row");

      // A ready highlight is surfaced by the slug→url lookup …
      const ready = await readyHighlightUrls([athlete]);
      assert(
        ready.get(athlete.slug) === mediaUrl(first.objectPath),
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

  // ── F11-01: omlegging naar de centrale bestandslaag ─────────────────────────
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  // Elke ingelogde gebruiker mag world-media lezen. De dev-auth-bypass eist een
  // bestaand profiel; kies een willekeurige bestaande gebruiker (NIET de
  // systeem-eigenaar) als viewer, zodat we bewijzen dat een GEWONE gebruiker de
  // publieke world-media mag ophalen.
  const [viewer] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .where(ne(userProfilesTable.clerkId, "sparki-world"))
    .limit(1);
  const authHeaders: Record<string, string> = viewer
    ? { "x-dev-clerk-id": viewer.clerkId }
    : {};

  await scenarioAsync(
    "gegenereerde world-media wordt centraal geregistreerd (fileId + publiek serve-pad)",
    async () => {
      // Echte centrale registratie (GEEN stub-upload): de bytes gaan door de
      // centrale poort en krijgen een files-rij + publieke ACL.
      const deps: MediaDeps = {
        generate: async () => ({ b64_json: PNG_1x1, mimeType: "image/png" }),
      };
      const attrs = { discipline: "weg", scene: "climb", tag: `${tag}-central` };
      const row = await resolveMedia({ purpose: "scene", attributes: attrs }, deps);
      cleanupKeys.push(row.promptKey);
      assert(row.status === "ready", `moet ready zijn (reden: ${row.failureReason})`);
      assert(row.objectPath != null, "moet een objectPath hebben");
      assert(row.fileId != null, "moet gekoppeld zijn aan een centrale files-rij");
      createdFileIds.push(row.fileId!);

      // De files-rij is systeem-eigen, publiek en heeft de world_media-categorie.
      const [file] = await db
        .select()
        .from(filesTable)
        .where(eq(filesTable.id, row.fileId!));
      assert(!!file, "centrale files-rij moet bestaan");
      assert(file!.ownerClerkId === "sparki-world", "systeem-eigenaar");
      assert(file!.visibility === "public", "world-media is publiek");
      assert(file!.retentionCategory === "world_media", "world_media-retentie");
      assert(file!.objectPath === row.objectPath, "objectPath verwijst naar files-rij");

      // Elke ingelogde gebruiker mag de bytes lezen via het centrale serve-pad.
      const url = mediaUrl(row.objectPath)!;
      const res = await fetch(`${base}${url}`, { headers: authHeaders });
      assert(res.status === 200, `publiek serve-pad moet 200 geven (kreeg ${res.status})`);
      assert(
        res.headers.get("x-content-type-options") === "nosniff",
        "serve-pad moet nosniff zetten",
      );
    },
  );

  await scenarioAsync(
    "een ingetrokken world-media valt fail-closed dicht (410), ook via de oude link",
    async () => {
      const deps: MediaDeps = {
        generate: async () => ({ b64_json: PNG_ALT, mimeType: "image/png" }),
      };
      const attrs = { discipline: "mtb", scene: "podium", tag: `${tag}-revoke` };
      const row = await resolveMedia({ purpose: "scene", attributes: attrs }, deps);
      cleanupKeys.push(row.promptKey);
      assert(row.fileId != null, "moet gekoppeld zijn");
      createdFileIds.push(row.fileId!);
      const url = mediaUrl(row.objectPath)!;

      const before = await fetch(`${base}${url}`, { headers: authHeaders });
      assert(before.status === 200, "vóór intrekken 200");
      await revokeFile(row.fileId!, "sparki-world");
      const after = await fetch(`${base}${url}`, { headers: authHeaders });
      assert(
        after.status === 410,
        `na intrekken moet de oude link 410 geven (kreeg ${after.status})`,
      );
    },
  );

  await scenarioAsync(
    "bestaande rij zonder fileId wordt lui centraal gekoppeld bij de eerstvolgende serve",
    async () => {
      // Simuleer een rij van vóór de omlegging: registreer bytes centraal (om een
      // echt, publiek object te hebben), maak dan een virtual_media-rij die dat
      // object gebruikt maar GEEN fileId heeft.
      const deps: MediaDeps = {
        generate: async () => ({ b64_json: PNG_1x1, mimeType: "image/png" }),
      };
      const seed = await resolveMedia(
        { purpose: "scene", attributes: { discipline: "weg", tag: `${tag}-seed` } },
        deps,
      );
      cleanupKeys.push(seed.promptKey);
      if (seed.fileId != null) createdFileIds.push(seed.fileId);

      const legacyKey = `scene|legacy=${tag}`;
      await db.delete(virtualMediaTable).where(eq(virtualMediaTable.promptKey, legacyKey));
      const [legacy] = await db
        .insert(virtualMediaTable)
        .values({
          kind: "image",
          purpose: "scene",
          promptKey: legacyKey,
          prompt: "legacy",
          objectPath: seed.objectPath, // bestaand publiek object
          fileId: null, // nog niet gekoppeld (oude rij)
          aspectRatio: "1:1",
          status: "ready",
          reuseCount: 0,
        })
        .returning();
      cleanupKeys.push(legacyKey);
      assert(legacy!.fileId === null, "start zonder fileId (oude rij)");

      // De eerstvolgende resolve (cache-hit) koppelt hem lui centraal.
      const resolved = await resolveMedia(
        { purpose: "scene", attributes: { legacy: tag } },
        deps,
      );
      assert(
        resolved.fileId != null,
        "oude rij moet na de serve een centrale fileId hebben",
      );
      createdFileIds.push(resolved.fileId!);
    },
  );

  await scenarioAsync(
    "twee gelijktijdige lazy-koppelingen laten exact één files-rij en één fileId achter",
    async () => {
      // Seed een echt publiek object (om vanaf te koppelen).
      const deps: MediaDeps = {
        generate: async () => ({ b64_json: PNG_ALT, mimeType: "image/png" }),
      };
      const seed = await resolveMedia(
        { purpose: "scene", attributes: { discipline: "mtb", tag: `${tag}-race-seed` } },
        deps,
      );
      cleanupKeys.push(seed.promptKey);
      if (seed.fileId != null) createdFileIds.push(seed.fileId);
      assert(seed.objectPath != null, "seed moet een object hebben");

      // Maak een 'oude' rij zonder fileId die dat object gebruikt.
      const raceKey = `scene|race=${tag}`;
      await db.delete(virtualMediaTable).where(eq(virtualMediaTable.promptKey, raceKey));
      await db
        .insert(virtualMediaTable)
        .values({
          kind: "image",
          purpose: "scene",
          promptKey: raceKey,
          prompt: "race",
          objectPath: seed.objectPath,
          fileId: null,
          aspectRatio: "1:1",
          status: "ready",
          reuseCount: 0,
        })
        .returning();
      cleanupKeys.push(raceKey);

      // Tel de files-rijen vóór de race die naar dit object wijzen.
      const before = await db
        .select({ id: filesTable.id })
        .from(filesTable)
        .where(eq(filesTable.objectPath, seed.objectPath!));
      const beforeIds = new Set(before.map((f) => f.id));

      // TWEE parallelle cache-hit resolves op dezelfde rij ⇒ twee parallelle
      // ensureCentralLink-paden. Exact één mag de claim winnen.
      const [a, b] = await Promise.all([
        resolveMedia({ purpose: "scene", attributes: { race: tag } }, deps),
        resolveMedia({ purpose: "scene", attributes: { race: tag } }, deps),
      ]);
      assert(a.fileId != null && b.fileId != null, "beide resolves moeten gekoppeld zijn");
      assert(a.fileId === b.fileId, "beide moeten NAAR DEZELFDE fileId wijzen (één winnaar)");
      createdFileIds.push(a.fileId!);

      // Precies één NIEUWE files-rij mag zijn overgebleven (de wees is opgeruimd).
      const after = await db
        .select({ id: filesTable.id })
        .from(filesTable)
        .where(eq(filesTable.objectPath, seed.objectPath!));
      const newRows = after.filter((f) => !beforeIds.has(f.id));
      assert(
        newRows.length === 1,
        `exact één nieuwe files-rij verwacht, kreeg ${newRows.length} (geen weesrijen)`,
      );
      assert(newRows[0]!.id === a.fileId, "de overgebleven rij is de gewonnen koppeling");
    },
  );

  await scenarioAsync(
    "backfill-falen exposeert de oude rauwe URL NIET (fail-closed) — resolve en highlights",
    async () => {
      // 'Oude' rij met een objectPath dat NIET meer bestaat: registratie faalt
      // (bytes niet op te halen) ⇒ koppelen lukt niet ⇒ fail-closed.
      const deps: MediaDeps = {
        generate: async () => ({ b64_json: PNG_1x1, mimeType: "image/png" }),
      };
      const bogusPath = `/objects/uploads/does-not-exist-${tag}`;

      // (a) resolve-pad: cache-hit op een oude rij zonder fileId + kapot object.
      const failKey = `scene|failbackfill=${tag}`;
      await db.delete(virtualMediaTable).where(eq(virtualMediaTable.promptKey, failKey));
      await db.insert(virtualMediaTable).values({
        kind: "image",
        purpose: "scene",
        promptKey: failKey,
        prompt: "fail",
        objectPath: bogusPath,
        fileId: null,
        aspectRatio: "1:1",
        status: "ready",
        reuseCount: 0,
      });
      cleanupKeys.push(failKey);
      const resolved = await resolveMedia(
        { purpose: "scene", attributes: { failbackfill: tag } },
        deps,
      );
      assert(resolved.fileId == null, "koppelen hoort te mislukken (kapot object)");
      assert(
        resolved.objectPath == null,
        "fail-closed: de rauwe object-URL mag NIET worden teruggegeven",
      );
      assert(mediaUrl(resolved.objectPath) == null, "mediaUrl blijft dus null");

      // (b) highlight-pad: idem via readyHighlightUrls (video-clip).
      const athlete = {
        slug: `fail-${tag}`,
        gender: "v",
        age: 25,
        archetype: "klimmer",
        discipline: "mtb",
        team: "TST",
      };
      const hlKey = highlightKeyFor(athlete);
      await db.delete(virtualMediaTable).where(eq(virtualMediaTable.promptKey, hlKey));
      await db.insert(virtualMediaTable).values({
        kind: "video",
        purpose: "highlight",
        promptKey: hlKey,
        prompt: "fail-hl",
        objectPath: `${bogusPath}-hl`,
        fileId: null,
        aspectRatio: "16:9",
        status: "ready",
        reuseCount: 0,
      });
      cleanupKeys.push(hlKey);
      const urls = await readyHighlightUrls([athlete]);
      assert(
        !urls.has(athlete.slug),
        "fail-closed: een niet-koppelbare highlight mag GEEN URL publiceren",
      );
    },
  );

  server.close();

  // cleanup disposable rows
  for (const key of cleanupKeys) {
    await db.delete(virtualMediaTable).where(eq(virtualMediaTable.promptKey, key));
  }
  for (const id of createdFileIds) {
    await db.delete(filesTable).where(eq(filesTable.id, id));
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
