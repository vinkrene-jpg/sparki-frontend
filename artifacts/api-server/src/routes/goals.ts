import { Router } from "express";
import { and, asc, desc, eq, inArray, like, ne, sql } from "drizzle-orm";
import {
  db,
  athleteGoalsTable,
  goalEventsTable,
  goalProposalsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { hasDirectCoachLink, hasAcceptedParentLink, isMinorAthlete } from "../lib/sharing";
import { createNotification } from "../lib/notifications";
import { translateGoalInput } from "../lib/goal-translate";
import {
  loadGoalPicture,
  buildMonthlyProposals,
  decideProposal,
  recordGoalEvent,
  isValidHorizon,
  isValidStatus,
} from "../engines/goals";
import {
  goalAgeBandFor,
  validateGoalForBand,
  policyPayload,
  isValidGoalKind,
  isWeightRelatedGoalText,
  bandConfig,
} from "../lib/goal-policy";

const router = Router();

// GET /api/goals/policy — leeftijdsband + toegestane doelsoorten/thema's voor
// de ingelogde gebruiker (DOELEN_01: DOE-07/12/46). De frontend rendert
// hieruit; niets is daar hardcoded.
router.get("/policy", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const band = await goalAgeBandFor(clerkId);
    res.json(policyPayload(band));
  } catch (err) {
    req.log.error({ err }, "goals.policy failed");
    res.status(500).json({ error: "Kon doelinstellingen niet laden" });
  }
});

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

// DOE-44: alleen de vier afgesproken auditvelden, niets anders, of null.
function sanitizeTranslationAudit(v: unknown): {
  originalInput: string;
  followUpCount: number;
  proposedGoal: unknown;
  confirmed: boolean;
} | null {
  if (v == null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.originalInput !== "string" || o.originalInput.trim() === "") return null;
  const followUpCount = Number(o.followUpCount);
  return {
    originalInput: o.originalInput.slice(0, 2000),
    followUpCount: Number.isInteger(followUpCount) ? Math.min(Math.max(followUpCount, 0), 2) : 0,
    proposedGoal: o.proposedGoal ?? null,
    confirmed: o.confirmed === true,
  };
}

const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00Z").getTime());

// GET /api/goals — the full goal picture: manual goals with deterministic
// progress, derived goals from existing sources, open proposals and the one
// next question (doorvraagladder).
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const picture = await loadGoalPicture(clerkId);
    res.json(picture);
  } catch (err) {
    req.log.error({ err }, "goals.picture failed");
    res.status(500).json({ error: "Kon doelen niet laden" });
  }
});

// POST /api/goals — create a goal (main or sub).
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = strOrNull(body.title);
  if (!title) {
    res.status(400).json({ error: "Een doel heeft een titel nodig" });
    return;
  }
  const horizon = isValidHorizon(body.horizon) ? body.horizon : "season";
  const targetDate = body.targetDate == null || body.targetDate === "" ? null : body.targetDate;
  if (targetDate != null && !isIsoDate(targetDate)) {
    res.status(400).json({ error: "Ongeldige streefdatum (JJJJ-MM-DD)" });
    return;
  }
  const priorityNum = Number(body.priority);
  const priority = [1, 2, 3].includes(priorityNum) ? priorityNum : 2;

  // DOELEN_01: harde serverzijdige leeftijdsfilter (DOE-07/12/13/15). De band
  // komt uit het profiel; onbekende leeftijd = meest beschermende band.
  const band = await goalAgeBandFor(clerkId);
  const kindRaw = body.kind;
  if (kindRaw !== undefined || bandConfig(band).form === "slider") {
    const check = validateGoalForBand(band, {
      kind: kindRaw ?? null,
      title,
      measure: strOrNull(body.measure),
      targetValue: strOrNull(body.targetValue),
      theme: strOrNull(body.theme),
      themeLevel: body.themeLevel,
    });
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }
  } else if (
    bandConfig(band).blockWeightRelated &&
    isWeightRelatedGoalText(title, strOrNull(body.measure), strOrNull(body.targetValue))
  ) {
    // Ook zonder expliciete doelsoort (oudere UI-paden) blijft DOE-15 gelden.
    res.status(400).json({
      error:
        "Doelen rond gewicht, w/kg of maximale kracht zijn tot 18 jaar niet beschikbaar.",
    });
    return;
  }

  let parentGoalId: number | null = null;
  if (body.parentGoalId != null) {
    const pid = Number(body.parentGoalId);
    if (!Number.isInteger(pid)) {
      res.status(400).json({ error: "Ongeldig hoofddoel" });
      return;
    }
    const [parent] = await db
      .select({ id: athleteGoalsTable.id })
      .from(athleteGoalsTable)
      .where(and(eq(athleteGoalsTable.id, pid), eq(athleteGoalsTable.clerkId, clerkId)));
    if (!parent) {
      res.status(400).json({ error: "Hoofddoel niet gevonden" });
      return;
    }
    parentGoalId = pid;
  }

  // Optioneel: atomaire update-of-aanmaak op titelprefix (Wattage-lab).
  // Zonder unieke index dwingen we serialisatie af met een advisory xact-lock
  // per (atleet, prefix) binnen één transactie — dubbelkliks of twee tabbladen
  // kunnen zo nooit twee doelen voor dezelfde duur maken.
  const dedupePrefix = strOrNull(body.dedupeTitlePrefix);

  try {
    const values = {
      clerkId,
      parentGoalId,
      title,
      description: strOrNull(body.description),
      horizon,
      targetDate: targetDate as string | null,
      measure: strOrNull(body.measure),
      targetValue: strOrNull(body.targetValue),
      priority,
      // DOELEN_01 (DOE-43): doelsoort, thema, herkomst en band bij aanmaak.
      kind: isValidGoalKind(kindRaw) ? kindRaw : null,
      theme: strOrNull(body.theme),
      themeLevel:
        Number.isInteger(Number(body.themeLevel)) && body.themeLevel !== undefined
          ? Number(body.themeLevel)
          : null,
      origin: "sporter" as const,
      ageBandAtCreation: band,
      // DOE-44: vertaal-audit meesturen bij een via vrije invoer vertaald
      // doel — originele invoer, doorvraagstappen, voorstel en bevestiging.
      translation: sanitizeTranslationAudit(body.translation),
    };

    const { goal, updated } = await db.transaction(async (tx) => {
      if (dedupePrefix) {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`goal-dedupe|${clerkId}|${dedupePrefix}`}))`,
        );
        const [existing] = await tx
          .select({ id: athleteGoalsTable.id })
          .from(athleteGoalsTable)
          .where(
            and(
              eq(athleteGoalsTable.clerkId, clerkId),
              eq(athleteGoalsTable.status, "active"),
              like(athleteGoalsTable.title, `${dedupePrefix}%`),
            ),
          )
          .limit(1);
        if (existing) {
          const [row] = await tx
            .update(athleteGoalsTable)
            .set({
              title: values.title,
              description: values.description,
              horizon: values.horizon,
              targetDate: values.targetDate,
              measure: values.measure,
              targetValue: values.targetValue,
              priority: values.priority,
              updatedAt: new Date(),
            })
            .where(eq(athleteGoalsTable.id, existing.id))
            .returning();
          return { goal: row!, updated: true };
        }
      }
      const [row] = await tx.insert(athleteGoalsTable).values(values).returning();
      return { goal: row!, updated: false };
    });

    await recordGoalEvent({
      clerkId,
      goalId: goal.id,
      eventType: updated ? "adjusted" : "created",
      note: title,
    });
    res.status(updated ? 200 : 201).json({ goal, updated });
  } catch (err) {
    req.log.error({ err }, "goals.create failed");
    res.status(500).json({ error: "Kon doel niet opslaan" });
  }
});

// PUT /api/goals/:id — adjust a goal (records an event; never silent).
router.put("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;

  const patch: Partial<typeof athleteGoalsTable.$inferInsert> = {};
  if (body.title !== undefined) {
    const t = strOrNull(body.title);
    if (!t) {
      res.status(400).json({ error: "Titel mag niet leeg zijn" });
      return;
    }
    patch.title = t;
  }
  if (body.description !== undefined) patch.description = strOrNull(body.description);
  if (body.measure !== undefined) patch.measure = strOrNull(body.measure);
  if (body.targetValue !== undefined) patch.targetValue = strOrNull(body.targetValue);
  if (body.horizon !== undefined) {
    if (!isValidHorizon(body.horizon)) {
      res.status(400).json({ error: "Ongeldige horizon" });
      return;
    }
    patch.horizon = body.horizon;
  }
  if (body.targetDate !== undefined) {
    if (body.targetDate === null || body.targetDate === "") patch.targetDate = null;
    else if (isIsoDate(body.targetDate)) patch.targetDate = body.targetDate;
    else {
      res.status(400).json({ error: "Ongeldige streefdatum (JJJJ-MM-DD)" });
      return;
    }
  }
  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (![1, 2, 3].includes(p)) {
      res.status(400).json({ error: "Ongeldige prioriteit" });
      return;
    }
    patch.priority = p;
  }
  let statusChanged: string | null = null;
  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      res.status(400).json({ error: "Ongeldige status" });
      return;
    }
    patch.status = body.status;
    patch.statusReason = strOrNull(body.statusReason);
    statusChanged = body.status;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Niets om bij te werken" });
    return;
  }

  // DOELEN_01: ook bij wijzigen blijft de leeftijdsfilter gelden (DOE-07/15) —
  // een geblokkeerde meetlat mag er niet via een update alsnog in.
  if (
    patch.title !== undefined ||
    patch.measure !== undefined ||
    patch.targetValue !== undefined
  ) {
    const band = await goalAgeBandFor(clerkId);
    const cfg = bandConfig(band);
    if (
      cfg.blockWeightRelated &&
      isWeightRelatedGoalText(
        patch.title ?? null,
        patch.measure ?? null,
        patch.targetValue ?? null,
      )
    ) {
      res.status(400).json({
        error:
          "Doelen rond gewicht, w/kg of maximale kracht zijn tot 18 jaar niet beschikbaar.",
      });
      return;
    }
    if (
      cfg.form === "slider" &&
      ((patch.measure != null && patch.measure !== "") ||
        (patch.targetValue != null && patch.targetValue !== "") ||
        (patch.title != null && /\d/.test(patch.title)))
    ) {
      res.status(400).json({ error: "Een themadoel heeft geen meetwaarde" });
      return;
    }
  }
  patch.updatedAt = new Date();

  try {
    const [updated] = await db
      .update(athleteGoalsTable)
      .set(patch)
      .where(and(eq(athleteGoalsTable.id, id), eq(athleteGoalsTable.clerkId, clerkId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Doel niet gevonden" });
      return;
    }
    const eventType =
      statusChanged === "achieved"
        ? "achieved"
        : statusChanged === "dropped"
          ? "dropped"
          : statusChanged === "paused"
            ? "paused"
            : statusChanged === "active"
              ? "resumed"
              : "adjusted";
    await recordGoalEvent({
      clerkId,
      goalId: id,
      eventType,
      note: strOrNull(body.statusReason) ?? "Bijgewerkt door de sporter",
      payload: patch,
    });
    res.json({ goal: updated });
  } catch (err) {
    req.log.error({ err }, "goals.update failed");
    res.status(500).json({ error: "Kon doel niet bijwerken" });
  }
});

// DELETE /api/goals/:id — verwijderen is een zachte verwijdering (DOE-47):
// het doel verdwijnt uit elke weergave maar blijft herleidbaar in de historie
// van de sporter. Alleen de sporter zelf kan dit (DOE-31/48).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [row] = await db
      .update(athleteGoalsTable)
      .set({ status: "dropped", statusReason: "Verwijderd door de sporter", updatedAt: new Date() })
      .where(and(eq(athleteGoalsTable.id, id), eq(athleteGoalsTable.clerkId, clerkId)))
      .returning({ id: athleteGoalsTable.id });
    if (row) {
      await recordGoalEvent({
        clerkId,
        goalId: id,
        eventType: "dropped",
        note: "Verwijderd door de sporter",
      });
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "goals.delete failed");
    res.status(500).json({ error: "Kon doel niet verwijderen" });
  }
});

// GET /api/goals/:id/events — full history of one goal.
router.get("/:id/events", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const events = await db
      .select()
      .from(goalEventsTable)
      .where(and(eq(goalEventsTable.goalId, id), eq(goalEventsTable.clerkId, clerkId)))
      .orderBy(asc(goalEventsTable.createdAt));
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "goals.events failed");
    res.status(500).json({ error: "Kon geschiedenis niet laden" });
  }
});

// POST /api/goals/proposals/build — on-demand run of the monthly review.
router.post("/proposals/build", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await buildMonthlyProposals(clerkId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "goals.proposals.build failed");
    res.status(500).json({ error: "Kon voorstellen niet opstellen" });
  }
});

// POST /api/goals/proposals/:id/decision — accept or reject a proposal.
// Voor trainervoorstellen (kind=goal_new) geldt DOELEN_01: acceptatie maakt
// het doel aan (origin=trainervoorstel) en opent de doelinzage voor díé
// trainer (DOE-32); een weigering verdwijnt nooit stil — de trainer krijgt
// bericht, met de optionele reden (DOE-25/26).
router.post("/proposals/:id/decision", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const decision = (req.body ?? {}).decision;
  if (!Number.isInteger(id) || (decision !== "accepted" && decision !== "rejected")) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const [proposal] = await db
      .select()
      .from(goalProposalsTable)
      .where(and(eq(goalProposalsTable.id, id), eq(goalProposalsTable.clerkId, clerkId)))
      .limit(1);
    if (!proposal || proposal.status !== "open") {
      res.status(404).json({ error: "Voorstel niet gevonden of al beslist" });
      return;
    }

    if (proposal.kind === "goal_new") {
      const declineReason = strOrNull((req.body ?? {}).reason);
      const proposed = (proposal.proposedChange ?? {}) as Record<string, unknown>;

      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(goalProposalsTable)
          .set({
            status: decision,
            decidedAt: new Date(),
            declineReason: decision === "rejected" ? declineReason : null,
          })
          .where(and(eq(goalProposalsTable.id, id), eq(goalProposalsTable.status, "open")))
          .returning();
        if (!updated) return null;

        if (decision !== "accepted") return { proposal: updated, goal: null };

        // Herbevestig de leeftijdsband op het moment van accepteren
        // (Mirror-toets 1: buiten de band is óók via acceptatie onmogelijk).
        const band = await goalAgeBandFor(clerkId);
        const check = validateGoalForBand(band, {
          kind: proposed.kind,
          title: typeof proposed.title === "string" ? proposed.title : "",
          measure: strOrNull(proposed.measure),
          targetValue: strOrNull(proposed.targetValue),
          theme: strOrNull(proposed.theme),
          themeLevel: proposed.themeLevel,
        });
        if (!check.ok) throw new Error(`band-block: ${check.error}`);

        const [goal] = await tx
          .insert(athleteGoalsTable)
          .values({
            clerkId,
            title: String(proposed.title),
            description: strOrNull(proposed.description),
            horizon: isValidHorizon(proposed.horizon) ? proposed.horizon : "season",
            targetDate: isIsoDate(proposed.targetDate) ? (proposed.targetDate as string) : null,
            measure: strOrNull(proposed.measure),
            targetValue: strOrNull(proposed.targetValue),
            priority: 2, // nooit ongevraagd het hoofddoel (DOE-28: sporterdoel leidt)
            kind: check.kind,
            theme: strOrNull(proposed.theme),
            origin: "trainervoorstel",
            ageBandAtCreation: band,
            trainerClerkId: proposal.proposerClerkId,
          })
          .returning();
        return { proposal: updated, goal: goal! };
      });

      if (!result) {
        res.status(404).json({ error: "Voorstel niet gevonden of al beslist" });
        return;
      }
      if (result.goal) {
        await recordGoalEvent({
          clerkId,
          goalId: result.goal.id,
          eventType: "proposal_accepted",
          note: "Trainervoorstel geaccepteerd door de sporter",
          payload: { proposalId: id, trainerClerkId: proposal.proposerClerkId },
        });
      }
      // DOE-26: de trainer hoort de uitkomst — nooit stil.
      if (proposal.proposerClerkId) {
        await createNotification({
          clerkId: proposal.proposerClerkId,
          type: "coach_update",
          title:
            decision === "accepted"
              ? "Doelvoorstel geaccepteerd"
              : "Doelvoorstel geweigerd",
          body:
            decision === "accepted"
              ? `Je sporter heeft het doel "${proposal.title}" geaccepteerd.`
              : `Je sporter heeft het doel "${proposal.title}" geweigerd.${declineReason ? ` Reden: ${declineReason}` : ""}`,
          athleteClerkId: clerkId,
          audience: "coach",
          source: "goals",
          dedupeKey: `goal-proposal-decision:${id}`,
        });
      }
      res.json({ proposal: result.proposal, goal: result.goal });
      return;
    }

    const updated = await decideProposal(clerkId, id, decision);
    if (!updated) {
      res.status(404).json({ error: "Voorstel niet gevonden of al beslist" });
      return;
    }
    res.json({ proposal: updated });
  } catch (err) {
    req.log.error({ err }, "goals.proposals.decision failed");
    res.status(500).json({ error: "Kon beslissing niet verwerken" });
  }
});

/* ── DOELEN_01: trainervoorstel en doelinzage (DOE-24 t/m DOE-37, 49-51) ── */

// GET /api/goals/trainer/:athleteId/policy — welke doelsoorten mag deze
// sporter krijgen? Het trainerscherm rendert alleen wat hier terugkomt
// (DOE-16): een trainer kan nooit iets voorstellen dat de sporter niet mag.
router.get("/trainer/:athleteId/policy", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasDirectCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen koppeling met deze sporter" });
      return;
    }
    const band = await goalAgeBandFor(athleteId);
    res.json(policyPayload(band));
  } catch (err) {
    req.log.error({ err }, "goals.trainer.policy failed");
    res.status(500).json({ error: "Kon doelinstellingen niet laden" });
  }
});

// POST /api/goals/trainer/:athleteId/proposals — een doel voorstellen
// (DOE-24). Het voorstel is géén doel tot de sporter accepteert.
router.post("/trainer/:athleteId/proposals", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    if (!(await hasDirectCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen koppeling met deze sporter" });
      return;
    }
    const title = strOrNull(body.title);
    if (!title) {
      res.status(400).json({ error: "Een doelvoorstel heeft een titel nodig" });
      return;
    }
    // Harde leeftijdsfilter op de SPORTER (DOE-16/49) — serverzijdig.
    const band = await goalAgeBandFor(athleteId);
    const check = validateGoalForBand(band, {
      kind: body.kind,
      title,
      measure: strOrNull(body.measure),
      targetValue: strOrNull(body.targetValue),
      theme: strOrNull(body.theme),
      themeLevel: body.themeLevel,
    });
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }
    const targetDate = isIsoDate(body.targetDate) ? (body.targetDate as string) : null;
    const [proposal] = await db
      .insert(goalProposalsTable)
      .values({
        clerkId: athleteId,
        goalId: null,
        kind: "goal_new",
        title,
        reasoning: strOrNull(body.reasoning) ?? "Voorstel van je trainer",
        proposedChange: {
          kind: check.kind,
          title,
          description: strOrNull(body.description),
          horizon: isValidHorizon(body.horizon) ? body.horizon : "season",
          targetDate,
          measure: strOrNull(body.measure),
          targetValue: strOrNull(body.targetValue),
          theme: strOrNull(body.theme),
        },
        proposerRole: "trainer",
        proposerClerkId: coachId,
        dedupeKey: `goal-new|${coachId}|${title.toLowerCase()}`,
      })
      .onConflictDoNothing()
      .returning();
    if (!proposal) {
      res.status(409).json({ error: "Je hebt dit doel al voorgesteld" });
      return;
    }
    await createNotification({
      clerkId: athleteId,
      type: "coach_update",
      title: "Je trainer stelt een doel voor",
      body: `"${title}" — jij beslist of het je doel wordt.`,
      audience: "athlete",
      source: "goals",
      dedupeKey: `goal-proposal:${proposal.id}`,
    });
    res.status(201).json({ proposal });
  } catch (err) {
    req.log.error({ err }, "goals.trainer.propose failed");
    res.status(500).json({ error: "Kon voorstel niet opslaan" });
  }
});

// GET /api/goals/trainer/:athleteId — doelinzage voor de voorstellende
// trainer (DOE-32/36/37): alleen zolang er een bestaand (niet verwijderd)
// trainerdoel van DEZE trainer is. Verwijderde doelen verdwijnen uit de
// trainerweergave (DOE-47).
router.get("/trainer/:athleteId", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasDirectCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen koppeling met deze sporter" });
      return;
    }
    // Draagt een bestaand trainerdoel van déze trainer de inzage?
    const [carrier] = await db
      .select({ id: athleteGoalsTable.id })
      .from(athleteGoalsTable)
      .where(
        and(
          eq(athleteGoalsTable.clerkId, athleteId),
          eq(athleteGoalsTable.origin, "trainervoorstel"),
          eq(athleteGoalsTable.trainerClerkId, coachId),
          ne(athleteGoalsTable.status, "dropped"),
        ),
      )
      .limit(1);
    if (!carrier) {
      // Geen bestaand trainerdoel = geen doelinzage (DOE-37). Eerlijke uitleg.
      res.status(403).json({
        error:
          "Je ziet doelen van deze sporter zolang er een geaccepteerd doelvoorstel van jou bestaat",
      });
      return;
    }
    const goals = await db
      .select()
      .from(athleteGoalsTable)
      .where(
        and(
          eq(athleteGoalsTable.clerkId, athleteId),
          ne(athleteGoalsTable.status, "dropped"),
        ),
      )
      .orderBy(asc(athleteGoalsTable.priority), desc(athleteGoalsTable.updatedAt));
    res.json({ goals });
  } catch (err) {
    req.log.error({ err }, "goals.trainer.view failed");
    res.status(500).json({ error: "Kon doelen niet laden" });
  }
});

/* ── DOELEN_01: ouderinzage (DOE-38/39/50) — alléén meekijken tot O-2 ───── */

// GET /api/goals/parent/:childId — de ouder ziet het doel van het kind en de
// wijzigingen daarin. Geen bezwaar- of intrekmechanisme vóór besluit O-2.
router.get("/parent/:childId", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  const childId = String(req.params.childId);
  try {
    if (!(await hasAcceptedParentLink(parentId, childId))) {
      res.status(403).json({ error: "Geen ouderkoppeling met deze sporter" });
      return;
    }
    if (!(await isMinorAthlete(childId))) {
      res.status(403).json({ error: "Doelinzage geldt alleen bij een minderjarige sporter" });
      return;
    }
    const goals = await db
      .select()
      .from(athleteGoalsTable)
      .where(
        and(
          eq(athleteGoalsTable.clerkId, childId),
          ne(athleteGoalsTable.status, "dropped"),
        ),
      )
      .orderBy(asc(athleteGoalsTable.priority), desc(athleteGoalsTable.updatedAt));
    const goalIds = goals.map((g) => g.id);
    const events = goalIds.length
      ? await db
          .select()
          .from(goalEventsTable)
          .where(inArray(goalEventsTable.goalId, goalIds))
          .orderBy(desc(goalEventsTable.createdAt))
          .limit(50)
      : [];
    res.json({ goals, events, readOnly: true });
  } catch (err) {
    req.log.error({ err }, "goals.parent.view failed");
    res.status(500).json({ error: "Kon doelen niet laden" });
  }
});

/* ── DOELEN_01 F3: vrije invoer → meetbaar doel (DOE-18 t/m DOE-23) ─────── */

// POST /api/goals/translate — vertaalstap via de centrale AI-gateway.
// Serverzijdige doorvraaglimiet van twee; daarna altijd een voorstel.
router.post("/translate", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const input = strOrNull(body.input);
  if (!input) {
    res.status(400).json({ error: "Vertel eerst wat je wilt bereiken" });
    return;
  }
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (h): h is { question: string; answer: string } =>
            h != null &&
            typeof (h as Record<string, unknown>).question === "string" &&
            typeof (h as Record<string, unknown>).answer === "string",
        )
        .slice(0, 2)
    : [];
  try {
    const band = await goalAgeBandFor(clerkId);
    if (bandConfig(band).form === "slider") {
      // Onder 14 bestaat vrije-invoervertaling niet: schuifbalken per thema.
      res.status(400).json({
        error: "In jouw leeftijd stel je doelen in met schuifbalken per thema",
      });
      return;
    }
    const result = await translateGoalInput(clerkId, band, input, history);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "goals.translate failed");
    res.status(500).json({ error: "Kon je doel nu niet vertalen" });
  }
});

export default router;
