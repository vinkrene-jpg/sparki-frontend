// Commerciële toegang (taak 385) — leest de eigen rechten van /api/entitlements
// en beantwoordt per Go-onderdeel: mag deze gebruiker dit commercieel zien?
//
// Regels (spiegel van de server, die altijd de echte poort blijft):
//   • legacy_unrestricted ⇒ altijd toegang (bewuste carve-out).
//   • subscription ⇒ alleen bij een expliciet commercieel recht op de key.
//   • Laden of leesfout ⇒ UI faalt OPEN (known=false): we tonen geen valse
//     betaalmuur op een netwerkhikje — de server-side 403 blijft bepalend.
// Operationele feature-flags gelden hiernaast met EN via useFeatureFlags.
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type EntitlementsMe = {
  entitlement_mode: string;
  /** Klantgericht label (Gratis · Sparki Go · Sparki Compleet); nooit een interne variantnaam. */
  product_label: string;
  commercial_features: Record<string, { source: string; expiresAt: string | null }>;
  degraded: boolean;
};

export function useEntitlements() {
  return useQuery({
    queryKey: ["entitlements", "me"],
    queryFn: () => apiFetch<EntitlementsMe>("/api/entitlements"),
    staleTime: 60_000,
    retry: 2,
  });
}

export interface FeatureAccess {
  isLoading: boolean;
  /** Commercieel toegestaan? Bij laden/fout true (UI faalt open, server gated). */
  entitled: boolean;
  /** true zodra het antwoord op echte rechten-data is gebaseerd. */
  known: boolean;
}

export function useFeatureAccess(featureKey: string): FeatureAccess {
  const q = useEntitlements();
  if (q.isLoading) return { isLoading: true, entitled: true, known: false };
  if (!q.data) return { isLoading: false, entitled: true, known: false };
  const entitled =
    q.data.entitlement_mode === "legacy_unrestricted" ||
    !!q.data.commercial_features[featureKey];
  return { isLoading: false, entitled, known: true };
}
