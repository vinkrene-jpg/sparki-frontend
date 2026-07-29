#!/usr/bin/env node
// Post-merge build check: catches merges that removed a package (or renamed a
// module) that the app still imports. A missing package otherwise surfaces as
// a silent hanging load screen in the sparki web app.
//
// Strategy: fast esbuild resolve/bundle check over the artifact entrypoints.
// - artifacts/sparki: bundle src/main.tsx (write: false) with the same "@"
//   aliases as vite.config.ts. Any unresolved import fails loudly here.
// - artifacts/api-server: its own esbuild build (pnpm run build) is executed
//   from post-merge.sh separately.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sparkiDir = path.join(root, "artifacts", "sparki");

// esbuild is a dependency of the api-server workspace package; resolve it
// from there so we don't need a root-level dependency.
const require_ = createRequire(
  path.join(root, "artifacts", "api-server", "package.json"),
);
const esbuild = require_("esbuild");

const start = Date.now();
try {
  await esbuild.build({
    entryPoints: [path.join(sparkiDir, "src", "main.tsx")],
    bundle: true,
    write: false,
    outdir: path.join(sparkiDir, "dist", ".post-merge-check"),
    platform: "browser",
    format: "esm",
    jsx: "automatic",
    logLevel: "silent",
    absWorkingDir: sparkiDir,
    alias: {
      "@": path.join(sparkiDir, "src"),
      "@assets": path.join(root, "attached_assets"),
    },
    // Non-JS assets are irrelevant for import resolution of packages/modules.
    loader: {
      ".css": "empty",
      ".svg": "empty",
      ".png": "empty",
      ".jpg": "empty",
      ".jpeg": "empty",
      ".webp": "empty",
      ".gif": "empty",
      ".woff": "empty",
      ".woff2": "empty",
      ".ttf": "empty",
      ".eot": "empty",
      ".mp3": "empty",
      ".wav": "empty",
      ".mp4": "empty",
    },
    define: { "import.meta.env.BASE_URL": '"/"' },
  });
} catch (err) {
  const errors = err?.errors ?? [];
  const missing = errors
    .map((e) => e.text)
    .filter((t) => t.includes("Could not resolve"));
  console.error("");
  console.error("POST-MERGE BUILD CHECK FAILED (artifacts/sparki)");
  console.error(
    "A merge likely removed a package or module the app still imports:",
  );
  console.error("");
  const shown = missing.length ? missing : errors.map((e) => e.text);
  for (const line of shown.slice(0, 20)) console.error("  - " + line);
  if (!shown.length) console.error("  " + String(err?.message ?? err));
  console.error("");
  console.error(
    "Fix: restore the package in artifacts/sparki/package.json (pnpm add) or remove the stale import, then re-run scripts/post-merge.sh.",
  );
  process.exit(1);
}

console.log(
  `post-merge build check OK: artifacts/sparki entrypoint resolves (${Date.now() - start}ms)`,
);
