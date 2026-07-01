import app from "./app";
import { logger } from "./lib/logger";
import { ensureWorldSeed } from "./lib/world-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Fire-and-forget: a freshly published database has the schema but no Sparki
  // World content, so it would honestly show "nog geen renners". Fill it from
  // the bundled dev export (no image generation — images live in the shared
  // object-storage bucket). No-ops the moment the world already has athletes,
  // so this is safe on every boot and in development.
  ensureWorldSeed({ log: (m) => logger.info({ seed: "world" }, m) })
    .then((r) => {
      if (r.seeded) logger.info({ seed: "world", total: r.total }, "Sparki World seeded");
    })
    .catch((err) => logger.error({ err }, "Sparki World seed failed"));
});
