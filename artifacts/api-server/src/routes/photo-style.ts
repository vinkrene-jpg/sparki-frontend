import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, photoLabUploadsTable, athleteProfilesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  claimOwnership,
  stylizePhoto,
  PhotoOwnershipError,
} from "../lib/photo-style";
import { ObjectNotFoundError } from "../lib/objectStorage";

// Sparki Photo Lab routes — isolated, testable photo upload + "Sparki-style"
// edit flow. The original is uploaded by the client via the existing presigned
// storage flow; here we (1) lock ownership of that original, (2) relight it into
// the Sparki look and store it as a SECOND variant, and (3) record the user's
// explicit keep-choice. Honest by contract: when styling fails we persist a
// "failed" row WITHOUT a styled variant and the original stays usable.

const router = Router();

// POST /api/photo-style/stylize — body { originalPath }.
// Locks ownership of the uploaded original, produces the Sparki-styled variant,
// records the session and returns both variants. On a styling failure we still
// return 200 with styled:null + a plain-Dutch reason so the client can fall back
// to the original cleanly.
router.post("/stylize", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as { originalPath?: unknown };
  const originalPath =
    typeof body.originalPath === "string" ? body.originalPath : "";
  if (!originalPath.startsWith("/objects/")) {
    res.status(400).json({ error: "originalPath ontbreekt of is ongeldig" });
    return;
  }

  // Lock ownership of the original now that its bytes exist in storage.
  try {
    await claimOwnership(clerkId, originalPath);
  } catch (err) {
    if (err instanceof PhotoOwnershipError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Foto niet gevonden" });
      return;
    }
    req.log.error({ err }, "photo-style.claimOwnership failed");
    res.status(500).json({ error: "Foto kon niet worden vastgelegd" });
    return;
  }

  try {
    const styled = await stylizePhoto(clerkId, originalPath);
    const [row] = await db
      .insert(photoLabUploadsTable)
      .values({
        clerkId,
        originalPath,
        styledPath: styled.styledPath,
        styleStatus: "styled",
      })
      .returning();
    res.json({
      id: row!.id,
      originalPath,
      styledPath: styled.styledPath,
      styledDataUrl: styled.styledDataUrl,
      styleStatus: "styled" as const,
    });
  } catch (err) {
    // Honest failure: keep the original usable, record the attempt, no fake green.
    req.log.error({ err }, "photo-style.stylize failed");
    const reason =
      "Sparki kon de sfeer nu niet toepassen. Je originele foto blijft bruikbaar.";
    const [row] = await db
      .insert(photoLabUploadsTable)
      .values({
        clerkId,
        originalPath,
        styledPath: null,
        styleStatus: "failed",
        failureReason: reason,
      })
      .returning();
    res.json({
      id: row!.id,
      originalPath,
      styledPath: null,
      styledDataUrl: null,
      styleStatus: "failed" as const,
      failureReason: reason,
    });
  }
});

// POST /api/photo-style/decor/clear — remove the athlete's atmosphere photo.
// Declared BEFORE the "/:id/..." routes so "decor" is never read as an id.
router.post("/decor/clear", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const [updated] = await db
    .update(athleteProfilesTable)
    .set({ decorPhotoPath: null, updatedAt: new Date() })
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Profiel niet gevonden" });
    return;
  }
  res.json({ decorPhotoPath: null });
});

// POST /api/photo-style/:id/choose — body { variant: "original" | "sparki_style" }.
// Persists the user's explicit keep-choice. Ownership-checked; the styled
// variant can only be chosen when it actually exists.
router.post("/:id/choose", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String((req.params as { id?: unknown }).id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = req.body as { variant?: unknown };
  const variant = String(body.variant);
  if (variant !== "original" && variant !== "sparki_style") {
    res.status(400).json({ error: "variant moet original of sparki_style zijn" });
    return;
  }

  const [row] = await db
    .select()
    .from(photoLabUploadsTable)
    .where(
      and(
        eq(photoLabUploadsTable.id, id),
        eq(photoLabUploadsTable.clerkId, clerkId),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "Upload niet gevonden" });
    return;
  }
  if (variant === "sparki_style" && !row.styledPath) {
    res
      .status(409)
      .json({ error: "Er is geen Sparki-versie om te kiezen" });
    return;
  }

  const [updated] = await db
    .update(photoLabUploadsTable)
    .set({ chosenVariant: variant, updatedAt: new Date() })
    .where(eq(photoLabUploadsTable.id, id))
    .returning();
  res.json({
    id: updated!.id,
    chosenVariant: updated!.chosenVariant,
    chosenPath:
      variant === "sparki_style" ? updated!.styledPath : updated!.originalPath,
  });
});

// POST /api/photo-style/:id/use-as-decor — body { variant: "original" | "sparki_style" }.
// Sets the chosen photo as the athlete's profile atmosphere image. Ownership-
// checked against the upload session; the styled variant must actually exist.
router.post("/:id/use-as-decor", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String((req.params as { id?: unknown }).id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = req.body as { variant?: unknown };
  const variant = String(body.variant);
  if (variant !== "original" && variant !== "sparki_style") {
    res.status(400).json({ error: "variant moet original of sparki_style zijn" });
    return;
  }

  const [row] = await db
    .select()
    .from(photoLabUploadsTable)
    .where(
      and(
        eq(photoLabUploadsTable.id, id),
        eq(photoLabUploadsTable.clerkId, clerkId),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "Upload niet gevonden" });
    return;
  }
  if (variant === "sparki_style" && !row.styledPath) {
    res.status(409).json({ error: "Er is geen Sparki-versie om te gebruiken" });
    return;
  }

  const decorPhotoPath =
    variant === "sparki_style" ? row.styledPath! : row.originalPath;

  const [updated] = await db
    .update(athleteProfilesTable)
    .set({ decorPhotoPath, updatedAt: new Date() })
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Profiel niet gevonden" });
    return;
  }
  res.json({ decorPhotoPath });
});

// GET /api/photo-style/latest — the caller's most recent session, so the test
// page can show what was last kept. Honest empty when there is none.
router.get("/latest", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const [row] = await db
    .select()
    .from(photoLabUploadsTable)
    .where(eq(photoLabUploadsTable.clerkId, clerkId))
    .orderBy(desc(photoLabUploadsTable.createdAt))
    .limit(1);
  res.json({ upload: row ?? null });
});

export default router;
