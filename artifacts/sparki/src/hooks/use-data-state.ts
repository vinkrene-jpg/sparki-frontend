import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";

// Zeven-toestandencontract (DATA_TRUST_01 §4) — de server bepaalt, de
// interface toont. De frontend classificeert nooit zelf.

export type DataStateKind =
  | "ok"
  | "geen_data"
  | "onvoldoende_data"
  | "verouderd"
  | "sync_bezig"
  | "providerfout";

export interface DataState {
  domein: string;
  toestand: DataStateKind;
  melding: string | null;
  actie: string | null;
  aantal: number;
  laatsteSync: string | null;
}

export type DataStateDomein = "sessies" | "kalender" | "belasting";

export function useDataState(domein: DataStateDomein, enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["data-origin", "state", domein],
    queryFn: () => apiFetch<DataState>(`/api/data-origin/state/${domein}`),
    enabled: enabled && (isSignedIn === true || DEV_PREVIEW),
    staleTime: 30_000,
  });
}
