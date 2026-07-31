// ── Stripe-webhookverwerking (fase 2, TESTMODUS) ─────────────────────────────
// Contract (§5 fase-1-ontwerp):
//  • Elk event eerst als rij in stripe_webhook_events (event_id UNIQUE,
//    insert-on-conflict-do-nothing) — dubbele levering = no-op.
//  • Rechten worden uitsluitend in de succes-tak geschreven, binnen één
//    transactie met de eventregistratie; een verwerkingsfout rolt alles terug
//    zodat het event her-verwerkbaar blijft en NOOIT betaalde toegang geeft.
//  • Verkeerd geordende events: het event is een trigger, de actuele
//    Stripe-API-staat is de waarheid (altijd herlezen) + created-vergelijking.
//  • Onbekende status ⇒ fail-closed (geen rechten, wel loggen).
//  • Legacy-gebruikers worden nooit aangeraakt.

import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  billingSubscriptionsTable,
  stripeWebhookEventsTable,
  clubsTable,
  clubSubscriptionsTable,
  type CommercialTier,
} from "@workspace/db";
import {
  getStripeGateway,
  type SubscriptionState,
} from "./stripe-gateway";
import { GRACE_DAYS, isValidTier, isPaidTier, isValidInterval } from "./index";
import { createNotification } from "../notifications";
import { logger } from "../logger";

export interface StripeEventLike {
  id: string;
  type: string;
  created: number; // epoch seconden (Stripe-brontijd)
  data: { object: Record<string, unknown> };
}

export type WebhookOutcome =
  | { outcome: "processed"; detail?: string }
  | { outcome: "duplicate" }
  | { outcome: "ignored"; detail: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Stripe-subscription.status → interne status (ABONNEMENT_01, bindende tabel —
 * gedocumenteerd in docs/SPARKI_ABONNEMENTSFLOW.md):
 *   active/trialing → active (of canceled bij cancelAtPeriodEnd)
 *   past_due/unpaid → grace (zelfde route als invoice.payment_failed)
 *   canceled/incomplete_expired → expired
 *   incomplete → incomplete (geen rechten, betaling nog niet rond)
 *   paused → paused (rechten bevroren, gegevens behouden)
 *   onbekend → unknown (fail-closed: geen rechten, gelogd)
 */
export function mapStripeSubStatus(
  s: SubscriptionState,
): "active" | "canceled" | "expired" | "grace" | "incomplete" | "paused" | "unknown" {
  switch (s.status) {
    case "active":
    case "trialing": // hoort niet voor te komen (proef is Sparki-zijdig)
      return s.cancelAtPeriodEnd ? "canceled" : "active";
    case "past_due":
    case "unpaid":
      // Zelfde graceroute als invoice.payment_failed (herstelpunt 1.1):
      // rechten blijven tijdens grace, de vervaljob laat ze daarna vervallen.
      return "grace";
    case "canceled":
    case "incomplete_expired":
      return "expired";
    case "incomplete":
      return "incomplete";
    case "paused":
      return "paused";
    default:
      logger.warn(
        { stripeStatus: s.status, subscriptionId: s.id },
        "billing: onbekende Stripe-subscriptionstatus — fail-closed (geen rechten)",
      );
      return "unknown";
  }
}

/** Profieltier bijwerken — nooit voor legacy, alleen subscription-profielen. */
async function setProfileTier(
  tx: Tx,
  clerkId: string,
  tier: CommercialTier,
): Promise<void> {
  await tx
    .update(userProfilesTable)
    .set({ commercialTier: tier, updatedAt: new Date() })
    .where(
      and(
        eq(userProfilesTable.clerkId, clerkId),
        eq(userProfilesTable.entitlementMode, "subscription"),
      ),
    );
}

// Melding die ná een geslaagde transactie wordt aangemaakt (nooit binnen de
// transactie: een rollback mag geen melding achterlaten over een overgang die
// niet heeft plaatsgevonden).
export interface PendingBillingNotice {
  clerkId: string;
  title: string;
  body: string;
  dedupeKey: string;
}

/**
 * Eerlijke meldingsteksten per statusovergang (herstelpunt 1.8): wat er is
 * gebeurd, wat je nu wel/niet kunt, en wat je kunt doen. Geen aftelklok,
 * geen vooraf aangevinkte aankoop, geen onterechte dataverliesclaim.
 */
export function billingTransitionNotice(
  newStatus: string,
  args: { clerkId: string; subscriptionId: string; graceUntil?: Date | null },
): PendingBillingNotice | null {
  const base = {
    clerkId: args.clerkId,
    dedupeKey: `billing:${args.subscriptionId}:${newStatus}`,
  };
  switch (newStatus) {
    case "active":
      return {
        ...base,
        title: "Je abonnement is actief",
        body: "De betaling is gelukt. Alle onderdelen van je pakket zijn beschikbaar.",
      };
    case "grace":
      return {
        ...base,
        title: "Betaling niet gelukt",
        body:
          "De laatste betaling is niet gelukt. Je houdt nog 7 dagen volledige toegang zodat je dit rustig kunt oplossen. Werk je betaalmethode bij via Abonnement → Beheer. Je gegevens blijven altijd bewaard.",
      };
    case "canceled":
      return {
        ...base,
        title: "Opzegging bevestigd",
        body:
          "Je abonnement is opgezegd. Je houdt toegang tot het einde van de betaalde periode; daarna gaat je account verder als Gratis. Al je gegevens en routes blijven bewaard.",
      };
    case "expired":
      return {
        ...base,
        title: "Je abonnement is gestopt",
        body:
          "Je account staat nu op Gratis. Al je gegevens, ritten en routes zijn er nog gewoon. Opnieuw abonneren kan altijd via Abonnement.",
      };
    case "incomplete":
      return {
        ...base,
        title: "Betaling nog niet afgerond",
        body:
          "Je aanmelding is gestart, maar de eerste betaling is nog niet rond. Tot die tijd zijn de betaalde onderdelen niet beschikbaar. Rond de betaling af via Abonnement → Beheer, of begin opnieuw.",
      };
    case "paused":
      return {
        ...base,
        title: "Je abonnement is gepauzeerd",
        body:
          "De betaalde onderdelen staan tijdelijk stil. Al je gegevens blijven volledig bewaard. Hervatten kan op elk moment via Abonnement → Beheer.",
      };
    case "blocked":
      return {
        ...base,
        title: "Abonnement stopgezet na terugbetaling",
        body:
          "Je betaling is volledig terugbetaald en het abonnement is stopgezet. Je gegevens blijven bewaard. Vragen? Neem contact op via de helpdesk.",
      };
    case "unknown":
      return {
        ...base,
        title: "Abonnementstatus onduidelijk",
        body:
          "We kregen een status van de betaalprovider die we niet kennen. Uit voorzorg staan de betaalde onderdelen uit; je gegevens zijn veilig. We zoeken dit uit — neem gerust contact op via de helpdesk.",
      };
    default:
      return null;
  }
}

async function upsertFromSubscriptionState(
  tx: Tx,
  state: SubscriptionState,
  eventCreated: Date,
  notices: PendingBillingNotice[],
): Promise<string> {
  const clerkId = state.clerkId;
  if (!clerkId) return "genegeerd: subscription zonder clerk_id-metadata";
  const [profile] = await tx
    .select({ entitlementMode: userProfilesTable.entitlementMode })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (!profile) return `genegeerd: onbekende gebruiker ${clerkId}`;
  if (profile.entitlementMode === "legacy_unrestricted") {
    return "genegeerd: legacy-gebruiker wordt nooit aangeraakt";
  }
  const tier = isValidTier(state.tier) && isPaidTier(state.tier) ? state.tier : null;
  if (!tier) return "genegeerd: subscription zonder geldige tier-metadata (fail-closed)";
  const mapped = mapStripeSubStatus(state);

  const [existing] = await tx
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.stripeSubscriptionId, state.id));

  const interval = isValidInterval(state.interval) ? state.interval : "month";
  const now = new Date();

  // Grace via subscriptionstatus (past_due/unpaid): monotoon — nooit later
  // zetten dan wat er staat (zelfde regel als invoice.payment_failed).
  let graceUntil: Date | null | undefined = undefined;
  if (mapped === "grace") {
    const candidate = new Date(
      eventCreated.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    graceUntil =
      existing?.graceUntil && existing.graceUntil <= candidate
        ? existing.graceUntil
        : candidate;
  }

  if (!existing) {
    await tx.insert(billingSubscriptionsTable).values({
      clerkId,
      stripeCustomerId: state.customerId,
      stripeSubscriptionId: state.id,
      tier,
      interval,
      status: mapped, // onbekend is al expliciet "unknown" (fail-closed)
      stripePriceId: state.priceId,
      currentPeriodEnd: state.currentPeriodEnd,
      graceUntil: graceUntil ?? null,
      lastEventCreated: eventCreated,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // blocked is terminaal via refund-handhaving; een subscription-event
    // heft dat nooit stilzwijgend op.
    if (existing.status === "blocked") return "genegeerd: subscription is blocked";
    await tx
      .update(billingSubscriptionsTable)
      .set({
        clerkId,
        stripeCustomerId: state.customerId,
        tier,
        interval,
        status: mapped,
        stripePriceId: state.priceId ?? existing.stripePriceId,
        currentPeriodEnd: state.currentPeriodEnd ?? existing.currentPeriodEnd,
        // Betaald & actueel ⇒ grace-teller vervalt via invoice.paid; alleen
        // een grace-overgang zet hem hier (monotoon).
        ...(graceUntil !== undefined ? { graceUntil } : {}),
        lastEventCreated: eventCreated,
        updatedAt: now,
      })
      .where(eq(billingSubscriptionsTable.id, existing.id));
  }

  if (mapped === "active" || mapped === "canceled" || mapped === "grace") {
    // canceled behoudt tier-toegang tot periode-einde, grace tijdens de
    // graceperiode (vervaljob zet daarna FREE).
    await setProfileTier(tx, clerkId, tier);
  } else if (
    mapped === "expired" ||
    mapped === "incomplete" ||
    mapped === "paused" ||
    mapped === "unknown"
  ) {
    // Fail-closed / bevroren: geen betaalde rechten. Gegevens blijven
    // onaangeraakt; paused kan via een later active-event herstellen.
    await setProfileTier(tx, clerkId, "FREE");
  }

  if (existing?.status !== mapped) {
    const notice = billingTransitionNotice(mapped, {
      clerkId,
      subscriptionId: state.id,
      graceUntil: graceUntil ?? null,
    });
    if (notice) notices.push(notice);
  }

  // TEAM_ABONNEMENT_01: centrale facturatie — een TEAM-subscription met
  // club_id-metadata stuurt het clubabonnement van die ene organisatie.
  if (tier === "TEAM") {
    const teamDetail = await syncTeamClubSubscription(tx, state, clerkId, mapped);
    return `subscription ${state.id} → ${mapped}; ${teamDetail}`;
  }
  return `subscription ${state.id} → ${mapped}`;
}

// Vertaal de billing-status naar de bestaande club_subscriptions-status.
// Fail-closed: alles wat niet aantoonbaar betaald-en-actueel is, blokkeert
// nieuwe toevoegingen (bestaande data blijft altijd staan).
function teamClubStatus(mapped: string): "active" | "blocked" | "ended" {
  if (mapped === "active" || mapped === "grace" || mapped === "canceled") return "active";
  if (mapped === "expired") return "ended";
  return "blocked"; // paused | incomplete | unknown | blocked
}

async function syncTeamClubSubscription(
  tx: Tx,
  state: SubscriptionState,
  clerkId: string,
  mapped: string,
): Promise<string> {
  const clubId = state.clubId ?? null;
  if (clubId == null) return "team: genegeerd (geen club_id-metadata)";
  const [club] = await tx.select().from(clubsTable).where(eq(clubsTable.id, clubId));
  if (!club) return `team: genegeerd (club ${clubId} onbekend)`;
  // Fail-closed eigendomscheck: alleen de eigenaar van de club mag met zijn
  // subscription het clubabonnement sturen (metadata is geen autorisatie).
  if (club.ownerClerkId !== clerkId) {
    return `team: genegeerd (clerk is geen eigenaar van club ${clubId})`;
  }
  const status = teamClubStatus(mapped);
  const now = new Date();
  const [existingSub] = await tx
    .select()
    .from(clubSubscriptionsTable)
    .where(eq(clubSubscriptionsTable.clubId, clubId));
  // maxMembers blijft configureerbaar: een bestaande team-configuratie wordt
  // nooit stilzwijgend teruggezet; alleen bij eerste activering geldt 50.
  const keepLimits = existingSub?.packageKey === "team";
  if (existingSub) {
    await tx
      .update(clubSubscriptionsTable)
      .set({
        packageKey: "team",
        status,
        trialEndsAt: null,
        ...(keepLimits ? {} : { maxMembers: 50, maxTrainers: 10 }),
        billingRef: state.id,
        updatedAt: now,
      })
      .where(eq(clubSubscriptionsTable.clubId, clubId));
  } else {
    await tx.insert(clubSubscriptionsTable).values({
      clubId,
      packageKey: "team",
      status,
      trialEndsAt: null,
      maxMembers: 50,
      maxTrainers: 10,
      billingRef: state.id,
      createdAt: now,
      updatedAt: now,
    });
  }
  return `team: club ${clubId} → ${status}`;
}

async function handleEvent(
  tx: Tx,
  event: StripeEventLike,
  notices: PendingBillingNotice[],
): Promise<string> {
  const gateway = getStripeGateway();
  const obj = event.data.object;
  const eventCreated = new Date(event.created * 1000);

  switch (event.type) {
    case "checkout.session.completed": {
      // Alleen koppeling clerk_id ↔ customer/subscription; nog géén rechten —
      // die volgen uit de subscription-/invoice-staat.
      const subId =
        typeof obj["subscription"] === "string" ? (obj["subscription"] as string) : null;
      if (!subId) return "genegeerd: checkout zonder subscription";
      const state = await gateway.getSubscription(subId);
      if (!state) return "genegeerd: subscription niet gevonden bij Stripe";
      // clerk_id komt uit metadata die wij server-side hebben gezet.
      const metaClerk =
        (obj["client_reference_id"] as string | undefined) ??
        ((obj["metadata"] as Record<string, string> | undefined)?.["clerk_id"]);
      if (state.clerkId && metaClerk && state.clerkId !== metaClerk) {
        return "genegeerd: clerk_id-mismatch tussen sessie en subscription (fail-closed)";
      }
      return await upsertFromSubscriptionState(tx, state, eventCreated, notices);
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!subId) return "genegeerd: event zonder subscription-id";
      if (event.type === "customer.subscription.deleted") {
        const [existing] = await tx
          .select()
          .from(billingSubscriptionsTable)
          .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
        if (!existing) return "genegeerd: onbekende subscription";
        if (existing.status === "blocked") return "genegeerd: subscription is blocked";
        await tx
          .update(billingSubscriptionsTable)
          .set({ status: "expired", lastEventCreated: eventCreated, updatedAt: new Date() })
          .where(eq(billingSubscriptionsTable.id, existing.id));
        await setProfileTier(tx, existing.clerkId, "FREE");
        if (existing.status !== "expired") {
          const n = billingTransitionNotice("expired", {
            clerkId: existing.clerkId,
            subscriptionId: subId,
          });
          if (n) notices.push(n);
        }
        return `subscription ${subId} → expired (deleted)`;
      }
      // Herlezen bij Stripe: API-staat is de waarheid (lost out-of-order op).
      const state = await gateway.getSubscription(subId);
      if (!state) return "genegeerd: subscription niet gevonden bij Stripe";
      return await upsertFromSubscriptionState(tx, state, eventCreated, notices);
    }

    case "invoice.paid": {
      const invId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!invId) return "genegeerd: invoice zonder id";
      const invoice = await gateway.getInvoice(invId);
      if (!invoice?.subscriptionId) return "genegeerd: invoice zonder subscription";
      const [existing] = await tx
        .select()
        .from(billingSubscriptionsTable)
        .where(
          eq(billingSubscriptionsTable.stripeSubscriptionId, invoice.subscriptionId),
        );
      if (!existing) {
        // Invoice vóór subscription-event: herlezen en aanmaken.
        const state = await gateway.getSubscription(invoice.subscriptionId);
        if (!state) return "genegeerd: subscription niet gevonden bij Stripe";
        return await upsertFromSubscriptionState(tx, state, eventCreated, notices);
      }
      if (existing.status === "blocked") return "genegeerd: subscription is blocked";
      const state = await gateway.getSubscription(invoice.subscriptionId);
      // Fail-closed (review 31-07-2026): een (verlate) invoice.paid mag nooit
      // rechten herstellen op basis van de betaling alleen — de ACTUELE
      // Stripe-subscriptionstatus is de waarheid.
      if (!state) {
        return "genegeerd: subscription niet gevonden bij Stripe (invoice herstelt niets)";
      }
      const mappedNow = mapStripeSubStatus(state);
      if (mappedNow !== "active" && mappedNow !== "canceled") {
        // Actuele staat is niet betaald-actief (bv. paused/incomplete/unknown/
        // grace): verwerk de echte staat via het centrale pad, geen tierherstel.
        return await upsertFromSubscriptionState(tx, state, eventCreated, notices);
      }
      const paidStatus = mappedNow;
      await tx
        .update(billingSubscriptionsTable)
        .set({
          status: paidStatus,
          graceUntil: null, // betaling gelukt ⇒ grace-teller gewist
          currentPeriodEnd: state?.currentPeriodEnd ?? existing.currentPeriodEnd,
          lastEventCreated: eventCreated,
          updatedAt: new Date(),
        })
        .where(eq(billingSubscriptionsTable.id, existing.id));
      const tier = isPaidTier(existing.tier) ? existing.tier : null;
      if (tier) await setProfileTier(tx, existing.clerkId, tier);
      // Herstelmelding alleen wanneer dit echt een overgang is (bv. na grace
      // of paused) — een routinebetaling op active meldt niets.
      if (existing.status !== paidStatus && existing.status !== "active") {
        const n = billingTransitionNotice(paidStatus, {
          clerkId: existing.clerkId,
          subscriptionId: invoice.subscriptionId,
        });
        if (n) notices.push(n);
      }
      return `invoice ${invId} betaald → ${paidStatus}`;
    }

    case "invoice.payment_failed": {
      const invId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!invId) return "genegeerd: invoice zonder id";
      const invoice = await gateway.getInvoice(invId);
      if (!invoice?.subscriptionId) return "genegeerd: invoice zonder subscription";
      const [existing] = await tx
        .select()
        .from(billingSubscriptionsTable)
        .where(
          eq(billingSubscriptionsTable.stripeSubscriptionId, invoice.subscriptionId),
        );
      if (!existing) return "genegeerd: onbekende subscription";
      if (existing.status === "blocked") return "genegeerd: subscription is blocked";
      // Grace = Stripe-brontijd van de EERSTE mislukte poging + 7 dagen —
      // invoice.created is vast per invoice, dus herleveringen berekenen
      // exact dezelfde waarde. Monotoon: nooit later zetten dan wat er staat.
      const candidate = new Date(
        invoice.created.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000,
      );
      const graceUntil =
        existing.graceUntil && existing.graceUntil <= candidate
          ? existing.graceUntil
          : candidate;
      await tx
        .update(billingSubscriptionsTable)
        .set({
          status: "grace",
          graceUntil,
          lastEventCreated: eventCreated,
          updatedAt: new Date(),
        })
        .where(eq(billingSubscriptionsTable.id, existing.id));
      // Rechten blijven tijdens grace intact (tier blijft staan); het
      // verlopen gebeurt in de dagelijkse vervaljob, niet hier.
      if (existing.status !== "grace") {
        const n = billingTransitionNotice("grace", {
          clerkId: existing.clerkId,
          subscriptionId: invoice.subscriptionId,
          graceUntil,
        });
        if (n) notices.push(n);
      }
      return `invoice ${invId} mislukt → grace tot ${graceUntil.toISOString()}`;
    }

    case "charge.refunded": {
      const chargeId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!chargeId) return "genegeerd: charge zonder id";
      // Besluit NOOIT op het eventdelta maar op de actuele geaggregeerde staat.
      const charge = await gateway.getCharge(chargeId);
      if (!charge) return "genegeerd: charge niet gevonden bij Stripe";
      if (charge.amountRefunded < charge.amount) {
        logger.info(
          { chargeId, amount: charge.amount, refunded: charge.amountRefunded },
          "billing: gedeeltelijke refund — entitlement behouden",
        );
        return "gedeeltelijke refund → entitlement behouden";
      }
      if (!charge.customerId) return "genegeerd: charge zonder customer";
      const [existing] = await tx
        .select()
        .from(billingSubscriptionsTable)
        .where(eq(billingSubscriptionsTable.stripeCustomerId, charge.customerId));
      if (!existing) return "genegeerd: geen subscription bij deze customer";
      await tx
        .update(billingSubscriptionsTable)
        .set({ status: "blocked", lastEventCreated: eventCreated, updatedAt: new Date() })
        .where(eq(billingSubscriptionsTable.id, existing.id));
      await setProfileTier(tx, existing.clerkId, "FREE");
      logger.warn(
        { chargeId, clerkId: existing.clerkId },
        "billing: volledige (cumulatieve) refund — entitlement ingetrokken (blocked)",
      );
      if (existing.status !== "blocked") {
        const n = billingTransitionNotice("blocked", {
          clerkId: existing.clerkId,
          subscriptionId: existing.stripeSubscriptionId,
        });
        if (n) notices.push(n);
      }
      return "volledige refund → blocked";
    }

    default:
      return `genegeerd: onbehandeld eventtype ${event.type}`;
  }
}

/**
 * Idempotente verwerking van één geverifieerd Stripe-event.
 * Registratie + verwerking in één transactie; fout ⇒ volledige rollback
 * (event her-verwerkbaar, geen rechten toegekend).
 */
export async function processStripeEvent(
  event: StripeEventLike,
  rawPayload: Buffer | string,
): Promise<WebhookOutcome> {
  const digest = createHash("sha256")
    .update(typeof rawPayload === "string" ? Buffer.from(rawPayload) : rawPayload)
    .digest("hex");
  const notices: PendingBillingNotice[] = [];
  const outcome = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(stripeWebhookEventsTable)
      .values({ eventId: event.id, type: event.type, payloadDigest: digest })
      .onConflictDoNothing({ target: stripeWebhookEventsTable.eventId })
      .returning({ eventId: stripeWebhookEventsTable.eventId });
    if (inserted.length === 0) {
      return { outcome: "duplicate" } as const;
    }
    const detail = await handleEvent(tx, event, notices);
    await tx
      .update(stripeWebhookEventsTable)
      .set({ processedAt: new Date(), result: detail })
      .where(eq(stripeWebhookEventsTable.eventId, event.id));
    if (detail.startsWith("genegeerd:")) {
      return { outcome: "ignored", detail } as const;
    }
    return { outcome: "processed", detail } as const;
  });
  // Meldingen pas ná een geslaagde commit (rollback ⇒ geen melding); dedupeKey
  // maakt her-levering van hetzelfde event meldings-idempotent. Best-effort:
  // een meldingsfout maakt de webhookverwerking niet ongedaan (gelogd).
  if (outcome.outcome === "processed") {
    for (const n of notices) {
      try {
        await createNotification({
          clerkId: n.clerkId,
          type: "system",
          title: n.title,
          body: n.body,
          source: "billing",
          dedupeKey: n.dedupeKey,
        });
      } catch (err) {
        logger.error({ err, dedupeKey: n.dedupeKey }, "billing: melding aanmaken mislukt");
      }
    }
  }
  return outcome;
}
