// Persoonlijke routekandidaten uit gekoppelde ritgeschiedenis.
//
// Leest de kandidaat-tabellen die de incrementele scan vult (lib/
// route-candidates.ts). Belangrijk:
// - GEEN zware analyse bij paginalaad: GET-endpoints lezen alleen.
// - Opslaan als echte route gaat door de ACTUELE fail-closed
//   blokkadeverificatie — een oude of vaak gereden route is nooit
//   automatisch veilig.
// - Labels: gebruikerscorrectie (userLabels) wint altijd van autoLabels.
// - Uitsluiten is omkeerbaar en verwijdert nooit historie.

import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  routeCandidatesTable,
  routeCandidateRidesTable,
  routeCandidateScansTable,
  routesTable,
  type RoutePathPoint,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { routeObstaclesOf } from "../lib/route-remarks";
import { scanRouteCandidatesForUser } from "../lib/ridden-route-candidates";
import { recordRouteUsageSafe } from "../lib/route-usage-metering";
// ROUTE_PAKKET_02b/02c — Gratis-limieten gelden ook voor het bewaren van een
// route uit de eigen ritgeschiedenis.
import { checkOpslag } from "../lib/route-limits";

const router: IRouter = Router();

function candidateView(c: typeof routeCandidatesTable.$inferSelect) {
  return {
    id: c.id,
    labels:
      Array.isArray(c.userLabels) && c.userLabels.length > 0
        ? c.userLabels
        : c.autoLabels,
    autoLabels: c.autoLabels,
    userLabels: c.userLabels,
    distanceKm: c.distanceKm,
    elevationM: c.elevationM,
    sport: c.sport,
    isLoop: c.isLoop,
    rideCount: c.rideCount,
    firstRiddenAt: c.firstRiddenAt,
    lastRiddenAt: c.lastRiddenAt,
    favorite: c.favorite,
    excluded: c.excluded,
    quality: c.quality,
    trimmedStartM: c.trimmedStartM,
    trimmedEndM: c.trimmedEndM,
    savedRouteId: c.savedRouteId,
    geometry: c.geometry as RoutePathPoint[],
    // Vaste eerlijkheid: de score is een gebruiks-/datakwaliteitsmaat,
    // NOOIT een veiligheidsoordeel. Verificatie gebeurt bij opslaan/starten.
    veiligheidsnoot:
      "Deze score zegt niets over actuele veiligheid; bij opslaan of starten wordt de route opnieuw gecontroleerd.",
  };
}

// GET /api/route-candidates — kandidatenlijst + onboarding-samenvatting.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const includeExcluded = req.query.includeExcluded === "1";
    const rows = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, clerkId))
      .orderBy(
        desc(routeCandidatesTable.rideCount),
        desc(routeCandidatesTable.lastRiddenAt),
      );
    const [scan] = await db
      .select()
      .from(routeCandidateScansTable)
      .where(eq(routeCandidateScansTable.clerkId, clerkId))
      .limit(1);
    const visible = rows.filter((r) => includeExcluded || !r.excluded);
    res.json({
      candidates: visible.map(candidateView),
      excludedCount: rows.filter((r) => r.excluded).length,
      scan: scan
        ? {
            activitiesSeen: scan.activitiesSeen,
            activitiesWithTrack: scan.activitiesWithTrack,
            candidatesFound: rows.length,
            lastScanAt: scan.lastScanAt,
            onboardingSeenAt: scan.onboardingSeenAt,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "routeCandidates.list failed");
    res.status(500).json({ error: "Kon routekandidaten niet laden" });
  }
});

// POST /api/route-candidates/scan — expliciete (incrementele) scan, bv. na een
// eerste volledige sync. Nooit automatisch bij paginalaad aangeroepen.
router.post("/scan", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await scanRouteCandidatesForUser(clerkId);
    res.json({ scan: result });
  } catch (err) {
    req.log.error({ err }, "routeCandidates.scan failed");
    res.status(500).json({ error: "Scan mislukt" });
  }
});

// POST /api/route-candidates/onboarding-seen — samenvatting gezien/weggeklikt.
router.post("/onboarding-seen", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    await db
      .update(routeCandidateScansTable)
      .set({ onboardingSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(routeCandidateScansTable.clerkId, clerkId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "routeCandidates.onboardingSeen failed");
    res.status(500).json({ error: "Kon niet opslaan" });
  }
});

// PATCH /api/route-candidates/:id — labels corrigeren, favoriet, uitsluiten.
router.patch("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Partial<typeof routeCandidatesTable.$inferInsert> = {};
  if (Array.isArray(body.userLabels)) {
    const labels = body.userLabels
      .filter((l): l is string => typeof l === "string")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length <= 60)
      .slice(0, 8);
    patch.userLabels = labels.length > 0 ? labels : null;
  }
  if (typeof body.favorite === "boolean") patch.favorite = body.favorite;
  if (typeof body.excluded === "boolean") patch.excluded = body.excluded;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Niets om te wijzigen" });
    return;
  }
  try {
    const [row] = await db
      .update(routeCandidatesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(routeCandidatesTable.id, id),
          eq(routeCandidatesTable.clerkId, clerkId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Kandidaat niet gevonden" });
      return;
    }
    res.json({ candidate: candidateView(row) });
  } catch (err) {
    req.log.error({ err }, "routeCandidates.patch failed");
    res.status(500).json({ error: "Kon kandidaat niet bijwerken" });
  }
});

// GET /api/route-candidates/:id/rides — herkomst: welke ritten droegen bij.
router.get("/:id/rides", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const rides = await db
      .select()
      .from(routeCandidateRidesTable)
      .where(
        and(
          eq(routeCandidateRidesTable.clerkId, clerkId),
          eq(routeCandidateRidesTable.candidateId, id),
        ),
      )
      .orderBy(desc(routeCandidateRidesTable.riddenAt));
    res.json({
      rides: rides.map((r) => ({
        sessionId: r.sessionId,
        riddenAt: r.riddenAt,
        overlap: r.overlap,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "routeCandidates.rides failed");
    res.status(500).json({ error: "Kon herkomst niet laden" });
  }
});

// POST /api/route-candidates/:id/save — bewaar als echte route in de
// bibliotheek. ALTIJD door de actuele fail-closed blokkadeverificatie:
// geen geslaagde meting = geweigerd (nooit een ongecontroleerde route),
// harde blokkade = geweigerd. Zelfde poort als de routemaker (taak #505).
router.post("/:id/save", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const [cand] = await db
      .select()
      .from(routeCandidatesTable)
      .where(
        and(
          eq(routeCandidatesTable.id, id),
          eq(routeCandidatesTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!cand) {
      res.status(404).json({ error: "Kandidaat niet gevonden" });
      return;
    }
    if (cand.excluded) {
      res.status(422).json({ error: "Deze kandidaat is door jou uitgesloten" });
      return;
    }
    const geometry = cand.geometry as RoutePathPoint[];
    if (!Array.isArray(geometry) || geometry.length < 2) {
      res.status(422).json({ error: "Kandidaat heeft geen bruikbaar spoor" });
      return;
    }

    // Actuele fail-closed verificatie — een eerder gereden route omzeilt de
    // veiligheidscontrole nooit.
    const obs = await routeObstaclesOf()(geometry);
    if (obs == null) {
      res.status(422).json({
        error:
          "De route kon niet gecontroleerd worden op blokkades (de kaartbron gaf geen antwoord). We bewaren een ongecontroleerde route niet — probeer het over een paar minuten opnieuw.",
        code: "ROUTE_UNVERIFIABLE",
      });
      return;
    }
    if (obs.forbidden > 0 || obs.steps > 0 || obs.blockedGates > 0) {
      res.status(422).json({
        error:
          "Deze route loopt over een harde blokkade (fietsverbod, trap of afgesloten poort/privéterrein) en kan daarom niet als route worden bewaard — ook al is hij eerder gereden.",
        code: "NO_SUITABLE_ROUTE",
        blockage: obs,
      });
      return;
    }

    const name =
      typeof (req.body as Record<string, unknown> | null)?.name === "string" &&
      String((req.body as Record<string, unknown>).name).trim()
        ? String((req.body as Record<string, unknown>).name).trim().slice(0, 120)
        : `Eigen route (${cand.rideCount}× gereden)`;

    // 02b/02c — limieten vóór het definitief bewaren.
    const besluit = await checkOpslag(clerkId, {});
    if (!besluit.allowed) {
      res.status(besluit.status).json(besluit);
      return;
    }

    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name,
        savedUntil: besluit.savedUntil,
        surface: cand.sport === "gravel" ? "gravel" : cand.sport === "mtb" ? "mtb" : "unknown",
        visibility: "private",
        status: "ready",
        distanceKm: cand.distanceKm,
        elevationGainM: cand.elevationM,
        geometry,
        source: "ridden",
        nav: null,
        rationale: `Opgebouwd uit je eigen ritgeschiedenis (${cand.rideCount}× gereden). Blokkadecontrole uitgevoerd bij het bewaren.`,
      })
      .returning();

    await db
      .update(routeCandidatesTable)
      .set({ savedRouteId: route!.id, updatedAt: new Date() })
      .where(eq(routeCandidatesTable.id, cand.id));

    // ROUTE_PAKKET_02A — definitief opslaan telt als routegebruik (meten).
    await recordRouteUsageSafe(req.log, {
      clerkId,
      routeId: route!.id,
      usageType: "SAVED",
      source: "opslaan:ritkandidaat",
    });

    res.status(201).json({ route });
  } catch (err) {
    req.log.error({ err }, "routeCandidates.save failed");
    res.status(500).json({ error: "Kon route niet bewaren" });
  }
});

export default router;
