// Translates a training request (bike type + training type + target distance)
// into ORS routing parameters, and writes the Dutch rationale explaining why a
// generated route fits the workout. ORS produces the geometry; this module only
// chooses parameters and writes prose — it never invents geometry or numbers.

import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { BikeType, RouteSurface, TrainingType } from "@workspace/db";

// Average riding speeds (km/h) per bike type, used ONLY to convert a planned
// workout's target *duration* into a target *distance* when no explicit distance
// is given. These are rough estimates and labelled as such to the user.
const SPEED_KMH: Record<BikeType, number> = {
  race: 30,
  gravel: 24,
  mtb: 16,
};

export function estimateDistanceKm(bike: BikeType, durationMin: number): number {
  return Math.round((SPEED_KMH[bike] * (durationMin / 60)) * 10) / 10;
}

// The preferred (not guaranteed) surface for each bike type.
export function preferredSurface(bike: BikeType): RouteSurface {
  switch (bike) {
    case "race":
      return "asfalt";
    case "mtb":
      return "mtb";
    case "gravel":
      return "mixed";
  }
}

// Loop waypoint count per training type. Fewer points → longer, straighter
// uninterrupted stretches (better for intervals); more points → a more varied,
// scenic loop (better for endurance).
export function loopPoints(training: TrainingType): number {
  switch (training) {
    case "interval":
    case "tempo":
    case "wedstrijd":
      return 2;
    case "herstel":
      return 3;
    case "duur":
    default:
      return 5;
  }
}

export const TRAINING_LABEL: Record<TrainingType, string> = {
  duur: "duurtraining",
  interval: "intervaltraining",
  herstel: "hersteltraining",
  tempo: "tempotraining",
  wedstrijd: "wedstrijdsimulatie",
};

export const BIKE_LABEL: Record<BikeType, string> = {
  race: "racefiets",
  gravel: "gravelbike",
  mtb: "mountainbike",
};

export type RationaleInput = {
  bike: BikeType;
  training: TrainingType;
  mode: "loop" | "ab";
  distanceKm: number | null;
  elevationGainM: number | null;
  climbCount: number;
  startName: string | null;
  endName: string | null;
  fromWorkout: boolean;
};

// Deterministic, honest Dutch rationale — always available even if the AI call
// fails. Only states what we actually know from the real route.
export function templateRationale(i: RationaleInput): string {
  const bike = BIKE_LABEL[i.bike];
  const training = TRAINING_LABEL[i.training];
  const dist = i.distanceKm != null ? `${i.distanceKm} km` : "onbekende afstand";
  const climb =
    i.elevationGainM != null ? ` met ${i.elevationGainM} hoogtemeters` : "";
  const shape =
    i.mode === "loop"
      ? `Een rondje van ${dist}${climb}`
      : `Een route van ${dist}${climb}`;

  let fit: string;
  switch (i.training) {
    case "interval":
    case "tempo":
    case "wedstrijd":
      fit =
        "met zo min mogelijk onderbrekingen, zodat je je blokken in één lijn kunt rijden";
      break;
    case "herstel":
      fit = "rustig en vlak gehouden voor een actief herstel";
      break;
    case "duur":
    default:
      fit = "met afwisseling, geschikt voor een rustige duurinspanning";
      break;
  }

  return `${shape} op de ${bike}, gekozen voor je ${training} ${fit}. De ondergrond is geoptimaliseerd voor je fietstype (niet gegarandeerd).`;
}

// AI-written rationale grounded in the REAL route facts. Falls back to the
// template on any failure so the feature never breaks.
export async function generateRationale(i: RationaleInput): Promise<string> {
  const facts = [
    `Fietstype: ${BIKE_LABEL[i.bike]}`,
    `Trainingstype: ${TRAINING_LABEL[i.training]}`,
    `Routevorm: ${i.mode === "loop" ? "rondje (zelfde start/finish)" : "A naar B"}`,
    i.distanceKm != null ? `Afstand: ${i.distanceKm} km` : null,
    i.elevationGainM != null ? `Hoogtemeters: ${i.elevationGainM} m` : null,
    `Aantal gedetecteerde klimmen: ${i.climbCount}`,
    i.startName ? `Start: ${i.startName}` : null,
    i.endName ? `Bestemming: ${i.endName}` : null,
    i.fromWorkout
      ? "Afstand is afgeleid van de geplande training van de atleet."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "Je bent Sparki, een Nederlandstalige wielercoach. Schrijf een korte, eerlijke uitleg (2-3 zinnen) waarom een gegenereerde route past bij de training. Gebruik ALLEEN de gegeven feiten — verzin geen afstanden, plaatsen of beloftes. De routemachine kan een ondergrond of rustige wegen alleen 'voorkeur geven', niet garanderen: zeg dat eerlijk waar relevant. Geen opsomming, geen markdown, alleen lopende tekst.",
      messages: [
        {
          role: "user",
          content: `Routefeiten:\n${facts}\n\nSchrijf de uitleg.`,
        },
      ],
    });
    const block = message.content[0];
    if (block && block.type === "text" && block.text.trim()) {
      return block.text.trim();
    }
  } catch {
    // fall through to template
  }
  return templateRationale(i);
}
