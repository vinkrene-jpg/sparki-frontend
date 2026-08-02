// HERSTEL_EN_AANVULLING_01 F7 (HA-28…HA-30) — betaler en gebruiker afmaken.
//
// Bouwt door op het bestaande model (klant/sporter/betaler; billing.ts):
// GEEN tweede model. De vier combinaties:
//   1. sporter betaalt zichzelf     → bestaande billing_subscriptions, geen rij hier;
//   2. club betaalt voor een lid    → arrangement payer_type=club;
//   3. ouder betaalt voor jeugdlid  → arrangement payer_type=ouder;
//   4. club betaalt voor jeugdlid   → arrangement payer_type=club mét
//      verplichte oudertoestemming (fail-closed: zonder consent nooit actief).
//
// HA-30, bindend:
// • per lid kiezen — de club biedt per lid aan;
// • het lid mag weigeren en dat telt als zelf opzeggen van de dekking;
// • bij overname wordt het resterende deel van de eigen betaling terugbetaald
//   mét bericht — hier vastgelegd als open verplichting (payer_refund_
//   obligations), nooit stilzwijgend "geregeld";
// • de club ziet UITSLUITEND aantallen — nooit welke leden gebruiken of
//   weigeren;
// • maandelijkse facturatie met staffelkorting in vaste tredes
//   (CLUB_STAFFEL_TREDES, configuratie).
//
// Rechten blijven uitsluitend bij de bestaande entitlement-resolver; dit is
// administratie van wie betaalt.

import { Router } from "express";
import {
  db,
  subscriptionPayerArrangementsTable,
  payerRefundObligationsTable,
  billingSubscriptionsTable,
  parentAthleteLinksTable,
  clubMembersTable,
  CLUB_STAFFEL_TREDES,
  PAYER_TYPES,
} from "@workspace/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getClubContext, canManageClub, isMinorForClub } from "../lib/club-permissions";
import { createNotification } from "../lib/notifications";

const router = Router();

const TIERS = ["GO", "COMPLETE"] as const;

function intParam(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Staffelkorting bij n actieve leden — vaste tredes, hoogste toepasselijke.
export function staffelKortingPct(actieveLeden: number): number {
  let pct = 0;
  for (const trede of CLUB_STAFFEL_TREDES) {
    if (actieveLeden >= trede.vanafLeden) pct = trede.kortingPct;
  }
  return pct;
}

// Overname van een eigen betaald abonnement: verplichting vastleggen + bericht.
async function registreerOvername(arrangementId: number, athleteClerkId: string) {
  const [own] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(
      and(
        eq(billingSubscriptionsTable.clerkId, athleteClerkId),
        inArray(billingSubscriptionsTable.status, ["active", "grace"]),
      ),
    );
  if (!own) return;
  await db
    .insert(payerRefundObligationsTable)
    .values({
      arrangementId,
      athleteClerkId,
      stripeSubscriptionId: own.stripeSubscriptionId,
      note: "Overname door derde betaler: resterend deel eigen betaling terugbetalen (HA-30).",
    })
    .onConflictDoNothing();
  void createNotification({
    clerkId: athleteClerkId,
    type: "system",
    title: "Je abonnement wordt overgenomen",
    body: "Vanaf nu betaalt een andere partij je abonnement. Het resterende deel van je eigen betaling wordt terugbetaald; je krijgt bericht zodra dat is uitgevoerd.",
    source: "subscription-payers",
    dedupeKey: `payer-overname:${arrangementId}`,
  });
}

// ── Club: aanbieden per lid (HA-30 "per lid kiezen") ────────────────────────
router.post("/clubs/:clubId/coverage", requireAuth, async (req, res) => {
  try {
    const clubId = intParam(req.params["clubId"]);
    if (clubId == null) return void res.status(400).json({ error: "Ongeldige club." });
    const ctx = await getClubContext(clubId, getClerkUserId(req)!);
    if (!ctx || !canManageClub(ctx)) {
      return void res.status(403).json({ error: "Alleen clubbeheer beheert clubdekking." });
    }
    const athleteClerkId = typeof req.body?.clerkId === "string" ? req.body.clerkId : "";
    const tier = typeof req.body?.tier === "string" ? req.body.tier : "";
    if (!athleteClerkId || !(TIERS as readonly string[]).includes(tier)) {
      return void res.status(400).json({ error: "Lid en tier (GO of COMPLETE) zijn verplicht." });
    }
    const [lid] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, athleteClerkId)));
    if (!lid) return void res.status(400).json({ error: "Deze persoon is geen clublid." });

    // Combinatie 4: jeugdlid ⇒ oudertoestemming verplicht (fail-closed).
    const minderjarig = await isMinorForClub(athleteClerkId);

    try {
      const [row] = await db
        .insert(subscriptionPayerArrangementsTable)
        .values({
          athleteClerkId,
          payerType: "club",
          clubId,
          tier,
          status: "aangeboden",
          parentConsentRequired: minderjarig,
          offeredByClerkId: ctx.membership.clerkId,
        })
        .returning();
      void createNotification({
        clerkId: athleteClerkId,
        type: "system",
        title: "Je club biedt aan je abonnement te betalen",
        body: `Je club wil je ${tier}-abonnement betalen. Je kiest zelf: accepteren of weigeren.${minderjarig ? " Omdat je jonger dan 18 bent, is daarnaast toestemming van je ouder of verzorger nodig." : ""}`,
        source: "subscription-payers",
        dedupeKey: `payer-aanbod:${row!.id}`,
      });
      // HA-30: de club krijgt géén namen terug — alleen bevestiging.
      res.status(201).json({ ok: true });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } }).cause;
      if (cause?.code === "23505") {
        return void res
          .status(409)
          .json({ error: "Er loopt al een aanbod of actieve dekking voor dit lid." });
      }
      throw err;
    }
  } catch (err) {
    req.log.error({ err }, "clubdekking aanbieden faalde");
    res.status(500).json({ error: "Aanbieden is niet gelukt." });
  }
});

// ── Club: uitsluitend AANTALLEN + maandfactuur-voorbeeld (HA-30) ────────────
router.get("/clubs/:clubId/coverage/summary", requireAuth, async (req, res) => {
  try {
    const clubId = intParam(req.params["clubId"]);
    if (clubId == null) return void res.status(400).json({ error: "Ongeldige club." });
    const ctx = await getClubContext(clubId, getClerkUserId(req)!);
    if (!ctx || !canManageClub(ctx)) {
      return void res.status(403).json({ error: "Alleen clubbeheer ziet de clubdekking." });
    }
    const rows = await db
      .select({
        status: subscriptionPayerArrangementsTable.status,
        n: sql<number>`count(*)::int`,
      })
      .from(subscriptionPayerArrangementsTable)
      .where(
        and(
          eq(subscriptionPayerArrangementsTable.clubId, clubId),
          eq(subscriptionPayerArrangementsTable.payerType, "club"),
        ),
      )
      .groupBy(subscriptionPayerArrangementsTable.status);
    const per = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    const actief = per["actief"] ?? 0;
    res.json({
      // Bewust alléén aantallen — nooit namen (HA-30).
      aantallen: {
        aangeboden: per["aangeboden"] ?? 0,
        actief,
        geweigerd: per["geweigerd"] ?? 0,
        beeindigd: per["beeindigd"] ?? 0,
      },
      facturatie: {
        interval: "maand",
        staffelKortingPct: staffelKortingPct(actief),
        tredes: CLUB_STAFFEL_TREDES,
      },
    });
  } catch (err) {
    req.log.error({ err }, "clubdekking-samenvatting faalde");
    res.status(500).json({ error: "Samenvatting ophalen is niet gelukt." });
  }
});

// ── Ouder: betalen voor een gekoppeld jeugdlid (combinatie 3) ───────────────
router.post("/parent/coverage", requireAuth, async (req, res) => {
  try {
    const parentClerkId = getClerkUserId(req)!;
    const athleteClerkId = typeof req.body?.athleteClerkId === "string" ? req.body.athleteClerkId : "";
    const tier = typeof req.body?.tier === "string" ? req.body.tier : "";
    if (!athleteClerkId || !(TIERS as readonly string[]).includes(tier)) {
      return void res.status(400).json({ error: "Jeugdlid en tier zijn verplicht." });
    }
    const [link] = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
          eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
          eq(parentAthleteLinksTable.status, "active"),
          isNull(parentAthleteLinksTable.endedAt),
        ),
      );
    if (!link) {
      return void res.status(403).json({ error: "Je bent niet als ouder aan deze sporter gekoppeld." });
    }
    try {
      const [row] = await db
        .insert(subscriptionPayerArrangementsTable)
        .values({
          athleteClerkId,
          payerType: "ouder",
          payerClerkId: parentClerkId,
          tier,
          status: "actief", // ouder betaalt: eigen besluit van de betaler
          startedAt: new Date(),
          offeredByClerkId: parentClerkId,
          parentConsentRequired: false,
        })
        .returning();
      await registreerOvername(row!.id, athleteClerkId);
      res.status(201).json({ id: row!.id, status: row!.status });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } }).cause;
      if (cause?.code === "23505") {
        return void res
          .status(409)
          .json({ error: "Er loopt al een aanbod of actieve dekking voor deze sporter." });
      }
      throw err;
    }
  } catch (err) {
    req.log.error({ err }, "ouderdekking faalde");
    res.status(500).json({ error: "Dekking instellen is niet gelukt." });
  }
});

// ── Ouder: toestemming voor club-betaalt-jeugdlid (combinatie 4) ────────────
router.post("/parent/consent/:arrangementId", requireAuth, async (req, res) => {
  try {
    const parentClerkId = getClerkUserId(req)!;
    const arrangementId = intParam(req.params["arrangementId"]);
    const [arr] = await db
      .select()
      .from(subscriptionPayerArrangementsTable)
      .where(eq(subscriptionPayerArrangementsTable.id, arrangementId ?? -1));
    if (!arr || !arr.parentConsentRequired) {
      return void res.status(404).json({ error: "Geen toestemmingsverzoek gevonden." });
    }
    const [link] = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
          eq(parentAthleteLinksTable.athleteClerkId, arr.athleteClerkId),
          eq(parentAthleteLinksTable.status, "active"),
          isNull(parentAthleteLinksTable.endedAt),
        ),
      );
    if (!link) {
      return void res.status(403).json({ error: "Alleen een gekoppelde ouder geeft toestemming." });
    }
    await db
      .update(subscriptionPayerArrangementsTable)
      .set({
        parentConsentAt: new Date(),
        parentConsentByClerkId: parentClerkId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPayerArrangementsTable.id, arr.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "oudertoestemming faalde");
    res.status(500).json({ error: "Toestemming vastleggen is niet gelukt." });
  }
});

// ── Lid: eigen aanbod zien, accepteren of weigeren ──────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const rows = await db
      .select()
      .from(subscriptionPayerArrangementsTable)
      .where(eq(subscriptionPayerArrangementsTable.athleteClerkId, clerkId));
    res.json({ arrangements: rows });
  } catch (err) {
    req.log.error({ err }, "eigen dekking ophalen faalde");
    res.status(500).json({ error: "Ophalen is niet gelukt." });
  }
});

router.post("/me/:arrangementId/accept", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const arrangementId = intParam(req.params["arrangementId"]);
    const [arr] = await db
      .select()
      .from(subscriptionPayerArrangementsTable)
      .where(
        and(
          eq(subscriptionPayerArrangementsTable.id, arrangementId ?? -1),
          eq(subscriptionPayerArrangementsTable.athleteClerkId, clerkId),
          eq(subscriptionPayerArrangementsTable.status, "aangeboden"),
        ),
      );
    if (!arr) return void res.status(404).json({ error: "Geen openstaand aanbod gevonden." });
    // Fail-closed: jeugdlid + club betaalt ⇒ zonder oudertoestemming niet actief.
    if (arr.parentConsentRequired && arr.parentConsentAt == null) {
      return void res.status(409).json({
        error: "Toestemming van je ouder of verzorger is nog nodig voordat dit actief wordt.",
      });
    }
    const [updated] = await db
      .update(subscriptionPayerArrangementsTable)
      .set({ status: "actief", startedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionPayerArrangementsTable.id, arr.id),
          eq(subscriptionPayerArrangementsTable.status, "aangeboden"),
        ),
      )
      .returning();
    if (!updated) return void res.status(409).json({ error: "Het aanbod is inmiddels gewijzigd." });
    await registreerOvername(arr.id, clerkId);
    res.json({ ok: true, status: "actief" });
  } catch (err) {
    req.log.error({ err }, "dekking accepteren faalde");
    res.status(500).json({ error: "Accepteren is niet gelukt." });
  }
});

router.post("/me/:arrangementId/decline", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const arrangementId = intParam(req.params["arrangementId"]);
    // HA-30: weigeren telt als zelf opzeggen van de aangeboden dekking.
    const [updated] = await db
      .update(subscriptionPayerArrangementsTable)
      .set({
        status: "geweigerd",
        endedAt: new Date(),
        endedReason: "geweigerd_door_lid",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionPayerArrangementsTable.id, arrangementId ?? -1),
          eq(subscriptionPayerArrangementsTable.athleteClerkId, clerkId),
          eq(subscriptionPayerArrangementsTable.status, "aangeboden"),
        ),
      )
      .returning();
    if (!updated) return void res.status(404).json({ error: "Geen openstaand aanbod gevonden." });
    res.json({ ok: true, status: "geweigerd" });
  } catch (err) {
    req.log.error({ err }, "dekking weigeren faalde");
    res.status(500).json({ error: "Weigeren is niet gelukt." });
  }
});

export { PAYER_TYPES };
export default router;
