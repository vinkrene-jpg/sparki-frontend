// Sparki Connect — koppeling-gezondheid (kapotte koppeling actief melden).
//
// Kalibratie René (30-07-2026): een kapotte koppeling verdient een actieve
// melding (push/badge), niet stil wachten tot de sporter zelf kijkt:
//   • toestemming verlopen (consentExpired) → verbind opnieuw;
//   • >24 uur geen geslaagde sync op een automatisch synchroniserend platform.
//
// Meldingsstorm-veilig: één open melding per storing via resolutionKey
// `link:<provider>` (createNotification slaat over zolang er een onopgeloste
// rij ligt); een geslaagde sync lost hem vanzelf op (runSync). Push gaat
// UITSLUITEND bij een vers aangemaakte rij — nooit opnieuw per poging — en
// respecteert de meldingsvoorkeuren van de sporter. Eerlijk: we claimen nooit
// bezorging; een mislukte push wordt alleen geteld, de in-app melding blijft.

import { eq } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  pushSubscriptionsTable,
  type ConnectorConnection,
} from "@workspace/db";
import {
  createNotification,
  TYPE_CATEGORY,
  type CreateNotificationInput,
} from "../../lib/notifications";
import { pushChannelStatus, sendPush } from "../../lib/push";
import { getPrefs, channelAllowed } from "../reminders/preferences";
import {
  deriveConnectState,
  isSyncStale,
} from "../../lib/connectors/connect-status";
import {
  connectorRegistry,
  getConnectorDefinition,
} from "../../lib/connectors/registry";
import { getHubProvider } from "./providers";

/** Platforms waarvoor automatische sync bestaat (zelfde regel als de geplande
 *  inhaalsync) — alleen dáár is ">24u geen sync" een eerlijk kapot-signaal.
 *  Lokaal berekend (registry + providers) om een importcyclus met
 *  scheduled-sync → index (runSync) te vermijden. */
function autoSyncProviders(): string[] {
  return connectorRegistry
    .filter(
      (def) => def.available && Boolean(getHubProvider(def.id)?.fetchAndNormalize),
    )
    .map((def) => def.id)
    .filter((id) => id !== "file");
}

export type BrokenLinkReason = "consent_expired" | "sync_stale";

/**
 * Puur oordeel over één verbindingsrij: is deze koppeling stuk, en waarom?
 * Toestemming-verlopen weegt zwaarder dan alleen-verouderd (specifiekere
 * herstelactie). `null` = niets aan de hand.
 */
export function evaluateConnectionHealth(
  row: ConnectorConnection,
  now: Date = new Date(),
): BrokenLinkReason | null {
  const state = deriveConnectState(row, { now });
  if (state.consentExpired) return "consent_expired";
  if (isSyncStale(row, now)) return "sync_stale";
  return null;
}

/** resolutionKey voor kapotte-koppeling-meldingen; runSync lost hem op bij een
 *  geslaagde sync. */
export function linkResolutionKey(provider: string): string {
  return `link:${provider}`;
}

// ── Push (best-effort, voorkeuren-bewust, nooit dubbel) ─────────────────────

// NOT-03 (reviewfix): de push-payload voor koppelingsmeldingen. Pure functie —
// gebruikt ALLEEN de expliciete neutrale velden, met een veilige neutrale
// default, en NOOIT de (specifieke) in-app title/body. Zo is per test te
// bewijzen dat er geen providernaam/status/getallen in de push lekken.
export function neutralLinkPushPayload(input: {
  pushTitle?: string;
  pushBody?: string;
}): { title: string; body: string } {
  return {
    title: input.pushTitle ?? "Er is iets met een koppeling",
    body: input.pushBody ?? "Er is iets met je synchronisatie — open de app.",
  };
}

/**
 * Maak de in-app melding en stuur — alleen wanneer de rij ÉCHT nieuw is — een
 * push naar de apparaten van de sporter. Respecteert meldingsvoorkeuren
 * (kanaal per categorie + stille uren). Best-effort: gooit nooit.
 * Geeft terug of er een nieuwe in-app melding is aangemaakt.
 *
 * NOT-03 (reviewfix): de PUSH-tekst is NEUTRAAL — geen providernaam of status.
 * De in-app rij (`input.title`/`input.body`) mag wél specifiek blijven; de
 * pushtekst komt uit `pushTitle`/`pushBody` (met een veilige, neutrale default)
 * en `actionUrl` brengt de gebruiker naar de juiste context.
 */
export async function notifyWithPush(
  input: CreateNotificationInput & {
    actionUrl: string;
    pushTitle?: string;
    pushBody?: string;
  },
  now: Date = new Date(),
): Promise<boolean> {
  const created = await createNotification(input);
  if (!created) return false;

  try {
    if (pushChannelStatus().state !== "ready") return created;
    const category =
      input.category ?? TYPE_CATEGORY[input.type] ?? "systeem";
    const prefs = await getPrefs(input.clerkId);
    if (!channelAllowed(prefs, "push", category, now)) return created;

    // Neutrale pushtekst: nooit providernaam/status/getallen in de push.
    const { title: pushTitle, body: pushBody } = neutralLinkPushPayload(input);

    const subs = await db
      .select({
        id: pushSubscriptionsTable.id,
        endpoint: pushSubscriptionsTable.endpoint,
        p256dh: pushSubscriptionsTable.p256dh,
        auth: pushSubscriptionsTable.auth,
      })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.clerkId, input.clerkId));
    for (const sub of subs) {
      const r = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: pushTitle,
          body: pushBody,
          url: input.actionUrl,
          tag: input.dedupeKey ?? input.resolutionKey ?? undefined,
        },
      );
      if (!r.ok && r.prune) {
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.id, sub.id));
      }
    }
  } catch {
    // Push is een extraatje bovenop de in-app melding — nooit een reden om de
    // aanroeper (sync of job) te laten falen.
  }
  return created;
}

// ── Geplande controle over alle koppelingen ─────────────────────────────────

export interface ConnectionHealthSummary {
  checked: number;
  broken: number;
  notified: number;
}

export function brokenLinkCopy(
  reason: BrokenLinkReason,
  displayName: string,
): { title: string; body: string } {
  if (reason === "consent_expired") {
    return {
      title: `${displayName}-toestemming verlopen`,
      body: `Je toestemming voor ${displayName} is verlopen; nieuwe ritten komen niet meer binnen. Verbind ${displayName} opnieuw via Jij → Koppelingen.`,
    };
  }
  return {
    title: `${displayName}-koppeling lijkt stuk`,
    body: `Al meer dan 24 uur geen geslaagde synchronisatie met ${displayName}. Controleer de koppeling via Jij → Koppelingen of verbind opnieuw.`,
  };
}

/**
 * Controleer alle verbindingsrijen van automatisch synchroniserende platforms
 * en meld kapotte koppelingen actief. Draait ná de geplande inhaalsync, zodat
 * een geslaagde inhaalsync eerst zelf de status herstelt. Sequentieel en per
 * rij geïsoleerd: één fout stopt de rest nooit.
 */
export async function runConnectionHealthCheck(opts: {
  now?: Date;
  log?: { warn: (o: unknown, m: string) => void };
} = {}): Promise<ConnectionHealthSummary> {
  const now = opts.now ?? new Date();
  const providers = new Set(autoSyncProviders());
  const summary: ConnectionHealthSummary = { checked: 0, broken: 0, notified: 0 };
  if (providers.size === 0) return summary;

  const rows = await db.select().from(connectorConnectionsTable);
  for (const row of rows) {
    if (!providers.has(row.provider)) continue;
    summary.checked++;
    try {
      const reason = evaluateConnectionHealth(row, now);
      if (!reason) continue;
      summary.broken++;
      const def = getConnectorDefinition(row.provider);
      const displayName = def?.displayName ?? row.provider;
      const copy = brokenLinkCopy(reason, displayName);
      const created = await notifyWithPush(
        {
          clerkId: row.clerkId,
          type: "sync_error",
          // In-app: specifiek (providernaam + status mag hier).
          title: copy.title,
          body: copy.body,
          priority: "high",
          actionUrl: "/you?focus=connections",
          source: "data-hub",
          audience: "athlete",
          resolutionKey: linkResolutionKey(row.provider),
          // NOT-03: NEUTRALE pushtekst — geen providernaam/status.
          pushTitle: "Er is iets met een koppeling",
          pushBody: "Je synchronisatie heeft aandacht nodig — open de app.",
        },
        now,
      );
      if (created) summary.notified++;
    } catch (err) {
      opts.log?.warn(
        { err, clerkId: row.clerkId, provider: row.provider },
        "connection-health: check failed for connection",
      );
    }
  }
  return summary;
}
