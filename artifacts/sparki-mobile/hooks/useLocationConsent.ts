import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";

/**
 * Golf 28 — zorgt dat de systeemvraag om locatietoegang NOOIT ongevraagd bij
 * het openen van een scherm verschijnt. `ready` is pas true wanneer:
 * 1. de toegang al eerder is verleend (stille check, geen systeemvraag), of
 * 2. de renner na de uitlegkaart expliciet "Ga verder" koos (`consent()`).
 * Schermen geven `ready` door als `active` aan `useLiveLocation`, dat pas dán
 * de echte systeemvraag stelt.
 */
export function useLocationConsent(): {
  // True zodra de locatiestream mag starten (verleend of bewust ingestemd).
  ready: boolean;
  // True zodra de stille status-check klaar is (voorkomt uitleg-flits).
  checked: boolean;
  consent: () => void;
} {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (cancelled) return;
        if (status === "granted") setReady(true);
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const consent = useCallback(() => setReady(true), []);

  return { ready, checked, consent };
}
