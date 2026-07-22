import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { uploadQueuedRide } from "@/lib/routes-api";
import {
  discardQueuedRide,
  processUploadQueue,
  subscribeUploadQueue,
  type QueuedRide,
} from "@/lib/upload-queue";

/**
 * Live zicht op de lokale rit-uploadwachtrij + automatische verwerking.
 *
 * `autoProcess: true` (alleen op de plek die de app-brede verwerking bezit,
 * de ingelogde app-layout) probeert de wachtrij bij het openen van de app en
 * telkens wanneer de app weer actief wordt. Alle andere schermen gebruiken de
 * hook alleen-lezen zodat er nooit twee verwerkers tegelijk draaien (de
 * wachtrij zelf heeft daarnaast nog een in-flight-slot).
 */
export function useUploadQueue(opts: { autoProcess?: boolean } = {}) {
  const { autoProcess = false } = opts;
  const qc = useQueryClient();
  const [queue, setQueue] = useState<QueuedRide[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => subscribeUploadQueue(setQueue), []);

  const process = useCallback(
    async (force: boolean) => {
      setProcessing(true);
      try {
        const result = await processUploadQueue(uploadQueuedRide, { force });
        if (result.uploaded.length > 0) {
          qc.invalidateQueries({ queryKey: ["routes"] });
          qc.invalidateQueries({ queryKey: ["sessions"] });
        }
        return result;
      } finally {
        setProcessing(false);
      }
    },
    [qc],
  );

  // Handmatig "Opnieuw proberen" — negeert de wachttijd.
  const retryNow = useCallback(() => process(true), [process]);

  // Bewust weggooien van een rit die nog niet gesynchroniseerd is.
  const discard = useCallback(async (localId: string) => {
    await discardQueuedRide(localId);
  }, []);

  useEffect(() => {
    if (!autoProcess) return;
    void process(false);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void process(false);
    });
    return () => sub.remove();
  }, [autoProcess, process]);

  return { queue, processing, retryNow, discard };
}
