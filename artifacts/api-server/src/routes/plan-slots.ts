// TRAININGSVORMEN_01 F3 — schemaplekken en bandbreedte (TRV-32..35, TRV-64).
//
// Kernregels:
//  - Een plek heeft een bedoeling en een bandbreedte; binnen de bandbreedte
//    gebeurt er niets bijzonders, eroverheen → status "afgeweken" mét
//    toelichting. Uitvoering wordt NOOIT geblokkeerd (TRV-41).
//  - Bandbreedte instellen is aan de trainer (directe link) of de AI; de
//    sporter niet (TRV-20). De ruimte-instelling (strak/normaal/vrij) is één
//    keuze per trainer×sporter (TRV-33).
//  - Afspraakvormen zijn niet plaatsbaar als gewone training (TRV-50; F7
//    bouwt de agenda-route).
//  - Belasting onbekend blijft onbekend: belasting_bekend=false, nooit 0
//    (TRV-62). Geschat wordt alleen wat écht rekenbaar is (pct_ftp + duur).
//  - Jeugd fail-closed: leeftijd onbekend → alleen vormen zonder
//    minimumleeftijd (TRV-69, zelfde regel als de bibliotheek).

import { Router } from "express";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  belastingssoorten,
  planSlotsTable,
  plannedSessionsTable,
  plannedWorkoutsTable,
  trainerSlotDefaultsTable,
  trainingFormParametersTable,
  trainingFormsTable,
  type Belastingssoort,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { hasCoachAccess, hasDirectCoachLink } from "../lib/sharing";
import { computeAge } from "../lib/age";
import { recomputeFreshnessForAthlete, startkostX10 } from "../lib/training/freshness";

const router = Router();

const SOORTEN = new Set<string>(belastingssoorten);
const RUIMTES = new Set(["strak", "normaal", "vrij"]);
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ── GET /api/plan/:sporterId/slots?from=&to= ────────────────────────────────
router.get("/:sporterId/slots", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const sporterId = String(req.params.sporterId);
  try {
    if (sporterId !== clerkId && !(await hasCoachAccess(clerkId, sporterId))) {
      return res.status(403).json({ error: "Geen toegang tot dit schema" });
    }
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    const filters = [eq(planSlotsTable.clerkId, sporterId)];
    if (DATUM.test(from)) filters.push(gte(planSlotsTable.datum, from));
    if (DATUM.test(to)) filters.push(lte(planSlotsTable.datum, to));
    const slots = await db
      .select()
      .from(planSlotsTable)
      .where(and(...filters))
      .orderBy(planSlotsTable.datum);
    const sessies = slots.length
      ? await db
          .select()
          .from(plannedSessionsTable)
          .where(inArray(plannedSessionsTable.slotId, slots.map((s) => s.id)))
      : [];
    const bySlot = new Map(sessies.map((s) => [s.slotId, s]));
    return res.json({
      slots: slots.map((s) => ({ ...s, sessie: bySlot.get(s.id) ?? null })),
    });
  } catch (err) {
    console.error("[plan-slots] list failed", err);
    return res.status(500).json({ error: "Schemaplekken laden mislukt" });
  }
});

// ── POST /api/plan/:sporterId/slots — plek aanmaken ─────────────────────────
// Trainer (directe link, herkomst "trainer") of de sporter zelf (herkomst
// "sporter"); de AI-herkomst komt via de interne laag in F8.
router.post("/:sporterId/slots", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const sporterId = String(req.params.sporterId);
  try {
    let herkomst: "trainer" | "sporter";
    if (sporterId === clerkId) herkomst = "sporter";
    else if (await hasDirectCoachLink(clerkId, sporterId)) herkomst = "trainer";
    else return res.status(403).json({ error: "Alleen de sporter zelf of zijn directe trainer" });

    const b = req.body ?? {};
    const datum = str(b.datum);
    const bedoeling = str(b.bedoeling);
    if (!datum || !DATUM.test(datum) || !bedoeling) {
      return res.status(400).json({ error: "datum (YYYY-MM-DD) en bedoeling zijn verplicht" });
    }
    const soort = str(b.belastingssoort);
    if (soort && !SOORTEN.has(soort)) {
      return res.status(400).json({ error: "Onbekende belastingssoort" });
    }
    const [slot] = await db
      .insert(planSlotsTable)
      .values({
        clerkId: sporterId,
        datum,
        bedoeling,
        belastingssoort: soort,
        duurMinMinuten: num(b.duurMin),
        duurMaxMinuten: num(b.duurMax),
        intensiteitsmaat: str(b.intensiteitsmaat),
        intensiteitMin: num(b.intensiteitMin),
        intensiteitMax: num(b.intensiteitMax),
        vervangcategorie: str(b.vervangcategorie),
        herkomst,
        status: "leeg",
      })
      .returning();
    return res.status(201).json({ slot });
  } catch (err) {
    console.error("[plan-slots] create failed", err);
    return res.status(500).json({ error: "Plek aanmaken mislukt" });
  }
});

// ── PATCH /api/plan/slots/:id — bandbreedte (alleen trainer, TRV-20/64) ─────
router.patch("/slots/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const [slot] = await db.select().from(planSlotsTable).where(eq(planSlotsTable.id, id)).limit(1);
    if (!slot) return res.status(404).json({ error: "Plek niet gevonden" });
    if (!(await hasDirectCoachLink(clerkId, slot.clerkId))) {
      return res.status(403).json({ error: "Alleen de directe trainer stelt de bandbreedte in" });
    }
    const b = req.body ?? {};
    const patch: Partial<typeof planSlotsTable.$inferInsert> = {};
    if ("duurMin" in b) patch.duurMinMinuten = num(b.duurMin);
    if ("duurMax" in b) patch.duurMaxMinuten = num(b.duurMax);
    if ("intensiteitMin" in b) patch.intensiteitMin = num(b.intensiteitMin);
    if ("intensiteitMax" in b) patch.intensiteitMax = num(b.intensiteitMax);
    if ("intensiteitsmaat" in b) patch.intensiteitsmaat = str(b.intensiteitsmaat);
    if ("vervangcategorie" in b) patch.vervangcategorie = str(b.vervangcategorie);
    if ("bedoeling" in b) {
      const v = str(b.bedoeling);
      if (!v) return res.status(400).json({ error: "bedoeling mag niet leeg zijn" });
      patch.bedoeling = v;
    }
    if ("belastingssoort" in b) {
      const v = str(b.belastingssoort);
      if (v && !SOORTEN.has(v)) return res.status(400).json({ error: "Onbekende belastingssoort" });
      patch.belastingssoort = v as Belastingssoort | null;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Geen bandbreedtevelden meegegeven" });
    }
    const [updated] = await db
      .update(planSlotsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(planSlotsTable.id, id))
      .returning();
    return res.json({ slot: updated });
  } catch (err) {
    console.error("[plan-slots] patch failed", err);
    return res.status(500).json({ error: "Bandbreedte bijwerken mislukt" });
  }
});

// ── PUT /api/plan/:sporterId/ruimte — strak/normaal/vrij (TRV-33) ───────────
router.put("/:sporterId/ruimte", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const sporterId = String(req.params.sporterId);
  try {
    if (!(await hasDirectCoachLink(clerkId, sporterId))) {
      return res.status(403).json({ error: "Alleen de directe trainer stelt de ruimte in" });
    }
    const ruimte = str((req.body ?? {}).ruimte);
    if (!ruimte || !RUIMTES.has(ruimte)) {
      return res.status(400).json({ error: "ruimte moet strak, normaal of vrij zijn" });
    }
    const [row] = await db
      .insert(trainerSlotDefaultsTable)
      .values({ trainerClerkId: clerkId, sporterClerkId: sporterId, ruimte })
      .onConflictDoUpdate({
        target: [trainerSlotDefaultsTable.trainerClerkId, trainerSlotDefaultsTable.sporterClerkId],
        set: { ruimte, geldigVanaf: new Date(), updatedAt: new Date() },
      })
      .returning();
    return res.json({ ruimte: row });
  } catch (err) {
    console.error("[plan-slots] ruimte failed", err);
    return res.status(500).json({ error: "Ruimte instellen mislukt" });
  }
});

// ── POST /api/plan/slots/:id/sessie — vorm plaatsen (TRV-39/40/41) ──────────
router.post("/slots/:id/sessie", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const [slot] = await db.select().from(planSlotsTable).where(eq(planSlotsTable.id, id)).limit(1);
    if (!slot) return res.status(404).json({ error: "Plek niet gevonden" });

    let keuzebron: "sporter" | "trainer";
    if (slot.clerkId === clerkId) keuzebron = "sporter";
    else if (await hasDirectCoachLink(clerkId, slot.clerkId)) keuzebron = "trainer";
    else return res.status(403).json({ error: "Alleen de sporter zelf of zijn directe trainer" });

    const b = req.body ?? {};
    const formId = num(b.formId);
    if (!formId) return res.status(400).json({ error: "formId is verplicht" });
    const [form] = await db
      .select()
      .from(trainingFormsTable)
      .where(eq(trainingFormsTable.id, formId))
      .limit(1);
    if (!form || form.status !== "gepubliceerd") {
      return res.status(404).json({ error: "Vorm niet gevonden of niet gepubliceerd" });
    }
    if (form.vereistAfspraak) {
      // TRV-50: afspraakvormen zijn geen gewone sleepbare training.
      return res.status(422).json({
        error: "Deze vorm vereist een afspraak (baan/derny/motor) en is niet als losse training plaatsbaar",
      });
    }
    // Jeugd fail-closed (TRV-69/85): leeftijd onbekend → alleen vormen zonder
    // minimumleeftijd.
    if (form.minimumLeeftijd != null) {
      const [athlete] = await db
        .select({ birthDate: athleteProfilesTable.birthDate })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, slot.clerkId))
        .limit(1);
      const age = athlete?.birthDate ? computeAge(String(athlete.birthDate), null) : null;
      if (age == null || age < form.minimumLeeftijd) {
        return res.status(403).json({ error: "Deze vorm is niet geschikt voor deze leeftijd" });
      }
    }

    const [params] = await db
      .select()
      .from(trainingFormParametersTable)
      .where(eq(trainingFormParametersTable.formId, formId))
      .limit(1);

    // Gekozen parameters, binnen de PARAMETERBEREIKEN van de vorm (TRV-39):
    // buiten het familiebereik is geen "afwijking" maar een ongeldige keuze.
    const duur = num(b.duurMinuten) ?? params?.duurStandaardMinuten ?? null;
    const intensiteit = num(b.intensiteit) ?? params?.intensiteitStandaard ?? null;
    if (duur == null) return res.status(400).json({ error: "duurMinuten is verplicht (de vorm heeft geen standaardduur)" });
    if (params?.duurMinuten != null && duur < params.duurMinuten) {
      return res.status(400).json({ error: `Duur onder het bereik van de vorm (min ${params.duurMinuten} min)` });
    }
    if (params?.duurMaxMinuten != null && duur > params.duurMaxMinuten) {
      return res.status(400).json({ error: `Duur boven het bereik van de vorm (max ${params.duurMaxMinuten} min)` });
    }
    if (intensiteit != null) {
      if (params?.intensiteitMin != null && intensiteit < params.intensiteitMin) {
        return res.status(400).json({ error: "Intensiteit onder het bereik van de vorm" });
      }
      if (params?.intensiteitMax != null && intensiteit > params.intensiteitMax) {
        return res.status(400).json({ error: "Intensiteit boven het bereik van de vorm" });
      }
    }

    // Plekstatus (TRV-40/41): binnen bandbreedte → vervuld; eroverheen of
    // andere vervangcategorie → afgeweken, met vastlegging van wat losgelaten is.
    const afwijkingen: string[] = [];
    if (slot.duurMinMinuten != null && duur < slot.duurMinMinuten) {
      afwijkingen.push(`duur ${duur} min onder de plek-bandbreedte (min ${slot.duurMinMinuten})`);
    }
    if (slot.duurMaxMinuten != null && duur > slot.duurMaxMinuten) {
      afwijkingen.push(`duur ${duur} min boven de plek-bandbreedte (max ${slot.duurMaxMinuten})`);
    }
    if (
      intensiteit != null &&
      slot.intensiteitsmaat != null &&
      (params?.intensiteitsmaat ?? null) === slot.intensiteitsmaat
    ) {
      if (slot.intensiteitMin != null && intensiteit < slot.intensiteitMin) {
        afwijkingen.push(`intensiteit ${intensiteit} onder de plek-bandbreedte (min ${slot.intensiteitMin})`);
      }
      if (slot.intensiteitMax != null && intensiteit > slot.intensiteitMax) {
        afwijkingen.push(`intensiteit ${intensiteit} boven de plek-bandbreedte (max ${slot.intensiteitMax})`);
      }
    }
    if (slot.vervangcategorie && form.categorie !== slot.vervangcategorie) {
      afwijkingen.push(`vorm uit categorie "${form.categorie}" i.p.v. "${slot.vervangcategorie}"`);
    } else if (!slot.vervangcategorie && slot.belastingssoort && form.belastingssoort !== slot.belastingssoort) {
      afwijkingen.push(
        `belastingssoort "${form.belastingssoort}" i.p.v. "${slot.belastingssoort}"`,
      );
    }
    const status = afwijkingen.length > 0 ? "afgeweken" : "vervuld";

    // Belasting alleen als hij écht rekenbaar is (TRV-62): pct_ftp + duur.
    const maat = params?.intensiteitsmaat ?? null;
    let geschatteBelasting: number | null = null;
    if (maat === "pct_ftp" && intensiteit != null) {
      geschatteBelasting = Math.round((duur / 60) * Math.pow(intensiteit / 100, 2) * 100);
    }
    const soort = form.belastingssoort as Belastingssoort;
    const frisheidskost = { [soort]: startkostX10(soort, duur) / 10 };

    const result = await db.transaction(async (tx) => {
      const [bestaand] = await tx
        .select({ id: plannedSessionsTable.id })
        .from(plannedSessionsTable)
        .where(eq(plannedSessionsTable.slotId, slot.id))
        .limit(1);
      if (bestaand) return { conflict: true as const };

      const [workout] = await tx
        .insert(plannedWorkoutsTable)
        .values({
          clerkId: slot.clerkId,
          scheduledDate: slot.datum,
          type: form.discipline === "wandelen" ? "walk" : "ride",
          title: form.naam,
          description: form.doel ?? form.categorie,
          targetDurationMin: duur,
          targetTSS: geschatteBelasting,
          belastingssoort: soort,
          status: "planned",
          source: keuzebron === "trainer" ? "coach" : "sparki",
          coachClerkId: keuzebron === "trainer" ? clerkId : null,
        })
        .returning({ id: plannedWorkoutsTable.id });

      const [sessie] = await tx
        .insert(plannedSessionsTable)
        .values({
          slotId: slot.id,
          formId,
          plannedWorkoutId: workout!.id,
          gekozenParameters: {
            duurMinuten: duur,
            intensiteit: intensiteit ?? undefined,
            intensiteitsmaat: maat ?? undefined,
          },
          geschatteBelasting,
          belastingBekend: geschatteBelasting != null,
          frisheidskostPerSoort: frisheidskost,
          keuzebron,
        })
        .returning();

      const [updatedSlot] = await tx
        .update(planSlotsTable)
        .set({
          status,
          afwijkingstoelichting: afwijkingen.length ? afwijkingen.join("; ") : null,
          updatedAt: new Date(),
        })
        .where(eq(planSlotsTable.id, slot.id))
        .returning();
      return { conflict: false as const, sessie, slot: updatedSlot };
    });
    if (result.conflict) {
      return res.status(409).json({ error: "Deze plek heeft al een sessie — verwijder die eerst" });
    }

    await recomputeFreshnessForAthlete(slot.clerkId);
    return res.status(201).json({ sessie: result.sessie, slot: result.slot });
  } catch (err) {
    console.error("[plan-slots] place failed", err);
    return res.status(500).json({ error: "Vorm plaatsen mislukt" });
  }
});

// ── DELETE /api/plan/slots/:id/sessie — plaatsing weghalen ──────────────────
router.delete("/slots/:id/sessie", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const [slot] = await db.select().from(planSlotsTable).where(eq(planSlotsTable.id, id)).limit(1);
    if (!slot) return res.status(404).json({ error: "Plek niet gevonden" });
    if (slot.clerkId !== clerkId && !(await hasDirectCoachLink(clerkId, slot.clerkId))) {
      return res.status(403).json({ error: "Alleen de sporter zelf of zijn directe trainer" });
    }
    const [sessie] = await db
      .select()
      .from(plannedSessionsTable)
      .where(eq(plannedSessionsTable.slotId, slot.id))
      .limit(1);
    if (!sessie) return res.status(404).json({ error: "Deze plek heeft geen sessie" });

    await db.transaction(async (tx) => {
      if (sessie.plannedWorkoutId != null) {
        await tx
          .delete(plannedWorkoutsTable)
          .where(
            and(
              eq(plannedWorkoutsTable.id, sessie.plannedWorkoutId),
              eq(plannedWorkoutsTable.clerkId, slot.clerkId),
            ),
          );
      }
      await tx.delete(plannedSessionsTable).where(eq(plannedSessionsTable.id, sessie.id));
      await tx
        .update(planSlotsTable)
        .set({ status: "leeg", afwijkingstoelichting: null, updatedAt: new Date() })
        .where(eq(planSlotsTable.id, slot.id));
    });
    await recomputeFreshnessForAthlete(slot.clerkId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[plan-slots] remove failed", err);
    return res.status(500).json({ error: "Sessie weghalen mislukt" });
  }
});

export default router;
