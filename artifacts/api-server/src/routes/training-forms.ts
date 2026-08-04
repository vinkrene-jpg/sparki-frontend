// TRAININGSVORMEN_01 F1 — bibliotheek-API (TRV-26/27/45/46/49).
//
// Zichtbaarheidsregels (TRV-45):
//  - Sparki-vormen: status "gepubliceerd" zichtbaar voor iedereen.
//  - Trainersvormen "prive": alleen de eigenaar zelf en sporters met een
//    geaccepteerde directe link met die trainer.
//  - Trainersvormen "marktplaats": leesbaar voor iedereen (publiceren zonder
//    prijs, TRV-95; koop/licentie is een latere opdracht).
//  - Status "concept" is voor sporters onzichtbaar (TRV-27); de eigenaar ziet
//    zijn eigen concepten wel.
// Jeugd (TRV-49/85): leeftijd onbekend = fail-closed → alleen vormen zonder
// minimumleeftijd. Trainersvormen dragen ALTIJD label "praktijkvorm" (TRV-46).

import { Router } from "express";
import { and, eq, inArray, or, isNull, lte } from "drizzle-orm";
import {
  db,
  trainingFormsTable,
  trainingFormParametersTable,
  trainingFormSourcesTable,
  athleteProfilesTable,
  userProfilesTable,
  trainingFormDisciplines,
  belastingssoorten,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  FRESHNESS_METHODE,
  freshnessForRange,
  recomputeFreshnessForAthlete,
} from "../lib/training/freshness";
import { computeAge } from "../lib/age";
import { hasAcceptedCoachLink } from "../lib/sharing";

const router = Router();


const DISCIPLINES = new Set<string>(trainingFormDisciplines);
const SOORTEN = new Set<string>(belastingssoorten);
const ZICHTBAARHEDEN = new Set(["prive", "marktplaats"]);
const MAAT = new Set(["pct_ftp", "zone", "rpe", "kg", "herhalingen"]);

// Jeugdgrens bij opslaan (TRV-49): tekst die gewicht-/1RM-/caloriedoelen
// draagt wordt geweigerd tenzij de vorm expliciet 18+ is.
const YOUTH_FORBIDDEN = /\b(1\s?rm|one\s?rep\s?max|gewichtsdoel|streefgewicht|afvallen|kcal|calorie\w*)\b/i;

async function loadRequester(clerkId: string) {
  const [user] = await db
    .select({ roles: userProfilesTable.roles })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId))
    .limit(1);
  const [athlete] = await db
    .select({ dateOfBirth: athleteProfilesTable.birthDate })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const roles: string[] = Array.isArray(user?.roles) ? (user!.roles as string[]) : [];
  const isTrainer = roles.includes("coach") || roles.includes("trainer");
  const age = athlete?.dateOfBirth ? computeAge(String(athlete.dateOfBirth), null) : null;
  return { exists: Boolean(user), isTrainer, age };
}

function ageAllowed(minLeeftijd: number | null, age: number | null): boolean {
  if (minLeeftijd == null) return true;
  // Fail-closed: leeftijd onbekend → vorm met leeftijdsgrens niet tonen.
  return age != null && age >= minLeeftijd;
}

async function visibleTo(form: typeof trainingFormsTable.$inferSelect, clerkId: string): Promise<boolean> {
  if (form.eigenaarType === "sparki") return form.status === "gepubliceerd";
  if (form.eigenaarClerkId === clerkId) return true;
  if (form.status !== "gepubliceerd") return false;
  if (form.zichtbaarheid === "marktplaats") return true;
  if (form.zichtbaarheid === "prive" && form.eigenaarClerkId) {
    return hasAcceptedCoachLink(form.eigenaarClerkId, clerkId);
  }
  return false;
}

// GET /api/training-forms?discipline=&belastingssoort=&categorie=
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const requester = await loadRequester(clerkId);
    const filters = [] as ReturnType<typeof eq>[];
    const discipline = String(req.query.discipline ?? "");
    const soort = String(req.query.belastingssoort ?? "");
    if (discipline) {
      if (!DISCIPLINES.has(discipline)) return res.status(400).json({ error: "Onbekende discipline" });
      filters.push(eq(trainingFormsTable.discipline, discipline));
    }
    if (soort) {
      if (!SOORTEN.has(soort)) return res.status(400).json({ error: "Onbekende belastingssoort" });
      filters.push(eq(trainingFormsTable.belastingssoort, soort));
    }

    const rows = await db
      .select()
      .from(trainingFormsTable)
      .where(
        and(
          ...filters,
          or(
            // Sparki + marktplaats gepubliceerd
            and(
              eq(trainingFormsTable.status, "gepubliceerd"),
              or(
                eq(trainingFormsTable.eigenaarType, "sparki"),
                eq(trainingFormsTable.zichtbaarheid, "marktplaats"),
              ),
            ),
            // Eigen vormen (ook concept)
            eq(trainingFormsTable.eigenaarClerkId, clerkId),
            // Privé-trainersvormen: kandidaat; link-check hieronder
            and(
              eq(trainingFormsTable.status, "gepubliceerd"),
              eq(trainingFormsTable.zichtbaarheid, "prive"),
              eq(trainingFormsTable.eigenaarType, "trainer"),
            ),
          ),
        ),
      );

    const out: typeof rows = [];
    const linkCache = new Map<string, boolean>();
    for (const f of rows) {
      if (!ageAllowed(f.minimumLeeftijd, requester.age)) continue;
      if (f.eigenaarType === "trainer" && f.eigenaarClerkId !== clerkId && f.zichtbaarheid === "prive") {
        const key = f.eigenaarClerkId ?? "";
        if (!linkCache.has(key)) {
          linkCache.set(key, key ? await hasAcceptedCoachLink(key, clerkId) : false);
        }
        if (!linkCache.get(key)) continue;
      }
      out.push(f);
    }

    const ids = out.map((f) => f.id);
    const params = ids.length
      ? await db.select().from(trainingFormParametersTable).where(inArray(trainingFormParametersTable.formId, ids))
      : [];
    const byForm = new Map(params.map((p) => [p.formId, p]));

    return res.json({
      vormen: out.map((f) => ({
        id: f.id,
        slug: f.slug,
        naam: f.naam,
        discipline: f.discipline,
        categorie: f.categorie,
        belastingssoort: f.belastingssoort,
        onderbouwingsniveau: f.onderbouwingsniveau,
        onderbouwingstoelichting: f.onderbouwingstoelichting,
        eigenaarType: f.eigenaarType,
        zichtbaarheid: f.zichtbaarheid,
        vereistAfspraak: f.vereistAfspraak,
        status: f.status,
        minimumLeeftijd: f.minimumLeeftijd,
        parameters: byForm.get(f.id) ?? null,
      })),
    });
  } catch (err) {
    console.error("[training-forms] list failed", err);
    return res.status(500).json({ error: "Bibliotheek laden mislukt" });
  }
});

// GET /api/training-forms/freshness?from=&to= — F2 (TRV-30/31/96).
// Frisheidskost per belastingssoort per dag. Uitdrukkelijk gemarkeerd als
// coachregel, geen gevalideerd model. Soorten zonder bekende kost ontbreken
// in perSoort — dat is "onbekend", nooit 0 (TRV-62).
router.get("/freshness", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const DATUM = /^\d{4}-\d{2}-\d{2}$/;
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (!DATUM.test(from) || !DATUM.test(to) || to < from) {
    return res.status(400).json({ error: "from/to (YYYY-MM-DD, from ≤ to) zijn verplicht" });
  }
  if (daysSpan(from, to) > 62) {
    return res.status(400).json({ error: "Bereik maximaal 62 dagen" });
  }
  try {
    await recomputeFreshnessForAthlete(clerkId);
    const dagen = await freshnessForRange(clerkId, from, to);
    return res.json({
      methode: FRESHNESS_METHODE,
      // Bindende markering (TRV-30/96): dit is een coachregel, geen model.
      coachregel: true,
      toelichting:
        "Frisheidskost is een coachregel (schaal 0–3 per belastingssoort), geen gevalideerd model.",
      dagen: dagen.map((d) => ({ datum: d.datum, perSoort: d.perSoort })),
    });
  } catch (err) {
    console.error("[training-forms] freshness failed", err);
    return res.status(500).json({ error: "Frisheid laden mislukt" });
  }
});

function daysSpan(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

// GET /api/training-forms/:id — detail met parameters + bronnen
router.get("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const requester = await loadRequester(clerkId);
    const [form] = await db.select().from(trainingFormsTable).where(eq(trainingFormsTable.id, id)).limit(1);
    if (!form || !(await visibleTo(form, clerkId)) || !ageAllowed(form.minimumLeeftijd, requester.age)) {
      return res.status(404).json({ error: "Vorm niet gevonden" });
    }
    const [params] = await db
      .select()
      .from(trainingFormParametersTable)
      .where(eq(trainingFormParametersTable.formId, id))
      .limit(1);
    const bronnen = await db
      .select()
      .from(trainingFormSourcesTable)
      .where(eq(trainingFormSourcesTable.formId, id));
    return res.json({ vorm: form, parameters: params ?? null, bronnen });
  } catch (err) {
    console.error("[training-forms] detail failed", err);
    return res.status(500).json({ error: "Vorm laden mislukt" });
  }
});

type FormBody = {
  naam?: unknown;
  discipline?: unknown;
  categorie?: unknown;
  belastingssoort?: unknown;
  doel?: unknown;
  uitleg?: unknown;
  gebruik?: unknown;
  veelgemaakteFouten?: unknown;
  zichtbaarheid?: unknown;
  minimumLeeftijd?: unknown;
  parameters?: Record<string, unknown> | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

function youthCheck(body: { minimumLeeftijd: number | null; texts: (string | null)[] }): string | null {
  const adultOnly = body.minimumLeeftijd != null && body.minimumLeeftijd >= 18;
  if (adultOnly) return null;
  for (const t of body.texts) {
    if (t && YOUTH_FORBIDDEN.test(t)) {
      return "Deze vorm bevat gewichts-, 1RM- of caloriedoelen en kan niet worden opgeslagen voor jeugdgeschikte vormen. Zet een minimumleeftijd van 18 of pas de tekst aan.";
    }
  }
  return null;
}

// POST /api/training-forms — trainersvorm aanmaken (default privé, concept)
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const requester = await loadRequester(clerkId);
    if (!requester.isTrainer) return res.status(403).json({ error: "Alleen trainers kunnen vormen aanmaken" });
    const b = (req.body ?? {}) as FormBody;
    const naam = str(b.naam);
    const discipline = str(b.discipline);
    const categorie = str(b.categorie) ?? "Eigen vormen";
    const soort = str(b.belastingssoort);
    if (!naam || !discipline || !DISCIPLINES.has(discipline)) {
      return res.status(400).json({ error: "naam en geldige discipline zijn verplicht" });
    }
    if (!soort || !SOORTEN.has(soort)) {
      return res.status(400).json({ error: "geldige belastingssoort is verplicht" });
    }
    const zichtbaarheid = str(b.zichtbaarheid) ?? "prive";
    if (!ZICHTBAARHEDEN.has(zichtbaarheid)) {
      return res.status(400).json({ error: "zichtbaarheid moet prive of marktplaats zijn" });
    }
    const minimumLeeftijd = num(b.minimumLeeftijd);
    const texts = [str(b.doel), str(b.uitleg), str(b.gebruik), str(b.veelgemaakteFouten), naam];
    const youthErr = youthCheck({ minimumLeeftijd, texts });
    if (youthErr) return res.status(400).json({ error: youthErr });

    const slug = `trainer-${clerkId.slice(-8)}-${naam.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 120);

    const [row] = await db
      .insert(trainingFormsTable)
      .values({
        slug,
        naam,
        discipline,
        categorie,
        belastingssoort: soort,
        doel: str(b.doel),
        uitleg: str(b.uitleg),
        gebruik: str(b.gebruik),
        veelgemaakteFouten: str(b.veelgemaakteFouten),
        // TRV-46: trainersvormen dragen ALTIJD praktijkvorm.
        onderbouwingsniveau: "praktijkvorm",
        onderbouwingstoelichting: "eigen vorm van de trainer",
        minimumLeeftijd,
        eigenaarType: "trainer",
        eigenaarClerkId: clerkId,
        zichtbaarheid,
        status: "concept",
      })
      .onConflictDoNothing({ target: trainingFormsTable.slug })
      .returning();
    if (!row) return res.status(409).json({ error: "Je hebt al een vorm met deze naam" });

    const p = b.parameters ?? null;
    if (p) {
      const maat = str(p.intensiteitsmaat);
      if (maat && !MAAT.has(maat)) return res.status(400).json({ error: "Onbekende intensiteitsmaat" });
      await db.insert(trainingFormParametersTable).values({
        formId: row.id,
        duurMinuten: num(p.duurMin),
        duurMaxMinuten: num(p.duurMax),
        duurStandaardMinuten: num(p.duurStandaard),
        intensiteitsmaat: maat,
        intensiteitMin: num(p.intensiteitMin),
        intensiteitMax: num(p.intensiteitMax),
        intensiteitStandaard: num(p.intensiteitStandaard),
        herhalingenMin: num(p.herhalingenMin),
        herhalingenMax: num(p.herhalingenMax),
        pauzeMinMinuten: num(p.pauzeMin),
        pauzeMaxMinuten: num(p.pauzeMax),
      });
    }
    return res.status(201).json({ id: row.id, slug: row.slug, status: row.status });
  } catch (err) {
    console.error("[training-forms] create failed", err);
    return res.status(500).json({ error: "Vorm aanmaken mislukt" });
  }
});

// POST /api/training-forms/:id/publiceren — concept → gepubliceerd
// Eist geschreven uitleg (TRV-27) en doorloopt de jeugdcheck opnieuw (TRV-49).
router.post("/:id/publiceren", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const [form] = await db.select().from(trainingFormsTable).where(eq(trainingFormsTable.id, id)).limit(1);
    if (!form || form.eigenaarClerkId !== clerkId) return res.status(404).json({ error: "Vorm niet gevonden" });
    if (!form.uitleg || !form.uitleg.trim()) {
      return res.status(400).json({ error: "Publiceren kan pas als de vorm een geschreven uitleg heeft" });
    }
    const youthErr = youthCheck({
      minimumLeeftijd: form.minimumLeeftijd,
      texts: [form.naam, form.doel, form.uitleg, form.gebruik, form.veelgemaakteFouten],
    });
    if (youthErr) return res.status(400).json({ error: youthErr });
    await db
      .update(trainingFormsTable)
      .set({ status: "gepubliceerd", updatedAt: new Date() })
      .where(eq(trainingFormsTable.id, id));
    return res.json({ id, status: "gepubliceerd" });
  } catch (err) {
    console.error("[training-forms] publish failed", err);
    return res.status(500).json({ error: "Publiceren mislukt" });
  }
});

export default router;
