// Sparki World — veilige sociale laag (Golf 18).
//
// Kernprincipes (hard in de API):
//   - Referentie-delen: nooit een tweede kopie van inhoud; een item wijst naar
//     de bron. Bron weg ⇒ item wordt bij lezen "verwijderd" (self-heal).
//   - Veldselectie via whitelist; gezondheid/herstel/coachnotities zijn
//     structureel ondeelbaar (geen geldig veld of brontype).
//   - Minderjarig of onbekende leeftijd ⇒ openbaar delen geweigerd zonder
//     geldige oudertoestemming; openbaar vereist altijd expliciete bevestiging.
//   - Blokkade werkt direct, beide richtingen. Rapportage → moderatie door
//     admin; automatische detectie signaleert alleen ("sparki-signaal"),
//     verwijdert nooit zelf.
//   - Locatieprivacy wordt op LEESMOMENT toegepast; het origineel blijft heel.

import { Router, type Request, type Response } from "express";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  worldSharedItemsTable,
  worldReactionsTable,
  worldBlocksTable,
  worldReportsTable,
  worldNotificationPrefsTable,
  WORLD_SOURCE_TYPES,
  WORLD_VISIBILITY,
  WORLD_SHAREABLE_FIELDS,
  WORLD_MODERATION_ACTIONS,
  type WorldSourceType,
  type WorldVisibility,
  type WorldShareableField,
  type WorldSharedItem,
  trainingSessionsTable,
  activityImportsTable,
  racesTable,
  journeyItemsTable,
  journeyMediaTable,
  athleteProfilesTable,
  userProfilesTable,
  clubMembersTable,
  clubTeamMembersTable,
  clubGroupMembersTable,
  privacySettingsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";
import { writeAudit } from "../lib/security/audit";
import { createNotification } from "../lib/notifications";
import {
  getOwnerShareStatus,
  isBlockedEitherWay,
  listBlockedIds,
  relatedOwnerIds,
  viewerMaySeeItem,
} from "../lib/world-social/access";
import {
  applyLocationPrivacy,
  type TrackPoint,
} from "../lib/world-social/location";

const router = Router();

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

// ── Automatische detectie (signaleert alleen, verwijdert nooit) ─────────────
const SIGNAL_WORDS = [
  "kanker",
  "tering",
  "kutwijf",
  "klootzak",
  "mongool",
  "sukkel",
  "loser",
  "ik maak je",
  "ga dood",
  "zelfmoord",
  "doping",
  "epo",
];
async function autoSignal(text: string, targetType: "item" | "reactie", targetId: number): Promise<void> {
  const lower = text.toLowerCase();
  const hit = SIGNAL_WORDS.find((w) =>
    new RegExp(`(^|[^a-z])${w.replace(/ /g, "[^a-z]+")}([^a-z]|$)`).test(lower),
  );
  if (!hit) return;
  try {
    await db.insert(worldReportsTable).values({
      reporterClerkId: "sparki-signaal",
      targetType,
      targetId: String(targetId),
      reason: `Automatisch signaal: mogelijk kwetsende of onveilige taal ("${hit}"). Alleen ter beoordeling — niets is automatisch verwijderd.`,
    });
  } catch {
    // signaal mag een gebruikersactie nooit blokkeren
  }
}

// ── Bronvalidatie & presentatie ──────────────────────────────────────────────
async function loadSource(
  clerkId: string,
  sourceType: WorldSourceType,
  sourceId: number,
): Promise<Record<string, unknown> | null> {
  switch (sourceType) {
    case "session": {
      const [row] = await db
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.id, sourceId),
            eq(trainingSessionsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      return row ?? null;
    }
    case "race": {
      const [row] = await db
        .select()
        .from(racesTable)
        .where(and(eq(racesTable.id, sourceId), eq(racesTable.clerkId, clerkId)))
        .limit(1);
      return row ?? null;
    }
    case "journey_item": {
      const [row] = await db
        .select()
        .from(journeyItemsTable)
        .where(
          and(
            eq(journeyItemsTable.id, sourceId),
            eq(journeyItemsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      return row ?? null;
    }
    case "journey_media": {
      const [row] = await db
        .select()
        .from(journeyMediaTable)
        .where(
          and(
            eq(journeyMediaTable.id, sourceId),
            eq(journeyMediaTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      return row ?? null;
    }
    default:
      return null;
  }
}

// Bouw de kijker-presentatie van een item: alleen de gekozen whitelist-velden.
function presentSource(
  item: WorldSharedItem,
  source: Record<string, unknown> | null,
): Record<string, unknown> {
  const fields = new Set(
    (item.sharedFields ?? []).filter((f): f is WorldShareableField =>
      (WORLD_SHAREABLE_FIELDS as readonly string[]).includes(f),
    ),
  );
  const out: Record<string, unknown> = {};
  if (!source) return out;
  if (item.sourceType === "session") {
    out["titel"] = source["title"] ?? null;
    out["datum"] = source["sessionDate"] ?? null;
    out["sport"] = source["sport"] ?? null;
    if (fields.has("afstand")) out["afstandKm"] = source["distanceKm"] ?? null;
    if (fields.has("duur")) out["duurMin"] = source["durationMin"] ?? null;
    if (fields.has("hoogtemeters")) out["hoogtemeters"] = source["elevationM"] ?? null;
    if (fields.has("gemiddelde_snelheid"))
      out["gemSnelheidKph"] = source["avgSpeedKph"] ?? null;
    if (fields.has("vermogen")) out["gemVermogenW"] = source["avgPower"] ?? null;
    if (fields.has("hartslag")) out["gemHartslag"] = source["avgHR"] ?? null;
    out["routeGedeeld"] = fields.has("route");
  } else if (item.sourceType === "race") {
    out["titel"] = source["name"] ?? null;
    out["datum"] = source["raceDate"] ?? null;
    out["locatie"] = source["location"] ?? null;
    if (fields.has("uitslag")) {
      out["uitslag"] = source["resultPosition"] ?? source["result"] ?? null;
    }
  } else if (item.sourceType === "journey_item") {
    out["titel"] = source["title"] ?? null;
    out["datum"] = source["itemDate"] ?? source["startDate"] ?? null;
  } else if (item.sourceType === "journey_media") {
    out["objectPath"] = source["objectPath"] ?? null;
    out["mediaType"] = source["mediaType"] ?? null;
    out["onderschrift"] = source["caption"] ?? null;
  }
  return out;
}

// Read-time self-heal: bron weg ⇒ item op "verwijderd".
async function selfHealMissing(item: WorldSharedItem): Promise<boolean> {
  if (item.sourceType === "bericht" || item.sourceId === null) return true;
  const src = await loadSource(item.clerkId, item.sourceType, item.sourceId);
  if (src) return true;
  await db
    .update(worldSharedItemsTable)
    .set({ status: "verwijderd", updatedAt: new Date() })
    .where(eq(worldSharedItemsTable.id, item.id));
  return false;
}

// Wordt óók aangeroepen vanuit verwijderpaden van bronnen (sessies/races/…).
export async function removeWorldRefsForSource(
  clerkId: string,
  sourceType: WorldSourceType,
  sourceId: number,
): Promise<void> {
  await db
    .update(worldSharedItemsTable)
    .set({ status: "verwijderd", updatedAt: new Date() })
    .where(
      and(
        eq(worldSharedItemsTable.clerkId, clerkId),
        eq(worldSharedItemsTable.sourceType, sourceType),
        eq(worldSharedItemsTable.sourceId, sourceId),
      ),
    );
}

async function displayNames(
  clerkIds: string[],
): Promise<Map<string, string>> {
  if (clerkIds.length === 0) return new Map();
  const rows = await db
    .select({
      clerkId: userProfilesTable.clerkId,
      displayName: userProfilesTable.displayName,
    })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [...new Set(clerkIds)]));
  return new Map(rows.map((r) => [r.clerkId, r.displayName ?? "Renner"]));
}

// ── Delen ────────────────────────────────────────────────────────────────────
// POST /api/world-social/items
router.post("/items", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sourceType = str(body["sourceType"]) as WorldSourceType | null;
  if (!sourceType || !WORLD_SOURCE_TYPES.includes(sourceType)) {
    res.status(400).json({ error: "Ongeldig brontype" });
    return;
  }
  const visibility = (str(body["visibility"]) ?? "prive") as WorldVisibility;
  if (!WORLD_VISIBILITY.includes(visibility)) {
    res.status(400).json({ error: "Ongeldige zichtbaarheid" });
    return;
  }
  const message = str(body["message"]);
  const caption = str(body["caption"]);
  const rawFields = Array.isArray(body["sharedFields"]) ? body["sharedFields"] : [];
  const sharedFields = rawFields.filter(
    (f): f is WorldShareableField =>
      typeof f === "string" &&
      (WORLD_SHAREABLE_FIELDS as readonly string[]).includes(f),
  );
  if (rawFields.length !== sharedFields.length) {
    res.status(400).json({
      error:
        "Eén of meer velden zijn niet deelbaar. Gezondheid, herstel en coachnotities kunnen nooit gedeeld worden.",
    });
    return;
  }
  const lp = body["locationPrivacy"] as Record<string, unknown> | null | undefined;
  const locationPrivacy =
    lp && typeof lp === "object"
      ? {
          hideStartEnd: lp["hideStartEnd"] !== false,
          privacyZone: lp["privacyZone"] !== false,
          simplify: lp["simplify"] !== false,
        }
      : { hideStartEnd: true, privacyZone: true, simplify: true }; // fail-closed default

  let sourceId: number | null = null;
  if (sourceType === "bericht") {
    if (!message) {
      res.status(400).json({ error: "Een bericht heeft tekst nodig" });
      return;
    }
  } else {
    const idNum = parseInt(String(body["sourceId"]), 10);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      res.status(400).json({ error: "Ongeldige bron" });
      return;
    }
    const source = await loadSource(clerkId, sourceType, idNum);
    if (!source) {
      res.status(404).json({ error: "Bron niet gevonden of niet van jou" });
      return;
    }
    if (
      sourceType === "journey_media" &&
      source["visibility"] !== "gedeeld"
    ) {
      res.status(400).json({
        error: "Deze foto of video staat op privé in je Journey en kan daarom niet gedeeld worden.",
      });
      return;
    }
    sourceId = idNum;
  }

  // Openbaar: expliciete bevestiging + leeftijds-/toestemmingscheck (fail-closed).
  let publicConfirmedAt: Date | null = null;
  if (visibility === "openbaar") {
    const status = await getOwnerShareStatus(clerkId);
    if (!status.publicAllowed) {
      res.status(403).json({
        error:
          "Openbaar delen is niet beschikbaar. Voor renners onder de 18 (of zonder bekende geboortedatum) is hiervoor toestemming van een ouder nodig.",
      });
      return;
    }
    if (body["confirmPublic"] !== true) {
      res.status(400).json({
        error:
          "Openbaar delen vraagt een expliciete bevestiging. Vink de bevestiging aan en probeer opnieuw.",
        needsConfirmation: true,
      });
      return;
    }
    publicConfirmedAt = new Date();
  }

  try {
    const values = {
      clerkId,
      sourceType,
      sourceId,
      message: sourceType === "bericht" ? message : null,
      caption,
      visibility,
      publicConfirmedAt,
      sharedFields,
      locationPrivacy,
      status: "actief" as const,
      updatedAt: new Date(),
    };
    let item: WorldSharedItem | undefined;
    if (sourceId !== null) {
      [item] = await db
        .insert(worldSharedItemsTable)
        .values(values)
        .onConflictDoUpdate({
          target: [
            worldSharedItemsTable.clerkId,
            worldSharedItemsTable.sourceType,
            worldSharedItemsTable.sourceId,
          ],
          targetWhere: sql`source_id IS NOT NULL`,
          set: {
            caption,
            visibility,
            publicConfirmedAt,
            sharedFields,
            locationPrivacy,
            status: "actief",
            updatedAt: new Date(),
          },
        })
        .returning();
    } else {
      [item] = await db.insert(worldSharedItemsTable).values(values).returning();
    }
    if (!item) {
      res.status(500).json({ error: "Delen is niet gelukt" });
      return;
    }
    await writeAudit({
      event: "share_changed",
      actorClerkId: clerkId,
      meta: { itemId: item.id, sourceType, sourceId, visibility },
      req,
    });
    const signalText = [message, caption].filter(Boolean).join(" ");
    if (signalText) await autoSignal(signalText, "item", item.id);
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "world-social share failed");
    res.status(500).json({ error: "Delen is niet gelukt" });
  }
});

// PUT /api/world-social/items/:id — eigenaar past deelkeuzes aan.
router.put("/items/:id", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [item] = await db
    .select()
    .from(worldSharedItemsTable)
    .where(
      and(
        eq(worldSharedItemsTable.id, id),
        eq(worldSharedItemsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  if (!item || item.status === "verwijderd") {
    res.status(404).json({ error: "Item niet gevonden" });
    return;
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body["visibility"] !== undefined) {
    const visibility = str(body["visibility"]) as WorldVisibility | null;
    if (!visibility || !WORLD_VISIBILITY.includes(visibility)) {
      res.status(400).json({ error: "Ongeldige zichtbaarheid" });
      return;
    }
    if (visibility === "openbaar") {
      const status = await getOwnerShareStatus(clerkId);
      if (!status.publicAllowed) {
        res.status(403).json({
          error:
            "Openbaar delen is niet beschikbaar zonder toestemming van een ouder.",
        });
        return;
      }
      if (body["confirmPublic"] !== true && !item.publicConfirmedAt) {
        res.status(400).json({
          error: "Openbaar delen vraagt een expliciete bevestiging.",
          needsConfirmation: true,
        });
        return;
      }
      set["publicConfirmedAt"] = item.publicConfirmedAt ?? new Date();
    } else {
      set["publicConfirmedAt"] = null;
    }
    set["visibility"] = visibility;
  }
  if (body["caption"] !== undefined) set["caption"] = str(body["caption"]);
  if (Array.isArray(body["sharedFields"])) {
    const fields = body["sharedFields"].filter(
      (f): f is WorldShareableField =>
        typeof f === "string" &&
        (WORLD_SHAREABLE_FIELDS as readonly string[]).includes(f),
    );
    if (fields.length !== body["sharedFields"].length) {
      res.status(400).json({ error: "Eén of meer velden zijn niet deelbaar." });
      return;
    }
    set["sharedFields"] = fields;
  }
  if (body["locationPrivacy"] && typeof body["locationPrivacy"] === "object") {
    const lp = body["locationPrivacy"] as Record<string, unknown>;
    set["locationPrivacy"] = {
      hideStartEnd: lp["hideStartEnd"] !== false,
      privacyZone: lp["privacyZone"] !== false,
      simplify: lp["simplify"] !== false,
    };
  }
  const [updated] = await db
    .update(worldSharedItemsTable)
    .set(set)
    .where(eq(worldSharedItemsTable.id, id))
    .returning();
  await writeAudit({
    event: "share_changed",
    actorClerkId: clerkId,
    meta: { itemId: id, update: Object.keys(set) },
    req,
  });
  res.json(updated);
});

// DELETE /api/world-social/items/:id — intrekken (referentie weg, bron blijft).
router.delete("/items/:id", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  const [updated] = await db
    .update(worldSharedItemsTable)
    .set({ status: "verwijderd", updatedAt: new Date() })
    .where(
      and(
        eq(worldSharedItemsTable.id, id),
        eq(worldSharedItemsTable.clerkId, clerkId),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Item niet gevonden" });
    return;
  }
  await writeAudit({
    event: "share_changed",
    actorClerkId: clerkId,
    meta: { itemId: id, action: "ingetrokken" },
    req,
  });
  res.json({ ok: true });
});

// GET /api/world-social/items/mine — eigen gedeelde items (incl. verborgen).
router.get("/items/mine", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const items = await db
    .select()
    .from(worldSharedItemsTable)
    .where(
      and(
        eq(worldSharedItemsTable.clerkId, clerkId),
        or(
          eq(worldSharedItemsTable.status, "actief"),
          eq(worldSharedItemsTable.status, "verborgen"),
        ),
      ),
    )
    .orderBy(desc(worldSharedItemsTable.createdAt))
    .limit(100);
  const out = [];
  for (const item of items) {
    const alive = await selfHealMissing(item);
    if (!alive) continue;
    const source =
      item.sourceType === "bericht" || item.sourceId === null
        ? null
        : await loadSource(item.clerkId, item.sourceType, item.sourceId);
    out.push({ ...item, presentatie: presentSource(item, source) });
  }
  res.json(out);
});

// ── Feed ─────────────────────────────────────────────────────────────────────
// GET /api/world-social/feed — begrensde, relatie-gebaseerde feed (geen
// oneindige aanbevelingen; alleen mensen met wie je echt iets hebt + openbaar).
router.get("/feed", requireAuth, async (req: Request, res: Response) => {
  const viewer = getClerkUserId(req)!;
  try {
    const [rel, blocked] = await Promise.all([
      relatedOwnerIds(viewer),
      listBlockedIds(viewer),
    ]);

    // Club-/teamgenoten van de kijker (voor club/team-zichtbaarheid).
    const clubmates =
      rel.clubIds.length > 0
        ? (
            await db
              .select({ clerkId: clubMembersTable.clerkId })
              .from(clubMembersTable)
              .where(
                and(
                  inArray(clubMembersTable.clubId, rel.clubIds),
                  isNull(clubMembersTable.endedAt),
                ),
              )
          ).map((r) => r.clerkId)
        : [];
    const teamKeys = [...rel.teamGroupKeys];
    const teamIds = teamKeys
      .filter((k) => k.startsWith("t"))
      .map((k) => parseInt(k.slice(1), 10));
    const groupIds = teamKeys
      .filter((k) => k.startsWith("g"))
      .map((k) => parseInt(k.slice(1), 10));
    const [teamRows, groupRows] = await Promise.all([
      teamIds.length
        ? db
            .select({ clerkId: clubTeamMembersTable.clerkId })
            .from(clubTeamMembersTable)
            .where(
              and(
                inArray(clubTeamMembersTable.teamId, teamIds),
                isNull(clubTeamMembersTable.endedAt),
              ),
            )
        : Promise.resolve([]),
      groupIds.length
        ? db
            .select({ clerkId: clubGroupMembersTable.clerkId })
            .from(clubGroupMembersTable)
            .where(
              and(
                inArray(clubGroupMembersTable.groupId, groupIds),
                isNull(clubGroupMembersTable.endedAt),
              ),
            )
        : Promise.resolve([]),
    ]);
    const teammates = new Set([
      ...teamRows.map((r) => r.clerkId),
      ...groupRows.map((r) => r.clerkId),
    ]);

    const coachParent = new Set(rel.coachParentAthletes);
    const friends = new Set(rel.friends);
    const clubSet = new Set(clubmates);
    const knownOwners = [
      ...new Set([
        ...coachParent,
        ...friends,
        ...clubSet,
        ...teammates,
      ]),
    ].filter((o) => o !== viewer && !blocked.has(o));

    const candidates = await db
      .select()
      .from(worldSharedItemsTable)
      .where(
        and(
          eq(worldSharedItemsTable.status, "actief"),
          or(
            eq(worldSharedItemsTable.clerkId, viewer),
            knownOwners.length
              ? inArray(worldSharedItemsTable.clerkId, knownOwners)
              : sql`false`,
            and(
              eq(worldSharedItemsTable.visibility, "openbaar"),
              sql`${worldSharedItemsTable.publicConfirmedAt} IS NOT NULL`,
            ),
          ),
        ),
      )
      .orderBy(desc(worldSharedItemsTable.createdAt))
      .limit(120);

    // Openbaar: eigenaars-toestemming batchen (fail-closed).
    const publicOwners = [
      ...new Set(
        candidates
          .filter((c) => c.visibility === "openbaar" && c.clerkId !== viewer)
          .map((c) => c.clerkId),
      ),
    ];
    const publicAllowed = new Map<string, boolean>();
    for (const owner of publicOwners) {
      publicAllowed.set(owner, (await getOwnerShareStatus(owner)).publicAllowed);
    }

    const visible: WorldSharedItem[] = [];
    for (const item of candidates) {
      if (visible.length >= 50) break;
      const owner = item.clerkId;
      if (owner === viewer) {
        visible.push(item);
        continue;
      }
      if (blocked.has(owner)) continue;
      let ok = false;
      switch (item.visibility as WorldVisibility) {
        case "coach_ouders":
          ok = coachParent.has(owner);
          break;
        case "club":
          ok = clubSet.has(owner);
          break;
        case "team":
          ok = teammates.has(owner);
          break;
        case "volgers":
          ok = friends.has(owner);
          break;
        case "openbaar":
          ok = Boolean(item.publicConfirmedAt) && publicAllowed.get(owner) === true;
          break;
        default:
          ok = false;
      }
      if (ok) visible.push(item);
    }

    // Self-heal + presentatie + namen + reactietellingen.
    const names = await displayNames(visible.map((v) => v.clerkId));
    const out = [];
    for (const item of visible) {
      const alive = await selfHealMissing(item);
      if (!alive) continue;
      const source =
        item.sourceType === "bericht" || item.sourceId === null
          ? null
          : await loadSource(item.clerkId, item.sourceType, item.sourceId);
      const reactions = await db
        .select({
          kind: worldReactionsTable.kind,
          count: sql<number>`count(*)::int`,
        })
        .from(worldReactionsTable)
        .where(
          and(
            eq(worldReactionsTable.itemId, item.id),
            eq(worldReactionsTable.status, "actief"),
          ),
        )
        .groupBy(worldReactionsTable.kind);
      const counts = Object.fromEntries(reactions.map((r) => [r.kind, r.count]));
      out.push({
        id: item.id,
        eigenaar: {
          clerkId: item.clerkId,
          naam: names.get(item.clerkId) ?? "Renner",
          isZelf: item.clerkId === viewer,
        },
        sourceType: item.sourceType,
        visibility: item.visibility,
        message: item.message,
        caption: item.caption,
        presentatie: presentSource(item, source),
        waarderingen: counts["waardering"] ?? 0,
        reacties: counts["reactie"] ?? 0,
        createdAt: item.createdAt,
      });
    }
    res.json({ items: out });
  } catch (err) {
    req.log.error({ err }, "world-social feed failed");
    res.status(500).json({ error: "Feed laden is niet gelukt" });
  }
});

// GET /api/world-social/items/:id — detail met reacties.
router.get("/items/:id", requireAuth, async (req: Request, res: Response) => {
  const viewer = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  const [item] = await db
    .select()
    .from(worldSharedItemsTable)
    .where(eq(worldSharedItemsTable.id, id))
    .limit(1);
  if (!item || item.status === "verwijderd") {
    res.status(404).json({ error: "Item niet gevonden" });
    return;
  }
  if (!(await viewerMaySeeItem(viewer, item))) {
    res.status(404).json({ error: "Item niet gevonden" });
    return;
  }
  if (!(await selfHealMissing(item))) {
    res.status(404).json({ error: "Item niet gevonden" });
    return;
  }
  const source =
    item.sourceType === "bericht" || item.sourceId === null
      ? null
      : await loadSource(item.clerkId, item.sourceType, item.sourceId);
  const blocked = await listBlockedIds(viewer);
  const reactionRows = await db
    .select()
    .from(worldReactionsTable)
    .where(
      and(
        eq(worldReactionsTable.itemId, item.id),
        eq(worldReactionsTable.status, "actief"),
      ),
    )
    .orderBy(worldReactionsTable.createdAt);
  const filtered = reactionRows.filter((r) => !blocked.has(r.clerkId));
  const names = await displayNames([
    item.clerkId,
    ...filtered.map((r) => r.clerkId),
  ]);
  res.json({
    ...item,
    eigenaarNaam: names.get(item.clerkId) ?? "Renner",
    presentatie: presentSource(item, source),
    reacties: filtered.map((r) => ({
      id: r.id,
      kind: r.kind,
      body: r.body,
      naam: names.get(r.clerkId) ?? "Renner",
      isZelf: r.clerkId === viewer,
      createdAt: r.createdAt,
    })),
  });
});

// GET /api/world-social/items/:id/track — route met locatieprivacy (leesmoment).
router.get(
  "/items/:id/track",
  requireAuth,
  async (req: Request, res: Response) => {
    const viewer = getClerkUserId(req)!;
    const id = parseInt(String(req.params["id"]), 10);
    const [item] = await db
      .select()
      .from(worldSharedItemsTable)
      .where(eq(worldSharedItemsTable.id, id))
      .limit(1);
    if (
      !item ||
      item.status === "verwijderd" ||
      item.sourceType !== "session" ||
      item.sourceId === null
    ) {
      res.status(404).json({ error: "Geen route bij dit item" });
      return;
    }
    if (!(await viewerMaySeeItem(viewer, item))) {
      res.status(404).json({ error: "Item niet gevonden" });
      return;
    }
    if (!(item.sharedFields ?? []).includes("route")) {
      res.status(404).json({ error: "De route is bij dit item niet gedeeld" });
      return;
    }
    const [imp] = await db
      .select({ parsedSummary: activityImportsTable.parsedSummary })
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.linkedTrainingSessionId, item.sourceId),
          eq(activityImportsTable.clerkId, item.clerkId),
        ),
      )
      .limit(1);
    const geometry = (
      imp?.parsedSummary as {
        route?: { geometry?: { coordinates?: unknown } | null } | null;
      } | null
    )?.route?.geometry;
    const coords = Array.isArray((geometry as { coordinates?: unknown })?.coordinates)
      ? ((geometry as { coordinates: unknown[] }).coordinates as unknown[])
      : null;
    if (!coords || coords.length < 2) {
      res.json({ track: null, reden: "Deze rit heeft geen opgeslagen kaartlijn." });
      return;
    }
    const points: TrackPoint[] = [];
    for (const c of coords) {
      if (Array.isArray(c) && c.length >= 2) {
        const lon = Number(c[0]);
        const lat = Number(c[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
      }
    }
    // Eigenaar ziet zijn EIGEN route altijd onbewerkt; kijkers krijgen de
    // privacy-transformatie. Het origineel wordt nooit gewijzigd.
    if (viewer === item.clerkId) {
      res.json({ track: points, origineel: true });
      return;
    }
    const [profile] = await db
      .select({
        homeLat: athleteProfilesTable.homeLat,
        homeLon: athleteProfilesTable.homeLon,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, item.clerkId))
      .limit(1);
    const home =
      profile?.homeLat != null && profile?.homeLon != null
        ? { lat: Number(profile.homeLat), lon: Number(profile.homeLon) }
        : null;
    const opts = item.locationPrivacy ?? {
      hideStartEnd: true,
      privacyZone: true,
      simplify: true,
    };
    const track = applyLocationPrivacy(points, opts, home);
    res.json(
      track
        ? { track, origineel: false }
        : {
            track: null,
            reden:
              "Na het toepassen van de privacy-instellingen blijft er te weinig route over om te tonen.",
          },
    );
  },
);

// ── Reacties ─────────────────────────────────────────────────────────────────
router.post(
  "/items/:id/reactions",
  requireAuth,
  async (req: Request, res: Response) => {
    const viewer = getClerkUserId(req)!;
    const id = parseInt(String(req.params["id"]), 10);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kind = str(body["kind"]);
    if (kind !== "waardering" && kind !== "reactie") {
      res.status(400).json({ error: "Ongeldige reactie" });
      return;
    }
    const text = kind === "reactie" ? str(body["body"]) : null;
    if (kind === "reactie" && !text) {
      res.status(400).json({ error: "Een reactie heeft tekst nodig" });
      return;
    }
    const [item] = await db
      .select()
      .from(worldSharedItemsTable)
      .where(eq(worldSharedItemsTable.id, id))
      .limit(1);
    if (!item || item.status !== "actief") {
      res.status(404).json({ error: "Item niet gevonden" });
      return;
    }
    if (!(await viewerMaySeeItem(viewer, item))) {
      res.status(404).json({ error: "Item niet gevonden" });
      return;
    }
    try {
      let created;
      if (kind === "waardering") {
        [created] = await db
          .insert(worldReactionsTable)
          .values({ itemId: id, clerkId: viewer, kind })
          .onConflictDoNothing({
            target: [worldReactionsTable.itemId, worldReactionsTable.clerkId],
            where: sql`kind = 'waardering'`,
          })
          .returning();
        if (!created) {
          res.json({ ok: true, alBestaand: true });
          return;
        }
      } else {
        [created] = await db
          .insert(worldReactionsTable)
          .values({ itemId: id, clerkId: viewer, kind, body: text })
          .returning();
        if (created && text) await autoSignal(text, "reactie", created.id);
      }
      // Melding voor de eigenaar (voorkeur gerespecteerd, nooit voor jezelf).
      if (created && item.clerkId !== viewer) {
        const [prefs] = await db
          .select()
          .from(worldNotificationPrefsTable)
          .where(eq(worldNotificationPrefsTable.clerkId, item.clerkId))
          .limit(1);
        if (!prefs || prefs.notifyReactions) {
          const names = await displayNames([viewer]);
          await createNotification({
            clerkId: item.clerkId,
            type: "world_update",
            title:
              kind === "waardering"
                ? `${names.get(viewer) ?? "Iemand"} waardeert je gedeelde item`
                : `${names.get(viewer) ?? "Iemand"} reageerde op je gedeelde item`,
            body: kind === "reactie" ? text : null,
            actionUrl: "/samen",
            dedupeWithin:
              kind === "waardering"
                ? { type: "world_update", matchBody: `waardering-${id}` }
                : undefined,
          });
        }
      }
      res.status(201).json(created ?? { ok: true });
    } catch (err) {
      req.log.error({ err }, "world-social reaction failed");
      res.status(500).json({ error: "Reageren is niet gelukt" });
    }
  },
);

router.delete(
  "/reactions/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const viewer = getClerkUserId(req)!;
    const id = parseInt(String(req.params["id"]), 10);
    const [row] = await db
      .delete(worldReactionsTable)
      .where(
        and(
          eq(worldReactionsTable.id, id),
          eq(worldReactionsTable.clerkId, viewer),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Reactie niet gevonden" });
      return;
    }
    res.json({ ok: true });
  },
);

// ── Blokkades ────────────────────────────────────────────────────────────────
router.get("/blocks", requireAuth, async (req: Request, res: Response) => {
  const viewer = getClerkUserId(req)!;
  const rows = await db
    .select()
    .from(worldBlocksTable)
    .where(eq(worldBlocksTable.blockerClerkId, viewer))
    .orderBy(desc(worldBlocksTable.createdAt));
  const names = await displayNames(rows.map((r) => r.blockedClerkId));
  res.json(
    rows.map((r) => ({
      id: r.id,
      clerkId: r.blockedClerkId,
      naam: names.get(r.blockedClerkId) ?? "Renner",
      sinds: r.createdAt,
    })),
  );
});

router.post("/blocks", requireAuth, async (req: Request, res: Response) => {
  const viewer = getClerkUserId(req)!;
  const target = str((req.body ?? {})["blockedClerkId"]);
  if (!target || target === viewer) {
    res.status(400).json({ error: "Ongeldige blokkade" });
    return;
  }
  const [exists] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, target))
    .limit(1);
  if (!exists) {
    res.status(404).json({ error: "Gebruiker niet gevonden" });
    return;
  }
  await db
    .insert(worldBlocksTable)
    .values({ blockerClerkId: viewer, blockedClerkId: target })
    .onConflictDoNothing();
  await writeAudit({
    event: "user_blocked",
    actorClerkId: viewer,
    subjectClerkId: target,
    req,
  });
  res.status(201).json({ ok: true });
});

router.delete(
  "/blocks/:clerkId",
  requireAuth,
  async (req: Request, res: Response) => {
    const viewer = getClerkUserId(req)!;
    const target = String(req.params["clerkId"]);
    const [row] = await db
      .delete(worldBlocksTable)
      .where(
        and(
          eq(worldBlocksTable.blockerClerkId, viewer),
          eq(worldBlocksTable.blockedClerkId, target),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Blokkade niet gevonden" });
      return;
    }
    await writeAudit({
      event: "user_unblocked",
      actorClerkId: viewer,
      subjectClerkId: target,
      req,
    });
    res.json({ ok: true });
  },
);

// ── Rapportages ──────────────────────────────────────────────────────────────
router.post("/reports", requireAuth, async (req: Request, res: Response) => {
  const viewer = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const targetType = str(body["targetType"]);
  const targetId = str(body["targetId"]);
  const reason = str(body["reason"]);
  if (
    !targetType ||
    !["item", "reactie", "account"].includes(targetType) ||
    !targetId ||
    !reason
  ) {
    res.status(400).json({ error: "Ongeldige melding" });
    return;
  }
  const [report] = await db
    .insert(worldReportsTable)
    .values({
      reporterClerkId: viewer,
      targetType: targetType as "item" | "reactie" | "account",
      targetId,
      reason,
    })
    .returning();
  await writeAudit({
    event: "content_reported",
    actorClerkId: viewer,
    meta: { targetType, targetId },
    req,
  });
  res.status(201).json({ ok: true, id: report?.id });
});

// ── Moderatie (alleen admin) ────────────────────────────────────────────────
router.get("/moderation", requireAuth, async (req: Request, res: Response) => {
  const viewer = getClerkUserId(req)!;
  if (!isAdmin(viewer)) {
    res.status(403).json({ error: "Alleen voor beheerders" });
    return;
  }
  const open = await db
    .select()
    .from(worldReportsTable)
    .where(eq(worldReportsTable.status, "open"))
    .orderBy(desc(worldReportsTable.createdAt))
    .limit(100);
  const enriched = [];
  for (const report of open) {
    let context: Record<string, unknown> | null = null;
    if (report.targetType === "item") {
      const [item] = await db
        .select()
        .from(worldSharedItemsTable)
        .where(eq(worldSharedItemsTable.id, parseInt(report.targetId, 10) || 0))
        .limit(1);
      context = item ?? null;
    } else if (report.targetType === "reactie") {
      const [reaction] = await db
        .select()
        .from(worldReactionsTable)
        .where(eq(worldReactionsTable.id, parseInt(report.targetId, 10) || 0))
        .limit(1);
      context = reaction ?? null;
    }
    enriched.push({ ...report, context });
  }
  res.json(enriched);
});

router.post(
  "/moderation/:reportId/besluit",
  requireAuth,
  async (req: Request, res: Response) => {
    const viewer = getClerkUserId(req)!;
    if (!isAdmin(viewer)) {
      res.status(403).json({ error: "Alleen voor beheerders" });
      return;
    }
    const reportId = parseInt(String(req.params["reportId"]), 10);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = str(body["action"]);
    if (!action || !(WORLD_MODERATION_ACTIONS as readonly string[]).includes(action)) {
      res.status(400).json({ error: "Ongeldig besluit" });
      return;
    }
    const note = str(body["note"]);
    const [report] = await db
      .select()
      .from(worldReportsTable)
      .where(eq(worldReportsTable.id, reportId))
      .limit(1);
    if (!report || report.status !== "open") {
      res.status(404).json({ error: "Melding niet gevonden of al beoordeeld" });
      return;
    }
    let ownerClerkId: string | null = null;
    const numericTarget = parseInt(report.targetId, 10) || 0;
    if (report.targetType === "item" && (action === "verborgen" || action === "hersteld")) {
      const [item] = await db
        .update(worldSharedItemsTable)
        .set({
          status: action === "verborgen" ? "verborgen" : "actief",
          hiddenReason: action === "verborgen" ? (note ?? report.reason) : null,
          updatedAt: new Date(),
        })
        .where(eq(worldSharedItemsTable.id, numericTarget))
        .returning();
      ownerClerkId = item?.clerkId ?? null;
    } else if (
      report.targetType === "reactie" &&
      (action === "verborgen" || action === "hersteld")
    ) {
      const [reaction] = await db
        .update(worldReactionsTable)
        .set({ status: action === "verborgen" ? "verborgen" : "actief" })
        .where(eq(worldReactionsTable.id, numericTarget))
        .returning();
      ownerClerkId = reaction?.clerkId ?? null;
    } else if (report.targetType === "account") {
      ownerClerkId = report.targetId;
    }
    await db
      .update(worldReportsTable)
      .set({
        status: "beoordeeld",
        action: action as (typeof WORLD_MODERATION_ACTIONS)[number],
        moderatorClerkId: viewer,
        moderationNote: note,
        moderatedAt: new Date(),
      })
      .where(eq(worldReportsTable.id, reportId));
    await writeAudit({
      event: "moderation_action",
      actorClerkId: viewer,
      subjectClerkId: ownerClerkId,
      meta: { reportId, action, targetType: report.targetType, targetId: report.targetId },
      req,
    });
    if (ownerClerkId && (action === "verborgen" || action === "sanctie")) {
      const [prefs] = await db
        .select()
        .from(worldNotificationPrefsTable)
        .where(eq(worldNotificationPrefsTable.clerkId, ownerClerkId))
        .limit(1);
      if (!prefs || prefs.notifyModeration) {
        await createNotification({
          clerkId: ownerClerkId,
          type: "world_update",
          title:
            action === "verborgen"
              ? "Een gedeeld item is verborgen na een melding"
              : "Er is een maatregel genomen na een melding",
          body:
            note ??
            "Bekijk je gedeelde items in Samen. Neem contact op als je vindt dat dit niet klopt.",
          actionUrl: "/samen",
        });
      }
    }
    res.json({ ok: true });
  },
);

// ── Meldingsvoorkeuren ──────────────────────────────────────────────────────
router.get("/prefs", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const [prefs] = await db
    .select()
    .from(worldNotificationPrefsTable)
    .where(eq(worldNotificationPrefsTable.clerkId, clerkId))
    .limit(1);
  res.json(
    prefs ?? {
      clerkId,
      notifyReactions: true,
      notifyMentions: true,
      notifyRequests: true,
      notifyClubMessages: true,
      notifyModeration: true,
      muteDuringRide: true,
    },
  );
});

router.put("/prefs", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const boolOr = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const values = {
    clerkId,
    notifyReactions: boolOr(body["notifyReactions"], true),
    notifyMentions: boolOr(body["notifyMentions"], true),
    notifyRequests: boolOr(body["notifyRequests"], true),
    notifyClubMessages: boolOr(body["notifyClubMessages"], true),
    notifyModeration: boolOr(body["notifyModeration"], true),
    muteDuringRide: boolOr(body["muteDuringRide"], true),
    updatedAt: new Date(),
  };
  const [saved] = await db
    .insert(worldNotificationPrefsTable)
    .values(values)
    .onConflictDoUpdate({
      target: worldNotificationPrefsTable.clerkId,
      set: values,
    })
    .returning();
  res.json(saved);
});

export default router;
