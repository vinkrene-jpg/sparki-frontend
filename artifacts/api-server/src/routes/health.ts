import { Router, type IRouter, type RequestHandler } from "express";
import { execSync } from "node:child_process";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Omgevingsidentificatie (opdracht René 31-07-2026): elke draaiende backend
// moet zichzelf kunnen identificeren met commit-SHA en omgeving, zodat
// testbewijs nooit meer via bundel-forensiek herleid hoeft te worden.
// SHA-bron: git in de werk-/buildomgeving; faalt dat, dan eerlijk "onbekend".
let cachedVersion: Record<string, string> | null = null;
function versionInfo(): Record<string, string> {
  if (cachedVersion) return cachedVersion;
  let commit = process.env.SPARKI_BUILD_SHA ?? "";
  if (!commit) {
    try {
      commit = execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      commit = "onbekend";
    }
  }
  cachedVersion = {
    service: "api-server",
    environment:
      process.env.NODE_ENV === "production" ? "production" : "development",
    commit,
    startedAt: new Date().toISOString(),
  };
  return cachedVersion;
}

router.get("/version", (_req, res) => {
  res.json(versionInfo());
});

// Liveness/health endpoints. The deployment platform probes the bare service
// base path ("/api") as a liveness check in addition to the configured startup
// path ("/api/healthz"); without a handler here the bare path returns 404/500
// and the publish is marked unhealthy and restarted. Both must answer 200.
const ok: RequestHandler = (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

router.get("/", ok);
router.get("/healthz", ok);

export default router;
