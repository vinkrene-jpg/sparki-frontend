import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { devAuthBypass } from "./lib/auth";
import { versionGate } from "./lib/version-gate";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must be before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// CORS — in productie alleen eigen domeinen (zelfde-origin verkeer heeft geen
// CORS nodig; dit sluit cross-site cookie-gebruik uit). In dev blijft het open
// zodat de Vite-proxy en previews werken.
const allowedOrigins = new Set(
  [
    ...(process.env.REPLIT_DOMAINS ?? "").split(","),
    ...(process.env.SPARKI_ALLOWED_ORIGINS ?? "").split(","),
  ]
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (d.startsWith("http") ? d : `https://${d}`)),
);
app.use(
  cors({
    credentials: true,
    origin:
      process.env.NODE_ENV === "production"
        ? (origin, cb) => cb(null, !origin || allowedOrigins.has(origin))
        : true,
  }),
);

// Eenvoudige rate-limiter (alleen productie): per IP een glijdend venster.
// Geen externe afhankelijkheid; beschermt tegen brute force en runaway loops.
if (process.env.NODE_ENV === "production") {
  const WINDOW_MS = 60_000;
  const MAX_REQ = 600; // ruim voor normaal app-gebruik
  const hits = new Map<string, { count: number; windowStart: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) {
      if (now - h.windowStart > WINDOW_MS) hits.delete(ip);
    }
  }, WINDOW_MS).unref();
  app.use("/api", (req, res, next) => {
    const ip = req.ip ?? "onbekend";
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.windowStart > WINDOW_MS) {
      hits.set(ip, { count: 1, windowStart: now });
      next();
      return;
    }
    h.count += 1;
    if (h.count > MAX_REQ) {
      res
        .status(429)
        .json({ error: "Te veel verzoeken. Probeer het zo opnieuw." });
      return;
    }
    next();
  });
}
app.use(
  express.json({
    limit: "12mb",
    // Bewaar de ruwe bytes voor endpoints die signatuurverificatie over de
    // exacte payload nodig hebben (Stripe-webhooks). Alleen een verwijzing —
    // geen dubbele parse, geen gedragsverandering voor bestaande routes.
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

// Clerk session middleware — resolves publishable key from request host
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Dev-only: resolve a dev user when no real Clerk session is present so the v0
// frontend can be previewed without signing in. Never registered in production,
// and never in ANY Replit deployment (REPLIT_DEPLOYMENT), whatever NODE_ENV zegt.
if (process.env.NODE_ENV !== "production" && !process.env.REPLIT_DEPLOYMENT) {
  app.use(devAuthBypass);
}

// Correlation-id: iedere respons draagt het request-id zodat een gebruiker een
// fout kan melden ("code X") en de beheerder exact dat log-regel-id terugvindt.
app.use((req, res, next) => {
  const id = (req as Request & { id?: string | number }).id;
  if (id != null) res.setHeader("X-Request-Id", String(id));
  next();
});

// Versie- en compatibiliteitscontrole: clients onder de minimaal ondersteunde
// versie krijgen 426 met een Nederlandse melding (web/mobiel tonen daarop een
// blokkeerscherm). Webhooks en verzoeken zonder versieheader passeren gewoon.
app.use("/api", versionGate());

app.use("/api", router);

// Centrale foutafhandeling — het laatste vangnet. Logt technisch (met request-
// id, zonder gevoelige data) en antwoordt met een veilige Nederlandse melding.
// Er lekt nooit een stacktrace of interne foutmelding naar de interface.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const requestId = String(
    (req as Request & { id?: string | number }).id ?? "",
  );
  req.log?.error({ err, requestId }, "Onafgevangen fout in request");
  if (res.headersSent) return;
  // Bekende clientfouten (bv. kapotte JSON in de body-parser) blijven 4xx —
  // alleen echte serverfouten worden 500. De melding blijft altijd generiek.
  const status =
    typeof (err as { status?: number } | null)?.status === "number" &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 500
      ? (err as { status: number }).status
      : 500;
  res.status(status).json({
    error:
      status < 500
        ? "Het verzoek kon niet gelezen worden. Controleer de invoer en probeer opnieuw."
        : "Er ging iets mis. Probeer het zo opnieuw.",
    requestId: requestId || undefined,
  });
});

export default app;
