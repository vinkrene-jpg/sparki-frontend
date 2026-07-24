// Sparki Foundation — Orchestrator.
//
// Pure ROUTING layer: decides the engine order, passes results along and
// records a step trace. It contains NO intelligence of its own — all
// conclusions come from the engines. Failures are honest: a failed step is
// marked in the trace and the run stops with a clear error.

import type {
  FoundationContainer,
  FoundationEngineName,
  FoundationResult,
  FoundationRun,
  FoundationStepTrace,
} from "./contracts";
import { engineLogger } from "./logging";

const log = engineLogger("orchestrator");

export async function runFoundationAnalyse(
  container: FoundationContainer,
  clerkId: string,
): Promise<FoundationResult> {
  const stappen: FoundationStepTrace[] = [];
  const gestartOp = new Date().toISOString();
  let stapNr = 0;

  async function step<T>(engine: FoundationEngineName, fn: () => Promise<T> | T): Promise<T> {
    stapNr += 1;
    const start = Date.now();
    try {
      const result = await fn();
      stappen.push({ stap: stapNr, engine, ok: true, duurMs: Date.now() - start });
      return result;
    } catch (err) {
      stappen.push({ stap: stapNr, engine, ok: false, duurMs: Date.now() - start });
      log.error({ err, engine, stap: stapNr }, "foundation.orchestrator.step failed");
      throw err;
    }
  }

  // 1. Data Engine — one honest snapshot for everything downstream.
  const snapshot = await step("data", () => container.data.collect(clerkId));

  // 2. Athlete Model Engine — who is this athlete, what do we honestly know.
  const model = await step("athlete-model", () =>
    container.athleteModel.build(clerkId, snapshot),
  );

  // 3. Knowledge Engine — evidence relevant to the athlete's situation.
  const kennisTags = [
    "training",
    ...(model.doelen.ontwikkeldoel ? [model.doelen.ontwikkeldoel] : []),
    ...(snapshot.risico?.level === "high" ? ["herstel"] : []),
  ];
  const kennis = await step("knowledge", () => container.knowledge.findEvidence({ tags: kennisTags }));

  // 4. Strategy Engine — long-term line, dependencies, conflicts.
  const strategie = await step("strategy", () => container.strategy.build(model, snapshot));

  // 5. Pattern Engine — objective patterns, no advice.
  const patronen = await step("pattern", () => container.pattern.detect(snapshot));

  // 6. Decision Support Engine — multiple scenarios, never one advice.
  const beslisondersteuning = await step("decision-support", () =>
    container.decisionSupport.build({ model, strategie, patronen, snapshot }),
  );

  const run: FoundationRun = {
    clerkId,
    gestartOp,
    snapshot,
    model,
    kennis,
    strategie,
    patronen,
    beslisondersteuning,
    stappen,
  };

  // 7. Explainability Engine — the run explains itself, always last. The
  // step trace is pushed FIRST so the computation chain shows all 7 steps;
  // the duration is filled in afterwards (honest: measured, not guessed).
  stapNr += 1;
  const uitlegTrace = { stap: stapNr, engine: "explainability" as const, ok: true, duurMs: 0 };
  stappen.push(uitlegTrace);
  const uitlegStart = Date.now();
  let uitleg;
  try {
    uitleg = await container.explainability.explain(run);
    uitlegTrace.duurMs = Date.now() - uitlegStart;
    // The chain was rendered while this step was still running — patch the
    // final measured duration in so the explanation stays honest.
    const eigenStap = uitleg.berekeningsketen.find(
      (k) => k.engine === "explainability" && k.stap === stapNr,
    );
    if (eigenStap) eigenStap.duurMs = uitlegTrace.duurMs;
  } catch (err) {
    uitlegTrace.ok = false;
    uitlegTrace.duurMs = Date.now() - uitlegStart;
    log.error({ err, engine: "explainability", stap: stapNr }, "foundation.orchestrator.step failed");
    throw err;
  }

  log.info(
    {
      clerkId,
      stappen: stappen.length,
      patronen: patronen.length,
      conflicten: strategie.conflicten.length,
    },
    "foundation.orchestrator.done",
  );

  return { ...run, uitleg };
}
