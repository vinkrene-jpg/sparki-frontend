// DOELEN_01 — leeftijdsbanden en serverzijdige doelfiltering (DOE-07, DOE-12
// t/m DOE-17). Dit is de ENIGE plek waar de leeftijdsmatrix leeft: routes en
// trainerschermen consumeren deze configuratie via GET /api/goals/policy —
// niets hiervan is hardcoded in de frontend (DOE-46).
//
// Harde regels:
// - Band wordt serverzijdig bepaald uit de geboortedatum; ontbreekt die, dan
//   geldt de MEEST BESCHERMENDE band (<14) tot het profiel is aangevuld.
// - Onder 14: uitsluitend schuifbalkdoelen (thema + richting), geen enkele
//   meetwaarde (DOE-13/14).
// - w/kg, gewicht en 1RM zijn tot 18 jaar uitgesloten als doel (DOE-15) —
//   gekozen, voorgesteld én geaccepteerd.

import { db, athleteProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeAge } from "./age";
import type { GoalAgeBand, GoalKind } from "@workspace/db";

// ── Configuratie (DOE-46: configureerbaar, niet frontend-hardcoded) ──────────

export const SLIDER_THEMES = [
  { key: "plezier", label: "Plezier" },
  { key: "minder_moe", label: "Minder moe" },
  { key: "beter_klimmen", label: "Beter klimmen" },
  { key: "langer_volhouden", label: "Langer volhouden" },
] as const;

type BandConfig = {
  band: GoalAgeBand;
  /** Doelvorm: gewone doelen of schuifbalken. */
  form: "slider" | "regular";
  allowedKinds: GoalKind[];
  /** w/kg, gewicht en 1RM geblokkeerd (DOE-15). */
  blockWeightRelated: boolean;
  /** Gewone taal, voor policy-endpoint en trainerscherm. */
  description: string;
};

export const GOAL_AGE_MATRIX: BandConfig[] = [
  {
    band: "under14",
    form: "slider",
    allowedKinds: ["slider"],
    blockWeightRelated: true,
    description:
      "Schuifbalken per thema — geen getallen, geen prestatie- of eventdoelen.",
  },
  {
    band: "14-16",
    form: "regular",
    allowedKinds: ["event", "gedrag", "prestatie"],
    blockWeightRelated: true,
    description:
      "Event, gedrag en prestatie in absoluut vermogen. Geen w/kg, gewicht of 1RM.",
  },
  {
    band: "16-18",
    form: "regular",
    allowedKinds: ["event", "gedrag", "prestatie"],
    blockWeightRelated: true,
    description: "Alles behalve w/kg, gewicht en 1RM.",
  },
  {
    band: "18+",
    form: "regular",
    allowedKinds: ["event", "gedrag", "prestatie"],
    blockWeightRelated: false,
    description: "Alle doelsoorten.",
  },
];

// ── Band bepalen (DOE-12) ────────────────────────────────────────────────────

export function bandForAge(age: number | null): GoalAgeBand {
  // Onbekende leeftijd ⇒ meest beschermende band, tot de geboortedatum is
  // aangevuld (DOE-12). Bewust fail-closed.
  if (age == null) return "under14";
  if (age < 14) return "under14";
  if (age < 16) return "14-16";
  if (age < 18) return "16-18";
  return "18+";
}

export async function goalAgeBandFor(clerkId: string): Promise<GoalAgeBand> {
  const [profile] = await db
    .select({
      birthDate: athleteProfilesTable.birthDate,
      birthYear: athleteProfilesTable.birthYear,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const age = profile
    ? computeAge(profile.birthDate, profile.birthYear)
    : null;
  return bandForAge(age);
}

export function bandConfig(band: GoalAgeBand): BandConfig {
  return GOAL_AGE_MATRIX.find((b) => b.band === band)!;
}

// ── Validatie (DOE-13/14/15/16) ──────────────────────────────────────────────

// w/kg-, gewichts- en 1RM-doelen herkennen in vrije tekst (measure, target,
// titel). Bewust breed: een gewichtsdoel via een omweg blijft een gewichtsdoel.
const WEIGHT_RELATED = new RegExp(
  [
    "w\\s*/\\s*kg",
    "watt\\s+per\\s+kilo",
    "\\bwkg\\b",
    "\\b1\\s*rm\\b",
    "one\\s*rep\\s*max",
    "gewicht",
    "afvallen",
    "\\bkilo'?s?\\b",
    "\\bkg\\b",
    "vetpercentage",
    "\\bbmi\\b",
  ].join("|"),
  "i",
);

// Uitzondering: "kg" in een vermogenscontext ("300 W", geen kg) komt hier niet
// doorheen omdat we alleen op de doeltekst zelf toetsen; "w/kg" vangt de
// combinatie al af vóór de losse kg-check relevant wordt.

export function isWeightRelatedGoalText(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => typeof t === "string" && WEIGHT_RELATED.test(t));
}

const NUMBER_RE = /\d/;

export type GoalValidationInput = {
  kind: unknown;
  title?: string | null;
  measure?: string | null;
  targetValue?: string | null;
  theme?: string | null;
  themeLevel?: unknown;
};

export type GoalValidation =
  | { ok: true; kind: GoalKind }
  | { ok: false; error: string };

export function isValidGoalKind(v: unknown): v is GoalKind {
  return v === "event" || v === "prestatie" || v === "gedrag" || v === "slider";
}

/**
 * Serverzijdige poort: mag deze gebruiker (band) dit doel aanmaken/voorstellen?
 * Wordt gebruikt door de sporter-routes ÉN het trainervoorstel (DOE-16) —
 * één poort, geen UI-verbergen.
 */
export function validateGoalForBand(
  band: GoalAgeBand,
  input: GoalValidationInput,
): GoalValidation {
  if (!isValidGoalKind(input.kind)) {
    return { ok: false, error: "Ongeldige doelsoort" };
  }
  const cfg = bandConfig(band);
  if (!cfg.allowedKinds.includes(input.kind)) {
    return {
      ok: false,
      error:
        cfg.form === "slider"
          ? "In jouw leeftijd stel je doelen in met schuifbalken per thema"
          : "Deze doelsoort is voor jouw leeftijd niet beschikbaar",
    };
  }

  if (input.kind === "slider") {
    // Schuifbalkdoel: thema verplicht, meetwaarden verboden (DOE-13).
    const theme = typeof input.theme === "string" ? input.theme : "";
    if (!SLIDER_THEMES.some((t) => t.key === theme)) {
      return { ok: false, error: "Kies een thema voor dit doel" };
    }
    const level = Number(input.themeLevel);
    if (!Number.isInteger(level) || level < 0 || level > 100) {
      return { ok: false, error: "Zet de schuifbalk om dit doel in te stellen" };
    }
    if (
      (input.measure && input.measure.trim() !== "") ||
      (input.targetValue && input.targetValue.trim() !== "")
    ) {
      return { ok: false, error: "Een themadoel heeft geen meetwaarde" };
    }
    // Ook getallen in de titel weren we in deze band (DOE-13: geen enkele
    // meetwaarde zichtbaar).
    if (input.title && NUMBER_RE.test(input.title)) {
      return { ok: false, error: "Een themadoel heeft geen getallen nodig" };
    }
    return { ok: true, kind: "slider" };
  }

  if (
    cfg.blockWeightRelated &&
    isWeightRelatedGoalText(input.title, input.measure, input.targetValue)
  ) {
    // DOE-15: vaste, eerlijke uitleg — sterker worden, niet lichter.
    return {
      ok: false,
      error:
        "Doelen rond gewicht, w/kg of maximale kracht zijn tot 18 jaar niet beschikbaar. Kies een doel in absoluut vermogen of gedrag — sterker worden werkt beter dan lichter worden.",
    };
  }

  return { ok: true, kind: input.kind };
}

/** Payload voor GET /api/goals/policy — de frontend rendert hieruit (DOE-46). */
export function policyPayload(band: GoalAgeBand) {
  const cfg = bandConfig(band);
  return {
    band,
    form: cfg.form,
    allowedKinds: cfg.allowedKinds,
    blockWeightRelated: cfg.blockWeightRelated,
    description: cfg.description,
    themes: cfg.form === "slider" ? SLIDER_THEMES : [],
    kinds: [
      { key: "event", label: "Evenement", uitleg: "Een wedstrijd of toertocht op een datum" },
      { key: "prestatie", label: "Prestatie", uitleg: "Bijv. FTP of een PR op een klim" },
      { key: "gedrag", label: "Gedrag", uitleg: "Bijv. uren per week volhouden" },
    ].filter((k) => cfg.allowedKinds.includes(k.key as GoalKind)),
  };
}
