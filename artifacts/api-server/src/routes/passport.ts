// Golf 20 — Sportpaspoort-routes.
//
// Alleen de sporter zelf leest zijn paspoort; de club heeft hier geen enkele
// route (fail-closed). Een gekoppelde coach kan uitsluitend meebeslissen over
// open voorstellen (decideProposal controleert de koppeling zelf).
import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  composePassport,
  composeOntwikkeling,
  composeExport,
  applyValueChange,
  decideProposal,
  isPassportField,
  EXPORT_SECTIONS,
  DEFAULT_OFF_SECTIONS,
  type ExportSection,
} from "../lib/passport";
import { passportOrigins, type PassportOrigin } from "@workspace/db";

const router = Router();

// ── GET /api/passport — samengesteld paspoort ────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const passport = await composePassport(clerkId);
    if (!passport)
      return res.status(404).json({ error: "Profiel niet gevonden" });
    return res.json(passport);
  } catch (err) {
    req.log.error({ err }, "passport GET failed");
    return res.status(500).json({ error: "Paspoort kon niet worden samengesteld" });
  }
});

// ── GET /api/passport/ontwikkeling ───────────────────────────────────────────
router.get("/ontwikkeling", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    res.json(await composeOntwikkeling(clerkId));
  } catch (err) {
    req.log.error({ err }, "passport ontwikkeling GET failed");
    res.status(500).json({ error: "Ontwikkelingsbeeld kon niet worden samengesteld" });
  }
});

// ── POST /api/passport/waarde — bewuste invoer met herkomst ─────────────────
// Body: { field, value, origin, source?, measuredAt?, note? }
router.post("/waarde", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const { field, value, origin, source, measuredAt, note } = req.body as {
      field?: string;
      value?: string | number | null;
      origin?: string;
      source?: string;
      measuredAt?: string;
      note?: string;
    };
    if (!field || !isPassportField(field))
      return res.status(400).json({ error: "Onbekend paspoortveld" });
    // Sporterinvoer is per definitie handmatig of een doorgegeven meting.
    const cleanOrigin: PassportOrigin =
      origin != null && (passportOrigins as readonly string[]).includes(origin) &&
      (origin === "gemeten" || origin === "handmatig")
        ? (origin as PassportOrigin)
        : "handmatig";
    const cleanMeasuredAt =
      measuredAt != null && /^\d{4}-\d{2}-\d{2}$/.test(measuredAt)
        ? measuredAt
        : null;
    const result = await applyValueChange({
      clerkId,
      field,
      newValue: value == null || value === "" ? null : String(value),
      origin: cleanOrigin,
      source: typeof source === "string" ? source.slice(0, 200) : null,
      actorType: "sporter",
      actorId: clerkId,
      measuredAt: cleanMeasuredAt,
      note: typeof note === "string" ? note.slice(0, 500) : null,
    });
    return res.json({ ok: true, changed: result.changed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Opslaan mislukt";
    // Bereik-fouten zijn gebruikersfouten, geen serverfouten.
    if (/bereik|Ongeldige/.test(msg)) return res.status(400).json({ error: msg });
    req.log.error({ err }, "passport waarde POST failed");
    return res.status(500).json({ error: "Waarde kon niet worden opgeslagen" });
  }
});

// ── POST /api/passport/voorstellen/:id/besluit ───────────────────────────────
router.post("/voorstellen/:id/besluit", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const id = Number(String(req.params.id));
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "Ongeldig voorstel" });
    const { besluit } = req.body as { besluit?: string };
    if (besluit !== "geaccepteerd" && besluit !== "afgewezen")
      return res
        .status(400)
        .json({ error: "Besluit moet 'geaccepteerd' of 'afgewezen' zijn" });
    const result = await decideProposal({
      proposalId: id,
      deciderClerkId: clerkId,
      decision: besluit,
    });
    if (!result.ok)
      return res.status(result.code).json({ error: result.error });
    return res.json({ ok: true, status: result.status });
  } catch (err) {
    req.log.error({ err }, "passport besluit POST failed");
    return res.status(500).json({ error: "Besluit kon niet worden verwerkt" });
  }
});

// ── POST /api/passport/export — door de sporter samengesteld ─────────────────
// Body: { sections: string[] } — expliciete keuze; lege selectie = 400.
// Gezondheid/locatie/notities staan standaard UIT en moeten bewust aan.
router.post("/export", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const { sections } = req.body as { sections?: unknown };
    if (!Array.isArray(sections) || sections.length === 0)
      return res
        .status(400)
        .json({ error: "Kies eerst welke onderdelen je wilt exporteren" });
    const clean = Array.from(
      new Set(
        sections.filter(
          (s): s is ExportSection =>
            typeof s === "string" &&
            (EXPORT_SECTIONS as readonly string[]).includes(s),
        ),
      ),
    );
    if (clean.length === 0)
      return res.status(400).json({ error: "Geen geldige onderdelen gekozen" });
    const data = await composeExport(clerkId, clean);
    if (!data) return res.status(404).json({ error: "Profiel niet gevonden" });
    return res.json({ export: data, defaultOff: DEFAULT_OFF_SECTIONS });
  } catch (err) {
    req.log.error({ err }, "passport export POST failed");
    return res.status(500).json({ error: "Export kon niet worden samengesteld" });
  }
});

export default router;
