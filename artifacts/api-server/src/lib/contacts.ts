// SPARKI_BUILD_01 F10 (PD-3) — centrale contacten- en relatielaag: helpers.
//
// Bindende regels (F10-document, incl. de drie correcties):
// - ÉÉN contactrecord per identiteit.
// - Duplicaatherkenning UITSLUITEND op AANTOONBARE identiteit:
//     * clerkId-match  ⇒ zelfde identiteit (hergebruik het contact);
//     * geverifieerd/normaliseerd e-mail exact gelijk ⇒ duidelijk duplicaat ⇒
//       een NIEUWE aanmaakpoging WEIGEREN (409) met uitleg + het bestaande
//       contact benoemd;
//     * naam alleen ⇒ NOOIT een duplicaat (twee mensen mogen dezelfde naam
//       dragen);
//     * onduidelijk (bv. zelfde naam + telefoon, ander/geen e-mail) ⇒ TOESTAAN
//       (nieuw contact) maar op de beoordelingslijst zetten.
// - NOOIT automatisch samenvoegen bij twijfel.

import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  db,
  contactsTable,
  contactRelationsTable,
  contactMergeReviewTable,
  contactKinds,
  contactRelationTypes,
  type Contact,
  type ContactRelation,
  type ContactKind,
  type ContactRelationType,
} from "@workspace/db";

// Transactietype van Drizzle: db.transaction((tx) => …). We accepteren zowel
// het db-object als een transactie-handle. Het transactietype is het eerste
// argument van de transaction-callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

/** Normaliseer een e-mailadres: getrimd en lowercase. Leeg ⇒ null. */
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function isContactKind(v: unknown): v is ContactKind {
  return typeof v === "string" && (contactKinds as readonly string[]).includes(v);
}

export function isRelationType(v: unknown): v is ContactRelationType {
  return (
    typeof v === "string" &&
    (contactRelationTypes as readonly string[]).includes(v)
  );
}

/** Voeg kindTags samen zonder duplicaten en met stabiele volgorde. */
function mergeKindTags(existing: string[], add: readonly string[]): string[] {
  const set = new Set(existing);
  for (const k of add) if (isContactKind(k)) set.add(k);
  return Array.from(set);
}

export type FindOrCreateInput = {
  clerkId?: string | null;
  email?: string | null;
  displayName: string;
  phone?: string | null;
  kindTags?: readonly ContactKind[];
  sourceNote?: string | null;
  // Bron van de aanmaak (voor de beoordelingslijst), bv. "api" of "trainer_clients".
  source?: string;
  sourceId?: string | null;
};

export type FindOrCreateResult =
  | {
      status: "found";
      contact: Contact;
      // clerkId-anker of exact e-mail: waarom dit als dezelfde identiteit geldt.
      matchedBy: "clerkId" | "email";
    }
  | { status: "created"; contact: Contact }
  | {
      // Onduidelijk: nieuw contact aangemaakt én op de beoordelingslijst gezet.
      status: "created_needs_review";
      contact: Contact;
      candidateContactIds: number[];
      reason: string;
    }
  | {
      // Duidelijk duplicaat op geverifieerd e-mail: aanmaak GEWEIGERD.
      status: "duplicate_rejected";
      existing: Contact;
      reason: string;
    };

/**
 * Vind of maak één contact per identiteit. Geeft nooit blind een tweede record
 * aan voor dezelfde aantoonbare identiteit. Zie de regels bovenaan dit bestand.
 *
 * Draai dit bij voorkeur binnen een transactie (geef `tx` mee) zodat de
 * beoordelingslijst-inschrijving in dezelfde tx valt als de aanmaak.
 */
export async function findOrCreateContact(
  input: FindOrCreateInput,
  exec: DbLike = db,
): Promise<FindOrCreateResult> {
  const clerkId = clean(input.clerkId);
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const phone = clean(input.phone);
  const wantedKinds = input.kindTags ?? [];

  // 1. clerkId-anker: zelfde identiteit ⇒ hergebruik, vul aanvullende tags/gegevens.
  if (clerkId) {
    const [existing] = await exec
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.clerkId, clerkId))
      .limit(1);
    if (existing) {
      const updated = await enrichContact(existing, {
        email,
        phone,
        kinds: wantedKinds,
      }, exec);
      return { status: "found", contact: updated, matchedBy: "clerkId" };
    }
  }

  // 2. Geverifieerd e-mail exact gelijk ⇒ duidelijk duplicaat.
  //    (Het e-mailadres op user_profiles is uniek/geverifieerd; op contacts
  //    normaliseren we naar lowercase.)
  if (email) {
    const [byEmail] = await exec
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.primaryEmail, email))
      .limit(1);
    if (byEmail) {
      // Als de aanroeper GEEN eigen clerkId meebrengt, is dit een duidelijk
      // duplicaat: weigeren met uitleg. (Bracht de aanroeper wél een clerkId
      // mee dat niet matchte, dan is stap 1 al gepasseerd zonder match — dat
      // betekent een ander account met hetzelfde e-mail: óók weigeren, want
      // e-mail is uniek per identiteit.)
      return {
        status: "duplicate_rejected",
        existing: byEmail,
        reason:
          `Er bestaat al een contact met dit e-mailadres (${email}): "${byEmail.displayName}" (contact #${byEmail.id}). ` +
          `Dit is dezelfde identiteit — er wordt geen tweede contact aangemaakt.`,
      };
    }
  }

  // 3. Aanmaken. Bepaal eerst of dit een TWIJFELgeval is (zelfde naam + zelfde
  //    telefoon, maar geen e-mailmatch). Naam alleen is nooit een duplicaat.
  let reviewCandidates: number[] = [];
  let reviewReason: string | null = null;
  if (phone) {
    const sameNamePhone = await exec
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(
        and(
          sql`lower(${contactsTable.displayName}) = ${displayName.toLowerCase()}`,
          eq(contactsTable.phone, phone),
        ),
      );
    if (sameNamePhone.length > 0) {
      reviewCandidates = sameNamePhone.map((r) => r.id);
      reviewReason =
        `Zelfde naam ("${displayName}") én telefoonnummer als ${reviewCandidates.length} bestaand(e) contact(en), ` +
        `maar zonder e-mailmatch. Mogelijk dezelfde persoon — beoordeel voordat je samenvoegt.`;
    }
  }

  let created: Contact;
  try {
    const [row] = await exec
      .insert(contactsTable)
      .values({
        clerkId: clerkId ?? null,
        primaryEmail: email,
        displayName,
        phone,
        kindTags: mergeKindTags([], wantedKinds),
        sourceNote: clean(input.sourceNote),
      })
      .returning();
    created = row!;
  } catch (err: unknown) {
    // Racebestendigheid: een gelijktijdige create met hetzelfde clerkId of
    // hetzelfde genormaliseerde e-mailadres kan de unique index raken (23505).
    // Vertaal dat naar hetzelfde nette resultaat als de vóór-checks hierboven.
    const cause = (err as { cause?: { code?: string } })?.cause ?? err;
    const code = (cause as { code?: string } | undefined)?.code;
    if (code === "23505") {
      // clerkId-race ⇒ dezelfde identiteit: her-lees en verrijk.
      if (clerkId) {
        const [existing] = await exec
          .select()
          .from(contactsTable)
          .where(eq(contactsTable.clerkId, clerkId))
          .limit(1);
        if (existing) {
          const updated = await enrichContact(
            existing,
            { email, phone, kinds: wantedKinds },
            exec,
          );
          return { status: "found", contact: updated, matchedBy: "clerkId" };
        }
      }
      // e-mail-race ⇒ duidelijk duplicaat: her-lees het bestaande contact.
      if (email) {
        const [byEmail] = await exec
          .select()
          .from(contactsTable)
          .where(eq(contactsTable.primaryEmail, email))
          .limit(1);
        if (byEmail) {
          return {
            status: "duplicate_rejected",
            existing: byEmail,
            reason:
              `Er bestaat al een contact met dit e-mailadres (${email}): "${byEmail.displayName}" (contact #${byEmail.id}). ` +
              `Dit is dezelfde identiteit — er wordt geen tweede contact aangemaakt.`,
          };
        }
      }
    }
    throw err;
  }

  if (reviewReason) {
    await exec.insert(contactMergeReviewTable).values({
      source: input.source ?? "api",
      sourceId: clean(input.sourceId),
      contactId: created.id,
      candidateContactIds: reviewCandidates,
      reason: reviewReason,
      status: "open",
    });
    return {
      status: "created_needs_review",
      contact: created,
      candidateContactIds: reviewCandidates,
      reason: reviewReason,
    };
  }

  return { status: "created", contact: created };
}

/** Vul een bestaand contact aan met ontbrekende gegevens en extra kindTags. */
async function enrichContact(
  existing: Contact,
  extra: { email: string | null; phone: string | null; kinds: readonly ContactKind[] },
  exec: DbLike,
): Promise<Contact> {
  const nextKinds = mergeKindTags(existing.kindTags, extra.kinds);
  const nextEmail = existing.primaryEmail ?? extra.email;
  const nextPhone = existing.phone ?? extra.phone;
  const kindsChanged =
    nextKinds.length !== existing.kindTags.length ||
    nextKinds.some((k, i) => k !== existing.kindTags[i]);
  if (
    !kindsChanged &&
    nextEmail === existing.primaryEmail &&
    nextPhone === existing.phone
  ) {
    return existing;
  }
  const [updated] = await exec
    .update(contactsTable)
    .set({
      kindTags: nextKinds,
      primaryEmail: nextEmail,
      phone: nextPhone,
      updatedAt: new Date(),
    })
    .where(eq(contactsTable.id, existing.id))
    .returning();
  return updated!;
}

// ── Relatiehelpers ─────────────────────────────────────────────────────────────

export type StartRelationInput = {
  fromContactId: number;
  toContactId: number;
  relationType: ContactRelationType;
  startedAt?: Date;
  sourceNote?: string | null;
};

/**
 * Start (of hervat) een relatie. Idempotent op de actieve relatie: bestaat er
 * al een ACTIEVE relatie van dit type tussen dit paar, dan wordt die
 * teruggegeven (geen dubbele rij). Historie (beëindigde relaties) blijft staan.
 */
export async function startRelation(
  input: StartRelationInput,
  exec: DbLike = db,
): Promise<ContactRelation> {
  const [active] = await exec
    .select()
    .from(contactRelationsTable)
    .where(
      and(
        eq(contactRelationsTable.fromContactId, input.fromContactId),
        eq(contactRelationsTable.toContactId, input.toContactId),
        eq(contactRelationsTable.relationType, input.relationType),
        isNull(contactRelationsTable.endedAt),
      ),
    )
    .limit(1);
  if (active) return active;

  const [row] = await exec
    .insert(contactRelationsTable)
    .values({
      fromContactId: input.fromContactId,
      toContactId: input.toContactId,
      relationType: input.relationType,
      startedAt: input.startedAt ?? new Date(),
      sourceNote: clean(input.sourceNote),
    })
    .returning();
  return row!;
}

/**
 * Beëindig een relatie: zet endedAt. De rij blijft historisch zichtbaar en het
 * contact blijft altijd bestaan. Geeft null als de relatie niet bestaat of al
 * beëindigd is.
 */
export async function endRelation(
  relationId: number,
  endedAt: Date = new Date(),
  exec: DbLike = db,
): Promise<ContactRelation | null> {
  const [row] = await exec
    .update(contactRelationsTable)
    .set({ endedAt, updatedAt: new Date() })
    .where(
      and(
        eq(contactRelationsTable.id, relationId),
        isNull(contactRelationsTable.endedAt),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Alle relaties van een contact (actief én historisch), in beide richtingen.
 * `activeOnly` filtert op endedAt IS NULL.
 */
export async function readRelations(
  contactId: number,
  opts: { activeOnly?: boolean } = {},
  exec: DbLike = db,
): Promise<ContactRelation[]> {
  const touchesContact = or(
    eq(contactRelationsTable.fromContactId, contactId),
    eq(contactRelationsTable.toContactId, contactId),
  );
  const rows = await exec
    .select()
    .from(contactRelationsTable)
    .where(
      opts.activeOnly
        ? and(touchesContact, isNull(contactRelationsTable.endedAt))
        : touchesContact,
    );
  return rows;
}
