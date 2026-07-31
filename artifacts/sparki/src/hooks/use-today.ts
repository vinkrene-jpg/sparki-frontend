import { useMutation, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// Leespad voor de Today Orchestrator (engines/today in de api-server): welke
// boodschap nu bovenaan Vandaag hoort, met onderbouwing, inzicht en één
// wisselend blok. Deterministisch samengesteld uit bestaande engines — dit is
// een presentatiecontract, geen nieuwe databron.

export type TodayVariant =
  | "jeugd"
  | "wedstrijd"
  | "prestatie"
  | "recreatief"
  | "beginner";

export type TodayAction = { id: string; label: string; href: string };

export type TodayItem = {
  key: string;
  slot: "lead" | "support" | "insight" | "rotating";
  title: string;
  body: string;
  actions: TodayAction[];
  source: string;
  confidence: number | null;
  urgent: boolean;
};

export type TodayResult = {
  date: string;
  profile: {
    variant: TodayVariant;
    age: number | null;
    minor: boolean;
    activeRole: string;
  };
  lead: TodayItem | null;
  support: TodayItem | null;
  insight: TodayItem | null;
  rotating: TodayItem | null;
};

export function useToday() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.today.orchestrator(),
    queryFn: () => apiFetch<TodayResult>("/api/today"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

/** Klik/afronding terugmelden zodat de weergavehistorie eerlijk blijft. */
export function useTodayInteraction() {
  return useMutation({
    mutationFn: (input: { itemKey: string; action: "clicked" | "completed" }) =>
      apiFetch<{ ok: boolean }>("/api/today/interactions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
