import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireBuildSlot } from "../../../scripts/build-semaphore.mjs";

// Isolated single-test runner.
//
// Each test workflow previously ran `pnpm run build` (which wipes ./dist and
// recompiles EVERY entrypoint) and then executed ./dist/tests/<name>.mjs. When
// many test workflows ran in parallel they wiped and rebuilt the SAME ./dist
// under each other — and under the running API server — producing spurious
// "The service was stopped" / missing-file failures and thread exhaustion.
//
// This runner instead builds ONLY the requested test into its own output dir
// (dist-tests/<name>), so parallel runs are fully isolated and never touch the
// server's ./dist. It also compiles a single entrypoint, which is far faster
// and much lighter on memory.
//
// Usage: node ./scripts/run-test.mjs <test-name>
//   where <test-name> maps to src/tests/<test-name>.ts

const artifactDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error(
    "run-test: expected a test name (letters, digits, hyphens), got:",
    JSON.stringify(name),
  );
  process.exit(1);
}

const distDir = `dist-tests/${name}`;
const buildEnv = {
  ...process.env,
  DIST_DIR: distDir,
  BUILD_ENTRIES: `src/tests/${name}.ts`,
};

// Bound how many test builds compile concurrently across ALL test runners so a
// full-environment boot (many test workflows at once) never storms the process
// table into `spawn ... EAGAIN` / esbuild SIGABRT.
const releaseBuildSlot = await acquireBuildSlot(`api-server:${name}`);
let build;
try {
  build = spawnSync(
    "node",
    [path.resolve(artifactDir, "build.mjs")],
    { cwd: artifactDir, env: buildEnv, stdio: "inherit" },
  );
} finally {
  releaseBuildSlot();
}
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// The pino esbuild plugin can perturb the output layout, so locate the built
// entry rather than assuming a fixed path. Prefer a match under a /tests/ dir.
function findEntry(dir) {
  const target = `${name}.mjs`;
  let fallback = null;
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (ent.name === target) {
        if (path.basename(path.dirname(full)) === "tests") return full;
        fallback = fallback ?? full;
      }
    }
    return null;
  };
  return walk(path.resolve(artifactDir, dir)) ?? fallback;
}

const entryFile = findEntry(distDir);
if (!entryFile) {
  console.error(`run-test: could not find built test '${name}' in ${distDir}`);
  process.exit(1);
}

const run = spawnSync(
  "node",
  ["--enable-source-maps", entryFile],
  { cwd: artifactDir, env: process.env, stdio: "inherit" },
);
process.exit(run.status ?? 1);
