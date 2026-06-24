import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  materialAnalysesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  MATERIAL_CATEGORIES,
  getCategory,
  normalizeMediaType,
  analyzeMaterial,
  uploadMaterialPhoto,
  readMaterialPhotoBase64,
  streamMaterialPhoto,
  ensureMaterialNudgeNotification,
  type MaterialPhotoInput,
} from "../engines/material";

const router = Router();

const MAX_PHOTOS_PER_CASE = 4;

type RawPhoto = { data?: unknown; mediaType?: unknown };

// Parse client-supplied photos. Accepts either a raw base64 string or a data URL
// in `data`. Returns null on any malformed entry so the route fails honestly.
function parsePhotos(raw: unknown): MaterialPhotoInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: MaterialPhotoInput[] = [];
  for (const item of raw as RawPhoto[]) {
    if (!item || typeof item.data !== "string") return null;
    let data = item.data;
    let mediaType =
      typeof item.mediaType === "string" ? item.mediaType : "image/jpeg";
    const dataUrl = data.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataUrl) {
      mediaType = dataUrl[1]!;
      data = dataUrl[2]!;
    }
    const normalized = normalizeMediaType(mediaType);
    if (!normalized) return null;
    const base64 = data.trim();
    if (!base64) return null;
    out.push({ base64, mediaType: normalized });
  }
  return out;
}

// Lightweight athlete hint so advice is tailored without leaking sensitive data.
async function athleteHint(clerkId: string): Promise<string | null> {
  const [athlete] = await db
    .select({
      discipline: athleteProfilesTable.discipline,
      experienceLevel: athleteProfilesTable.experienceLevel,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  if (!athlete) return null;
  const parts = [
    athlete.discipline && `discipline: ${athlete.discipline}`,
    athlete.experienceLevel && `ervaring: ${athlete.experienceLevel}`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// GET /api/material/categories — the relevant material/nutrition questions Sparki
// may ask. Context-sensitive prompts, never a mandatory form.
router.get("/categories", requireAuth, (_req, res) => {
  res.json({ categories: MATERIAL_CATEGORIES });
});

// GET /api/material/nudge — does the athlete's real training data suggest a wear
// check? Deterministic, honest, dismissable. Returns { nudge: null } when nothing
// crosses a threshold. When a nudge is active it also ensures a matching in-app
// notification exists so the suggestion surfaces globally, not just here.
router.get("/nudge", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await ensureMaterialNudgeNotification(clerkId);
    if (!result) {
      res.json({ nudge: null });
      return;
    }
    res.json({
      nudge: {
        ...result.nudge,
        notificationId: result.notificationId,
        dismissed: result.dismissed,
      },
    });
  } catch (err) {
    req.log.error({ err }, "material.nudge failed");
    res.status(500).json({ error: "Kon materiaalcheck niet bepalen" });
  }
});

// GET /api/material — the athlete's own analyses, newest first.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  try {
    const rows = await db
      .select()
      .from(materialAnalysesTable)
      .where(eq(materialAnalysesTable.clerkId, clerkId))
      .orderBy(desc(materialAnalysesTable.createdAt))
      .limit(limit);
    res.json({ analyses: rows });
  } catch (err) {
    req.log.error({ err }, "material.list failed");
    res.status(500).json({ error: "Kon materiaaladvies niet laden" });
  }
});

// POST /api/material/analyze — analyse a new case from real uploaded photos.
//   body: { category, userNote?, photos: [{ data (base64 or data-url), mediaType? }] }
router.post("/analyze", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const category = getCategory(String(body.category ?? ""));
  if (!category) {
    res.status(400).json({ error: "Onbekend onderwerp" });
    return;
  }
  const photos = parsePhotos(body.photos);
  if (!photos) {
    res.status(400).json({ error: "Minstens één geldige foto is nodig" });
    return;
  }
  if (photos.length > MAX_PHOTOS_PER_CASE) {
    res.status(400).json({ error: `Maximaal ${MAX_PHOTOS_PER_CASE} foto's` });
    return;
  }
  const userNote =
    typeof body.userNote === "string" && body.userNote.trim()
      ? body.userNote.trim().slice(0, 500)
      : null;

  try {
    const result = await analyzeMaterial({
      category,
      photos,
      userNote,
      athleteHint: await athleteHint(clerkId),
    });

    // Persist photos only after a successful analysis.
    const photoPaths: string[] = [];
    for (const p of photos) {
      photoPaths.push(await uploadMaterialPhoto(clerkId, p));
    }

    const [row] = await db
      .insert(materialAnalysesTable)
      .values({
        clerkId,
        category: category.key,
        userNote,
        status: result.needsMorePhoto ? "needs_more" : "analyzed",
        photoPaths,
        detectedItem: result.detectedItem,
        confidence: result.confidence,
        followUpQuestion: result.followUpQuestion,
        advice: result.advice,
        costEstimate: result.costEstimate,
      })
      .returning();

    res.json({ analysis: row });
  } catch (err) {
    req.log.error({ err }, "material.analyze failed");
    res
      .status(502)
      .json({ error: "Sparki kon de foto nu niet beoordelen. Probeer opnieuw." });
  }
});

// POST /api/material/:id/photo — add an extra photo to an existing case and
// re-judge the whole case together (used when Sparki asked for more).
router.post("/:id/photo", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const newPhotos = parsePhotos(body.photos);
  if (!newPhotos || newPhotos.length !== 1) {
    res.status(400).json({ error: "Voeg precies één extra foto toe" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(materialAnalysesTable)
      .where(
        and(
          eq(materialAnalysesTable.id, id),
          eq(materialAnalysesTable.clerkId, clerkId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Niet gevonden" });
      return;
    }
    if (existing.photoPaths.length >= MAX_PHOTOS_PER_CASE) {
      res.status(400).json({ error: `Maximaal ${MAX_PHOTOS_PER_CASE} foto's` });
      return;
    }

    const category = getCategory(existing.category);
    if (!category) {
      res.status(400).json({ error: "Onbekend onderwerp" });
      return;
    }

    // Re-download the prior photos so Sparki judges all photos together.
    const priorPhotos: MaterialPhotoInput[] = [];
    for (const path of existing.photoPaths) {
      const stored = await readMaterialPhotoBase64(path);
      const normalized = normalizeMediaType(stored.mediaType);
      if (normalized) {
        priorPhotos.push({ base64: stored.base64, mediaType: normalized });
      }
    }
    const allPhotos = [...priorPhotos, ...newPhotos];

    const result = await analyzeMaterial({
      category,
      photos: allPhotos,
      userNote: existing.userNote,
      athleteHint: await athleteHint(clerkId),
    });

    const newPath = await uploadMaterialPhoto(clerkId, newPhotos[0]!);

    const [row] = await db
      .update(materialAnalysesTable)
      .set({
        status: result.needsMorePhoto ? "needs_more" : "analyzed",
        photoPaths: [...existing.photoPaths, newPath],
        detectedItem: result.detectedItem,
        confidence: result.confidence,
        followUpQuestion: result.followUpQuestion,
        advice: result.advice,
        costEstimate: result.costEstimate,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(materialAnalysesTable.id, id),
          eq(materialAnalysesTable.clerkId, clerkId),
        ),
      )
      .returning();

    res.json({ analysis: row });
  } catch (err) {
    req.log.error({ err }, "material.addPhoto failed");
    res
      .status(502)
      .json({ error: "Sparki kon de extra foto nu niet beoordelen." });
  }
});

// GET /api/material/photo/:id/:idx — serve one stored photo (ownership-checked).
router.get("/photo/:id/:idx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  const idx = Number(req.params.idx);
  if (!Number.isInteger(id) || !Number.isInteger(idx) || idx < 0) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }

  try {
    const [row] = await db
      .select({ photoPaths: materialAnalysesTable.photoPaths })
      .from(materialAnalysesTable)
      .where(
        and(
          eq(materialAnalysesTable.id, id),
          eq(materialAnalysesTable.clerkId, clerkId),
        ),
      );
    const path = row?.photoPaths[idx];
    if (!path) {
      res.status(404).json({ error: "Foto niet gevonden" });
      return;
    }
    const stream = await streamMaterialPhoto(path, res);
    stream.on("error", (err) => {
      req.log.error({ err }, "material.photo stream failed");
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "material.photo failed");
    if (!res.headersSent) res.status(404).json({ error: "Foto niet gevonden" });
  }
});

export default router;
