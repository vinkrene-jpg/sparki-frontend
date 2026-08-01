// SPARKI_BUILD_01 F1 — centrale leeftijds- en toestemmingsservice.
//
// Eén definitie van leeftijd/minderjarigheid (age_class uit het profiel, nooit
// uit chat of zelfverklaring) en één consent-status-enumeratie (@workspace/db
// `consentStatuses`), gedeeld door frontend en backend (BB-01).
//
// Harde regels, alle server-side (BB-02/BB-03):
// - Een minderjarige kan zichzelf NOOIT ouderlijke toestemming geven; de
//   poging wordt geweigerd én gelogd (append-only audit).
// - Intrekken werkt onmiddellijk vooruit.
// - Onbekende leeftijd = strengste regime (minderjarig behandelen).
// - Herbevestiging bij de eerstvolgende leeftijdsgrens (16/18):
//   `reconfirmation_due_at` wordt bij verlenen vastgelegd.
//
// Rollback: dit is een laag BOVENOP het bestaande model (privacy_settings +
// parent_athlete_links blijven intact en ongewijzigd). De service niet meer
// aanroepen = terugvallen op het oude model; de migratie (backfill van
// bevestigde ouder-koppelingen naar consent_grants) is omkeerbaar met
// `DELETE FROM consent_grants WHERE source = 'migratie:parent_athlete_links'`.

import { and, desc, eq } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  consentAuditLogTable,
  consentGrantsTable,
  consentGrantTypes,
  consentStatuses,
  normalizeConsentStatus,
  parentAthleteLinksTable,
  privacySettingsTable,
  type ConsentGrant,
  type ConsentGrantType,
  type ConsentStatus,
} from "@workspace/db";
import { computeAge } from "./age";

export type AgeClass = "u16" | "16_17" | "adult" | "unknown";

export class ConsentDeniedError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

/** Eén leeftijdsbepaling voor de hele consentlaag (profiel is de bron). */
export async function getAgeClass(clerkId: string): Promise<AgeClass> {
  const [a] = await db
    .select({
      birthDate: athleteProfilesTable.birthDate,
      birthYear: athleteProfilesTable.birthYear,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  const age = a ? computeAge(a.birthDate, a.birthYear) : null;
  if (age == null) return "unknown";
  if (age < 16) return "u16";
  if (age < 18) return "16_17";
  return "adult";
}

/** Onbekende leeftijd telt als minderjarig — strengste regime. */
export function isMinorClass(ageClass: AgeClass): boolean {
  return ageClass !== "adult";
}

/**
 * Eerstvolgende leeftijdsgrens (16e of 18e verjaardag) waarop herbevestiging
 * nodig is. Null wanneer volwassen of geen volledige geboortedatum bekend —
 * bij onbekende leeftijd geldt sowieso al het strengste regime.
 */
export async function reconfirmationDueAt(clerkId: string): Promise<Date | null> {
  const [a] = await db
    .select({ birthDate: athleteProfilesTable.birthDate })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  if (!a?.birthDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(a.birthDate));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const now = new Date();
  for (const boundary of [16, 18]) {
    const at = new Date(Date.UTC(y + boundary, mo - 1, d));
    if (at.getTime() > now.getTime()) return at;
  }
  return null;
}

async function isAcceptedParentOf(
  parentClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ status: parentAthleteLinksTable.status })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
        eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
      ),
    );
  return row?.status === "accepted";
}

async function audit(
  clerkId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy: string,
): Promise<void> {
  await db.insert(consentAuditLogTable).values({
    clerkId,
    field,
    oldValue,
    newValue,
    changedBy,
  });
}

function effectiveStatus(grant: ConsentGrant | undefined): ConsentStatus {
  if (!grant) return "pending";
  if (grant.revokedAt) return "revoked";
  if (grant.validUntil && grant.validUntil.getTime() < Date.now()) return "expired";
  return normalizeConsentStatus(grant.status);
}

export interface ConsentOverview {
  subjectClerkId: string;
  ageClass: AgeClass;
  minor: boolean;
  reconfirmationDueAt: string | null;
  grants: Array<{
    type: ConsentGrantType;
    status: ConsentStatus;
    grantorClerkId: string | null;
    grantedAt: string | null;
    revokedAt: string | null;
    validUntil: string | null;
    legalBasis: string | null;
    source: string | null;
  }>;
  /** Legacy-status uit privacy_settings, gemapt op de gedeelde enumeratie. */
  legacyParentConsentStatus: ConsentStatus;
}

/** Volledig consentbeeld van één gebruiker (fail-closed: geen rij = pending). */
export async function getConsentOverview(
  subjectClerkId: string,
): Promise<ConsentOverview> {
  const [ageClass, due, rows, [privacy]] = await Promise.all([
    getAgeClass(subjectClerkId),
    reconfirmationDueAt(subjectClerkId),
    db
      .select()
      .from(consentGrantsTable)
      .where(eq(consentGrantsTable.subjectClerkId, subjectClerkId))
      .orderBy(desc(consentGrantsTable.createdAt)),
    db
      .select({ parentConsentStatus: privacySettingsTable.parentConsentStatus })
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, subjectClerkId)),
  ]);

  // Nieuwste grant per type is bepalend.
  const byType = new Map<string, ConsentGrant>();
  for (const row of rows) {
    if (!byType.has(row.type)) byType.set(row.type, row);
  }
  const grants = [...byType.values()].map((g) => ({
    type: g.type as ConsentGrantType,
    status: effectiveStatus(g),
    grantorClerkId: g.grantorClerkId,
    grantedAt: g.grantedAt?.toISOString() ?? null,
    revokedAt: g.revokedAt?.toISOString() ?? null,
    validUntil: g.validUntil?.toISOString() ?? null,
    legalBasis: g.legalBasis,
    source: g.source,
  }));

  return {
    subjectClerkId,
    ageClass,
    minor: isMinorClass(ageClass),
    reconfirmationDueAt: due?.toISOString() ?? null,
    grants,
    legacyParentConsentStatus: normalizeConsentStatus(
      privacy?.parentConsentStatus,
    ),
  };
}

export interface GrantInput {
  subjectClerkId: string;
  grantorClerkId: string;
  type: ConsentGrantType;
  legalBasis?: string | null;
  source?: string;
  validUntil?: Date | null;
}

/**
 * Toestemming verlenen. Server-side bevoegdheidscontrole:
 * - `parental_consent` mag uitsluitend door een geaccepteerde ouder/verzorger
 *   van de subject — nooit door de subject zelf (BB-03; poging wordt gelogd).
 * - Overige typen: de subject zelf wanneer volwassen, anders een geaccepteerde
 *   ouder/verzorger (onbekende leeftijd = minderjarig regime).
 */
export async function grantConsent(input: GrantInput): Promise<ConsentGrant> {
  const { subjectClerkId, grantorClerkId, type } = input;
  if (!consentGrantTypes.includes(type)) {
    throw new ConsentDeniedError("Onbekend toestemmingstype", "unknown_type");
  }
  const ageClass = await getAgeClass(subjectClerkId);
  const minor = isMinorClass(ageClass);
  const self = grantorClerkId === subjectClerkId;

  if (type === "parental_consent") {
    if (self) {
      await audit(
        subjectClerkId,
        "consent_grant_geweigerd",
        null,
        "parental_consent: subject probeerde zichzelf ouderlijke toestemming te geven",
        grantorClerkId,
      );
      throw new ConsentDeniedError(
        "Een sporter kan zichzelf geen ouderlijke toestemming geven",
        "self_grant_refused",
      );
    }
    if (!(await isAcceptedParentOf(grantorClerkId, subjectClerkId))) {
      await audit(
        subjectClerkId,
        "consent_grant_geweigerd",
        null,
        `parental_consent: ${grantorClerkId} is geen geaccepteerde ouder/verzorger`,
        grantorClerkId,
      );
      throw new ConsentDeniedError(
        "Alleen een gekoppelde ouder/verzorger kan deze toestemming geven",
        "grantor_not_authorized",
      );
    }
  } else if (self) {
    if (minor) {
      await audit(
        subjectClerkId,
        "consent_grant_geweigerd",
        null,
        `${type}: minderjarige (${ageClass}) probeerde zichzelf toestemming te geven`,
        grantorClerkId,
      );
      throw new ConsentDeniedError(
        "Een minderjarige kan deze toestemming niet zelf geven; een ouder/verzorger moet dat doen",
        "minor_self_grant_refused",
      );
    }
  } else if (!(await isAcceptedParentOf(grantorClerkId, subjectClerkId))) {
    await audit(
      subjectClerkId,
      "consent_grant_geweigerd",
      null,
      `${type}: ${grantorClerkId} is geen geaccepteerde ouder/verzorger`,
      grantorClerkId,
    );
    throw new ConsentDeniedError(
      "Niet bevoegd om voor deze gebruiker toestemming te geven",
      "grantor_not_authorized",
    );
  }

  const due = await reconfirmationDueAt(subjectClerkId);
  const [row] = await db
    .insert(consentGrantsTable)
    .values({
      subjectClerkId,
      grantorClerkId,
      type,
      status: "granted",
      grantedAt: new Date(),
      validUntil: input.validUntil ?? null,
      legalBasis: input.legalBasis ?? null,
      source: input.source ?? "web",
      reconfirmationDueAt: due,
    })
    .returning();
  await audit(
    subjectClerkId,
    `consent_grant:${type}`,
    null,
    "granted",
    grantorClerkId,
  );
  return row!;
}

/**
 * Toestemming intrekken — werkt onmiddellijk vooruit. Bevoegd: de grantor, de
 * subject zelf, of een geaccepteerde ouder/verzorger van de subject.
 */
export async function revokeConsent(params: {
  grantId: number;
  actorClerkId: string;
}): Promise<ConsentGrant> {
  const [grant] = await db
    .select()
    .from(consentGrantsTable)
    .where(eq(consentGrantsTable.id, params.grantId));
  if (!grant) {
    throw new ConsentDeniedError("Toestemming niet gevonden", "not_found");
  }
  const actor = params.actorClerkId;
  const authorized =
    actor === grant.grantorClerkId ||
    actor === grant.subjectClerkId ||
    (await isAcceptedParentOf(actor, grant.subjectClerkId));
  if (!authorized) {
    throw new ConsentDeniedError(
      "Niet bevoegd om deze toestemming in te trekken",
      "revoke_not_authorized",
    );
  }
  const [row] = await db
    .update(consentGrantsTable)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(consentGrantsTable.id, params.grantId))
    .returning();
  await audit(
    grant.subjectClerkId,
    `consent_grant:${grant.type}`,
    "granted",
    "revoked",
    actor,
  );
  return row!;
}

// Her-export zodat routes en frontendcontracten één bron gebruiken.
export { consentStatuses, consentGrantTypes, normalizeConsentStatus };
