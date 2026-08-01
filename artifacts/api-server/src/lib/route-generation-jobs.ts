// Routegeneratie-taken (WP-1, 31-07-2026).
//
// Waarom: de generatie zelf (ORS + blokkerende fail-closed veiligheidscontrole
// via Overpass) kan bij een koud gebied tientallen seconden tot minuten duren.
// Eén lange HTTP-POST is daar kwetsbaar voor: reverse proxies kappen lange
// aanvragen af en mobiele browsers breken fetches af bij schermvergrendeling
// of app-wissel — de renner ziet dan een berekening die "stil stopt".
//
// Oplossing: de klant start de generatie met een korte POST (direct een jobId
// terug), de berekening loopt server-side door in exact dezelfde motor met
// dezelfde fail-closed poorten, en de klant pollt lichtgewicht de status. Een
// verbroken poll is onschuldig: de volgende poll haalt het resultaat alsnog op.
//
// Dit is bewust een in-process opslag (zelfde patroon als de kandidaten- en
// enrichment-opslag in routes.ts): jobs zijn kortlevend en niet kostbaar — na
// een serverherstart start de renner gewoon een nieuwe aanvraag.

export type RouteGenerationPhase =
  | "wachten"
  | "berekenen"
  | "veiligheidscontrole";

export type RouteGenerationJob = {
  id: string;
  clerkId: string;
  phase: RouteGenerationPhase;
  done: boolean;
  // Wanneer done: het exacte HTTP-contract dat het synchrone endpoint zou
  // hebben teruggegeven (status + JSON-body). Zo kunnen de bestaande
  // eerlijke foutcodes (422 NO_SUITABLE_ROUTE, 503 ROUTE_UNVERIFIABLE, …)
  // ongewijzigd doorstromen naar de klant.
  status: number | null;
  body: unknown;
  createdAt: number;
};

const JOBS = new Map<string, RouteGenerationJob>();
const JOB_TTL_MS = 30 * 60 * 1000;

// KETEN_FIETS_01 (01-08-2026), harde eis 1: iedere routegeneratietaak eindigt.
// De deadline geldt voor de TAAK, niet voor de veiligheidscontrole: verloopt
// de taak, dan is de uitkomst eerlijk "geen route geleverd" (fail-closed) —
// nooit "route geleverd zonder controle". Bewust korter dan de klant-timeout
// van 6 minuten (use-routes.ts), zodat de klant een eerlijke serveruitkomst
// ziet in plaats van zelf te moeten opgeven.
const JOB_DEADLINE_MS = 5 * 60 * 1000;

function expireIfPastDeadline(job: RouteGenerationJob): void {
  if (job.done || Date.now() - job.createdAt <= JOB_DEADLINE_MS) return;
  // Idempotent via finishJob: komt de echte berekening later alsnog klaar,
  // dan telt deze einduitslag — de klant heeft "verlopen" mogelijk al gezien.
  finishJob(job, 504, {
    error:
      "Geen route geleverd: de berekening is niet binnen 5 minuten afgerond. De veiligheidscontrole is niet overgeslagen. Probeer het opnieuw — je keuzes zijn bewaard.",
    code: "GENERATION_DEADLINE",
  });
}
let lastSweep = 0;

function sweep(): void {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [id, job] of JOBS) {
    if (now - job.createdAt > JOB_TTL_MS) JOBS.delete(id);
  }
}

// Vaste veegbeurt: zonder verkeer mag afgerond werk (incl. routegeometrie)
// niet onbeperkt in het geheugen blijven hangen (reviewpunt 31-07-2026).
const SWEEPER = setInterval(() => {
  lastSweep = 0;
  sweep();
}, 5 * 60 * 1000);
// De timer mag het proces nooit wakker houden (tests, nette shutdown).
if (typeof SWEEPER === "object" && "unref" in SWEEPER) SWEEPER.unref();

export function createRouteGenerationJob(clerkId: string): RouteGenerationJob {
  sweep();
  const job: RouteGenerationJob = {
    id: `rgj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    clerkId,
    phase: "wachten",
    done: false,
    status: null,
    body: null,
    createdAt: Date.now(),
  };
  JOBS.set(job.id, job);
  return job;
}

export function setJobPhase(job: RouteGenerationJob, phase: RouteGenerationPhase): void {
  if (!job.done) job.phase = phase;
}

export function finishJob(job: RouteGenerationJob, status: number, body: unknown): void {
  // Idempotent: de éérste einduitslag telt. Een tweede aanroep (bv. een
  // dubbele res.json in een toekomstig handlerpad) mag het resultaat dat de
  // klant mogelijk al gezien heeft nooit meer veranderen.
  if (job.done) return;
  job.status = status;
  job.body = body;
  job.done = true;
}

/** Ownership-gecheckt ophalen: andermans job bestaat gewoon niet. */
export function getRouteGenerationJob(
  id: string,
  clerkId: string,
): RouteGenerationJob | null {
  sweep();
  const job = JOBS.get(id);
  if (!job || job.clerkId !== clerkId) return null;
  expireIfPastDeadline(job);
  return job;
}
