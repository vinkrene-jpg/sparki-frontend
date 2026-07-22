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

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "12mb" }));
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
// frontend can be previewed without signing in. Never registered in production.
if (process.env.NODE_ENV !== "production") {
  app.use(devAuthBypass);
}

// Correlation-id: iedere respons draagt het request-id zodat een gebruiker een
// fout kan melden ("code X") en de beheerder exact dat log-regel-id terugvindt.
app.use((req, res, next) => {
  const id = (req as Request & { id?: string | number }).id;
  if (id != null) res.setHeader("X-Request-Id", String(id));
  next();
});

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
