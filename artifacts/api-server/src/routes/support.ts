// ── Golf 27 — AI-helpdesk & supportautomatisering ───────────────────────────
// Eén helpdesk-ingang (vraag → context → betrouwbaar antwoord → ticket →
// menselijke opvolging → kennisverbetering). Deterministische besluiten in
// lib/support/helpdesk.ts; dit bestand draagt de HTTP-contracten, rechten
// (gebruiker ziet alleen eigen tickets; interne notities en AI-concepten
// blijven beheerdersdomein) en audit op alle beheeracties.

import { Router } from "express";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  supportTicketsTable,
  supportTicketMessagesTable,
  supportKnownIssuesTable,
  supportArticlesTable,
  helpdeskTurnsTable,
  userProfilesTable,
  errorGroupsTable,
  supportCategories,
  supportTicketStatuses,
  supportPriorities,
  helpdeskFeedbackValues,
  type SupportCategory,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";
import { writeAudit } from "../lib/security/audit";
import { createNotification } from "../lib/notifications";
import { aiMessage, AiBlockedError } from "../lib/ai/gateway";
import {
  classifyCategory,
  buildHelpdeskContext,
  decideAnswer,
  formulateAnswer,
  createOrAttachTicket,
  humanSendRequired,
  findArticles,
  CATEGORY_LABELS,
} from "../lib/support/helpdesk";
import { logger } from "../lib/logger";

const router = Router();

const str = (v: unknown, max = 4000): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null;

function requireAdmin(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId || !isAdmin(clerkId)) {
    res.status(403).json({ error: "Alleen voor beheerders" });
    return;
  }
  next();
}

// ── Helpdesk (gebruikerskant) ────────────────────────────────────────────────

// POST /api/support/helpdesk/ask — de centrale helpdesk-ingang.
router.post("/helpdesk/ask", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const question = str(body.question, 2000);
  if (!question || question.length < 3) {
    res.status(400).json({ error: "Stel eerst je vraag" });
    return;
  }
  try {
    const category = classifyCategory(question, str(body.category, 50));
    const ctx = await buildHelpdeskContext({
      clerkId,
      question,
      category,
      req,
      correlationId: str(body.correlationId, 100),
      isAdminUser: isAdmin(clerkId),
    });
    const decision = decideAnswer(question, category, ctx);
    const formulated = await formulateAnswer(clerkId, question, ctx, decision);

    // AI kon ondanks artikelen geen gegrond antwoord geven → eerlijk naar mens.
    let status = decision.status;
    let needsTicket = decision.needsTicket;
    if ((status === "direct" || status === "beperkt") && !formulated.answer) {
      status = "mens";
      needsTicket = true;
    }
    if (status === "meer_info") {
      formulated.answer =
        "Om je veilig te kunnen helpen heb ik iets meer informatie nodig. Beschrijf kort: wat wilde je doen, wat gebeurde er, en op welk scherm?";
    }

    let ticketId: number | null = null;
    let ticketAttached = false;
    if (needsTicket) {
      const ticket = await createOrAttachTicket({
        ctx,
        category,
        summary: question.slice(0, 200),
        humanReason: decision.humanReason,
        attachmentUrl: str(body.attachmentUrl, 500),
        attachmentConsent: body.attachmentConsent === true,
        body: question,
      });
      ticketId = ticket.ticketId;
      ticketAttached = ticket.attached;
      if (!formulated.answer) {
        formulated.answer =
          status === "storing_bekend"
            ? formulated.answer
            : decision.humanReason
              ? "Dit onderwerp handelt een medewerker persoonlijk af. Er is een supportticket aangemaakt; je krijgt bericht zodra er een reactie is. Er is niets gewijzigd aan je account, gegevens of betalingen."
              : "Hier heb ik geen betrouwbaar antwoord op vanuit de beheerde kennisbank. Ik heb een supportticket aangemaakt zodat een medewerker meekijkt; je krijgt bericht zodra er een reactie is.";
      }
    }

    const [turn] = await db
      .insert(helpdeskTurnsTable)
      .values({
        clerkId,
        role: ctx.role,
        category,
        question,
        screen: ctx.screen,
        appVersion: ctx.appVersion,
        platform: ctx.platform,
        correlationId: ctx.correlationId,
        errorGroupId: ctx.errorGroup?.id ?? null,
        knownIssueId: ctx.knownIssue?.id ?? null,
        answerStatus: status,
        answer: formulated.answer,
        sourceRefs: formulated.sourceRefs.length
          ? JSON.stringify(formulated.sourceRefs)
          : null,
        ticketId,
      })
      .returning({ id: helpdeskTurnsTable.id });

    res.json({
      turnId: turn!.id,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      status,
      answer: formulated.answer,
      sources: formulated.sourceRefs,
      ticketId,
      ticketAttached,
      knownIssue: ctx.knownIssue
        ? { id: ctx.knownIssue.id, title: ctx.knownIssue.title }
        : null,
    });
  } catch (err) {
    logger.error({ err }, "helpdesk ask failed");
    res.status(500).json({ error: "De helpdesk is nu niet bereikbaar. Probeer het straks opnieuw." });
  }
});

// POST /api/support/helpdesk/:id/feedback — beoordeling van een antwoord.
router.post("/helpdesk/:id/feedback", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const feedback = str((req.body ?? {}).feedback, 30);
  if (!Number.isInteger(id) || !feedback || !(helpdeskFeedbackValues as readonly string[]).includes(feedback)) {
    res.status(400).json({ error: "Ongeldige beoordeling" });
    return;
  }
  const [turn] = await db
    .select()
    .from(helpdeskTurnsTable)
    .where(and(eq(helpdeskTurnsTable.id, id), eq(helpdeskTurnsTable.clerkId, clerkId)))
    .limit(1);
  if (!turn) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }

  let ticketId = turn.ticketId;
  // Negatieve beoordeling zonder ticket → automatisch ticket (opdracht 7).
  if ((feedback === "niet_geholpen" || feedback === "onjuist") && !ticketId) {
    const category = turn.category as SupportCategory;
    const ctx = await buildHelpdeskContext({
      clerkId,
      question: turn.question,
      category,
      correlationId: turn.correlationId,
    });
    const ticket = await createOrAttachTicket({
      ctx,
      category,
      summary: turn.question.slice(0, 200),
      humanReason: null,
      body: `Antwoord hielp niet (beoordeling: ${feedback}).\n\nVraag: ${turn.question}\n\nGegeven antwoord: ${turn.answer ?? "—"}`,
    });
    ticketId = ticket.ticketId;
  }

  await db
    .update(helpdeskTurnsTable)
    .set({
      feedback,
      feedbackAt: new Date(),
      ticketId,
      answerStatus: feedback === "opgelost" ? "opgelost" : turn.answerStatus,
    })
    .where(eq(helpdeskTurnsTable.id, id));
  res.json({ ok: true, ticketId });
});

// GET /api/support/artikelen — gepubliceerde artikelen (rolgebonden).
router.get("/artikelen", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const q = str(req.query.q, 200) ?? "";
  const [profile] = await db
    .select({ activeRole: userProfilesTable.activeRole })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId))
    .limit(1);
  const role = profile?.activeRole ?? "athlete";
  if (q) {
    const articles = await findArticles(q, classifyCategory(q, null), role, 10);
    res.json({ articles: articles.map(publicArticle) });
    return;
  }
  const rows = await db
    .select()
    .from(supportArticlesTable)
    .where(eq(supportArticlesTable.status, "gepubliceerd"))
    .orderBy(desc(supportArticlesTable.updatedAt))
    .limit(50);
  const visible = rows.filter((a) => {
    if (!a.audienceRoles) return true;
    try {
      return (JSON.parse(a.audienceRoles) as string[]).includes(role);
    } catch {
      return false;
    }
  });
  res.json({ articles: visible.map(publicArticle) });
});

function publicArticle(a: typeof supportArticlesTable.$inferSelect) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    body: a.body,
    category: a.category,
    version: a.version,
    updatedAt: a.updatedAt,
  };
}

// ── Tickets (gebruikerskant) ─────────────────────────────────────────────────

router.get("/tickets", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.clerkId, clerkId))
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(100);
  res.json({ tickets });
});

router.get("/tickets/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.clerkId, clerkId)))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  // Gebruiker ziet NOOIT interne notities of onverzonden concepten.
  const messages = await db
    .select()
    .from(supportTicketMessagesTable)
    .where(
      and(
        eq(supportTicketMessagesTable.ticketId, id),
        eq(supportTicketMessagesTable.internal, false),
        or(
          eq(supportTicketMessagesTable.isDraft, false),
          sql`${supportTicketMessagesTable.sentAt} IS NOT NULL`,
        ),
      ),
    )
    .orderBy(supportTicketMessagesTable.createdAt);
  res.json({ ticket, messages });
});

router.post("/tickets/:id/messages", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const body = str((req.body ?? {}).body, 4000);
  if (!body) {
    res.status(400).json({ error: "Bericht is leeg" });
    return;
  }
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.clerkId, clerkId)))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  if (ticket.status === "samengevoegd") {
    res.status(409).json({ error: "Dit ticket is samengevoegd met een ander ticket" });
    return;
  }
  await db.insert(supportTicketMessagesTable).values({
    ticketId: id,
    authorClerkId: clerkId,
    authorRole: "gebruiker",
    body,
    sentAt: new Date(),
  });
  // Reageren op een afgesloten ticket heropent het.
  const reopen = ticket.status === "opgelost" || ticket.status === "gesloten";
  await db
    .update(supportTicketsTable)
    .set({ updatedAt: new Date(), ...(reopen ? { status: "heropend", resolvedAt: null } : {}) })
    .where(eq(supportTicketsTable.id, id));
  res.json({ ok: true, reopened: reopen });
});

// ── Beheeromgeving ───────────────────────────────────────────────────────────

// GET /api/support/beheer/tickets — wachtrij met zoeken/filters.
router.get("/beheer/tickets", requireAuth, requireAdmin, async (req, res) => {
  const conditions = [];
  const status = str(req.query.status, 30);
  const category = str(req.query.category, 40);
  const priority = str(req.query.priority, 20);
  const assignee = str(req.query.assignee, 100);
  const q = str(req.query.q, 200);
  if (status && (supportTicketStatuses as readonly string[]).includes(status))
    conditions.push(eq(supportTicketsTable.status, status));
  if (category && (supportCategories as readonly string[]).includes(category))
    conditions.push(eq(supportTicketsTable.category, category));
  if (priority && (supportPriorities as readonly string[]).includes(priority))
    conditions.push(eq(supportTicketsTable.priority, priority));
  if (assignee) conditions.push(eq(supportTicketsTable.assignee, assignee));
  if (q) conditions.push(ilike(supportTicketsTable.summary, `%${q}%`));

  const rows = await db
    .select({
      ticket: supportTicketsTable,
      displayName: userProfilesTable.displayName,
    })
    .from(supportTicketsTable)
    .leftJoin(userProfilesTable, eq(supportTicketsTable.clerkId, userProfilesTable.clerkId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(200);
  res.json({ tickets: rows.map((r) => ({ ...r.ticket, displayName: r.displayName })) });
});

// GET /api/support/beheer/groepen — terugkerende problemen (opdracht 11).
router.get("/beheer/groepen", requireAuth, requireAdmin, async (_req, res) => {
  const groups = await db
    .select({
      errorGroupId: supportTicketsTable.errorGroupId,
      knownIssueId: supportTicketsTable.knownIssueId,
      category: supportTicketsTable.category,
      ticketCount: sql<number>`count(*)::int`,
      userCount: sql<number>`count(distinct ${supportTicketsTable.clerkId})::int`,
      appVersions: sql<string[]>`array_agg(distinct ${supportTicketsTable.appVersion}) filter (where ${supportTicketsTable.appVersion} is not null)`,
      lastAt: sql<string>`max(${supportTicketsTable.updatedAt})`,
    })
    .from(supportTicketsTable)
    .where(
      and(
        isNull(supportTicketsTable.mergedIntoId),
        or(
          sql`${supportTicketsTable.errorGroupId} IS NOT NULL`,
          sql`${supportTicketsTable.knownIssueId} IS NOT NULL`,
        ),
      ),
    )
    .groupBy(
      supportTicketsTable.errorGroupId,
      supportTicketsTable.knownIssueId,
      supportTicketsTable.category,
    )
    .orderBy(desc(sql`count(*)`))
    .limit(50);

  const groupIds = groups.map((g) => g.errorGroupId).filter((x): x is number => x !== null);
  const errorInfo = groupIds.length
    ? await db
        .select({
          id: errorGroupsTable.id,
          message: errorGroupsTable.message,
          severity: errorGroupsTable.severity,
        })
        .from(errorGroupsTable)
        .where(inArray(errorGroupsTable.id, groupIds))
    : [];
  res.json({
    groups: groups.map((g) => ({
      ...g,
      error: errorInfo.find((e) => e.id === g.errorGroupId) ?? null,
    })),
  });
});

router.get("/beheer/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(String(req.params.id));
  const [row] = await db
    .select({
      ticket: supportTicketsTable,
      displayName: userProfilesTable.displayName,
    })
    .from(supportTicketsTable)
    .leftJoin(userProfilesTable, eq(supportTicketsTable.clerkId, userProfilesTable.clerkId))
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const messages = await db
    .select()
    .from(supportTicketMessagesTable)
    .where(eq(supportTicketMessagesTable.ticketId, id))
    .orderBy(supportTicketMessagesTable.createdAt);
  const turns = await db
    .select()
    .from(helpdeskTurnsTable)
    .where(eq(helpdeskTurnsTable.ticketId, id))
    .orderBy(helpdeskTurnsTable.createdAt);
  res.json({
    ticket: { ...row.ticket, displayName: row.displayName },
    messages,
    turns,
    humanSendRequired: humanSendRequired(row.ticket),
  });
});

// PATCH — status/prioriteit/verantwoordelijke/bekende storing.
router.patch("/beheer/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const status = str(body.status, 30);
  if (status) {
    if (!(supportTicketStatuses as readonly string[]).includes(status) || status === "samengevoegd") {
      res.status(400).json({ error: "Ongeldige status" });
      return;
    }
    updates.status = status;
    updates.resolvedAt = status === "opgelost" ? new Date() : null;
  }
  const priority = str(body.priority, 20);
  if (priority) {
    if (!(supportPriorities as readonly string[]).includes(priority)) {
      res.status(400).json({ error: "Ongeldige prioriteit" });
      return;
    }
    updates.priority = priority;
  }
  if ("assignee" in body) updates.assignee = str(body.assignee, 100);
  if ("knownIssueId" in body) {
    updates.knownIssueId =
      body.knownIssueId === null ? null : Number(body.knownIssueId) || null;
  }
  await db.update(supportTicketsTable).set(updates).where(eq(supportTicketsTable.id, id));
  await writeAudit({
    event: "support_ticket_changed",
    actorClerkId: adminId,
    subjectClerkId: ticket.clerkId,
    meta: { ticketId: id, updates: Object.keys(updates).filter((k) => k !== "updatedAt") },
    req,
  });
  if (status === "opgelost") {
    await createNotification({
      clerkId: ticket.clerkId,
      type: "system",
      title: "Je supportvraag is opgelost",
      body: `Je ticket "${ticket.summary.slice(0, 80)}" is opgelost. Bekijk de reactie bij je supportvragen.`,
      source: "support",
      dedupeKey: `support:resolved:${id}`,
    });
  }
  res.json({ ok: true });
});

// Interne notitie (alleen beheerders zien deze ooit).
router.post("/beheer/tickets/:id/notitie", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const body = str((req.body ?? {}).body, 4000);
  if (!body) {
    res.status(400).json({ error: "Notitie is leeg" });
    return;
  }
  const [ticket] = await db
    .select({ id: supportTicketsTable.id })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  await db.insert(supportTicketMessagesTable).values({
    ticketId: id,
    authorClerkId: adminId,
    authorRole: "beheerder",
    body,
    internal: true,
    sentAt: new Date(),
  });
  res.json({ ok: true });
});

// AI-conceptantwoord: alleen een concept, nooit direct naar de gebruiker.
router.post("/beheer/tickets/:id/concept", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const messages = await db
    .select()
    .from(supportTicketMessagesTable)
    .where(
      and(
        eq(supportTicketMessagesTable.ticketId, id),
        eq(supportTicketMessagesTable.internal, false),
        eq(supportTicketMessagesTable.isDraft, false),
      ),
    )
    .orderBy(supportTicketMessagesTable.createdAt)
    .limit(20);
  const articles = await findArticles(ticket.summary, ticket.category as SupportCategory, ticket.role ?? "athlete", 3);
  try {
    const message = await aiMessage("helpdesk", adminId, {
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `Je schrijft een CONCEPT-antwoord voor een menselijke supportmedewerker van Sparki (Nederlands wielerplatform). Alleen Nederlands. Gebruik uitsluitend de meegeleverde ticketinhoud en kennisartikelen; verzin niets; beloof geen wijzigingen aan accounts, betalingen of data; geen medische adviezen. De medewerker controleert en verzendt. Maximaal ~150 woorden.`,
      messages: [
        {
          role: "user",
          content: `Ticket (categorie ${ticket.category}, rol ${ticket.role ?? "onbekend"}):\n${ticket.summary}\n\nBerichten:\n${messages.map((m) => `${m.authorRole}: ${m.body.slice(0, 500)}`).join("\n")}\n\nKennisartikelen:\n${articles.map((a) => `[${a.title}]\n${a.body.slice(0, 1200)}`).join("\n\n") || "(geen)"}`,
        },
      ],
    });
    const block = message.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) {
      res.status(502).json({ error: "Geen concept beschikbaar" });
      return;
    }
    const [draft] = await db
      .insert(supportTicketMessagesTable)
      .values({
        ticketId: id,
        authorClerkId: adminId,
        authorRole: "beheerder",
        body: text,
        isDraft: true,
      })
      .returning({ id: supportTicketMessagesTable.id });
    res.json({ draftId: draft!.id, body: text, humanSendRequired: humanSendRequired(ticket) });
  } catch (err) {
    if (err instanceof AiBlockedError) {
      res.status(503).json({ error: "Conceptfunctie is nu niet beschikbaar" });
      return;
    }
    logger.error({ err }, "concept generation failed");
    res.status(500).json({ error: "Concept genereren mislukt" });
  }
});

// Menselijke verzending van een (bewerkt) antwoord naar de gebruiker.
router.post("/beheer/tickets/:id/verzend", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const bodyIn = (req.body ?? {}) as Record<string, unknown>;
  const text = str(bodyIn.body, 4000);
  if (!text) {
    res.status(400).json({ error: "Antwoord is leeg" });
    return;
  }
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const draftId = Number(bodyIn.draftId) || null;
  if (draftId) {
    // Bewerkt concept wordt de definitieve tekst en gemarkeerd als verzonden.
    await db
      .update(supportTicketMessagesTable)
      .set({ body: text, isDraft: false, sentAt: new Date(), authorClerkId: adminId })
      .where(
        and(
          eq(supportTicketMessagesTable.id, draftId),
          eq(supportTicketMessagesTable.ticketId, id),
        ),
      );
  } else {
    await db.insert(supportTicketMessagesTable).values({
      ticketId: id,
      authorClerkId: adminId,
      authorRole: "beheerder",
      body: text,
      sentAt: new Date(),
    });
  }
  const nextStatus = str(bodyIn.status, 30);
  const resolved = nextStatus === "opgelost";
  await db
    .update(supportTicketsTable)
    .set({
      updatedAt: new Date(),
      status: resolved ? "opgelost" : "wacht_op_gebruiker",
      resolvedAt: resolved ? new Date() : null,
    })
    .where(eq(supportTicketsTable.id, id));
  await writeAudit({
    event: "support_reply_sent",
    actorClerkId: adminId,
    subjectClerkId: ticket.clerkId,
    meta: { ticketId: id, resolved, humanSendRequired: humanSendRequired(ticket) },
    req,
  });
  await createNotification({
    clerkId: ticket.clerkId,
    type: "system",
    title: resolved ? "Je supportvraag is opgelost" : "Reactie op je supportvraag",
    body: `Er is een reactie op je ticket "${ticket.summary.slice(0, 80)}".`,
    source: "support",
    dedupeKey: `support:reply:${id}:${Date.now()}`,
  });
  res.json({ ok: true });
});

// Samenvoegen van dubbele tickets.
router.post("/beheer/tickets/:id/samenvoegen", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const intoId = Number((req.body ?? {}).intoId);
  if (!Number.isInteger(intoId) || intoId === id) {
    res.status(400).json({ error: "Ongeldig doelticket" });
    return;
  }
  const [source] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  const [target] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, intoId))
    .limit(1);
  if (!source || !target) {
    res.status(404).json({ error: "Ticket niet gevonden" });
    return;
  }
  if (target.mergedIntoId) {
    res.status(409).json({ error: "Doelticket is zelf al samengevoegd" });
    return;
  }
  await db
    .update(supportTicketsTable)
    .set({ status: "samengevoegd", mergedIntoId: intoId, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
  await db.insert(supportTicketMessagesTable).values({
    ticketId: intoId,
    authorClerkId: adminId,
    authorRole: "systeem",
    body: `Ticket #${id} is met dit ticket samengevoegd.`,
    internal: true,
    sentAt: new Date(),
  });
  await writeAudit({
    event: "support_ticket_changed",
    actorClerkId: adminId,
    subjectClerkId: source.clerkId,
    meta: { ticketId: id, mergedInto: intoId },
    req,
  });
  res.json({ ok: true });
});

// ── Bekende storingen ────────────────────────────────────────────────────────

router.get("/beheer/storingen", requireAuth, requireAdmin, async (_req, res) => {
  const issues = await db
    .select()
    .from(supportKnownIssuesTable)
    .orderBy(desc(supportKnownIssuesTable.createdAt))
    .limit(100);
  res.json({ issues });
});

router.post("/beheer/storingen", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = str(body.title, 200);
  const description = str(body.description, 2000);
  if (!title || !description) {
    res.status(400).json({ error: "Titel en omschrijving zijn verplicht" });
    return;
  }
  const [issue] = await db
    .insert(supportKnownIssuesTable)
    .values({
      title,
      description,
      category: str(body.category, 40),
      releaseVersion: str(body.releaseVersion, 40),
      errorFingerprint: str(body.errorFingerprint, 100),
      createdBy: adminId,
    })
    .returning();
  await writeAudit({
    event: "support_known_issue_changed",
    actorClerkId: adminId,
    meta: { issueId: issue!.id, action: "created" },
    req,
  });
  res.json({ issue });
});

// Storing oplossen: informeert alle getroffen gebruikers (opdracht 11).
router.patch("/beheer/storingen/:id", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const [issue] = await db
    .select()
    .from(supportKnownIssuesTable)
    .where(eq(supportKnownIssuesTable.id, id))
    .limit(1);
  if (!issue) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (str(body.title, 200)) updates.title = str(body.title, 200);
  if (str(body.description, 2000)) updates.description = str(body.description, 2000);
  if ("releaseVersion" in body) updates.releaseVersion = str(body.releaseVersion, 40);
  const resolve = body.status === "opgelost" && issue.status !== "opgelost";
  if (resolve) {
    updates.status = "opgelost";
    updates.resolvedAt = new Date();
  }
  await db.update(supportKnownIssuesTable).set(updates).where(eq(supportKnownIssuesTable.id, id));
  let notified = 0;
  if (resolve) {
    const affected = await db
      .select({ clerkId: supportTicketsTable.clerkId })
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.knownIssueId, id))
      .groupBy(supportTicketsTable.clerkId);
    for (const a of affected) {
      await createNotification({
        clerkId: a.clerkId,
        type: "system",
        title: "Storing opgelost",
        body: `De storing "${issue.title}" is opgelost. Werkte iets daardoor niet? Probeer het nu opnieuw.`,
        source: "support",
        dedupeKey: `support:issue-resolved:${id}:${a.clerkId}`,
      });
      notified += 1;
    }
  }
  await writeAudit({
    event: "support_known_issue_changed",
    actorClerkId: adminId,
    meta: { issueId: id, action: resolve ? "resolved" : "updated", notified },
    req,
  });
  res.json({ ok: true, notified });
});

// ── Kennisartikelen (beheer) ─────────────────────────────────────────────────

router.get("/beheer/artikelen", requireAuth, requireAdmin, async (_req, res) => {
  const articles = await db
    .select()
    .from(supportArticlesTable)
    .orderBy(desc(supportArticlesTable.updatedAt))
    .limit(200);
  res.json({ articles });
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

router.post("/beheer/artikelen", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = str(body.title, 200);
  const text = str(body.body, 20000);
  const category = str(body.category, 40);
  if (!title || !text || !category || !(supportCategories as readonly string[]).includes(category)) {
    res.status(400).json({ error: "Titel, tekst en geldige categorie zijn verplicht" });
    return;
  }
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const [article] = await db
    .insert(supportArticlesTable)
    .values({
      slug,
      title,
      body: text,
      category,
      keywords: str(body.keywords, 500),
      audienceRoles: Array.isArray(body.audienceRoles)
        ? JSON.stringify((body.audienceRoles as unknown[]).map(String).slice(0, 10))
        : null,
      sourceTicketId: Number(body.sourceTicketId) || null,
      createdBy: adminId,
    })
    .returning();
  res.json({ article });
});

// Opgelost ticket → concept-kennisartikel (opdracht 12).
router.post("/beheer/tickets/:id/naar-artikel", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  if (ticket.status !== "opgelost" && ticket.status !== "gesloten") {
    res.status(409).json({ error: "Alleen een opgelost ticket kan een kennisartikel worden" });
    return;
  }
  const replies = await db
    .select()
    .from(supportTicketMessagesTable)
    .where(
      and(
        eq(supportTicketMessagesTable.ticketId, id),
        eq(supportTicketMessagesTable.authorRole, "beheerder"),
        eq(supportTicketMessagesTable.internal, false),
        eq(supportTicketMessagesTable.isDraft, false),
      ),
    )
    .orderBy(desc(supportTicketMessagesTable.createdAt))
    .limit(1);
  const answer = replies[0]?.body ?? "";
  const title = ticket.summary.slice(0, 150);
  const [article] = await db
    .insert(supportArticlesTable)
    .values({
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      title,
      body: answer || "Vul hier de oplossing in (overgenomen uit het ticket).",
      category: ticket.category,
      sourceTicketId: id,
      createdBy: adminId,
    })
    .returning();
  res.json({ article });
});

router.patch("/beheer/artikelen/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(String(req.params.id));
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [article] = await db
    .select()
    .from(supportArticlesTable)
    .where(eq(supportArticlesTable.id, id))
    .limit(1);
  if (!article) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (str(body.title, 200)) updates.title = str(body.title, 200);
  if (str(body.body, 20000)) updates.body = str(body.body, 20000);
  if ("keywords" in body) updates.keywords = str(body.keywords, 500);
  if ("audienceRoles" in body) {
    updates.audienceRoles = Array.isArray(body.audienceRoles)
      ? JSON.stringify((body.audienceRoles as unknown[]).map(String).slice(0, 10))
      : null;
  }
  const category = str(body.category, 40);
  if (category && (supportCategories as readonly string[]).includes(category))
    updates.category = category;
  if (body.status === "gearchiveerd") updates.status = "gearchiveerd";
  await db.update(supportArticlesTable).set(updates).where(eq(supportArticlesTable.id, id));
  res.json({ ok: true });
});

// Publicatie vereist menselijke controle; iedere publicatie = versie + 1.
router.post("/beheer/artikelen/:id/publiceer", requireAuth, requireAdmin, async (req, res) => {
  const adminId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const [article] = await db
    .select()
    .from(supportArticlesTable)
    .where(eq(supportArticlesTable.id, id))
    .limit(1);
  if (!article) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const [updated] = await db
    .update(supportArticlesTable)
    .set({
      status: "gepubliceerd",
      version: article.version + 1,
      publishedBy: adminId,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(supportArticlesTable.id, id))
    .returning();
  await writeAudit({
    event: "support_article_published",
    actorClerkId: adminId,
    meta: { articleId: id, version: updated!.version },
    req,
  });
  res.json({ article: updated });
});

export default router;
