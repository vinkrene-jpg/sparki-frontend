// SPARKI_BUILD_01 F1 — /consent — centrale toestemmingsservice (API §5).
//
// Rechten en scope worden server-side bepaald: de subject zelf, of een
// geaccepteerde ouder/verzorger van de subject. Alles daarbuiten: 403,
// fail-closed (BB-10).

import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, parentAthleteLinksTable, consentGrantTypes } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  ConsentDeniedError,
  getConsentOverview,
  grantConsent,
  revokeConsent,
} from "../lib/consent-service";
import { consentSourceFromRequest } from "../lib/consent";

const router = Router();

async function mayViewSubject(actor: string, subject: string): Promise<boolean> {
  if (actor === subject) return true;
  const [row] = await db
    .select({ status: parentAthleteLinksTable.status })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, actor),
        eq(parentAthleteLinksTable.athleteClerkId, subject),
        // BB-09: beëindigde ouderrelatie = geen inzage meer.
        isNull(parentAthleteLinksTable.endedAt),
      ),
    );
  return row?.status === "accepted";
}

// GET /consent/:user — statussen, geldigheid, herbevestigingsdatum.
router.get("/:user", requireAuth, async (req, res) => {
  const actor = getClerkUserId(req)!;
  const subject = String(req.params.user);
  try {
    if (!(await mayViewSubject(actor, subject))) {
      res.status(403).json({ error: "Geen inzage in deze toestemmingen" });
      return;
    }
    res.json({ consent: await getConsentOverview(subject) });
  } catch (err) {
    req.log.error({ err }, "consent.get failed");
    res.status(500).json({ error: "Toestemmingen laden mislukt" });
  }
});

// POST /consent/grant — uitsluitend door een bevoegde grantor; weigert een
// minderjarige die zichzelf toestemming geeft (BB-03), server-side, gelogd.
router.post("/grant", requireAuth, async (req, res) => {
  const grantor = getClerkUserId(req)!;
  const body = req.body as Record<string, unknown>;
  const subject = typeof body.subjectClerkId === "string" ? body.subjectClerkId : null;
  const type = typeof body.type === "string" ? body.type : null;
  if (!subject || !type || !(consentGrantTypes as readonly string[]).includes(type)) {
    res.status(400).json({ error: "subjectClerkId en geldig type zijn verplicht" });
    return;
  }
  const validUntil =
    typeof body.validUntil === "string" && !Number.isNaN(Date.parse(body.validUntil))
      ? new Date(body.validUntil)
      : null;
  try {
    const grant = await grantConsent({
      subjectClerkId: subject,
      grantorClerkId: grantor,
      type: type as (typeof consentGrantTypes)[number],
      legalBasis: typeof body.legalBasis === "string" ? body.legalBasis : null,
      source: consentSourceFromRequest(req.header("x-sparki-platform") ?? undefined),
      validUntil,
    });
    res.json({ grant: { id: grant.id, type: grant.type, status: grant.status } });
  } catch (err) {
    if (err instanceof ConsentDeniedError) {
      res.status(403).json({ error: err.message, code: err.code });
      return;
    }
    req.log.error({ err }, "consent.grant failed");
    res.status(500).json({ error: "Toestemming vastleggen mislukt" });
  }
});

// POST /consent/revoke — werkt onmiddellijk vooruit.
router.post("/revoke", requireAuth, async (req, res) => {
  const actor = getClerkUserId(req)!;
  const grantId = Number((req.body as Record<string, unknown>).grantId);
  if (!Number.isInteger(grantId) || grantId <= 0) {
    res.status(400).json({ error: "grantId is verplicht" });
    return;
  }
  try {
    const grant = await revokeConsent({ grantId, actorClerkId: actor });
    res.json({ grant: { id: grant.id, type: grant.type, status: grant.status } });
  } catch (err) {
    if (err instanceof ConsentDeniedError) {
      const code = err.code === "not_found" ? 404 : 403;
      res.status(code).json({ error: err.message, code: err.code });
      return;
    }
    req.log.error({ err }, "consent.revoke failed");
    res.status(500).json({ error: "Toestemming intrekken mislukt" });
  }
});

export default router;
