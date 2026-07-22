// Source-quality engine facade ("bronnenregister").
//
// One shared register of every data source with: bron (origin), meettijd,
// volledigheid, betrouwbaarheid, sensorstatus en geldigheid. All analyses read
// this SAME register so no chapter invents data another chapter knows is
// missing. Also provides the shared prompt block and structured logging of
// which sources an analysis used vs excluded.

import { logger } from "../../lib/logger";
import { assessSources } from "./assess";
import { gatherSourceInput } from "./gather";
import type { SourceQuality } from "./types";

export { assessSources } from "./assess";
export { SOURCE_KEYS } from "./types";
export type {
  SourceKey,
  SourceQuality,
  SourceQualityInput,
} from "./types";

/** Full register for one athlete, from real rows only. */
export async function getSourceQuality(
  clerkId: string,
): Promise<SourceQuality[]> {
  const input = await gatherSourceInput(clerkId);
  return assessSources(input);
}

/**
 * Plain-text block for LLM prompts: the register plus the hard rule that
 * invalid sources may not produce conclusions. Injected into the shared
 * athlete context so chat, brief and observation prose all obey the same
 * source discipline.
 */
export function sourceQualityBlock(register: SourceQuality[]): string {
  const lines = register.map((s) => {
    const parts = [
      `betrouwbaarheid: ${s.reliability}`,
      `volledigheid: ${Math.round(s.completeness * 100)}%`,
      s.lastMeasuredAt ? `laatste meting: ${s.lastMeasuredAt}` : null,
      s.origin ? `bron: ${s.origin}` : null,
      s.sensorStatus !== "nvt" ? `sensor: ${s.sensorStatus}` : null,
      s.reason ? `(${s.reason})` : null,
    ].filter(Boolean);
    return `- ${s.label} — ${parts.join(", ")}`;
  });
  return `DATABRONNEN (kwaliteitsregister):
${lines.join("\n")}

HARDE REGEL over databronnen: trek GEEN conclusie over een bron met betrouwbaarheid "ontbreekt" of "onbetrouwbaar". Zeg dan kort en feitelijk dat die gegevens er niet of niet betrouwbaar zijn — verzin nooit een waarde, schatting of conclusie voor zo'n bron.`;
}

/**
 * Structured log of which sources an analysis actually used and which it
 * excluded (with reason). One line per analysis run, machine-parseable.
 */
export function logSourceUsage(
  clerkId: string,
  analysis: string,
  register: SourceQuality[],
): void {
  logger.info(
    {
      event: "analysis_sources",
      analysis,
      clerkId,
      used: register.filter((s) => s.valid).map((s) => s.source),
      excluded: register
        .filter((s) => !s.valid)
        .map((s) => ({ source: s.source, reason: s.reason })),
    },
    `analysis ${analysis}: ${register.filter((s) => s.valid).length} bronnen gebruikt, ${register.filter((s) => !s.valid).length} uitgesloten`,
  );
}
