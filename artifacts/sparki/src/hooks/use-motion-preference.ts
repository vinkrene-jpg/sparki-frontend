import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { resolveMotionOff, applyMotionAttribute, logMotionError } from "@/lib/motion";

// MEDIA_UITLEG_01 F1 — koppelt systeeminstelling (prefers-reduced-motion) en
// de server-side Sparki-instelling "Verminder beweging" aan de centrale
// uitschakelaar op <html> (data-motion). OR-logica: één van beide aan =
// beweging uit (T-1/T-2). Fail-safe: kan de voorkeur niet worden gelezen, dan
// blijft de systeeminstelling gewoon werken.

type UiPreferences = { reduceMotion: boolean };

function systemPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useMotionPreference() {
  const queryClient = useQueryClient();
  const [systemReduced, setSystemReduced] = useState(systemPrefersReducedMotion);

  // Volg de systeeminstelling live (T-1).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setSystemReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const query = useQuery<UiPreferences>({
    queryKey: ["ui-preferences"],
    queryFn: () => apiFetch<UiPreferences>("/api/ui-preferences"),
    staleTime: 5 * 60 * 1000,
  });

  const sparkiReduced = query.data?.reduceMotion ?? false;
  const motionOff = resolveMotionOff(systemReduced, sparkiReduced);

  // Eén plek die het attribuut zet — componenten raken dit nooit zelf aan.
  useEffect(() => {
    applyMotionAttribute(motionOff);
  }, [motionOff]);

  const mutation = useMutation({
    mutationFn: (reduceMotion: boolean) =>
      apiFetch<UiPreferences>("/api/ui-preferences", {
        method: "PUT",
        body: JSON.stringify({ reduceMotion }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["ui-preferences"], data);
    },
    onError: (err) => {
      // Metadata-only: foutcode, nooit persoonlijke inhoud.
      logMotionError(
        "voorkeur-opslaan-mislukt",
        err instanceof Error ? err.message : "onbekende fout",
      );
    },
  });

  const setSparkiReduced = useCallback(
    (value: boolean) => mutation.mutate(value),
    [mutation],
  );

  return {
    /** Effectief: beweging uit (systeem OF Sparki-instelling). */
    motionOff,
    /** Alleen de systeeminstelling. */
    systemReduced,
    /** Alleen de Sparki-instelling (server-side bewaard). */
    sparkiReduced,
    sparkiReducedLoaded: query.isSuccess,
    setSparkiReduced,
    saving: mutation.isPending,
  };
}

/**
 * Onzichtbare app-brede synchronisatie: mount één keer hoog in de boom zodat
 * data-motion altijd klopt, ook op schermen zonder motion-instellingen.
 */
export function MotionPreferenceSync() {
  useMotionPreference();
  return null;
}
