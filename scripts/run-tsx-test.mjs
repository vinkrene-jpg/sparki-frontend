import { spawn } from "node:child_process";
import { acquireBuildSlot } from "./build-semaphore.mjs";

// Spawn-pressure-resilient tsx test runner.
//
// The frontend/mobile tests run through `tsx`, which starts an esbuild service
// (worker threads + a child process). When many test workflows boot at once the
// system can momentarily fail to fork a new process (`EAGAIN`) or abort esbuild
// mid-transform, surfacing as a MISLEADING infra crash (SIGABRT / exit 134 /
// "The service was stopped") rather than a real test result.
//
// This wrapper runs the test and, ONLY when it detects such an infra crash
// (never a genuine assertion failure), retries a few times with backoff. A real
// test failure (the test's own non-zero exit with a printed report) is passed
// straight through — no assertion is ever hidden or weakened.
//
// Usage: node scripts/run-tsx-test.mjs <tsx-arg> [<tsx-arg> ...]
//   e.g. node ../../scripts/run-tsx-test.mjs src/lib/foo.test.ts
//        node ../../scripts/run-tsx-test.mjs --test lib/foo.test.ts

const tsxArgs = process.argv.slice(2);
if (tsxArgs.length === 0) {
  console.error("run-tsx-test: expected at least one tsx argument (the test file)");
  process.exit(1);
}

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 750;

// Signatures of a transient process-spawn / esbuild-service crash — NOT a test
// assertion failure. Matched against the child's combined stderr+stdout.
const INFRA_CRASH_PATTERNS = [
  /EAGAIN/i,
  /The service was stopped/i,
  /spawn\s+.*\bE[A-Z]+/i, // spawn ... EAGAIN / ENOMEM / EMFILE
  /esbuild.*(exited|stopped|crash)/i,
  /Aborted(?:\s*\(core dumped\))?/i,
  /SIGABRT/i,
  /Cannot start service/i,
  /worker (?:thread )?(?:exited|terminated)/i,
];

// Signals/exit codes that indicate an abnormal termination (as opposed to the
// test harness deliberately calling process.exit with a status).
const INFRA_EXIT_CODES = new Set([134 /* SIGABRT */, 139 /* SIGSEGV */]);

function looksLikeInfraCrash(exitCode, signal, output) {
  if (signal === "SIGABRT" || signal === "SIGSEGV" || signal === "SIGKILL") return true;
  if (exitCode != null && INFRA_EXIT_CODES.has(exitCode)) return true;
  // esbuild EAGAIN can surface as a thrown TransformError → exit 1. Only treat a
  // generic non-zero exit as infra if the output carries a crash signature.
  if (exitCode != null && exitCode !== 0) {
    return INFRA_CRASH_PATTERNS.some((re) => re.test(output));
  }
  return false;
}

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn("tsx", tsxArgs, {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    });
    let output = "";
    const tee = (stream, dest) => {
      stream.on("data", (chunk) => {
        output += chunk.toString();
        dest.write(chunk);
      });
    };
    tee(child.stdout, process.stdout);
    tee(child.stderr, process.stderr);
    child.on("error", (err) => {
      output += `\n${err?.message ?? String(err)}`;
      resolve({ exitCode: 1, signal: null, output });
    });
    child.on("close", (exitCode, signal) => {
      resolve({ exitCode, signal, output });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const release = await acquireBuildSlot(tsxArgs.join(" "));
  let result;
  try {
    result = await runOnce();
  } finally {
    release();
  }
  const { exitCode, signal, output } = result;

  if (!looksLikeInfraCrash(exitCode, signal, output)) {
    // Genuine result (pass or real assertion failure) — pass it straight through.
    process.exit(exitCode == null ? 1 : exitCode);
  }

  if (attempt < MAX_ATTEMPTS) {
    const backoff = BASE_BACKOFF_MS * attempt;
    console.error(
      `\n[run-tsx-test] transient spawn/esbuild crash detected ` +
        `(exit=${exitCode} signal=${signal ?? "none"}); ` +
        `retry ${attempt + 1}/${MAX_ATTEMPTS} in ${backoff}ms…\n`,
    );
    await sleep(backoff);
    continue;
  }

  // Exhausted retries — fail with a clear, honest message (never a silent green).
  console.error(
    `\n[run-tsx-test] test '${tsxArgs.join(" ")}' still crashed from spawn/esbuild ` +
      `pressure after ${MAX_ATTEMPTS} attempts (exit=${exitCode} signal=${signal ?? "none"}). ` +
      `This is an environment resource issue, not a test-logic failure.\n`,
  );
  process.exit(exitCode == null ? 1 : exitCode);
}
