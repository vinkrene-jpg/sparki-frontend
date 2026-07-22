import pino from "pino";
import PinoPretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

const options = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      // Nooit tokens/secrets/persoonsgegevens in logs — ook niet als iemand
      // per ongeluk een object met deze velden meelogt.
      "*.accessToken",
      "*.refreshToken",
      "*.access_token",
      "*.refresh_token",
      "*.token",
      "*.secret",
      "*.password",
      "*.email",
      "err.config.headers.Authorization",
    ],
    censor: "[weggelaten]",
  },
};

// In dev we still want pretty logs, but as a SYNCHRONOUS in-process stream
// rather than pino's worker-thread transport. The worker transport (thread-stream)
// races with process exit in short-lived processes (tests, one-shot jobs),
// which surfaced as intermittent "worker is not a function" / "the worker has
// exited" crashes. A synchronous stream has no worker and cannot race.
export const logger = isProduction
  ? pino(options)
  : pino(options, PinoPretty({ colorize: true, sync: true }));
