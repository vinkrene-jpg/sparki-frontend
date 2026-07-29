// Pure logic for the "Geplande taken" (/admin) overview.
//
// The route handler in routes/admin.ts gathers real data traces (health
// batches, goal proposals, reminder notifications, knowledge items) and hands
// them to buildScheduledTasks() here. Keeping the classification + message
// composition pure (a function of traces + `now`) makes it deterministically
// testable so a drifted query, dedupeKey prefix or column name can't silently
// flip a job to stale-green or grey unnoticed.
//
// Honesty contract: the server cannot read the Replit deployment config, so it
// can NEVER confirm a Scheduled Deployment truly exists. It only reports the
// last visible data trace. No trace within the expected cadence → warn plainly.
// Nothing is ever a fake green.

export type StatusColor = "green" | "orange" | "grey";

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduledTask {
  key:
    | "health"
    | "goal_review"
    | "reminders"
    | "knowledge_scan"
    | "connector_sync"
    | "library_backfill";
  title: string;
  description: string;
  runCommand: string;
  schedule: string;
  traceLabel: string;
  lastRunAt: string | null;
  statusColor: StatusColor;
  message: string;
}

export interface ScheduledTasksResult {
  tasks: ScheduledTask[];
  missing: number;
}

// Real data traces gathered by the handler. All dates are the newest trace
// found (or null when nothing was ever seen).
export interface ScheduledTaskTraces {
  healthLast: Date | null;
  goalLast: Date | null;
  activeGoals: number;
  reminderLast: Date | null;
  knowledgeLast: Date | null;
  /** Nieuwste GEPLANDE sync-run (trigger "scheduled") uit sync_runs. */
  connectorSyncLast: Date | null;
  /** Aantal echt gekoppelde platform-verbindingen (connected). */
  connectedConnections: number;
  /** Nieuwste gegenereerde bibliotheekroute (route_library.created_at). */
  libraryLast: Date | null;
  /** Aantal bekende woonlocatie-cellen van gebruikers. */
  libraryHomes: number;
  /** Aantal nog ongevulde cellen rond die woonlocaties. */
  libraryOpenCells: number;
}

// Classify a data trace into an honest status. `lastRunAt` = the newest trace
// we could find; `staleAfterDays` = how long before "no recent run" becomes a
// warning (the job's expected cadence + a grace margin). `now` is injected so
// the classification is deterministic and testable.
export function classify(
  lastRunAt: Date | null,
  staleAfterDays: number,
  now: number = Date.now(),
): { statusColor: StatusColor; recent: boolean } {
  if (!lastRunAt) return { statusColor: "grey", recent: false };
  const ageDays = (now - lastRunAt.getTime()) / DAY_MS;
  if (ageDays <= staleAfterDays) return { statusColor: "green", recent: true };
  return { statusColor: "orange", recent: false };
}

export function buildScheduledTasks(
  traces: ScheduledTaskTraces,
  now: number = Date.now(),
): ScheduledTasksResult {
  const {
    healthLast,
    goalLast,
    activeGoals,
    reminderLast,
    knowledgeLast,
    connectorSyncLast,
    connectedConnections,
    libraryLast,
    libraryHomes,
    libraryOpenCells,
  } = traces;

  // ── job:health ─────────────────────────────────────────────────────────────
  const health = classify(healthLast, 8, now);
  const healthTask: ScheduledTask = {
    key: "health",
    title: "Gezondheidscheck",
    description:
      "Test elke nacht automatisch alle onderdelen van de app en bewaart de uitslag.",
    runCommand: "pnpm --filter @workspace/api-server run job:health",
    schedule: "Dagelijks 04:00 (cron 0 4 * * *) · wekelijks + release-modus",
    traceLabel: "Laatste automatische controle-run",
    lastRunAt: healthLast ? healthLast.toISOString() : null,
    statusColor: health.statusColor,
    message: healthLast
      ? health.recent
        ? "De geplande gezondheidscheck draait: er is recent een automatische controle uitgevoerd."
        : "De laatste automatische controle is meer dan een week oud. Mogelijk is de geplande taak (Scheduled Deployment) gestopt of nooit aangemaakt."
      : "Er is nog nooit een automatische controle gezien. Controleer of de Scheduled Deployment 'job:health' is aangemaakt vóór livegang.",
  };

  // ── job:goal-review ──────────────────────────────────────────────────────────
  const goalCls = classify(goalLast, 35, now);
  let goalStatus: StatusColor = goalCls.statusColor;
  let goalMessage: string;
  if (goalLast) {
    goalMessage = goalCls.recent
      ? "De maandelijkse doelen-review draait: er zijn recent voorstellen gemaakt."
      : "De laatste voorstellen zijn ouder dan 35 dagen. Mogelijk draait de maandelijkse taak niet meer.";
  } else if (activeGoals === 0) {
    // Honest: nothing to propose yet, so absence of a trace is expected.
    goalStatus = "grey";
    goalMessage =
      "Er zijn nog geen actieve doelen, dus de doelen-review heeft nog niets te beoordelen. Zodra sporters doelen hebben, hoort hier resultaat te verschijnen.";
  } else {
    goalStatus = "grey";
    goalMessage = `Er zijn ${activeGoals} actieve doel(en), maar nog geen enkel voorstel. Controleer of de Scheduled Deployment 'job:goal-review' is aangemaakt.`;
  }
  const goalTask: ScheduledTask = {
    key: "goal_review",
    title: "Maandelijkse doelen-review",
    description:
      "Maakt elke maand voorstellen om de doelen van sporters bij te sturen.",
    runCommand: "pnpm --filter @workspace/api-server run job:goal-review",
    schedule: "Maandelijks, 1e van de maand 06:00 (cron 0 6 1 * *)",
    traceLabel: "Laatste doelen-voorstel",
    lastRunAt: goalLast ? goalLast.toISOString() : null,
    statusColor: goalStatus,
    message: goalMessage,
  };

  // ── job:reminders ────────────────────────────────────────────────────────────
  const reminderCls = classify(reminderLast, 3, now);
  const reminderTask: ScheduledTask = {
    key: "reminders",
    title: "Herinneringen",
    description:
      "Stuurt sporters herinneringen (check-in, training, races) in de app en per mail.",
    runCommand: "pnpm --filter @workspace/api-server run job:reminders",
    schedule: "Dagelijks 18:00 (cron 0 18 * * *)",
    traceLabel: "Laatste verstuurde herinnering",
    lastRunAt: reminderLast ? reminderLast.toISOString() : null,
    statusColor: reminderCls.statusColor,
    message: reminderLast
      ? reminderCls.recent
        ? "De herinneringen-taak draait: er zijn recent herinneringen aangemaakt."
        : "Er zijn al enkele dagen geen herinneringen aangemaakt. Mogelijk draait de geplande taak niet meer, of er was niets te versturen."
      : "Er is nog nooit een geplande herinnering gezien. Controleer of de Scheduled Deployment 'job:reminders' is aangemaakt vóór livegang.",
  };

  // ── knowledge-scan ───────────────────────────────────────────────────────────
  const knowledgeCls = classify(knowledgeLast, 8, now);
  const knowledgeTask: ScheduledTask = {
    key: "knowledge_scan",
    title: "Nachtelijke kennis-scan",
    description:
      "Vult de kennisbank en het nieuws door elke nacht bronnen te scannen.",
    runCommand: "pnpm --filter @workspace/api-server run scan:knowledge",
    schedule: "Dagelijks (aanbevolen 's nachts, bv. cron 0 3 * * *)",
    traceLabel: "Laatst opgehaalde kennis-item",
    lastRunAt: knowledgeLast ? knowledgeLast.toISOString() : null,
    statusColor: knowledgeCls.statusColor,
    message: knowledgeLast
      ? knowledgeCls.recent
        ? "De kennis-scan draait: er is recent verse kennis opgehaald."
        : "De laatste kennis is meer dan een week oud. Mogelijk draait de nachtelijke scan niet meer of is de Scheduled Deployment nooit aangemaakt."
      : "De kennisbank is nog leeg. Controleer of de Scheduled Deployment 'job:knowledge' is aangemaakt vóór livegang.",
  };

  // ── job:sync (Sparki Connect inhaalsync) ─────────────────────────────────
  const syncCls = classify(connectorSyncLast, 2, now);
  let syncStatus: StatusColor = syncCls.statusColor;
  let syncMessage: string;
  if (connectorSyncLast) {
    syncMessage = syncCls.recent
      ? "De geplande koppelingen-sync draait: er is recent een automatische inhaalsync uitgevoerd."
      : "De laatste automatische inhaalsync is meer dan twee dagen oud. Mogelijk draait de geplande taak niet meer, of alle koppelingen waren steeds actueel.";
  } else if (connectedConnections === 0) {
    // Eerlijk: zonder gekoppelde platforms valt er niets in te halen.
    syncStatus = "grey";
    syncMessage =
      "Er zijn nog geen gekoppelde platforms, dus er valt niets automatisch te synchroniseren. Zodra sporters een platform koppelen, hoort hier resultaat te verschijnen.";
  } else {
    syncStatus = "grey";
    syncMessage = `Er zijn ${connectedConnections} gekoppelde platform(s), maar nog nooit een geplande inhaalsync gezien. Controleer of de Scheduled Deployment 'job:sync' is aangemaakt.`;
  }
  const syncTask: ScheduledTask = {
    key: "connector_sync",
    title: "Koppelingen-inhaalsync",
    description:
      "Controleert dagelijks alle gekoppelde platforms en haalt gemiste activiteiten begrensd in (webhooks blijven het primaire kanaal).",
    runCommand: "pnpm --filter @workspace/api-server run job:sync",
    schedule: "Dagelijks 05:00 (cron 0 5 * * *)",
    traceLabel: "Laatste geplande inhaalsync",
    lastRunAt: connectorSyncLast ? connectorSyncLast.toISOString() : null,
    statusColor: syncStatus,
    message: syncMessage,
  };

  // ── job:library-backfill (EU-kaart geleidelijk vullen) ───────────────────
  const libCls = classify(libraryLast, 3, now);
  let libStatus: StatusColor = libCls.statusColor;
  let libMessage: string;
  if (libraryHomes === 0) {
    // Eerlijk: zonder bekende woonlocaties valt er niets rond te vullen.
    libStatus = "grey";
    libMessage =
      "Er zijn nog geen woonlocaties van gebruikers bekend, dus er valt niets rond te vullen. Zodra sporters een woonadres opgeven, hoort de kaart hier nachtelijk te groeien.";
  } else if (libraryOpenCells === 0) {
    // Eerlijk geteld: alle cellen rond bekende woonlocaties zijn gevuld —
    // de taak heeft (nu) niets meer te doen.
    libStatus = "green";
    libMessage =
      "Alle gebieden rond bekende woonlocaties zijn gevuld met bibliotheekroutes. De nachtelijke taak heeft momenteel niets bij te genereren.";
  } else if (libraryLast) {
    libMessage = libCls.recent
      ? `De nachtelijke bibliotheek-backfill draait: er zijn recent bibliotheekroutes gegenereerd. Nog ${libraryOpenCells} open cel(len) rond gebruikers.`
      : `De nieuwste bibliotheekroute is ouder dan drie dagen terwijl er nog ${libraryOpenCells} open cel(len) rond gebruikers zijn. Mogelijk draait de nachtelijke taak niet meer, is de ORS-sleutel weg of is het dagplafond steeds op.`;
  } else {
    libStatus = "grey";
    libMessage = `Er zijn ${libraryHomes} woonlocatie(s) en ${libraryOpenCells} open cel(len), maar nog nooit een bibliotheekroute gegenereerd. Controleer de ORS-sleutel en of de nachtelijke taak 'job:library-backfill' draait.`;
  }
  const libraryTask: ScheduledTask = {
    key: "library_backfill",
    title: "Nachtelijke kaart-backfill",
    description:
      "Vult de EU-kaart geleidelijk met bibliotheekroutes: elke nacht een beperkt aantal nieuwe gebieden rond bestaande gebruikers (binnen het ORS-dagplafond).",
    runCommand: "pnpm --filter @workspace/api-server run job:library-backfill",
    schedule:
      "Nachtelijk, ingebouwd in de API-server (02:00–06:00) · optioneel als Scheduled Deployment (cron 30 3 * * *) — een dag-vergrendeling voorkomt dubbel draaien",
    traceLabel: "Nieuwste gegenereerde bibliotheekroute",
    lastRunAt: libraryLast ? libraryLast.toISOString() : null,
    statusColor: libStatus,
    message: libMessage,
  };

  const tasks = [
    healthTask,
    goalTask,
    reminderTask,
    knowledgeTask,
    syncTask,
    libraryTask,
  ];
  const missing = tasks.filter((t) => t.statusColor === "grey").length;

  return { tasks, missing };
}
