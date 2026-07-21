import { mkdirSync, openSync, closeSync, writeSync, readFileSync, unlinkSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// Cross-process build concurrency limiter.
//
// When the whole environment (re)boots, ~20+ one-shot test workflows can start
// at once, each spawning its own esbuild/tsx build. Spawning that many builds
// simultaneously exhausts the OS process/thread budget → `spawn ... EAGAIN` and
// esbuild SIGABRT (exit 134). Those are misleading infra crashes, not test
// failures.
//
// This is a filesystem-based counting semaphore shared by EVERY test runner
// (frontend tsx tests and api-server esbuild tests). It caps how many builds
// run concurrently across all processes, so the tests still all run — just not
// all at the exact same instant. Slots are reclaimed if their holder died or
// went stale, so a crashed run never deadlocks the rest.

const SEM_DIR = path.join(os.tmpdir(), "sparki-build-sem");
// 8 vCPUs in this environment; allow a handful of concurrent builds — enough for
// throughput, low enough to never storm the process table.
const MAX_SLOTS = Number(process.env.SPARKI_BUILD_MAX_CONCURRENCY || 3);
// A slot held longer than this is assumed stale (a build should never take this
// long); it can be reclaimed even if the PID still looks alive.
const STALE_MS = 5 * 60 * 1000;
// Give up waiting after this long and just proceed (never block a run forever).
const ACQUIRE_TIMEOUT_MS = 10 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pidAlive(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM"; // exists but not ours
  }
}

function slotIsStale(file) {
  try {
    const raw = readFileSync(file, "utf8");
    const [pidStr, tsStr] = raw.split(":");
    const pid = Number(pidStr);
    const ts = Number(tsStr);
    if (Number.isFinite(ts) && Date.now() - ts > STALE_MS) return true;
    return !pidAlive(pid);
  } catch {
    // Unreadable/removed slot → treat as free.
    return true;
  }
}

function tryTakeSlot(index) {
  const file = path.join(SEM_DIR, `slot-${index}`);
  try {
    const fd = openSync(file, "wx"); // fails if it already exists
    writeSync(fd, `${process.pid}:${Date.now()}`);
    closeSync(fd);
    return file;
  } catch (err) {
    if (err?.code !== "EEXIST") return null;
    if (slotIsStale(file)) {
      try {
        unlinkSync(file);
      } catch {
        /* someone else reclaimed it first */
      }
      // Retry the take once after reclaiming.
      try {
        const fd = openSync(file, "wx");
        writeSync(fd, `${process.pid}:${Date.now()}`);
        closeSync(fd);
        return file;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Acquire a build slot. Returns a release() function. Falls back to a no-op
 * release if it cannot set up the semaphore (never blocks a build from running).
 */
export async function acquireBuildSlot(label = "") {
  try {
    mkdirSync(SEM_DIR, { recursive: true });
  } catch {
    return () => {};
  }

  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  let announced = false;

  while (Date.now() < deadline) {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const held = tryTakeSlot(i);
      if (held) {
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          try {
            const raw = readFileSync(held, "utf8");
            if (raw.startsWith(`${process.pid}:`)) unlinkSync(held);
          } catch {
            /* already gone */
          }
        };
        // Best-effort release on unexpected exit.
        process.once("exit", release);
        return release;
      }
    }
    if (!announced) {
      console.error(
        `[build-sem] waiting for a build slot (max ${MAX_SLOTS} concurrent)${label ? ` — ${label}` : ""}…`,
      );
      announced = true;
    }
    // Jittered backoff so waiters don't all wake and collide at once.
    await sleep(250 + Math.floor(Math.random() * 400));
  }

  // Timed out waiting — proceed anyway rather than fail the run.
  console.error(`[build-sem] slot wait timed out${label ? ` — ${label}` : ""}; proceeding without a slot.`);
  return () => {};
}
