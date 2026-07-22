import { customFetch } from "@workspace/api-client-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveLocation } from "@/hooks/useLiveLocation";
import {
  COUNTDOWN_SECONDS,
  dismissFall,
  feedSpeed,
  initialFallState,
  type FallDetectorState,
} from "@/lib/fall-detection";

// Val-alarm tijdens een rit. Detectie draait op de echte GPS-snelheid; bij
// een vermoedelijke val verschijnt "Alles oké?" met een aftelling van 30 s.
// Geen reactie → gekoppelde coach/ouders krijgen een melding met je locatie.
// Eerlijk: het resultaat meldt hoeveel meldingen zijn KLAARGEZET (0 is 0) —
// nooit een belofte dat iemand ze al gezien heeft.

export type FallAlert =
  | { phase: "asking"; secondsLeft: number }
  | { phase: "sending" }
  | { phase: "sent"; notified: number }
  | { phase: "error"; message: string };

export function useFallDetection(location: LiveLocation | null, active: boolean) {
  const [alert, setAlert] = useState<FallAlert | null>(null);
  const alertRef = useRef<FallAlert | null>(null);
  alertRef.current = alert;
  const stateRef = useRef<FallDetectorState>(initialFallState());
  const locationRef = useRef(location);
  locationRef.current = location;

  const sendAlert = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) {
      setAlert({
        phase: "error",
        message: "Geen locatie beschikbaar — er kon geen melding worden klaargezet.",
      });
      return;
    }
    setAlert({ phase: "sending" });
    try {
      const data = await customFetch<{ notified?: number }>("/api/alerts/crash", {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: loc.latitude,
          lon: loc.longitude,
          speedKmh: loc.speedMps != null ? loc.speedMps * 3.6 : undefined,
        }),
      });
      setAlert({ phase: "sent", notified: data.notified ?? 0 });
    } catch (err) {
      setAlert({
        phase: "error",
        message:
          (err as Error)?.message ??
          "De melding kon niet worden klaargezet. Controleer je verbinding.",
      });
    }
  }, []);

  const dismiss = useCallback(() => {
    stateRef.current = dismissFall(stateRef.current, Date.now());
    setAlert(null);
  }, []);

  // Detectie op elke nieuwe GPS-meting.
  useEffect(() => {
    if (!active || !location || location.speedMps == null) return;
    const now = Date.now();
    const { state, trigger } = feedSpeed(
      stateRef.current,
      location.speedMps * 3.6,
      now,
      alertRef.current != null,
    );
    stateRef.current = state;
    if (trigger) {
      setAlert({ phase: "asking", secondsLeft: COUNTDOWN_SECONDS });
    }
  }, [location, active]);

  // Aftelling: geen reactie binnen 30 s → automatisch melding klaarzetten.
  useEffect(() => {
    if (!alert || alert.phase !== "asking") return;
    if (alert.secondsLeft <= 0) {
      void sendAlert();
      return;
    }
    const id = setTimeout(() => {
      setAlert((a) =>
        a && a.phase === "asking"
          ? { phase: "asking", secondsLeft: a.secondsLeft - 1 }
          : a,
      );
    }, 1000);
    return () => clearTimeout(id);
  }, [alert, sendAlert]);

  // Rit gestopt → open alarm opruimen (behalve een al verstuurde/foutmelding,
  // die mag de renner nog lezen) én de detector volledig resetten, zodat een
  // oude "snelle fase" nooit doorlekt naar een volgende rit en daar een vals
  // alarm veroorzaakt.
  useEffect(() => {
    if (!active) {
      stateRef.current = initialFallState();
      if (alertRef.current?.phase === "asking") setAlert(null);
    }
  }, [active]);

  // Sluiten na verstuurd/fout: zelfde rustperiode als "Ik ben oké", anders
  // verschijnt de vraag direct opnieuw zolang de renner nog stilstaat.
  const close = useCallback(() => {
    stateRef.current = dismissFall(stateRef.current, Date.now());
    setAlert(null);
  }, []);

  return { alert, dismiss, sendNow: sendAlert, close };
}
