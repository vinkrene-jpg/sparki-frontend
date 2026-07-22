// Juridische documenten (privacyverklaring, gebruiksvoorwaarden) + acceptatie
// met versie en datum. De documenten zelf zijn publiek leesbaar; accepteren
// vereist een ingelogde gebruiker.

import { Router } from "express";
import { db, privacySettingsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getActiveLegalDocument } from "../lib/legal-texts";
import { writeAudit } from "../lib/security/audit";

const router = Router();

router.get("/:kind", async (req, res) => {
  const kind = String(req.params.kind);
  if (kind !== "privacy" && kind !== "terms") {
    res.status(404).json({ error: "Onbekend document" });
    return;
  }
  try {
    const doc = await getActiveLegalDocument(kind);
    res.json({
      kind: doc.kind,
      version: doc.version,
      title: doc.title,
      bodyMd: doc.bodyMd,
      publishedAt: doc.publishedAt,
    });
  } catch (err) {
    req.log.error({ err }, "legal.get failed");
    res.status(500).json({ error: "Document kon niet geladen worden." });
  }
});

// POST /api/legal/:kind/accept — leg akkoord vast met versie + datum.
router.post("/:kind/accept", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const kind = String(req.params.kind);
  if (kind !== "privacy" && kind !== "terms") {
    res.status(404).json({ error: "Onbekend document" });
    return;
  }
  try {
    const doc = await getActiveLegalDocument(kind);
    const now = new Date();
    const set =
      kind === "privacy"
        ? { acceptedPrivacyAt: now, acceptedPrivacyVersion: doc.version }
        : { acceptedTermsAt: now, acceptedTermsVersion: doc.version };
    await db
      .insert(privacySettingsTable)
      .values({ clerkId, ...set, updatedAt: now })
      .onConflictDoUpdate({
        target: privacySettingsTable.clerkId,
        set: { ...set, updatedAt: now },
      });
    await writeAudit({
      event: "consent_change",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      meta: { document: kind, version: doc.version, actie: "geaccepteerd" },
      req,
    });
    res.json({ ok: true, version: doc.version, acceptedAt: now });
  } catch (err) {
    req.log.error({ err }, "legal.accept failed");
    res.status(500).json({ error: "Akkoord kon niet worden vastgelegd." });
  }
});

export default router;
