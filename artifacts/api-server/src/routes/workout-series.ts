// F5 — Herhalende trainingen (SPARKI_BUILD_01).
//
// Een reeks materialiseert direct zelfstandig bruikbare planned_workouts-rijen
// (geen parallel agendaschema). Wijzigen kan met scope: één training, deze en
// volgende, of de hele reeks. Annuleren/beëindigen verwijdert alleen nog niet
// uitgevoerde toekomstige geplande rijen — historie blijft altijd staan.
// Notificaties: precies één bevestiging per reeks-actie, nooit per gegenereerde
// training.
import { Router, type IRouter } from "express";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db, plannedWorkoutsTable, workoutSeriesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { sanitizePlanDetails } from "../lib/plan-details";
import {
  validateRule,
  seriesDates,
  isValidDateOnly,
  compareDates,
  type SeriesRule,
} from "../lib/workout-series";

const router: IRouter = Router();

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

async function loadOwnedSeries(clerkId: string, idRaw: string) {
  const id = parseInt(String(idRaw), 10);
  if (isNaN(id)) return null;
  const [series] = await db
    .select()
    .from(workoutSeriesTable)
    .where(and(eq(workoutSeriesTable.id, id), eq(workoutSeriesTable.clerkId, clerkId)))
    .limit(1);
  return series ?? null;
}

// ── PUT /api/workout-series/:id — wijzigen met scope ─────────────────────────
// scope: "one" (alleen fromDate; wordt losgekoppeld + exception),
//        "following" (deze en volgende), "all" (hele reeks).
router.put("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const series = await loadOwnedSeries(clerkId, String(req.params["id"]));
  if (!series) {
    res.status(404).json({ error: "Reeks niet gevonden" });
    return;
  }
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
  let details: unknown;
  if (body["planDetails"] !== undefined) {
    const sanitized = sanitizePlanDetails(body["planDetails"]);
    if (!sanitized.ok) {
      res.status(400).json({ error: sanitized.error });
      return;
    }
    details = sanitized.details;
    patch["planDetails"] = details;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Geen wijzigbare velden meegegeven" });
    return;
  }

  try {
    if (scope === "one") {
      // Eén training: koppel los van de reeks (blijft zelfstandig) + pas aan,
      // en registreer de dag als uitzondering zodat her-generatie hem overslaat.
      const updated = await db.transaction(async (tx) => {
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
        const exceptions = Array.from(new Set([...(series.exceptions ?? []), fromDate!]));
        await tx
          .update(workoutSeriesTable)
          .set({ exceptions, updatedAt: new Date() })
          .where(eq(workoutSeriesTable.id, series.id));
        return rows.length;
      });
      if (updated === 0) {
        res.status(404).json({ error: "Geen geplande training van deze reeks op die datum" });
        return;
      }
      res.json({ scope, updated });
      return;
    }

    // "following" of "all": sjabloon bijwerken + nog niet uitgevoerde
    // (status=planned) trainingen vanaf de grens mee-updaten.
    const boundary = scope === "following" ? fromDate! : null;
    const updated = await db.transaction(async (tx) => {
      await tx
        .update(workoutSeriesTable)
        .set({ ...(patch as object), updatedAt: new Date() })
        .where(eq(workoutSeriesTable.id, series.id));
      const where = boundary
        ? and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.seriesId, series.id),
            eq(plannedWorkoutsTable.status, "planned"),
            gte(plannedWorkoutsTable.scheduledDate, boundary),
          )
        : and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.seriesId, series.id),
            eq(plannedWorkoutsTable.status, "planned"),
          );
      const rows = await tx
        .update(plannedWorkoutsTable)
        .set({ ...(patch as object), updatedAt: new Date() })
        .where(where)
        .returning({ id: plannedWorkoutsTable.id });
      return rows.length;
    });
    res.json({ scope, updated });
  } catch (err) {
    req.log.error({ err }, "workout-series PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/workout-series/:id/skip — één datum overslaan ─────────────────
router.post("/:id/skip", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const series = await loadOwnedSeries(clerkId, String(req.params["id"]));
  if (!series) {
    res.status(404).json({ error: "Reeks niet gevonden" });
    return;
  }
  const date = String((req.body ?? {})["date"] ?? "");
  if (!isValidDateOnly(date)) {
    res.status(400).json({ error: "Ongeldige datum (yyyy-mm-dd)" });
    return;
  }
  try {
    const removed = await db.transaction(async (tx) => {
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
      return rows.length;
    });
    res.json({ removed });
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
  const series = await loadOwnedSeries(clerkId, String(req.params["id"]));
  if (!series) {
    res.status(404).json({ error: "Reeks niet gevonden" });
    return;
  }
  const today = amsterdamToday();
  try {
    const removed = await db.transaction(async (tx) => {
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
      return rows.length;
    });
    res.json({ status: "ended", removed });
  } catch (err) {
    req.log.error({ err }, "workout-series end failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/workout-series/:id — reeks annuleren ────────────────────────
// Alle nog geplande (niet uitgevoerde) trainingen van de reeks verdwijnen,
// óók in het verleden; uitgevoerde trainingen blijven staan (series_id wordt
// door de FK op SET NULL losgekoppeld als de reeksrij ooit echt verwijderd
// wordt — hier zetten we status="cancelled" en behouden we de historie).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const series = await loadOwnedSeries(clerkId, String(req.params["id"]));
  if (!series) {
    res.status(404).json({ error: "Reeks niet gevonden" });
    return;
  }
  try {
    const removed = await db.transaction(async (tx) => {
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
      // Niet-geplande (bijv. voltooide) trainingen loskoppelen zodat de
      // historie zelfstandig blijft bestaan.
      await tx
        .update(plannedWorkoutsTable)
        .set({ seriesId: null, updatedAt: new Date() })
        .where(and(eq(plannedWorkoutsTable.clerkId, clerkId), eq(plannedWorkoutsTable.seriesId, series.id)));
      await tx
        .update(workoutSeriesTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(workoutSeriesTable.id, series.id));
      return rows.length;
    });
    res.json({ status: "cancelled", removed });
  } catch (err) {
    req.log.error({ err }, "workout-series DELETE failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
