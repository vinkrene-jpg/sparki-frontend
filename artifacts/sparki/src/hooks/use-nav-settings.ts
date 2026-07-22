import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";

// Toegestane datavelden voor het navigatiescherm. De volgorde in de array
// bepaalt de weergavevolgorde. Moet exact overeenkomen met de server-whitelist.
export const NAV_DATA_FIELDS = [
  "snelheid",
  "gemiddelde",
  "afstand",
  "resterend",
  "tijd",
  "bewegingstijd",
  "eta",
  "hartslag",
  "vermogen",
  "cadans",
  "hoogte",
  "stijging",
] as const;
export type NavDataField = (typeof NAV_DATA_FIELDS)[number];

export type NavFontSize = "klein" | "normaal" | "groot";
export type NavBarPosition = "boven" | "onder";

export type NavSettings = {
  dataFields: NavDataField[];
  maxFields: number;
  fontSize: NavFontSize;
  barPosition: NavBarPosition;
  headingUp: boolean;
  autoClimb: boolean;
  autoPois: boolean;
  autoSprint: boolean;
};

// Haal de opgeslagen navigatie-instellingen op. settings is null wanneer er nog
// nooit iets is opgeslagen — de UI valt dan eerlijk terug op eigen defaults.
export function useNavSettings() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["nav-settings"],
    queryFn: () =>
      apiFetch<{ settings: NavSettings | null }>("/api/nav-settings"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 5 * 60 * 1000,
  });
}

// Sla de navigatie-instellingen op (upsert). Invalideert de query.
export function useSaveNavSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: NavSettings) =>
      apiFetch<{ settings: NavSettings }>("/api/nav-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nav-settings"] });
    },
  });
}
