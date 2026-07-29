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
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sparkiDir = path.join(root, "artifacts", "sparki");
const mobileDir = path.join(root, "artifacts", "sparki-mobile");

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

// ---------------------------------------------------------------------------
// artifacts/sparki-mobile (Expo / React Native)
//
// Metro is too slow to boot for a post-merge check, so we do a fast esbuild
// resolve check over all mobile source files instead:
// - React Native platform resolution: prefer .native.* over plain extensions
//   (platform-split files like RouteMap.tsx / RouteMap.web.tsx — the native
//   variant is what Metro bundles on-device).
// - Bare package imports (react-native-maps, expo-*, ...) are NOT bundled —
//   many native-only libs ship untranspiled Flow/JSX that esbuild can't parse.
//   Instead we verify the package directory exists in the mobile artifact's
//   node_modules (pnpm symlinks direct deps there) and mark it external. A
//   merge that dropped a package from package.json makes that symlink vanish,
//   which is exactly the failure mode we want to catch.
// ---------------------------------------------------------------------------

function collectMobileEntryPoints() {
  const dirs = ["app", "components", "hooks", "lib", "constants"];
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
      } else if (
        /\.(ts|tsx)$/.test(ent.name) &&
        !/\.test\.(ts|tsx)$/.test(ent.name) &&
        !ent.name.endsWith(".d.ts") &&
        // Web-only variants resolve with web extensions; the native side is
        // what matters for the Expo app, so skip .web.* as entrypoints.
        !/\.web\.(ts|tsx)$/.test(ent.name)
      ) {
        out.push(p);
      }
    }
  };
  for (const d of dirs) {
    const abs = path.join(mobileDir, d);
    if (fs.existsSync(abs)) walk(abs);
  }
  return out;
}

const mobilePackageCheckPlugin = {
  name: "mobile-package-check",
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      const spec = args.path;
      if (spec.startsWith("node:")) return { path: spec, external: true };
      // "@/..." is the tsconfig path alias to the mobile artifact root, not a
      // package — resolve it here (plugins run before esbuild's alias option).
      if (spec === "@" || spec.startsWith("@/")) {
        return build.resolve(path.join(mobileDir, spec.slice(2)), {
          kind: args.kind,
          resolveDir: args.resolveDir,
        });
      }
      const segs = spec.split("/");
      const pkgName = spec.startsWith("@") ? segs.slice(0, 2).join("/") : segs[0];
      const pkgDir = path.join(mobileDir, "node_modules", pkgName);
      if (fs.existsSync(pkgDir)) return { path: spec, external: true };
      return {
        errors: [
          {
            text: `Could not resolve "${spec}": package "${pkgName}" is not installed in artifacts/sparki-mobile (imported from ${path.relative(root, args.importer)})`,
          },
        ],
      };
    });
  },
};

const mobileStart = Date.now();
try {
  await esbuild.build({
    entryPoints: collectMobileEntryPoints(),
    bundle: true,
    write: false,
    outdir: path.join(mobileDir, ".post-merge-check"),
    platform: "neutral",
    format: "esm",
    jsx: "automatic",
    logLevel: "silent",
    absWorkingDir: mobileDir,
    // React Native / Metro native resolution order (iOS/Android build):
    // .native.* wins over plain, .web.* is never picked.
    resolveExtensions: [
      ".native.tsx",
      ".native.ts",
      ".native.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".json",
    ],
    alias: { "@": mobileDir },
    plugins: [mobilePackageCheckPlugin],
    loader: {
      ".png": "empty",
      ".jpg": "empty",
      ".jpeg": "empty",
      ".webp": "empty",
      ".gif": "empty",
      ".svg": "empty",
      ".ttf": "empty",
      ".otf": "empty",
      ".mp3": "empty",
      ".wav": "empty",
    },
  });
} catch (err) {
  const errors = err?.errors ?? [];
  const missing = errors
    .map((e) => e.text)
    .filter((t) => t.includes("Could not resolve"));
  console.error("");
  console.error("POST-MERGE BUILD CHECK FAILED (artifacts/sparki-mobile)");
  console.error(
    "A merge likely removed a package or module the mobile app still imports:",
  );
  console.error("");
  const shown = missing.length ? missing : errors.map((e) => e.text);
  for (const line of shown.slice(0, 20)) console.error("  - " + line);
  if (!shown.length) console.error("  " + String(err?.message ?? err));
  console.error("");
  console.error(
    "Fix: restore the package in artifacts/sparki-mobile/package.json (pnpm add) or remove the stale import, then re-run scripts/post-merge.sh.",
  );
  process.exit(1);
}

console.log(
  `post-merge build check OK: artifacts/sparki-mobile sources resolve (${Date.now() - mobileStart}ms)`,
);
