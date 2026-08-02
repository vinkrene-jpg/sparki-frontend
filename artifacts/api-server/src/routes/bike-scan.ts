import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  garageBikesTable,
  garageComponentsTable,
  bikeScansTable,
  bikeScanFramesTable,
  equipmentAssetsTable,
  bikeScanSteps,
  equipmentAssetSources,
  type BikeScanFrameQuality,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  uploadMaterialPhoto,
  streamMaterialPhoto,
} from "../engines/material";

// Fietsscan + productbeelden voor onderdelen.
//
// Eerlijkheidscontract:
// - Originele opnames blijven ALTIJD bewaard; het vrijstaande PNG komt er los
//   bij (cutoutPath) en vervangt nooit het origineel.
// - Kwaliteitsmetingen worden client-side op het moment van opname gemeten en
//   hier alleen opgeslagen — de server verzint of "verbetert" niets.
// - Productbeelden (equipment_assets) vereisen verplichte herkomst (bron +
//   licentie). Zonder toegestaan gebruiksrecht wordt geen beeld opgeslagen.

const router = Router();

const MAX_FRAMES_PER_SCAN = 48;
const MAX_ASSETS_PER_COMPONENT = 4;

function parseBase64Image(body: Record<string, unknown>): {
  base64: string;
  mediaType: string;
} | null {
  let data = typeof body.data === "string" ? body.data : "";
  let mediaType =
    typeof body.mediaType === "string" ? body.mediaType : "image/jpeg";
  const dataUrl = data.match(/^data:([^;]+);base64,(.*)$/s);
  if (dataUrl) {
    mediaType = dataUrl[1]!;
    data = dataUrl[2]!;
  }
  if (!data.trim() || !/^image\//.test(mediaType)) return null;
  return { base64: data.trim(), mediaType };
}

// Server-side her-validatie van de client-meting — dezelfde drempels als
// artifacts/sparki/src/lib/scan-quality.ts (QUALITY_LIMITS). De server slaat
// geen frame op dat volgens de eigen meting al afgekeurd had moeten worden en
// geeft de concrete heropname-reden terug.
const QUALITY_LIMITS = {
  minBrightness: 0.16,
  maxBrightness: 0.93,
  minSharpness: 28,
  maxMotion: 0.28,
  minCoverage: 0.06,
} as const;

function qualityRejection(q: BikeScanFrameQuality): string | null {
  if (q.brightness < QUALITY_LIMITS.minBrightness)
    return "Te donker — zoek meer licht en maak de opname opnieuw.";
  if (q.brightness > QUALITY_LIMITS.maxBrightness)
    return "Te licht — vermijd tegenlicht en maak de opname opnieuw.";
  if (q.motion > QUALITY_LIMITS.maxMotion)
    return "Te veel beweging — houd je telefoon stil en maak de opname opnieuw.";
  if (q.sharpness < QUALITY_LIMITS.minSharpness)
    return "Onscherp — wacht tot de camera scherpstelt en maak de opname opnieuw.";
  if (q.coverage < QUALITY_LIMITS.minCoverage)
    return "Weinig detail in beeld — zet de fiets volledig in het kader en maak de opname opnieuw.";
  return null;
}

function parseQuality(v: unknown): BikeScanFrameQuality | null {
  if (!v || typeof v !== "object") return null;
  const q = v as Record<string, unknown>;
  const nums = ["brightness", "sharpness", "motion", "coverage"] as const;
  const out: Record<string, number> = {};
  for (const k of nums) {
    const n = Number(q[k]);
    if (!Number.isFinite(n)) return null;
    out[k] = n;
  }
  return out as unknown as BikeScanFrameQuality;
}

async function ownedBike(clerkId: string, bikeId: number) {
  const [bike] = await db
    .select()
    .from(garageBikesTable)
    .where(
      and(eq(garageBikesTable.id, bikeId), eq(garageBikesTable.clerkId, clerkId)),
    );
  return bike ?? null;
}

// POST /api/bike-scan/start { bikeId } — start een nieuwe begeleide scan.
// Een eerdere onafgeronde scan voor deze fiets wordt afgebroken (opnieuw
// scannen is altijd mogelijk); afgeronde scans blijven bestaan tot een nieuwe
// scan is afgerond, zodat de weergave nooit "leeg valt" tijdens het scannen.
router.post("/start", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const bikeId = Number((req.body ?? {}).bikeId);
  if (!Number.isInteger(bikeId)) {
    res.status(400).json({ error: "Ongeldige fiets" });
    return;
  }
  try {
    const bike = await ownedBike(clerkId, bikeId);
    if (!bike) {
      res.status(404).json({ error: "Fiets niet gevonden" });
      return;
    }
    await db
      .update(bikeScansTable)
      .set({ status: "afgebroken" })
      .where(
        and(
          eq(bikeScansTable.bikeId, bikeId),
          eq(bikeScansTable.clerkId, clerkId),
          eq(bikeScansTable.status, "bezig"),
        ),
      );
    const [scan] = await db
      .insert(bikeScansTable)
      .values({ clerkId, bikeId, status: "bezig" })
      .returning();
    res.json({ scan, steps: bikeScanSteps });
  } catch (err) {
    req.log.error({ err }, "bikeScan.start failed");
    res.status(500).json({ error: "Kon de scan niet starten" });
  }
});

// POST /api/bike-scan/:scanId/frame — sla één goedgekeurd origineel frame op.
// Body: { step, seq, data (base64), mediaType, quality {brightness, sharpness,
// motion, coverage} }. De kwaliteitsmeting komt van de opname zelf.
router.post("/:scanId/frame", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const scanId = Number(req.params.scanId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const step = String(body.step ?? "");
  const seq = Number(body.seq ?? 0);
  const image = parseBase64Image(body);
  const quality = parseQuality(body.quality);
  if (
    !Number.isInteger(scanId) ||
    !(bikeScanSteps as readonly string[]).includes(step) ||
    !Number.isInteger(seq) ||
    !image
  ) {
    res.status(400).json({ error: "Ongeldige opname" });
    return;
  }
  if (!quality) {
    res.status(400).json({ error: "Kwaliteitsmeting ontbreekt bij deze opname" });
    return;
  }
  const rejection = qualityRejection(quality);
  if (rejection) {
    // Eerlijke afkeuring: het frame wordt NIET opgeslagen; de renner krijgt
    // precies één concrete heropname-instructie terug.
    res.status(422).json({ error: rejection, heropname: true });
    return;
  }
  try {
    const [scan] = await db
      .select()
      .from(bikeScansTable)
      .where(
        and(eq(bikeScansTable.id, scanId), eq(bikeScansTable.clerkId, clerkId)),
      );
    if (!scan || scan.status !== "bezig") {
      res.status(404).json({ error: "Scan niet gevonden of al afgerond" });
      return;
    }
    const existing = await db
      .select({ id: bikeScanFramesTable.id })
      .from(bikeScanFramesTable)
      .where(eq(bikeScanFramesTable.scanId, scanId));
    if (existing.length >= MAX_FRAMES_PER_SCAN) {
      res.status(400).json({ error: "Maximum aantal opnames bereikt" });
      return;
    }
    const originalPath = await uploadMaterialPhoto(clerkId, image);
    const [frame] = await db
      .insert(bikeScanFramesTable)
      .values({
        clerkId,
        scanId,
        bikeId: scan.bikeId,
        step,
        seq,
        originalPath,
        quality,
        approved: 1,
      })
      .returning();
    res.json({ frame });
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number") {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    req.log.error({ err }, "bikeScan.frame failed");
    res.status(502).json({ error: "Kon de opname nu niet opslaan. Probeer opnieuw." });
  }
});

// POST /api/bike-scan/frame/:frameId/cutout — sla het vrijstaande PNG op
// (achtergrond client-side verwijderd). Het origineel blijft bewaard.
router.post("/frame/:frameId/cutout", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const frameId = Number(req.params.frameId);
  const image = parseBase64Image((req.body ?? {}) as Record<string, unknown>);
  if (!Number.isInteger(frameId) || !image || image.mediaType !== "image/png") {
    res.status(400).json({ error: "Een vrijstaand PNG is nodig" });
    return;
  }
  try {
    const [frame] = await db
      .select()
      .from(bikeScanFramesTable)
      .where(
        and(
          eq(bikeScanFramesTable.id, frameId),
          eq(bikeScanFramesTable.clerkId, clerkId),
        ),
      );
    if (!frame) {
      res.status(404).json({ error: "Opname niet gevonden" });
      return;
    }
    const cutoutPath = await uploadMaterialPhoto(clerkId, image);
    const [row] = await db
      .update(bikeScanFramesTable)
      .set({ cutoutPath })
      .where(eq(bikeScanFramesTable.id, frameId))
      .returning();
    res.json({ frame: row });
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number") {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    req.log.error({ err }, "bikeScan.cutout failed");
    res.status(502).json({ error: "Kon het vrijstaande beeld niet opslaan" });
  }
});

// POST /api/bike-scan/:scanId/complete — rond de scan af. Oudere afgeronde
// scans voor dezelfde fiets worden opgeruimd zodat er één actuele set is.
router.post("/:scanId/complete", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const scanId = Number(req.params.scanId);
  if (!Number.isInteger(scanId)) {
    res.status(400).json({ error: "Ongeldige scan" });
    return;
  }
  try {
    const [scan] = await db
      .update(bikeScansTable)
      .set({ status: "afgerond", completedAt: new Date() })
      .where(
        and(
          eq(bikeScansTable.id, scanId),
          eq(bikeScansTable.clerkId, clerkId),
          eq(bikeScansTable.status, "bezig"),
        ),
      )
      .returning();
    if (!scan) {
      res.status(404).json({ error: "Scan niet gevonden" });
      return;
    }
    // Ruim eerdere afgeronde scans van deze fiets op (frames casc. mee).
    const old = await db
      .select({ id: bikeScansTable.id })
      .from(bikeScansTable)
      .where(
        and(
          eq(bikeScansTable.bikeId, scan.bikeId),
          eq(bikeScansTable.clerkId, clerkId),
          eq(bikeScansTable.status, "afgerond"),
        ),
      );
    for (const s of old) {
      if (s.id !== scan.id) {
        await db.delete(bikeScansTable).where(eq(bikeScansTable.id, s.id));
      }
    }
    res.json({ scan });
  } catch (err) {
    req.log.error({ err }, "bikeScan.complete failed");
    res.status(500).json({ error: "Kon de scan niet afronden" });
  }
});

// GET /api/bike-scan/bike/:bikeId — de actuele afgeronde scan + frames voor
// deze fiets. `viewMode` is afgeleid: "draai360" alleen bij voldoende ECHTE
// rondom-beelden met cutout (nooit gesimuleerd), anders "fotos" of "geen".
router.get("/bike/:bikeId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const bikeId = Number(req.params.bikeId);
  if (!Number.isInteger(bikeId)) {
    res.status(400).json({ error: "Ongeldige fiets" });
    return;
  }
  try {
    const bike = await ownedBike(clerkId, bikeId);
    if (!bike) {
      res.status(404).json({ error: "Fiets niet gevonden" });
      return;
    }
    const [scan] = await db
      .select()
      .from(bikeScansTable)
      .where(
        and(
          eq(bikeScansTable.bikeId, bikeId),
          eq(bikeScansTable.clerkId, clerkId),
          eq(bikeScansTable.status, "afgerond"),
        ),
      )
      .orderBy(desc(bikeScansTable.completedAt))
      .limit(1);
    if (!scan) {
      res.json({ scan: null, frames: [], viewMode: "geen" });
      return;
    }
    const frames = await db
      .select()
      .from(bikeScanFramesTable)
      .where(eq(bikeScanFramesTable.scanId, scan.id))
      .orderBy(asc(bikeScanFramesTable.seq), asc(bikeScanFramesTable.id));
    // 360 alleen met voldoende echte rondom-cutouts (volledig/links/voorzijde/
    // rechts) — detailopnames tellen niet mee als rotatiebeeld.
    const AROUND: readonly string[] = ["volledig", "links", "voorzijde", "rechts"];
    const around = frames.filter(
      (f) => AROUND.includes(f.step) && f.cutoutPath,
    );
    // Fotoserie zodra er ÉCHTE opnames zijn — ook als de achtergrond nergens
    // verwijderd kon worden tonen we de bewaarde originelen (nooit "geen"
    // terwijl er wel echte beelden bestaan).
    const viewMode =
      around.length >= 8 ? "draai360" : frames.length > 0 ? "fotos" : "geen";
    res.json({ scan, frames, viewMode });
  } catch (err) {
    req.log.error({ err }, "bikeScan.get failed");
    res.status(500).json({ error: "Kon de scan niet laden" });
  }
});

// GET /api/bike-scan/frame/:frameId/:kind — serveer origineel of cutout
// (eigenaar-gecontroleerd, gestreamd uit objectopslag).
router.get("/frame/:frameId/:kind", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const frameId = Number(req.params.frameId);
  const kind = String(req.params.kind);
  if (!Number.isInteger(frameId) || !["origineel", "vrijstaand"].includes(kind)) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const [frame] = await db
      .select()
      .from(bikeScanFramesTable)
      .where(
        and(
          eq(bikeScanFramesTable.id, frameId),
          eq(bikeScanFramesTable.clerkId, clerkId),
        ),
      );
    const path = kind === "origineel" ? frame?.originalPath : frame?.cutoutPath;
    if (!path) {
      res.status(404).json({ error: "Beeld niet gevonden" });
      return;
    }
    const stream = await streamMaterialPhoto(path, res);
    stream.on("error", (err) => {
      req.log.error({ err }, "bikeScan.serve stream failed");
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "bikeScan.serve failed");
    if (!res.headersSent) res.status(404).json({ error: "Beeld niet gevonden" });
  }
});

// DELETE /api/bike-scan/bike/:bikeId — verwijder alle scans van deze fiets
// (opnieuw beginnen). Originelen in opslag blijven ongemoeid door dit pad.
router.delete("/bike/:bikeId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const bikeId = Number(req.params.bikeId);
  if (!Number.isInteger(bikeId)) {
    res.status(400).json({ error: "Ongeldige fiets" });
    return;
  }
  try {
    await db
      .delete(bikeScansTable)
      .where(
        and(
          eq(bikeScansTable.bikeId, bikeId),
          eq(bikeScansTable.clerkId, clerkId),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "bikeScan.delete failed");
    res.status(500).json({ error: "Kon de scans niet verwijderen" });
  }
});

// ---------------------------------------------------------------------------
// Productbeelden voor onderdelen (equipment_assets)

// GET /api/bike-scan/assets?componentId= — beelden bij één component.
router.get("/assets", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const componentId = Number(req.query.componentId);
  if (!Number.isInteger(componentId)) {
    res.status(400).json({ error: "Ongeldig onderdeel" });
    return;
  }
  try {
    const assets = await db
      .select()
      .from(equipmentAssetsTable)
      .where(
        and(
          eq(equipmentAssetsTable.componentId, componentId),
          eq(equipmentAssetsTable.clerkId, clerkId),
        ),
      )
      .orderBy(desc(equipmentAssetsTable.importedAt));
    res.json({ assets });
  } catch (err) {
    req.log.error({ err }, "assets.list failed");
    res.status(500).json({ error: "Kon de productbeelden niet laden" });
  }
});

// POST /api/bike-scan/assets — koppel één productbeeld aan een component.
// Herkomst is VERPLICHT: bron (fabrikant/distributeur/catalogus/upload),
// licentiestatus en — behalve bij eigen upload — de bron-URL. Zonder
// toegestaan gebruiksrecht wordt niets opgeslagen.
router.post("/assets", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const componentId = Number(body.componentId);
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const variant =
    typeof body.variant === "string" && body.variant.trim()
      ? body.variant.trim().slice(0, 120)
      : null;
  const source = String(body.source ?? "");
  const sourceUrl =
    typeof body.sourceUrl === "string" && body.sourceUrl.trim()
      ? body.sourceUrl.trim().slice(0, 500)
      : null;
  const license = typeof body.license === "string" ? body.license.trim() : "";
  const image = parseBase64Image(body);
  if (
    !Number.isInteger(componentId) ||
    !brand ||
    !model ||
    !license ||
    !(equipmentAssetSources as readonly string[]).includes(source) ||
    !image
  ) {
    res.status(400).json({
      error:
        "Merk, model, bron, licentiestatus en een beeld zijn verplicht — zonder herkomst wordt geen productbeeld opgeslagen",
    });
    return;
  }
  if (source !== "upload" && !sourceUrl) {
    res.status(400).json({ error: "Bij een externe bron is de bron-URL verplicht" });
    return;
  }
  try {
    const [component] = await db
      .select()
      .from(garageComponentsTable)
      .where(
        and(
          eq(garageComponentsTable.id, componentId),
          eq(garageComponentsTable.clerkId, clerkId),
        ),
      );
    if (!component) {
      res.status(404).json({ error: "Onderdeel niet gevonden" });
      return;
    }
    const existing = await db
      .select({ id: equipmentAssetsTable.id })
      .from(equipmentAssetsTable)
      .where(eq(equipmentAssetsTable.componentId, componentId));
    if (existing.length >= MAX_ASSETS_PER_COMPONENT) {
      res
        .status(400)
        .json({ error: `Maximaal ${MAX_ASSETS_PER_COMPONENT} beelden per onderdeel` });
      return;
    }
    const imagePath = await uploadMaterialPhoto(clerkId, image);
    const [asset] = await db
      .insert(equipmentAssetsTable)
      .values({
        clerkId,
        componentId,
        brand: brand.slice(0, 120),
        model: model.slice(0, 160),
        variant,
        source,
        sourceUrl,
        license: license.slice(0, 300),
        imagePath,
      })
      .returning();
    res.json({ asset });
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number") {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    req.log.error({ err }, "assets.create failed");
    res.status(502).json({ error: "Kon het productbeeld niet opslaan" });
  }
});

// GET /api/bike-scan/assets/:id/image — serveer één productbeeld (owner-gated).
router.get("/assets/:id/image", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const [asset] = await db
      .select()
      .from(equipmentAssetsTable)
      .where(
        and(eq(equipmentAssetsTable.id, id), eq(equipmentAssetsTable.clerkId, clerkId)),
      );
    if (!asset) {
      res.status(404).json({ error: "Beeld niet gevonden" });
      return;
    }
    const stream = await streamMaterialPhoto(asset.imagePath, res);
    stream.on("error", (err) => {
      req.log.error({ err }, "assets.image stream failed");
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "assets.image failed");
    if (!res.headersSent) res.status(404).json({ error: "Beeld niet gevonden" });
  }
});

// DELETE /api/bike-scan/assets/:id — verwijder één productbeeld.
router.delete("/assets/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const rows = await db
      .delete(equipmentAssetsTable)
      .where(
        and(eq(equipmentAssetsTable.id, id), eq(equipmentAssetsTable.clerkId, clerkId)),
      )
      .returning({ id: equipmentAssetsTable.id });
    if (rows.length === 0) {
      res.status(404).json({ error: "Beeld niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "assets.delete failed");
    res.status(500).json({ error: "Kon het beeld niet verwijderen" });
  }
});

export default router;
