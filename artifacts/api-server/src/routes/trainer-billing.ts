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
import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import {
  db,
  trainerClientEventsTable,
  trainerServicesTable,
  recurringBillingTable,
  trainerInvoicesTable,
  trainerInvoiceLinesTable,
  trainerClientsTable,
  trainerBusinessTable,
  creditNotesTable,
  retentionPoliciesTable,
  trainerLetterheadsTable,
  workObjectsTable,
  SERVICE_UNITS,
  BILLING_CYCLES,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { sendEmail } from "../lib/email";
import { renderDocument } from "../lib/documents/generator";
import { bouwFactuur } from "../lib/documents/templates";

const router = Router();

// F14 (3b-H) — klanthistorie: elk opvolg- en communicatiefeit registreren.
// Bewust in dezelfde request (geen fire-and-forget): historie is een feit.
async function logClientEvent(input: {
  trainerClerkId: string;
  clientId: number;
  invoiceId?: number | null;
  kind: string;
  body: string;
  channel?: string;
}): Promise<void> {
  await db.insert(trainerClientEventsTable).values({
    trainerClerkId: input.trainerClerkId,
    clientId: input.clientId,
    invoiceId: input.invoiceId ?? null,
    kind: input.kind,
    body: input.body,
    channel: input.channel ?? "geregistreerd",
  });
}

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

function amsterdamToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

// F9 "te laat": afgeleide leesstatus — verzonden + vervaldatum verstreken +
// niet volledig betaald. Nooit een mutatie: de DB-status blijft "verzonden".
function withOverdue<T extends { status: string; dueDate: string | null; paidCents: number | null; amountInclCents: number }>(
  inv: T,
  today: string,
): T & { isOverdue: boolean } {
  const isOverdue =
    inv.status === "verzonden" &&
    Boolean(inv.dueDate && inv.dueDate < today) &&
    (inv.paidCents ?? 0) < inv.amountInclCents;
  return { ...inv, isOverdue };
}

router.get("/invoices", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const today = amsterdamToday();
  const rows = await db
    .select()
    .from(trainerInvoicesTable)
    .where(eq(trainerInvoicesTable.trainerClerkId, trainerClerkId))
    .orderBy(desc(trainerInvoicesTable.createdAt));
  res.json(rows.map((r) => withOverdue(r, today)));
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
  const invWithOverdue = withOverdue(inv, amsterdamToday());
  res.json({ ...invWithOverdue, lines });
});

// BUILD_04-restpunt: PDF-uitdraai van een factuur via de ÉNE F4-documentgenerator
// (HA-18/HA-43 — geen tweede PDF-engine). Zelfde eigenaarschapscheck als de
// detailroute; het sjabloon rekent niets zelf uit.
router.get("/invoices/:id/pdf", requireAuth, async (req, res) => {
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
  try {
    const lines = await db
      .select()
      .from(trainerInvoiceLinesTable)
      .where(eq(trainerInvoiceLinesTable.invoiceId, inv.id));
    const { kop, blokken } = bouwFactuur({
      invoice: inv,
      lines,
      datum: amsterdamToday(),
    });
    const buf = await renderDocument(kop, blokken);
    const naam = inv.invoiceNumber
      ? `factuur-${inv.invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`
      : `conceptfactuur-${inv.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${naam}"`);
    res.send(buf);
  } catch (err) {
    req.log.error({ err }, "invoice pdf failed");
    res.status(500).json({ error: "Factuur-PDF maken is niet gelukt." });
  }
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
      // F7: templateversie bevriezen op het moment van verzending. Geen
      // actief briefpapier = versie 0 (standaardtemplate) — ook bevroren.
      const [letterhead] = await tx
        .select({ v: trainerLetterheadsTable.templateVersion })
        .from(trainerLetterheadsTable)
        .where(
          and(
            eq(trainerLetterheadsTable.trainerClerkId, trainerClerkId),
            eq(trainerLetterheadsTable.active, true),
          ),
        );
      const invoiceNumber = await allocateNumber(tx, trainerClerkId);
      const [row] = await tx
        .update(trainerInvoicesTable)
        .set({
          invoiceNumber,
          templateVersion: letterhead?.v ?? 0,
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
    await logClientEvent({
      trainerClerkId: getClerkUserId(req)!,
      clientId: result.row.clientId,
      invoiceId: result.row.id,
      kind: "verzending",
      body: `Factuur ${result.row.invoiceNumber} verzonden.`,
    });
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
    await logClientEvent({
      trainerClerkId,
      clientId: inv.clientId,
      invoiceId: inv.id,
      kind: "intrekking",
      body: "Conceptfactuur ingetrokken vóór verzending.",
    });
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
    if (!["verzonden", "te_laat", "gecrediteerd", "deels_betaald"].includes(inv.status)) {
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
        // F14 (3b-E): deelbetaling is een eigen, eerlijke status — behalve op
        // een gecrediteerde factuur (die status blijft leidend).
        status: fullyPaid
          ? "betaald"
          : inv.status === "gecrediteerd"
            ? inv.status
            : "deels_betaald",
        updatedAt: new Date(),
      })
      .where(eq(trainerInvoicesTable.id, inv.id))
      .returning();
    await logClientEvent({
      trainerClerkId,
      clientId: inv.clientId,
      invoiceId: inv.id,
      kind: fullyPaid ? "betaling" : "deelbetaling",
      body: fullyPaid
        ? `Factuur ${inv.invoiceNumber ?? inv.id} volledig betaald.`
        : `Deelbetaling van ${(amountCents / 100).toFixed(2)} EUR op factuur ${inv.invoiceNumber ?? inv.id}.`,
    });
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
      return { note, clientId: inv.clientId, invoiceNumber: inv.invoiceNumber };
    });
    if ("error" in result) {
      res.status(result.error!).json({ error: result.msg });
      return;
    }
    await logClientEvent({
      trainerClerkId,
      clientId: result.clientId!,
      invoiceId: result.note!.invoiceId,
      kind: "creditnota",
      body: `Creditnota ${result.note!.creditNumber} (${(result.note!.amountInclCents / 100).toFixed(2)} EUR) op factuur ${result.invoiceNumber}. Reden: ${result.note!.reason}`,
    });
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

// ── F14 (3b-E) — opvolging: herinnering · notitie · betaalafspraak · oninbaar.
// Geen automatisch incassotraject, geen automatische aanmaning: elk van deze
// routes bestaat alleen als expliciete trainer-actie.

async function ownedInvoice(id: number, trainerClerkId: string) {
  const [inv] = await db
    .select()
    .from(trainerInvoicesTable)
    .where(
      and(
        eq(trainerInvoicesTable.id, id),
        eq(trainerInvoicesTable.trainerClerkId, trainerClerkId),
      ),
    );
  return inv ?? null;
}

// Herinnering: via de centrale e-maillaag als de klant een e-mailadres heeft
// en het kanaal werkt; anders eerlijk alleen geregistreerd. Nooit automatisch.
router.post("/invoices/:id/reminder", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const inv = await ownedInvoice(Number(req.params.id), trainerClerkId);
    if (!inv) {
      res.status(404).json({ error: "Factuur niet gevonden." });
      return;
    }
    if (!["verzonden", "te_laat", "deels_betaald"].includes(inv.status)) {
      res.status(409).json({ error: "Alleen bij een openstaande verzonden factuur kun je herinneren." });
      return;
    }
    const client = await ownedClient(inv.clientId, trainerClerkId);
    let channel = "geregistreerd";
    let emailOk = false;
    if (client?.email) {
      const sent = await sendEmail({
        to: client.email,
        subject: `Betaalherinnering factuur ${inv.invoiceNumber ?? ""}`.trim(),
        text: `Beste ${client.name},\n\nDit is een herinnering voor factuur ${inv.invoiceNumber ?? ""} van ${(inv.amountInclCents / 100).toFixed(2)} EUR${inv.dueDate ? `, vervallen op ${inv.dueDate}` : ""}. Al betaald? Dan kun je dit bericht negeren.\n\nMet sportieve groet`,
      });
      emailOk = sent.ok;
      channel = sent.ok ? "e-mail" : "geregistreerd";
    }
    await logClientEvent({
      trainerClerkId,
      clientId: inv.clientId,
      invoiceId: inv.id,
      kind: "herinnering",
      body: emailOk
        ? `Herinnering per e-mail verstuurd voor factuur ${inv.invoiceNumber ?? inv.id}.`
        : `Herinnering geregistreerd voor factuur ${inv.invoiceNumber ?? inv.id} (geen e-mail verstuurd${client?.email ? " — kanaal niet beschikbaar" : " — klant heeft geen e-mailadres"}).`,
      channel,
    });
    res.json({ ok: true, channel, emailSent: emailOk });
  } catch (err) {
    req.log.error({ err }, "invoice reminder failed");
    res.status(500).json({ error: "Herinnering versturen is niet gelukt." });
  }
});

// Notitie op een factuur (komt in de klanthistorie).
router.post("/invoices/:id/note", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const body = str(req.body?.body);
    if (!body) {
      res.status(400).json({ error: "body is verplicht." });
      return;
    }
    const inv = await ownedInvoice(Number(req.params.id), trainerClerkId);
    if (!inv) {
      res.status(404).json({ error: "Factuur niet gevonden." });
      return;
    }
    await logClientEvent({
      trainerClerkId,
      clientId: inv.clientId,
      invoiceId: inv.id,
      kind: "notitie",
      body,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "invoice note failed");
    res.status(500).json({ error: "Notitie plaatsen is niet gelukt." });
  }
});

// Betaalafspraak: een feit (datum + afspraak), geen incasso.
router.post("/invoices/:id/payment-agreement", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const date = str(req.body?.date);
    const note = str(req.body?.note);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date (YYYY-MM-DD) is verplicht." });
      return;
    }
    const inv = await ownedInvoice(Number(req.params.id), trainerClerkId);
    if (!inv) {
      res.status(404).json({ error: "Factuur niet gevonden." });
      return;
    }
    if (!["verzonden", "te_laat", "deels_betaald"].includes(inv.status)) {
      res.status(409).json({ error: "Een betaalafspraak hoort bij een openstaande verzonden factuur." });
      return;
    }
    const [row] = await db
      .update(trainerInvoicesTable)
      .set({ paymentAgreementDate: date, paymentAgreementNote: note, updatedAt: new Date() })
      .where(eq(trainerInvoicesTable.id, inv.id))
      .returning();
    await logClientEvent({
      trainerClerkId,
      clientId: inv.clientId,
      invoiceId: inv.id,
      kind: "betaalafspraak",
      body: `Betaalafspraak: uiterlijk ${date}${note ? ` — ${note}` : ""}.`,
    });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "payment agreement failed");
    res.status(500).json({ error: "Betaalafspraak vastleggen is niet gelukt." });
  }
});

// Oninbaar — alleen MET reden (3b-E), en alleen op een openstaande factuur.
router.post("/invoices/:id/uncollectible", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const reason = str(req.body?.reason);
    if (!reason) {
      res.status(400).json({ error: "reason is verplicht: oninbaar markeren kan alleen met reden." });
      return;
    }
    const inv = await ownedInvoice(Number(req.params.id), trainerClerkId);
    if (!inv) {
      res.status(404).json({ error: "Factuur niet gevonden." });
      return;
    }
    if (!["verzonden", "te_laat", "deels_betaald"].includes(inv.status)) {
      res.status(409).json({ error: "Alleen een openstaande verzonden factuur kan oninbaar zijn." });
      return;
    }
    const [row] = await db
      .update(trainerInvoicesTable)
      .set({ status: "oninbaar", uncollectibleReason: reason, updatedAt: new Date() })
      .where(eq(trainerInvoicesTable.id, inv.id))
      .returning();
    await logClientEvent({
      trainerClerkId,
      clientId: inv.clientId,
      invoiceId: inv.id,
      kind: "oninbaar",
      body: `Factuur ${inv.invoiceNumber ?? inv.id} oninbaar gemarkeerd. Reden: ${reason}`,
    });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "uncollectible failed");
    res.status(500).json({ error: "Oninbaar markeren is niet gelukt." });
  }
});

// ── F14 (3b-B/3b-H) — klanthistorie + betaalgedrag (feiten, geen oordeel) ────
router.get("/clients/:id/history", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const client = await ownedClient(Number(req.params.id), trainerClerkId);
    if (!client) {
      res.status(404).json({ error: "Klant niet gevonden." });
      return;
    }
    const events = await db
      .select()
      .from(trainerClientEventsTable)
      .where(eq(trainerClientEventsTable.clientId, client.id))
      .orderBy(desc(trainerClientEventsTable.createdAt));
    const today = amsterdamToday();
    const invoices = (
      await db
        .select()
        .from(trainerInvoicesTable)
        .where(
          and(
            eq(trainerInvoicesTable.clientId, client.id),
            eq(trainerInvoicesTable.trainerClerkId, trainerClerkId),
          ),
        )
        .orderBy(desc(trainerInvoicesTable.id))
    ).map((r) => withOverdue(r, today));

    // Betaalgedrag = feiten: gemiddelde betaaltermijn en aantal keer te laat.
    // Geen score, geen kleurcode (3b-B).
    const paidWithDates = invoices.filter((i) => i.paidAt && i.sentAt);
    const avgPaymentDays = paidWithDates.length
      ? Math.round(
          paidWithDates.reduce(
            (sum, i) =>
              sum + (i.paidAt!.getTime() - i.sentAt!.getTime()) / 86_400_000,
            0,
          ) / paidWithDates.length,
        )
      : null;
    // "Keer te laat" is een feit over de vervaldatum, ongeacht de eindstatus:
    // ook een factuur die later betaald of oninbaar werd, wás te laat.
    const timesLate = invoices.filter(
      (i) =>
        i.dueDate &&
        !["concept", "ingetrokken"].includes(i.status) &&
        ((i.paidAt && i.paidAt.toISOString().slice(0, 10) > i.dueDate) ||
          (!i.paidAt && i.dueDate < today)),
    ).length;
    res.json({
      client: { id: client.id, name: client.name },
      events,
      invoices,
      paymentBehavior: {
        avgPaymentDays,
        timesLate,
        note: "Feiten, geen oordeel: gemiddelde betaaltermijn in dagen en aantal keer te laat.",
      },
    });
  } catch (err) {
    req.log.error({ err }, "client history failed");
    res.status(500).json({ error: "Klanthistorie ophalen is niet gelukt." });
  }
});

// ── F14 (3b-A) — startscherm: twaalf blokken in vaste volgorde + één primaire
// actie (de eerstvolgende factuur afhandelen). De volgorde is een contract.
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const today = amsterdamToday();
    const monthStart = `${today.slice(0, 7)}-01`;
    const invoices = (
      await db
        .select()
        .from(trainerInvoicesTable)
        .where(eq(trainerInvoicesTable.trainerClerkId, trainerClerkId))
    ).map((r) => withOverdue(r, today));
    const clients = await db
      .select()
      .from(trainerClientsTable)
      .where(eq(trainerClientsTable.trainerClerkId, trainerClerkId));
    const recurring = await db
      .select()
      .from(recurringBillingTable)
      .where(
        and(
          eq(recurringBillingTable.trainerClerkId, trainerClerkId),
          eq(recurringBillingTable.active, true),
        ),
      );
    const [biz] = await db
      .select()
      .from(trainerBusinessTable)
      .where(eq(trainerBusinessTable.clerkId, trainerClerkId));
    const events = await db
      .select()
      .from(trainerClientEventsTable)
      .where(eq(trainerClientEventsTable.trainerClerkId, trainerClerkId))
      .orderBy(desc(trainerClientEventsTable.createdAt))
      .limit(5);

    const open = invoices.filter((i) =>
      ["verzonden", "te_laat", "deels_betaald"].includes(i.status),
    );
    const openAmountCents = open.reduce(
      (s, i) => s + Math.max(0, i.amountInclCents - i.paidCents),
      0,
    );
    const overdue = open.filter((i) => i.isOverdue);
    const sentThisMonth = invoices.filter(
      (i) => i.invoiceDate && i.invoiceDate >= monthStart && i.invoiceDate <= today,
    );
    const concepts = invoices.filter((i) => i.status === "concept");
    // Eerstvolgend facturatiemoment uit de actieve afspraken.
    const nextMoments = recurring
      .map((r) => (r.billedThrough ? addDays(r.billedThrough, 1) : r.startDate))
      .filter((d) => d != null)
      .sort();
    const clientIdsWithRecurring = new Set(recurring.map((r) => r.clientId));
    const clientsWithoutAgreement = clients.filter(
      (c) => c.status === "actief" && !clientIdsWithRecurring.has(c.id),
    );
    const missing: string[] = [];
    if (!biz) missing.push("bedrijfsgegevens ontbreken");
    else {
      if (!biz.korActive && !biz.vatNumber) missing.push("eigen btw-nummer ontbreekt");
      if (!biz.iban) missing.push("IBAN ontbreekt");
    }
    for (const c of clients) {
      if (c.companyName && !c.vatNumber) missing.push(`btw-nummer klant ${c.name} ontbreekt`);
      if (!c.email) missing.push(`e-mailadres klant ${c.name} ontbreekt`);
    }

    // Eén primaire actie: de eerstvolgende factuur afhandelen — oudste
    // concept eerst, anders de oudste te-late factuur.
    const nextConcept = [...concepts].sort((a, b) => a.id - b.id)[0];
    const nextOverdue = [...overdue].sort((a, b) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    )[0];
    const primaryAction = nextConcept
      ? {
          kind: "concept_afhandelen",
          invoiceId: nextConcept.id,
          label: "Controleer en verzend de eerstvolgende conceptfactuur.",
        }
      : nextOverdue
        ? {
            kind: "te_laat_opvolgen",
            invoiceId: nextOverdue.id,
            label: "Volg de oudste te-late factuur op.",
          }
        : null;

    // Vaste volgorde (3b-A) — twaalf blokken, exact dit contract.
    res.json({
      primaryAction,
      blocks: [
        { key: "openstaand_bedrag", amountCents: openAmountCents, count: open.length },
        { key: "te_laat", count: overdue.length },
        {
          key: "deze_maand_gefactureerd",
          count: sentThisMonth.length,
          amountCents: sentThisMonth.reduce((s, i) => s + i.amountInclCents, 0),
        },
        { key: "concepten", count: concepts.length },
        { key: "verstuurd", count: invoices.filter((i) => i.status === "verzonden").length },
        { key: "betaald", count: invoices.filter((i) => i.status === "betaald").length },
        { key: "gecrediteerd", count: invoices.filter((i) => i.status === "gecrediteerd").length },
        { key: "eerstvolgend_facturatiemoment", date: nextMoments[0] ?? null },
        {
          key: "klanten_zonder_actieve_afspraak",
          count: clientsWithoutAgreement.length,
          clients: clientsWithoutAgreement.map((c) => ({ id: c.id, name: c.name })),
        },
        { key: "ontbrekende_gegevens", items: missing },
        {
          key: "exportstatus",
          note: "Export in CSV en Excel beschikbaar via /invoices/export.",
        },
        {
          key: "laatste_wijzigingen",
          events: events.map((e) => ({ kind: e.kind, body: e.body, createdAt: e.createdAt })),
        },
      ],
    });
  } catch (err) {
    req.log.error({ err }, "billing dashboard failed");
    res.status(500).json({ error: "Startscherm ophalen is niet gelukt." });
  }
});

// ── F14 (3b-F) — rapportage: feiten voor de trainer. Btw-overzicht is een
// informatief overzicht, geen aangifte.
router.get("/reports", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const year = String(req.query.year ?? amsterdamToday().slice(0, 4));
    if (!/^\d{4}$/.test(year)) {
      res.status(400).json({ error: "year (JJJJ) is ongeldig." });
      return;
    }
    const sent = await db
      .select()
      .from(trainerInvoicesTable)
      .where(
        and(
          eq(trainerInvoicesTable.trainerClerkId, trainerClerkId),
          gte(trainerInvoicesTable.invoiceDate, `${year}-01-01`),
          lte(trainerInvoicesTable.invoiceDate, `${year}-12-31`),
          inArray(trainerInvoicesTable.status, [
            "verzonden",
            "te_laat",
            "deels_betaald",
            "betaald",
            "gecrediteerd",
            "oninbaar",
          ]),
        ),
      );
    const credits = await db
      .select()
      .from(creditNotesTable)
      .where(eq(creditNotesTable.trainerClerkId, trainerClerkId));
    const creditByInvoice = new Map<number, number>();
    for (const c of credits) {
      creditByInvoice.set(c.invoiceId, (creditByInvoice.get(c.invoiceId) ?? 0) + c.amountInclCents);
    }
    const netOf = (inv: (typeof sent)[number]) =>
      inv.amountInclCents - (creditByInvoice.get(inv.id) ?? 0);

    const perMonth: Record<string, number> = {};
    const perQuarter: Record<string, number> = {};
    const perClient: Record<string, number> = {};
    let vatCents = 0;
    let korCents = 0;
    for (const inv of sent) {
      const month = inv.invoiceDate!.slice(0, 7);
      const q = `K${Math.ceil(Number(inv.invoiceDate!.slice(5, 7)) / 3)}`;
      const net = netOf(inv);
      perMonth[month] = (perMonth[month] ?? 0) + net;
      perQuarter[q] = (perQuarter[q] ?? 0) + net;
      perClient[String(inv.clientId)] = (perClient[String(inv.clientId)] ?? 0) + net;
      if (inv.korApplied) korCents += net;
      else if (inv.vatBreakdown)
        vatCents += Object.values(inv.vatBreakdown).reduce((s, v) => s + v, 0);
    }
    const open = sent.filter((i) =>
      ["verzonden", "te_laat", "deels_betaald"].includes(i.status),
    );
    const paidWithDates = sent.filter((i) => i.paidAt && i.sentAt);
    res.json({
      year,
      totalCents: sent.reduce((s, i) => s + netOf(i), 0),
      perMonth,
      perQuarter,
      perClient,
      openAmountCents: open.reduce((s, i) => s + Math.max(0, i.amountInclCents - i.paidCents), 0),
      avgPaymentDays: paidWithDates.length
        ? Math.round(
            paidWithDates.reduce(
              (s, i) => s + (i.paidAt!.getTime() - i.sentAt!.getTime()) / 86_400_000,
              0,
            ) / paidWithDates.length,
          )
        : null,
      activeClients: new Set(sent.map((i) => i.clientId)).size,
      invoiceCount: sent.length,
      vatOverview: {
        note: "Informatief overzicht, geen btw-aangifte.",
        vatCents,
        korExemptCents: korCents,
      },
    });
  } catch (err) {
    req.log.error({ err }, "billing reports failed");
    res.status(500).json({ error: "Rapportage ophalen is niet gelukt." });
  }
});

export default router;
