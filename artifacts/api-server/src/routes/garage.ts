import { Router } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  garageBikesTable,
  garageComponentsTable,
  garageSensorsTable,
  componentEventsTable,
  equipmentChoicesTable,
  equipmentTable,
  athleteProfilesTable,
  trainingSessionsTable,
  racesTable,
  plannedWorkoutsTable,
  garageBikeTypes,
  garageComponentCategories,
  garageSensorKinds,
  pairableSensorKinds,
  type GarageBike,
  type GarageComponent,
  type GarageSensorKind,
} from "@workspace/db";
import {
  autoLinkSessions,
  bikeUsageSince,
  componentUsage,
  garageUsageOverview,
  setSessionBike,
  unlinkBikeSessions,
} from "../lib/bike-usage";
import {
  maintenanceSignals,
  relevantSignals,
} from "../lib/maintenance-signals";
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
import { catalogForCategory } from "../lib/garage/knowledge-base";
import { estimateUpgrade, compareTestRides } from "../lib/garage/material-test";

const router = Router();

const MAX_PHOTOS_PER_BIKE = 4;

function str(v: unknown, max = 120): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function parseBuildYear(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1970 || n > new Date().getFullYear() + 1) {
    return null;
  }
  return n;
}

// YYYY-MM-DD, rond-tripbaar (geen "2024-02-31").
function parseDateStr(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    return null;
  }
  return v;
}

function withAssessment(c: GarageComponent) {
  return { ...c, assessment: assessComponent(c.category, c.brand, c.model) };
}

// Whether this sensor kind can be live-paired in the browser (standard
// Bluetooth GATT profile). Watches and electronic derailleurs cannot — that is
// stated honestly in the UI, never faked.
function isPairableKind(kind: string): boolean {
  return (pairableSensorKinds as readonly string[]).includes(kind);
}

function withPairable<T extends { kind: string }>(s: T) {
  return { ...s, pairable: isPairableKind(s.kind) };
}

// GET /api/garage — the whole garage: bikes (with components + honest
// assessments), personal gear, and unlinked equipment rows (e.g. from Strava)
// as a starting point so nothing is entered twice.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [bikes, components, equipment, sensors] = await Promise.all([
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
      db
        .select()
        .from(garageSensorsTable)
        .where(eq(garageSensorsTable.clerkId, clerkId))
        .orderBy(garageSensorsTable.id),
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
      sensors: sensors.map(withPairable),
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
        buildYear: parseBuildYear(body.buildYear),
        purpose: str(body.purpose, 200),
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
  if (body.buildYear !== undefined) set.buildYear = parseBuildYear(body.buildYear);
  if (body.purpose !== undefined) set.purpose = str(body.purpose, 200);
  if (body.status !== undefined) {
    const s = String(body.status);
    if (!["actief", "archief"].includes(s)) {
      res.status(400).json({ error: "Status is actief of archief" });
      return;
    }
    set.status = s;
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
    // De activiteiten blijven bestaan; alleen de koppeling verdwijnt.
    await unlinkBikeSessions(clerkId, id);
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
    // F11: de centrale poort kan een verkeerd type (415) of te grote foto (400)
    // eerlijk weigeren; die status doorgeven i.p.v. een generieke 502.
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number") {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
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

// GET /api/garage/catalog?categorie= — echte, herkenbare producten uit de
// gecureerde kennisbank voor de invoer-picker (aantikken i.p.v. typen).
// Vrije invoer blijft altijd mogelijk; dit is een startpunt, geen beperking.
router.get("/catalog", requireAuth, (req, res) => {
  const category = String(req.query.categorie ?? "");
  if (!(garageComponentCategories as readonly string[]).includes(category)) {
    res.status(400).json({ error: "Onbekende categorie" });
    return;
  }
  res.json({ items: catalogForCategory(category) });
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
  // Montagedatum (optioneel) — de basis voor de afgeleide km-historie.
  let installedAt: string | null = null;
  if (body.installedAt != null) {
    installedAt = parseDateStr(body.installedAt);
    if (!installedAt) {
      res.status(400).json({ error: "Ongeldige montagedatum (JJJJ-MM-DD)" });
      return;
    }
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
        installedAt,
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
  if (body.installedAt !== undefined) {
    const d = body.installedAt === null ? null : parseDateStr(body.installedAt);
    if (body.installedAt !== null && !d) {
      res.status(400).json({ error: "Ongeldige montagedatum (JJJJ-MM-DD)" });
      return;
    }
    set.installedAt = d;
  }
  // Bevestiging van een herkend/gescand onderdeel — expliciete gebruikersactie.
  if (body.confirmed !== undefined) set.confirmed = !!body.confirmed;
  if (body.status !== undefined) {
    const s = String(body.status);
    const allowed = ["in_gebruik", "vervangen", "defect_vermoed", "defect_vastgesteld"];
    if (!allowed.includes(s)) {
      res.status(400).json({ error: "Onbekende onderdeelstatus" });
      return;
    }
    set.status = s;
  }
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

// POST /api/garage/test/estimate — modelschatting vooraf voor een geplande
// upgrade (bij de mechanieker in te voeren merk + type). Klasse-vergelijking
// uit de kennisbank, expliciet gelabeld als schatting; onbekend = eerlijk geen
// schatting. Levert ook de best passende testmodus + de zelfde-dag-spelregel.
router.post("/test/estimate", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const category = str(req.body?.category, 40);
  const brand = str(req.body?.brand, 80);
  const model = str(req.body?.model, 120);
  const currentComponentId = Number(req.body?.currentComponentId);
  if (!category || !(garageComponentCategories as readonly string[]).includes(category)) {
    res.status(400).json({ error: "Kies een geldige onderdeel-categorie" });
    return;
  }
  if (!brand && !model) {
    res.status(400).json({ error: "Vul merk en type van de geplande upgrade in" });
    return;
  }
  try {
    let current: { brand: string | null; model: string | null } | null = null;
    if (Number.isInteger(currentComponentId)) {
      const [c] = await db
        .select()
        .from(garageComponentsTable)
        .where(
          and(
            eq(garageComponentsTable.id, currentComponentId),
            eq(garageComponentsTable.clerkId, clerkId),
          ),
        );
      if (!c) {
        res.status(404).json({ error: "Huidig onderdeel niet gevonden" });
        return;
      }
      if (c.category !== category) {
        res.status(400).json({ error: "Het gekozen onderdeel valt in een andere categorie" });
        return;
      }
      current = { brand: c.brand, model: c.model };
    }
    res.json({ estimate: estimateUpgrade(category, brand, model, current) });
  } catch (err) {
    req.log.error({ err }, "garage.test.estimate failed");
    res.status(500).json({ error: "Kon de modelschatting niet opstellen" });
  }
});

// GET /api/garage/test/compare?a=&b= — eerlijke vergelijking van twee ECHTE
// ritten (opstelling A vs B). Alleen echte metingen naast elkaar; een duiding
// alleen bij een schone test (zelfde dag, zelfde sport, gelijke afstand),
// anders kanttekeningen die uitleggen wat de vergelijking vertroebelt.
router.get("/test/compare", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const idA = Number(req.query.a);
  const idB = Number(req.query.b);
  if (!Number.isInteger(idA) || !Number.isInteger(idB) || idA === idB) {
    res.status(400).json({ error: "Kies twee verschillende ritten" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          inArray(trainingSessionsTable.id, [idA, idB]),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      );
    const a = rows.find((r) => r.id === idA);
    const b = rows.find((r) => r.id === idB);
    if (!a || !b) {
      res.status(404).json({ error: "Rit niet gevonden" });
      return;
    }
    res.json({ comparison: compareTestRides(a, b) });
  } catch (err) {
    req.log.error({ err }, "garage.test.compare failed");
    res.status(500).json({ error: "Kon de ritten niet vergelijken" });
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

// ---------------------------------------------------------------------------
// Draadloze onderdelen (Bluetooth sensors) — owner-gated CRUD. `pairable` is
// derived from the kind and returned honestly: only power (GATT 0x1818),
// heart rate (0x180d) and cadence/speed (0x1816) have a standard Bluetooth
// profile the browser can read. Watches and electronic derailleurs are
// register-only equipment; the UI says so in plain Dutch.

async function ownedBikeId(
  clerkId: string,
  raw: unknown,
): Promise<number | null | "invalid" | "notfound"> {
  if (raw == null) return null;
  const id = Number(raw);
  if (!Number.isInteger(id)) return "invalid";
  const [owned] = await db
    .select({ id: garageBikesTable.id })
    .from(garageBikesTable)
    .where(and(eq(garageBikesTable.id, id), eq(garageBikesTable.clerkId, clerkId)));
  return owned ? id : "notfound";
}

// POST /api/garage/sensors — register a wireless part, linked to one of the
// athlete's bikes or loose (bikeId null).
router.post("/sensors", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const kind = String(body.kind ?? "");
  if (!(garageSensorKinds as readonly string[]).includes(kind)) {
    res.status(400).json({ error: "Onbekend soort draadloos onderdeel" });
    return;
  }
  const bikeId = await ownedBikeId(clerkId, body.bikeId);
  if (bikeId === "invalid") {
    res.status(400).json({ error: "Ongeldig fiets-id" });
    return;
  }
  if (bikeId === "notfound") {
    res.status(404).json({ error: "Fiets niet gevonden" });
    return;
  }
  try {
    const [row] = await db
      .insert(garageSensorsTable)
      .values({
        clerkId,
        bikeId,
        kind: kind as GarageSensorKind,
        brand: str(body.brand, 80),
        model: str(body.model, 120),
        // Device name only makes sense for kinds the browser can really pair.
        deviceName: isPairableKind(kind) ? str(body.deviceName, 120) : null,
        batteryNote: str(body.batteryNote, 200),
      })
      .returning();
    res.json({ sensor: withPairable(row!) });
  } catch (err) {
    req.log.error({ err }, "garage.addSensor failed");
    res.status(500).json({ error: "Kon het draadloze onderdeel niet opslaan" });
  }
});

// PATCH /api/garage/sensors/:id — update fields or move to another bike
// (bikeId: null detaches; a bikeId must be the athlete's own bike).
router.patch("/sensors/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    const [existing] = await db
      .select()
      .from(garageSensorsTable)
      .where(
        and(eq(garageSensorsTable.id, id), eq(garageSensorsTable.clerkId, clerkId)),
      );
    if (!existing) {
      res.status(404).json({ error: "Draadloos onderdeel niet gevonden" });
      return;
    }
    const updates: Partial<typeof garageSensorsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if ("brand" in body) updates.brand = str(body.brand, 80);
    if ("model" in body) updates.model = str(body.model, 120);
    if ("batteryNote" in body) updates.batteryNote = str(body.batteryNote, 200);
    if ("deviceName" in body) {
      updates.deviceName = isPairableKind(existing.kind)
        ? str(body.deviceName, 120)
        : null;
    }
    if ("bikeId" in body) {
      const bikeId = await ownedBikeId(clerkId, body.bikeId);
      if (bikeId === "invalid") {
        res.status(400).json({ error: "Ongeldig fiets-id" });
        return;
      }
      if (bikeId === "notfound") {
        res.status(404).json({ error: "Fiets niet gevonden" });
        return;
      }
      updates.bikeId = bikeId;
    }
    const [row] = await db
      .update(garageSensorsTable)
      .set(updates)
      .where(
        and(eq(garageSensorsTable.id, id), eq(garageSensorsTable.clerkId, clerkId)),
      )
      .returning();
    res.json({ sensor: withPairable(row!) });
  } catch (err) {
    req.log.error({ err }, "garage.updateSensor failed");
    res.status(500).json({ error: "Kon het draadloze onderdeel niet bijwerken" });
  }
});

// DELETE /api/garage/sensors/:id — owner-gated.
router.delete("/sensors/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const deleted = await db
      .delete(garageSensorsTable)
      .where(
        and(eq(garageSensorsTable.id, id), eq(garageSensorsTable.clerkId, clerkId)),
      )
      .returning({ id: garageSensorsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Draadloos onderdeel niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "garage.deleteSensor failed");
    res.status(500).json({ error: "Kon het draadloze onderdeel niet verwijderen" });
  }
});

// ---------------------------------------------------------------------------
// Mechanieker — gebruik, onderhoudslogboek, signalen en materiaalkeuze.

// GET /api/garage/usage — km/uren/ritten per fiets, ALTIJD live afgeleid uit
// de gekoppelde activiteiten (idempotent, corrigeert zichzelf). Voert eerst de
// auto-koppeling uit zodat nieuwe ritten meteen meetellen.
router.get("/usage", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const linked = await autoLinkSessions(clerkId);
    const usage = await garageUsageOverview(clerkId);
    res.json({
      usage: Object.fromEntries(usage),
      autoLinked: linked,
    });
  } catch (err) {
    req.log.error({ err }, "garage.usage failed");
    res.status(500).json({ error: "Kon het fietsgebruik niet berekenen" });
  }
});

// GET /api/garage/components/:id/usage — gebruik van één onderdeel sinds
// montage (of registratie — dat wordt eerlijk benoemd via `basis`).
router.get("/components/:id/usage", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const [component] = await db
      .select()
      .from(garageComponentsTable)
      .where(
        and(
          eq(garageComponentsTable.id, id),
          eq(garageComponentsTable.clerkId, clerkId),
        ),
      );
    if (!component) {
      res.status(404).json({ error: "Onderdeel niet gevonden" });
      return;
    }
    res.json({ usage: await componentUsage(clerkId, component) });
  } catch (err) {
    req.log.error({ err }, "garage.componentUsage failed");
    res.status(500).json({ error: "Kon het gebruik niet berekenen" });
  }
});

// GET /api/garage/signals?context= — onderhoudssignalen (controleadvies /
// vermoedelijke slijtage / vastgesteld defect). Context bepaalt de filtering:
// vandaag (alleen urgent), wedstrijd (alles), garage (alles, standaard).
router.get("/signals", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const ctxRaw = String(req.query.context ?? "garage");
  const context = (["vandaag", "wedstrijd", "garage"] as const).includes(
    ctxRaw as "garage",
  )
    ? (ctxRaw as "vandaag" | "wedstrijd" | "garage")
    : "garage";
  try {
    await autoLinkSessions(clerkId);
    const signals = await maintenanceSignals(clerkId);
    res.json({ signals: relevantSignals(signals, context) });
  } catch (err) {
    req.log.error({ err }, "garage.signals failed");
    res.status(500).json({ error: "Kon de onderhoudssignalen niet opstellen" });
  }
});

// ── Onderhoudslogboek per onderdeel (component_events) ─────────────────────

const EVENT_TYPES = [
  "onderhoud",
  "reparatie",
  "vervanging",
  "controle",
  "defect_vastgesteld",
] as const;

// GET /api/garage/components/:id/events — logboek, nieuwste eerst.
router.get("/components/:id/events", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const events = await db
      .select()
      .from(componentEventsTable)
      .where(
        and(
          eq(componentEventsTable.componentId, id),
          eq(componentEventsTable.clerkId, clerkId),
        ),
      )
      .orderBy(desc(componentEventsTable.eventDate), desc(componentEventsTable.id));
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "garage.events.list failed");
    res.status(500).json({ error: "Kon het logboek niet laden" });
  }
});

// POST /api/garage/components/:id/events — registreer onderhoud/reparatie/
// vervanging/controle/defect. Gevolgen zijn expliciet en uitlegbaar:
// - "vervanging": montagedatum van het onderdeel schuift naar de eventdatum
//   (nieuwe kilometrage-historie) en de status wordt weer "in_gebruik".
// - "defect_vastgesteld": onderdeelstatus wordt "defect_vastgesteld" — dit is
//   de ENIGE weg naar een vastgesteld defect (nooit uit foto's afgeleid).
// - optionele bewijsfoto's (base64) worden in objectopslag bewaard.
router.post("/components/:id/events", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const eventType = String(body.eventType ?? "");
  const eventDate = parseDateStr(body.eventDate);
  if (!Number.isInteger(id) || !(EVENT_TYPES as readonly string[]).includes(eventType)) {
    res.status(400).json({ error: "Ongeldig logboek-item" });
    return;
  }
  if (!eventDate) {
    res.status(400).json({ error: "Een geldige datum (JJJJ-MM-DD) is verplicht" });
    return;
  }
  try {
    const [component] = await db
      .select()
      .from(garageComponentsTable)
      .where(
        and(
          eq(garageComponentsTable.id, id),
          eq(garageComponentsTable.clerkId, clerkId),
        ),
      );
    if (!component) {
      res.status(404).json({ error: "Onderdeel niet gevonden" });
      return;
    }
    // Bewijsfoto's (optioneel, max 3 per event).
    const photoPaths: string[] = [];
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];
    for (const p of photos) {
      if (!p || typeof p !== "object") continue;
      const rec = p as Record<string, unknown>;
      let data = typeof rec.data === "string" ? rec.data : "";
      let mediaType =
        typeof rec.mediaType === "string" ? rec.mediaType : "image/jpeg";
      const dataUrl = data.match(/^data:([^;]+);base64,(.*)$/s);
      if (dataUrl) {
        mediaType = dataUrl[1]!;
        data = dataUrl[2]!;
      }
      if (!data.trim() || !/^image\//.test(mediaType)) continue;
      photoPaths.push(
        await uploadMaterialPhoto(clerkId, { base64: data.trim(), mediaType }),
      );
    }
    // km-stand op het moment van het event: live afgeleid (eerlijk, geen teller).
    let kmAtEvent: number | null = null;
    if (component.bikeId != null) {
      const totals = await bikeUsageSince(
        clerkId,
        component.bikeId,
        component.installedAt,
      );
      kmAtEvent = Math.round(totals.km);
    }
    const [event] = await db
      .insert(componentEventsTable)
      .values({
        clerkId,
        componentId: id,
        eventType,
        eventDate,
        note: str(body.note, 500),
        kmAtEvent: kmAtEvent != null ? String(kmAtEvent) : null,
        photoPaths,
      })
      .returning();
    // Statusgevolgen van het event op het onderdeel zelf.
    const compSet: Partial<GarageComponent> = { updatedAt: new Date() };
    if (eventType === "vervanging") {
      compSet.installedAt = eventDate;
      compSet.status = "in_gebruik";
    } else if (eventType === "defect_vastgesteld") {
      compSet.status = "defect_vastgesteld";
    } else if (
      eventType === "reparatie" &&
      (component.status === "defect_vastgesteld" ||
        component.status === "defect_vermoed")
    ) {
      compSet.status = "in_gebruik";
    }
    const [updated] = await db
      .update(garageComponentsTable)
      .set(compSet)
      .where(eq(garageComponentsTable.id, id))
      .returning();
    res.json({ event, component: withAssessment(updated!) });
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number") {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    req.log.error({ err }, "garage.events.create failed");
    res.status(502).json({ error: "Kon het logboek-item niet opslaan" });
  }
});

// DELETE /api/garage/events/:eventId — verwijder één logboek-item. Statussen
// worden NIET automatisch teruggedraaid (dat blijft een bewuste gebruikersactie
// via het onderdeel zelf) — dat wordt in de UI zo benoemd.
router.delete("/events/:eventId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const rows = await db
      .delete(componentEventsTable)
      .where(
        and(
          eq(componentEventsTable.id, eventId),
          eq(componentEventsTable.clerkId, clerkId),
        ),
      )
      .returning({ id: componentEventsTable.id });
    if (rows.length === 0) {
      res.status(404).json({ error: "Logboek-item niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "garage.events.delete failed");
    res.status(500).json({ error: "Kon het logboek-item niet verwijderen" });
  }
});

// GET /api/garage/events/:eventId/photo/:idx — bewijsfoto (owner-gated).
router.get("/events/:eventId/photo/:idx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const eventId = Number(req.params.eventId);
  const idx = Number(req.params.idx);
  if (!Number.isInteger(eventId) || !Number.isInteger(idx) || idx < 0) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const [row] = await db
      .select({ photoPaths: componentEventsTable.photoPaths })
      .from(componentEventsTable)
      .where(
        and(
          eq(componentEventsTable.id, eventId),
          eq(componentEventsTable.clerkId, clerkId),
        ),
      );
    const path = row?.photoPaths?.[idx];
    if (!path) {
      res.status(404).json({ error: "Foto niet gevonden" });
      return;
    }
    const stream = await streamMaterialPhoto(path, res);
    stream.on("error", (err) => {
      req.log.error({ err }, "garage.eventPhoto stream failed");
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "garage.eventPhoto failed");
    if (!res.headersSent) res.status(404).json({ error: "Foto niet gevonden" });
  }
});

// ── Activiteit ↔ fiets ──────────────────────────────────────────────────────

// PUT /api/garage/sessions/:sessionId/bike { bikeId | null } — handmatige
// koppeling of bewuste ontkoppeling; wint altijd van de auto-koppeling.
router.put("/sessions/:sessionId/bike", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const sessionId = Number(req.params.sessionId);
  const raw = (req.body ?? {}).bikeId;
  const bikeId = raw == null ? null : Number(raw);
  if (!Number.isInteger(sessionId) || (bikeId != null && !Number.isInteger(bikeId))) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const ok = await setSessionBike(clerkId, sessionId, bikeId);
    if (!ok) {
      res.status(404).json({ error: "Rit of fiets niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "garage.sessionBike failed");
    res.status(500).json({ error: "Kon de fiets niet aan de rit koppelen" });
  }
});

// ── Materiaalkeuze per wedstrijd of training (equipment_choices) ────────────

async function ownedTarget(
  clerkId: string,
  raceId: number | null,
  workoutId: number | null,
): Promise<boolean> {
  if (raceId != null) {
    const [r] = await db
      .select({ id: racesTable.id })
      .from(racesTable)
      .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)));
    return !!r;
  }
  if (workoutId != null) {
    const [w] = await db
      .select({ id: plannedWorkoutsTable.id })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.id, workoutId),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      );
    return !!w;
  }
  return false;
}

// GET /api/garage/choices?raceId= of ?workoutId= — de materiaalkeuze.
router.get("/choices", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = req.query.raceId != null ? Number(req.query.raceId) : null;
  const workoutId = req.query.workoutId != null ? Number(req.query.workoutId) : null;
  if (
    (raceId == null) === (workoutId == null) ||
    (raceId != null && !Number.isInteger(raceId)) ||
    (workoutId != null && !Number.isInteger(workoutId))
  ) {
    res.status(400).json({ error: "Geef precies één wedstrijd of training op" });
    return;
  }
  try {
    const conds = [eq(equipmentChoicesTable.clerkId, clerkId)];
    conds.push(
      raceId != null
        ? eq(equipmentChoicesTable.raceId, raceId)
        : eq(equipmentChoicesTable.workoutId, workoutId!),
    );
    const [choice] = await db
      .select()
      .from(equipmentChoicesTable)
      .where(and(...conds))
      .orderBy(desc(equipmentChoicesTable.id))
      .limit(1);
    res.json({ choice: choice ?? null });
  } catch (err) {
    req.log.error({ err }, "garage.choices.get failed");
    res.status(500).json({ error: "Kon de materiaalkeuze niet laden" });
  }
});

// PUT /api/garage/choices — leg de materiaalkeuze vast (upsert per doel).
// Precies één van raceId/workoutId; de fiets moet van de renner zijn.
router.put("/choices", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raceId = body.raceId != null ? Number(body.raceId) : null;
  const workoutId = body.workoutId != null ? Number(body.workoutId) : null;
  if (
    (raceId == null) === (workoutId == null) ||
    (raceId != null && !Number.isInteger(raceId)) ||
    (workoutId != null && !Number.isInteger(workoutId))
  ) {
    res.status(400).json({ error: "Geef precies één wedstrijd of training op" });
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
  const pressure = body.pressureBar != null ? Number(body.pressureBar) : null;
  if (pressure != null && (!Number.isFinite(pressure) || pressure <= 0 || pressure > 12)) {
    res.status(400).json({ error: "Bandenspanning moet tussen 0 en 12 bar liggen" });
    return;
  }
  try {
    if (!(await ownedTarget(clerkId, raceId, workoutId))) {
      res.status(404).json({ error: "Wedstrijd of training niet gevonden" });
      return;
    }
    const values = {
      clerkId,
      raceId,
      workoutId,
      bikeId,
      wheels: str(body.wheels, 160),
      tires: str(body.tires, 160),
      pressureBar: pressure != null ? String(pressure) : null,
      cassette: str(body.cassette, 160),
      other: str(body.other, 300),
      notes: str(body.notes, 500),
      updatedAt: new Date(),
    };
    // Atomische upsert per doel via de partiële unieke index — geen
    // read-then-write race, dus nooit twee keuzes voor dezelfde wedstrijd/
    // training bij gelijktijdige opslag.
    const { clerkId: _c, raceId: _r, workoutId: _w, ...updatable } = values;
    const [choice] = await db
      .insert(equipmentChoicesTable)
      .values(values)
      .onConflictDoUpdate({
        target:
          raceId != null
            ? [equipmentChoicesTable.clerkId, equipmentChoicesTable.raceId]
            : [equipmentChoicesTable.clerkId, equipmentChoicesTable.workoutId],
        targetWhere:
          raceId != null
            ? sql`${equipmentChoicesTable.raceId} IS NOT NULL`
            : sql`${equipmentChoicesTable.workoutId} IS NOT NULL`,
        set: updatable,
      })
      .returning();
    res.json({ choice });
  } catch (err) {
    req.log.error({ err }, "garage.choices.put failed");
    res.status(500).json({ error: "Kon de materiaalkeuze niet opslaan" });
  }
});

export default router;
