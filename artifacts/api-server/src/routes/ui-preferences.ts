import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, uiPreferencesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

// MEDIA_UITLEG_01 F1 — UI-voorkeuren van de weergavelaag.
//
// Nu één veld: `reduceMotion` ("Verminder beweging", T-2/T-4). Server-side
// bewaard zodat de voorkeur op elk toestel geldt. Een ontbrekende rij betekent
// de veilige default (false: beweging volgt alleen de systeeminstelling).
const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Niet ingelogd." });
  try {
    const rows = await db
      .select()
      .from(uiPreferencesTable)
      .where(eq(uiPreferencesTable.clerkId, clerkId))
      .limit(1);
    const row = rows[0];
    return res.json({ reduceMotion: row?.reduceMotion ?? false });
  } catch (err) {
    req.log?.error({ err }, "ui-preferences: lezen mislukt");
    return res.status(500).json({ error: "Voorkeuren konden niet worden gelezen." });
  }
});

router.put("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Niet ingelogd." });

  // Strikte whitelist: alleen bekende velden, alleen booleans.
  const body = req.body as Record<string, unknown> | null | undefined;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return res.status(400).json({ error: "Ongeldige voorkeuren." });
  }
  const unknownKeys = Object.keys(body).filter((k) => k !== "reduceMotion");
  if (unknownKeys.length > 0) {
    return res
      .status(400)
      .json({ error: `Onbekende velden: ${unknownKeys.join(", ")}` });
  }
  if (typeof body.reduceMotion !== "boolean") {
    return res
      .status(400)
      .json({ error: "reduceMotion moet true of false zijn." });
  }

  try {
    await db
      .insert(uiPreferencesTable)
      .values({ clerkId, reduceMotion: body.reduceMotion, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: uiPreferencesTable.clerkId,
        set: { reduceMotion: body.reduceMotion, updatedAt: new Date() },
      });
    return res.json({ reduceMotion: body.reduceMotion });
  } catch (err) {
    req.log?.error({ err }, "ui-preferences: opslaan mislukt");
    return res.status(500).json({ error: "Voorkeur kon niet worden opgeslagen." });
  }
});

export default router;
