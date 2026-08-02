// SPARKI_BUILD_04 F5 — factuurmodel 1: terugkerende coaching.
//
// Bindend:
// - BB-63: geld loopt NOOIT via Sparki; dit is administratie.
// - BB-69: Sparki maakt CONCEPTEN klaar; de trainer controleert en verzendt.
//   Geen blind automatisch verzenden — er bestaat hier geen pad dat een
//   factuur zonder expliciete trainer-actie op "verzonden" zet.
// - BB-64: nummertoekenning server-side bij verzending (F8); een concept
//   heeft GEEN nummer.
// - Conceptgeneratie is idempotent via recurring_billing.billedThrough:
//   nooit twee concepten voor dezelfde periode.
//
// Signalen (3c.4, altijd voorstel, nooit actie): "conceptfactuur staat
// klaar", "vervalt over drie dagen", "btw-nummer ontbreekt bij KLANT/JOU".

import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  trainerServicesTable,
  recurringBillingTable,
  trainerInvoicesTable,
  trainerInvoiceLinesTable,
  trainerClientsTable,
  trainerBusinessTable,
  workObjectsTable,
  SERVICE_UNITS,
  BILLING_CYCLES,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function int(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}
// Datumrekenen op kalenderdagen — bewust op UTC-veilige date-strings
// (YYYY-MM-DD) zonder tijdzone-conversie: we schuiven alleen met dagen.
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}
function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}
function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

async function ownedClient(clientId: number, trainerClerkId: string) {
  const [c] = await db
    .select()
    .from(trainerClientsTable)
    .where(
      and(
        eq(trainerClientsTable.id, clientId),
        eq(trainerClientsTable.trainerClerkId, trainerClerkId),
      ),
    );
  return c ?? null;
}

// ── Diensten (4.3) ───────────────────────────────────────────────────────────
router.get("/services", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  res.json(
    await db
      .select()
      .from(trainerServicesTable)
      .where(eq(trainerServicesTable.trainerClerkId, trainerClerkId))
      .orderBy(desc(trainerServicesTable.createdAt)),
  );
});

router.post("/services", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const name = str(req.body?.name);
    const priceCents = int(req.body?.priceCents);
    const unit = str(req.body?.unit) ?? "maand";
    if (!name || priceCents === null || priceCents < 0) {
      res.status(400).json({ error: "name en priceCents (≥0) zijn verplicht." });
      return;
    }
    if (!(SERVICE_UNITS as readonly string[]).includes(unit)) {
      res.status(400).json({ error: "unit moet maand, week, blok of losse_sessie zijn." });
      return;
    }
    const vatRateBps = int(req.body?.vatRateBps) ?? 2100;
    const [row] = await db
      .insert(trainerServicesTable)
      .values({
        trainerClerkId,
        name,
        description: str(req.body?.description),
        priceCents,
        vatRateBps,
        unit,
        durationNote: str(req.body?.durationNote),
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "trainer service create failed");
    res.status(500).json({ error: "Dienst aanmaken is niet gelukt." });
  }
});

// ── Terugkerende coaching (4.4) ──────────────────────────────────────────────
router.get("/recurring-billing", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  res.json(
    await db
      .select()
      .from(recurringBillingTable)
      .where(eq(recurringBillingTable.trainerClerkId, trainerClerkId))
      .orderBy(desc(recurringBillingTable.createdAt)),
  );
});

router.post("/recurring-billing", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const clientId = int(req.body?.clientId);
    const cycle = str(req.body?.cycle);
    const description = str(req.body?.description);
    const amountCents = int(req.body?.amountCents);
    const startDate = str(req.body?.startDate);
    if (!clientId || !cycle || !description || amountCents === null || !startDate) {
      res.status(400).json({
        error: "clientId, cycle, description, amountCents en startDate zijn verplicht.",
      });
      return;
    }
    if (!(BILLING_CYCLES as readonly string[]).includes(cycle)) {
      res.status(400).json({ error: "cycle moet wekelijks of maandelijks zijn." });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      res.status(400).json({ error: "startDate moet JJJJ-MM-DD zijn." });
      return;
    }
    const endDate = str(req.body?.endDate);
    if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate)) {
      res.status(400).json({ error: "endDate moet JJJJ-MM-DD zijn en na startDate liggen." });
      return;
    }
    if (!(await ownedClient(clientId, trainerClerkId))) {
      res.status(404).json({ error: "Klant niet gevonden." });
      return;
    }
    const [row] = await db
      .insert(recurringBillingTable)
      .values({
        trainerClerkId,
        clientId,
        cycle,
        description,
        amountCents,
        vatRateBps: int(req.body?.vatRateBps) ?? 2100,
        korApplied: req.body?.korApplied === true,
        startDate,
        endDate,
        paymentTermDays: int(req.body?.paymentTermDays) ?? 14,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "recurring billing create failed");
    res.status(500).json({ error: "Cyclus aanmaken is niet gelukt." });
  }
});

// ── Conceptfacturen genereren uit cycli (BB-69: alleen concepten) ────────────
// POST /run-drafts { today?: "JJJJ-MM-DD" } — maakt voor elke actieve cyclus
// de verstreken, nog niet gefactureerde periodes als CONCEPT aan. Idempotent
// via billedThrough. `today` is er voor tests; default = vandaag (Amsterdam).
router.post("/recurring-billing/run-drafts", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const todayParam = str(req.body?.today);
    const today =
      todayParam && /^\d{4}-\d{2}-\d{2}$/.test(todayParam)
        ? todayParam
        : new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());

    const cycles = await db
      .select()
      .from(recurringBillingTable)
      .where(
        and(
          eq(recurringBillingTable.trainerClerkId, trainerClerkId),
          eq(recurringBillingTable.active, true),
        ),
      );

    const created: unknown[] = [];
    for (const cyc of cycles) {
      let periodStart = cyc.billedThrough ? addDays(cyc.billedThrough, 1) : cyc.startDate;
      // Beveiliging tegen oneindige lussen: max 60 periodes per run.
      for (let i = 0; i < 60; i++) {
        if (cyc.endDate && periodStart > cyc.endDate) break;
        const rawEnd =
          cyc.cycle === "wekelijks" ? addDays(periodStart, 6) : endOfMonth(periodStart);
        const periodEnd = cyc.endDate ? minIso(rawEnd, cyc.endDate) : rawEnd;
        // Alleen volledig verstreken periodes worden klaargezet.
        if (periodEnd >= today) break;

        const row = await db.transaction(async (tx) => {
          const vat = cyc.korApplied
            ? 0
            : Math.round((cyc.amountCents * cyc.vatRateBps) / 10000);
          const [inv] = await tx
            .insert(trainerInvoicesTable)
            .values({
              trainerClerkId,
              clientId: cyc.clientId,
              periodStart,
              periodEnd,
              dueDate: addDays(periodEnd, cyc.paymentTermDays),
              description: cyc.description,
              amountExclCents: cyc.amountCents,
              vatBreakdown: cyc.korApplied ? { kor: 0 } : { [String(cyc.vatRateBps)]: vat },
              amountInclCents: cyc.amountCents + vat,
              korApplied: cyc.korApplied,
              status: "concept",
              recurringBillingId: cyc.id,
            })
            .returning();
          await tx.insert(trainerInvoiceLinesTable).values({
            invoiceId: inv!.id,
            description: `${cyc.description} (${periodStart} t/m ${periodEnd})`,
            quantity: 1,
            unitPriceCents: cyc.amountCents,
            vatRateBps: cyc.korApplied ? 0 : cyc.vatRateBps,
            amountCents: cyc.amountCents,
          });
          await tx
            .update(recurringBillingTable)
            .set({ billedThrough: periodEnd })
            .where(eq(recurringBillingTable.id, cyc.id));
          return inv!;
        });
        created.push(row);
        cyc.billedThrough = periodEnd;
        periodStart = addDays(periodEnd, 1);
      }
    }
    res.json({ created, count: created.length });
  } catch (err) {
    req.log.error({ err }, "run-drafts failed");
    res.status(500).json({ error: "Conceptfacturen klaarzetten is niet gelukt." });
  }
});

// ── F6: losse dienst factureren — conceptfactuur met regels ─────────────────
// POST /invoices/draft { clientId, serviceDate?, lines: [{ serviceId? |
// description, quantity, unitPriceCents?, vatRateBps?, evidenceWorkObjectId?,
// note? }], korApplied? }
// Bindend: bij een gefactureerde uitgevoerde test hoort een bewijs- of
// rapportkoppeling (evidenceWorkObjectId) — navolgbaar wat is gefactureerd.
// Combinatie met een lopende cyclus is gewoon een extra losse factuur.
router.post("/invoices/draft", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const clientId = int(req.body?.clientId);
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    if (!clientId || lines.length === 0) {
      res.status(400).json({ error: "clientId en minimaal één regel zijn verplicht." });
      return;
    }
    if (!(await ownedClient(clientId, trainerClerkId))) {
      res.status(404).json({ error: "Klant niet gevonden." });
      return;
    }
    const korApplied = req.body?.korApplied === true;
    const serviceDate = str(req.body?.serviceDate);
    if (serviceDate && !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      res.status(400).json({ error: "serviceDate moet JJJJ-MM-DD zijn." });
      return;
    }

    // Regels valideren en waarderen: dienst uit de eigen catalogus of vrije
    // omschrijving met eigen prijs.
    const resolved: {
      serviceId: number | null;
      description: string;
      quantity: number;
      unitPriceCents: number;
      vatRateBps: number;
      evidenceWorkObjectId: number | null;
    }[] = [];
    for (const raw of lines) {
      const quantity = int(raw?.quantity) ?? 1;
      if (quantity < 1) {
        res.status(400).json({ error: "quantity moet minimaal 1 zijn." });
        return;
      }
      const serviceId = int(raw?.serviceId);
      if (serviceId) {
        const [svc] = await db
          .select()
          .from(trainerServicesTable)
          .where(
            and(
              eq(trainerServicesTable.id, serviceId),
              eq(trainerServicesTable.trainerClerkId, trainerClerkId),
            ),
          );
        if (!svc) {
          res.status(404).json({ error: "Dienst niet gevonden." });
          return;
        }
        resolved.push({
          serviceId: svc.id,
          description: str(raw?.description) ?? svc.name,
          quantity,
          unitPriceCents: int(raw?.unitPriceCents) ?? svc.priceCents,
          vatRateBps: korApplied ? 0 : (int(raw?.vatRateBps) ?? svc.vatRateBps),
          evidenceWorkObjectId: int(raw?.evidenceWorkObjectId),
        });
      } else {
        const description = str(raw?.description);
        const unitPriceCents = int(raw?.unitPriceCents);
        if (!description || unitPriceCents === null || unitPriceCents < 0) {
          res.status(400).json({
            error: "Vrije regel vereist description en unitPriceCents (≥0).",
          });
          return;
        }
        resolved.push({
          serviceId: null,
          description,
          quantity,
          unitPriceCents,
          vatRateBps: korApplied ? 0 : (int(raw?.vatRateBps) ?? 2100),
          evidenceWorkObjectId: int(raw?.evidenceWorkObjectId),
        });
      }
    }

    const excl = resolved.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
    const vatBreakdown: Record<string, number> = {};
    let vatTotal = 0;
    for (const l of resolved) {
      const vat = korApplied ? 0 : Math.round((l.unitPriceCents * l.quantity * l.vatRateBps) / 10000);
      vatTotal += vat;
      const key = korApplied ? "kor" : String(l.vatRateBps);
      vatBreakdown[key] = (vatBreakdown[key] ?? 0) + vat;
    }

    const invoice = await db.transaction(async (tx) => {
      const [inv] = await tx
        .insert(trainerInvoicesTable)
        .values({
          trainerClerkId,
          clientId,
          serviceDate,
          description: resolved.map((l) => l.description).join(" · "),
          amountExclCents: excl,
          vatBreakdown,
          amountInclCents: excl + vatTotal,
          korApplied,
          status: "concept",
        })
        .returning();
      await tx.insert(trainerInvoiceLinesTable).values(
        resolved.map((l) => ({
          invoiceId: inv!.id,
          serviceId: l.serviceId,
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          vatRateBps: l.vatRateBps,
          amountCents: l.unitPriceCents * l.quantity,
          evidenceWorkObjectId: l.evidenceWorkObjectId,
        })),
      );
      return inv!;
    });
    res.status(201).json(invoice);
  } catch (err) {
    req.log.error({ err }, "invoice draft failed");
    res.status(500).json({ error: "Conceptfactuur aanmaken is niet gelukt." });
  }
});

router.get("/invoices", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  res.json(
    await db
      .select()
      .from(trainerInvoicesTable)
      .where(eq(trainerInvoicesTable.trainerClerkId, trainerClerkId))
      .orderBy(desc(trainerInvoicesTable.createdAt)),
  );
});

router.get("/invoices/:id", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const [inv] = await db
    .select()
    .from(trainerInvoicesTable)
    .where(
      and(
        eq(trainerInvoicesTable.id, Number(req.params.id)),
        eq(trainerInvoicesTable.trainerClerkId, trainerClerkId),
      ),
    );
  if (!inv) {
    res.status(404).json({ error: "Factuur niet gevonden." });
    return;
  }
  const lines = await db
    .select()
    .from(trainerInvoiceLinesTable)
    .where(eq(trainerInvoiceLinesTable.invoiceId, inv.id));
  res.json({ ...inv, lines });
});

// ── Signalen (3c.4) — altijd voorstel, nooit actie ───────────────────────────
router.get("/signals", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(
      new Date(),
    );
    const signals: { kind: string; message: string; invoiceId?: number; clientId?: number }[] = [];

    const invoices = await db
      .select()
      .from(trainerInvoicesTable)
      .where(eq(trainerInvoicesTable.trainerClerkId, trainerClerkId));
    for (const inv of invoices) {
      if (inv.status === "concept") {
        signals.push({
          kind: "concept_klaar",
          message: "Voor deze klant staat een conceptfactuur klaar — controleer en verzend zelf.",
          invoiceId: inv.id,
          clientId: inv.clientId,
        });
      }
      if (inv.status === "verzonden" && inv.dueDate && inv.dueDate >= today && addDays(today, 3) >= inv.dueDate) {
        signals.push({
          kind: "vervalt_binnenkort",
          message: `Deze factuur vervalt op ${inv.dueDate}.`,
          invoiceId: inv.id,
          clientId: inv.clientId,
        });
      }
    }

    // "Deze test is uitgevoerd maar nog niet gefactureerd": afgeronde
    // testverslag-werkobjecten van de trainer zonder factuurregel die er via
    // de bewijs-koppeling naar verwijst.
    const testDocs = await db
      .select({ id: workObjectsTable.id, title: workObjectsTable.title })
      .from(workObjectsTable)
      .where(
        and(
          eq(workObjectsTable.ownerTrainerClerkId, trainerClerkId),
          eq(workObjectsTable.objectType, "testverslag"),
          eq(workObjectsTable.status, "afgerond"),
        ),
      );
    if (testDocs.length) {
      const billedRows = await db
        .select({ evidenceWorkObjectId: trainerInvoiceLinesTable.evidenceWorkObjectId })
        .from(trainerInvoiceLinesTable)
        .innerJoin(
          trainerInvoicesTable,
          eq(trainerInvoiceLinesTable.invoiceId, trainerInvoicesTable.id),
        )
        .where(eq(trainerInvoicesTable.trainerClerkId, trainerClerkId));
      const billed = new Set(billedRows.map((r) => r.evidenceWorkObjectId).filter(Boolean));
      for (const doc of testDocs) {
        if (!billed.has(doc.id)) {
          signals.push({
            kind: "test_niet_gefactureerd",
            message: `Test “${doc.title}” is uitgevoerd maar nog niet gefactureerd.`,
          });
        }
      }
    }

    // Ontbrekend btw-nummer — mét de verantwoordelijke erbij: bedrijfsklant
    // zonder btw-nummer = klant; onderneming zonder btw-nummer = de trainer.
    const clients = await db
      .select()
      .from(trainerClientsTable)
      .where(eq(trainerClientsTable.trainerClerkId, trainerClerkId));
    for (const c of clients) {
      if (c.companyName && !c.vatNumber) {
        signals.push({
          kind: "btw_ontbreekt_klant",
          message: `Bij bedrijfsklant ${c.name} ontbreekt het btw-nummer — verantwoordelijke: de klant (${c.name}).`,
          clientId: c.id,
        });
      }
    }
    const [biz] = await db
      .select()
      .from(trainerBusinessTable)
      .where(eq(trainerBusinessTable.clerkId, trainerClerkId));
    // Geen bedrijfsrij = zeker geen btw-nummer: signaal klinkt óók dan
    // (fail-closed, stilte zou het gat verbergen). Alleen KOR-actief dempt.
    if (!biz || (!biz.korActive && !biz.vatNumber)) {
      signals.push({
        kind: "btw_ontbreekt_onderneming",
        message: "Je eigen btw-identificatienummer ontbreekt — verantwoordelijke: jijzelf.",
      });
    }
    res.json(signals);
  } catch (err) {
    req.log.error({ err }, "billing signals failed");
    res.status(500).json({ error: "Signalen ophalen is niet gelukt." });
  }
});

export default router;
