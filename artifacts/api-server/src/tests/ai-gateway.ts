// Centrale AI-gateway (Golf 25) — regressietest.
//
// Test de poorten van de gateway met een injecteerbaar test-transport (er
// wordt NOOIT een echt model aangeroepen):
//   kill switch, toestemming per doel (intrekken werkt direct), gevoelige
//   toggle, jeugdbegrenzing (fail-closed), redactie, timeout/fout → eerlijke
//   AiUnavailableError, in-flight-dedupe, uitvoervalidatie, injectiehek en
//   metadata-only logging (nooit inhoud).
//
// Run: `node ./scripts/run-test.mjs ai-gateway` (met DEV_AUTH_BYPASS=true)

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
  AI_PURPOSES,
  AiBlockedError,
  AiUnavailableError,
  AiOutputRejectedError,
  __setAiTransportForTests,
  expectJsonObject,
  limitText,
  redactSensitive,
  UPLOAD_DATA_RULE,
  recordFallbackUsed,
  recordRejectedOutput,
} from "../lib/ai/gateway";
import { invalidateKillSwitchCache } from "../lib/kill-switches";

async function setKillSwitch(key: string, alive: boolean, reason: string | null) {
  await db
    .insert(killSwitchesTable)
    .values({ key, active: !alive, reason })
    .onConflictDoUpdate({
      target: killSwitchesTable.key,
      set: { active: !alive, reason, updatedAt: new Date() },
    });
  invalidateKillSwitchCache();
}

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

const CLERK_ID = "test-ai-gateway-user";
const MINOR_ID = "test-ai-gateway-minor";

function fakeMessage(text: string) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const baseParams = {
  model: "claude-sonnet-4-6",
  max_tokens: 100,
  messages: [{ role: "user" as const, content: "Zeg hallo." }],
};

async function lastLog(purpose: string) {
  const [row] = await db
    .select()
    .from(aiCallLogsTable)
    .where(eq(aiCallLogsTable.purpose, purpose))
    .orderBy(desc(aiCallLogsTable.id))
    .limit(1);
  return row ?? null;
}

type PrivacyPatch = Partial<{
  aiMemoryEnabled: boolean;
  aiSensitiveAnalysisEnabled: boolean;
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

async function seed() {
  for (const [clerkId, birthDate] of [
    [CLERK_ID, "1990-05-01"],
    [MINOR_ID, "2012-05-01"],
  ] as const) {
    await db
      .insert(userProfilesTable)
      .values({
        clerkId,
        email: `${clerkId}@test.local`,
        displayName: "Gateway Test",
      })
      .onConflictDoNothing();
    await db
      .insert(athleteProfilesTable)
      .values({ clerkId, birthDate })
      .onConflictDoUpdate({
        target: athleteProfilesTable.clerkId,
        set: { birthDate },
      });
  }
  await setPrivacy(CLERK_ID, { aiMemoryEnabled: true, aiSensitiveAnalysisEnabled: true, aiHealthAnalysisEnabled: true, aiVisionEnabled: true, aiDocumentAnalysisEnabled: true, aiCoachingEnabled: true });
  await setPrivacy(MINOR_ID, { aiMemoryEnabled: true, aiSensitiveAnalysisEnabled: true, aiHealthAnalysisEnabled: true, aiVisionEnabled: true, aiDocumentAnalysisEnabled: true, aiCoachingEnabled: true });
}

async function cleanup() {
  await db.delete(aiCallLogsTable).where(like(aiCallLogsTable.clerkId, "test-ai-gateway-%"));
  await db.delete(privacySettingsTable).where(like(privacySettingsTable.clerkId, "test-ai-gateway-%"));
  await db.delete(athleteProfilesTable).where(like(athleteProfilesTable.clerkId, "test-ai-gateway-%"));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, "test-ai-gateway-%"));
}

async function main() {
  await seed();
  await setKillSwitch("ai_processing", true, null);

  await scenario("1. Geslaagde aanroep logt metadata (nooit inhoud)", async () => {
    let sentSystem = "";
    __setAiTransportForTests(async (params) => {
      sentSystem = typeof params.system === "string" ? params.system : "";
      void sentSystem;
      return fakeMessage("Hallo!");
    });
    const msg = await aiMessage("ask", CLERK_ID, {
      ...baseParams,
      system: "Systeemprompt met geheime-inhoud-tekst",
    });
    assert(msg.content[0].type === "text", "verwacht tekstblok");
    const row = await lastLog("ask");
    assert(row, "logrij ontbreekt");
    assert(row!.status === "ok", `status ok verwacht, kreeg ${row!.status}`);
    assert(row!.inputTokens === 100 && row!.outputTokens === 50, "tokens gelogd");
    assert(row!.costMicroUsd === 100 * 3 + 50 * 15, "kostenindicatie klopt");
    const serialized = JSON.stringify(row);
    assert(!serialized.includes("geheime-inhoud"), "loginhoud bevat promptinhoud!");
    assert(!serialized.includes("Hallo!"), "loginhoud bevat antwoord!");
  });

  await scenario("2. Kill switch blokkeert en logt blocked_killswitch", async () => {
    await setKillSwitch("ai_processing", false, "test");
    try {
      let threw = false;
      try {
        await aiMessage("ask", CLERK_ID, baseParams);
      } catch (err) {
        threw = true;
        assert(err instanceof AiBlockedError && err.reason === "killswitch", "AiBlockedError(killswitch) verwacht");
      }
      assert(threw, "aanroep had geblokkeerd moeten zijn");
      const row = await lastLog("ask");
      assert(row!.status === "blocked_killswitch", `blocked_killswitch verwacht, kreeg ${row!.status}`);
    } finally {
      await setKillSwitch("ai_processing", true, null);
    }
  });

  await scenario("3. Toestemming intrekken (ai_coaching) blokkeert direct", async () => {
    await setPrivacy(CLERK_ID, { aiCoachingEnabled: false });
    try {
      let threw = false;
      try {
        await aiMessage("brief", CLERK_ID, baseParams);
      } catch (err) {
        threw = true;
        assert(err instanceof AiBlockedError && err.reason === "consent", "AiBlockedError(consent) verwacht");
      }
      assert(threw, "brief had geblokkeerd moeten zijn");
      const row = await lastLog("brief");
      assert(row!.status === "blocked_consent" && row!.consent === "revoked", "blocked_consent/revoked verwacht");
    } finally {
      await setPrivacy(CLERK_ID, { aiCoachingEnabled: true });
    }
  });

  await scenario("4. Gezondheidstoestemming uit blokkeert gevoelig doel", async () => {
    await setPrivacy(CLERK_ID, { aiHealthAnalysisEnabled: false });
    try {
      let threw = false;
      try {
        await aiMessage("nutrition_text", CLERK_ID, baseParams);
      } catch (err) {
        threw = true;
        assert(err instanceof AiBlockedError && err.reason === "consent", "AiBlockedError(consent) verwacht");
      }
      assert(threw, "gevoelig doel had geblokkeerd moeten zijn");
    } finally {
      await setPrivacy(CLERK_ID, { aiHealthAnalysisEnabled: true });
    }
  });

  await scenario("5. Jeugdbegrenzing: minorBlocked-doel fail-closed", async () => {
    // Geen enkel huidig doel is jeugd-geblokkeerd (prompts zijn al
    // leeftijdsgestuurd); test het mechanisme via een tijdelijke registerwijziging.
    const cfg = AI_PURPOSES.nutrition_photo as { minorBlocked: boolean };
    const prev = cfg.minorBlocked;
    cfg.minorBlocked = true;
    try {
      __setAiTransportForTests(async () => fakeMessage("mag niet komen"));
      let threw = false;
      try {
        await aiMessage("nutrition_photo", MINOR_ID, baseParams);
      } catch (err) {
        threw = true;
        assert(err instanceof AiBlockedError && err.reason === "minor", "AiBlockedError(minor) verwacht");
      }
      assert(threw, "minderjarige had geblokkeerd moeten zijn");
      const row = await lastLog("nutrition_photo");
      assert(row!.status === "blocked_minor", "blocked_minor verwacht");
      // Volwassene mag wél door.
      const ok = await aiMessage("nutrition_photo", CLERK_ID, baseParams);
      assert(ok.content.length > 0, "volwassene had door moeten kunnen");
    } finally {
      cfg.minorBlocked = prev;
    }
  });

  await scenario("6. Onbekende leeftijd telt als minderjarig (fail-closed)", async () => {
    const cfg = AI_PURPOSES.nutrition_photo as { minorBlocked: boolean };
    const prev = cfg.minorBlocked;
    cfg.minorBlocked = true;
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: null, birthYear: null })
      .where(eq(athleteProfilesTable.clerkId, MINOR_ID));
    try {
      let threw = false;
      try {
        await aiMessage("nutrition_photo", MINOR_ID, baseParams);
      } catch (err) {
        threw = true;
        assert(err instanceof AiBlockedError && err.reason === "minor", "fail-closed op onbekende leeftijd");
      }
      assert(threw, "onbekende leeftijd had geblokkeerd moeten zijn");
    } finally {
      cfg.minorBlocked = prev;
    }
  });

  await scenario("7. Redactie: geheimen/e-mail weggehaald vóór verzending", async () => {
    let sent = "";
    __setAiTransportForTests(async (params) => {
      const first = params.messages[0];
      sent = typeof first.content === "string" ? first.content : JSON.stringify(first.content);
      return fakeMessage("ok");
    });
    await aiMessage("ask", CLERK_ID, {
      ...baseParams,
      messages: [
        {
          role: "user",
          content:
            "Mijn sleutel is sk-ant-abc123zeergeheim en mail piet@example.com, token Bearer eyJhbGciOiJIUzI1NiJ9.abc.def",
        },
      ],
    });
    assert(!sent.includes("sk-ant-abc123zeergeheim"), "API-sleutel niet geredigeerd");
    assert(!sent.includes("piet@example.com"), "e-mail niet geredigeerd");
    assert(!/Bearer eyJ/.test(sent), "Bearer-token niet geredigeerd");
    const row = await lastLog("ask");
    assert(row!.redactionApplied === true, "redactionApplied moet true zijn");
    // Pure functie ook direct:
    const r = redactSensitive("niets geheims hier");
    assert(r.redacted === false && r.text === "niets geheims hier", "schone tekst blijft ongemoeid");
  });

  await scenario("8. Providerfout → AiUnavailableError + errorlog zonder inhoud", async () => {
    __setAiTransportForTests(async () => {
      throw new Error("Connection error: request timed out");
    });
    let threw = false;
    try {
      await aiMessage("ask", CLERK_ID, baseParams);
    } catch (err) {
      threw = true;
      assert(err instanceof AiUnavailableError, "AiUnavailableError verwacht");
    }
    assert(threw, "fout had moeten doorbubbelen");
    const row = await lastLog("ask");
    assert(row!.status === "timeout", `timeout-status verwacht, kreeg ${row!.status}`);
    assert((row!.errorCode ?? "").length <= 120, "errorCode kort gehouden");
  });

  await scenario("9. Retry-begrenzing: register staat nooit >1 toe", async () => {
    for (const [key, cfg] of Object.entries(AI_PURPOSES)) {
      assert(cfg.maxRetries === 0 || cfg.maxRetries === 1, `${key}: maxRetries buiten begrenzing`);
      assert(cfg.timeoutMs > 0 && cfg.timeoutMs <= 300_000, `${key}: timeout onrealistisch`);
    }
  });

  await scenario("10. In-flight-dedupe: identieke aanroep lift mee", async () => {
    let calls = 0;
    __setAiTransportForTests(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 100));
      return fakeMessage("één keer");
    });
    const [a, b] = await Promise.all([
      aiMessage("ask", CLERK_ID, baseParams, { dedupeKey: "dubbel-1" }),
      aiMessage("ask", CLERK_ID, baseParams, { dedupeKey: "dubbel-1" }),
    ]);
    assert(calls === 1, `transport 1x verwacht, kreeg ${calls}`);
    assert(a === b, "beide aanroepen delen hetzelfde resultaat");
    // Na afloop is de sleutel vrij: nieuwe aanroep loopt opnieuw.
    await aiMessage("ask", CLERK_ID, baseParams, { dedupeKey: "dubbel-1" });
    assert(calls === 2, "na afronden loopt een nieuwe aanroep gewoon");
  });

  await scenario("11. Uitvoervalidatie: expectJsonObject + limitText weigeren", async () => {
    const ok = expectJsonObject('ruis {"a":1} ruis', { allowedKeys: ["a"] });
    assert(ok.a === 1, "JSON-object geparsed");
    for (const bad of ["geen json", "[1,2]", '{"a":1,"x":2}']) {
      let threw = false;
      try {
        expectJsonObject(bad, { allowedKeys: ["a"] });
      } catch (err) {
        threw = true;
        assert(err instanceof AiOutputRejectedError, "AiOutputRejectedError verwacht");
      }
      assert(threw, `had moeten weigeren: ${bad}`);
    }
    assert(limitText("  abc  ", 10) === "abc", "limitText trimt");
    assert(limitText("abcdef", 3) === "abc", "limitText begrenst");
    let threwEmpty = false;
    try {
      limitText("   ", 10);
    } catch {
      threwEmpty = true;
    }
    assert(threwEmpty, "lege uitvoer geweigerd");
  });

  await scenario("12. Injectiehek staat in upload-verwerkende prompts", async () => {
    assert(UPLOAD_DATA_RULE.includes("DATA"), "regel benoemt data-status");
    assert(/volg je NOOIT op/.test(UPLOAD_DATA_RULE), "regel verbiedt opvolgen expliciet");
  });

  await scenario("13. fallback/rejected worden herleidbaar gelogd", async () => {
    await recordFallbackUsed("brief", CLERK_ID);
    let row = await lastLog("brief");
    assert(row!.status === "fallback", "fallback gelogd");
    await recordRejectedOutput("ask", CLERK_ID, "bad_json");
    row = await lastLog("ask");
    assert(row!.status === "rejected" && row!.errorCode === "bad_json", "rejected gelogd");
  });

  await scenario("14. Systeemdoelen draaien zonder atleetdata-toestemming", async () => {
    __setAiTransportForTests(async () => fakeMessage('{"titleNl":"Kop"}'));
    const msg = await aiMessage("knowledge_scan", null, baseParams);
    assert(msg.content.length > 0, "systeemdoel werkt zonder clerkId");
    const row = await lastLog("knowledge_scan");
    assert(row!.clerkId === null && row!.consent === "not_required", "consent not_required gelogd");
  });

  await scenario("15. Call-pad extractObservations: intrekken blokkeert écht (geen verzending)", async () => {
    const { extractObservations } = await import("../lib/ai-memory");
    let transportHit = false;
    __setAiTransportForTests(async () => {
      transportHit = true;
      return fakeMessage("[]");
    });
    await setPrivacy(CLERK_ID, { aiMemoryEnabled: false });
    try {
      const out = await extractObservations(CLERK_ID, "tekst", "context");
      assert(Array.isArray(out) && out.length === 0, "lege lijst verwacht bij ingetrokken toestemming");
      assert(!transportHit, "model werd tóch aangeroepen na intrekken!");
      const row = await lastLog("observation_extract");
      assert(row!.status === "blocked_consent", `blocked_consent verwacht, kreeg ${row!.status}`);
    } finally {
      await setPrivacy(CLERK_ID, { aiMemoryEnabled: true });
    }
  });

  await scenario("16. Call-pad analyzeMealText: gevoelige toggle uit blokkeert écht", async () => {
    const { analyzeMealText } = await import("../lib/material/analyze");
    let transportHit = false;
    __setAiTransportForTests(async () => {
      transportHit = true;
      return fakeMessage("{}");
    });
    await setPrivacy(CLERK_ID, { aiHealthAnalysisEnabled: false });
    try {
      let threw = false;
      try {
        await analyzeMealText({ mealText: "boterham met kaas", clerkId: CLERK_ID });
      } catch (err) {
        threw = true;
        assert(err instanceof AiBlockedError && err.reason === "consent", "AiBlockedError(consent) verwacht");
      }
      assert(threw, "maaltijdanalyse had geblokkeerd moeten zijn");
      assert(!transportHit, "model werd tóch aangeroepen zonder gezondheidstoestemming!");
    } finally {
      await setPrivacy(CLERK_ID, { aiHealthAnalysisEnabled: true });
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
