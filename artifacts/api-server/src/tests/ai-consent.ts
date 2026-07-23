// OPDRACHT 0B — aparte, intrekbare AI-toestemmingen — regressietest.
//
// Bewijst met injecteerbare provider-functies (er wordt NOOIT een echt model
// aangeroepen):
//   1. standaard staat alles UIT (geen rij = geen toestemming, fail-closed);
//   2. per toestemmingssoort: aan = werkt, uit/ingetrokken = direct geblokkeerd;
//   3. toestemming van gebruiker A geldt nooit voor gebruiker B;
//   4. zonder toestemming vindt er GEEN provider-aanroep plaats;
//   5. Foto-lab loopt via de gateway (toestemming foto-analyse);
//   6. kill switch blokkeert ook mediapaden;
//   7. rate limit blokkeert eerlijk (AiBlockedError, gelogd);
//   8. gatewayfalen is eerlijk: AiUnavailableError, nooit verzonnen resultaat.
//
// Run: `node ./scripts/run-test.mjs ai-consent` (met DEV_AUTH_BYPASS=true)

import { desc, eq, like } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  aiCallLogsTable,
  killSwitchesTable,
} from "@workspace/db";
import {
  aiMessage,
  aiMediaCall,
  AI_PURPOSES,
  AiBlockedError,
  AiUnavailableError,
  __setAiTransportForTests,
  __resetAiRateLimitForTests,
} from "../lib/ai/gateway";
import { getEffectivePrivacy } from "../lib/privacy";
import { invalidateKillSwitchCache } from "../lib/kill-switches";

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

const USER_A = "test-ai-consent-a";
const USER_B = "test-ai-consent-b";

function fakeMessage(text: string) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const baseParams = {
  model: "claude-sonnet-4-6",
  max_tokens: 100,
  messages: [{ role: "user" as const, content: "Zeg hallo." }],
};

type PrivacyPatch = Partial<{
  aiMemoryEnabled: boolean;
  aiHealthAnalysisEnabled: boolean;
  aiVisionEnabled: boolean;
  aiDocumentAnalysisEnabled: boolean;
  aiCoachingEnabled: boolean;
}>;

async function setPrivacy(clerkId: string, patch: PrivacyPatch) {
  await db
    .insert(privacySettingsTable)
    .values({ clerkId, ...patch })
    .onConflictDoUpdate({ target: privacySettingsTable.clerkId, set: patch });
}

async function lastLog(purpose: string, clerkId: string | null) {
  const rows = await db
    .select()
    .from(aiCallLogsTable)
    .where(eq(aiCallLogsTable.purpose, purpose))
    .orderBy(desc(aiCallLogsTable.id))
    .limit(5);
  return rows.find((r) => r.clerkId === clerkId) ?? null;
}

async function setKillSwitch(alive: boolean, reason: string | null) {
  await db
    .insert(killSwitchesTable)
    .values({ key: "ai_processing", active: !alive, reason })
    .onConflictDoUpdate({
      target: killSwitchesTable.key,
      set: { active: !alive, reason, updatedAt: new Date() },
    });
  invalidateKillSwitchCache();
}

async function seed() {
  for (const clerkId of [USER_A, USER_B]) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId, email: `${clerkId}@test.local`, displayName: "Consent Test" })
      .onConflictDoNothing();
    await db
      .insert(athleteProfilesTable)
      .values({ clerkId, birthDate: "1990-05-01" })
      .onConflictDoUpdate({ target: athleteProfilesTable.clerkId, set: { birthDate: "1990-05-01" } });
  }
}

async function cleanup() {
  await db.delete(aiCallLogsTable).where(like(aiCallLogsTable.clerkId, "test-ai-consent-%"));
  await db.delete(privacySettingsTable).where(like(privacySettingsTable.clerkId, "test-ai-consent-%"));
  await db.delete(athleteProfilesTable).where(like(athleteProfilesTable.clerkId, "test-ai-consent-%"));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, "test-ai-consent-%"));
}

async function expectBlocked(
  fn: () => Promise<unknown>,
  reason: "consent" | "killswitch" | "rate_limit",
  label: string,
) {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    assert(
      err instanceof AiBlockedError && err.reason === reason,
      `${label}: AiBlockedError(${reason}) verwacht, kreeg ${err instanceof Error ? `${err.name}:${(err as AiBlockedError).reason ?? err.message}` : String(err)}`,
    );
  }
  assert(threw, `${label}: had geblokkeerd moeten zijn`);
}

async function main() {
  await cleanup();
  await seed();
  await setKillSwitch(true, null);
  __resetAiRateLimitForTests();

  await scenario("1. Zonder privacy-rij staan ALLE toestemmingen uit (fail-closed)", async () => {
    const p = await getEffectivePrivacy("test-ai-consent-onbekend");
    assert(!p.aiMemoryEnabled, "aiMemoryEnabled moet standaard uit staan");
    assert(!p.aiHealthAnalysisEnabled, "aiHealthAnalysisEnabled moet standaard uit staan");
    assert(!p.aiVisionEnabled, "aiVisionEnabled moet standaard uit staan");
    assert(!p.aiDocumentAnalysisEnabled, "aiDocumentAnalysisEnabled moet standaard uit staan");
    assert(!p.aiCoachingEnabled, "aiCoachingEnabled moet standaard uit staan");
  });

  await scenario("2. Zonder toestemming: GEEN provider-aanroep, wel eerlijke blokkade + log", async () => {
    let transportHit = false;
    __setAiTransportForTests(async () => {
      transportHit = true;
      return fakeMessage("mag niet komen");
    });
    // USER_A heeft (nog) geen rij → alles uit.
    await expectBlocked(() => aiMessage("brief", USER_A, baseParams), "consent", "coaching zonder rij");
    await expectBlocked(() => aiMessage("nutrition_text", USER_A, baseParams), "consent", "gezondheid zonder rij");
    await expectBlocked(() => aiMessage("document_analysis", USER_A, baseParams), "consent", "document zonder rij");
    await expectBlocked(() => aiMessage("material_photo", USER_A, baseParams), "consent", "foto zonder rij");
    await expectBlocked(() => aiMessage("observation_extract", USER_A, baseParams), "consent", "geheugen zonder rij");
    assert(!transportHit, "provider werd tóch aangeroepen zonder toestemming!");
    const row = await lastLog("brief", USER_A);
    assert(row && row.status === "blocked_consent", "blocked_consent gelogd");
  });

  await scenario("3. Elke toestemming apart: aan = werkt, andere blijven geblokkeerd", async () => {
    __setAiTransportForTests(async () => fakeMessage("ok"));
    // Alleen coaching aan:
    await setPrivacy(USER_A, {
      aiCoachingEnabled: true,
      aiMemoryEnabled: false,
      aiHealthAnalysisEnabled: false,
      aiVisionEnabled: false,
      aiDocumentAnalysisEnabled: false,
    });
    const msg = await aiMessage("brief", USER_A, baseParams);
    assert(msg.content.length > 0, "coaching-doel werkt met aiCoachingEnabled");
    await expectBlocked(() => aiMessage("nutrition_text", USER_A, baseParams), "consent", "gezondheid blijft uit");
    await expectBlocked(() => aiMessage("material_photo", USER_A, baseParams), "consent", "foto blijft uit");
    await expectBlocked(() => aiMessage("document_analysis", USER_A, baseParams), "consent", "document blijft uit");
    // Gezondheid erbij:
    await setPrivacy(USER_A, { aiHealthAnalysisEnabled: true });
    const msg2 = await aiMessage("nutrition_text", USER_A, baseParams);
    assert(msg2.content.length > 0, "gezondheidsdoel werkt met aiHealthAnalysisEnabled");
  });

  await scenario("4. Intrekken werkt direct (geen cache)", async () => {
    __setAiTransportForTests(async () => fakeMessage("ok"));
    await setPrivacy(USER_A, { aiCoachingEnabled: true });
    await aiMessage("ask", USER_A, baseParams);
    await setPrivacy(USER_A, { aiCoachingEnabled: false });
    await expectBlocked(() => aiMessage("ask", USER_A, baseParams), "consent", "na intrekken");
    await setPrivacy(USER_A, { aiCoachingEnabled: true });
  });

  await scenario("5. Toestemming is per gebruiker: A aan helpt B niet", async () => {
    let transportHit = false;
    __setAiTransportForTests(async () => {
      transportHit = true;
      return fakeMessage("ok");
    });
    await setPrivacy(USER_A, { aiCoachingEnabled: true });
    await setPrivacy(USER_B, { aiCoachingEnabled: false });
    await aiMessage("brief", USER_A, baseParams);
    assert(transportHit, "A met toestemming moet werken");
    transportHit = false;
    await expectBlocked(() => aiMessage("brief", USER_B, baseParams), "consent", "B zonder toestemming");
    assert(!transportHit, "provider aangeroepen voor B zonder toestemming!");
  });

  await scenario("6. Foto-lab via gateway: zonder foto-toestemming geen provider-aanroep", async () => {
    const photoStyle = await import("../lib/photo-style");
    let providerHit = false;
    photoStyle.__setEditImageForTests(async () => {
      providerHit = true;
      return { b64_json: "aGFsbG8=", mimeType: "image/png" };
    });
    try {
      await setPrivacy(USER_A, { aiVisionEnabled: false });
      await expectBlocked(
        () => aiMediaCall("photo_style", USER_A, async () => {
          providerHit = true;
          return "x";
        }),
        "consent",
        "photo_style zonder aiVisionEnabled",
      );
      assert(!providerHit, "beeldprovider aangeroepen zonder foto-toestemming!");
      const row = await lastLog("photo_style", USER_A);
      assert(row && row.status === "blocked_consent", "photo_style blocked_consent gelogd");
      // Met toestemming loopt de closure wél, en wordt ok gelogd.
      await setPrivacy(USER_A, { aiVisionEnabled: true });
      const out = await aiMediaCall("photo_style", USER_A, async () => "resultaat");
      assert(out === "resultaat", "media-aanroep geeft closure-resultaat terug");
      const okRow = await lastLog("photo_style", USER_A);
      assert(okRow && okRow.status === "ok", "photo_style ok gelogd");
    } finally {
      photoStyle.__setEditImageForTests(null);
    }
  });

  await scenario("7. Kill switch blokkeert ook mediapaden", async () => {
    await setKillSwitch(false, "test");
    try {
      let hit = false;
      await expectBlocked(
        () => aiMediaCall("world_media_image", null, async () => {
          hit = true;
          return "x";
        }),
        "killswitch",
        "media onder kill switch",
      );
      assert(!hit, "mediaprovider aangeroepen onder kill switch!");
    } finally {
      await setKillSwitch(true, null);
    }
  });

  await scenario("8. Rate limit blokkeert eerlijk na de begrenzing", async () => {
    __setAiTransportForTests(async () => fakeMessage("ok"));
    __resetAiRateLimitForTests();
    await setPrivacy(USER_A, { aiCoachingEnabled: true });
    for (let i = 0; i < 30; i++) {
      await aiMessage("workout_explain", USER_A, baseParams);
    }
    await expectBlocked(() => aiMessage("workout_explain", USER_A, baseParams), "rate_limit", "31e aanroep");
    const row = await lastLog("workout_explain", USER_A);
    assert(row && row.status === "blocked_rate_limit", "blocked_rate_limit gelogd");
    // Andere gebruiker heeft een eigen emmer:
    await setPrivacy(USER_B, { aiCoachingEnabled: true });
    const ok = await aiMessage("workout_explain", USER_B, baseParams);
    assert(ok.content.length > 0, "rate limit is per gebruiker");
    __resetAiRateLimitForTests();
  });

  await scenario("9. Providerfalen in mediapad = eerlijke AiUnavailableError + errorlog", async () => {
    await setPrivacy(USER_A, { aiVisionEnabled: true });
    let threw = false;
    try {
      await aiMediaCall("photo_style", USER_A, async () => {
        throw new Error("provider exploded");
      });
    } catch (err) {
      threw = true;
      assert(err instanceof AiUnavailableError, "AiUnavailableError verwacht");
    }
    assert(threw, "fout had moeten doorbubbelen");
    const row = await lastLog("photo_style", USER_A);
    assert(row && row.status === "error", "error gelogd");
    assert(!(JSON.stringify(row).includes("aGFsbG8")), "log bevat nooit inhoud");
  });

  await scenario("10. Register: elk doel heeft een expliciete toestemmingssoort", async () => {
    const kinds = new Set(["ai_memory", "ai_health", "ai_vision", "ai_document", "ai_coaching", "explicit_action", "system"]);
    for (const [key, cfg] of Object.entries(AI_PURPOSES)) {
      assert(kinds.has(cfg.consent), `${key}: onbekende toestemmingssoort ${cfg.consent}`);
    }
  });

  __setAiTransportForTests(null);
  await cleanup();

  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed += 1;
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testrun faalde:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
