// Sparki Voice & Personality Engine integration test.
//
// Exercises the deterministic composer, the trust score, and the trust→DB
// pipeline. The pure parts (compose/trust math) need no database; a few scenarios
// at the end seed a disposable clerkId to verify computeTrust against real rows.
//
// Run: `pnpm --filter @workspace/api-server run test:voice`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { db, pool } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  composeVoice,
  isToneUnlocked,
  computeScore,
  scoreToTier,
  computeTrust,
  memoryTopic,
  TONE_LABELS,
  voiceTones,
  voiceEvents,
  trustTiers,
  EVENTS,
  type TrustSignals,
  type VoiceEvent,
  type VoiceTone,
  type TrustTier,
} from "../engines/voice";

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

// "AI" / "A.I." as a standalone word — NOT a substring (so "train", "detail",
// "trainingsmaat" are fine). Plus a small set of obvious English tech-jargon.
function bannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bai\b/.test(lower)) return "AI";
  if (/a\.i\./.test(lower)) return "A.I.";
  const jargon = ["power", "performance", "recovery", "workout", "update", "score"];
  for (const w of jargon) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) return w;
  }
  return null;
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;

const RUN = `test_voice_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}
const emailFor = (id: string) => `${id}@example.test`;

async function cleanup() {
  if (ids.length === 0) return;
  const { userProfilesTable } = await import("@workspace/db");
  // child rows cascade off user_profiles on delete.
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ids));
}

function main() {
  // ── Trust math: scoreToTier boundaries ─────────────────────────────────────
  scenario("trust: score 0 → nieuw", () => assert(scoreToTier(0) === "nieuw", "0 niet nieuw"));
  scenario("trust: score 0.17 → nieuw", () => assert(scoreToTier(0.17) === "nieuw", "0.17 niet nieuw"));
  scenario("trust: score 0.18 → kennismaking", () => assert(scoreToTier(0.18) === "kennismaking", "grens 0.18"));
  scenario("trust: score 0.44 → kennismaking", () => assert(scoreToTier(0.44) === "kennismaking", "0.44"));
  scenario("trust: score 0.45 → vertrouwd", () => assert(scoreToTier(0.45) === "vertrouwd", "grens 0.45"));
  scenario("trust: score 0.71 → vertrouwd", () => assert(scoreToTier(0.71) === "vertrouwd", "0.71"));
  scenario("trust: score 0.72 → maat", () => assert(scoreToTier(0.72) === "maat", "grens 0.72"));
  scenario("trust: score 1 → maat", () => assert(scoreToTier(1) === "maat", "1 niet maat"));

  // ── Trust math: computeScore behaviour ─────────────────────────────────────
  const emptySignals: TrustSignals = {
    daysKnown: 0,
    onboardingComplete: false,
    memoriesShared: 0,
    followUpsAnswered: 0,
    followUpsDismissed: 0,
    positiveEvents: 0,
    metricsLogged: 0,
    friends: 0,
  };
  const fullSignals: TrustSignals = {
    daysKnown: 60,
    onboardingComplete: true,
    memoriesShared: 10,
    followUpsAnswered: 10,
    followUpsDismissed: 0,
    positiveEvents: 16,
    metricsLogged: 20,
    friends: 6,
  };
  scenario("trust: lege signalen → score 0", () => assert(computeScore(emptySignals) === 0, "leeg niet 0"));
  scenario("trust: nieuwe gebruiker is tier nieuw", () =>
    assert(scoreToTier(computeScore(emptySignals)) === "nieuw", "leeg niet nieuw"));
  scenario("trust: volle signalen → score 1", () => assert(computeScore(fullSignals) === 1, "vol niet 1"));
  scenario("trust: actieve gebruiker is tier maat", () =>
    assert(scoreToTier(computeScore(fullSignals)) === "maat", "vol niet maat"));
  scenario("trust: score is begrensd 0..1", () => {
    const s = computeScore(fullSignals);
    assert(s >= 0 && s <= 1, `buiten bereik: ${s}`);
  });
  scenario("trust: meer beantwoorde follow-ups verhoogt score", () => {
    const a = computeScore({ ...emptySignals, followUpsAnswered: 1 });
    const b = computeScore({ ...emptySignals, followUpsAnswered: 4 });
    assert(b > a, "antwoorden verhogen score niet");
  });
  scenario("trust: dismissals verlagen score", () => {
    const base = computeScore({ ...fullSignals, followUpsDismissed: 0 });
    const penalised = computeScore({ ...fullSignals, followUpsDismissed: 10 });
    assert(penalised < base, "dismissals verlagen niet");
  });
  scenario("trust: onboarding voltooid telt mee", () => {
    const off = computeScore({ ...emptySignals, onboardingComplete: false });
    const on = computeScore({ ...emptySignals, onboardingComplete: true });
    assert(on > off, "onboarding telt niet mee");
  });

  // ── Trust gating: which tones unlock per tier ──────────────────────────────
  scenario("gating: nieuw heeft geen humor", () => {
    assert(!isToneUnlocked("dry_humor", "nieuw"), "nieuw heeft droge humor");
    assert(!isToneUnlocked("cynical", "nieuw"), "nieuw is cynisch");
    assert(!isToneUnlocked("curious", "nieuw"), "nieuw is nieuwsgierig (aanname)");
  });
  scenario("gating: nieuw heeft observer + supportive", () => {
    assert(isToneUnlocked("observer", "nieuw"), "nieuw mist observer");
    assert(isToneUnlocked("supportive", "nieuw"), "nieuw mist supportive");
  });
  scenario("gating: kennismaking ontgrendelt curious", () =>
    assert(isToneUnlocked("curious", "kennismaking") && !isToneUnlocked("dry_humor", "kennismaking"), "kennismaking gating fout"));
  scenario("gating: vertrouwd ontgrendelt droge humor", () =>
    assert(isToneUnlocked("dry_humor", "vertrouwd") && !isToneUnlocked("cynical", "vertrouwd"), "vertrouwd gating fout"));
  scenario("gating: maat ontgrendelt alles", () =>
    assert(voiceTones.every((t) => isToneUnlocked(t, "maat")), "maat mist een tone"));

  // ── Composer: each of the 5 styles is reachable for the right tier ─────────
  for (const tone of voiceTones) {
    scenario(`stijl: ${tone} levert tekst op`, () => {
      const line = composeVoice({ event: "good_form", tone, trust: "maat", seed: 0 }, true);
      assert(line && line.text.length > 0, `geen tekst voor ${tone}`);
      assert(line!.tone === tone, `verkeerde tone: ${line!.tone}`);
    });
  }

  // ── Trust override: locked humor falls back to a safe voice for new users ───
  scenario("gating: nieuw vraagt droge humor → valt terug op veilige stijl", () => {
    const line = composeVoice({ event: "good_form", tone: "dry_humor", trust: "nieuw", seed: 0 });
    assert(line, "geen lijn");
    assert(line!.tone !== "dry_humor" && line!.tone !== "cynical", `humor lekte naar nieuw: ${line!.tone}`);
    assert(isToneUnlocked(line!.tone, "nieuw"), "fallback-tone niet ontgrendeld voor nieuw");
  });
  scenario("gating: maat krijgt wél droge humor", () => {
    const line = composeVoice({ event: "good_form", tone: "dry_humor", trust: "maat", seed: 0 });
    assert(line && line.tone === "dry_humor", "maat kreeg geen humor");
  });

  // ── Empathy before humor: setbacks force supportive, no humor, empathy-first ─
  const setbacks: VoiceEvent[] = ["setback", "fall", "illness", "injury", "race_done_bad"];
  for (const ev of setbacks) {
    scenario(`empathie: ${ev} dwingt steunende toon af`, () => {
      const line = composeVoice({ event: ev, tone: "dry_humor", trust: "maat", seed: 0 });
      assert(line, `geen lijn voor ${ev}`);
      assert(line!.tone === "supportive", `${ev} niet supportive: ${line!.tone}`);
      assert(line!.empathyFirst, `${ev} niet empathyFirst`);
      assert(!line!.openLoop, `${ev} mag geen open loop zijn`);
    });
  }
  scenario("empathie: valpartij begint met 'Alles oké?'", () => {
    const line = composeVoice({ event: "fall", trust: "maat", seed: 0 });
    assert(line && line.text.startsWith("Alles oké?"), `valpartij leidt niet met check-in: ${line?.text}`);
  });
  scenario("empathie: humor kan een valpartij niet kapen", () => {
    const line = composeVoice({ event: "fall", tone: "cynical", trust: "maat", seed: 0 });
    assert(line && line.tone === "supportive", "cynisme kaapte de valpartij");
  });

  // ── Open loops: only on real evidence, never fabricated suspense ────────────
  scenario("open loop: zonder bewijs → null", () => {
    const line = composeVoice({ event: "pattern_found", trust: "maat", evidence: false, seed: 0 });
    assert(line === null, "open loop verzon spanning zonder bewijs");
  });
  scenario("open loop: zonder bewijs-veld → null", () => {
    const line = composeVoice({ event: "pattern_found", trust: "maat", seed: 0 });
    assert(line === null, "ontbrekend bewijs niet als null behandeld");
  });
  scenario("open loop: met bewijs → curiosity hook", () => {
    const line = composeVoice({ event: "pattern_found", trust: "maat", evidence: true, seed: 0 });
    assert(line && line.openLoop, "open loop niet gemarkeerd");
    assert(line!.text.length > 0, "lege open loop");
  });

  // ── Relational memory: refers to the topic; refuses without a memory ────────
  scenario("geheugen: memory_followup zonder memory → null", () => {
    const line = composeVoice({ event: "memory_followup", trust: "maat", seed: 0 });
    assert(line === null, "follow-up zonder memory verzon iets");
  });
  scenario("geheugen: verwijst naar het onderwerp", () => {
    const line = composeVoice({
      event: "memory_followup",
      trust: "maat",
      memory: memoryTopic("school"),
      tone: "curious",
      seed: 0,
    });
    assert(line, "geen lijn");
    assert(line!.text.includes("je examen"), `verwijst niet naar examen: ${line!.text}`);
  });
  scenario("geheugen: blessure-verwijzing is menselijk, geen item-nummer", () => {
    const line = composeVoice({
      event: "memory_followup",
      trust: "maat",
      memory: memoryTopic("injury"),
      seed: 0,
    });
    assert(line && line.text.includes("je blessure"), "geen menselijke blessure-verwijzing");
    assert(!/#\d/.test(line!.text), "lekt een item-nummer");
  });
  scenario("geheugen: memoryTopic dekt elke context-soort", () => {
    for (const k of ["school", "race", "injury", "illness", "camp", "equipment", "work", "family", "stress", "sleep", "motivation", "sport", "general"]) {
      const t = memoryTopic(k);
      assert(t.topic.length > 0, `geen onderwerp voor ${k}`);
    }
  });

  // ── Sport flavour ──────────────────────────────────────────────────────────
  scenario("sport: mtb kleurt de wedstrijdlijn", () => {
    const line = composeVoice({ event: "race_upcoming", tone: "observer", trust: "maat", sport: "mtb", seed: 0 });
    assert(line && line.text.includes("in het bos"), `geen sportkleur: ${line?.text}`);
  });
  scenario("sport: general laat geen lege gaten achter", () => {
    const line = composeVoice({ event: "race_upcoming", tone: "observer", trust: "maat", sport: "general", seed: 0 });
    assert(line, "geen lijn");
    assert(!line!.text.includes("  "), "dubbele spatie door lege slot");
    assert(!/\s[.,!?]/.test(line!.text), "spatie vóór leesteken door lege slot");
  });

  // ── Determinism ────────────────────────────────────────────────────────────
  scenario("determinisme: zelfde input + seed → zelfde lijn", () => {
    const a = composeVoice({ event: "greeting", trust: "maat", tone: "dry_humor", seed: 3 });
    const b = composeVoice({ event: "greeting", trust: "maat", tone: "dry_humor", seed: 3 });
    assert(a && b && a.text === b.text, "niet deterministisch");
  });
  scenario("determinisme: andere seed kan andere variant kiezen", () => {
    const texts = new Set<string>();
    for (let s = 0; s < 6; s++) {
      const line = composeVoice({ event: "greeting", trust: "maat", tone: "observer", seed: s });
      if (line) texts.add(line.text);
    }
    assert(texts.size > 1, "seed varieert de variant niet");
  });
  scenario("determinisme: zonder seed nog steeds stabiel", () => {
    const a = composeVoice({ event: "good_form", trust: "maat", tone: "observer" });
    const b = composeVoice({ event: "good_form", trust: "maat", tone: "observer" });
    assert(a && b && a.text === b.text, "ongeseede output instabiel");
  });

  // ── Minimal words for new users ────────────────────────────────────────────
  scenario("kort: nieuwe gebruiker krijgt korte zinnen", () => {
    for (const ev of voiceEvents) {
      const cfg = EVENTS[ev];
      if (cfg.needsMemory || cfg.openLoop) continue;
      const line = composeVoice({ event: ev, trust: "nieuw", seed: 0 });
      if (!line) continue;
      assert(wordCount(line.text) <= 9, `te lang voor nieuw (${ev}): "${line.text}"`);
    }
  });

  // ── No banned words anywhere the engine can speak ──────────────────────────
  scenario("taal: geen verboden woorden over alle stijlen/events/tiers heen", () => {
    let checked = 0;
    for (const ev of voiceEvents) {
      for (const tone of voiceTones) {
        for (const tier of trustTiers) {
          for (let seed = 0; seed < 4; seed++) {
            const line = composeVoice(
              {
                event: ev,
                tone,
                trust: tier,
                sport: "mtb",
                evidence: true,
                memory: memoryTopic("school"),
                seed,
              },
              true,
            );
            if (!line) continue;
            const bad = bannedWord(line.text);
            assert(!bad, `verboden woord "${bad}" in (${ev}/${tone}): "${line.text}"`);
            checked++;
          }
        }
      }
    }
    assert(checked > 100, `te weinig lijnen gecontroleerd: ${checked}`);
  });

  // ── Every event produces at least one valid line under the right conditions ─
  for (const ev of voiceEvents) {
    scenario(`dekking: event ${ev} levert een geldige lijn`, () => {
      const line = composeVoice(
        {
          event: ev,
          trust: "maat",
          sport: "wielrennen",
          evidence: true,
          memory: memoryTopic("race"),
          seed: 0,
        },
      );
      assert(line && line.text.length > 0, `event ${ev} gaf niets`);
    });
  }

  // ── Tone labels exist for the UI ───────────────────────────────────────────
  scenario("ui: elke tone heeft een Nederlands label", () => {
    for (const t of voiceTones) assert(TONE_LABELS[t]?.length > 0, `geen label voor ${t}`);
  });
}

// ── DB-backed: computeTrust against real, seeded rows ────────────────────────
async function dbScenarios() {
  await scenario("db: nieuw account is tier nieuw", async () => {
    const athlete = newId("fresh");
    await ensureAccount(athlete, emailFor(athlete), "Verse Sporter", silentLogger);
    const trust = await computeTrust(athlete);
    assert(trust.tier === "nieuw", `vers account niet nieuw: ${trust.tier}`);
    assert(trust.score >= 0 && trust.score <= 1, "score buiten bereik");
    assert(trust.signals.memoriesShared === 0, "vers account heeft al memories");
  });

  await scenario("db: computeTrust telt echte signalen", async () => {
    const athlete = newId("signals");
    await ensureAccount(athlete, emailFor(athlete), "Sporter", silentLogger);
    const { personalContextMemoriesTable } = await import("@workspace/db");
    await db.insert(personalContextMemoriesTable).values({
      clerkId: athlete,
      kind: "school",
      statement: "ik heb morgen examen",
      title: "Examen",
      followUpQuestion: "Hoe ging je examen?",
      status: "followed_up",
      followUpDone: true,
    });
    const trust = await computeTrust(athlete);
    assert(trust.signals.memoriesShared >= 1, "memory niet meegeteld");
    assert(trust.signals.followUpsAnswered >= 1, "beantwoorde follow-up niet meegeteld");
  });
}

main();
dbScenarios()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== Sparki Voice & Personality Engine — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await pool.end().catch(() => {});
    process.exit(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(1);
  });
