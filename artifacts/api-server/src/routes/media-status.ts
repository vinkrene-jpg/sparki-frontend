import { Router } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, mediaContentStatusTable, athleteProfilesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { computeAge } from "../lib/age";

// MEDIA_UITLEG_01 F4 — gebruikersstatus en contentbinding (deel 3 §2 en §4).
//
// Vier statuscalls:
//   GET  /                       — status ophalen voor één of meer content-ID's (4.2)
//   POST /:contentId/offered     — "aangeboden" registreren, incl. D-3-versiewisselregel
//   PUT  /:contentId             — status bijwerken (4.3), met server-side D-1/D-2-weigering
//   POST /:contentId/event       — gebeurtenis melden, alleen het type (4.5)
//
// Contentbinding gebeurt uitsluitend op content_id + content_version; deze laag
// bewaart géén content (KENNIS_01 is eigenaar) en beslist niet over rechten.
const router = Router();

const STATES = [
  "aangeboden",
  "gestart",
  "bekeken",
  "voltooid",
  "overgeslagen",
  "uitgesteld",
  "opnieuw_geopend",
] as const;
type State = (typeof STATES)[number];

const EVENT_TYPES = [
  "weergave_gestart",
  "weergave_voltooid",
  "tekstvariant_geopend",
  "ondertiteling_aan",
  "ondertiteling_uit",
  "snelheid_gewijzigd",
  "aanbod_geweigerd",
] as const;

// D-1: acute meldingen mogen nooit "niet meer tonen" krijgen. Zolang het
// contentmodel (O-1) er niet is, is de deterministische serverregel: elk
// content-ID met het voorvoegsel "acuut:" is acuut. Deze regel staat hier —
// server-side — zodat een client er nooit omheen kan.
function isAcuteContent(contentId: string): boolean {
  return contentId.startsWith("acuut:");
}

// D-2 fail-closed: onbekende leeftijd telt als minderjarig.
async function isMinorOrUnknown(clerkId: string): Promise<boolean> {
  const rows = await db
    .select({
      birthDate: athleteProfilesTable.birthDate,
      birthYear: athleteProfilesTable.birthYear,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const age = computeAge(rows[0]?.birthDate ?? null, rows[0]?.birthYear ?? null);
  return age === null || age < 18;
}

function parseVersion(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return null;
  return v;
}

// 4.2 — status ophalen. Eén call per scherm: ?ids=a,b,c
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Niet ingelogd." });
  const idsRaw = String(req.query.ids ?? "").trim();
  if (!idsRaw) return res.status(400).json({ error: "ids ontbreekt." });
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
  try {
    const rows = await db
      .select()
      .from(mediaContentStatusTable)
      .where(
        and(
          eq(mediaContentStatusTable.clerkId, clerkId),
          inArray(mediaContentStatusTable.contentId, ids),
        ),
      );
    return res.json({ statuses: rows });
  } catch (err) {
    req.log?.error({ err }, "media-status: lezen mislukt");
    return res.status(500).json({ error: "Status kon niet worden gelezen." });
  }
});

// "Aangeboden" registreren. D-3: bij een nieuwe contentversie is hoogstens één
// her-aanbod toegestaan; dit endpoint antwoordt eerlijk of aanbieden mag.
router.post("/:contentId/offered", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Niet ingelogd." });
  const contentId = String(req.params.contentId);
  const version = parseVersion((req.body as Record<string, unknown>)?.contentVersion);
  if (!version) return res.status(400).json({ error: "contentVersion moet een positief geheel getal zijn." });
  try {
    const now = new Date();
    // Atomair (D-3 ook onder gelijktijdige verzoeken): eerste aanbod als
    // insert; bestaande rij alleen bijwerken wanneer dit écht een eerste
    // her-aanbod voor een NIEUWERE versie is en "niet meer tonen" het niet
    // blokkeert. De voorwaarde zit in de UPSERT zelf, dus twee gelijktijdige
    // calls kunnen nooit allebei een her-aanbod registreren.
    const updated = await db
      .insert(mediaContentStatusTable)
      .values({
        clerkId,
        contentId,
        contentVersion: version,
        state: "aangeboden",
        firstOfferedAt: now,
        lastReofferedVersion: version,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [mediaContentStatusTable.clerkId, mediaContentStatusTable.contentId],
        set: {
          contentVersion: version,
          state: "aangeboden",
          lastReofferedVersion: version,
          updatedAt: now,
          // D-4: firstOfferedAt blijft; alleen zetten als hij nog leeg was.
          firstOfferedAt: sql`COALESCE(${mediaContentStatusTable.firstOfferedAt}, ${now})`,
        },
        setWhere: sql`${mediaContentStatusTable.contentVersion} < ${version}
          AND COALESCE(${mediaContentStatusTable.lastReofferedVersion}, 0) < ${version}
          AND NOT ${mediaContentStatusTable.doNotShowAgain}`,
      })
      .returning();

    if (updated.length > 0) {
      const row = updated[0]!;
      // Her-aanbod = de rij bestond al (first_offered_at ouder dan deze call).
      const reoffer =
        row.firstOfferedAt != null && row.firstOfferedAt.getTime() < now.getTime();
      return res.json({ offered: true, reoffer });
    }

    // Niet aangeboden: lees de rij voor een eerlijke reden (informatief).
    const existing = (
      await db
        .select()
        .from(mediaContentStatusTable)
        .where(
          and(
            eq(mediaContentStatusTable.clerkId, clerkId),
            eq(mediaContentStatusTable.contentId, contentId),
          ),
        )
        .limit(1)
    )[0];
    if (!existing) {
      // Race met een verwijdering; eerlijk melden.
      return res.status(409).json({ error: "Aanbod kon niet worden vastgelegd, probeer opnieuw." });
    }
    if (existing.doNotShowAgain) {
      return res.json({ offered: false, reason: "niet_meer_tonen" });
    }
    if (version > existing.contentVersion && (existing.lastReofferedVersion ?? 0) >= version) {
      return res.json({ offered: false, reason: "al_opnieuw_aangeboden" });
    }
    return res.json({ offered: false, reason: "al_bekend" });
  } catch (err) {
    req.log?.error({ err }, "media-status: aanbod registreren mislukt");
    return res.status(500).json({ error: "Aanbod kon niet worden geregistreerd." });
  }
});

// 4.3 — status bijwerken.
router.put("/:contentId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Niet ingelogd." });
  const contentId = String(req.params.contentId);

  const body = req.body as Record<string, unknown> | null | undefined;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return res.status(400).json({ error: "Ongeldige status." });
  }
  const allowed = ["contentVersion", "state", "lastPositionSeconds", "playbackSpeed", "doNotShowAgain", "dismissedUntil"];
  const unknownKeys = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknownKeys.length > 0) {
    return res.status(400).json({ error: `Onbekende velden: ${unknownKeys.join(", ")}` });
  }
  const version = parseVersion(body.contentVersion);
  if (!version) return res.status(400).json({ error: "contentVersion moet een positief geheel getal zijn." });
  const state = body.state as State;
  if (!STATES.includes(state)) return res.status(400).json({ error: "Ongeldige toestand." });
  if (body.lastPositionSeconds !== undefined && (typeof body.lastPositionSeconds !== "number" || body.lastPositionSeconds < 0)) {
    return res.status(400).json({ error: "lastPositionSeconds moet een niet-negatief getal zijn." });
  }
  if (body.playbackSpeed !== undefined && body.playbackSpeed !== 1 && body.playbackSpeed !== 0.5) {
    return res.status(400).json({ error: "playbackSpeed is 1 of 0.5." });
  }
  let dismissedUntil: Date | undefined;
  if (body.dismissedUntil !== undefined) {
    const d = new Date(String(body.dismissedUntil));
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "dismissedUntil is geen geldige datum." });
    dismissedUntil = d;
  }

  // D-1/D-2: server-side weigering van do_not_show_again, gelogd (metadata-only).
  if (body.doNotShowAgain === true) {
    if (isAcuteContent(contentId)) {
      req.log?.warn({ contentId, reason: "acute_melding" }, "media-status: do_not_show_again geweigerd");
      return res.status(403).json({ error: "Niet meer tonen is niet toegestaan voor acute meldingen." });
    }
    if (await isMinorOrUnknown(clerkId)) {
      req.log?.warn({ contentId, reason: "minderjarig_of_onbekend" }, "media-status: do_not_show_again geweigerd");
      return res.status(403).json({ error: "Niet meer tonen is niet beschikbaar voor jeugdaccounts." });
    }
  } else if (body.doNotShowAgain !== undefined && typeof body.doNotShowAgain !== "boolean") {
    return res.status(400).json({ error: "doNotShowAgain moet true of false zijn." });
  }

  // Versies zijn monotoon: een verouderde client mag een rij nooit terugzetten
  // naar een lagere contentversie (dat zou de aanbod-statusmachine corrumperen).
  const now = new Date();
  const stamps: Partial<{
    startedAt: Date;
    completedAt: Date;
    skippedAt: Date;
  }> = {};
  if (state === "gestart" || state === "opnieuw_geopend") stamps.startedAt = now;
  if (state === "voltooid") stamps.completedAt = now;
  if (state === "overgeslagen") stamps.skippedAt = now;

  try {
    const result = await db
      .insert(mediaContentStatusTable)
      .values({
        clerkId,
        contentId,
        contentVersion: version,
        state,
        firstOfferedAt: state === "aangeboden" ? now : null,
        lastPositionSeconds: (body.lastPositionSeconds as number | undefined) ?? null,
        playbackSpeed: (body.playbackSpeed as number | undefined) ?? null,
        doNotShowAgain: body.doNotShowAgain === true,
        dismissedUntil: dismissedUntil ?? null,
        ...stamps,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [mediaContentStatusTable.clerkId, mediaContentStatusTable.contentId],
        set: {
          contentVersion: version,
          state,
          updatedAt: now,
          ...stamps,
          ...(body.lastPositionSeconds !== undefined
            ? { lastPositionSeconds: body.lastPositionSeconds as number }
            : {}),
          ...(body.playbackSpeed !== undefined
            ? { playbackSpeed: body.playbackSpeed as number }
            : {}),
          ...(body.doNotShowAgain !== undefined
            ? { doNotShowAgain: body.doNotShowAgain === true }
            : {}),
          ...(dismissedUntil !== undefined ? { dismissedUntil } : {}),
          // D-4: first_offered_at wordt nooit gewist; alleen ingevuld als hij
          // nog leeg was en de nieuwe toestand "aangeboden" is.
          ...(state === "aangeboden"
            ? {
                firstOfferedAt: sql`COALESCE(${mediaContentStatusTable.firstOfferedAt}, ${now})`,
              }
            : {}),
        },
        // Versies zijn monotoon: een verouderde client mag nooit terugzetten
        // naar een lagere contentversie (corruptie van de aanbod-statusmachine).
        setWhere: sql`${mediaContentStatusTable.contentVersion} <= ${version}`,
      })
      .returning();
    if (result.length === 0) {
      return res.status(409).json({
        error: "Verouderde contentversie: de status hoort al bij een nieuwere versie.",
      });
    }
    return res.json({ status: result[0] });
  } catch (err) {
    req.log?.error({ err }, "media-status: opslaan mislukt");
    return res.status(500).json({ error: "Status kon niet worden opgeslagen." });
  }
});

// 4.5 — gebeurtenis melden: alleen het type, nooit inhoud.
router.post("/:contentId/event", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Niet ingelogd." });
  const contentId = String(req.params.contentId);
  const body = req.body as Record<string, unknown> | null | undefined;
  const eventType = String(body?.eventType ?? "");
  const version = parseVersion(body?.contentVersion);
  if (!EVENT_TYPES.includes(eventType as (typeof EVENT_TYPES)[number])) {
    return res.status(400).json({ error: "Onbekend gebeurtenistype." });
  }
  if (!version) return res.status(400).json({ error: "contentVersion moet een positief geheel getal zijn." });
  req.log?.info({ eventType, contentId, contentVersion: version }, "media-status: gebeurtenis");
  return res.json({ ok: true });
});

export default router;
