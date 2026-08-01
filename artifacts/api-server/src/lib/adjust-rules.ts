// Deterministische aanpassingsregels (Golf 23).
//
// Sparki's aanpassingsvoorstel op sporterfeedback wordt HIER berekend — niet
// door het taalmodel. Het model mag alleen de kop en de coachende toelichting
// verwoorden; de aanbeveling, de concrete wijzigingen, de onderbouwing (basis)
// en de zekerheid komen uit deze pure functie en zijn dus reproduceerbaar,
// testbaar en nooit "creatief". Bij pijn/vermoeidheid wordt het NOOIT zwaarder.

export type AdjustRecommendation =
  | "keep"
  | "adjust"
  | "move"
  | "recovery"
  | "replan_week";

export interface AdjustChanges {
  targetDurationMin?: number;
  targetTSS?: number;
  intensity?: string;
  newDate?: string;
  title?: string;
}

export interface AdjustDecision {
  recommendation: AdjustRecommendation;
  changes: AdjustChanges | null;
  /** Eerlijke, letterlijk toonbare onderbouwing (Nederlands). */
  basis: string[];
  /** 0–1, nooit 1.0 — een voorstel blijft een inschatting. */
  confidence: number;
  /** Deterministische Nederlandse fallback-kop/-boodschap (zonder model). */
  fallbackTitle: string;
  fallbackMessage: string;
}

export interface AdjustInput {
  feedbackType: string;
  rpe?: number | null;
  completion?: string | null; // volledig | gedeeltelijk | niet
  workout: {
    targetDurationMin: number | null;
    targetTSS: number | null;
    scheduledDate: string; // YYYY-MM-DD
    title: string | null;
  };
  /** Vandaag als YYYY-MM-DD (aanroeper bepaalt de klok — testbaar). */
  today: string;
}

function round5(n: number): number {
  return Math.max(20, Math.round(n / 5) * 5);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0]!;
}

export function decideAdjustment(input: AdjustInput): AdjustDecision {
  const { feedbackType, rpe, completion, workout, today } = input;
  const dur = workout.targetDurationMin;
  const tss = workout.targetTSS;
  const basis: string[] = [];

  switch (feedbackType) {
    case "pain": {
      basis.push("Je meldt pijn of een blessuregevoel — dan wordt een training nooit zwaarder.");
      const changes: AdjustChanges = { intensity: "herstel" };
      if (dur != null) {
        changes.targetDurationMin = round5(dur * 0.5);
        basis.push(`Duur gehalveerd: ${dur} → ${changes.targetDurationMin} minuten.`);
      }
      if (tss != null) {
        changes.targetTSS = Math.max(10, Math.round(tss * 0.4));
        basis.push(`Belasting fors terug: ${tss} → ${changes.targetTSS} TSS.`);
      }
      return {
        recommendation: "recovery",
        changes,
        basis,
        confidence: 0.8,
        fallbackTitle: "Herstel gaat voor",
        fallbackMessage:
          "Je meldt pijn. Hier wordt een rustige hersteltraining van gemaakt — korter en licht. Houdt de pijn aan, sla dan liever over en laat ernaar kijken.",
      };
    }
    case "tired": {
      basis.push("Je voelt je vermoeid of niet hersteld.");
      const heavyRpe = rpe != null && rpe >= 8;
      if (heavyRpe) basis.push(`Je inspanningsscore (RPE ${rpe}) bevestigt dat het zwaar viel.`);
      const changes: AdjustChanges = { intensity: "herstel" };
      if (dur != null) {
        changes.targetDurationMin = round5(dur * 0.7);
        basis.push(`Duur teruggebracht: ${dur} → ${changes.targetDurationMin} minuten.`);
      }
      if (tss != null) {
        changes.targetTSS = Math.max(10, Math.round(tss * 0.6));
        basis.push(`Belasting omlaag: ${tss} → ${changes.targetTSS} TSS.`);
      }
      return {
        recommendation: "recovery",
        changes,
        basis,
        confidence: heavyRpe ? 0.85 : 0.75,
        fallbackTitle: "Vandaag rustig herstellen",
        fallbackMessage:
          "Je bent niet hersteld genoeg voor de geplande belasting. Een kortere hersteltraining wordt voorgesteld, zodat je morgen weer verder kunt bouwen.",
      };
    }
    case "too_hard": {
      basis.push("Je vond de training te zwaar.");
      const extreme = rpe != null && rpe >= 9;
      if (rpe != null) basis.push(`Inspanningsscore: RPE ${rpe}.`);
      if (completion === "gedeeltelijk" || completion === "niet")
        basis.push("De training is niet volledig afgemaakt.");
      if (extreme) {
        const changes: AdjustChanges = { intensity: "herstel" };
        if (dur != null) changes.targetDurationMin = round5(dur * 0.6);
        if (tss != null) changes.targetTSS = Math.max(10, Math.round(tss * 0.5));
        basis.push("Bij RPE 9–10 gaat de keuze naar herstel in plaats van bijschaven.");
        return {
          recommendation: "recovery",
          changes,
          basis,
          confidence: 0.85,
          fallbackTitle: "Even gas terug",
          fallbackMessage:
            "Dit was op het randje. De volgende prikkel wordt omgezet naar herstel zodat je lichaam de zware sessie kan verwerken.",
        };
      }
      const changes: AdjustChanges = {};
      if (dur != null) {
        changes.targetDurationMin = round5(dur * 0.8);
        basis.push(`Duur iets terug: ${dur} → ${changes.targetDurationMin} minuten.`);
      }
      if (tss != null) {
        changes.targetTSS = Math.max(10, Math.round(tss * 0.8));
        basis.push(`Belasting iets terug: ${tss} → ${changes.targetTSS} TSS.`);
      }
      if (dur == null && tss == null)
        basis.push("Deze training heeft geen duur- of belastingsdoel; alleen de intensiteit gaat omlaag.");
      if (Object.keys(changes).length === 0) changes.intensity = "rustiger";
      return {
        recommendation: "adjust",
        changes,
        basis,
        confidence: rpe != null ? 0.8 : 0.7,
        fallbackTitle: "Iets lichter bijgesteld",
        fallbackMessage:
          "Te zwaar is een eerlijk signaal. Er wordt ongeveer 20% minder belasting voorgesteld, zodat je de training wél goed kunt afmaken.",
      };
    }
    case "too_light": {
      basis.push("Je vond de training te licht.");
      if (rpe != null) basis.push(`Inspanningsscore: RPE ${rpe}.`);
      const changes: AdjustChanges = {};
      if (tss != null) {
        changes.targetTSS = Math.round(tss * 1.15);
        basis.push(`Belasting omhoog: ${tss} → ${changes.targetTSS} TSS (+15%).`);
      } else {
        changes.targetTSS = 60;
        basis.push("Geen belastingsdoel bekend — er wordt voorzichtig gestart op 60 TSS.");
      }
      if (dur != null) {
        changes.targetDurationMin = round5(dur * 1.1);
        basis.push(`Duur iets omhoog: ${dur} → ${changes.targetDurationMin} minuten.`);
      }
      return {
        recommendation: "adjust",
        changes,
        basis,
        confidence: 0.75,
        fallbackTitle: "Volgende keer iets zwaarder",
        fallbackMessage:
          "Goed teken dat dit makkelijk voelde. De belasting gaat met een kleine, veilige stap omhoog — groot genoeg om te prikkelen, klein genoeg om te herstellen.",
      };
    }
    case "move": {
      const newDate = workout.scheduledDate > today ? addDays(workout.scheduledDate, 1) : addDays(today, 1);
      basis.push("Je wilt de training verplaatsen.");
      basis.push(`Voorstel: naar ${newDate} (eerstvolgende dag).`);
      return {
        recommendation: "move",
        changes: { newDate },
        basis,
        confidence: 0.7,
        fallbackTitle: "Training verplaatst",
        fallbackMessage:
          "De training schuift één dag op. Komt die dag ook niet uit, kies dan zelf een andere datum — de inhoud blijft gelijk.",
      };
    }
    case "missed": {
      const newDate = addDays(today, 1);
      basis.push("De training is gemist — niets aan de hand, we plannen hem opnieuw in.");
      basis.push(`Voorstel: morgen (${newDate}).`);
      return {
        recommendation: "move",
        changes: { newDate },
        basis,
        confidence: 0.7,
        fallbackTitle: "Opnieuw ingepland",
        fallbackMessage:
          "Een gemiste training haal je niet in door te stapelen. Dezelfde training komt op morgen; de rest van de week blijft in balans.",
      };
    }
    default: {
      // done + alles wat geen aanpassing vraagt.
      basis.push("De training is volgens plan verlopen — geen aanpassing nodig.");
      if (rpe != null) basis.push(`Inspanningsscore: RPE ${rpe}.`);
      return {
        recommendation: "keep",
        changes: null,
        basis,
        confidence: 0.9,
        fallbackTitle: "Lekker bezig — plan blijft staan",
        fallbackMessage:
          "Deze training is goed uitgevoerd. Er verandert niets; het schema klopt zo.",
      };
    }
  }
}
