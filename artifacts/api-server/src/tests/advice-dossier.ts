// AIE2 F1 — unit-/DB-test op het adviesdossier: volledigheid is hard
// afgedwongen (20 velden), dedupe is idempotent, uitkomst wordt later
// vastgelegd, en een advies zonder dossier is legacy.

import assert from "node:assert/strict";
import test from "node:test";
import { db, adviceDossiersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createAdviceDossier,
  recordAdviceOutcome,
  getDossierByKey,
  dossierStatusFor,
  DossierIncompleteError,
  LEGACY_STATUS,
  type AdviceDossierInput,
} from "../lib/advice-dossier";

const CLERK = "test-aie2-dossier-user";

function fullInput(): AdviceDossierInput {
  return {
    clerkId: CLERK,
    adviceType: "dag_advies",
    adviceKey: `dag:test-${Date.now()}`,
    title: "Rustige duurrit",
    adviceText: "Vandaag rustig 60 minuten, je belasting loopt op.",
    basedOn: [{ kind: "tsb", label: "Vormbalans", value: "-18", date: "2026-08-01" }],
    sourcesUsed: ["training_load"],
    sourcesExcluded: [{ source: "hrv", reason: "geen meting laatste 7 dagen" }],
    rulesApplied: ["day-advice.tsb-guard"],
    knowledgeRefs: [],
    confidenceFactors: { sample: 0.7 },
    confidenceLevel: "redelijk_zeker",
    alternativesConsidered: [{ option: "intervaltraining" }],
    whyAlternativeRejected: "Belasting te hoog voor intensiteit vandaag.",
    risks: [{ risk: "vermoeidheid onderschat" }],
    computedBy: [{ engine: "day-advice" }],
    aiInvolvement: { used: false },
  };
}

test.after(async () => {
  await db.delete(adviceDossiersTable).where(eq(adviceDossiersTable.clerkId, CLERK));
});

test("onvolledig dossier wordt hard geweigerd (verplichte velden, incl. why-alternative)", async () => {
  const input = fullInput();
  (input as Record<string, unknown>).whyAlternativeRejected = "  ";
  input.basedOn = [];
  await assert.rejects(
    () => createAdviceDossier(input),
    (err: unknown) => {
      assert.ok(err instanceof DossierIncompleteError);
      assert.ok(err.missing.includes("whyAlternativeRejected"));
      assert.ok(err.missing.includes("basedOn"));
      return true;
    },
  );
});

test("aanmaken is idempotent op dedupeKey en outcome komt later", async () => {
  const input = fullInput();
  const a = await createAdviceDossier(input);
  const b = await createAdviceDossier(input);
  assert.equal(a.id, b.id);
  assert.equal(a.outcome, null); // nooit verzonnen bij aanmaak

  const ok = await recordAdviceOutcome(CLERK, a.id, "Advies opgevolgd; herstel goed.");
  assert.equal(ok, true);
  const fetched = await getDossierByKey(CLERK, input.adviceKey);
  assert.ok(fetched?.outcome?.includes("opgevolgd"));
  assert.ok(fetched?.outcomeAt);

  // Andere gebruiker kan de uitkomst niet zetten.
  const denied = await recordAdviceOutcome("iemand-anders", a.id, "hack");
  assert.equal(denied, false);
});

test("advies zonder dossier is legacy — eerlijk gelabeld, niet verborgen", () => {
  const s = dossierStatusFor(null);
  assert.equal(s.status, LEGACY_STATUS);
  assert.equal(s.herleidbaar, false);
  assert.ok(s.label && s.label.length > 10);
  const active = dossierStatusFor({ status: "actief" } as never);
  assert.equal(active.herleidbaar, true);
});
