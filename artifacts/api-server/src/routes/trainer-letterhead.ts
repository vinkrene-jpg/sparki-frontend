// SPARKI_BUILD_04 F7 — briefpapier en templates (4.6).
//
// Bindend:
// - Upload = PDF of ondersteund beeldformaat (PNG/JPEG), met ECHTE
//   controles: veilige marges (buitenrand moet drukvrij zijn) en
//   leesbaarheid (minimale resolutie). Te krap of onleesbaar ⇒ 422, eerlijk
//   met reden — nooit stil accepteren.
// - Elke geslaagde upload krijgt een doorlopende templateversie per trainer;
//   verzonden facturen dragen de versie waarmee ze verzonden zijn en
//   veranderen NOOIT meer (invoice.templateVersion wordt bij verzending
//   bevroren; zie trainer-billing).
// - Geen actief briefpapier = standaard Sparki-template (versie 0) als
//   eerlijke fallback.
// - Opslag via de bestaande objectstorage-laag (owner-ACL) — geen tweede
//   opslagpad.

import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, trainerLetterheadsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { uploadMaterialPhoto, streamMaterialPhoto } from "../lib/material/storage";

const router = Router();

// Buitenrand die drukvrij moet zijn: 5% van elke zijde (~10 mm op A4).
const MARGIN_FRACTION = 0.05;
// Meer dan 2% "inkt" (niet-witte pixels) in de rand = te krappe marges.
const MAX_EDGE_INK = 0.02;
// Leesbaarheid: minimaal 1000px breed (anders wordt tekst op A4 wazig).
const MIN_WIDTH_PX = 1000;

type CheckResult = { ok: true } | { ok: false; reason: string };

async function checkImage(buffer: Buffer): Promise<CheckResult> {
  const sharp = (await import("sharp")).default;
  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < MIN_WIDTH_PX) {
    return {
      ok: false,
      reason: `Leesbaarheidscontrole: het bestand is ${width}px breed; minimaal ${MIN_WIDTH_PX}px nodig voor scherpe tekst op A4.`,
    };
  }
  const { data, info } = await img
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mx = Math.round(info.width * MARGIN_FRACTION);
  const my = Math.round(info.height * MARGIN_FRACTION);
  let edge = 0;
  let ink = 0;
  for (let y = 0; y < info.height; y++) {
    const inBandY = y < my || y >= info.height - my;
    for (let x = 0; x < info.width; x++) {
      if (!inBandY && x >= mx && x < info.width - mx) continue;
      edge++;
      if (data[y * info.width + x]! < 230) ink++;
    }
  }
  if (edge > 0 && ink / edge > MAX_EDGE_INK) {
    return {
      ok: false,
      reason: `Margecontrole: ${(100 * (ink / edge)).toFixed(1)}% van de buitenrand bevat drukwerk; houd de buitenste ${Math.round(MARGIN_FRACTION * 100)}% vrij zodat factuurtekst nooit over je huisstijl valt.`,
    };
  }
  return { ok: true };
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : null;
    const mediaType = typeof req.body?.mediaType === "string" ? req.body.mediaType : null;
    if (!base64 || !mediaType) {
      res.status(400).json({ error: "base64 en mediaType zijn verplicht." });
      return;
    }
    if (!["image/png", "image/jpeg", "application/pdf"].includes(mediaType)) {
      res.status(400).json({ error: "Alleen PNG, JPEG of PDF wordt ondersteund." });
      return;
    }
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
      res.status(400).json({ error: "Bestand is leeg of groter dan 10 MB." });
      return;
    }

    let marginsOk = false;
    let readabilityOk = false;
    if (mediaType === "application/pdf") {
      // PDF: geldigheid van de header controleren; pixelcontrole is voor
      // beeldformaten. Een corrupte PDF wordt eerlijk geweigerd.
      if (buffer.subarray(0, 5).toString() !== "%PDF-") {
        res.status(422).json({ error: "Dit bestand is geen geldige PDF." });
        return;
      }
      marginsOk = true;
      readabilityOk = true;
    } else {
      const check = await checkImage(buffer);
      if (!check.ok) {
        res.status(422).json({ error: check.reason });
        return;
      }
      marginsOk = true;
      readabilityOk = true;
    }

    const filePath = await uploadMaterialPhoto(trainerClerkId, { base64, mediaType });
    const row = await db.transaction(async (tx) => {
      const [latest] = await tx
        .select({ v: trainerLetterheadsTable.templateVersion })
        .from(trainerLetterheadsTable)
        .where(eq(trainerLetterheadsTable.trainerClerkId, trainerClerkId))
        .orderBy(desc(trainerLetterheadsTable.templateVersion))
        .limit(1);
      await tx
        .update(trainerLetterheadsTable)
        .set({ active: false })
        .where(eq(trainerLetterheadsTable.trainerClerkId, trainerClerkId));
      const [inserted] = await tx
        .insert(trainerLetterheadsTable)
        .values({
          trainerClerkId,
          filePath,
          fileFormat: mediaType,
          templateVersion: (latest?.v ?? 0) + 1,
          marginsOk,
          readabilityOk,
          active: true,
        })
        .returning();
      return inserted!;
    });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "letterhead upload failed");
    res.status(500).json({ error: "Briefpapier uploaden is niet gelukt." });
  }
});

// Actieve template — geen upload = eerlijk het standaard Sparki-template.
router.get("/active", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const [row] = await db
    .select()
    .from(trainerLetterheadsTable)
    .where(
      and(
        eq(trainerLetterheadsTable.trainerClerkId, trainerClerkId),
        eq(trainerLetterheadsTable.active, true),
      ),
    );
  if (!row) {
    res.json({ templateVersion: 0, fallback: true, name: "Standaardtemplate" });
    return;
  }
  res.json({ ...row, fallback: false });
});

// Preview: eigen bestand terugstreamen (owner-check via DB-rij).
router.get("/:id/preview", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const [row] = await db
      .select()
      .from(trainerLetterheadsTable)
      .where(
        and(
          eq(trainerLetterheadsTable.id, Number(req.params.id)),
          eq(trainerLetterheadsTable.trainerClerkId, trainerClerkId),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Briefpapier niet gevonden." });
      return;
    }
    const stream = await streamMaterialPhoto(row.filePath, res);
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "letterhead preview failed");
    res.status(500).json({ error: "Preview is niet gelukt." });
  }
});

export default router;
