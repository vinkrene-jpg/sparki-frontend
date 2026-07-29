import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, racesTable, athleteProfilesTable, routesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { requireCommercialFeature } from "../lib/entitlements";
import { registerRouteUsage } from "../lib/route-usage";
import { autoAdaptPlan } from "../engines/training-plan";
import {
  buildCourseAnalysis,
  buildRaceAdvice,
  buildRaceContext,
  buildRaceDossier,
  buildRaceEvaluation,
  buildRaceIntelEnriched,
  deriveRaceTypeValue,
  persistRaceEvaluation,
} from "../engines/race";
import { buildRaceInsight } from "../lib/race-insight";
import {
  getActiveKnowledge,
  buildSourceCitations,
  recordKnowledgeUsage,
} from "../lib/knowledge/governance";
import { removeWorldRefsForSource } from "./world-social";
import type { RaceResult } from "@workspace/db";

const router = Router();

// Adding/moving/removing a race shifts the training phase and any in-horizon
// race days, so re-run the autonomous provisional adaptation. Best-effort and
// non-blocking: the helper never throws and we only log reported failures.
function triggerPlanRefresh(
  req: import("express").Request,
  clerkId: string,
): void {
  void autoAdaptPlan(clerkId).then((r) => {
    if (r.error)
      req.log.error({ err: r.error }, "auto plan adaptation failed");
  });
}

const PRIORITIES = ["A", "B", "C"] as const;

// Fields the athlete (or, later, an integration adapter) may write. Structured
// sub-objects (logistics / checklist / teamRiders) are stored as jsonb and kept
// integration-ready — the typed provider layer on the client maps them.
type RaceBody = {
  name?: string;
  raceDate?: string;
  startTime?: string | null;
  location?: string | null;
  priority?: string;
  discipline?: string | null;
  notes?: string | null;
  plannedWorkoutId?: number | null;
  travelDate?: string | null;
  raceType?: string | null;
  result?: RaceResult | null;
  course?: string | null;
  distanceKm?: string | null;
  elevationM?: number | null;
  technicalSections?: string | null;
  weatherNote?: string | null;
  teamName?: string | null;
  teamInfo?: string | null;
  coachInstructions?: string | null;
  logistics?: unknown;
  checklist?: unknown;
  teamRiders?: unknown;
  // Golf 16 — één wedstrijdflow.
  routeId?: number | null;
  category?: string | null;
  registrationStatus?: string | null;
  goal?: string | null;
  status?: string;
  // Wedstrijd Intelligence — lokale ronden + persoonlijke opdracht.
  localLaps?: number | null;
  assignment?: string | null;
};

const RACE_STATUSES = ["gepland", "geannuleerd"] as const;
const REGISTRATION_STATUSES = [
  "niet_ingeschreven",
  "ingeschreven",
  "bevestigd",
] as const;

function normalizeStatus(s: string | undefined): string | undefined {
  if (s == null) return undefined;
  return RACE_STATUSES.includes(s as (typeof RACE_STATUSES)[number]) ? s : undefined;
}
function normalizeRegistration(s: string | null | undefined): string | null | undefined {
  if (s === undefined) return undefined;
  if (s === null) return null;
  return REGISTRATION_STATUSES.includes(s as (typeof REGISTRATION_STATUSES)[number])
    ? s
    : undefined;
}

// Verify a route id belongs to the athlete before linking it to a race.
// Returns the id when owned, null for an explicit unlink, undefined to skip.
async function checkRouteOwnership(
  clerkId: string,
  routeId: number | null | undefined,
): Promise<number | null | undefined> {
  if (routeId === undefined) return undefined;
  if (routeId === null) return null;
  const id = Number(routeId);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const [r] = await db
    .select({ id: routesTable.id })
    .from(routesTable)
    .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
    .limit(1);
  return r ? id : undefined;
}

// Lokale ronden: alleen een geheel getal 0–99; alles anders wordt null
// (= geen lokale ronden vastgelegd).
function normalizeLocalLaps(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

function normalizePriority(p: string | undefined): string | undefined {
  if (p == null) return undefined;
  const up = p.toUpperCase();
  return PRIORITIES.includes(up as (typeof PRIORITIES)[number]) ? up : undefined;
}

// ── GET /api/races ───────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const races = await db
      .select()
      .from(racesTable)
      .where(eq(racesTable.clerkId, clerkId))
      .orderBy(asc(racesTable.raceDate));
    res.json(races);
  } catch (err) {
    req.log.error({ err }, "races GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/insight ───────────────────────────────────────────────────
// The "intelligent werkblad" behind the race worksheet: everything Sparki can
// derive for a (prospective or saved) race before the athlete types anything —
// race-day weather, home→venue distance, a discipline logistics proposal, and
// the home departure suggestion. Honest about every gap (never fabricated).
// Registered before "/:id/intel" so the literal path is matched first.
router.get("/insight", requireAuth, requireCommercialFeature("race_intel"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const location = req.query["location"] ? String(req.query["location"]) : null;
  const raceDate = req.query["raceDate"] ? String(req.query["raceDate"]) : "";
  const discipline = req.query["discipline"]
    ? String(req.query["discipline"])
    : null;
  if (!raceDate) {
    res.status(400).json({ error: "raceDate is required" });
    return;
  }
  try {
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    res.json(await buildRaceInsight({ location, raceDate, discipline }, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race insight GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/wizard-proposal ──────────────────────────────────────────
// Stap 4 van de wizard: deterministische prioriteit/doel/voorbereiding-voorstel.
// Gebaseerd op echte athletedata — nooit verzonnen. Elk voorstel draagt een
// confidence-getal en een leesbare basis, zodat de atleet kan beoordelen of het
// voorstel past. De atleet beslist altijd: accepteren / wijzigen / overslaan.
router.get("/wizard-proposal", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceDate = req.query["raceDate"] ? String(req.query["raceDate"]) : "";
  const discipline = req.query["discipline"]
    ? String(req.query["discipline"])
    : null;
  const distanceKmRaw = req.query["distanceKm"]
    ? Number(req.query["distanceKm"])
    : null;
  const distanceKm =
    distanceKmRaw != null && Number.isFinite(distanceKmRaw)
      ? distanceKmRaw
      : null;

  if (!raceDate) {
    res.status(400).json({ error: "raceDate is required" });
    return;
  }

  try {
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    // Bestaande A-wedstrijden dit seizoen tellen (echt, niet verzonnen).
    const year = raceDate.slice(0, 4);
    const existingRaces = await db
      .select({ priority: racesTable.priority, raceDate: racesTable.raceDate })
      .from(racesTable)
      .where(eq(racesTable.clerkId, clerkId));
    const aRacesThisSeason = existingRaces.filter(
      (r) => r.priority === "A" && r.raceDate.startsWith(year),
    ).length;

    // Dagen tot wedstrijd.
    const today = new Date();
    const raceDay = new Date(raceDate);
    const daysUntil = Math.max(
      0,
      Math.round(
        (raceDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const exp = athlete?.experienceLevel ?? null;
    const disc = (discipline ?? "").toLowerCase();
    const isTT = /tijdrit|time.?trial|tt\b|chrono/.test(disc);
    const isCrit = /crit|kermis|baan|track/.test(disc);

    // ── Prioriteit ───────────────────────────────────────────────────────────
    let priorityValue: "A" | "B" | "C";
    let priorityRationale: string;
    let priorityConfidence: number;

    if (isTT) {
      priorityValue = "B";
      priorityRationale =
        "Tijdritten zijn doorgaans ondersteuning voor je seizoensdoelen, geen prioriteitspiek — tenzij jij ze als hoofddoel ziet.";
      priorityConfidence = 0.55;
    } else if (aRacesThisSeason === 0 && distanceKm != null && distanceKm >= 100) {
      priorityValue = "A";
      priorityRationale = `Lange koers (${distanceKm} km) en nog geen A-doelen dit seizoen — dit kan je piekwedstrijd zijn.`;
      priorityConfidence = 0.68;
    } else if (aRacesThisSeason >= 2) {
      priorityValue = "C";
      priorityRationale = `Je hebt al ${aRacesThisSeason} A-wedstrijden dit seizoen gepland. Te veel topprioriteiten verzwakt je piek — overweeg C tenzij dit echt een kernwedstrijd is.`;
      priorityConfidence = 0.62;
    } else if (!isCrit && distanceKm != null && distanceKm >= 60) {
      priorityValue = "B";
      priorityRationale =
        "Substantiële afstand — een goede B-wedstrijd om te testen en scherp te rijden zonder volledige taper.";
      priorityConfidence = 0.58;
    } else {
      priorityValue = "C";
      priorityRationale =
        "Korte of lokale wedstrijd — scherp rijden en ervaring opdoen, zonder bijzondere piektaper.";
      priorityConfidence = 0.55;
    }

    // ── Doel ─────────────────────────────────────────────────────────────────
    type GoalProposal = { text: string; rationale: string } | null;
    let goal: GoalProposal = null;

    if (exp === "beginner") {
      goal = {
        text: "Finishen en de wedstrijdbeleving opdoen.",
        rationale:
          "Als beginner is afmaken en de belevenis kennen waardevoller dan plaatsing nastreven.",
      };
    } else if (isTT && athlete?.ftp != null) {
      goal = {
        text: `Persoonlijk record verbeteren: rijd de eerste helft iets onder ${Math.round(athlete.ftp * 0.95)} W en bouw de tweede helft op.`,
        rationale: `FTP ${athlete.ftp} W als basis; tijdrit-tactiek is licht negatief split.`,
      };
    } else if (isTT) {
      goal = {
        text: "Persoonlijk record verbeteren — rijd even en bouw in de tweede helft op.",
        rationale: "Tijdrit-tactiek: licht negatief split presteert het best.",
      };
    } else if (exp === "intermediate" && distanceKm != null && distanceKm > 80) {
      goal = {
        text: "De hele koers in de voorste groep meerijden en de finale actief beleven.",
        rationale:
          "Op dit niveau en deze afstand is positie bewaken en de finale meemaken een realistisch én uitdagend doel.",
      };
    } else if (exp === "advanced" || exp === "elite") {
      goal = {
        text: "Actief koersen, waaiers en versnellingen opvolgen en in de eindspurt meedoen.",
        rationale:
          "Met je niveau kun je de koers actief beïnvloeden — passief wachten leidt zelden tot het beste resultaat.",
      };
    } else if (exp === "intermediate") {
      goal = {
        text: "Zo lang mogelijk vooraan meerijden en de koersstijl van gevorderde rijders observeren.",
        rationale: "Technische leerschool boven pure plaatsing stellen is op dit niveau het snelst groeiende doel.",
      };
    }
    // exp === null → geen voorstel; eerlijk "onvoldoende data". Zonder bekend
    // ervaringsniveau is ook het prioriteitsvoorstel minder zeker: verlaag de
    // confidence en benoem het gat expliciet in de basis-verantwoording.
    if (!exp) {
      priorityConfidence = Math.max(0, priorityConfidence - 0.1);
    }

    // ── Voorbereiding ─────────────────────────────────────────────────────────
    let prepText: string;
    let prepRationale: string;

    if (daysUntil <= 3) {
      prepText =
        "Laatste 3 dagen: maximaal herstel. Geen zware sessies — hooguit één korte scherpte-prikkel (10–15 min). Slaap, eet koolhydraatrijk, bevestig logistiek.";
      prepRationale = `Nog ${daysUntil} dag${daysUntil === 1 ? "" : "en"} — nu is rust de enige winst.`;
    } else if (daysUntil <= 7) {
      prepText =
        "Race-week: verlaag het volume fors (−40 %), doe 1–2 korte scherpte-inspanningen en slaap de laatste 3 nachten goed. Logistiek vastzetten.";
      prepRationale = `${daysUntil} dagen — de conditie staat, nu is herstel de enige variabele.`;
    } else if (daysUntil <= 14) {
      prepText =
        "Twee weken voor de wedstrijd: sluit de zware blokken af, doe één scherpte-training en herstel daarna volledig. Nieuwe conditie bouw je niet meer op.";
      prepRationale = "In deze fase maak je af wat al opgebouwd is.";
    } else if (daysUntil <= 28) {
      prepText =
        "Drie tot vier weken voor de wedstrijd: werk aan discipline-specifieke intensiteit. Plan een rustige inloopweek direct voor de koers.";
      prepRationale =
        "Dit is het laatste echte trainingsblok — gerichte scherpte en daarna inlopen.";
    } else {
      prepText =
        "Nog ruim de tijd — bouw stap voor stap op. Zorg dat basisconditie en intensiteit allebei groeien, zodat je op tijd piekt. Taper de laatste week.";
      prepRationale = `${daysUntil} dagen — genoeg tijd voor een gestructureerde opbouw naar de koers.`;
    }

    // ── Basis-verantwoording ──────────────────────────────────────────────────
    const basisParts: string[] = [];
    if (exp) basisParts.push(`ervaring: ${exp}`);
    else basisParts.push("ervaring onbekend");
    if (discipline) basisParts.push(`discipline: ${discipline}`);
    if (distanceKm) basisParts.push(`afstand: ${distanceKm} km`);
    basisParts.push(`${aRacesThisSeason} A-doelen dit seizoen`);
    basisParts.push(`${daysUntil} dag${daysUntil === 1 ? "" : "en"} tot de koers`);

    res.json({
      priority: {
        value: priorityValue,
        rationale: priorityRationale,
        confidence: priorityConfidence,
      },
      goal,
      preparation: { text: prepText, rationale: prepRationale },
      basis: `Gebaseerd op: ${basisParts.join(", ")}.`,
    });
  } catch (err) {
    req.log.error({ err }, "race wizard-proposal GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/intel ─────────────────────────────────────────────────
// Race Intelligence: phased prep timeline, auto race-day report (honest about
// unknowns), race-fuel advice with budget alternatives, multi-day checklists.
// Computed on demand from the athlete's own race + profile — no stored snapshot.
router.get("/:id/intel", requireAuth, requireCommercialFeature("race_intel"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }

  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));

    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    res.json(await buildRaceIntelEnriched(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race intel GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/context ───────────────────────────────────────────────
// The central race-context object: every field Sparki could find/derive for this
// race, each tagged found/derived/missing with herkomst, plus honest gaps and
// per-domain guidance. Source-agnostic — surfaces render it generically.
router.get("/:id/context", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    res.json(await buildRaceContext(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race context GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/evaluation ────────────────────────────────────────────
// Post-race evaluation: honest comparison of the real outcome (result or matched
// activity) against Sparki's expectation. Read-only — a future race is reported
// as not-yet-evaluable; persistence to memory happens when a result is saved.
router.get("/:id/evaluation", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    res.json(await buildRaceEvaluation(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race evaluation GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/course ────────────────────────────────────────────────
// Parcoursanalyse uit de gekoppelde route (klimmen, ondergrond, profiel) plus de
// wedstrijdvelden — elk feit draagt zijn soort (feit/afgeleid/inschatting/
// ontbreekt). Geen route en geen gidsdata ⇒ eerlijke gaten, nooit verzonnen.
router.get("/:id/course", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    res.json(await buildCourseAnalysis(race));
  } catch (err) {
    req.log.error({ err }, "race course GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/advice ────────────────────────────────────────────────
// Deterministische adviezen (pacing, bandendruk, warming-up, tactiek, risico's)
// met typologie; een coachinstructie staat altijd bovenaan en is leidend.
router.get("/:id/advice", requireAuth, requireCommercialFeature("race_intel"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    // Golf 21 — beheerde vakkennis (domein wedstrijd) gaat MEE de adviesset in
    // (als letterlijke "feit"-items) én terug als compacte bronvermeldingen.
    const managedItems = await getActiveKnowledge({
      domain: "wedstrijd",
      discipline: race.discipline ?? null,
      limit: 4,
    });
    const advies = await buildRaceAdvice(race, athlete ?? null, managedItems);
    res.json({ ...advies, bronnen: buildSourceCitations(managedItems) });
    void recordKnowledgeUsage(managedItems, "race", clerkId, `race:${id}`).catch(
      (err) => req.log.error({ err }, "race advice knowledge usage failed"),
    );
  } catch (err) {
    req.log.error({ err }, "race advice GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/dossier ───────────────────────────────────────────────
// Het volledige wedstrijddossier voor de hele flow (info → parcours →
// voorbereiding → racedag → gekoppelde activiteit → evaluatie), op leesmoment
// samengesteld uit de bestaande engines — geen tweede bron van waarheid.
router.get("/:id/dossier", requireAuth, requireCommercialFeature("race_intel"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    res.json(await buildRaceDossier(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race dossier GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/races ──────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as RaceBody;

  if (!body.name || !body.raceDate) {
    res.status(400).json({ error: "name and raceDate are required" });
    return;
  }

  try {
    const ownedRouteId = await checkRouteOwnership(clerkId, body.routeId);
    const [race] = await db
      .insert(racesTable)
      .values({
        clerkId,
        name: body.name,
        raceDate: body.raceDate,
        startTime: body.startTime ?? null,
        location: body.location ?? null,
        priority: normalizePriority(body.priority) ?? "B",
        discipline: body.discipline ?? null,
        notes: body.notes ?? null,
        plannedWorkoutId: body.plannedWorkoutId ?? null,
        travelDate: body.travelDate ?? null,
        // Auto-derive the race type on create when the athlete didn't supply one
        // (from discipline, else name). Stays null when nothing matches — never guessed.
        raceType:
          body.raceType ??
          deriveRaceTypeValue({ discipline: body.discipline ?? null, name: body.name }) ??
          null,
        result: body.result ?? null,
        course: body.course ?? null,
        distanceKm: body.distanceKm ?? null,
        elevationM: body.elevationM ?? null,
        technicalSections: body.technicalSections ?? null,
        weatherNote: body.weatherNote ?? null,
        teamName: body.teamName ?? null,
        teamInfo: body.teamInfo ?? null,
        coachInstructions: body.coachInstructions ?? null,
        logistics: body.logistics ?? null,
        checklist: body.checklist ?? null,
        teamRiders: body.teamRiders ?? null,
        // Golf 16 — route alleen gekoppeld als hij van deze renner is.
        routeId: ownedRouteId ?? null,
        category: body.category ?? null,
        registrationStatus: normalizeRegistration(body.registrationStatus) ?? null,
        goal: body.goal ?? null,
        localLaps: normalizeLocalLaps(body.localLaps) ?? null,
        assignment: typeof body.assignment === "string" && body.assignment.trim()
          ? body.assignment.trim().slice(0, 2000)
          : null,
        status: normalizeStatus(body.status) ?? "gepland",
      })
      .returning();
    // Golf 19 — leg vast WELKE routeversie aan deze wedstrijd is gekoppeld.
    if (race && race.routeId != null) {
      const [route] = await db
        .select({
          id: routesTable.id,
          name: routesTable.name,
          version: routesTable.version,
        })
        .from(routesTable)
        .where(eq(routesTable.id, race.routeId))
        .limit(1);
      if (route) {
        await registerRouteUsage(route, "wedstrijd", race.id, clerkId).catch(
          (err) => req.log.error({ err }, "race route usage failed"),
        );
      }
    }
    triggerPlanRefresh(req, clerkId);
    res.status(201).json(race);
  } catch (err) {
    req.log.error({ err }, "races POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/races/:id ───────────────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  const body = req.body as RaceBody;
  const priority = normalizePriority(body.priority);

  try {
    // Load the existing race (ownership-checked) first so we can auto-enrich the
    // race type on edit when the athlete changes the name/discipline.
    const [existing] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));
    if (!existing) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    // Auto-derive raceType on edit: only when no explicit raceType is sent, the
    // name or discipline is changing, and the race has no type yet. Never clobber
    // an athlete's explicit choice and stay null when nothing matches — no guessing.
    let autoRaceType: string | undefined;
    if (
      body.raceType === undefined &&
      (body.name !== undefined || body.discipline !== undefined) &&
      !(existing.raceType && existing.raceType.trim())
    ) {
      const derived = deriveRaceTypeValue({
        discipline: body.discipline !== undefined ? body.discipline : existing.discipline,
        name: body.name !== undefined ? body.name : existing.name,
      });
      if (derived) autoRaceType = derived;
    }

    const ownedRouteId = await checkRouteOwnership(clerkId, body.routeId);
    const registration = normalizeRegistration(body.registrationStatus);
    const status = normalizeStatus(body.status);

    const [updated] = await db
      .update(racesTable)
      .set({
        ...(body.name != null && { name: body.name }),
        ...(body.raceDate != null && { raceDate: body.raceDate }),
        ...(body.startTime !== undefined && { startTime: body.startTime }),
        ...(body.location !== undefined && { location: body.location }),
        ...(priority != null && { priority }),
        ...(body.discipline !== undefined && { discipline: body.discipline }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.plannedWorkoutId !== undefined && {
          plannedWorkoutId: body.plannedWorkoutId,
        }),
        ...(body.travelDate !== undefined && { travelDate: body.travelDate }),
        ...(body.raceType !== undefined && { raceType: body.raceType }),
        ...(autoRaceType !== undefined && { raceType: autoRaceType }),
        ...(body.result !== undefined && { result: body.result }),
        ...(body.course !== undefined && { course: body.course }),
        ...(body.distanceKm !== undefined && { distanceKm: body.distanceKm }),
        ...(body.elevationM !== undefined && { elevationM: body.elevationM }),
        ...(body.technicalSections !== undefined && {
          technicalSections: body.technicalSections,
        }),
        ...(body.weatherNote !== undefined && { weatherNote: body.weatherNote }),
        ...(body.teamName !== undefined && { teamName: body.teamName }),
        ...(body.teamInfo !== undefined && { teamInfo: body.teamInfo }),
        ...(body.coachInstructions !== undefined && {
          coachInstructions: body.coachInstructions,
        }),
        ...(body.logistics !== undefined && { logistics: body.logistics }),
        ...(body.checklist !== undefined && { checklist: body.checklist }),
        ...(body.teamRiders !== undefined && { teamRiders: body.teamRiders }),
        // Golf 16 — route alleen (ont)koppelen als hij van deze renner is.
        ...(ownedRouteId !== undefined && { routeId: ownedRouteId }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.localLaps !== undefined && {
          localLaps: normalizeLocalLaps(body.localLaps),
        }),
        ...(body.assignment !== undefined && {
          assignment:
            typeof body.assignment === "string" && body.assignment.trim()
              ? body.assignment.trim().slice(0, 2000)
              : null,
        }),
        ...(registration !== undefined && { registrationStatus: registration }),
        ...(body.goal !== undefined && { goal: body.goal }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    // Golf 19 — nieuw gekoppelde route: versiegebruik vastleggen (idempotent).
    if (
      updated.routeId != null &&
      updated.routeId !== existing.routeId
    ) {
      const [route] = await db
        .select({
          id: routesTable.id,
          name: routesTable.name,
          version: routesTable.version,
        })
        .from(routesTable)
        .where(eq(routesTable.id, updated.routeId))
        .limit(1);
      if (route) {
        await registerRouteUsage(route, "wedstrijd", updated.id, clerkId).catch(
          (err) => req.log.error({ err }, "race route usage failed"),
        );
      }
    }
    triggerPlanRefresh(req, clerkId);
    // When a result is saved for a race that has already happened, run the
    // post-race evaluation and persist its conclusion to memory (privacy-gated +
    // deduped). Best-effort and non-blocking — never delays or fails the response.
    if (body.result !== undefined && updated.result) {
      void persistRaceEvaluation(updated, null).catch((err) =>
        req.log.error({ err }, "race evaluation persist failed"),
      );
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "races PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/races/:id/checklist ─────────────────────────────────────────────
// Dedicated endpoint so the Day-Before checklist can persist its checked state
// per race without sending the whole race object on every toggle.
router.put("/:id/checklist", requireAuth, requireCommercialFeature("race_intel"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  const { checklist } = req.body as { checklist?: Record<string, boolean> };
  if (checklist == null || typeof checklist !== "object") {
    res.status(400).json({ error: "checklist object is required" });
    return;
  }

  try {
    const [updated] = await db
      .update(racesTable)
      .set({ checklist, updatedAt: new Date() })
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "races checklist PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/races/:id ────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    triggerPlanRefresh(req, clerkId);
    // Sparki World: gedeelde referenties naar deze wedstrijd opruimen.
    await removeWorldRefsForSource(clerkId, "race", id);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "races DELETE failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
