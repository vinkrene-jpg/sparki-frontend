// F5 — Herhalende trainingen (SPARKI_BUILD_01).
//
// Een reeks materialiseert direct zelfstandig bruikbare planned_workouts-rijen
// (geen parallel agendaschema). Wijzigen kan met scope: één training, deze en
// volgende (= reeks splitsen), of de hele reeks. Annuleren/beëindigen
// verwijdert alleen nog niet uitgevoerde geplande rijen — historie blijft.
//
// Concurrency: elke mutatie laadt de reeks BINNEN de transactie met
// SELECT … FOR UPDATE (eigenaarfilter + status-check), zodat parallelle
// skip/one-acties geen uitzonderingen verliezen en end/cancel/edit elkaar
// nooit stil overschrijven.
//
// Notificaties: precies één bevestiging per reeks-actie, nooit per
// gegenereerde training.
import { Router, type IRouter } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, plannedWorkoutsTable, workoutSeriesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { sanitizePlanDetails } from "../lib/plan-details";
import {
  validateRule,
  seriesDates,
  isValidDateOnly,
  compareDates,
  previousDay,
  type SeriesRule,
} from "../lib/workout-series";

const router: IRouter = Router();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SeriesRow = typeof workoutSeriesTable.$inferSelect;

function amsterdamToday(): string {
  // Lokale Amsterdamse kalenderdag (memory: local-date UTC-trap).
  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ruleFrom(body: Record<string, unknown>): SeriesRule {
  return {
    frequency: body["frequency"] as SeriesRule["frequency"],
    weekdays: (body["weekdays"] as number[] | undefined) ?? null,
    intervalDays: (body["intervalDays"] as number | undefined) ?? null,
    startDate: String(body["startDate"] ?? ""),
    endDate: String(body["endDate"] ?? ""),
    exceptions: (body["exceptions"] as string[] | undefined) ?? [],
  };
}

function ruleOf(series: SeriesRow): SeriesRule {
  return {
    frequency: series.frequency as SeriesRule["frequency"],
    weekdays: series.weekdays ?? null,
    intervalDays: series.intervalDays ?? null,
    startDate: series.startDate,
    endDate: series.endDate,
    exceptions: series.exceptions ?? [],
  };
}

/** Reeks van deze eigenaar row-locken binnen de lopende transactie. */
async function lockOwnedSeries(
  tx: Tx,
  clerkId: string,
  idRaw: string,
): Promise<SeriesRow | null> {
  const id = parseInt(String(idRaw), 10);
  if (isNaN(id)) return null;
  const [series] = await tx
    .select()
    .from(workoutSeriesTable)
    .where(and(eq(workoutSeriesTable.id, id), eq(workoutSeriesTable.clerkId, clerkId)))
    .limit(1)
    .for("update");
  return series ?? null;
}

// ── POST /api/workout-series — reeks aanmaken + trainingen genereren ─────────
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = typeof body["title"] === "string" ? (body["title"] as string).trim() : "";
  if (!title) {
    res.status(400).json({ error: "Titel is verplicht" });
    return;
  }
  const rule = ruleFrom(body);
  const valid = validateRule(rule);
  if (!valid.ok) {
    res.status(400).json({ error: valid.error });
    return;
  }
  const sanitized = sanitizePlanDetails(body["planDetails"]);
  if (!sanitized.ok) {
    res.status(400).json({ error: sanitized.error });
    return;
  }
  const dates = seriesDates(rule);
  if (dates.length === 0) {
    res.status(400).json({ error: "Deze herhaling levert geen enkele trainingsdag op" });
    return;
  }
  if (dates.length > 200) {
    res.status(400).json({ error: `Deze reeks zou ${dates.length} trainingen aanmaken (maximaal 200)` });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [series] = await tx
        .insert(workoutSeriesTable)
        .values({
          clerkId,
          frequency: rule.frequency,
          weekdays: rule.weekdays ?? null,
          intervalDays: rule.intervalDays ?? null,
          startDate: rule.startDate,
          endDate: rule.endDate,
          exceptions: rule.exceptions ?? [],
          type: typeof body["type"] === "string" ? (body["type"] as string) : "ride",
          title,
          description: typeof body["description"] === "string" ? (body["description"] as string) : null,
          targetDurationMin:
            typeof body["targetDurationMin"] === "number" ? (body["targetDurationMin"] as number) : null,
          targetTSS: typeof body["targetTSS"] === "number" ? (body["targetTSS"] as number) : null,
          planDetails: sanitized.details,
          source: "sparki",
        })
        .returning();
      const rows = dates.map((scheduledDate) => ({
        clerkId,
        scheduledDate,
        type: series!.type,
        title: series!.title,
        description: series!.description,
        targetDurationMin: series!.targetDurationMin,
        targetTSS: series!.targetTSS,
        planDetails: sanitized.details,
        status: "planned" as const,
        source: "sparki" as const,
        seriesId: series!.id,
      }));
      const created = await tx.insert(plannedWorkoutsTable).values(rows).returning({ id: plannedWorkoutsTable.id });
      return { series: series!, createdCount: created.length };
    });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "workout-series POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/workout-series — reeksen van de sporter ─────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const series = await db
      .select()
      .from(workoutSeriesTable)
      .where(eq(workoutSeriesTable.clerkId, clerkId))
      .orderBy(workoutSeriesTable.startDate);
    res.json(series);
  } catch (err) {
    req.log.error({ err }, "workout-series GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/workout-series/:id — wijzigen met scope ─────────────────────────
// scope: "one"       — alleen fromDate; training wordt losgekoppeld + exception.
//        "following" — reeks wordt GESPLITST: de oorspronkelijke reeks eindigt
//                      de dag vóór fromDate, een nieuwe reeks (met het
//                      gewijzigde sjabloon en dezelfde herhaalregel) neemt de
//                      rijen vanaf fromDate over. Zo blijft de oorspronkelijke
//                      helft ook bij latere her-generatie intact.
//        "all"       — sjabloon + alle nog geplande rijen.
router.put("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const scope = String(body["scope"] ?? "all");
  const fromDate = typeof body["fromDate"] === "string" ? (body["fromDate"] as string) : null;
  if ((scope === "one" || scope === "following") && (!fromDate || !isValidDateOnly(fromDate))) {
    res.status(400).json({ error: "fromDate (yyyy-mm-dd) is verplicht bij deze scope" });
    return;
  }
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "description", "type"] as const) {
    if (typeof body[k] === "string") patch[k] = body[k];
  }
  for (const k of ["targetDurationMin", "targetTSS"] as const) {
    if (typeof body[k] === "number" || body[k] === null) patch[k] = body[k];
  }
  if (body["planDetails"] !== undefined) {
    const sanitized = sanitizePlanDetails(body["planDetails"]);
    if (!sanitized.ok) {
      res.status(400).json({ error: sanitized.error });
      return;
    }
    patch["planDetails"] = sanitized.details;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Geen wijzigbare velden meegegeven" });
    return;
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      const series = await lockOwnedSeries(tx, clerkId, String(req.params["id"]));
      if (!series) return { status: 404 as const };
      if (series.status !== "active") {
        return { status: 409 as const, error: "Deze reeks is beëindigd of geannuleerd" };
      }

      if (scope === "one") {
        // Eén training: loskoppelen (blijft zelfstandig) + aanpassen, en de
        // dag als uitzondering registreren zodat her-generatie hem overslaat.
        const rows = await tx
          .update(plannedWorkoutsTable)
          .set({ ...(patch as object), seriesId: null, updatedAt: new Date() })
          .where(
            and(
              eq(plannedWorkoutsTable.clerkId, clerkId),
              eq(plannedWorkoutsTable.seriesId, series.id),
              eq(plannedWorkoutsTable.scheduledDate, fromDate!),
            ),
          )
          .returning({ id: plannedWorkoutsTable.id });
        if (rows.length === 0) {
          return { status: 404 as const, error: "Geen geplande training van deze reeks op die datum" };
        }
        const exceptions = Array.from(new Set([...(series.exceptions ?? []), fromDate!]));
        await tx
          .update(workoutSeriesTable)
          .set({ exceptions, updatedAt: new Date() })
          .where(eq(workoutSeriesTable.id, series.id));
        return { status: 200 as const, body: { scope, updated: rows.length } };
      }

      if (scope === "following") {
        if (compareDates(fromDate!, series.startDate) <= 0) {
          // Grens vóór of op de start: dit is gewoon "hele reeks".
          return applyAll(tx, clerkId, series, patch);
        }
        if (compareDates(fromDate!, series.endDate) > 0) {
          return { status: 400 as const, error: "fromDate ligt na het einde van de reeks" };
        }
        // Split: oorspronkelijke reeks eindigt de dag vóór de grens en houdt
        // alleen uitzonderingen vóór de grens; de nieuwe reeks draagt het
        // gewijzigde sjabloon, dezelfde herhaalregel en de rest.
        const boundary = fromDate!;
        const oldEnd = previousDay(boundary);
        const beforeExceptions = (series.exceptions ?? []).filter((e) => compareDates(e, boundary) < 0);
        const afterExceptions = (series.exceptions ?? []).filter((e) => compareDates(e, boundary) >= 0);
        // Weekly: de nieuwe reeks moet dezelfde weekdag houden; de startdatum
        // van de nieuwe reeks is de eerste reeksdag op/na de grens volgens de
        // ORIGINELE regel (anders verschuift "weekly" naar de grens-weekdag).
        const upcoming = seriesDates(ruleOf(series), boundary);
        const newStart = upcoming[0] ?? boundary;
        await tx
          .update(workoutSeriesTable)
          .set({ endDate: oldEnd, exceptions: beforeExceptions, updatedAt: new Date() })
          .where(eq(workoutSeriesTable.id, series.id));
        const [next] = await tx
          .insert(workoutSeriesTable)
          .values({
            clerkId,
            frequency: series.frequency,
            weekdays: series.weekdays ?? null,
            intervalDays: series.intervalDays ?? null,
            startDate: newStart,
            endDate: series.endDate,
            exceptions: afterExceptions,
            type: (patch["type"] as string) ?? series.type,
            title: (patch["title"] as string) ?? series.title,
            description:
              patch["description"] !== undefined ? (patch["description"] as string | null) : series.description,
            targetDurationMin:
              patch["targetDurationMin"] !== undefined
                ? (patch["targetDurationMin"] as number | null)
                : series.targetDurationMin,
            targetTSS: patch["targetTSS"] !== undefined ? (patch["targetTSS"] as number | null) : series.targetTSS,
            planDetails: patch["planDetails"] !== undefined ? patch["planDetails"] : series.planDetails,
            source: series.source,
            coachClerkId: series.coachClerkId,
          })
          .returning();
        // Geplande rijen vanaf de grens verhuizen naar de nieuwe reeks en
        // krijgen het nieuwe sjabloon; uitgevoerde historie blijft bij de oude.
        const rows = await tx
          .update(plannedWorkoutsTable)
          .set({ ...(patch as object), seriesId: next!.id, updatedAt: new Date() })
          .where(
            and(
              eq(plannedWorkoutsTable.clerkId, clerkId),
              eq(plannedWorkoutsTable.seriesId, series.id),
              eq(plannedWorkoutsTable.status, "planned"),
              gte(plannedWorkoutsTable.scheduledDate, boundary),
            ),
          )
          .returning({ id: plannedWorkoutsTable.id });
        return {
          status: 200 as const,
          body: { scope, updated: rows.length, series: { id: series.id }, newSeries: { id: next!.id } },
        };
      }

      return applyAll(tx, clerkId, series, patch);
    });

    if (outcome.status === 200) res.json(outcome.body);
    else res.status(outcome.status).json({ error: outcome.error ?? "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "workout-series PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function applyAll(
  tx: Tx,
  clerkId: string,
  series: SeriesRow,
  patch: Record<string, unknown>,
): Promise<{ status: 200; body: unknown } | { status: 404 | 409 | 400; error?: string }> {
  await tx
    .update(workoutSeriesTable)
    .set({ ...(patch as object), updatedAt: new Date() })
    .where(eq(workoutSeriesTable.id, series.id));
  const rows = await tx
    .update(plannedWorkoutsTable)
    .set({ ...(patch as object), updatedAt: new Date() })
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, clerkId),
        eq(plannedWorkoutsTable.seriesId, series.id),
        eq(plannedWorkoutsTable.status, "planned"),
      ),
    )
    .returning({ id: plannedWorkoutsTable.id });
  return { status: 200, body: { scope: "all", updated: rows.length } };
}

// ── POST /api/workout-series/:id/skip — één datum overslaan ─────────────────
router.post("/:id/skip", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const date = String(((req.body ?? {}) as Record<string, unknown>)["date"] ?? "");
  if (!isValidDateOnly(date)) {
    res.status(400).json({ error: "Ongeldige datum (yyyy-mm-dd)" });
    return;
  }
  try {
    const outcome = await db.transaction(async (tx) => {
      const series = await lockOwnedSeries(tx, clerkId, String(req.params["id"]));
      if (!series) return { status: 404 as const };
      if (series.status !== "active") {
        return { status: 409 as const, error: "Deze reeks is beëindigd of geannuleerd" };
      }
      const rows = await tx
        .delete(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.seriesId, series.id),
            eq(plannedWorkoutsTable.scheduledDate, date),
            eq(plannedWorkoutsTable.status, "planned"),
          ),
        )
        .returning({ id: plannedWorkoutsTable.id });
      const exceptions = Array.from(new Set([...(series.exceptions ?? []), date]));
      await tx
        .update(workoutSeriesTable)
        .set({ exceptions, updatedAt: new Date() })
        .where(eq(workoutSeriesTable.id, series.id));
      return { status: 200 as const, body: { removed: rows.length } };
    });
    if (outcome.status === 200) res.json(outcome.body);
    else res.status(outcome.status).json({ error: outcome.error ?? "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "workout-series skip failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/workout-series/:id/end — reeks beëindigen ─────────────────────
// Toekomstige nog geplande trainingen verdwijnen; verleden + uitgevoerde
// trainingen blijven (historie behouden).
router.post("/:id/end", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const today = amsterdamToday();
  try {
    const outcome = await db.transaction(async (tx) => {
      const series = await lockOwnedSeries(tx, clerkId, String(req.params["id"]));
      if (!series) return { status: 404 as const };
      if (series.status !== "active") {
        return { status: 409 as const, error: "Deze reeks is al beëindigd of geannuleerd" };
      }
      const rows = await tx
        .delete(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.seriesId, series.id),
            eq(plannedWorkoutsTable.status, "planned"),
            gte(plannedWorkoutsTable.scheduledDate, today),
          ),
        )
        .returning({ id: plannedWorkoutsTable.id });
      const endDate = compareDates(today, series.startDate) < 0 ? series.startDate : today;
      await tx
        .update(workoutSeriesTable)
        .set({ status: "ended", endDate, updatedAt: new Date() })
        .where(eq(workoutSeriesTable.id, series.id));
      return { status: 200 as const, body: { status: "ended", removed: rows.length } };
    });
    if (outcome.status === 200) res.json(outcome.body);
    else res.status(outcome.status).json({ error: outcome.error ?? "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "workout-series end failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/workout-series/:id — reeks annuleren ────────────────────────
// Alle nog geplande (niet uitgevoerde) trainingen van de reeks verdwijnen,
// óók in het verleden; uitgevoerde trainingen blijven staan en worden
// losgekoppeld (zelfstandige historie).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const outcome = await db.transaction(async (tx) => {
      const series = await lockOwnedSeries(tx, clerkId, String(req.params["id"]));
      if (!series) return { status: 404 as const };
      if (series.status === "cancelled") {
        return { status: 200 as const, body: { status: "cancelled", removed: 0 } };
      }
      const rows = await tx
        .delete(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.seriesId, series.id),
            eq(plannedWorkoutsTable.status, "planned"),
          ),
        )
        .returning({ id: plannedWorkoutsTable.id });
      await tx
        .update(plannedWorkoutsTable)
        .set({ seriesId: null, updatedAt: new Date() })
        .where(and(eq(plannedWorkoutsTable.clerkId, clerkId), eq(plannedWorkoutsTable.seriesId, series.id)));
      await tx
        .update(workoutSeriesTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(workoutSeriesTable.id, series.id));
      return { status: 200 as const, body: { status: "cancelled", removed: rows.length } };
    });
    if (outcome.status === 200) res.json(outcome.body);
    else res.status(outcome.status).json({ error: "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "workout-series DELETE failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
