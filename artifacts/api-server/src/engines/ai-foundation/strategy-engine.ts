// Sparki Foundation — Strategy Engine.
//
// Guards the long-term strategy. Pure and deterministic: goal hierarchy,
// periodisation phase, dependencies, scenario basis, priorities and conflict
// detection — computed only from the athlete model + data snapshot. No model
// calls, no fabrication: unknowns stay null with an honest toelichting.

import type {
  AthleteModel,
  DataSnapshot,
  StrategyConflict,
  StrategyEngine,
  StrategyView,
} from "./contracts";
import { engineLogger } from "./logging";

const log = engineLogger("strategy");

function weeksBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.floor(ms / (7 * 24 * 3600 * 1000));
}

export function createStrategyEngine(): StrategyEngine {
  return {
    build(model: AthleteModel, snapshot: DataSnapshot): StrategyView {
      // ── Doelhiërarchie: ontwikkeldoel > hoofddoel (vrije tekst) > wedstrijden.
      const doelhierarchie: StrategyView["doelhierarchie"] = [];
      if (model.doelen.ontwikkeldoel) {
        doelhierarchie.push({
          niveau: 1,
          doel: model.doelen.ontwikkeldoel,
          bron: "ontwikkeldoel",
        });
      }
      if (model.doelen.hoofddoel) {
        doelhierarchie.push({
          niveau: doelhierarchie.length + 1,
          doel: model.doelen.hoofddoel,
          bron: "eigen woorden",
        });
      }
      const hoofdwedstrijd =
        model.wedstrijdplanning.find((r) => r.priority === "A") ??
        model.wedstrijdplanning[0] ??
        null;
      for (const race of model.wedstrijdplanning.slice(0, 5)) {
        doelhierarchie.push({
          niveau: doelhierarchie.length + 1,
          doel: `${race.name} (${race.raceDate})`,
          bron: race.priority ? `wedstrijd prioriteit ${race.priority}` : "wedstrijd",
        });
      }

      // ── Periodisering: fase afgeleid van weken tot hoofdwedstrijd.
      let fase: string | null = null;
      let wekenTotHoofddoel: number | null = null;
      let toelichting = "Geen wedstrijd gepland — geen periodisering afleidbaar.";
      if (hoofdwedstrijd) {
        wekenTotHoofddoel = weeksBetween(snapshot.peildatum, hoofdwedstrijd.raceDate);
        if (wekenTotHoofddoel <= 1) fase = "piek";
        else if (wekenTotHoofddoel <= 5) fase = "opbouw";
        else fase = "basis";
        toelichting = `Afgeleid van ${hoofdwedstrijd.name} over ${wekenTotHoofddoel} weken.`;
      }

      // ── Afhankelijkheden (deterministisch, expliciet).
      const afhankelijkheden: StrategyView["afhankelijkheden"] = [];
      if (hoofdwedstrijd) {
        afhankelijkheden.push({
          van: "wedstrijdvorm",
          naar: "trainingsbelasting",
          reden: "vorm op de wedstrijddag vraagt een opgebouwde basis vooraf",
        });
      }
      if (model.beschikbareUren != null) {
        afhankelijkheden.push({
          van: "trainingsbelasting",
          naar: "beschikbare uren",
          reden: "de weekbelasting kan nooit boven de beschikbare uren uitkomen",
        });
      }
      if (model.medischeBeperkingen.gezondheidsstatus !== "ok") {
        afhankelijkheden.push({
          van: "alles",
          naar: "gezondheid",
          reden: "herstel gaat voor ieder trainingsdoel",
        });
      }

      // ── Scenario-basis.
      const tsb = snapshot.belasting?.tsb ?? null;
      const scenarioBasis = {
        huidigeVorm:
          tsb == null
            ? null
            : tsb >= 5
              ? "fris"
              : tsb <= -15
                ? "vermoeid"
                : "in balans",
        trend: (() => {
          const chart = snapshot.belasting?.chartData;
          if (!chart || chart.length < 14) return null;
          const eerste = chart[0]!.ctl;
          const laatste = chart[chart.length - 1]!.ctl;
          if (laatste - eerste >= 3) return "stijgend";
          if (eerste - laatste >= 3) return "dalend";
          return "stabiel";
        })(),
      };

      // ── Prioriteiten (volgorde is de uitspraak).
      const prioriteiten: string[] = [];
      if (model.medischeBeperkingen.gezondheidsstatus !== "ok")
        prioriteiten.push("gezondheid en herstel");
      if (fase === "piek") prioriteiten.push("frisheid richting de wedstrijd");
      if (fase === "opbouw") prioriteiten.push("gerichte intensiteit");
      if (fase === "basis" || fase === null) prioriteiten.push("consistente basis");
      if (model.beschikbareUren != null) prioriteiten.push("realistische weekuren");

      // ── Conflictdetectie.
      const conflicten: StrategyConflict[] = [];
      if (
        model.medischeBeperkingen.gezondheidsstatus !== "ok" &&
        hoofdwedstrijd &&
        wekenTotHoofddoel != null &&
        wekenTotHoofddoel <= 4
      ) {
        conflicten.push({
          code: "gezondheid_vs_wedstrijd",
          beschrijving: `Gezondheidsstatus is niet "ok" terwijl ${hoofdwedstrijd.name} over ${wekenTotHoofddoel} weken is.`,
          ernst: "hoog",
        });
      }
      if (tsb != null && tsb <= -20 && fase === "piek") {
        conflicten.push({
          code: "vermoeidheid_vs_piek",
          beschrijving:
            "De vormbalans is sterk negatief terwijl de wedstrijd dichtbij is.",
          ernst: "hoog",
        });
      }
      if (
        model.beschikbareUren != null &&
        model.trainingsgeschiedenis.urenLaatste90d != null &&
        model.trainingsgeschiedenis.urenLaatste90d / 13 >
          model.beschikbareUren * 1.3
      ) {
        conflicten.push({
          code: "uren_vs_werkelijkheid",
          beschrijving:
            "De werkelijke trainingsuren liggen ruim boven het opgegeven weekbudget.",
          ernst: "middel",
        });
      }
      const aRaces = model.wedstrijdplanning.filter((r) => r.priority === "A");
      for (let i = 1; i < aRaces.length; i++) {
        const gap = weeksBetween(aRaces[i - 1]!.raceDate, aRaces[i]!.raceDate);
        if (gap < 4) {
          conflicten.push({
            code: "a_wedstrijden_te_dicht",
            beschrijving: `Twee A-wedstrijden liggen ${gap} weken uit elkaar — te kort voor een volledige piekcyclus.`,
            ernst: "middel",
          });
        }
      }

      log.info(
        { doelen: doelhierarchie.length, fase, conflicten: conflicten.length },
        "foundation.strategy.build",
      );

      return {
        doelhierarchie,
        periodisering: { fase, wekenTotHoofddoel, toelichting },
        afhankelijkheden,
        scenarioBasis,
        prioriteiten,
        conflicten,
      };
    },
  };
}
