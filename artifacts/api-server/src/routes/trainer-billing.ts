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
  creditNotesTable,
  retentionPoliciesTable,
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

// F11/BB-67 — opgezegde onderneming: geen nieuwe facturen, geen nieuwe
// verzending, archief read-only. Export/lezen/betaalstatus blijven werken.
async function isTerminated(trainerClerkId: string): Promise<boolean> {
  const [biz] = await db
    .select({ endedAt: trainerBusinessTable.endedAt })
    .from(trainerBusinessTable)
    .where(eq(trainerBusinessTable.clerkId, trainerClerkId));
  return Boolean(biz?.endedAt);
}
const TERMINATED_MSG =
  "De facturatie is opgezegd: het archief is read-only. Exporteren en inzien blijven mogelijk; er worden geen nieuwe facturen gemaakt of verzonden.";

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
    if (await isTerminated(trainerClerkId)) {
      res.status(409).json({ error: TERMINATED_MSG });
      return;
    }
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
    if (await isTerminated(trainerClerkId)) {
      res.status(409).json({ error: TERMINATED_MSG });
      return;
    }
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
    if (await isTerminated(trainerClerkId)) {
      res.status(409).json({ error: TERMINATED_MSG });
      return;
    }
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
    if (await isTerminated(trainerClerkId)) {
      res.status(409).json({ error: TERMINATED_MSG });
      return;
    }
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

// LET OP: vóór /invoices/:id gedeclareerd, anders vangt :id "export" weg.
router.get("/invoices/export", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const from = str(req.query.from);
    const to = str(req.query.to);
    const format = str(req.query.format) ?? "csv";
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from en to (JJJJ-MM-DD) zijn verplicht." });
      return;
    }
    const rows = await buildExportRows(trainerClerkId, from, to);
    if (format === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Facturen");
      ws.addRow([...EXPORT_COLUMNS]);
      for (const r of rows) ws.addRow(r);
      res.setHeader(
        "content-type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("content-disposition", `attachment; filename="facturen_${from}_${to}.xlsx"`);
      res.end(Buffer.from(await wb.xlsx.writeBuffer()));
      return;
    }
    const csv = [
      EXPORT_COLUMNS.join(";"),
      ...rows.map((r) => r.map(csvEscape).join(";")),
    ].join("\n");
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="facturen_${from}_${to}.csv"`);
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "invoice export failed");
    res.status(500).json({ error: "Export is niet gelukt." });
  }
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

// ── F8: verzending, nummering, statussen, creditnota (BB-64/BB-68) ──────────
// Nummer wordt UITSLUITEND hier toegekend: server-side, in één transactie,
// uit de doorlopende reeks van de onderneming (trainer_business.nextInvoiceNumber,
// FOR UPDATE — geen SELECT MAX()+1). Creditnota's delen dezelfde reeks.
// Verzonden = onaantastbaar: geen wijziging, geen verwijdering, alleen
// creditnota. Klant- en ondernemingsgegevens worden bij verzending bevroren.

async function allocateNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  trainerClerkId: string,
): Promise<string> {
  const [biz] = await tx
    .select()
    .from(trainerBusinessTable)
    .where(eq(trainerBusinessTable.clerkId, trainerClerkId))
    .for("update");
  if (!biz) throw Object.assign(new Error("geen bedrijfsgegevens"), { code: "NO_BUSINESS" });
  const current = biz.nextInvoiceNumber ?? 1;
  const number = `${biz.invoicePrefix ?? ""}${current}`;
  await tx
    .update(trainerBusinessTable)
    .set({ nextInvoiceNumber: current + 1 })
    .where(eq(trainerBusinessTable.clerkId, trainerClerkId));
  return number;
}

router.post("/invoices/:id/send", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    if (await isTerminated(trainerClerkId)) {
      res.status(409).json({ error: TERMINATED_MSG });
      return;
    }
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(
      new Date(),
    );
    const result = await db.transaction(async (tx) => {
      const [inv] = await tx
        .select()
        .from(trainerInvoicesTable)
        .where(
          and(
            eq(trainerInvoicesTable.id, Number(req.params.id)),
            eq(trainerInvoicesTable.trainerClerkId, trainerClerkId),
          ),
        )
        .for("update");
      if (!inv) return { error: 404 as const };
      if (inv.status !== "concept") return { error: 409 as const };
      const [client] = await tx
        .select()
        .from(trainerClientsTable)
        .where(eq(trainerClientsTable.id, inv.clientId));
      const [biz] = await tx
        .select()
        .from(trainerBusinessTable)
        .where(eq(trainerBusinessTable.clerkId, trainerClerkId));
      if (!biz) return { error: 422 as const };
      const invoiceNumber = await allocateNumber(tx, trainerClerkId);
      const [row] = await tx
        .update(trainerInvoicesTable)
        .set({
          invoiceNumber,
          invoiceDate: today,
          dueDate: inv.dueDate ?? today,
          status: "verzonden",
          sentAt: new Date(),
          // Bevroren snapshots: latere wijzigingen aan klant of onderneming
          // raken deze factuur nooit meer.
          clientSnapshot: client ? { ...client } : {},
          businessSnapshot: { ...biz },
          updatedAt: new Date(),
        })
        .where(eq(trainerInvoicesTable.id, inv.id))
        .returning();
      return { row };
    });
    if ("error" in result) {
      const msg =
        result.error === 404
          ? "Factuur niet gevonden."
          : result.error === 409
            ? "Alleen een concept kan worden verzonden."
            : "Vul eerst je bedrijfsgegevens in voordat je verzendt.";
      res.status(result.error!).json({ error: msg });
      return;
    }
    res.json(result.row);
  } catch (err) {
    req.log.error({ err }, "invoice send failed");
    res.status(500).json({ error: "Verzenden is niet gelukt." });
  }
});

// Intrekken kan alleen VÓÓR verzending (status ingetrokken, BB-68).
// Verwijderen bestaat niet: er is bewust geen DELETE-route, en intrekken van
// een verzonden factuur wordt geweigerd.
router.post("/invoices/:id/withdraw", requireAuth, async (req, res) => {
  try {
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
    if (inv.status !== "concept") {
      res.status(409).json({
        error: "Een verzonden factuur is onaantastbaar — corrigeer via een creditnota.",
      });
      return;
    }
    const [row] = await db
      .update(trainerInvoicesTable)
      .set({ status: "ingetrokken", updatedAt: new Date() })
      .where(eq(trainerInvoicesTable.id, inv.id))
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "invoice withdraw failed");
    res.status(500).json({ error: "Intrekken is niet gelukt." });
  }
});

// Betaald markeren — handmatig, deelbetaling mogelijk (F9: geld loopt nooit
// via Sparki; dit is registratie).
router.post("/invoices/:id/mark-paid", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const amountCents = int(req.body?.amountCents);
    if (amountCents === null || amountCents <= 0) {
      res.status(400).json({ error: "amountCents (>0) is verplicht." });
      return;
    }
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
    if (!["verzonden", "te_laat", "gecrediteerd"].includes(inv.status)) {
      res.status(409).json({ error: "Alleen een verzonden factuur kan betaald worden gemarkeerd." });
      return;
    }
    const paidCents = inv.paidCents + amountCents;
    const fullyPaid = paidCents >= inv.amountInclCents;
    const [row] = await db
      .update(trainerInvoicesTable)
      .set({
        paidCents,
        paidAt: fullyPaid ? new Date() : inv.paidAt,
        status: fullyPaid ? "betaald" : inv.status,
        updatedAt: new Date(),
      })
      .where(eq(trainerInvoicesTable.id, inv.id))
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "invoice mark-paid failed");
    res.status(500).json({ error: "Betaling registreren is niet gelukt." });
  }
});

// Creditnota — geheel of gedeeltelijk, eigen nummer uit dezelfde reeks,
// verwijzing + reden verplicht; past betaalstatus aan, factuur zelf blijft
// byte-voor-byte staan.
router.post("/invoices/:id/credit", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    if (await isTerminated(trainerClerkId)) {
      res.status(409).json({ error: TERMINATED_MSG });
      return;
    }
    const reason = str(req.body?.reason);
    const amountCents = int(req.body?.amountCents);
    if (!reason) {
      res.status(400).json({ error: "reason is verplicht." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [inv] = await tx
        .select()
        .from(trainerInvoicesTable)
        .where(
          and(
            eq(trainerInvoicesTable.id, Number(req.params.id)),
            eq(trainerInvoicesTable.trainerClerkId, trainerClerkId),
          ),
        )
        .for("update");
      if (!inv) return { error: 404 as const, msg: "Factuur niet gevonden." };
      if (!inv.invoiceNumber || !["verzonden", "te_laat", "betaald"].includes(inv.status))
        return { error: 409 as const, msg: "Alleen een verzonden factuur kan gecrediteerd worden." };
      const credit = amountCents ?? inv.amountInclCents;
      if (credit <= 0 || credit > inv.amountInclCents)
        return { error: 400 as const, msg: "Creditbedrag moet tussen 1 en het factuurtotaal liggen." };
      const creditNumber = await allocateNumber(tx, trainerClerkId);
      const [note] = await tx
        .insert(creditNotesTable)
        .values({
          trainerClerkId,
          invoiceId: inv.id,
          creditNumber,
          reason,
          partial: credit < inv.amountInclCents,
          amountInclCents: credit,
        })
        .returning();
      await tx
        .update(trainerInvoicesTable)
        .set({ status: "gecrediteerd", creditNoteId: note!.id, updatedAt: new Date() })
        .where(eq(trainerInvoicesTable.id, inv.id));
      return { note };
    });
    if ("error" in result) {
      res.status(result.error!).json({ error: result.msg });
      return;
    }
    res.status(201).json(result.note);
  } catch (err) {
    req.log.error({ err }, "credit note failed");
    res.status(500).json({ error: "Creditnota aanmaken is niet gelukt." });
  }
});

// ── F10: export naar de boekhouder ──────────────────────────────────────────
// GET /invoices/export?from=JJJJ-MM-DD&to=JJJJ-MM-DD&format=csv|xlsx
// Vaste kolommen (F10); alleen verzonden/afgehandelde facturen (concepten
// zijn geen boekhouding); creditnota's als eigen regels met negatief bedrag
// en creditreferentie. Lege periode = eerlijk lege export met kopregel.
const EXPORT_COLUMNS = [
  "factuurnummer",
  "factuurdatum",
  "vervaldatum",
  "klant",
  "klantnummer",
  "omschrijving",
  "periode_of_uitvoerdatum",
  "exclusief_btw",
  "btw_percentage",
  "btw_bedrag",
  "inclusief_btw",
  "status",
  "betaaldatum",
  "creditreferentie",
  "bedrijfsnaam",
  "valuta",
] as const;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function euro(cents: number): string {
  return (cents / 100).toFixed(2);
}

async function buildExportRows(trainerClerkId: string, from: string, to: string) {
  const [biz] = await db
    .select()
    .from(trainerBusinessTable)
    .where(eq(trainerBusinessTable.clerkId, trainerClerkId));
  const companyName = biz?.companyName ?? "";
  const invoices = await db
    .select()
    .from(trainerInvoicesTable)
    .where(eq(trainerInvoicesTable.trainerClerkId, trainerClerkId));
  const clients = await db
    .select()
    .from(trainerClientsTable)
    .where(eq(trainerClientsTable.trainerClerkId, trainerClerkId));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const credits = await db
    .select()
    .from(creditNotesTable)
    .where(eq(creditNotesTable.trainerClerkId, trainerClerkId));
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  const rows: (string | number)[][] = [];
  for (const inv of invoices) {
    if (!inv.invoiceNumber || !inv.invoiceDate) continue; // concepten niet
    if (inv.invoiceDate < from || inv.invoiceDate > to) continue;
    const client = clientById.get(inv.clientId);
    const vatTotal = inv.amountInclCents - inv.amountExclCents;
    const vatPct = inv.korApplied
      ? "KOR"
      : inv.amountExclCents > 0
        ? ((vatTotal / inv.amountExclCents) * 100).toFixed(0)
        : "0";
    const credit = credits.find((c) => c.invoiceId === inv.id);
    rows.push([
      inv.invoiceNumber,
      inv.invoiceDate,
      inv.dueDate ?? "",
      client?.name ?? "",
      client?.clientNumber ?? "",
      inv.description,
      inv.periodStart ? `${inv.periodStart} t/m ${inv.periodEnd}` : (inv.serviceDate ?? ""),
      euro(inv.amountExclCents),
      vatPct,
      euro(vatTotal),
      euro(inv.amountInclCents),
      inv.status,
      inv.paidAt ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(inv.paidAt) : "",
      credit?.creditNumber ?? "",
      companyName,
      inv.currency,
    ]);
  }
  for (const cn of credits) {
    const cnDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(cn.createdAt);
    if (cnDate < from || cnDate > to) continue;
    const inv = invoiceById.get(cn.invoiceId);
    const client = inv ? clientById.get(inv.clientId) : undefined;
    rows.push([
      cn.creditNumber,
      cnDate,
      "",
      client?.name ?? "",
      client?.clientNumber ?? "",
      `Creditnota: ${cn.reason}`,
      "",
      euro(-cn.amountInclCents),
      inv?.korApplied ? "KOR" : "",
      euro(0),
      euro(-cn.amountInclCents),
      cn.status,
      "",
      inv?.invoiceNumber ?? "",
      companyName,
      inv?.currency ?? "EUR",
    ]);
  }
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  return rows;
}

// ── F11: opzegging (BB-67) en bewaartermijnregister ─────────────────────────
// Opzeggen: archief wordt read-only; export, inzien en betaalregistratie
// blijven; er verdwijnt NOOIT een factuur door opzegging.
router.post("/terminate", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const [biz] = await db
      .select()
      .from(trainerBusinessTable)
      .where(eq(trainerBusinessTable.clerkId, trainerClerkId));
    if (!biz) {
      res.status(404).json({ error: "Geen bedrijfsgegevens gevonden." });
      return;
    }
    if (biz.endedAt) {
      res.json({ endedAt: biz.endedAt, alreadyTerminated: true });
      return;
    }
    const [row] = await db
      .update(trainerBusinessTable)
      .set({ endedAt: new Date() })
      .where(eq(trainerBusinessTable.clerkId, trainerClerkId))
      .returning();
    res.json({ endedAt: row!.endedAt, alreadyTerminated: false });
  } catch (err) {
    req.log.error({ err }, "terminate failed");
    res.status(500).json({ error: "Opzeggen is niet gelukt." });
  }
});

// Bewaartermijnen: centraal register, GEEN hardcoded juridische waarde.
// NULL retentionDays = nog niet vastgesteld ⇒ fail-closed: bewaren.
router.get("/retention", requireAuth, async (_req, res) => {
  const rows = await db.select().from(retentionPoliciesTable);
  res.json({
    policies: rows,
    note: "Een ontbrekende of lege termijn betekent: bewaren. Termijnen worden pas van kracht na expliciete vastlegging (open juridisch besluit).",
  });
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
