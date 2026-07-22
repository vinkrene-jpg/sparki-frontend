// Golf 21 — Beheer van de beheerde kennislaag (alleen beheerders).
import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  managedKnowledgeItemsTable,
  managedKnowledgeVersionsTable,
  knowledgeFeedbackTable,
  managedKnowledgeDomains,
  managedKnowledgeReliabilities,
  managedKnowledgeAudiences,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";
import {
  publishKnowledgeItem,
  setKnowledgeStatus,
  findKnowledgeConflicts,
  findStaleKnowledge,
  knowledgeUsageByEngine,
} from "../lib/knowledge/governance";

const router = Router();

async function requireAdminMw(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId || !(await isAdmin(clerkId))) {
    res.status(403).json({ error: "Alleen beheerders" });
    return;
  }
  next();
}

router.use(requireAuth, requireAdminMw);

// Overzicht: items + conflicten + verouderingssignaal + gebruik + feedback.
router.get("/", async (req, res) => {
  try {
    const [items, conflicts, stale, usage, feedback] = await Promise.all([
      db
        .select()
        .from(managedKnowledgeItemsTable)
        .orderBy(desc(managedKnowledgeItemsTable.updatedAt)),
      findKnowledgeConflicts(),
      findStaleKnowledge(),
      knowledgeUsageByEngine(),
      db
        .select()
        .from(knowledgeFeedbackTable)
        .orderBy(desc(knowledgeFeedbackTable.createdAt))
        .limit(100),
    ]);
    return res.json({ items, conflicts, stale, usage, feedback });
  } catch (err) {
    req.log.error({ err }, "knowledge-admin overview failed");
    return res.status(500).json({ error: "Overzicht kon niet worden geladen" });
  }
});

function cleanItemBody(body: Record<string, unknown>) {
  const s = (k: string, max = 4000) => {
    const v = body[k];
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  };
  const topic = s("topic", 200);
  const domain = s("domain", 40);
  const bodyText = s("body", 8000);
  const sourceName = s("sourceName", 300);
  if (!topic || !domain || !bodyText || !sourceName)
    return { error: "topic, domain, body en sourceName zijn verplicht" } as const;
  if (!(managedKnowledgeDomains as readonly string[]).includes(domain))
    return { error: "Ongeldig domein" } as const;
  const reliability = s("reliability", 20) ?? "gemiddeld";
  if (!(managedKnowledgeReliabilities as readonly string[]).includes(reliability))
    return { error: "Ongeldige betrouwbaarheid" } as const;
  const audience = s("audience", 20) ?? "iedereen";
  if (!(managedKnowledgeAudiences as readonly string[]).includes(audience))
    return { error: "Ongeldige doelgroep" } as const;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const publishedAt = s("publishedAt", 10);
  const reviewedAt = s("reviewedAt", 10);
  if ((publishedAt && !dateRe.test(publishedAt)) || (reviewedAt && !dateRe.test(reviewedAt)))
    return { error: "Datums moeten JJJJ-MM-DD zijn" } as const;
  return {
    values: {
      topic,
      domain,
      discipline: s("discipline", 60),
      audience,
      body: bodyText,
      limitations: s("limitations", 1000),
      professionalCheck: s("professionalCheck", 1000),
      sourceName,
      sourceUrl: s("sourceUrl", 800),
      publishedAt,
      reviewedAt,
      reliability,
    },
  } as const;
}

// Nieuw kennisitem (start als concept).
router.post("/items", async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const parsed = cleanItemBody(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  try {
    const [row] = await db
      .insert(managedKnowledgeItemsTable)
      .values({ ...parsed.values, ownerClerkId: clerkId })
      .returning();
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "knowledge-admin create failed");
    return res.status(500).json({ error: "Kennisitem kon niet worden aangemaakt" });
  }
});

// Wijzigen (inhoudelijke wijziging zet het item terug naar concept totdat
// opnieuw gepubliceerd — nooit stil een actieve tekst veranderen).
router.put("/items/:id", async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  const parsed = cleanItemBody(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  try {
    const [existing] = await db
      .select()
      .from(managedKnowledgeItemsTable)
      .where(eq(managedKnowledgeItemsTable.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Kennisitem niet gevonden" });
    if (existing.status === "ingetrokken")
      return res.status(409).json({ error: "Ingetrokken kennis wordt niet meer gewijzigd" });
    const [row] = await db
      .update(managedKnowledgeItemsTable)
      .set({
        ...parsed.values,
        status: existing.status === "actief" ? "concept" : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(managedKnowledgeItemsTable.id, id))
      .returning();
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "knowledge-admin update failed");
    return res.status(500).json({ error: "Kennisitem kon niet worden gewijzigd" });
  }
});

// Publiceren: versie omhoog + snapshot.
router.post("/items/:id/publiceer", async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const result = await publishKnowledgeItem(id, getClerkUserId(req)!);
    if (!result.ok) return res.status(409).json({ error: result.error });
    return res.json({ ok: true, version: result.version });
  } catch (err) {
    req.log.error({ err }, "knowledge-admin publish failed");
    return res.status(500).json({ error: "Publiceren mislukt" });
  }
});

// Status: verouderd / ingetrokken / terug naar concept.
router.post("/items/:id/status", async (req, res) => {
  const id = Number(String(req.params.id));
  const { status, reason } = (req.body ?? {}) as { status?: string; reason?: string };
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  if (!status || !["verouderd", "ingetrokken", "concept"].includes(status))
    return res.status(400).json({ error: "status moet verouderd, ingetrokken of concept zijn" });
  try {
    const ok = await setKnowledgeStatus(
      id,
      status as "verouderd" | "ingetrokken" | "concept",
      typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null,
    );
    if (!ok) return res.status(404).json({ error: "Kennisitem niet gevonden" });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "knowledge-admin status failed");
    return res.status(500).json({ error: "Status kon niet worden gewijzigd" });
  }
});

// Versiehistorie van een item.
router.get("/items/:id/versies", async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const rows = await db
      .select()
      .from(managedKnowledgeVersionsTable)
      .where(eq(managedKnowledgeVersionsTable.itemId, id))
      .orderBy(desc(managedKnowledgeVersionsTable.version));
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "knowledge-admin versions failed");
    return res.status(500).json({ error: "Versies konden niet worden geladen" });
  }
});

// Feedback afhandelen.
router.post("/feedback/:id/afhandelen", async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ongeldig id" });
  try {
    const rows = await db
      .update(knowledgeFeedbackTable)
      .set({
        status: "afgehandeld",
        resolvedBy: getClerkUserId(req)!,
        resolvedAt: new Date(),
      })
      .where(eq(knowledgeFeedbackTable.id, id))
      .returning({ id: knowledgeFeedbackTable.id });
    if (rows.length === 0) return res.status(404).json({ error: "Feedback niet gevonden" });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "knowledge-admin feedback resolve failed");
    return res.status(500).json({ error: "Feedback kon niet worden afgehandeld" });
  }
});

export default router;
