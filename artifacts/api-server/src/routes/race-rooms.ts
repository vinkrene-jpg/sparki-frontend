import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  raceRoomsTable,
  raceRoomItemsTable,
  raceRoomCompilationsTable,
  racesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import {
  compileDay,
  MUSIC_TRACKS,
  isMusicKey,
  type CompileItem,
} from "../engines/race-room";

const router = Router();
const objectStorage = new ObjectStorageService();

// Load a room and assert the caller owns it. Returns null (and the caller should
// 404) when the room is missing or owned by someone else.
async function loadOwnedRoom(roomId: number, clerkId: string) {
  if (!Number.isInteger(roomId) || roomId <= 0) return null;
  const [room] = await db
    .select()
    .from(raceRoomsTable)
    .where(eq(raceRoomsTable.id, roomId))
    .limit(1);
  if (!room || room.clerkId !== clerkId) return null;
  return room;
}

// GET /api/race-rooms/music — available music beds (real assets) for the picker.
router.get("/race-rooms/music", requireAuth, (_req: Request, res: Response) => {
  res.json({ tracks: MUSIC_TRACKS });
});

// GET /api/race-rooms — the caller's rooms, newest first.
router.get("/race-rooms", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rooms = await db
      .select()
      .from(raceRoomsTable)
      .where(eq(raceRoomsTable.clerkId, clerkId))
      .orderBy(desc(raceRoomsTable.createdAt));
    res.json({ rooms });
  } catch (err) {
    req.log.error({ err }, "race-rooms.list failed");
    res.status(500).json({ error: "Wedstrijd-rooms ophalen mislukt" });
  }
});

// POST /api/race-rooms — create a room. Body: { title, startDate, days, raceId? }.
router.post("/race-rooms", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as {
    title?: unknown;
    startDate?: unknown;
    days?: unknown;
    raceId?: unknown;
  };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const startDate =
    typeof body.startDate === "string" ? body.startDate.trim() : "";
  const days =
    typeof body.days === "number" && Number.isFinite(body.days)
      ? Math.max(1, Math.min(30, Math.trunc(body.days)))
      : 1;
  if (!title) {
    res.status(400).json({ error: "Geef de wedstrijd een naam." });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    res.status(400).json({ error: "Kies een geldige startdatum." });
    return;
  }

  try {
    // Optional race link must be one of the caller's own races.
    let raceId: number | null = null;
    if (typeof body.raceId === "number" && Number.isInteger(body.raceId)) {
      const [race] = await db
        .select({ id: racesTable.id, clerkId: racesTable.clerkId })
        .from(racesTable)
        .where(eq(racesTable.id, body.raceId))
        .limit(1);
      if (!race || race.clerkId !== clerkId) {
        res.status(400).json({ error: "Onbekende wedstrijd gekozen." });
        return;
      }
      raceId = race.id;
    }

    const [room] = await db
      .insert(raceRoomsTable)
      .values({ clerkId, title, startDate, days, raceId })
      .returning();
    res.status(201).json({ room });
  } catch (err) {
    req.log.error({ err }, "race-rooms.create failed");
    res.status(500).json({ error: "Wedstrijd-room aanmaken mislukt" });
  }
});

// GET /api/race-rooms/:id — room with its items and compilations.
router.get(
  "/race-rooms/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const roomId = Number(String((req.params as Record<string, string>).id));
    try {
      const room = await loadOwnedRoom(roomId, clerkId);
      if (!room) {
        res.status(404).json({ error: "Wedstrijd-room niet gevonden" });
        return;
      }
      const items = await db
        .select()
        .from(raceRoomItemsTable)
        .where(eq(raceRoomItemsTable.roomId, roomId))
        .orderBy(asc(raceRoomItemsTable.createdAt));
      const compilations = await db
        .select()
        .from(raceRoomCompilationsTable)
        .where(eq(raceRoomCompilationsTable.roomId, roomId))
        .orderBy(desc(raceRoomCompilationsTable.updatedAt));
      res.json({ room, items, compilations });
    } catch (err) {
      req.log.error({ err }, "race-rooms.get failed");
      res.status(500).json({ error: "Wedstrijd-room ophalen mislukt" });
    }
  },
);

// DELETE /api/race-rooms/:id — remove a room (items + compilations cascade).
router.delete(
  "/race-rooms/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const roomId = Number(String((req.params as Record<string, string>).id));
    try {
      const room = await loadOwnedRoom(roomId, clerkId);
      if (!room) {
        res.status(404).json({ error: "Wedstrijd-room niet gevonden" });
        return;
      }
      await db.delete(raceRoomsTable).where(eq(raceRoomsTable.id, roomId));
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "race-rooms.delete failed");
      res.status(500).json({ error: "Wedstrijd-room verwijderen mislukt" });
    }
  },
);

// POST /api/race-rooms/:id/items — add a media item or a text update.
// Body (media): { kind:"media", dayIndex, objectPath, mediaType, caption?, durationSec? }
// Body (update): { kind:"update", dayIndex, text }
router.post(
  "/race-rooms/:id/items",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const roomId = Number(String((req.params as Record<string, string>).id));
    const body = req.body as Record<string, unknown>;

    try {
      const room = await loadOwnedRoom(roomId, clerkId);
      if (!room) {
        res.status(404).json({ error: "Wedstrijd-room niet gevonden" });
        return;
      }

      const kind = typeof body.kind === "string" ? body.kind : "";
      const dayIndexRaw =
        typeof body.dayIndex === "number" ? Math.trunc(body.dayIndex) : 1;
      const dayIndex = Math.max(1, Math.min(room.days, dayIndexRaw));

      if (kind === "media") {
        const objectPath =
          typeof body.objectPath === "string" ? body.objectPath : "";
        const mediaType =
          typeof body.mediaType === "string" ? body.mediaType : "";
        if (!objectPath.startsWith("/objects/")) {
          res.status(400).json({ error: "Ongeldig mediabestand." });
          return;
        }
        if (
          !mediaType.startsWith("image/") &&
          !mediaType.startsWith("video/")
        ) {
          res
            .status(400)
            .json({ error: "Alleen foto's en video's zijn toegestaan." });
          return;
        }
        const caption =
          typeof body.caption === "string" && body.caption.trim()
            ? body.caption.trim().slice(0, 280)
            : null;
        const durationSec =
          typeof body.durationSec === "number" &&
          Number.isFinite(body.durationSec) &&
          body.durationSec > 0
            ? String(Math.min(600, body.durationSec))
            : null;

        // The bytes are already in storage (client PUT to the presigned URL), so
        // we can now set the owner ACL. This must happen AFTER upload, never before.
        try {
          await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
            owner: clerkId,
            visibility: "private",
          });
        } catch (err) {
          req.log.error({ err }, "race-rooms.item acl failed");
          res
            .status(400)
            .json({ error: "Bestand niet gevonden in opslag. Upload opnieuw." });
          return;
        }

        const [item] = await db
          .insert(raceRoomItemsTable)
          .values({
            roomId,
            clerkId,
            dayIndex,
            kind: "media",
            objectPath,
            mediaType,
            caption,
            durationSec,
          })
          .returning();
        res.status(201).json({ item });
        return;
      }

      if (kind === "update") {
        const text =
          typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
        if (!text) {
          res.status(400).json({ error: "Schrijf eerst een update." });
          return;
        }
        const [item] = await db
          .insert(raceRoomItemsTable)
          .values({ roomId, clerkId, dayIndex, kind: "update", text })
          .returning();
        res.status(201).json({ item });
        return;
      }

      res.status(400).json({ error: "Onbekend itemtype." });
    } catch (err) {
      req.log.error({ err }, "race-rooms.item.create failed");
      res.status(500).json({ error: "Item toevoegen mislukt" });
    }
  },
);

// DELETE /api/race-rooms/:id/items/:itemId — remove one contribution.
router.delete(
  "/race-rooms/:id/items/:itemId",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const params = req.params as Record<string, string>;
    const roomId = Number(String(params.id));
    const itemId = Number(String(params.itemId));
    try {
      const room = await loadOwnedRoom(roomId, clerkId);
      if (!room) {
        res.status(404).json({ error: "Wedstrijd-room niet gevonden" });
        return;
      }
      await db
        .delete(raceRoomItemsTable)
        .where(
          and(
            eq(raceRoomItemsTable.id, itemId),
            eq(raceRoomItemsTable.roomId, roomId),
          ),
        );
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "race-rooms.item.delete failed");
      res.status(500).json({ error: "Item verwijderen mislukt" });
    }
  },
);

// POST /api/race-rooms/:id/compile — render a day's compilation (real ffmpeg).
// Body: { dayIndex, musicKey? }. musicKey "geen" = no music, omitted = auto-pick.
router.post(
  "/race-rooms/:id/compile",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const roomId = Number(String((req.params as Record<string, string>).id));
    const body = req.body as { dayIndex?: unknown; musicKey?: unknown };

    try {
      const room = await loadOwnedRoom(roomId, clerkId);
      if (!room) {
        res.status(404).json({ error: "Wedstrijd-room niet gevonden" });
        return;
      }
      const dayIndexRaw =
        typeof body.dayIndex === "number" ? Math.trunc(body.dayIndex) : 1;
      const dayIndex = Math.max(1, Math.min(room.days, dayIndexRaw));

      let musicKey: string | null | undefined;
      if (body.musicKey === "geen") musicKey = "geen";
      else if (isMusicKey(body.musicKey)) musicKey = body.musicKey;
      else musicKey = undefined;

      const rows = await db
        .select()
        .from(raceRoomItemsTable)
        .where(
          and(
            eq(raceRoomItemsTable.roomId, roomId),
            eq(raceRoomItemsTable.dayIndex, dayIndex),
          ),
        )
        .orderBy(asc(raceRoomItemsTable.createdAt));

      const items: CompileItem[] = rows.map((r) => ({
        kind: r.kind,
        objectPath: r.objectPath,
        mediaType: r.mediaType,
        caption: r.caption,
        text: r.text,
        durationSec: r.durationSec != null ? Number(r.durationSec) : null,
      }));

      const dayLabel = room.days > 1 ? `Dag ${dayIndex}` : null;
      const result = await compileDay({
        ownerClerkId: clerkId,
        roomTitle: room.title,
        dayIndex,
        dayLabel,
        items,
        musicKey,
      });

      // One compilation row per day: replace any previous render for this day.
      await db
        .delete(raceRoomCompilationsTable)
        .where(
          and(
            eq(raceRoomCompilationsTable.roomId, roomId),
            eq(raceRoomCompilationsTable.dayIndex, dayIndex),
          ),
        );

      const base = {
        roomId,
        clerkId,
        dayIndex,
        updatedAt: new Date(),
      };
      const values =
        result.status === "ready"
          ? {
              ...base,
              status: "ready" as const,
              objectPath: result.objectPath,
              musicTrack: result.musicTrack,
              itemCount: result.itemCount,
              durationSec: String(result.durationSec),
              reason: null,
            }
          : {
              ...base,
              status: result.status,
              objectPath: null,
              musicTrack: null,
              itemCount: 0,
              durationSec: null,
              reason: result.reason,
            };

      const [compilation] = await db
        .insert(raceRoomCompilationsTable)
        .values(values)
        .returning();
      res.status(result.status === "ready" ? 201 : 200).json({ compilation });
    } catch (err) {
      req.log.error({ err }, "race-rooms.compile failed");
      res.status(500).json({ error: "Compilatie maken mislukt" });
    }
  },
);

// GET /api/race-rooms/:id/compilations/:compId/download — owner-gated mp4 download.
router.get(
  "/race-rooms/:id/compilations/:compId/download",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const params = req.params as Record<string, string>;
    const roomId = Number(String(params.id));
    const compId = Number(String(params.compId));
    try {
      const room = await loadOwnedRoom(roomId, clerkId);
      if (!room) {
        res.status(404).json({ error: "Wedstrijd-room niet gevonden" });
        return;
      }
      const [comp] = await db
        .select()
        .from(raceRoomCompilationsTable)
        .where(
          and(
            eq(raceRoomCompilationsTable.id, compId),
            eq(raceRoomCompilationsTable.roomId, roomId),
          ),
        )
        .limit(1);
      if (!comp || comp.status !== "ready" || !comp.objectPath) {
        res.status(404).json({ error: "Compilatie niet gevonden" });
        return;
      }

      const objectFile = await objectStorage.getObjectEntityFile(
        comp.objectPath,
      );
      const canAccess = await objectStorage.canAccessObjectEntity({
        userId: clerkId,
        objectFile,
      });
      if (!canAccess) {
        res.status(403).json({ error: "Geen toegang tot dit bestand" });
        return;
      }

      const safeTitle = (room.title || "wedstrijd")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      const filename = `compilatie-${safeTitle || "wedstrijd"}-dag-${comp.dayIndex}.mp4`;

      const response = await objectStorage.downloadObject(objectFile);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      if (response.body) {
        Readable.fromWeb(
          response.body as Parameters<typeof Readable.fromWeb>[0],
        ).pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Bestand niet gevonden" });
        return;
      }
      req.log.error({ err }, "race-rooms.download failed");
      res.status(500).json({ error: "Download mislukt" });
    }
  },
);

export default router;
