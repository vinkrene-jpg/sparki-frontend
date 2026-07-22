import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, navSettingsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

// Toegestane datavelden voor het navigatiescherm. De volgorde in de opgeslagen
// array bepaalt de weergavevolgorde.
const ALLOWED_DATA_FIELDS = [
  "snelheid",
  "gemiddelde",
  "afstand",
  "resterend",
  "tijd",
  "bewegingstijd",
  "eta",
  "hartslag",
  "vermogen",
  "cadans",
  "hoogte",
  "stijging",
] as const;
type DataField = (typeof ALLOWED_DATA_FIELDS)[number];

const ALLOWED_FONT_SIZE = ["klein", "normaal", "groot"] as const;
type FontSize = (typeof ALLOWED_FONT_SIZE)[number];

const ALLOWED_BAR_POSITION = ["boven", "onder"] as const;
type BarPosition = (typeof ALLOWED_BAR_POSITION)[number];

export type NavSettings = {
  dataFields: DataField[];
  maxFields: number;
  fontSize: FontSize;
  barPosition: BarPosition;
  headingUp: boolean;
  autoClimb: boolean;
  autoPois: boolean;
  autoSprint: boolean;
  // Geluidssignalen (korte tonen) en gesproken aanwijzingen tijdens navigatie.
  // Optioneel bij binnenkomst (oudere clients sturen ze niet mee) — default aan.
  soundCues: boolean;
  voiceCues: boolean;
};

// Valideer een inkomende instellingen-vorm strikt (whitelist). Retourneert een
// Nederlandse foutmelding wanneer iets niet klopt, of de gevalideerde waarde.
function validateNavSettings(
  input: unknown,
): { ok: true; value: NavSettings } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Ongeldige instellingen." };
  }
  const body = input as Record<string, unknown>;

  const allowedKeys = new Set([
    "dataFields",
    "maxFields",
    "fontSize",
    "barPosition",
    "headingUp",
    "autoClimb",
    "autoPois",
    "autoSprint",
    "soundCues",
    "voiceCues",
  ]);
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Onbekend veld: ${key}.` };
    }
  }

  if (!Array.isArray(body.dataFields)) {
    return { ok: false, error: "Datavelden ontbreken of zijn ongeldig." };
  }
  const dataFields: DataField[] = [];
  const seen = new Set<string>();
  for (const f of body.dataFields) {
    if (
      typeof f !== "string" ||
      !ALLOWED_DATA_FIELDS.includes(f as DataField)
    ) {
      return { ok: false, error: `Onbekend dataveld: ${String(f)}.` };
    }
    if (seen.has(f)) {
      return { ok: false, error: `Dubbel dataveld: ${f}.` };
    }
    seen.add(f);
    dataFields.push(f as DataField);
  }

  if (
    typeof body.maxFields !== "number" ||
    !Number.isInteger(body.maxFields) ||
    body.maxFields < 2 ||
    body.maxFields > 8
  ) {
    return { ok: false, error: "Aantal velden moet tussen 2 en 8 liggen." };
  }

  if (
    typeof body.fontSize !== "string" ||
    !ALLOWED_FONT_SIZE.includes(body.fontSize as FontSize)
  ) {
    return { ok: false, error: "Ongeldige lettergrootte." };
  }

  if (
    typeof body.barPosition !== "string" ||
    !ALLOWED_BAR_POSITION.includes(body.barPosition as BarPosition)
  ) {
    return { ok: false, error: "Ongeldige balkpositie." };
  }

  for (const key of ["headingUp", "autoClimb", "autoPois", "autoSprint"] as const) {
    if (typeof body[key] !== "boolean") {
      return { ok: false, error: `Ongeldige waarde voor ${key}.` };
    }
  }

  // Optionele audiovelden: afwezig = aan (bestaand gedrag verandert niet),
  // aanwezig = strikt boolean.
  for (const key of ["soundCues", "voiceCues"] as const) {
    if (key in body && typeof body[key] !== "boolean") {
      return { ok: false, error: `Ongeldige waarde voor ${key}.` };
    }
  }

  return {
    ok: true,
    value: {
      dataFields,
      maxFields: body.maxFields,
      fontSize: body.fontSize as FontSize,
      barPosition: body.barPosition as BarPosition,
      headingUp: body.headingUp as boolean,
      autoClimb: body.autoClimb as boolean,
      autoPois: body.autoPois as boolean,
      autoSprint: body.autoSprint as boolean,
      soundCues: typeof body.soundCues === "boolean" ? body.soundCues : true,
      voiceCues: typeof body.voiceCues === "boolean" ? body.voiceCues : true,
    },
  };
}

// GET /api/nav-settings — de opgeslagen navigatie-instellingen van de atleet.
// settings is null wanneer er nog nooit iets is opgeslagen (client valt dan
// eerlijk terug op zijn eigen defaults).
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .select()
      .from(navSettingsTable)
      .where(eq(navSettingsTable.clerkId, clerkId))
      .limit(1);
    res.json({ settings: row?.settings ?? null });
  } catch (err) {
    req.log.error({ err }, "nav-settings.get failed");
    res.status(500).json({ error: "Kon navigatie-instellingen niet laden" });
  }
});

// PUT /api/nav-settings — valideer en upsert de navigatie-instellingen.
router.put("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const result = validateNavSettings(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  try {
    await db
      .insert(navSettingsTable)
      .values({ clerkId, settings: result.value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: navSettingsTable.clerkId,
        set: { settings: result.value, updatedAt: new Date() },
      });
    res.json({ settings: result.value });
  } catch (err) {
    req.log.error({ err }, "nav-settings.put failed");
    res.status(500).json({ error: "Kon navigatie-instellingen niet opslaan" });
  }
});

export default router;
