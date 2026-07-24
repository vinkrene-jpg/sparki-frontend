// Sparki Foundation — Decision Support Engine.
//
// Turns the situation into MULTIPLE scenarios — never one mandatory advice.
// Every analysis yields at least a hold- and an alternative scenario, each
// with success chance, risk, effort, time, cost and expected effects. Pure and
// deterministic over the upstream engine outputs.

import type {
  DecisionScenario,
  DecisionSupport,
  DecisionSupportEngine,
  FoundationConfidence,
} from "./contracts";
import { ONVOLDOENDE_GEGEVENS } from "./contracts";
import { engineLogger } from "./logging";

const log = engineLogger("decision-support");

function kans(
  score: number,
  redenen: string[],
  onzekerheden: string[],
): FoundationConfidence {
  return { score: Math.max(1, Math.min(99, Math.round(score))), redenen, onzekerheden };
}

export function createDecisionSupportEngine(): DecisionSupportEngine {
  return {
    build({ model, strategie, patronen, snapshot }): DecisionSupport {
      const tsb = snapshot.belasting?.tsb ?? null;
      const risicoHoog = snapshot.risico?.level === "high";
      const risicoMatig = snapshot.risico?.level === "moderate";
      const vorm = strategie.scenarioBasis.huidigeVorm;
      const trend = strategie.scenarioBasis.trend;
      const gezond = model.medischeBeperkingen.gezondheidsstatus === "ok";
      const dataDun = snapshot.sessies.length < 5;

      const huidigeSituatie = dataDun
        ? ONVOLDOENDE_GEGEVENS +
          " Er zijn te weinig sessies om de situatie volledig te duiden."
        : [
            vorm ? `Vorm: ${vorm}.` : null,
            trend ? `Belastingstrend: ${trend}.` : null,
            snapshot.risico
              ? `Risiconiveau: ${snapshot.risico.level === "high" ? "hoog" : snapshot.risico.level === "moderate" ? "verhoogd" : "laag"}.`
              : null,
            !gezond ? "Gezondheidsstatus vraagt aandacht." : null,
          ]
            .filter(Boolean)
            .join(" ");

      const doel =
        strategie.doelhierarchie[0]?.doel ??
        model.doelen.hoofddoel ??
        null;

      const onzeker: string[] = [];
      if (dataDun) onzeker.push("weinig trainingsgegevens");
      if (!snapshot.paraatheid) onzeker.push("geen recente dagmetingen");
      if (snapshot.profiel.ftpEstimated) onzeker.push("ftp is een schatting");

      // Scenario A — huidige lijn vasthouden.
      const scenarioA: DecisionScenario = {
        code: "A",
        naam: "Vasthouden",
        beschrijving:
          "Je traint door op je huidige ritme en belasting; geen koerswijziging.",
        kansVanSlagen: kans(
          risicoHoog ? 35 : risicoMatig ? 55 : 70,
          trend === "stijgend" ? ["je belasting bouwt al gestaag op"] : ["je huidige ritme is bekend terrein"],
          onzeker,
        ),
        risico: risicoHoog ? "hoog" : risicoMatig ? "middel" : "laag",
        benodigdeInspanning: "gelijk aan nu",
        benodigdeTijd:
          model.beschikbareUren != null
            ? `~${model.beschikbareUren} uur per week (huidig budget)`
            : "gelijk aan je huidige weekuren",
        kosten: null,
        verwachteEffecten: [
          trend === "stijgend"
            ? "belasting blijft geleidelijk stijgen"
            : trend === "dalend"
              ? "belasting blijft afnemen"
              : "belasting blijft rond het huidige niveau",
          ...(risicoHoog ? ["het verhoogde risico blijft bestaan"] : []),
        ],
      };

      // Scenario B — gericht opbouwen.
      const scenarioB: DecisionScenario = {
        code: "B",
        naam: "Opbouwen",
        beschrijving:
          "Je verhoogt de belasting stapsgewijs (max ~10% per week) richting je doel.",
        kansVanSlagen: kans(
          !gezond || risicoHoog ? 20 : vorm === "vermoeid" ? 40 : 65,
          gezond && !risicoHoog ? ["er is ruimte in je risicobeeld"] : [],
          [...onzeker, ...(!gezond ? ["gezondheidsstatus staat opbouw in de weg"] : [])],
        ),
        risico: !gezond || risicoHoog ? "hoog" : "middel",
        benodigdeInspanning: "hoger dan nu — extra of zwaardere sessies",
        benodigdeTijd:
          model.beschikbareUren != null
            ? `meer dan ${model.beschikbareUren} uur per week, of zwaardere invulling van dezelfde uren`
            : "meer tijd of zwaardere invulling van je huidige uren",
        kosten: null,
        verwachteEffecten: [
          "hogere opgebouwde belasting binnen 3–6 weken",
          "tijdelijk meer vermoeidheid (negatievere vormbalans)",
        ],
      };

      // Scenario C — herstellen/afbouwen.
      const scenarioC: DecisionScenario = {
        code: "C",
        naam: "Herstellen",
        beschrijving:
          "Je bouwt een week bewust af (rust of alleen rustige duurritten) en herpakt daarna.",
        kansVanSlagen: kans(
          risicoHoog || vorm === "vermoeid" || !gezond ? 80 : 55,
          risicoHoog || vorm === "vermoeid"
            ? ["je lichaam vraagt aantoonbaar om herstel"]
            : ["herstel slaagt vrijwel altijd, maar kost opgebouwde belasting"],
          onzeker,
        ),
        risico: "laag",
        benodigdeInspanning: "lager dan nu",
        benodigdeTijd: "5–7 dagen rustiger trainen",
        kosten: null,
        verwachteEffecten: [
          "vormbalans herstelt richting positief",
          "opgebouwde belasting zakt licht (tijdelijk)",
          ...(risicoHoog ? ["risiconiveau daalt"] : []),
        ],
      };

      const relevantePatronen = patronen.filter((p) => p.soort !== "voorspelling");
      log.info(
        { scenarios: 3, patronenMeegewogen: relevantePatronen.length },
        "foundation.decision-support.build",
      );

      return { huidigeSituatie, doel, scenarios: [scenarioA, scenarioB, scenarioC] };
    },
  };
}
