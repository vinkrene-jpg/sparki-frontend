// Sparki Foundation — Explainability Engine.
//
// Every foundation conclusion explains itself: used data, models, knowledge,
// personal factors, confidence, assumptions, uncertainties, alternatives and
// the full computation chain. Persistence goes through the existing
// data-origin engine (recordComputation) — one provenance system, not two.

import { recordComputation } from "../data-origin";
import type {
  ExplainabilityEngine,
  FoundationExplanation,
  FoundationRun,
} from "./contracts";
import { FOUNDATION_CONFIG } from "./config";
import { engineLogger } from "./logging";

const log = engineLogger("explainability");

export function createExplainabilityEngine(): ExplainabilityEngine {
  return {
    async explain(run: FoundationRun): Promise<FoundationExplanation> {
      const gebruikteData: string[] = [];
      if (run.snapshot.sessies.length > 0)
        gebruikteData.push(`${run.snapshot.sessies.length} trainingssessies (90 dagen)`);
      if (run.snapshot.dagmetingen.length > 0)
        gebruikteData.push(`${run.snapshot.dagmetingen.length} dagmetingen`);
      if (run.snapshot.profiel.ftp != null)
        gebruikteData.push(
          `ftp ${run.snapshot.profiel.ftp} W${run.snapshot.profiel.ftpEstimated ? " (geschat)" : ""}`,
        );
      if (run.snapshot.wedstrijden.length > 0)
        gebruikteData.push(`${run.snapshot.wedstrijden.length} geplande wedstrijden`);
      if (run.snapshot.geplandeTrainingen.length > 0)
        gebruikteData.push(`${run.snapshot.geplandeTrainingen.length} geplande trainingen`);

      const persoonlijkeFactoren: string[] = [];
      if (run.model.doelen.ontwikkeldoel)
        persoonlijkeFactoren.push(`ontwikkeldoel: ${run.model.doelen.ontwikkeldoel}`);
      if (run.model.ervaring) persoonlijkeFactoren.push(`ervaring: ${run.model.ervaring}`);
      if (run.model.beschikbareUren != null)
        persoonlijkeFactoren.push(`beschikbare uren: ${run.model.beschikbareUren}/week`);
      if (run.model.medischeBeperkingen.gezondheidsstatus !== "ok")
        persoonlijkeFactoren.push(
          `gezondheidsstatus: ${run.model.medischeBeperkingen.gezondheidsstatus}`,
        );

      // Calibrated confidence: starts from data richness, capped below 100.
      const max = Number(FOUNDATION_CONFIG.explainability.parameters["maxVertrouwen"] ?? 99);
      let score = 30;
      if (run.snapshot.sessies.length >= 10) score += 20;
      if (run.snapshot.dagmetingen.length >= 7) score += 15;
      if (run.snapshot.profiel.ftp != null && !run.snapshot.profiel.ftpEstimated) score += 10;
      if (run.snapshot.wedstrijden.length > 0) score += 5;
      score -= run.snapshot.ontbrekend.length * 3;
      const vertrouwen = {
        score: Math.max(5, Math.min(max, score)),
        redenen: gebruikteData.slice(0, 4),
        onzekerheden: run.snapshot.ontbrekend.map((o) => `geen ${o}`),
      };

      const aannames: string[] = [
        "trainingsbelasting volgt het CTL42/ATL7-model",
      ];
      if (run.snapshot.profiel.ftpEstimated)
        aannames.push("de geschatte ftp klopt bij benadering");
      if (run.patronen.some((p) => p.soort === "voorspelling"))
        aannames.push("voorspellingen gaan uit van ongewijzigd trainingsritme");

      const explanation: FoundationExplanation = {
        gebruikteData,
        gebruikteModellen: (
          ["data", "knowledge", "athlete-model", "strategy", "pattern", "decision-support", "explainability"] as const
        ).map((engine) => ({ engine, versie: FOUNDATION_CONFIG[engine].versie })),
        gebruikteKennis: run.kennis.map((k) => ({
          titel: k.titel,
          evidenceLevel: k.evidenceLevel,
          doi: k.doi,
        })),
        persoonlijkeFactoren,
        vertrouwen,
        aannames,
        onzekerheden: run.snapshot.ontbrekend.map((o) => `geen ${o} beschikbaar`),
        alternatieveScenarios: run.beslisondersteuning.scenarios.map(
          (s) => `${s.code}: ${s.naam}`,
        ),
        berekeningsketen: run.stappen.map((s) => ({
          stap: s.stap,
          engine: s.engine,
          omschrijving: `${s.engine} v${FOUNDATION_CONFIG[s.engine].versie}${s.ok ? "" : " (mislukt)"}`,
          duurMs: s.duurMs,
        })),
      };

      // Persist through the existing provenance system (best effort, logged).
      try {
        await recordComputation({
          clerkId: run.clerkId,
          subjectType: "foundation_analyse",
          subjectId: null,
          engine: "ai-foundation",
          engineVersion: FOUNDATION_CONFIG.explainability.versie,
          parameters: {
            stappen: run.stappen.length,
            patronen: run.patronen.length,
            scenarios: run.beslisondersteuning.scenarios.length,
            vertrouwen: vertrouwen.score,
          },
          inputs: [
            { bron: "berekening", tabel: "training_sessions" },
            { bron: "berekening", tabel: "daily_metrics" },
            { bron: "berekening", tabel: "athlete_profiles" },
          ],
          reliability: "afgeleid",
          aiUsed: "nee",
        });
      } catch (err) {
        log.warn({ err }, "foundation.explainability.recordComputation failed");
      }

      log.info(
        { vertrouwen: vertrouwen.score, kennis: run.kennis.length },
        "foundation.explainability.explain",
      );
      return explanation;
    },
  };
}
