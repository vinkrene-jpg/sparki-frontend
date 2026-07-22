import { Router, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  db,
  racesTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  journeyItemsTable,
  journeyMediaTable,
  journeyReflectionsTable,
  athleteProfilesTable,
  JOURNEY_ITEM_KINDS,
  JOURNEY_MEDIA_SUBJECTS,
  JOURNEY_MEDIA_VISIBILITY,
  JOURNEY_LINK_MODES,
  type JourneyItemKind,
  type JourneyMediaSubject,
  type JourneyMediaVisibility,
  type JourneyLinkMode,
} from "@workspace/db";
import {
  composeJourney,
  resolveLinkedActivity,
  collectRaceMedia,
  buildShareCard,
  SHARE_CARD_FIELDS,
  type ShareCardField,
  type JourneyEventKind,
} from "../lib/journey";
import { buildRaceContext } from "../engines/race";
import { computeAge } from "../lib/age";
import { ObjectStorageService } from "../lib/objectStorage";

// Journey — één persoonlijke tijdlijn + wedstrijddossier, samengesteld uit
// bestaande data. Geen parallel archief: dit registreert alleen wat nergens
// anders bestaat (mijlpalen, media-koppeling, terugblik, link-correctie).

const router = Router();
const objectStorage = new ObjectStorageService();

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

async function isMinor(clerkId: string): Promise<boolean> {
  const [p] = await db
    .select({
      birthDate: athleteProfilesTable.birthDate,
      birthYear: athleteProfilesTable.birthYear,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const age = computeAge(p?.birthDate ?? null, p?.birthYear ?? null);
  // Fail-closed: onbekende leeftijd behandelen we als minderjarig — delen
  // vereist dan eerst een geboortedatum in het profiel.
  return age == null || age < 18;
}

// Eigendomscheck voor een media-onderwerp. Journey-items en races moeten van
// de gebruiker zijn; sessies ook. Retourneert false bij vreemd/afwezig id.
async function ownsSubject(
  clerkId: string,
  subjectType: JourneyMediaSubject,
  subjectId: number,
): Promise<boolean> {
  if (!Number.isInteger(subjectId) || subjectId <= 0) return false;
  if (subjectType === "race") {
    const [r] = await db
      .select({ id: racesTable.id })
      .from(racesTable)
      .where(and(eq(racesTable.id, subjectId), eq(racesTable.clerkId, clerkId)))
      .limit(1);
    return !!r;
  }
  if (subjectType === "session") {
    const [s] = await db
      .select({ id: trainingSessionsTable.id })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.id, subjectId),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    return !!s;
  }
  const [it] = await db
    .select({ id: journeyItemsTable.id })
    .from(journeyItemsTable)
    .where(
      and(
        eq(journeyItemsTable.id, subjectId),
        eq(journeyItemsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  return !!it;
}

// ── Tijdlijn ─────────────────────────────────────────────────────────────────

// GET /api/journey?kinds=wedstrijd,record&limit=80
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const kindsRaw = str(req.query.kinds as unknown);
    const kinds = kindsRaw
      ? (kindsRaw.split(",").filter(Boolean) as JourneyEventKind[])
      : undefined;
    const limit = Number(req.query.limit) || undefined;
    const timeline = await composeJourney(clerkId, { kinds, limit });
    res.json(timeline);
  } catch (err) {
    req.log.error({ err }, "journey.timeline failed");
    res.status(500).json({ error: "Journey ophalen mislukt" });
  }
});

// ── Wedstrijddossier ─────────────────────────────────────────────────────────

// GET /api/journey/race/:raceId — het volledige dossier van één wedstrijd.
router.get("/race/:raceId", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  if (!Number.isInteger(raceId) || raceId <= 0) {
    res.status(400).json({ error: "Ongeldige wedstrijd" });
    return;
  }
  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)))
      .limit(1);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }

    const [reflectionRow] = await db
      .select()
      .from(journeyReflectionsTable)
      .where(
        and(
          eq(journeyReflectionsTable.clerkId, clerkId),
          eq(journeyReflectionsTable.raceId, raceId),
        ),
      )
      .limit(1);
    const reflection = reflectionRow ?? null;

    const [athleteProfile] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);

    const [activity, media, context, taper] = await Promise.all([
      resolveLinkedActivity(race, reflection),
      collectRaceMedia(clerkId, raceId),
      buildRaceContext(race, athleteProfile ?? null).catch(() => null),
      // Geplande trainingen in de 14 dagen vóór de wedstrijd (taper/opbouw).
      (async () => {
        const from = new Date(`${race.raceDate}T00:00:00`);
        from.setDate(from.getDate() - 14);
        const fromYmd = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
        const rows = await db
          .select({
            id: plannedWorkoutsTable.id,
            scheduledDate: plannedWorkoutsTable.scheduledDate,
            title: plannedWorkoutsTable.title,
            type: plannedWorkoutsTable.type,
            targetDurationMin: plannedWorkoutsTable.targetDurationMin,
            status: plannedWorkoutsTable.status,
            source: plannedWorkoutsTable.source,
          })
          .from(plannedWorkoutsTable)
          .where(eq(plannedWorkoutsTable.clerkId, clerkId));
        return rows
          .filter(
            (w) =>
              String(w.scheduledDate) >= fromYmd &&
              String(w.scheduledDate) <= String(race.raceDate),
          )
          .sort((a, b) =>
            String(a.scheduledDate) < String(b.scheduledDate) ? -1 : 1,
          );
      })(),
    ]);

    res.json({
      race,
      reflection,
      activity,
      media,
      context,
      taper,
      shareFields: SHARE_CARD_FIELDS,
    });
  } catch (err) {
    req.log.error({ err }, "journey.dossier failed");
    res.status(500).json({ error: "Dossier ophalen mislukt" });
  }
});

// PUT /api/journey/race/:raceId/reflection — terugblik / les / vervolgactie.
router.put(
  "/race/:raceId/reflection",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const raceId = Number(String(req.params.raceId));
    if (!(await ownsSubject(clerkId, "race", raceId))) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const reflection = str(body.reflection);
    const lesson = str(body.lesson);
    const nextAction = str(body.nextAction);
    try {
      const [row] = await db
        .insert(journeyReflectionsTable)
        .values({ clerkId, raceId, reflection, lesson, nextAction })
        .onConflictDoUpdate({
          target: [journeyReflectionsTable.clerkId, journeyReflectionsTable.raceId],
          set: { reflection, lesson, nextAction, updatedAt: new Date() },
        })
        .returning();
      res.json({ reflection: row });
    } catch (err) {
      req.log.error({ err }, "journey.reflection failed");
      res.status(500).json({ error: "Terugblik opslaan mislukt" });
    }
  },
);

// PUT /api/journey/race/:raceId/link — corrigeer de activiteit-koppeling.
// Body: { mode: "auto" | "manual" | "none", sessionId? }
router.put(
  "/race/:raceId/link",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const raceId = Number(String(req.params.raceId));
    if (!(await ownsSubject(clerkId, "race", raceId))) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const mode = str(body.mode) as JourneyLinkMode | null;
    if (!mode || !JOURNEY_LINK_MODES.includes(mode)) {
      res.status(400).json({ error: "Ongeldige koppelkeuze" });
      return;
    }
    let sessionId: number | null = null;
    if (mode === "manual") {
      sessionId = Number(body.sessionId);
      if (!(await ownsSubject(clerkId, "session", sessionId))) {
        res.status(404).json({ error: "Activiteit niet gevonden" });
        return;
      }
    }
    try {
      const [row] = await db
        .insert(journeyReflectionsTable)
        .values({ clerkId, raceId, linkMode: mode, linkedSessionId: sessionId })
        .onConflictDoUpdate({
          target: [journeyReflectionsTable.clerkId, journeyReflectionsTable.raceId],
          set: { linkMode: mode, linkedSessionId: sessionId, updatedAt: new Date() },
        })
        .returning();
      const [race] = await db
        .select()
        .from(racesTable)
        .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)))
        .limit(1);
      const activity = await resolveLinkedActivity(race!, row);
      res.json({ reflection: row, activity });
    } catch (err) {
      req.log.error({ err }, "journey.link failed");
      res.status(500).json({ error: "Koppeling opslaan mislukt" });
    }
  },
);

// POST /api/journey/race/:raceId/share-card — deelkaart met UITSLUITEND door
// de gebruiker geselecteerde velden en media. Geen publieke opslag; de kaart
// wordt aan de eigenaar teruggegeven die zelf kiest hoe te delen.
router.post(
  "/race/:raceId/share-card",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const raceId = Number(String(req.params.raceId));
    const body = req.body as Record<string, unknown>;
    try {
      const [race] = await db
        .select()
        .from(racesTable)
        .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)))
        .limit(1);
      if (!race) {
        res.status(404).json({ error: "Wedstrijd niet gevonden" });
        return;
      }
      const fields = (Array.isArray(body.fields) ? body.fields : []).filter(
        (f): f is ShareCardField =>
          typeof f === "string" &&
          (SHARE_CARD_FIELDS as readonly string[]).includes(f),
      );
      if (fields.length === 0) {
        res.status(400).json({ error: "Kies eerst wat je wilt delen" });
        return;
      }
      const mediaIds = (Array.isArray(body.mediaIds) ? body.mediaIds : [])
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
      // Beleid wordt SERVER-SIDE afgedwongen: alleen media die expliciet op
      // "gedeeld" staan mogen op de kaart. Privé-media in het verzoek is een
      // harde fout — nooit stilletjes wegfilteren en toch iets teruggeven.
      const media =
        mediaIds.length === 0
          ? []
          : await db
              .select()
              .from(journeyMediaTable)
              .where(
                and(
                  eq(journeyMediaTable.clerkId, clerkId),
                  eq(journeyMediaTable.subjectType, "race"),
                  eq(journeyMediaTable.subjectId, raceId),
                  eq(journeyMediaTable.visibility, "gedeeld"),
                  inArray(journeyMediaTable.id, mediaIds),
                ),
              );
      if (media.length !== mediaIds.length) {
        res.status(400).json({
          error:
            "Eén of meer gekozen foto's staan niet op 'Deelbaar'. Zet ze eerst op deelbaar of laat ze weg.",
        });
        return;
      }
      const [reflectionRow] = await db
        .select()
        .from(journeyReflectionsTable)
        .where(
          and(
            eq(journeyReflectionsTable.clerkId, clerkId),
            eq(journeyReflectionsTable.raceId, raceId),
          ),
        )
        .limit(1);
      res.json(buildShareCard(race, reflectionRow ?? null, fields, media));
    } catch (err) {
      req.log.error({ err }, "journey.share-card failed");
      res.status(500).json({ error: "Deelkaart maken mislukt" });
    }
  },
);

// ── Handmatige mijlpalen / kampen / herstelperiodes ─────────────────────────

router.post("/items", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as Record<string, unknown>;
  const kind = str(body.kind) as JourneyItemKind | null;
  const title = str(body.title);
  const startDate = str(body.startDate);
  const endDate = str(body.endDate);
  if (!kind || !JOURNEY_ITEM_KINDS.includes(kind)) {
    res.status(400).json({ error: "Ongeldig soort gebeurtenis" });
    return;
  }
  if (!title || !startDate || !isYmd(startDate) || (endDate && !isYmd(endDate))) {
    res.status(400).json({ error: "Titel en een geldige datum zijn verplicht" });
    return;
  }
  try {
    const [row] = await db
      .insert(journeyItemsTable)
      .values({
        clerkId,
        kind,
        title,
        description: str(body.description),
        startDate,
        endDate: endDate ?? null,
      })
      .returning();
    res.status(201).json({ item: row });
  } catch (err) {
    req.log.error({ err }, "journey.item-create failed");
    res.status(500).json({ error: "Gebeurtenis opslaan mislukt" });
  }
});

router.delete(
  "/items/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const id = Number(String(req.params.id));
    try {
      const deleted = await db
        .delete(journeyItemsTable)
        .where(
          and(eq(journeyItemsTable.id, id), eq(journeyItemsTable.clerkId, clerkId)),
        )
        .returning({ id: journeyItemsTable.id });
      if (deleted.length === 0) {
        res.status(404).json({ error: "Gebeurtenis niet gevonden" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "journey.item-delete failed");
      res.status(500).json({ error: "Verwijderen mislukt" });
    }
  },
);

// ── Media ────────────────────────────────────────────────────────────────────

// POST /api/journey/media — registreer een echte upload (presign-flow) bij een
// Journey-onderwerp. ACL wordt hier gezet, NA de upload van de bytes.
router.post("/media", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as Record<string, unknown>;
  const subjectType = str(body.subjectType) as JourneyMediaSubject | null;
  const subjectId = Number(body.subjectId);
  const objectPath = str(body.objectPath);
  const mediaType = (str(body.mediaType) ?? "").toLowerCase();
  if (!subjectType || !JOURNEY_MEDIA_SUBJECTS.includes(subjectType)) {
    res.status(400).json({ error: "Ongeldig onderwerp" });
    return;
  }
  if (!objectPath || !objectPath.startsWith("/objects/")) {
    res.status(400).json({ error: "Ongeldig bestandspad" });
    return;
  }
  if (!MEDIA_TYPES.includes(mediaType)) {
    res.status(400).json({ error: "Dit bestandstype wordt niet ondersteund." });
    return;
  }
  if (!(await ownsSubject(clerkId, subjectType, subjectId))) {
    res.status(404).json({ error: "Onderwerp niet gevonden" });
    return;
  }
  try {
    try {
      await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
        owner: clerkId,
        visibility: "private",
      });
    } catch (err) {
      req.log.error({ err }, "journey.media acl failed");
      res.status(400).json({
        error: "Het bestand is nog niet geüpload. Probeer het opnieuw.",
      });
      return;
    }
    const existing = await db
      .select({ sortIndex: journeyMediaTable.sortIndex })
      .from(journeyMediaTable)
      .where(
        and(
          eq(journeyMediaTable.clerkId, clerkId),
          eq(journeyMediaTable.subjectType, subjectType),
          eq(journeyMediaTable.subjectId, subjectId),
        ),
      );
    const nextIndex =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((m) => m.sortIndex)) + 1;
    const [row] = await db
      .insert(journeyMediaTable)
      .values({
        clerkId,
        subjectType,
        subjectId,
        objectPath,
        mediaType,
        caption: str(body.caption),
        sortIndex: nextIndex,
        visibility: "prive",
      })
      .returning();
    res.status(201).json({ media: row });
  } catch (err) {
    req.log.error({ err }, "journey.media-create failed");
    res.status(500).json({ error: "Media opslaan mislukt" });
  }
});

// PUT /api/journey/media/order — volgorde in één keer vastleggen.
router.put(
  "/media/order",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const ids = (Array.isArray((req.body as any).ids) ? (req.body as any).ids : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      res.status(400).json({ error: "Geen volgorde ontvangen" });
      return;
    }
    try {
      for (let i = 0; i < ids.length; i++) {
        await db
          .update(journeyMediaTable)
          .set({ sortIndex: i, updatedAt: new Date() })
          .where(
            and(
              eq(journeyMediaTable.id, ids[i]!),
              eq(journeyMediaTable.clerkId, clerkId),
            ),
          );
      }
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "journey.media-order failed");
      res.status(500).json({ error: "Volgorde opslaan mislukt" });
    }
  },
);

// PUT /api/journey/media/:id — onderschrift of zichtbaarheid aanpassen.
router.put("/media/:id", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const body = req.body as Record<string, unknown>;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if ("caption" in body) set.caption = str(body.caption);
  if ("visibility" in body) {
    const visibility = str(body.visibility) as JourneyMediaVisibility | null;
    if (!visibility || !JOURNEY_MEDIA_VISIBILITY.includes(visibility)) {
      res.status(400).json({ error: "Ongeldige zichtbaarheid" });
      return;
    }
    if (visibility === "gedeeld" && (await isMinor(clerkId))) {
      res.status(403).json({
        error:
          "Delen is niet beschikbaar voor renners onder de 18. Je media blijven privé.",
      });
      return;
    }
    set.visibility = visibility;
  }
  try {
    const [row] = await db
      .update(journeyMediaTable)
      .set(set)
      .where(
        and(eq(journeyMediaTable.id, id), eq(journeyMediaTable.clerkId, clerkId)),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Media niet gevonden" });
      return;
    }
    res.json({ media: row });
  } catch (err) {
    req.log.error({ err }, "journey.media-update failed");
    res.status(500).json({ error: "Media bijwerken mislukt" });
  }
});

router.delete(
  "/media/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const id = Number(String(req.params.id));
    try {
      const deleted = await db
        .delete(journeyMediaTable)
        .where(
          and(
            eq(journeyMediaTable.id, id),
            eq(journeyMediaTable.clerkId, clerkId),
          ),
        )
        .returning({ id: journeyMediaTable.id });
      if (deleted.length === 0) {
        res.status(404).json({ error: "Media niet gevonden" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "journey.media-delete failed");
      res.status(500).json({ error: "Verwijderen mislukt" });
    }
  },
);

export default router;
