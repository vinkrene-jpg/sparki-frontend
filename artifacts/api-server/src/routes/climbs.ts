import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { resolveFlags } from "../lib/flags";
import {
  searchClimbs,
  climbDetail,
  ClimbSourceError,
} from "../lib/climbs";

const router = Router();

// All climb-explorer surfaces are gated by the `climb_explorer` flag. Centralised
// so search + detail share the same gate.
async function requireClimbFlag(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [profile] = await db
      .select({
        activeRole: userProfilesTable.activeRole,
        isHeadTester: userProfilesTable.isHeadTester,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    const activeRole = String(profile?.activeRole ?? "athlete");
    // Zelfde precedence als GET /api/flags: head-tester early access telt mee,
    // anders toont de UI de functie terwijl de API 403 geeft.
    const flags = await resolveFlags(clerkId, activeRole, {
      isHeadTester: profile?.isHeadTester === true,
    });
    if (!flags.climb_explorer) {
      res.status(403).json({ error: "Klimmenverkenner niet ingeschakeld" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "climbs.flag-gate failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─────────────────────────────────────────────
// GET /api/climbs/search?q=&name=&limit=
// Search named climbs (cols/passes/peaks) in a geocoded area. Honest empty/
// error states — never fabricated results.
// ─────────────────────────────────────────────
router.get("/search", requireAuth, requireClimbFlag, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const name = String(req.query.name ?? "").trim() || null;
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
  const radiusRaw = Number(req.query.radiusKm);
  const radiusKm = Number.isFinite(radiusRaw) ? radiusRaw : undefined;
  if (!q) {
    res
      .status(400)
      .json({ error: "Geef een gebied of plaats op om te zoeken." });
    return;
  }
  try {
    const result = await searchClimbs({ q, name, limit, radiusKm });
    res.json(result);
  } catch (err) {
    if (err instanceof ClimbSourceError) {
      if (err.reason === "area_not_found") {
        res.status(404).json({
          error:
            "Dit gebied is niet gevonden. Probeer een plaatsnaam of streek (bijv. \u201cAlpe d\u2019Huez\u201d of \u201cLimburg\u201d).",
          reason: err.reason,
        });
        return;
      }
      res.status(503).json({
        error:
          "De klimmenbron is nu niet bereikbaar. Probeer het zo opnieuw \u2014 er worden nooit verzonnen resultaten getoond.",
        reason: err.reason,
      });
      return;
    }
    req.log.error({ err }, "climbs.search failed");
    res
      .status(500)
      .json({ error: "Er ging iets mis bij het zoeken naar klimmen." });
  }
});

// ─────────────────────────────────────────────
// GET /api/climbs/detail?osmId=
// Full detail for one climb: real elevation + description + (where derivable) a
// climb profile. Honest missing states.
// ─────────────────────────────────────────────
router.get("/detail", requireAuth, requireClimbFlag, async (req, res) => {
  const osmId = String(req.query.osmId ?? "").trim();
  if (!/^(node|way|relation)\/\d+$/.test(osmId)) {
    res.status(400).json({ error: "Ongeldige klim-id." });
    return;
  }
  try {
    const detail = await climbDetail(osmId);
    res.json(detail);
  } catch (err) {
    if (err instanceof ClimbSourceError) {
      if (err.reason === "not_found") {
        res.status(404).json({ error: "Deze klim is niet gevonden." });
        return;
      }
      res.status(503).json({
        error:
          "De klimmenbron is nu niet bereikbaar. Probeer het zo opnieuw.",
        reason: err.reason,
      });
      return;
    }
    req.log.error({ err }, "climbs.detail failed");
    res
      .status(500)
      .json({ error: "Er ging iets mis bij het ophalen van deze klim." });
  }
});

export default router;
