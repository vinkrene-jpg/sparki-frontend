// Sparki Materiaalcoach engine test.
//
// Covers the honesty contract of `analyzeMaterial`: JSON parsing/coercion, the
// explicit confidence levels, the "ask for an extra photo" gating, and the
// material-only cost estimate (never a cost for nutrition). The vision/network
// call is stubbed by overriding `anthropic.messages.create`, so every scenario
// is deterministic and runs without touching the real model or a database.
//
// Run: `pnpm --filter @workspace/api-server run test:material`
// No DATABASE_URL needed. Exits non-zero on any failure.

import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  analyzeMaterial,
  getCategory,
  normalizeMediaType,
  MATERIAL_CATEGORIES,
  type MaterialAnalysisResult,
} from "../lib/material/analyze";

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

// ── Stub the vision/network call ─────────────────────────────────────────────
// The engine reads `message.content[0]` and expects a `{ type: "text" }` block.
// We control exactly what text comes back, so the parser/coercer is exercised in
// isolation. `nextReply` is the raw string the "model" returns next.
let nextReply = "";
let lastSystem: string | undefined;

const origCreate = anthropic.messages.create.bind(anthropic.messages);
(anthropic.messages as unknown as { create: (args: unknown) => unknown }).create =
  async (args: unknown) => {
    lastSystem = (args as { system?: string }).system;
    return { content: [{ type: "text", text: nextReply }] } as unknown as Awaited<
      ReturnType<typeof origCreate>
    >;
  };

const photo = { base64: "AAAA", mediaType: "image/jpeg" as const };

// A complete, well-formed model reply with all knobs configurable.
function reply(over: Record<string, unknown>): string {
  return JSON.stringify({
    detectedItem: "Shimano 105 ketting",
    confidence: "high",
    needsMorePhoto: false,
    followUpQuestion: null,
    advice: {
      summary: "Je ketting is licht versleten.",
      pros: ["Schoon"],
      cons: ["Lichte rek"],
      risks: ["Slijtage tandwielen"],
      alternatives: ["Nieuwe ketting"],
    },
    costEstimate: {
      diy: {
        materials: ["Ketting", "Kettingpons"],
        costRange: "€25 – €40",
        difficulty: "gemiddeld",
        timeEstimate: "30 min",
      },
      professional: { laborCost: "€15", totalCost: "€45" },
      confidence: "medium",
      note: "Prijs afhankelijk van merk.",
    },
    ...over,
  });
}

const chain = getCategory("chain")!;
const breakfast = getCategory("breakfast")!;

async function run(
  category = chain,
  extra: Partial<Parameters<typeof analyzeMaterial>[0]> = {},
): Promise<MaterialAnalysisResult> {
  return analyzeMaterial({ category, photos: [photo], ...extra });
}

async function main() {
  // ── Registry helpers ───────────────────────────────────────────────────────
  await scenario("registry: getCategory kent een bestaande sleutel", () =>
    assert(getCategory("chain")?.key === "chain", "chain niet gevonden"));
  await scenario("registry: getCategory geeft null voor onbekende sleutel", () =>
    assert(getCategory("nope") === null, "onbekend gaf geen null"));
  await scenario("registry: elke categorie heeft label, prompt en kind", () => {
    for (const c of MATERIAL_CATEGORIES) {
      assert(c.label.length > 0, `geen label voor ${c.key}`);
      assert(c.prompt.length > 0, `geen prompt voor ${c.key}`);
      assert(c.kind === "material" || c.kind === "nutrition", `kind fout: ${c.key}`);
    }
  });

  // ── normalizeMediaType ──────────────────────────────────────────────────────
  await scenario("media: image/jpg wordt image/jpeg", () =>
    assert(normalizeMediaType("image/jpg") === "image/jpeg", "jpg niet genormaliseerd"));
  await scenario("media: hoofdletters en spaties worden afgehandeld", () =>
    assert(normalizeMediaType("  IMAGE/PNG  ") === "image/png", "png niet genormaliseerd"));
  await scenario("media: onbekend type geeft null", () =>
    assert(normalizeMediaType("image/tiff") === null, "tiff gaf geen null"));

  // ── Empty photos fail honestly ─────────────────────────────────────────────
  await scenario("foto's: lege lijst gooit een fout", async () => {
    let threw = false;
    try {
      await analyzeMaterial({ category: chain, photos: [] });
    } catch {
      threw = true;
    }
    assert(threw, "lege fotolijst gooide geen fout");
  });

  // ── Confidence coercion ────────────────────────────────────────────────────
  for (const level of ["high", "medium", "low"]) {
    await scenario(`zekerheid: "${level}" blijft "${level}"`, async () => {
      nextReply = reply({ confidence: level, needsMorePhoto: false });
      const r = await run();
      assert(r.confidence === level, `werd ${r.confidence}`);
    });
  }
  await scenario('zekerheid: ongeldige waarde wordt "unknown"', async () => {
    nextReply = reply({ confidence: "supersure", needsMorePhoto: false });
    const r = await run();
    assert(r.confidence === "unknown", `werd ${r.confidence}`);
  });
  await scenario('zekerheid: "unknown" blijft "unknown"', async () => {
    nextReply = reply({ confidence: "unknown", needsMorePhoto: false });
    const r = await run();
    assert(r.confidence === "unknown", `werd ${r.confidence}`);
  });

  // ── needsMorePhoto gating ──────────────────────────────────────────────────
  await scenario("extra foto: model vraagt erom → needsMorePhoto true", async () => {
    nextReply = reply({
      confidence: "low",
      needsMorePhoto: true,
      followUpQuestion: "Maak een close-up van het profiel.",
    });
    const r = await run();
    assert(r.needsMorePhoto === true, "needsMorePhoto niet true");
    assert(
      r.followUpQuestion === "Maak een close-up van het profiel.",
      "vervolgvraag niet bewaard",
    );
  });
  await scenario("extra foto: hoge zekerheid en geen vraag → false", async () => {
    nextReply = reply({ confidence: "high", needsMorePhoto: false });
    const r = await run();
    assert(r.needsMorePhoto === false, "needsMorePhoto niet false");
  });
  await scenario(
    'extra foto: zekerheid "unknown" forceert needsMorePhoto ook bij false',
    async () => {
      nextReply = reply({ confidence: "unknown", needsMorePhoto: false });
      const r = await run();
      assert(r.needsMorePhoto === true, "unknown forceerde geen extra foto");
    },
  );
  await scenario("extra foto: lege vervolgvraag wordt null", async () => {
    nextReply = reply({ confidence: "high", needsMorePhoto: false, followUpQuestion: "  " });
    const r = await run();
    assert(r.followUpQuestion === null, "lege vraag werd niet null");
  });

  // ── Cost: material gets it, nutrition never ────────────────────────────────
  await scenario("kosten: materiaal levert een kosteninschatting", async () => {
    nextReply = reply({});
    const r = await run(chain);
    assert(r.costEstimate !== null, "materiaal kreeg geen kosten");
    assert(r.costEstimate?.diy?.costRange === "€25 – €40", "diy-bereik fout");
    assert(r.costEstimate?.professional?.totalCost === "€45", "totaal fout");
    assert(r.costEstimate?.confidence === "medium", "kostenzekerheid fout");
  });
  await scenario("kosten: voeding krijgt nooit een kosteninschatting", async () => {
    // Even when the model wrongly returns a cost, nutrition must drop it.
    nextReply = reply({});
    const r = await run(breakfast);
    assert(r.costEstimate === null, "voeding kreeg toch kosten");
  });
  await scenario("kosten: ontbrekende inschatting blijft null", async () => {
    nextReply = reply({ costEstimate: null });
    const r = await run(chain);
    assert(r.costEstimate === null, "null-kosten werd iets");
  });
  await scenario("kosten: lege diy-velden worden weggelaten, note blijft", async () => {
    nextReply = reply({
      costEstimate: {
        diy: { materials: [], costRange: "", difficulty: "", timeEstimate: "" },
        professional: null,
        confidence: "low",
        note: "Niet goed in te schatten zonder merk.",
      },
    });
    const r = await run(chain);
    assert(r.costEstimate !== null, "kosten volledig weggevallen");
    assert(r.costEstimate?.diy === null, "lege diy niet weggelaten");
    assert(r.costEstimate?.professional === null, "lege professional niet weggelaten");
    assert(
      r.costEstimate?.note === "Niet goed in te schatten zonder merk.",
      "note niet bewaard",
    );
  });

  // ── Advice list coercion ───────────────────────────────────────────────────
  await scenario("advies: niet-strings en lege items worden gefilterd", async () => {
    nextReply = reply({
      advice: {
        summary: "  Samenvatting met spaties  ",
        pros: ["Goed", "", "  ", 42, null, "Netjes"],
        cons: "geen lijst",
        risks: [],
        alternatives: [" Optie A "],
      },
    });
    const r = await run(chain);
    assert(r.advice.summary === "Samenvatting met spaties", "summary niet getrimd");
    assert(
      JSON.stringify(r.advice.pros) === JSON.stringify(["Goed", "Netjes"]),
      `pros niet gefilterd: ${JSON.stringify(r.advice.pros)}`,
    );
    assert(Array.isArray(r.advice.cons) && r.advice.cons.length === 0, "cons niet []");
    assert(
      JSON.stringify(r.advice.alternatives) === JSON.stringify(["Optie A"]),
      "alternatives niet getrimd",
    );
  });

  // ── detectedItem fallback ──────────────────────────────────────────────────
  await scenario("item: leeg detectedItem valt terug op categorielabel", async () => {
    nextReply = reply({ detectedItem: "" });
    const r = await run(chain);
    assert(r.detectedItem === chain.label, `viel niet terug: ${r.detectedItem}`);
  });

  // ── JSON extraction from fenced / noisy output ─────────────────────────────
  await scenario("json: in een ```json codeblok wordt geparsed", async () => {
    nextReply = "```json\n" + reply({ confidence: "medium", needsMorePhoto: false }) + "\n```";
    const r = await run(chain);
    assert(r.confidence === "medium", "codeblok niet geparsed");
  });
  await scenario("json: omringende tekst wordt genegeerd", async () => {
    nextReply =
      "Hier is mijn analyse: " + reply({ confidence: "low", needsMorePhoto: true }) + " Groet, Sparki";
    const r = await run(chain);
    assert(r.confidence === "low", "object niet uit ruis gehaald");
  });
  await scenario("json: geen JSON in antwoord gooit een fout", async () => {
    nextReply = "Sorry, ik kan dit niet beoordelen.";
    let threw = false;
    try {
      await run(chain);
    } catch {
      threw = true;
    }
    assert(threw, "antwoord zonder JSON gooide geen fout");
  });

  // ── The system prompt enforces the honesty contract ────────────────────────
  await scenario("contract: systeemprompt verbiedt verzinnen en het woord AI", async () => {
    nextReply = reply({});
    await run(chain);
    assert(lastSystem !== undefined, "systeemprompt niet doorgegeven");
    assert(/Verzin nooit/i.test(lastSystem ?? ""), "geen verzin-verbod in prompt");
    assert(/needsMorePhoto/.test(lastSystem ?? ""), "extra-foto-regel ontbreekt");
    assert(/"AI"/.test(lastSystem ?? ""), "AI-verbod ontbreekt in prompt");
  });
}

main()
  .then(() => {
    // Restore the real client so nothing leaks beyond this process.
    (anthropic.messages as unknown as { create: typeof origCreate }).create = origCreate;
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== Sparki Materiaalcoach engine — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    process.exit(failed.length > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("test harness crashed:", err);
    process.exit(1);
  });
