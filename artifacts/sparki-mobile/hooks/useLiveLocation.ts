import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";

export type LiveLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedMps: number | null;
  // GPS-nauwkeurigheid in meters (null wanneer het platform die niet meldt).
  accuracyM: number | null;
};

export type PermissionState = "unknown" | "granted" | "denied";

/**
 * Streams the device GPS position. expo-location has no web implementation, so
 * on web we fall back to the browser Geolocation API (Platform.OS check).
 * Honest failure: when permission is denied or GPS is unavailable, `error` is
 * set and no fabricated position is emitted.
 */
export function useLiveLocation(active: boolean) {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<null | (() => void)>(null);
  // Bump om de watch opnieuw op te starten (bv. toestemming keert terug
  // nadat die tijdens een rit was ingetrokken).
  const [restartTick, setRestartTick] = useState(0);
  const permissionRef = useRef<PermissionState>("unknown");
  permissionRef.current = permission;

  // Intrekking-tijdens-rit detecteren (native): het OS stopt de positie-
  // stream stil zonder foutmelding. Daarom controleren we, zolang de stream
  // actief hoort te zijn, periodiek én bij terugkeer naar de voorgrond of de
  // toestemming nog bestaat. Weg → eerlijk "denied" + watch stoppen; terug →
  // watch automatisch herstarten (geen handmatige actie nodig).
  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    let cancelled = false;
    const check = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        const granted = status === "granted";
        if (!granted && permissionRef.current === "granted") {
          // Toestemming tijdens de rit ingetrokken: stream stoppen en het
          // eerlijk melden. De laatst bekende positie blijft staan, maar er
          // komen geen nieuwe (mogelijk verzonnen) posities meer.
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }
          setPermission("denied");
          setError(
            "Locatietoestemming is ingetrokken. Sta locatie weer toe om verder te navigeren.",
          );
        } else if (granted && permissionRef.current === "denied") {
          // Toestemming is terug: watch opnieuw opstarten (auto-hervatten).
          setRestartTick((t) => t + 1);
        }
      } catch {
        // Status onbekend: niets aannemen, volgende controle probeert opnieuw.
      }
    };
    const timer = setInterval(() => void check(), 5000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [active]);

  useEffect(() => {
    let cancelled = false;

    if (!active) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    async function start() {
      // --- Web: browser Geolocation ---
      if (Platform.OS === "web") {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          setError("Locatie wordt niet ondersteund in deze browser.");
          return;
        }
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            if (cancelled) return;
            setPermission("granted");
            setError(null);
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              heading: Number.isFinite(pos.coords.heading)
                ? pos.coords.heading
                : null,
              speedMps: Number.isFinite(pos.coords.speed)
                ? pos.coords.speed
                : null,
              accuracyM: Number.isFinite(pos.coords.accuracy)
                ? pos.coords.accuracy
                : null,
            });
          },
          (err) => {
            if (cancelled) return;
            setPermission("denied");
            setError(
              err.code === err.PERMISSION_DENIED
                ? "Geen toegang tot je locatie. Sta locatie toe om te navigeren."
                : "Je locatie kon niet worden bepaald.",
            );
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
        );
        cleanupRef.current = () => navigator.geolocation.clearWatch(id);
        return;
      }

      // --- Native: expo-location ---
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setPermission("denied");
        setError("Geen toegang tot je locatie. Sta locatie toe om te navigeren.");
        return;
      }
      setPermission("granted");
      setError(null);

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 1000,
        },
        (pos) => {
          if (cancelled) return;
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading:
              pos.coords.heading != null && pos.coords.heading >= 0
                ? pos.coords.heading
                : null,
            speedMps:
              pos.coords.speed != null && pos.coords.speed >= 0
                ? pos.coords.speed
                : null,
            accuracyM:
              pos.coords.accuracy != null && pos.coords.accuracy > 0
                ? pos.coords.accuracy
                : null,
          });
        },
      );
      cleanupRef.current = () => sub.remove();
    }

    start().catch((e) => {
      if (!cancelled) setError(String(e?.message ?? e));
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [active, restartTick]);

  return { location, permission, error };
}
