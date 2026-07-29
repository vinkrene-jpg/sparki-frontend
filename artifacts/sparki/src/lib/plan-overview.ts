// Pure logica voor het professionele planoverzicht op /train.
// Alles hier is deterministisch en testbaar zonder DOM of netwerk:
// - niveaukeuze → welke wizardstappen een sporter te zien krijgt
// - gedempte doelverschuiving (pas melden bij betekenisvolle impact)
// - plan-naleving over een venster (gepland vs. aantoonbaar uitgevoerd)

import type { PlannedWorkout } from "@/lib/athlete-types";

// ── Niveaus (adaptieve wizard) ───────────────────────────────────────────────

export type NiveauId = "recreatief" | "sportief" | "wedstrijd" | "continentaal";

export type Niveau = {
  id: NiveauId;
  label: string;
  beschrijving: string;
  /** Backend-enum voor athlete_profiles.experienceLevel */
  experienceLevel: "beginner" | "intermediate" | "advanced" | "elite";
};

export const NIVEAUS: Niveau[] = [
  {
    id: "recreatief",
    label: "Recreatief",
    beschrijving: "Ik fiets voor plezier en fitheid — geen wedstrijden.",
    experienceLevel: "beginner",
  },
  {
    id: "sportief",
    label: "Sportief",
    beschrijving: "Ik train gericht en wil beter worden (toertochten, gran fondo's).",
    experienceLevel: "intermediate",
  },
  {
    id: "wedstrijd",
    label: "Wedstrijd",
    beschrijving: "Ik rijd (regionale) wedstrijden en train daar serieus voor.",
    experienceLevel: "advanced",
  },
  {
    id: "continentaal",
    label: "Nationaal / continentaal",
    beschrijving: "Ik koers op hoog niveau — mijn planning moet daarop sturen.",
    experienceLevel: "elite",
  },
];

export type WizardStapId =
  | "niveau"
  | "beschikbaarheid"
  | "agenda"
  | "belastbaarheid"
  | "voorkeuren"
  | "samenvatting";

/**
 * Adaptief: hoe hoger het niveau, hoe meer vragen.
 * - recreatief: niveau + beschikbaarheid + agenda
 * - sportief: + belastbaarheid/blessures
 * - wedstrijd/continentaal: + trainingsvoorkeuren & discipline
 */
export function wizardStappenVoorNiveau(niveau: NiveauId): WizardStapId[] {
  const basis: WizardStapId[] = ["niveau", "beschikbaarheid", "agenda"];
  if (niveau === "recreatief") return [...basis, "samenvatting"];
  if (niveau === "sportief") return [...basis, "belastbaarheid", "samenvatting"];
  return [...basis, "belastbaarheid", "voorkeuren", "samenvatting"];
}

// ── Gedempte doelverschuiving ────────────────────────────────────────────────

export type Doelverschuiving = {
  /** Alleen true bij betekenisvolle impact — kleine missers blijven stil. */
  tonen: boolean;
  gemisteTrainingen: number;
  geplandeMinuten: number;
  gemisteMinuten: number;
  boodschap: string | null;
};

function isGemist(w: PlannedWorkout, vandaagISO: string): boolean {
  return (
    w.scheduledDate < vandaagISO &&
    w.type !== "rest" &&
    (w.status === "planned" || w.status === "modified") &&
    w.sessionId == null
  );
}

/**
 * Kijkt naar de afgelopen `dagen` (standaard 14) en meldt een verschuiving
 * van het doel alléén als de impact betekenisvol is:
 * ≥3 gemiste trainingen, of ≥50% van de geplande minuten niet aantoonbaar
 * uitgevoerd (bij minimaal 2 geplande trainingen). Eén gemiste rit of een
 * dagelijkse aanpassing verschuift het doel dus nooit zichtbaar.
 */
export function berekenDoelverschuiving(
  workouts: PlannedWorkout[],
  vandaagISO: string,
  dagen = 14,
): Doelverschuiving {
  const vanaf = new Date(vandaagISO + "T12:00:00Z");
  vanaf.setUTCDate(vanaf.getUTCDate() - dagen);
  const vanafISO = vanaf.toISOString().slice(0, 10);

  const venster = workouts.filter(
    (w) =>
      w.scheduledDate >= vanafISO &&
      w.scheduledDate < vandaagISO &&
      w.type !== "rest" &&
      w.status !== "cancelled" &&
      w.status !== "skipped",
  );

  const geplandeMinuten = venster.reduce(
    (som, w) => som + (w.targetDurationMin ?? 0),
    0,
  );
  const gemiste = venster.filter((w) => isGemist(w, vandaagISO));
  const gemisteMinuten = gemiste.reduce(
    (som, w) => som + (w.targetDurationMin ?? 0),
    0,
  );

  const veelGemist = gemiste.length >= 3;
  const halfGemist =
    venster.length >= 2 &&
    geplandeMinuten > 0 &&
    gemisteMinuten / geplandeMinuten >= 0.5;

  const tonen = veelGemist || halfGemist;
  let boodschap: string | null = null;
  if (tonen) {
    const uren = Math.round((gemisteMinuten / 60) * 10) / 10;
    boodschap =
      `In de afgelopen ${dagen} dagen zijn ${gemiste.length} geplande trainingen` +
      ` (±${uren} uur) niet aantoonbaar uitgevoerd. Dat is genoeg om je opbouw` +
      ` te vertragen — houd rekening met een iets latere piek of pas je plan aan.`;
  }

  return {
    tonen,
    gemisteTrainingen: gemiste.length,
    geplandeMinuten,
    gemisteMinuten,
    boodschap,
  };
}

// ── Plan-naleving (voor /train én /analyse) ─────────────────────────────────

export type PlanNaleving = {
  gepland: number;
  uitgevoerd: number;
  /** null zolang er te weinig geplande trainingen zijn om iets te zeggen */
  pct: number | null;
};

/**
 * Naleving over de afgelopen `dagen`: hoeveel geplande (niet-rust, niet-
 * geannuleerde/overgeslagen) trainingen zijn aantoonbaar uitgevoerd
 * (gekoppelde sessie of status completed). Uploads en connector-imports
 * tellen mee zodra de bestaande koppeling ze aan een training linkt.
 */
export function berekenPlanNaleving(
  workouts: PlannedWorkout[],
  vandaagISO: string,
  dagen = 28,
): PlanNaleving {
  const vanaf = new Date(vandaagISO + "T12:00:00Z");
  vanaf.setUTCDate(vanaf.getUTCDate() - dagen);
  const vanafISO = vanaf.toISOString().slice(0, 10);

  const venster = workouts.filter(
    (w) =>
      w.scheduledDate >= vanafISO &&
      w.scheduledDate < vandaagISO &&
      w.type !== "rest" &&
      w.status !== "cancelled" &&
      w.status !== "skipped",
  );
  const uitgevoerd = venster.filter(
    (w) => w.sessionId != null || w.status === "completed",
  );

  return {
    gepland: venster.length,
    uitgevoerd: uitgevoerd.length,
    pct:
      venster.length >= 3
        ? Math.round((uitgevoerd.length / venster.length) * 100)
        : null,
  };
}

// ── Seizoenslijn ────────────────────────────────────────────────────────────

const FASE_LABEL: Record<string, string> = {
  base: "Basis",
  build: "Opbouw",
  peak: "Piek",
  taper: "Taper",
};

export function faseLabel(fase: string | null | undefined): string | null {
  if (!fase) return null;
  return FASE_LABEL[fase] ?? null;
}
