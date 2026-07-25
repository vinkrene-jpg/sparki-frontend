import { Router } from "express";
import { and, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  trainingSessionsTable,
  routesTable,
  racesTable,
  knowledgeItemsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { resolveFlags } from "../lib/flags";

// App-brede zoekfunctie: doorzoekt uitsluitend EIGEN data (clerkId-gebonden)
// plus de gedeelde kennisbank (alleen wanneer de knowledge_base-vlag aan
// staat, dezelfde poort als /api/knowledge). Pagina's/onderdelen worden
// client-side gezocht (lib/zoekregister) — dit endpoint levert alleen echte
// datatreffers, nooit verzonnen resultaten.

const router = Router();

const PER_GROUP = 5;

// ILIKE-metatekens onschadelijk maken zodat "100%" letterlijk zoekt.
function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export type SearchItem = {
  id: number;
  titel: string;
  sub: string | null;
};

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json({ query: q, groups: [] });
    return;
  }
  const term = likeTerm(q);

  try {
    const [profile] = await db
      .select({
        activeRole: userProfilesTable.activeRole,
        isHeadTester: userProfilesTable.isHeadTester,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));

    const [sessions, ownRoutes, races] = await Promise.all([
      db
        .select({
          id: trainingSessionsTable.id,
          title: trainingSessionsTable.title,
          sport: trainingSessionsTable.sport,
          type: trainingSessionsTable.type,
          sessionDate: trainingSessionsTable.sessionDate,
          notes: trainingSessionsTable.notes,
        })
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.clerkId, clerkId),
            or(
              ilike(trainingSessionsTable.title, term),
              ilike(trainingSessionsTable.notes, term),
            ),
          ),
        )
        .orderBy(desc(trainingSessionsTable.sessionDate))
        .limit(PER_GROUP),
      db
        .select({
          id: routesTable.id,
          name: routesTable.name,
          distanceKm: routesTable.distanceKm,
          surface: routesTable.surface,
        })
        .from(routesTable)
        .where(
          and(
            eq(routesTable.clerkId, clerkId),
            isNull(routesTable.deletedAt),
            ilike(routesTable.name, term),
          ),
        )
        .orderBy(desc(routesTable.id))
        .limit(PER_GROUP),
      db
        .select({
          id: racesTable.id,
          name: racesTable.name,
          raceDate: racesTable.raceDate,
          location: racesTable.location,
        })
        .from(racesTable)
        .where(
          and(
            eq(racesTable.clerkId, clerkId),
            // Geannuleerde wedstrijden tellen nergens in mee — ook niet in zoeken.
            ne(racesTable.status, "geannuleerd"),
            or(
              ilike(racesTable.name, term),
              ilike(racesTable.location, term),
            ),
          ),
        )
        .orderBy(desc(racesTable.raceDate))
        .limit(PER_GROUP),
    ]);

    // Kennisbank alleen doorzoeken achter dezelfde vlag als /api/knowledge.
    let knowledge: { id: number; title: string; titleNl: string | null; source: string | null }[] = [];
    try {
      const flags = await resolveFlags(
        clerkId,
        String(profile?.activeRole ?? "athlete"),
        { isHeadTester: profile?.isHeadTester === true },
      );
      if (flags.knowledge_base) {
        knowledge = await db
          .select({
            id: knowledgeItemsTable.id,
            title: knowledgeItemsTable.title,
            titleNl: knowledgeItemsTable.titleNl,
            source: knowledgeItemsTable.source,
          })
          .from(knowledgeItemsTable)
          .where(
            or(
              ilike(knowledgeItemsTable.title, term),
              ilike(knowledgeItemsTable.titleNl, term),
            ),
          )
          .orderBy(desc(knowledgeItemsTable.publishedAt))
          .limit(PER_GROUP);
      }
    } catch (err) {
      // Vlagresolutie mag zoeken in eigen data nooit blokkeren.
      req.log.warn({ err }, "search.knowledge-flag failed");
    }

    const groups: { key: string; label: string; items: (SearchItem & { extra?: Record<string, unknown> })[] }[] = [];

    if (sessions.length > 0) {
      groups.push({
        key: "trainingen",
        label: "Trainingen & ritten",
        items: sessions.map((s) => ({
          id: s.id,
          titel: s.title?.trim() || (s.sport === "cycling" ? "Rit" : "Training"),
          sub: s.sessionDate,
        })),
      });
    }
    if (ownRoutes.length > 0) {
      groups.push({
        key: "routes",
        label: "Routes",
        items: ownRoutes.map((r) => ({
          id: r.id,
          titel: r.name,
          sub: r.distanceKm != null ? `${Math.round(r.distanceKm)} km` : null,
        })),
      });
    }
    if (races.length > 0) {
      groups.push({
        key: "wedstrijden",
        label: "Wedstrijden",
        items: races.map((r) => ({
          id: r.id,
          titel: r.name,
          sub: [r.raceDate, r.location].filter(Boolean).join(" · ") || null,
        })),
      });
    }
    if (knowledge.length > 0) {
      groups.push({
        key: "kennis",
        label: "Kennis",
        items: knowledge.map((k) => ({
          id: k.id,
          titel: k.titleNl?.trim() || k.title,
          sub: k.source,
        })),
      });
    }

    res.json({ query: q, groups });
  } catch (err) {
    req.log.error({ err }, "search failed");
    res.status(500).json({ error: "Zoeken is nu niet beschikbaar" });
  }
});

export default router;
