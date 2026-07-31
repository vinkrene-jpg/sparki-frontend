// GET /api/today — de Today Orchestrator-uitkomst voor de ingelogde gebruiker.
// POST /api/today/interactions — klik/afronding registreren (weergavehistorie).
//
// Dun routelaagje: alle logica zit in engines/today (deterministisch, geen AI).

import { Router } from "express";
import { db, userProfilesTable, todayDisplayHistoryTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
// Bewust NIET lib/flags.isAdmin: die heeft een dev-preview-bypass (iedereen
// admin in dev). Voor de debug-/onderbouwingsweergave geldt een strikte poort:
// alleen expliciet aangewezen admins (SPARKI_ADMIN_IDS) of een Hoofdtester —
// ook in ontwikkelmodus, anders zien gewone dev-preview-gebruikers debugdata.
function isExplicitAdmin(clerkId: string): boolean {
  const raw = process.env.SPARKI_ADMIN_IDS ?? "";
  if (!raw.trim()) return false;
  return raw.split(",").map((s) => s.trim()).includes(clerkId);
}
import {
  orchestrateToday,
  recordTodayInteraction,
  availableTodayRoles,
  defaultTodayRole,
  orchestrateTodayForRole,
  todayRoles,
  type TodayRole,
} from "../engines/today";
import type { TodayItem, TodayResult } from "../engines/today/orchestrate";

const router = Router();

// ── WP-T3: debug-/onderbouwingsweergave ──────────────────────────────────────
// Alleen voor bevoegde testers (Hoofdtester) of admins, en alleen op expliciet
// verzoek (?debug=1). Gewone gebruikers krijgen NOOIT debugdetails: passedOver
// wordt altijd uit de normale respons gestript.
type TodaySlots = Pick<TodayResult, "lead" | "support" | "insight" | "rotating">;

function slotDebug(item: TodayItem | null) {
  if (!item) return null;
  return {
    key: item.key,
    source: item.source,
    confidence: item.confidence,
    urgent: item.urgent,
  };
}

async function buildDebug(
  clerkId: string,
  role: TodayRole,
  availableRoles: TodayRole[],
  result: TodayResult,
) {
  const shownKeys = [result.lead, result.support, result.insight, result.rotating]
    .filter((i): i is TodayItem => i != null)
    .map((i) => i.key);
  // Weergavehistorie van de getoonde kaarten: verklaart waarom een kaart
  // (opnieuw) getoond wordt en wanneer die voor het laatst wijzigde.
  const history = shownKeys.length
    ? await db
        .select({
          itemKey: todayDisplayHistoryTable.itemKey,
          daysShown: todayDisplayHistoryTable.daysShown,
          lastShownAt: todayDisplayHistoryTable.lastShownAt,
          clicked: todayDisplayHistoryTable.clicked,
        })
        .from(todayDisplayHistoryTable)
        .where(
          and(
            eq(todayDisplayHistoryTable.clerkId, clerkId),
            inArray(todayDisplayHistoryTable.itemKey, shownKeys),
          ),
        )
    : [];
  return {
    profile: result.profile,
    role,
    availableRoles,
    chosen: {
      lead: slotDebug(result.lead),
      support: slotDebug(result.support),
      insight: slotDebug(result.insight),
      rotating: slotDebug(result.rotating),
    },
    sources: [result.lead, result.support, result.insight, result.rotating]
      .filter((i): i is TodayItem => i != null)
      .map((i) => i.source),
    passedOver: result.passedOver,
    // WP-T1/T2 zijn bewust AI-loos: alle selectie en copy is deterministisch.
    aiUsed: false,
    generatedAt: new Date().toISOString(),
    history,
  };
}

// Normale respons: zonder debugdetails.
function publicShape(result: TodayResult, role: TodayRole, availableRoles: TodayRole[]) {
  const { passedOver: _passedOver, ...rest } = result as TodayResult & TodaySlots;
  return { ...rest, role, availableRoles };
}

// GET /api/today[?rol=trainer|ouder|clubbeheer|hoofdtrainer|atleet]
// Rolweergave is server-side leidend: de gevraagde rol wordt getoetst aan wat
// dit account daadwerkelijk heeft (user_profiles.roles + actieve clubrollen).
// Zonder ?rol volgt de weergave de accountbrede actieve rol. Een rol zonder
// recht geeft 403 — nooit een lege of "geleende" weergave.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Niet ingelogd" });
    return;
  }
  const rawRol = typeof req.query.rol === "string" ? req.query.rol : null;
  if (rawRol && !(todayRoles as readonly string[]).includes(rawRol)) {
    res.status(400).json({ error: `rol moet één van ${todayRoles.join(", ")} zijn` });
    return;
  }
  try {
    const available = await availableTodayRoles(clerkId);
    let rol: TodayRole;
    if (rawRol) {
      rol = rawRol as TodayRole;
      if (!available.includes(rol)) {
        res.status(403).json({ error: "Deze rolweergave is niet aan jouw account gekoppeld" });
        return;
      }
    } else {
      const [user] = await db
        .select({ activeRole: userProfilesTable.activeRole })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, clerkId))
        .limit(1);
      rol = defaultTodayRole(user?.activeRole ?? "athlete", available);
    }
    const result =
      rol === "atleet"
        ? await orchestrateToday(clerkId)
        : await orchestrateTodayForRole(clerkId, rol);

    // Debugweergave: alleen op verzoek én alleen voor expliciete admin of
    // Hoofdtester. `debugAllowed` gaat altijd mee zodat de frontend de knop
    // met exact dezelfde strikte poort toont/verbergt (nooit lib/flags.isAdmin
    // met dev-bypass gebruiken voor deze zichtbaarheid).
    const [me] = await db
      .select({ isHeadTester: userProfilesTable.isHeadTester })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId))
      .limit(1);
    const debugAllowed = isExplicitAdmin(clerkId) || me?.isHeadTester === true;
    const debug =
      debugAllowed && req.query.debug === "1"
        ? await buildDebug(clerkId, rol, available, result)
        : undefined;
    res.json({
      ...publicShape(result, rol, available),
      debugAllowed,
      ...(debug ? { debug } : {}),
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 403) {
      res.status(403).json({ error: "Deze rolweergave is niet aan jouw account gekoppeld" });
      return;
    }
    req.log?.error?.({ err }, "today.orchestrate failed");
    res
      .status(500)
      .json({ error: "Sparki kon je startpagina nu niet samenstellen" });
  }
});

router.post("/interactions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Niet ingelogd" });
    return;
  }
  const itemKey = typeof req.body?.itemKey === "string" ? req.body.itemKey : "";
  const action = req.body?.action;
  if (!itemKey || (action !== "clicked" && action !== "completed")) {
    res.status(400).json({ error: "itemKey en action (clicked|completed) vereist" });
    return;
  }
  try {
    const found = await recordTodayInteraction(clerkId, itemKey, action);
    if (!found) {
      res.status(404).json({ error: "Onbekende boodschap-sleutel" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err }, "today.interaction failed");
    res.status(500).json({ error: "Kon interactie niet opslaan" });
  }
});

export default router;
