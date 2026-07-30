import { Router } from "express";
import { candidateEnvironmentOf } from "../lib/candidate-environment";
import { bgtUnpavedShare } from "../lib/bgt-verharding";
import { routeObstaclesOf } from "../lib/route-remarks";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  routesTable,
  routeProposalsTable,
  userProfilesTable,
  type RoutePathPoint,
  type RouteSurface,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { createNotification } from "../lib/notifications";
import { listFriends } from "../engines/social";
import {
  getRoutingProvider,
  generateVariedLoop,
  selectRoutingProfile,
  summarizeTrack,
  elevationPreferences,
  type ElevationPreference,
} from "../engines/route";

const router = Router();

// Routevoorstel naar een fietsmaatje.
//
// De eigenaar van een bewaarde route stelt die voor aan een geaccepteerde
// vriend. De ontvanger kan het voorstel accepteren (de route wordt naar de
// eigen bibliotheek gekopieerd), afwijzen, of aanpassen (er ontstaat een NIEUWE
// route van de ontvanger; het origineel blijft ongewijzigd). Alle statusnamen
// en meldingen zijn in het Nederlands.
//
// Deze router wordt onder /api/routes gemount vóór de hoofd-routesrouter, zodat
// de statische /voorstellen-paden niet door de /:id-parameterroutes worden
// opgevangen.

type RouteRow = typeof routesTable.$inferSelect;

function displayNameMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return Promise.resolve(new Map<string, string>());
  return db
    .select({
      clerkId: userProfilesTable.clerkId,
      displayName: userProfilesTable.displayName,
    })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, unique))
    .then((rows) => {
      const map = new Map<string, string>();
      for (const r of rows) map.set(r.clerkId, r.displayName ?? "Sporter");
      return map;
    });
}

function routeMeta(r: RouteRow | undefined) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    surface: r.surface,
    distanceKm: r.distanceKm,
    durationSec: r.durationSec,
    elevationGainM: r.elevationGainM,
  };
}

// POST /api/routes/:id/voorstel — stel je eigen route voor aan een fietsmaatje.
router.post("/:id/voorstel", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const toClerkId =
    typeof body.toClerkId === "string" && body.toClerkId.trim()
      ? body.toClerkId.trim()
      : null;
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : null;
  if (!toClerkId) {
    res.status(400).json({ error: "Kies een fietsmaatje om aan voor te stellen" });
    return;
  }
  if (toClerkId === clerkId) {
    res
      .status(400)
      .json({ error: "Je kunt een route niet aan jezelf voorstellen" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route || route.deletedAt) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    // Alleen een geaccepteerd fietsmaatje mag een voorstel ontvangen.
    const friends = await listFriends(clerkId);
    const isFriend = friends.some((f) => f.clerkId === toClerkId);
    if (!isFriend) {
      res.status(403).json({
        error: "Je kunt alleen routes voorstellen aan je fietsmaatjes",
      });
      return;
    }
    const [proposal] = await db
      .insert(routeProposalsTable)
      .values({
        routeId: id,
        fromClerkId: clerkId,
        toClerkId,
        status: "open",
        note,
      })
      .returning();

    const names = await displayNameMap([clerkId]);
    const senderName = names.get(clerkId) ?? "Een fietsmaatje";
    await createNotification({
      clerkId: toClerkId,
      type: "route_proposal",
      title: "Routevoorstel",
      body: `${senderName} stelt je de route "${route.name}" voor.`,
      actionUrl: "/routes?view=bewaard",
      source: "route-proposals",
      dedupeKey: `route-voorstel:${proposal.id}`,
    });

    res.status(201).json({ proposal });
  } catch (err) {
    req.log.error({ err }, "routeProposals.create failed");
    res.status(500).json({ error: "Kon het voorstel niet versturen" });
  }
});

// GET /api/routes/voorstellen — ontvangen én verstuurde voorstellen, met
// route-metadata en weergavenamen.
router.get("/voorstellen", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select()
      .from(routeProposalsTable)
      .where(
        sql`${routeProposalsTable.fromClerkId} = ${clerkId} OR ${routeProposalsTable.toClerkId} = ${clerkId}`,
      )
      .orderBy(desc(routeProposalsTable.createdAt));

    const routeIds = [
      ...new Set(
        rows.flatMap((r) =>
          [r.routeId, r.adjustedRouteId].filter(
            (v): v is number => typeof v === "number",
          ),
        ),
      ),
    ];
    const routeRows = routeIds.length
      ? await db
          .select()
          .from(routesTable)
          .where(inArray(routesTable.id, routeIds))
      : [];
    const routeById = new Map(routeRows.map((r) => [r.id, r]));
    const names = await displayNameMap(
      rows.flatMap((r) => [r.fromClerkId, r.toClerkId]),
    );

    const shape = (r: (typeof rows)[number]) => ({
      id: r.id,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
      fromClerkId: r.fromClerkId,
      toClerkId: r.toClerkId,
      fromName: names.get(r.fromClerkId) ?? "Sporter",
      toName: names.get(r.toClerkId) ?? "Sporter",
      route: routeMeta(routeById.get(r.routeId)),
      adjustedRoute:
        r.adjustedRouteId != null
          ? routeMeta(routeById.get(r.adjustedRouteId))
          : null,
    });

    res.json({
      ontvangen: rows.filter((r) => r.toClerkId === clerkId).map(shape),
      verstuurd: rows.filter((r) => r.fromClerkId === clerkId).map(shape),
    });
  } catch (err) {
    req.log.error({ err }, "routeProposals.list failed");
    res.status(500).json({ error: "Kon voorstellen niet laden" });
  }
});

// POST /api/routes/voorstellen/:id/reageer — accepteer of wijs af (ontvanger).
router.post("/voorstellen/:id/reageer", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const actie = body.actie === "accepteer" || body.actie === "wijs_af"
    ? body.actie
    : null;
  if (!actie) {
    res.status(400).json({ error: "Kies accepteren of afwijzen" });
    return;
  }
  try {
    const [proposal] = await db
      .select()
      .from(routeProposalsTable)
      .where(eq(routeProposalsTable.id, id))
      .limit(1);
    if (!proposal || proposal.toClerkId !== clerkId) {
      res.status(404).json({ error: "Voorstel niet gevonden" });
      return;
    }
    const newStatus = actie === "accepteer" ? "geaccepteerd" : "afgewezen";
    // Eén transactie: statuswissel én routekopie slagen of falen samen, zodat
    // een voorstel nooit "geaccepteerd" kan zijn zonder gekopieerde route.
    // Alleen een nog-open voorstel mag beantwoord worden.
    let copy: RouteRow | null = null;
    let alreadyAnswered = false;
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(routeProposalsTable)
        .set({ status: newStatus, respondedAt: new Date() })
        .where(
          and(
            eq(routeProposalsTable.id, id),
            eq(routeProposalsTable.status, "open"),
          ),
        )
        .returning();
      if (updated.length === 0) {
        alreadyAnswered = true;
        return;
      }
      if (actie === "accepteer") {
        const [route] = await tx
          .select()
          .from(routesTable)
          .where(eq(routesTable.id, proposal.routeId))
          .limit(1);
        if (route && !route.deletedAt) {
          // De afzender is eigenaar en heeft de route bewust voorgesteld:
          // kopieer volledig naar de bibliotheek van de ontvanger (privé).
          [copy] = await tx
            .insert(routesTable)
            .values({
              clerkId,
              name: route.name,
              source: route.source,
              surface: route.surface as RouteSurface,
              visibility: "prive",
              status: "ready",
              distanceKm: route.distanceKm,
              durationSec: route.durationSec,
              elevationGainM: route.elevationGainM,
              geometry: route.geometry,
              profile: route.profile as never,
              nav: route.nav as never,
              waypoints: route.waypoints as never,
              meetpoints: route.meetpoints as never,
            })
            .returning();
        }
      }
    });
    if (alreadyAnswered) {
      res.status(409).json({ error: "Dit voorstel is al beantwoord" });
      return;
    }

    const names = await displayNameMap([clerkId]);
    const responderName = names.get(clerkId) ?? "Je fietsmaatje";
    await createNotification({
      clerkId: proposal.fromClerkId,
      type: "route_proposal",
      title: "Reactie op je routevoorstel",
      body:
        actie === "accepteer"
          ? `${responderName} heeft je routevoorstel geaccepteerd.`
          : `${responderName} heeft je routevoorstel afgewezen.`,
      actionUrl: "/routes?view=bewaard",
      source: "route-proposals",
      dedupeKey: `route-voorstel-reactie:${proposal.id}:${newStatus}`,
    });

    res.json({ ok: true, status: newStatus, route: copy });
  } catch (err) {
    req.log.error({ err }, "routeProposals.respond failed");
    res.status(500).json({ error: "Kon niet op het voorstel reageren" });
  }
});

// POST /api/routes/voorstellen/:id/aanpassen — de ontvanger maakt een
// aangepaste versie. Dit is ALTIJD een nieuwe route van de ontvanger; het
// origineel blijft ongewijzigd bestaan.
router.post("/voorstellen/:id/aanpassen", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const targetDistanceKm =
    typeof body.targetDistanceKm === "number" &&
    Number.isFinite(body.targetDistanceKm) &&
    body.targetDistanceKm > 0
      ? Math.min(body.targetDistanceKm, 300)
      : null;
  const elevationPreference: ElevationPreference =
    typeof body.elevationPreference === "string" &&
    (elevationPreferences as readonly string[]).includes(
      body.elevationPreference,
    )
      ? (body.elevationPreference as ElevationPreference)
      : "any";
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : null;
  try {
    const [proposal] = await db
      .select()
      .from(routeProposalsTable)
      .where(eq(routeProposalsTable.id, id))
      .limit(1);
    if (!proposal || proposal.toClerkId !== clerkId) {
      res.status(404).json({ error: "Voorstel niet gevonden" });
      return;
    }
    if (proposal.status !== "open") {
      res.status(409).json({ error: "Dit voorstel is al beantwoord" });
      return;
    }
    const [route] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, proposal.routeId))
      .limit(1);
    if (!route || route.deletedAt) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }

    // Startpunt uit de originele geometrie: nodig om een aangepaste lus te
    // genereren. Zonder start kan er niets nieuws berekend worden.
    const geom = (route.geometry as RoutePathPoint[] | null) ?? null;
    const start =
      geom && geom.length > 0
        ? { lat: geom[0][0], lon: geom[0][1] }
        : null;

    let adjusted: RouteRow | null = null;
    const provider = getRoutingProvider();
    const wantsRegenerate = targetDistanceKm != null && start != null;

    if (wantsRegenerate && provider.isConfigured()) {
      // Echte, aangepaste lus via de bestaande generator — nooit verzonnen.
      const profile = selectRoutingProfile({
        sport: "cycling",
        targetDistanceKm: targetDistanceKm!,
        elevationPreference,
      });
      const result = await generateVariedLoop(
        provider,
        {
          start,
          distanceKm: targetDistanceKm!,
          profile,
          points: 3,
          elevationPreference,
        },
        {
          // Vaste eis: ook aangepaste voorstellen mijden dorpskernen,
          // woonwijken en stoplichten zoveel mogelijk (interactief pad:
          // kort tijdbudget, nooit wachten op trage bronnen).
          environmentOf: candidateEnvironmentOf(false, { budgetMs: 2000 }),
          // BGT-controlelaag (alleen Nederland): racefietskandidaten die
          // volgens de overheidswegenkaart onverhard blijken, verliezen.
          unpavedShareOf: bgtUnpavedShare,
          // Obstakel-poort (kort tijdbudget, interactief): trap/fietsverbod/
          // afgesloten poort = harde afkeur; minste poorten wint.
          obstaclesOf: routeObstaclesOf({ budgetMs: 2500 }),
        },
      );
      const summary = summarizeTrack(result.points);
      const distanceKm = summary.distanceKm ?? result.distanceKm;
      const elevationGainM = summary.elevationGainM ?? result.ascentM;
      [adjusted] = await db
        .insert(routesTable)
        .values({
          clerkId,
          name: `${route.name} (aangepast)`,
          source: "generated",
          surface: route.surface as RouteSurface,
          visibility: "prive",
          status: "ready",
          distanceKm,
          durationSec: result.durationSec,
          elevationGainM,
          geometry: result.path,
          profile: summary.profile as never,
          nav: result.steps as never,
          waypoints: [] as never,
        })
        .returning();
    } else if (wantsRegenerate && !provider.isConfigured()) {
      // Eerlijke grens: zonder routedienst kan er geen nieuwe route berekend
      // worden. We verzinnen niets.
      res.status(503).json({
        error:
          "Routeberekening is nu niet beschikbaar, dus een aangepaste versie kan niet gemaakt worden. Probeer het later opnieuw.",
      });
      return;
    } else {
      // Geen nieuwe afstand gevraagd: maak een aanpasbaar duplicaat van het
      // origineel in de bibliotheek van de ontvanger. Het origineel blijft
      // ongewijzigd; dit is een nieuwe route-rij.
      [adjusted] = await db
        .insert(routesTable)
        .values({
          clerkId,
          name: `${route.name} (aangepast)`,
          source: route.source,
          surface: route.surface as RouteSurface,
          visibility: "prive",
          status: "ready",
          distanceKm: route.distanceKm,
          durationSec: route.durationSec,
          elevationGainM: route.elevationGainM,
          geometry: route.geometry,
          profile: route.profile as never,
          nav: route.nav as never,
          waypoints: route.waypoints as never,
          meetpoints: route.meetpoints as never,
        })
        .returning();
    }

    // Atomair: markeer als aangepast, maar alleen wanneer nog open.
    const updated = await db
      .update(routeProposalsTable)
      .set({
        status: "aangepast",
        adjustedRouteId: adjusted!.id,
        note: note ?? proposal.note,
        respondedAt: new Date(),
      })
      .where(
        and(
          eq(routeProposalsTable.id, id),
          eq(routeProposalsTable.status, "open"),
        ),
      )
      .returning();
    if (updated.length === 0) {
      // Race verloren: het net gemaakte duplicaat weer opruimen.
      await db.delete(routesTable).where(eq(routesTable.id, adjusted!.id));
      res.status(409).json({ error: "Dit voorstel is al beantwoord" });
      return;
    }

    const names = await displayNameMap([clerkId]);
    const responderName = names.get(clerkId) ?? "Je fietsmaatje";
    await createNotification({
      clerkId: proposal.fromClerkId,
      type: "route_proposal",
      title: "Aangepaste route",
      body: `${responderName} heeft je routevoorstel aangepast.`,
      actionUrl: "/routes?view=bewaard",
      source: "route-proposals",
      dedupeKey: `route-voorstel-reactie:${proposal.id}:aangepast`,
    });

    res.status(201).json({ ok: true, status: "aangepast", route: adjusted });
  } catch (err) {
    req.log.error({ err }, "routeProposals.adjust failed");
    res.status(500).json({ error: "Kon geen aangepaste route maken" });
  }
});

export default router;
