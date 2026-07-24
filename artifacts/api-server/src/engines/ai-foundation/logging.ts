// Sparki Foundation — per-engine child loggers. Metadata only, never raw
// athlete data in log lines.

import { logger } from "../../lib/logger";
import type { FoundationEngineName } from "./contracts";

export function engineLogger(engine: FoundationEngineName | "orchestrator") {
  return logger.child({ module: "ai-foundation", engine });
}
