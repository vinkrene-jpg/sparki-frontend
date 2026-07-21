import { Router } from "express";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  garageBikesTable,
  garageComponentsTable,
  equipmentTable,
  athleteProfilesTable,
  garageBikeTypes,
  garageComponentCategories,
  type GarageBike,
  type GarageComponent,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  uploadMaterialPhoto,
  streamMaterialPhoto,
} from "../engines/material";
import {
  assessComponent,
  rankUpgrades,
  matchProTeams,
  SPECIALISMS,
  type Specialism,
} from "../engines/garage";
import { getRelevantKnowledge } from "../lib/knowledge/retrieval";

const router = Router();

const MAX_PHOTOS_PER_BIKE = 4;

function str(v: unknown, max = 120): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function withAssessment(c: GarageComponent) {
  return { ...c, assessment: assessComponent(c.category, c.brand, c.model) };
}

// GET /api/garage — the whole garage: bikes (with components + honest
// assessments), personal gear, and unlinked equipment rows (e.g. from Strava)
// as a starting point so nothing is entered twice.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [bikes, components, equipment] = await Promise.all([
      db
        .select()
        .from(garageBikesTable)
        .where(eq(garageBikesTable.clerkId, clerkId))
        .orderBy(desc(garageBikesTable.createdAt)),
      db
        .select()
        .from(garageComponentsTable)
        .where(eq(garageComponentsTable.clerkId, clerkId))
        .orderBy(garageComponentsTable.id),
      db
        .select()
        .from(equipmentTable)
        .where(
          and(eq(equipmentTable.clerkId, clerkId), eq(equipmentTable.active, true)),
        ),
    ]);

    const linkedEquipmentIds = new Set(
      bikes.map((b) => b.equipmentId).filter((id): id is number => id != null),
    );
    // Equipment rows that could seed a bike but aren't linked to one yet.
    const suggestions = equipment.filter(
      (e) => e.kind === "bike" && !linkedEquipmentIds.has(e.id),
    );

    const byBike = new Map<number, ReturnType<typeof withAssessment>[]>();
    const personal: ReturnType<typeof withAssessment>[] = [];
    for (const c of components) {
      const assessed = withAssessment(c);
      if (c.bikeId == null) personal.push(assessed);
      else {
        const list = byBike.get(c.bikeId) ?? [];
        list.push(assessed);
        byBike.set(c.bikeId, list);
      }
    }

    res.json({
      bikes: bikes.map((b) => ({ ...b, components: byBike.get(b.id) ?? [] })),
      personalGear: personal,
      equipmentSuggestions: suggestions.map((e) => ({
        id: e.id,
        name: e.name,
        brand: e.brand,
        model: e.model,
        source: e.source,
        distanceKm: e.distanceKm,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "garage.list failed");
    res.status(500).json({ error: "Kon de fietsengarage niet laden" });
  }
});

// POST /api/garage/bikes — add a bike. Optionally seeded from an existing
// equipment row (equipmentId), which must belong to this athlete.
router.post("/bikes", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bikeType = String(body.bikeType ?? "race");
  if (!(garageBikeTypes as readonly string[]).includes(bikeType)) {
    res.status(400).json({ error: "Onbekend fietstype" });
    return;
  }
  const name = str(body.name);
  if (!name) {
    res.status(400).json({ error: "Geef de fiets een naam" });
    return;
  }
  let equipmentId: number | null = null;
  if (body.equipmentId != null) {
    const id = Number(body.equipmentId);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Ongeldig equipment-id" });
      return;
    }
    const [owned] = await db
      .select({ id: equipmentTable.id })
      .from(equipmentTable)
      .where(and(eq(equipmentTable.id, id), eq(equipmentTable.clerkId, clerkId)));
    if (!owned) {
      res.status(404).json({ error: "Uitrusting niet gevonden" });
      return;
    }
    equipmentId = id;
  }
  try {
    const [row] = await db
      .insert(garageBikesTable)
      .values({
        clerkId,
        bikeType,
        name,
        brand: str(body.brand, 80),
        model: str(body.model, 120),
        equipmentId,
        notes: str(body.notes, 500),
      })
      .returning();
    res.json({ bike: { ...row, components: [] } });
  } catch (err) {
    req.log.error({ err }, "garage.addBike failed");
    res.status(500).json({ error: "Kon de fiets niet opslaan" });
  }
});

// PATCH /api/garage/bikes/:id — update basic bike fields (owner-gated).
router.patch("/bikes/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const set: Partial<GarageBike> = { updatedAt: new Date() };
  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) {
      res.status(400).json({ error: "Naam mag niet leeg zijn" });
      return;
    }
    set.name = name;
  }
  if (body.brand !== undefined) set.brand = str(body.brand, 80);
  if (body.model !== undefined) set.model = str(body.model, 120);
  if (body.notes !== undefined) set.notes = str(body.notes, 500);
  if (body.bikeType !== undefined) {
    const t = String(body.bikeType);
    if (!(garageBikeTypes as readonly string[]).includes(t)) {
      res.status(400).json({ error: "Onbekend fietstype" });
      return;
    }
    set.bikeType = t;
  }
  try {
    const [row] = await db
      .update(garageBikesTable)
      .set(set)
      .where(and(eq(garageBikesTable.id, id), eq(garageBikesTable.clerkId, clerkId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Fiets niet gevonden" });
      return;
    }
    res.json({ bike: row });
  } catch (err) {
    req.log.error({ err }, "garage.updateBike failed");
    res.status(500).json({ error: "Kon de fiets niet bijwerken" });
  }
});

// DELETE /api/garage/bikes/:id — remove a bike (components cascade).
router.delete("/bikes/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const rows = await db
      .delete(garageBikesTable)
      .where(and(eq(garageBikesTable.id, id), eq(garageBikesTable.clerkId, clerkId)))
      .returning({ id: garageBikesTable.id });
    if (rows.length === 0) {
      res.status(404).json({ error: "Fiets niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "garage.deleteBike failed");
    res.status(500).json({ error: "Kon de fiets niet verwijderen" });
  }
});

// POST /api/garage/bikes/:id/photo — add a real photo (base64) to a bike.
router.post("/bikes/:id/photo", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  let data = typeof body.data === "string" ? body.data : "";
  let mediaType = typeof body.mediaType === "string" ? body.mediaType : "image/jpeg";
  const dataUrl = data.match(/^data:([^;]+);base64,(.*)$/s);
  if (dataUrl) {
    mediaType = dataUrl[1]!;
    data = dataUrl[2]!;
  }
  if (!data.trim() || !/^image\//.test(mediaType)) {
    res.status(400).json({ error: "Een geldige foto is nodig" });
    return;
  }
  try {
    const [bike] = await db
      .select()
      .from(garageBikesTable)
      .where(and(eq(garageBikesTable.id, id), eq(garageBikesTable.clerkId, clerkId)));
    if (!bike) {
      res.status(404).json({ error: "Fiets niet gevonden" });
      return;
    }
    if (bike.photoPaths.length >= MAX_PHOTOS_PER_BIKE) {
      res.status(400).json({ error: `Maximaal ${MAX_PHOTOS_PER_BIKE} foto's per fiets` });
      return;
    }
    const path = await uploadMaterialPhoto(clerkId, {
      base64: data.trim(),
      mediaType,
    });
    const [row] = await db
      .update(garageBikesTable)
      .set({ photoPaths: [...bike.photoPaths, path], updatedAt: new Date() })
      .where(and(eq(garageBikesTable.id, id), eq(garageBikesTable.clerkId, clerkId)))
      .returning();
    res.json({ bike: row });
  } catch (err) {
    req.log.error({ err }, "garage.addPhoto failed");
    res.status(502).json({ error: "Kon de foto nu niet opslaan. Probeer opnieuw." });
  }
});

// GET /api/garage/photo/:bikeId/:idx — serve one stored bike photo (owner-gated).
router.get("/photo/:bikeId/:idx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const bikeId = Number(req.params.bikeId);
  const idx = Number(req.params.idx);
  if (!Number.isInteger(bikeId) || !Number.isInteger(idx) || idx < 0) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const [row] = await db
      .select({ photoPaths: garageBikesTable.photoPaths })
      .from(garageBikesTable)
      .where(and(eq(garageBikesTable.id, bikeId), eq(garageBikesTable.clerkId, clerkId)));
    const path = row?.photoPaths[idx];
    if (!path) {
      res.status(404).json({ error: "Foto niet gevonden" });
      return;
    }
    const stream = await streamMaterialPhoto(path, res);
    stream.on("error", (err) => {
      req.log.error({ err }, "garage.photo stream failed");
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "garage.photo failed");
    if (!res.headersSent) res.status(404).json({ error: "Foto niet gevonden" });
  }
});

// POST /api/garage/components — add a component to a bike (or personal gear
// when bikeId is omitted). The bike must belong to this athlete.
router.post("/components", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const category = String(body.category ?? "");
  if (!(garageComponentCategories as readonly string[]).includes(category)) {
    res.status(400).json({ error: "Onbekende categorie" });
    return;
  }
  let bikeId: number | null = null;
  if (body.bikeId != null) {
    const id = Number(body.bikeId);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Ongeldig fiets-id" });
      return;
    }
    const [owned] = await db
      .select({ id: garageBikesTable.id })
      .from(garageBikesTable)
      .where(and(eq(garageBikesTable.id, id), eq(garageBikesTable.clerkId, clerkId)));
    if (!owned) {
      res.status(404).json({ error: "Fiets niet gevonden" });
      return;
    }
    bikeId = id;
  }
  // Personal gear categories never hang on a bike; bike parts always do.
  const personalCats = new Set(["helm", "kleding", "schoenen"]);
  if (bikeId == null && !personalCats.has(category)) {
    res.status(400).json({ error: "Kies eerst een fiets voor dit onderdeel" });
    return;
  }
  try {
    const [row] = await db
      .insert(garageComponentsTable)
      .values({
        clerkId,
        bikeId,
        category,
        brand: str(body.brand, 80),
        model: str(body.model, 120),
        notes: str(body.notes, 300),
      })
      .returning();
    res.json({ component: withAssessment(row!) });
  } catch (err) {
    req.log.error({ err }, "garage.addComponent failed");
    res.status(500).json({ error: "Kon het onderdeel niet opslaan" });
  }
});

// PATCH /api/garage/components/:id — update brand/model/notes (owner-gated).
router.patch("/components/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const set: Partial<GarageComponent> = { updatedAt: new Date() };
  if (body.brand !== undefined) set.brand = str(body.brand, 80);
  if (body.model !== undefined) set.model = str(body.model, 120);
  if (body.notes !== undefined) set.notes = str(body.notes, 300);
  try {
    const [row] = await db
      .update(garageComponentsTable)
      .set(set)
      .where(
        and(
          eq(garageComponentsTable.id, id),
          eq(garageComponentsTable.clerkId, clerkId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Onderdeel niet gevonden" });
      return;
    }
    res.json({ component: withAssessment(row) });
  } catch (err) {
    req.log.error({ err }, "garage.updateComponent failed");
    res.status(500).json({ error: "Kon het onderdeel niet bijwerken" });
  }
});

// DELETE /api/garage/components/:id — remove a component (owner-gated).
router.delete("/components/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const rows = await db
      .delete(garageComponentsTable)
      .where(
        and(
          eq(garageComponentsTable.id, id),
          eq(garageComponentsTable.clerkId, clerkId),
        ),
      )
      .returning({ id: garageComponentsTable.id });
    if (rows.length === 0) {
      res.status(404).json({ error: "Onderdeel niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "garage.deleteComponent failed");
    res.status(500).json({ error: "Kon het onderdeel niet verwijderen" });
  }
});

// GET /api/garage/upgrade?bikeId=&specialisme= — deterministic, explainable
// upgrade advice per specialism. Includes personal gear (helm/kleding/schoenen)
// because those count for e.g. tijdrit.
router.get("/upgrade", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const bikeId = Number(req.query.bikeId);
  const specialism = String(req.query.specialisme ?? "");
  if (!Number.isInteger(bikeId)) {
    res.status(400).json({ error: "Ongeldig fiets-id" });
    return;
  }
  if (!(SPECIALISMS as readonly string[]).includes(specialism)) {
    res.status(400).json({ error: "Kies een specialisme: klimmen, tijdrit, duur of sprint" });
    return;
  }
  try {
    const [bike] = await db
      .select({ id: garageBikesTable.id })
      .from(garageBikesTable)
      .where(and(eq(garageBikesTable.id, bikeId), eq(garageBikesTable.clerkId, clerkId)));
    if (!bike) {
      res.status(404).json({ error: "Fiets niet gevonden" });
      return;
    }
    const components = await db
      .select()
      .from(garageComponentsTable)
      .where(
        and(
          eq(garageComponentsTable.clerkId, clerkId),
          // bike parts of THIS bike + personal gear
        ),
      );
    const relevant = components.filter(
      (c) => c.bikeId === bikeId || c.bikeId == null,
    );
    res.json({ advice: rankUpgrades(relevant, specialism as Specialism) });
  } catch (err) {
    req.log.error({ err }, "garage.upgrade failed");
    res.status(500).json({ error: "Kon het upgrade-advies niet opstellen" });
  }
});

// GET /api/garage/developments — real material news/knowledge items from the
// existing pipeline, filtered on the athlete's garage brands + discipline.
// Honest empty result when nothing relevant is stored.
router.get("/developments", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [components, [athlete]] = await Promise.all([
      db
        .select()
        .from(garageComponentsTable)
        .where(eq(garageComponentsTable.clerkId, clerkId)),
      db
        .select({ discipline: athleteProfilesTable.discipline })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId)),
    ]);

    const keywords = new Set<string>([
      "groepset", "wielen", "banden", "helm", "aero", "materiaal",
      "groupset", "wheels", "tyres", "helmet", "equipment", "bike",
    ]);
    for (const c of components) {
      if (c.brand) keywords.add(c.brand);
      if (c.model) keywords.add(c.model);
    }
    if (athlete?.discipline) keywords.add(athlete.discipline);

    const items = await getRelevantKnowledge({
      keywords: [...keywords],
      disciplines: ["materiaal"],
      limit: 6,
    });
    // Only surface items actually tagged materiaal — keyword hits on generic
    // sports news would dilute the section.
    const material = items.filter((i) => i.disciplines.includes("materiaal"));
    res.json({ items: material });
  } catch (err) {
    req.log.error({ err }, "garage.developments failed");
    res.status(500).json({ error: "Kon nieuwe ontwikkelingen niet laden" });
  }
});

// GET /api/garage/pro-teams — curated pro-team material dataset (with season +
// source attribution) matched against the athlete's own recognised gear.
router.get("/pro-teams", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const components = await db
      .select()
      .from(garageComponentsTable)
      .where(eq(garageComponentsTable.clerkId, clerkId));
    res.json(matchProTeams(components));
  } catch (err) {
    req.log.error({ err }, "garage.proTeams failed");
    res.status(500).json({ error: "Kon profploegen niet laden" });
  }
});

export default router;
