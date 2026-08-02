// SPARKI_BUILD_04 F1 — zelfstandige trainer: registratie zonder club,
// trainersprofiel en bedrijfsgegevens (4.1).
//
// Bindend:
// - BB-60: het trainerabonnement loopt via de BESTAANDE entitlementlaag
//   (tier TRAINER). Hier wordt géén recht toegekend — alleen de rol en het
//   profiel. Rechten blijven bij resolveEntitlements.
// - Begeleiding vereist géén bedrijfsgegevens; facturatie wél. Deze router
//   levert daarvoor `billingReady` met de ontbrekende velden, zodat de
//   factuurlaag (F5+) fail-closed kan weigeren met een eerlijke reden.
// - BB-64: de factuurreeks (prefix + startnummer) mag hier alleen worden
//   ingesteld ZOLANG er nog geen factuur is verzonden; daarna is de reeks
//   onaantastbaar (afgedwongen in F8; het slot hier is de eerste poort).

import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  trainerBusinessTable,
  trainerProfilesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { writeAudit } from "../lib/security/audit";

const router = Router();

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function strList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim());
  return out.length ? out.slice(0, 25) : null;
}

// Welke velden ontbreken er nog voordat er gefactureerd kan worden? De lijst
// is een feit, geen fiscaal advies (BB-65): Sparki toetst volledigheid.
export function missingBillingFields(b: {
  companyName: string | null;
  address: string | null;
  iban: string | null;
  kvkNumber: string | null;
  paymentTermDays: number | null;
  invoicePrefix: string | null;
  nextInvoiceNumber: number | null;
} | null): string[] {
  if (!b) return ["bedrijfsgegevens"];
  const missing: string[] = [];
  if (!b.companyName) missing.push("bedrijfsnaam");
  if (!b.address) missing.push("adres");
  if (!b.iban) missing.push("IBAN");
  if (!b.kvkNumber) missing.push("KvK-nummer");
  if (b.paymentTermDays == null) missing.push("betalingstermijn");
  if (b.nextInvoiceNumber == null) missing.push("startnummer factuurreeks");
  return missing;
}

// ── Registratie zonder club of team ─────────────────────────────────────────
// Bestaand account voegt de rol coach toe en krijgt een leeg trainersprofiel.
// Geen entitlement-schrijfacties: het abonnement loopt via de billing-laag.
router.post("/register", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    if (!profile) {
      res.status(404).json({ error: "Profiel niet gevonden." });
      return;
    }
    if (!profile.roles.includes("coach")) {
      await db
        .update(userProfilesTable)
        .set({ roles: [...profile.roles, "coach"], updatedAt: new Date() })
        .where(eq(userProfilesTable.clerkId, clerkId));
    }
    await db
      .insert(trainerProfilesTable)
      .values({ clerkId, displayName: str(req.body?.displayName) })
      .onConflictDoNothing({ target: trainerProfilesTable.clerkId });
    void writeAudit({
      event: "trainer_register",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      meta: { zonderClub: true },
      req,
    });
    res.status(201).json({ ok: true, role: "coach" });
  } catch (err) {
    req.log.error({ err }, "trainer register failed");
    res.status(500).json({ error: "Registreren als trainer is niet gelukt." });
  }
});

// ── Trainersprofiel ──────────────────────────────────────────────────────────
router.get("/profile", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const [p] = await db
    .select()
    .from(trainerProfilesTable)
    .where(eq(trainerProfilesTable.clerkId, clerkId));
  res.json(p ?? null);
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const values = {
      clerkId,
      displayName: str(req.body?.displayName),
      bio: str(req.body?.bio),
      specialisations: strList(req.body?.specialisations),
      certifications: strList(req.body?.certifications),
      availabilityNote: str(req.body?.availabilityNote),
      contactEmail: str(req.body?.contactEmail),
      contactPhone: str(req.body?.contactPhone),
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(trainerProfilesTable)
      .values(values)
      .onConflictDoUpdate({ target: trainerProfilesTable.clerkId, set: values })
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "trainer profile update failed");
    res.status(500).json({ error: "Profiel opslaan is niet gelukt." });
  }
});

// ── Bedrijfsgegevens (4.1) ───────────────────────────────────────────────────
router.get("/business", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const [b] = await db
    .select()
    .from(trainerBusinessTable)
    .where(eq(trainerBusinessTable.clerkId, clerkId));
  res.json({
    business: b ?? null,
    billingReady: missingBillingFields(b ?? null).length === 0,
    missingForBilling: missingBillingFields(b ?? null),
  });
});

router.patch("/business", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const [existing] = await db
      .select()
      .from(trainerBusinessTable)
      .where(eq(trainerBusinessTable.clerkId, clerkId));

    const termRaw = req.body?.paymentTermDays;
    const paymentTermDays =
      typeof termRaw === "number" && Number.isInteger(termRaw) && termRaw >= 0 && termRaw <= 365
        ? termRaw
        : existing?.paymentTermDays ?? null;

    // BB-64: reeksconfiguratie alleen zolang de reeks nog niet gestart is.
    // (F8 zet het definitieve slot bij de eerste verzending; hier geldt al:
    // nooit een bestaand startnummer verlagen.)
    let nextInvoiceNumber = existing?.nextInvoiceNumber ?? null;
    const nrRaw = req.body?.nextInvoiceNumber;
    if (typeof nrRaw === "number" && Number.isInteger(nrRaw) && nrRaw >= 1) {
      if (existing?.nextInvoiceNumber != null && nrRaw < existing.nextInvoiceNumber) {
        res.status(409).json({
          error: "De factuurreeks kan niet worden teruggezet (BB-64).",
        });
        return;
      }
      nextInvoiceNumber = nrRaw;
    }

    const values = {
      clerkId,
      companyName: str(req.body?.companyName) ?? existing?.companyName ?? null,
      tradeName: str(req.body?.tradeName) ?? existing?.tradeName ?? null,
      address: str(req.body?.address) ?? existing?.address ?? null,
      kvkNumber: str(req.body?.kvkNumber) ?? existing?.kvkNumber ?? null,
      vatNumber: str(req.body?.vatNumber) ?? existing?.vatNumber ?? null,
      iban: str(req.body?.iban) ?? existing?.iban ?? null,
      contactEmail: str(req.body?.contactEmail) ?? existing?.contactEmail ?? null,
      contactPhone: str(req.body?.contactPhone) ?? existing?.contactPhone ?? null,
      invoicePrefix: str(req.body?.invoicePrefix) ?? existing?.invoicePrefix ?? null,
      korActive:
        typeof req.body?.korActive === "boolean" ? req.body.korActive : existing?.korActive ?? false,
      paymentTermDays,
      nextInvoiceNumber,
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(trainerBusinessTable)
      .values(values)
      .onConflictDoUpdate({ target: trainerBusinessTable.clerkId, set: values })
      .returning();
    void writeAudit({
      event: "trainer_business_update",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      meta: { korActive: values.korActive },
      req,
    });
    res.json({
      business: row,
      billingReady: missingBillingFields(row).length === 0,
      missingForBilling: missingBillingFields(row),
    });
  } catch (err) {
    req.log.error({ err }, "trainer business update failed");
    res.status(500).json({ error: "Bedrijfsgegevens opslaan is niet gelukt." });
  }
});

export default router;
