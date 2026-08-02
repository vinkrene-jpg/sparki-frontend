// SPARKI_BUILD_04 F2 — klantbeheer van de zelfstandige trainer.
//
// BB-62: klant ≠ sporter ≠ betaler. Deze router beheert klanten,
// klant↔sporter-koppelingen en de betalende partij. Er loopt hier géén geld:
// de klant betaalt rechtstreeks aan de trainer (BB-61), Sparki administreert.
//
// Klantnummer: per trainer oplopend, toegekend in de aanmaak-transactie met
// een unieke index als racevanger — bij een botsing wordt één keer opnieuw
// geprobeerd. Nooit client-side aangeleverd.

import { Router } from "express";
import { and, eq, isNull, desc } from "drizzle-orm";
import {
  db,
  trainerClientsTable,
  clientAthleteLinksTable,
  billingPartiesTable,
  userProfilesTable,
  athleteProfilesTable,
  TRAINER_CLIENT_TYPES,
  CLIENT_ATHLETE_RELATIONS,
  TRAINER_CLIENT_STATUSES,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { computeAge } from "../lib/age";

const router = Router();

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function oneOf<T extends readonly string[]>(v: unknown, allowed: T): T[number] | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? v : null;
}

// Eigendom: elke klant-subroute laadt de klant en checkt trainerClerkId.
async function loadOwnedClient(clientId: number, trainerClerkId: string) {
  const [client] = await db
    .select()
    .from(trainerClientsTable)
    .where(and(eq(trainerClientsTable.id, clientId), eq(trainerClientsTable.trainerClerkId, trainerClerkId)));
  return client ?? null;
}

// ── Klanten ──────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const clients = await db
    .select()
    .from(trainerClientsTable)
    .where(eq(trainerClientsTable.trainerClerkId, trainerClerkId))
    .orderBy(desc(trainerClientsTable.createdAt));
  res.json(clients);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Naam van de klant is verplicht." });
      return;
    }
    const clientType = oneOf(req.body?.clientType, TRAINER_CLIENT_TYPES) ?? "particulier";

    const insertOnce = () =>
      db.transaction(async (tx) => {
        const [last] = await tx
          .select({ clientNumber: trainerClientsTable.clientNumber })
          .from(trainerClientsTable)
          .where(eq(trainerClientsTable.trainerClerkId, trainerClerkId))
          .orderBy(desc(trainerClientsTable.clientNumber))
          .limit(1)
          .for("update");
        const nextNumber = (last?.clientNumber ?? 0) + 1;
        const [row] = await tx
          .insert(trainerClientsTable)
          .values({
            trainerClerkId,
            clientNumber: nextNumber,
            name,
            clientType,
            address: str(req.body?.address),
            contactName: str(req.body?.contactName),
            email: str(req.body?.email),
            phone: str(req.body?.phone),
            companyName: str(req.body?.companyName),
            vatNumber: str(req.body?.vatNumber),
            kvkNumber: str(req.body?.kvkNumber),
            defaultServiceNote: str(req.body?.defaultServiceNote),
            note: str(req.body?.note),
          })
          .returning();
        // Standaard is de klant zelf de betalende partij; expliciet vastgelegd
        // zodat afwijken (werkgever betaalt) een bewuste wijziging is.
        await tx.insert(billingPartiesTable).values({
          clientId: row!.id,
          name,
          address: str(req.body?.address),
          email: str(req.body?.email),
          vatNumber: str(req.body?.vatNumber),
        });
        return row!;
      });

    let row;
    try {
      row = await insertOnce();
    } catch (err: any) {
      const cause = err?.cause ?? err;
      if (cause?.code === "23505") {
        row = await insertOnce(); // race op nummer: één herkansing
      } else throw err;
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "trainer client create failed");
    res.status(500).json({ error: "Klant aanmaken is niet gelukt." });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const client = await loadOwnedClient(Number(req.params.id), trainerClerkId);
    if (!client) {
      res.status(404).json({ error: "Klant niet gevonden." });
      return;
    }
    const status = oneOf(req.body?.status, TRAINER_CLIENT_STATUSES);
    const [row] = await db
      .update(trainerClientsTable)
      .set({
        name: str(req.body?.name) ?? client.name,
        clientType: oneOf(req.body?.clientType, TRAINER_CLIENT_TYPES) ?? client.clientType,
        address: str(req.body?.address) ?? client.address,
        contactName: str(req.body?.contactName) ?? client.contactName,
        email: str(req.body?.email) ?? client.email,
        phone: str(req.body?.phone) ?? client.phone,
        companyName: str(req.body?.companyName) ?? client.companyName,
        vatNumber: str(req.body?.vatNumber) ?? client.vatNumber,
        kvkNumber: str(req.body?.kvkNumber) ?? client.kvkNumber,
        defaultServiceNote: str(req.body?.defaultServiceNote) ?? client.defaultServiceNote,
        note: str(req.body?.note) ?? client.note,
        status: status ?? client.status,
        updatedAt: new Date(),
      })
      .where(eq(trainerClientsTable.id, client.id))
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "trainer client update failed");
    res.status(500).json({ error: "Klant bijwerken is niet gelukt." });
  }
});

// ── Klant ↔ sporter ─────────────────────────────────────────────────────────
router.get("/:id/athletes", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const client = await loadOwnedClient(Number(req.params.id), trainerClerkId);
  if (!client) {
    res.status(404).json({ error: "Klant niet gevonden." });
    return;
  }
  const links = await db
    .select()
    .from(clientAthleteLinksTable)
    .where(eq(clientAthleteLinksTable.clientId, client.id));
  // F12 — overgang naar meerderjarigheid: afgeleide waarheid, geen opgeslagen
  // vlag. Bij relatie "ouder" en een nu-volwassen sporter blijft de klant
  // gewoon betaler (BB-62), maar valt data-inzage terug op de consentlaag
  // van de sporter zelf (fail-closed; zie ouderomgeving). adultNow is null
  // wanneer de geboortedatum onbekend is — eerlijk onbekend, nooit gegokt.
  const out = await Promise.all(
    links.map(async (link) => {
      const [athlete] = await db
        .select({
          birthDate: athleteProfilesTable.birthDate,
          birthYear: athleteProfilesTable.birthYear,
        })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, link.athleteClerkId));
      const age = athlete ? computeAge(athlete.birthDate, athlete.birthYear) : null;
      return {
        ...link,
        athleteAdultNow: age === null ? null : age >= 18,
      };
    }),
  );
  res.json(out);
});

router.post("/:id/athletes", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const client = await loadOwnedClient(Number(req.params.id), trainerClerkId);
    if (!client) {
      res.status(404).json({ error: "Klant niet gevonden." });
      return;
    }
    const athleteClerkId = str(req.body?.athleteClerkId);
    const relationType = oneOf(req.body?.relationType, CLIENT_ATHLETE_RELATIONS);
    if (!athleteClerkId || !relationType) {
      res.status(400).json({
        error: `athleteClerkId en relationType (${CLIENT_ATHLETE_RELATIONS.join(", ")}) zijn verplicht.`,
      });
      return;
    }
    const [athlete] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, athleteClerkId));
    if (!athlete) {
      res.status(404).json({ error: "Sporter niet gevonden." });
      return;
    }
    const [existing] = await db
      .select()
      .from(clientAthleteLinksTable)
      .where(
        and(
          eq(clientAthleteLinksTable.clientId, client.id),
          eq(clientAthleteLinksTable.athleteClerkId, athleteClerkId),
          isNull(clientAthleteLinksTable.endedAt),
        ),
      );
    if (existing) {
      res.status(200).json(existing); // idempotent
      return;
    }
    const [link] = await db
      .insert(clientAthleteLinksTable)
      .values({ clientId: client.id, athleteClerkId, relationType })
      .returning();
    res.status(201).json(link);
  } catch (err) {
    req.log.error({ err }, "client athlete link failed");
    res.status(500).json({ error: "Sporter koppelen is niet gelukt." });
  }
});

router.delete("/:id/athletes/:linkId", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const client = await loadOwnedClient(Number(req.params.id), trainerClerkId);
  if (!client) {
    res.status(404).json({ error: "Klant niet gevonden." });
    return;
  }
  // Soft-end: historie blijft (facturen verwijzen naar de periode).
  const [row] = await db
    .update(clientAthleteLinksTable)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(clientAthleteLinksTable.id, Number(req.params.linkId)),
        eq(clientAthleteLinksTable.clientId, client.id),
        isNull(clientAthleteLinksTable.endedAt),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Koppeling niet gevonden of al beëindigd." });
    return;
  }
  res.json(row);
});

// ── Betalende partij ─────────────────────────────────────────────────────────
router.get("/:id/billing-party", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const client = await loadOwnedClient(Number(req.params.id), trainerClerkId);
  if (!client) {
    res.status(404).json({ error: "Klant niet gevonden." });
    return;
  }
  const [party] = await db
    .select()
    .from(billingPartiesTable)
    .where(and(eq(billingPartiesTable.clientId, client.id), isNull(billingPartiesTable.endedAt)))
    .orderBy(desc(billingPartiesTable.startedAt))
    .limit(1);
  res.json(party ?? null);
});

router.put("/:id/billing-party", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const client = await loadOwnedClient(Number(req.params.id), trainerClerkId);
    if (!client) {
      res.status(404).json({ error: "Klant niet gevonden." });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Naam van de betalende partij is verplicht." });
      return;
    }
    // Wissel in één transactie: oude partij eindigt, nieuwe start — historie
    // blijft staan (verzonden facturen verwijzen naar de partij van toen).
    const row = await db.transaction(async (tx) => {
      await tx
        .update(billingPartiesTable)
        .set({ endedAt: new Date() })
        .where(and(eq(billingPartiesTable.clientId, client.id), isNull(billingPartiesTable.endedAt)));
      const [inserted] = await tx
        .insert(billingPartiesTable)
        .values({
          clientId: client.id,
          name,
          address: str(req.body?.address),
          email: str(req.body?.email),
          vatNumber: str(req.body?.vatNumber),
        })
        .returning();
      return inserted!;
    });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "billing party update failed");
    res.status(500).json({ error: "Betalende partij wijzigen is niet gelukt." });
  }
});

export default router;
