// Tests voor de pure helpers van `lib/upload-queue.ts` — de betrouwbare,
// idempotente rit-wachtrij. Kernregels: een rit staat nooit dubbel in de
// wachtrij (upsert op localId), alleen een bevestigde upload verwijdert een
// item, de wachttijd tussen automatische pogingen loopt op (15s→1m→5m→15m),
// en opslaan is fail-closed: een schrijffout wordt nooit verzwegen.
//
// Run with: pnpm --filter @workspace/sparki-mobile run test:upload-queue

import { test, mock } from "node:test";
import assert from "node:assert/strict";

// In-memory AsyncStorage met een instelbare schrijffout, zodat het
// fail-closed-gedrag van de wachtrij echt getest wordt (geen device nodig).
const mem = new Map<string, string>();
let failWrites = false;

mock.module("@react-native-async-storage/async-storage", {
  defaultExport: {
    getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: async (k: string, v: string) => {
      if (failWrites) throw new Error("disk full");
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
});

// Dynamische import ná mock.module — statische imports worden gehesen en
// zouden de echte AsyncStorage laden vóór de mock actief is. (Geen top-level
// await: de tsx-runner transformeert naar CJS.)
const modPromise = import("./upload-queue");
type QueuedRide = import("./upload-queue").QueuedRide;

function ride(localId: string, over: Partial<QueuedRide> = {}): QueuedRide {
  return {
    localId,
    fileName: `${localId}.gpx`,
    gpx: "<gpx/>",
    name: "Testrit",
    createdAt: 1000,
    attempts: 0,
    lastError: null,
    lastTriedAt: null,
    ...over,
  };
}

test("makeLocalRideId is deterministisch bij vaste input en uniek genoeg", async () => {
  const { makeLocalRideId } = await modPromise;
  const a = makeLocalRideId(1234, () => 0.5);
  const b = makeLocalRideId(1234, () => 0.5);
  assert.equal(a, b);
  assert.match(a, /^rit-1234-[0-9a-f]{6}$/);
  const c = makeLocalRideId(1234, () => 0.1);
  assert.notEqual(a, c);
});

test("upsertQueued vervangt bestaand item met hetzelfde localId (nooit dubbel)", async () => {
  const { upsertQueued } = await modPromise;
  const q1 = upsertQueued([], ride("a"));
  const q2 = upsertQueued(q1, ride("a", { name: "Nieuwe naam" }));
  assert.equal(q2.length, 1);
  assert.equal(q2[0]!.name, "Nieuwe naam");
});

test("upsertQueued houdt volgorde op createdAt (oudste eerst)", async () => {
  const { upsertQueued } = await modPromise;
  const q = upsertQueued(
    upsertQueued([ride("b", { createdAt: 2000 })], ride("a", { createdAt: 1000 })),
    ride("c", { createdAt: 1500 }),
  );
  assert.deepEqual(
    q.map((e) => e.localId),
    ["a", "c", "b"],
  );
});

test("removeQueued verwijdert alleen het gevraagde item", async () => {
  const { removeQueued } = await modPromise;
  const q = removeQueued([ride("a"), ride("b")], "a");
  assert.deepEqual(
    q.map((e) => e.localId),
    ["b"],
  );
});

test("markAttemptFailed registreert poging alleen op het juiste item (immutable)", async () => {
  const { markAttemptFailed } = await modPromise;
  const list = [ride("a"), ride("b")];
  const out = markAttemptFailed(list, "a", "Geen netwerk", 5000);
  assert.equal(out[0]!.attempts, 1);
  assert.equal(out[0]!.lastError, "Geen netwerk");
  assert.equal(out[0]!.lastTriedAt, 5000);
  assert.equal(out[1]!.attempts, 0);
  // Origineel onaangetast
  assert.equal(list[0]!.attempts, 0);
});

test("nextRetryDelayMs loopt op: 15s, 1m, 5m, daarna 15m", async () => {
  const { nextRetryDelayMs } = await modPromise;
  assert.equal(nextRetryDelayMs(0), 0);
  assert.equal(nextRetryDelayMs(1), 15_000);
  assert.equal(nextRetryDelayMs(2), 60_000);
  assert.equal(nextRetryDelayMs(3), 300_000);
  assert.equal(nextRetryDelayMs(4), 900_000);
  assert.equal(nextRetryDelayMs(99), 900_000);
});

test("isDueForRetry: nieuw item mag direct, daarna pas na de wachttijd", async () => {
  const { isDueForRetry } = await modPromise;
  assert.equal(isDueForRetry(ride("a"), 1), true);
  const failed = ride("a", { attempts: 1, lastTriedAt: 10_000 });
  assert.equal(isDueForRetry(failed, 10_000 + 14_999), false);
  assert.equal(isDueForRetry(failed, 10_000 + 15_000), true);
  const failed2 = ride("a", { attempts: 2, lastTriedAt: 10_000 });
  assert.equal(isDueForRetry(failed2, 10_000 + 59_999), false);
  assert.equal(isDueForRetry(failed2, 10_000 + 60_000), true);
});

test("enqueueRideUpload is fail-closed: schrijffout → fout, geen valse 'veilig bewaard'", async () => {
  const { enqueueRideUpload, getUploadQueue } = await modPromise;
  mem.clear();
  failWrites = true;
  await assert.rejects(
    enqueueRideUpload({ fileName: "rit.gpx", gpx: "<gpx/>", name: "Rit" }),
  );
  failWrites = false;
  assert.equal((await getUploadQueue()).length, 0);
});

test("enqueueRideUpload schrijft echt naar opslag als schrijven lukt", async () => {
  const { enqueueRideUpload, getUploadQueue } = await modPromise;
  mem.clear();
  failWrites = false;
  const localId = await enqueueRideUpload({
    fileName: "rit.gpx",
    gpx: "<gpx/>",
    name: "Rit",
  });
  const queue = await getUploadQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0]!.localId, localId);
  // En het staat écht op disk, niet alleen in het geheugen.
  assert.match(mem.get("sparki:upload-queue") ?? "", /rit\.gpx/);
});
