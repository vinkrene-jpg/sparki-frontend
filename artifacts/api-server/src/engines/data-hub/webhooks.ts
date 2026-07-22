import { and, eq } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  webhookEventsTable,
  type WebhookEvent,
} from "@workspace/db";
import { runSync } from "./index";

// ── Webhook-verwerking (Data Hub) ────────────────────────────────────────────
// Iedere binnenkomende push-melding (Strava/Garmin/Wahoo) wordt EERST idempotent
// vastgelegd in webhook_events (unieke provider+eventId). Een opnieuw
// afgeleverde melding voegt niets toe en wordt overgeslagen — nooit dubbel
// verwerkt. Verwerking = een reguliere runSync met trigger "webhook", zodat
// dedupe/consent/provenance identiek zijn aan iedere andere sync.

export interface RecordWebhookResult {
  /** De vastgelegde rij, of null wanneer dit event al bestond (duplicaat). */
  event: WebhookEvent | null;
  duplicate: boolean;
}

/** Idempotent vastleggen. Duplicaat (zelfde provider+eventId) ⇒ geen rij. */
export async function recordWebhookEvent(opts: {
  provider: string;
  eventId: string;
  externalUserId?: string | null;
  payload?: unknown;
}): Promise<RecordWebhookResult> {
  const clerkId = opts.externalUserId
    ? await resolveClerkIdByExternalUser(opts.provider, opts.externalUserId)
    : null;
  const [row] = await db
    .insert(webhookEventsTable)
    .values({
      provider: opts.provider,
      eventId: opts.eventId,
      externalUserId: opts.externalUserId ?? null,
      clerkId,
      payload: opts.payload ?? null,
      status: "received",
    })
    .onConflictDoNothing({
      target: [webhookEventsTable.provider, webhookEventsTable.eventId],
    })
    .returning();
  return { event: row ?? null, duplicate: !row };
}

/**
 * Zoek de Sparki-gebruiker bij een extern gebruikers-id. Null wanneer geen
 * verbonden koppeling matcht (onbekende gebruiker = eerlijk overslaan).
 */
export async function resolveClerkIdByExternalUser(
  provider: string,
  externalUserId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ clerkId: connectorConnectionsTable.clerkId })
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.provider, provider),
        eq(connectorConnectionsTable.externalUserId, externalUserId),
        eq(connectorConnectionsTable.status, "connected"),
      ),
    )
    .limit(1);
  return row?.clerkId ?? null;
}

/**
 * Verwerk één vastgelegd webhook-event: onbekende gebruiker ⇒ "skipped" (met
 * reden), anders een reguliere sync met trigger "webhook". Fouten worden
 * eerlijk als "failed" gelogd met de foutmelding; attempts telt iedere poging.
 */
export async function processWebhookEvent(event: WebhookEvent): Promise<{
  status: "processed" | "skipped" | "failed";
  error?: string;
}> {
  const attempts = (event.attempts ?? 0) + 1;
  if (!event.clerkId) {
    await db
      .update(webhookEventsTable)
      .set({
        status: "skipped",
        attempts,
        lastError: "Geen gekoppelde Sparki-gebruiker voor dit externe account.",
        processedAt: new Date(),
      })
      .where(eq(webhookEventsTable.id, event.id));
    return { status: "skipped" };
  }
  try {
    await runSync(event.clerkId, event.provider, "webhook");
    await db
      .update(webhookEventsTable)
      .set({
        status: "processed",
        attempts,
        lastError: null,
        processedAt: new Date(),
      })
      .where(eq(webhookEventsTable.id, event.id));
    return { status: "processed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(webhookEventsTable)
      .set({
        status: "failed",
        attempts,
        lastError: message.slice(0, 500),
        processedAt: new Date(),
      })
      .where(eq(webhookEventsTable.id, event.id));
    return { status: "failed", error: message };
  }
}

/** Vastleggen + direct verwerken (het reguliere webhook-pad). */
export async function handleWebhookEvent(opts: {
  provider: string;
  eventId: string;
  externalUserId?: string | null;
  payload?: unknown;
}): Promise<{ status: "processed" | "skipped" | "failed" | "duplicate" }> {
  const recorded = await recordWebhookEvent(opts);
  if (recorded.duplicate || !recorded.event) return { status: "duplicate" };
  const result = await processWebhookEvent(recorded.event);
  return { status: result.status };
}
