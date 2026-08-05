// ── CLUB_AFRONDING_01 C1: herhalende clubtrainingen ──────────────────────────
// Gemount onder /api/clubs/:clubId/training-series (zie routes/index.ts).
//
// Zelfde reeksbehandeling als workout-series.ts (F5), met hergebruik van
// lib/workout-series voor regelvalidatie en datumgeneratie. Géén tweede
// reeksmechanisme: een reeks materialiseert echte club_trainings-rijen
// vooruit, begrensd door de einddatum van het actieve seizoen (besluit 01-08).
//
// Scopes bij wijzigen: one (loskoppelen + uitzondering) · following (reeks
// splitsen) · all. Beëindigen/annuleren raakt alleen nog geplande trainingen;
// uitgevoerde historie blijft staan. Elke mutatie lockt de reeks binnen de
// transactie met SELECT … FOR UPDATE (geen stille overschrijving).
//
// Rechten: dezelfde rollen die vandaag een clubtraining mogen aanmaken
// (canManageTrainings) — geen nieuwe rechten.

import { Router, type IRouter } from "express";
import { and, eq, gte, asc } from "drizzle-orm";
import {
  db,
  clubTrainingsTable,
  clubTrainingSeriesTable,
  clubSeasonsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getClubContext,
  canManageTrainings,
  writeClubAudit,
  type ClubContext,
} from "../lib/club-permissions";
import {
  validateRule,
  seriesDates,
  isValidDateOnly,
  compareDates,
  previousDay,
  type SeriesRule,
} from "../lib/workout-series";

const router: IRouter = Router({ mergeParams: true });

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SeriesRow = typeof clubTrainingSeriesTable.$inferSelect;

function amsterdamToday(): string {
  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function intOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Clubcontext + trainingsrechten of eerlijke 403/404. */
async function trainerCtx(
  req: import("express").Request,
  res: import("express").Response,
  write = true,
): Promise<ClubContext | null> {
  const clubId = intOrNull(req.params["clubId"]);
  if (clubId == null) {
    res.status(400).json({ error: "Ongeldige club" });
    return null;
  }
  const ctx = await getClubContext(clubId, getClerkUserId(req)!);
  if (!ctx) {
    res.status(403).json({ error: "Geen toegang tot deze club." });
    return null;
  }
  if (!canManageTrainings(ctx)) {
    res.status(403).json({ error: "Alleen beheer of een trainer kan clubtrainingsreeksen beheren." });
    return null;
  }
  // Zelfde statuspoort als alle andere club-schrijfpaden (clubWritableOr409):
  // in een niet-actieve club kan alles bekeken maar niets gewijzigd worden.
  if (write && ctx.club.status !== "actief") {
    res.status(409).json({
      error: "Deze club is op dit moment niet actief. Bekijken kan, wijzigen niet.",
    });
    return null;
  }
  return ctx;
}

/** Reeks van deze club row-locken binnen de lopende transactie. */
async function lockSeries(tx: Tx, clubId: number, idRaw: unknown): Promise<SeriesRow | null> {
  const id = intOrNull(idRaw);
  if (id == null) return null;
  const [series] = await tx
    .select()
    .from(clubTrainingSeriesTable)
    .where(and(eq(clubTrainingSeriesTable.id, id), eq(clubTrainingSeriesTable.clubId, clubId)))
    .limit(1)
    .for("update");
  return series ?? null;
}

/** Sjabloonvelden uit de reeks voor een nieuwe club_trainings-rij. */
function templateOf(series: SeriesRow) {
  return {
    title: series.title,
    startTime: series.startTime,
    location: series.location,
    locationId: series.locationId,
    routeId: series.routeId,
    level: series.level,
    goal: series.goal,
    trainerClerkId: series.trainerClerkId,
    teamId: series.teamId,
    groupId: series.groupId,
    maxParticipants: series.maxParticipants,
    durationMin: series.durationMin,
    materialInfo: series.materialInfo,
    safetyInfo: series.safetyInfo,
    notes: series.notes,
  };
}

const TEMPLATE_TEXT_KEYS = [
  "title",
  "startTime",
  "location",
  "level",
  "goal",
  "materialInfo",
  "safetyInfo",
  "notes",
  "trainerClerkId",
] as const;
const TEMPLATE_INT_KEYS = [
  "locationId",
  "routeId",
  "teamId",
  "groupId",
  "maxParticipants",
  "durationMin",
] as const;

function templatePatch(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const k of TEMPLATE_TEXT_KEYS) {
    if (typeof body[k] === "string") patch[k] = str(body[k]);
  }
  for (const k of TEMPLATE_INT_KEYS) {
    if (body[k] !== undefined) patch[k] = body[k] == null ? null : intOrNull(body[k]);
  }
  return patch;
}

// ── POST / — reeks aanmaken + trainingen voor het seizoen materialiseren ────
router.post("/", requireAuth, async (req, res) => {
  try {
    const ctx = await trainerCtx(req, res);
    if (!ctx) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = str(body["title"]);
    if (!title) {
      res.status(400).json({ error: "Titel is verplicht" });
      return;
    }

    // Einddatum: expliciet meegegeven, anders de einddatum van het actieve
    // seizoen (besluit 01-08: de reeks loopt het hele actieve seizoen vooruit).
    let endDate = typeof body["endDate"] === "string" ? (body["endDate"] as string) : null;
    const [season] = await db
      .select()
      .from(clubSeasonsTable)
      .where(and(eq(clubSeasonsTable.clubId, ctx.club.id), eq(clubSeasonsTable.status, "actief")));
    const seasonEnd = season?.endsOn ?? null;
    if (!endDate) endDate = seasonEnd;
    if (!endDate) {
      res.status(400).json({
        error:
          "Geen einddatum: geef een einddatum mee of stel eerst een actief seizoen met einddatum in.",
      });
      return;
    }
    // Nooit voorbij het actieve seizoen (begrensd door de seizoenseinddatum).
    if (seasonEnd && compareDates(endDate, seasonEnd) > 0) endDate = seasonEnd;

    const rule: SeriesRule = {
      frequency: body["frequency"] as SeriesRule["frequency"],
      weekdays: (body["weekdays"] as number[] | undefined) ?? null,
      intervalDays: (body["intervalDays"] as number | undefined) ?? null,
      startDate: String(body["startDate"] ?? ""),
      endDate,
      exceptions: (body["exceptions"] as string[] | undefined) ?? [],
    };
    const valid = validateRule(rule);
    if (!valid.ok) {
      res.status(400).json({ error: valid.error });
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

    const template = {
      title,
      startTime: str(body["startTime"]),
      location: str(body["location"]),
      locationId: body["locationId"] != null ? intOrNull(body["locationId"]) : null,
      routeId: body["routeId"] != null ? intOrNull(body["routeId"]) : null,
      level: str(body["level"]),
      goal: str(body["goal"]),
      trainerClerkId:
        str(body["trainerClerkId"]) ??
        (ctx.membership.role === "trainer" ? ctx.membership.clerkId : null),
      teamId: body["teamId"] != null ? intOrNull(body["teamId"]) : null,
      groupId: body["groupId"] != null ? intOrNull(body["groupId"]) : null,
      maxParticipants: body["maxParticipants"] != null ? intOrNull(body["maxParticipants"]) : null,
      durationMin: body["durationMin"] != null ? intOrNull(body["durationMin"]) : null,
      materialInfo: str(body["materialInfo"]),
      safetyInfo: str(body["safetyInfo"]),
      notes: str(body["notes"]),
    };

    const result = await db.transaction(async (tx) => {
      const [series] = await tx
        .insert(clubTrainingSeriesTable)
        .values({
          clubId: ctx.club.id,
          frequency: rule.frequency,
          weekdays: rule.weekdays ?? null,
          intervalDays: rule.intervalDays ?? null,
          startDate: rule.startDate,
          endDate: rule.endDate,
          exceptions: rule.exceptions ?? [],
          ...template,
          createdByClerkId: ctx.membership.clerkId,
        })
        .returning();
      const rows = dates.map((trainingDate) => ({
        clubId: ctx.club.id,
        trainingDate,
        ...template,
        seriesId: series!.id,
        createdByClerkId: ctx.membership.clerkId,
      }));
      const created = await tx
        .insert(clubTrainingsTable)
        .values(rows)
        .returning({ id: clubTrainingsTable.id });
      return { series: series!, createdCount: created.length };
    });
    // Eén auditregel per reeks-actie, nooit per gegenereerde training.
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "trainingsreeks_aangemaakt",
      targetType: "trainingsreeks",
      targetId: result.series.id,
      detail: { trainingen: result.createdCount, tot: rule.endDate },
    });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "club training-series POST failed");
    res.status(500).json({ error: "Reeks aanmaken is niet gelukt." });
  }
});

// ── GET / — reeksen van de club ──────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const ctx = await trainerCtx(req, res, false);
    if (!ctx) return;
    const series = await db
      .select()
      .from(clubTrainingSeriesTable)
      .where(eq(clubTrainingSeriesTable.clubId, ctx.club.id))
      .orderBy(asc(clubTrainingSeriesTable.startDate));
    res.json(series);
  } catch (err) {
    req.log.error({ err }, "club training-series GET failed");
    res.status(500).json({ error: "Reeksen ophalen is niet gelukt." });
  }
});

// ── PUT /:seriesId — wijzigen met scope one | following | all ───────────────
router.put("/:seriesId", requireAuth, async (req, res) => {
  try {
    const ctx = await trainerCtx(req, res);
    if (!ctx) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const scope = String(body["scope"] ?? "all");
    const fromDate = typeof body["fromDate"] === "string" ? (body["fromDate"] as string) : null;
    if ((scope === "one" || scope === "following") && (!fromDate || !isValidDateOnly(fromDate))) {
      res.status(400).json({ error: "fromDate (yyyy-mm-dd) is verplicht bij deze scope" });
      return;
    }
    const patch = templatePatch(body);
    // Verplaatsen van één training: nieuwe datum mag mee bij scope=one.
    const newDate =
      typeof body["trainingDate"] === "string" && isValidDateOnly(body["trainingDate"])
        ? (body["trainingDate"] as string)
        : null;
    if (Object.keys(patch).length === 0 && !(scope === "one" && newDate)) {
      res.status(400).json({ error: "Geen wijzigbare velden meegegeven" });
      return;
    }

    const outcome = await db.transaction(async (tx) => {
      const series = await lockSeries(tx, ctx.club.id, req.params["seriesId"]);
      if (!series) return { status: 404 as const };
      if (series.status !== "active") {
        return { status: 409 as const, error: "Deze reeks is beëindigd of geannuleerd" };
      }

      if (scope === "one") {
        // Eén training: loskoppelen (blijft zelfstandig) + uitzondering
        // registreren, zodat de rest van de reeks ongemoeid blijft.
        const rows = await tx
          .update(clubTrainingsTable)
          .set({
            ...(patch as object),
            ...(newDate ? { trainingDate: newDate } : {}),
            seriesId: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(clubTrainingsTable.clubId, ctx.club.id),
              eq(clubTrainingsTable.seriesId, series.id),
              eq(clubTrainingsTable.trainingDate, fromDate!),
              eq(clubTrainingsTable.status, "gepland"),
            ),
          )
          .returning({ id: clubTrainingsTable.id });
        if (rows.length === 0) {
          return { status: 404 as const, error: "Geen geplande training van deze reeks op die datum" };
        }
        const exceptions = Array.from(new Set([...(series.exceptions ?? []), fromDate!]));
        await tx
          .update(clubTrainingSeriesTable)
          .set({ exceptions, updatedAt: new Date() })
          .where(eq(clubTrainingSeriesTable.id, series.id));
        return { status: 200 as const, body: { scope, updated: rows.length } };
      }

      if (scope === "following") {
        if (compareDates(fromDate!, series.startDate) <= 0) {
          return applyAll(tx, ctx, series, patch);
        }
        if (compareDates(fromDate!, series.endDate) > 0) {
          return { status: 400 as const, error: "fromDate ligt na het einde van de reeks" };
        }
        // Split: oorspronkelijke reeks eindigt de dag vóór de grens; nieuwe
        // reeks draagt het gewijzigde sjabloon en dezelfde herhaalregel.
        const boundary = fromDate!;
        const oldEnd = previousDay(boundary);
        const beforeEx = (series.exceptions ?? []).filter((e) => compareDates(e, boundary) < 0);
        const afterEx = (series.exceptions ?? []).filter((e) => compareDates(e, boundary) >= 0);
        const rule: SeriesRule = {
          frequency: series.frequency as SeriesRule["frequency"],
          weekdays: series.weekdays ?? null,
          intervalDays: series.intervalDays ?? null,
          startDate: series.startDate,
          endDate: series.endDate,
          exceptions: series.exceptions ?? [],
        };
        const upcoming = seriesDates(rule, boundary);
        const newStart = upcoming[0] ?? boundary;
        await tx
          .update(clubTrainingSeriesTable)
          .set({ endDate: oldEnd, exceptions: beforeEx, updatedAt: new Date() })
          .where(eq(clubTrainingSeriesTable.id, series.id));
        const [next] = await tx
          .insert(clubTrainingSeriesTable)
          .values({
            clubId: series.clubId,
            frequency: series.frequency,
            weekdays: series.weekdays ?? null,
            intervalDays: series.intervalDays ?? null,
            startDate: newStart,
            endDate: series.endDate,
            exceptions: afterEx,
            ...templateOf(series),
            ...(patch as object),
            createdByClerkId: series.createdByClerkId,
          })
          .returning();
        const rows = await tx
          .update(clubTrainingsTable)
          .set({ ...(patch as object), seriesId: next!.id, updatedAt: new Date() })
          .where(
            and(
              eq(clubTrainingsTable.clubId, ctx.club.id),
              eq(clubTrainingsTable.seriesId, series.id),
              eq(clubTrainingsTable.status, "gepland"),
              gte(clubTrainingsTable.trainingDate, boundary),
            ),
          )
          .returning({ id: clubTrainingsTable.id });
        return {
          status: 200 as const,
          body: { scope, updated: rows.length, series: { id: series.id }, newSeries: { id: next!.id } },
        };
      }

      return applyAll(tx, ctx, series, patch);
    });

    if (outcome.status === 200) {
      await writeClubAudit({
        clubId: ctx.club.id,
        actorClerkId: ctx.membership.clerkId,
        action: "trainingsreeks_gewijzigd",
        targetType: "trainingsreeks",
        targetId: intOrNull(req.params["seriesId"]) ?? 0,
        detail: { scope, velden: Object.keys(patch) },
      });
      res.json(outcome.body);
    } else res.status(outcome.status).json({ error: outcome.error ?? "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "club training-series PUT failed");
    res.status(500).json({ error: "Reeks wijzigen is niet gelukt." });
  }
});

async function applyAll(
  tx: Tx,
  ctx: ClubContext,
  series: SeriesRow,
  patch: Record<string, unknown>,
): Promise<{ status: 200; body: unknown } | { status: 400 | 404 | 409; error?: string }> {
  await tx
    .update(clubTrainingSeriesTable)
    .set({ ...(patch as object), updatedAt: new Date() })
    .where(eq(clubTrainingSeriesTable.id, series.id));
  const rows = await tx
    .update(clubTrainingsTable)
    .set({ ...(patch as object), updatedAt: new Date() })
    .where(
      and(
        eq(clubTrainingsTable.clubId, ctx.club.id),
        eq(clubTrainingsTable.seriesId, series.id),
        eq(clubTrainingsTable.status, "gepland"),
      ),
    )
    .returning({ id: clubTrainingsTable.id });
  return { status: 200, body: { scope: "all", updated: rows.length } };
}

// ── POST /:seriesId/skip — één datum overslaan (vakantie/feestdag) ───────────
router.post("/:seriesId/skip", requireAuth, async (req, res) => {
  try {
    const ctx = await trainerCtx(req, res);
    if (!ctx) return;
    const date = String(((req.body ?? {}) as Record<string, unknown>)["date"] ?? "");
    if (!isValidDateOnly(date)) {
      res.status(400).json({ error: "Ongeldige datum (yyyy-mm-dd)" });
      return;
    }
    const outcome = await db.transaction(async (tx) => {
      const series = await lockSeries(tx, ctx.club.id, req.params["seriesId"]);
      if (!series) return { status: 404 as const };
      if (series.status !== "active") {
        return { status: 409 as const, error: "Deze reeks is beëindigd of geannuleerd" };
      }
      const rows = await tx
        .delete(clubTrainingsTable)
        .where(
          and(
            eq(clubTrainingsTable.clubId, ctx.club.id),
            eq(clubTrainingsTable.seriesId, series.id),
            eq(clubTrainingsTable.trainingDate, date),
            eq(clubTrainingsTable.status, "gepland"),
          ),
        )
        .returning({ id: clubTrainingsTable.id });
      const exceptions = Array.from(new Set([...(series.exceptions ?? []), date]));
      await tx
        .update(clubTrainingSeriesTable)
        .set({ exceptions, updatedAt: new Date() })
        .where(eq(clubTrainingSeriesTable.id, series.id));
      return { status: 200 as const, body: { removed: rows.length } };
    });
    if (outcome.status === 200) res.json(outcome.body);
    else res.status(outcome.status).json({ error: outcome.error ?? "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "club training-series skip failed");
    res.status(500).json({ error: "Training overslaan is niet gelukt." });
  }
});

// ── POST /:seriesId/end — reeks beëindigen (toekomst weg, historie blijft) ──
router.post("/:seriesId/end", requireAuth, async (req, res) => {
  try {
    const ctx = await trainerCtx(req, res);
    if (!ctx) return;
    const today = amsterdamToday();
    const outcome = await db.transaction(async (tx) => {
      const series = await lockSeries(tx, ctx.club.id, req.params["seriesId"]);
      if (!series) return { status: 404 as const };
      if (series.status !== "active") {
        return { status: 409 as const, error: "Deze reeks is al beëindigd of geannuleerd" };
      }
      const rows = await tx
        .delete(clubTrainingsTable)
        .where(
          and(
            eq(clubTrainingsTable.clubId, ctx.club.id),
            eq(clubTrainingsTable.seriesId, series.id),
            eq(clubTrainingsTable.status, "gepland"),
            gte(clubTrainingsTable.trainingDate, today),
          ),
        )
        .returning({ id: clubTrainingsTable.id });
      const endDate = compareDates(today, series.startDate) < 0 ? series.startDate : today;
      await tx
        .update(clubTrainingSeriesTable)
        .set({ status: "ended", endDate, updatedAt: new Date() })
        .where(eq(clubTrainingSeriesTable.id, series.id));
      return { status: 200 as const, body: { status: "ended", removed: rows.length } };
    });
    if (outcome.status === 200) {
      await writeClubAudit({
        clubId: ctx.club.id,
        actorClerkId: ctx.membership.clerkId,
        action: "trainingsreeks_beeindigd",
        targetType: "trainingsreeks",
        targetId: intOrNull(req.params["seriesId"]) ?? 0,
      });
      res.json(outcome.body);
    } else res.status(outcome.status).json({ error: outcome.error ?? "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "club training-series end failed");
    res.status(500).json({ error: "Reeks beëindigen is niet gelukt." });
  }
});

// ── DELETE /:seriesId — reeks annuleren ──────────────────────────────────────
// Alle nog geplande trainingen van de reeks verdwijnen (ook in het verleden);
// uitgevoerde/afgeronde trainingen blijven staan en worden losgekoppeld.
router.delete("/:seriesId", requireAuth, async (req, res) => {
  try {
    const ctx = await trainerCtx(req, res);
    if (!ctx) return;
    const outcome = await db.transaction(async (tx) => {
      const series = await lockSeries(tx, ctx.club.id, req.params["seriesId"]);
      if (!series) return { status: 404 as const };
      if (series.status === "cancelled") {
        return { status: 200 as const, body: { status: "cancelled", removed: 0 } };
      }
      const rows = await tx
        .delete(clubTrainingsTable)
        .where(
          and(
            eq(clubTrainingsTable.clubId, ctx.club.id),
            eq(clubTrainingsTable.seriesId, series.id),
            eq(clubTrainingsTable.status, "gepland"),
          ),
        )
        .returning({ id: clubTrainingsTable.id });
      await tx
        .update(clubTrainingsTable)
        .set({ seriesId: null, updatedAt: new Date() })
        .where(and(eq(clubTrainingsTable.clubId, ctx.club.id), eq(clubTrainingsTable.seriesId, series.id)));
      await tx
        .update(clubTrainingSeriesTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(clubTrainingSeriesTable.id, series.id));
      return { status: 200 as const, body: { status: "cancelled", removed: rows.length } };
    });
    if (outcome.status === 200) {
      await writeClubAudit({
        clubId: ctx.club.id,
        actorClerkId: ctx.membership.clerkId,
        action: "trainingsreeks_geannuleerd",
        targetType: "trainingsreeks",
        targetId: intOrNull(req.params["seriesId"]) ?? 0,
      });
      res.json(outcome.body);
    } else res.status(outcome.status).json({ error: "Reeks niet gevonden" });
  } catch (err) {
    req.log.error({ err }, "club training-series DELETE failed");
    res.status(500).json({ error: "Reeks annuleren is niet gelukt." });
  }
});

export default router;
