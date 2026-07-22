import AsyncStorage from "@react-native-async-storage/async-storage";

// Betrouwbare, idempotente rit-synchronisatie.
//
// Elke gestopte rit krijgt een lokaal rit-ID en wordt EERST als GPX in deze
// wachtrij op de telefoon bewaard. Pas nadat de backend de upload met een
// 2xx heeft bevestigd wordt het wachtrij-item verwijderd. Mislukt de upload
// (geen netwerk, serverfout), dan blijft de rit veilig lokaal staan en wordt
// hij automatisch opnieuw geprobeerd — zonder dubbele activiteiten, want de
// backend ontdubbelt op de inhoud van het GPX-bestand zelf (zelfde bestand =
// zelfde activiteit). Niets wordt verzonnen: de wachtrij bevat uitsluitend de
// echte opgenomen GPX-inhoud.

const QUEUE_KEY = "sparki:upload-queue";

export type QueuedRide = {
  // Lokaal rit-ID, toegekend op het moment van opslaan. Blijft gelijk over
  // alle pogingen heen zodat een rit nooit dubbel in de wachtrij komt.
  localId: string;
  fileName: string;
  gpx: string;
  name: string;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  lastTriedAt: number | null;
};

export type UploadOutcome =
  | { ok: true; sessionId: number | null }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Pure helpers (getest in lib/upload-queue.test.ts)
// ---------------------------------------------------------------------------

/** Lokaal rit-ID: tijdstip + random, uniek genoeg binnen één telefoon. */
export function makeLocalRideId(now: number, rand: () => number = Math.random): string {
  const suffix = Math.floor(rand() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `rit-${now}-${suffix}`;
}

/**
 * Voeg een rit toe of vervang de bestaande met hetzelfde localId — een rit
 * kan nooit twee keer in de wachtrij staan.
 */
export function upsertQueued(list: QueuedRide[], entry: QueuedRide): QueuedRide[] {
  const rest = list.filter((e) => e.localId !== entry.localId);
  return [...rest, entry].sort((a, b) => a.createdAt - b.createdAt);
}

export function removeQueued(list: QueuedRide[], localId: string): QueuedRide[] {
  return list.filter((e) => e.localId !== localId);
}

/** Registreer een mislukte poging op het juiste item (immutable). */
export function markAttemptFailed(
  list: QueuedRide[],
  localId: string,
  error: string,
  now: number,
): QueuedRide[] {
  return list.map((e) =>
    e.localId === localId
      ? { ...e, attempts: e.attempts + 1, lastError: error, lastTriedAt: now }
      : e,
  );
}

// Wachttijd tussen automatische pogingen: 15s, 1m, 5m, daarna elke 15m.
const RETRY_STEPS_MS = [15_000, 60_000, 300_000];
const RETRY_MAX_MS = 900_000;

export function nextRetryDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return RETRY_STEPS_MS[attempts - 1] ?? RETRY_MAX_MS;
}

/** Mag dit item nu (opnieuw) geprobeerd worden? Handmatig proberen mag altijd. */
export function isDueForRetry(entry: QueuedRide, now: number): boolean {
  if (entry.attempts === 0 || entry.lastTriedAt == null) return true;
  return now - entry.lastTriedAt >= nextRetryDelayMs(entry.attempts);
}

function parseQueue(raw: string | null): QueuedRide[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is QueuedRide =>
        !!e &&
        typeof (e as QueuedRide).localId === "string" &&
        typeof (e as QueuedRide).gpx === "string" &&
        typeof (e as QueuedRide).fileName === "string",
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// AsyncStorage-gedragen wachtrij
// ---------------------------------------------------------------------------

type Listener = (queue: QueuedRide[]) => void;
const listeners = new Set<Listener>();

async function readQueue(): Promise<QueuedRide[]> {
  try {
    return parseQueue(await AsyncStorage.getItem(QUEUE_KEY));
  } catch {
    return [];
  }
}

// Fail-closed: een schrijffout wordt NIET verzwegen. Wie hierop vertrouwt
// ("de rit staat veilig op je telefoon") mag dat alleen claimen als het
// schrijven echt gelukt is.
async function writeQueue(queue: QueuedRide[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  for (const l of listeners) l(queue);
}

export function subscribeUploadQueue(listener: Listener): () => void {
  listeners.add(listener);
  void readQueue().then((q) => listener(q));
  return () => {
    listeners.delete(listener);
  };
}

export async function getUploadQueue(): Promise<QueuedRide[]> {
  return readQueue();
}

/**
 * Zet een gestopte rit veilig in de wachtrij (schrijft eerst naar disk).
 * Retourneert het lokale rit-ID. Gooit een fout als het opslaan mislukt —
 * dan is de rit NIET veilig bewaard en moet de aanroeper dat eerlijk melden.
 */
export async function enqueueRideUpload(input: {
  fileName: string;
  gpx: string;
  name: string;
  localId?: string;
}): Promise<string> {
  const localId = input.localId ?? makeLocalRideId(Date.now());
  const queue = await readQueue();
  await writeQueue(
    upsertQueued(queue, {
      localId,
      fileName: input.fileName,
      gpx: input.gpx,
      name: input.name,
      createdAt: Date.now(),
      attempts: 0,
      lastError: null,
      lastTriedAt: null,
    }),
  );
  return localId;
}

/** Verwijder een rit expliciet uit de wachtrij (renner kiest bewust weggooien). */
export async function discardQueuedRide(localId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(removeQueued(queue, localId));
}

// Er loopt maximaal één verwerking tegelijk; een tweede aanroep wacht mee op
// dezelfde run in plaats van dubbel te uploaden.
let processing: Promise<ProcessResult> | null = null;

export type ProcessResult = {
  uploaded: string[]; // localIds die zijn bevestigd (2xx) en verwijderd
  failed: string[]; // localIds die zijn geprobeerd maar mislukt
  skipped: string[]; // localIds die nog niet aan de beurt waren (backoff)
  // sessionId van de laatst bevestigde upload (voor directe UI-terugkoppeling)
  lastSessionId: number | null;
};

/**
 * Verwerk de wachtrij serieel. `uploader` doet de echte POST; alleen een
 * geslaagd resultaat verwijdert het item. `force` negeert de wachttijd
 * (handmatig "Opnieuw proberen").
 */
export function processUploadQueue(
  uploader: (entry: QueuedRide) => Promise<UploadOutcome>,
  opts: { force?: boolean } = {},
): Promise<ProcessResult> {
  if (processing) return processing;
  processing = (async () => {
    const result: ProcessResult = {
      uploaded: [],
      failed: [],
      skipped: [],
      lastSessionId: null,
    };
    try {
      let queue = await readQueue();
      for (const entry of [...queue]) {
        const now = Date.now();
        if (!opts.force && !isDueForRetry(entry, now)) {
          result.skipped.push(entry.localId);
          continue;
        }
        let outcome: UploadOutcome;
        try {
          outcome = await uploader(entry);
        } catch (err) {
          outcome = {
            ok: false,
            error:
              err instanceof Error && err.message
                ? err.message
                : "Uploaden is niet gelukt.",
          };
        }
        queue = await readQueue();
        if (outcome.ok) {
          queue = removeQueued(queue, entry.localId);
          result.uploaded.push(entry.localId);
          result.lastSessionId = outcome.sessionId;
        } else {
          queue = markAttemptFailed(queue, entry.localId, outcome.error, Date.now());
          result.failed.push(entry.localId);
        }
        try {
          await writeQueue(queue);
        } catch {
          // Schrijffout tijdens verwerken: de rest van de wachtrij gewoon
          // afmaken. Erger dan een dubbele poging (de backend ontdubbelt op
          // GPX-inhoud) is het niet — er gaat niets verloren, want het item
          // stond al op disk.
        }
      }
    } finally {
      processing = null;
    }
    return result;
  })();
  return processing;
}
