import { createContext, useContext, type ReactNode } from "react";
import type { CoachDecision } from "@/lib/coach-engine";

// Carries the resolved Coach Decision from the DayHome dispatcher down to the
// shared ScreenShell, so the engine output renders on Home regardless of which
// day-type homepage is shown. Null when there is no decision (e.g. no profile).
const CoachDecisionContext = createContext<CoachDecision | null>(null);

export function CoachDecisionProvider({
  value,
  children,
}: {
  value: CoachDecision | null;
  children: ReactNode;
}) {
  return (
    <CoachDecisionContext.Provider value={value}>
      {children}
    </CoachDecisionContext.Provider>
  );
}

export function useCoachDecision(): CoachDecision | null {
  return useContext(CoachDecisionContext);
}
