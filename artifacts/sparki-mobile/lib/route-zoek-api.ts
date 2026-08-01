import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

import type { RoutePathPoint, RouteStep, RouteSummary } from "@/lib/routes-api";

// ── Route-zoeklaag (taak #519) ───────────────────────────────────────────────
// Zelfde contract als de web-routeplanner: bij een routeaanvraag zoekt Sparki
// éérst in je eigen gereden/bewaarde routes en met jou gedeelde routes
// (POST /api/routes/zoek). Elke treffer is door de server al fail-closed
// gecontroleerd op blokkades: geblokkeerd of niet-controleerbaar wordt eerlijk
// gemarkeerd (`bruikbaar: false`) en is niet start-baar. Pas daarna — en alleen
// op verzoek of wanneer er niets bruikbaars is — komen nieuwe voorstellen uit
// dezelfde generator als op web (start + poll-jobmodel).

export type KnownRouteVerification =
  | { status: "geverifieerd" }
  | {
      status: "geblokkeerd";
      reden: string;
      blockage: { forbidden: number; steps: number; blockedGates: number };
    }
  | { status: "niet_controleerbaar"; reden: string };

export type KnownRouteMatch = {
  routeId: number;
  name: string;
  // Herkomst zoals de server hem bepaalde — labels komen kant-en-klaar mee
  // (originLabel), zodat mobiel en web exact dezelfde woorden gebruiken.
  origin: "gereden" | "bewaard" | "gedeeld";
  originLabel: string;
  ownership: "eigen" | "gedeeld";
  gedeeldVia: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSec: number | null;
  surface: string;
  geometry: RoutePathPoint[];
  // Motivering: alleen zinnen op basis van echte metingen (server-side).
  matchReasons: string[];
  startAfstandKm: number;
  score: number;
  verificatie: KnownRouteVerification;
  bruikbaar: boolean;
};

export type ZoekCriteria = {
  startLat: number;
  startLon: number;
  targetDistanceKm: number;
  elevationPreference: "flat" | "hilly" | "any";
};

export type ZoekResult = {
  bekend: KnownRouteMatch[];
  criteria: {
    targetDistanceKm: number;
    mode: "loop" | "ptp";
    bikeType: string | null;
    elevationPreference: string;
  };
};

/**
 * Zoek passende bekende routes (zelfde endpoint + labels als web). De lijst
 * hoort bij precies één set criteria — de aanroeper wist hem zodra een
 * criterium wijzigt, anders toont een volgende aanvraag routes van een vorig
 * startpunt.
 */
export function useZoekBekendeRoutes() {
  return useMutation({
    mutationFn: (input: ZoekCriteria): Promise<ZoekResult> =>
      customFetch<ZoekResult>("/api/routes/zoek", {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startLat: input.startLat,
          startLon: input.startLon,
          mode: "loop",
          targetDistanceKm: input.targetDistanceKm,
          elevationPreference: input.elevationPreference,
        }),
      }),
  });
}

// ── Nieuwe voorstellen (zelfde generator als web, start + poll) ─────────────

export type RouteOption = {
  candidateId: string;
  name: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSec: number | null;
  surface: string;
  geometry: RoutePathPoint[] | null;
  nav: RouteStep[] | null;
  rationale?: string | null;
};

export type GenerateOutcome =
  | { ok: true; options: RouteOption[] }
  | { ok: false; error: string };

const POLL_INTERVAL_MS = 2500;
const POLL_DEADLINE_MS = 4 * 60_000;

type JobPoll =
  | { done: false; phase: string | null }
  | { done: true; phase: string | null; status: number; body: unknown };

/**
 * Vraag nieuwe rondrit-voorstellen aan via het start+poll-jobmodel (één lange
 * POST breekt op mobiel af bij schermvergrendeling). Fouten van de motor
 * (422/503) komen als eerlijke Nederlandse meldingen terug en worden
 * onveranderd getoond — er wordt nooit een route verzonnen.
 */
export async function genereerNieuweVoorstellen(
  input: ZoekCriteria,
  onPhase?: (phase: string) => void,
): Promise<GenerateOutcome> {
  let jobId: string;
  try {
    const started = await customFetch<{ jobId: string }>(
      "/api/routes/generate/options/start",
      {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "loop",
          startLat: input.startLat,
          startLon: input.startLon,
          targetDistanceKm: input.targetDistanceKm,
          elevationPreference: input.elevationPreference,
        }),
      },
    );
    jobId = started.jobId;
  } catch (err) {
    return {
      ok: false,
      error:
        errBody(err) ??
        "De routeaanvraag kon niet worden gestart. Controleer je verbinding.",
    };
  }

  const deadline = Date.now() + POLL_DEADLINE_MS;
  // Mobiele timers staan stil bij een vergrendeld scherm: na de deadline doen
  // we daarom altijd nog ÉÉN echte poll vóór we opgeven.
  let finalPollDone = false;
  for (;;) {
    const overDeadline = Date.now() > deadline;
    if (overDeadline && finalPollDone) {
      return {
        ok: false,
        error:
          "De berekening duurt langer dan verwacht. Probeer het opnieuw.",
      };
    }
    if (overDeadline) finalPollDone = true;
    let poll: JobPoll;
    try {
      poll = await customFetch<JobPoll>(`/api/routes/generate-jobs/${jobId}`, {
        responseType: "json",
      });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        return {
          ok: false,
          error: "De aanvraag is verlopen. Probeer het opnieuw.",
        };
      }
      // Netwerkhapering: gewoon opnieuw pollen tot de deadline.
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (!poll.done) {
      if (poll.phase && onPhase) onPhase(poll.phase);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const body = (poll.body ?? {}) as {
      options?: RouteOption[];
      candidate?: RouteOption;
      error?: string;
    };
    if (poll.status >= 200 && poll.status < 300) {
      const options = Array.isArray(body.options)
        ? body.options
        : body.candidate
          ? [body.candidate]
          : [];
      if (options.length === 0) {
        return {
          ok: false,
          error: "Er kwam geen bruikbaar voorstel uit de berekening.",
        };
      }
      return { ok: true, options };
    }
    return {
      ok: false,
      error:
        body.error ?? "Routegeneratie is niet gelukt. Probeer het opnieuw.",
    };
  }
}

/**
 * Bewaar een gekozen voorstel als echte route. De server haalt ALLE routedata
 * uit de eigen opgeslagen kandidaat (candidateId) — de app kan geen metrieken
 * meesturen of vervalsen. Daarna is de route gewoon start-baar via de normale
 * navigatie-preflight (fail-closed).
 */
export function useSaveVoorstel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { candidateId: string; name?: string }) =>
      customFetch<{ route: RouteSummary }>("/api/routes", {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "generated",
          candidateId: input.candidateId,
          ...(input.name ? { name: input.name } : {}),
        }),
      }).then((r) => r.route),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

function errBody(err: unknown): string | null {
  const body = (err as { body?: { error?: string } })?.body;
  return typeof body?.error === "string" && body.error ? body.error : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
