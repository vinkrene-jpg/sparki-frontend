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

export type TodayRole =
  | "atleet"
  | "trainer"
  | "ouder"
  | "clubbeheer"
  | "hoofdtrainer"
  // Begeleidende clubrollen (02-08): eigen eerlijke rolweergave op de server —
  // het contract moet elke rolwaarde kunnen ontvangen en tonen.
  | "ploegleider"
  | "teammanager"
  | "soigneur"
  | "medical_staff"
  | "vrijwilliger"
  // HERSTEL_EN_AANVULLING_01 F1: elke server-side rolwaarde heeft een eigen
  // weergave — ook deze drie clubrollen en de voedingsspecialist.
  | "assistent"
  | "mechanieker"
  | "alleen_lezen"
  | "voedingsspecialist";

// Eén bron van waarheid voor het zichtbare label per rolweergave.
export const TODAY_ROLE_LABELS: Record<TodayRole, string> = {
  atleet: "Sporter",
  trainer: "Trainer",
  ouder: "Ouder",
  clubbeheer: "Clubbeheer",
  hoofdtrainer: "Hoofdtrainer",
  ploegleider: "Ploegleider",
  teammanager: "Teammanager",
  soigneur: "Soigneur",
  medical_staff: "Medische staf",
  vrijwilliger: "Vrijwilliger",
  assistent: "Assistent",
  mechanieker: "Mechanieker",
  alleen_lezen: "Gast (alleen-lezen)",
  voedingsspecialist: "Voedingsspecialist",
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
  /** WP-T2: welke rolweergave dit is + waar dit account recht op heeft.
   *  HERSTEL_EN_AANVULLING_01 F1 (HA-04): null = geen enkele rolweergave —
   *  de server stuurt dan een eerlijke `emptyState`, nooit het atleetscherm. */
  role: TodayRole | null;
  availableRoles: TodayRole[];
  emptyState?: {
    title: string;
    body: string;
    action: { label: string; href: string };
  };
  /** WP-T3: mag deze gebruiker de onderbouwing zien? (strikte serverpoort). */
  debugAllowed?: boolean;
  /** WP-T3: onderbouwing — alleen aanwezig voor admin/Hoofdtester met ?debug=1. */
  debug?: TodayDebug;
};

export type TodayDebug = {
  profile: TodayResult["profile"];
  role: TodayRole;
  availableRoles: TodayRole[];
  chosen: Record<
    "lead" | "support" | "insight" | "rotating",
    { key: string; source: string; confidence: number | null; urgent: boolean } | null
  >;
  sources: string[];
  passedOver: { key: string; reason: string }[];
  aiUsed: boolean;
  generatedAt: string;
  history: {
    itemKey: string;
    daysShown: number;
    lastShownAt: string;
    clicked: boolean;
  }[];
};

// Zonder rol volgt de server de accountbrede actieve rol; met rol wordt
// server-side getoetst of dit account die rolweergave echt heeft (anders 403).
export function useToday(rol?: TodayRole, opts?: { debug?: boolean }) {
  const { isSignedIn } = useUser();
  const params = new URLSearchParams();
  if (rol) params.set("rol", rol);
  if (opts?.debug) params.set("debug", "1");
  const qs = params.toString();
  return useQuery({
    queryKey: queryKeys.today.orchestrator(
      `${rol ?? ""}${opts?.debug ? ":debug" : ""}` || null,
    ),
    queryFn: () => apiFetch<TodayResult>(`/api/today${qs ? `?${qs}` : ""}`),
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
