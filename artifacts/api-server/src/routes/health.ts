import { Router, type IRouter, type RequestHandler } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

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
