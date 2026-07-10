import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [
      path.resolve(artifactDir, "src/index.ts"),
      path.resolve(artifactDir, "src/jobs/knowledge-scan.ts"),
      path.resolve(artifactDir, "src/tests/smoke.ts"),
      path.resolve(artifactDir, "src/tests/race-room.ts"),
      path.resolve(artifactDir, "src/tests/account.ts"),
      path.resolve(artifactDir, "src/tests/data-hub.ts"),
      path.resolve(artifactDir, "src/tests/memory-graph.ts"),
      path.resolve(artifactDir, "src/tests/context-memory.ts"),
      path.resolve(artifactDir, "src/tests/voice.ts"),
      path.resolve(artifactDir, "src/tests/onboarding-v2.ts"),
      path.resolve(artifactDir, "src/tests/onboarding-personas.ts"),
      path.resolve(artifactDir, "src/tests/material.ts"),
      path.resolve(artifactDir, "src/tests/material-nudge.ts"),
      path.resolve(artifactDir, "src/tests/observation.ts"),
      path.resolve(artifactDir, "src/tests/profile-consistency.ts"),
      path.resolve(artifactDir, "src/tests/notifications.ts"),
      path.resolve(artifactDir, "src/tests/notification-day-count.ts"),
      path.resolve(artifactDir, "src/tests/notifications-read-batch.ts"),
      path.resolve(artifactDir, "src/tests/core-prediction.ts"),
      path.resolve(artifactDir, "src/tests/test-dashboard.ts"),
      path.resolve(artifactDir, "src/scripts/seed-social.ts"),
      path.resolve(artifactDir, "src/scripts/seed-virtual-athletes.ts"),
      path.resolve(artifactDir, "src/scripts/seed-preview-athletes.ts"),
      path.resolve(artifactDir, "src/scripts/seed-intel.ts"),
      path.resolve(artifactDir, "src/scripts/seed-sparki-world.ts"),
      path.resolve(artifactDir, "src/scripts/seed-world-copy.ts"),
      path.resolve(artifactDir, "src/scripts/backfill-avatars.ts"),
      path.resolve(artifactDir, "src/scripts/backfill-world-photos.ts"),
      path.resolve(artifactDir, "src/scripts/backfill-world-highlights.ts"),
      path.resolve(artifactDir, "src/scripts/run-world-day.ts"),
      path.resolve(artifactDir, "src/scripts/dump-world-samples.ts"),
      path.resolve(artifactDir, "src/tests/intel.ts"),
      path.resolve(artifactDir, "src/tests/fit-parse.ts"),
      path.resolve(artifactDir, "src/tests/derived-load.ts"),
      path.resolve(artifactDir, "src/tests/connector-cleanup.ts"),
      path.resolve(artifactDir, "src/tests/email-channel.ts"),
      path.resolve(artifactDir, "src/tests/development-goal.ts"),
      path.resolve(artifactDir, "src/tests/world-media.ts"),
      path.resolve(artifactDir, "src/tests/world-sim.ts"),
      path.resolve(artifactDir, "src/tests/world-feed.ts"),
      path.resolve(artifactDir, "src/tests/world-affinity.ts"),
      path.resolve(artifactDir, "src/tests/world-consistency.ts"),
      path.resolve(artifactDir, "src/jobs/health-check.ts"),
      path.resolve(artifactDir, "src/jobs/reminders.ts"),
      path.resolve(artifactDir, "src/jobs/goal-review.ts"),
      path.resolve(artifactDir, "src/tests/goals.ts"),
      path.resolve(artifactDir, "src/tests/scheduled-tasks.ts"),
      path.resolve(artifactDir, "src/tests/scheduled-tasks-route.ts"),
      path.resolve(artifactDir, "src/tests/onboarding-connect-step.ts"),
      path.resolve(artifactDir, "src/tests/onboarding-strava-gapfill.ts"),
      path.resolve(artifactDir, "src/tests/feedback-adjust.ts"),
      path.resolve(artifactDir, "src/tests/cross-account-isolation.ts"),
      path.resolve(artifactDir, "src/tests/coach-parent-link-isolation.ts"),
      path.resolve(artifactDir, "src/tests/coach-parent-sharing-levels.ts"),
      path.resolve(artifactDir, "src/tests/coach-parent-private-memory.ts"),
    ],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
