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
  key: "health" | "goal_review" | "reminders" | "knowledge_scan";
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
  const { healthLast, goalLast, activeGoals, reminderLast, knowledgeLast } =
    traces;

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

  const tasks = [healthTask, goalTask, reminderTask, knowledgeTask];
  const missing = tasks.filter((t) => t.statusColor === "grey").length;

  return { tasks, missing };
}
