// Centrale humor-hook — leest het per gebruiker opgeslagen humorniveau
// ("Instellingen > Sparki-stijl > Humor") en levert contextregels uit de
// centrale humorlaag (lib/humor.ts). Componenten bevatten zelf geen grappen.

import { useMemo } from "react";
import { useAiPreferences } from "@/hooks/use-ai-memory";
import {
  humorLine,
  HUMOR_LEVELS,
  type HumorContext,
  type HumorLevel,
} from "@/lib/humor";

/** Huidig humorniveau van de gebruiker; "normaal" zolang niets is opgeslagen. */
export function useHumorLevel(): HumorLevel {
  const { data } = useAiPreferences();
  const raw = data?.preferences?.humorLevel;
  return (HUMOR_LEVELS as readonly string[]).includes(String(raw))
    ? (raw as HumorLevel)
    : "normaal";
}

/**
 * Eén humorregel voor een context, of null (niveau "uit", of prefs nog aan het
 * laden). Stabiel per mount zodat de regel niet flikkert bij re-renders.
 */
export function useHumorLine(context: HumorContext, seedSalt = ""): string | null {
  const { data, isSuccess } = useAiPreferences();
  const raw = data?.preferences?.humorLevel;
  const level: HumorLevel | null = isSuccess
    ? (HUMOR_LEVELS as readonly string[]).includes(String(raw))
      ? (raw as HumorLevel)
      : "normaal"
    : null;
  return useMemo(
    () => (level ? humorLine(context, level, seedSalt) : null),
    [context, level, seedSalt],
  );
}
