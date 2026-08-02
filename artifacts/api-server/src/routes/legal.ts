// Juridische documenten (gebruiksvoorwaarden, privacyverklaring, gezondheids-
// en trainingsdisclaimer) + verplichte acceptatie met versie, datum en bron.
// De documenten zelf zijn publiek leesbaar (nodig vóór akkoord); status,
// accepteren en intrekken vereisen een ingelogde gebruiker.

import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  legalAcceptancesTable,
  privacySettingsTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getActiveLegalDocument, isRequiredLegalKind } from "../lib/legal-texts";
import { getConsentStatus, consentSourceFromRequest } from "../lib/consent";
import { writeAudit } from "../lib/security/audit";

const router = Router();

// GET /api/legal/status — acceptatiestatus per verplicht document.
// Web, mobiel en PWA gebruiken allemaal déze server-side status; er is geen
// client-side waarheid. Vóór /:kind gemount zodat "status" nooit als
// documentsoort wordt gelezen.
router.get("/status", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const status = await getConsentStatus(clerkId);
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "legal.status failed");
    res.status(500).json({ error: "Status kon niet geladen worden." });
  }
});

router.get("/:kind", async (req, res) => {
  const kind = String(req.params.kind);
  if (!isRequiredLegalKind(kind)) {
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

// POST /api/legal/:kind/accept — leg akkoord vast als bewijsrij in
// legal_acceptances (gebruiker + document + versie + datum + bron). De oude
// privacy_settings-velden blijven voor privacy/terms gevuld (compatibiliteit),
// maar de gate leest uitsluitend legal_acceptances.
router.post("/:kind/accept", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const kind = String(req.params.kind);
  if (!isRequiredLegalKind(kind)) {
    res.status(404).json({ error: "Onbekend document" });
    return;
  }
  try {
    const doc = await getActiveLegalDocument(kind);
    const now = new Date();
    const source = consentSourceFromRequest(
      req.get("x-sparki-platform") ?? undefined,
    );

    // Idempotent per versie, race-veilig op DB-niveau: de partiële unieke
    // index legal_acceptances_active_unique_idx (clerk_id, kind, version
    // WHERE revoked_at IS NULL) garandeert hooguit één actieve bewijsrij;
    // gelijktijdige accepts botsen op de index en worden genegeerd.
    await db
      .insert(legalAcceptancesTable)
      .values({
        clerkId,
        kind,
        version: doc.version,
        acceptedAt: now,
        source,
      })
      .onConflictDoNothing({
        target: [
          legalAcceptancesTable.clerkId,
          legalAcceptancesTable.kind,
          legalAcceptancesTable.version,
        ],
        where: isNull(legalAcceptancesTable.revokedAt),
      });

    // Compat-schrijfactie naar privacy_settings kan alleen als er al een
    // profielrij bestaat (FK). Een gloednieuw account accepteert de documenten
    // vóór onboarding en heeft die rij nog niet — dan slaan we de compat-copy
    // over; de gate leest toch uitsluitend legal_acceptances.
    const [bestaandProfiel] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId))
      .limit(1);
    if (bestaandProfiel && (kind === "privacy" || kind === "terms")) {
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
    }

    await writeAudit({
      event: "consent_change",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      meta: { document: kind, version: doc.version, actie: "geaccepteerd", bron: source },
      req,
    });
    res.json({ ok: true, version: doc.version, acceptedAt: now });
  } catch (err) {
    req.log.error({ err }, "legal.accept failed");
    res.status(500).json({ error: "Akkoord kon niet worden vastgelegd." });
  }
});

// POST /api/legal/:kind/revoke — trek een eerder akkoord in. De bewijsrij
// blijft bestaan (revoked_at gezet); vanaf dat moment is het document niet
// meer geaccepteerd en sluit de toegangspoort weer.
router.post("/:kind/revoke", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const kind = String(req.params.kind);
  if (!isRequiredLegalKind(kind)) {
    res.status(404).json({ error: "Onbekend document" });
    return;
  }
  try {
    const now = new Date();
    const [newest] = await db
      .select({ id: legalAcceptancesTable.id, version: legalAcceptancesTable.version })
      .from(legalAcceptancesTable)
      .where(
        and(
          eq(legalAcceptancesTable.clerkId, clerkId),
          eq(legalAcceptancesTable.kind, kind),
          isNull(legalAcceptancesTable.revokedAt),
        ),
      )
      .orderBy(desc(legalAcceptancesTable.acceptedAt))
      .limit(1);
    if (!newest) {
      res.status(404).json({ error: "Geen actief akkoord om in te trekken." });
      return;
    }
    await db
      .update(legalAcceptancesTable)
      .set({ revokedAt: now })
      .where(
        and(
          eq(legalAcceptancesTable.clerkId, clerkId),
          eq(legalAcceptancesTable.kind, kind),
          isNull(legalAcceptancesTable.revokedAt),
        ),
      );
    await writeAudit({
      event: "consent_change",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      meta: { document: kind, version: newest.version, actie: "ingetrokken" },
      req,
    });
    res.json({ ok: true, revokedAt: now });
  } catch (err) {
    req.log.error({ err }, "legal.revoke failed");
    res.status(500).json({ error: "Intrekken kon niet worden vastgelegd." });
  }
});

export default router;
