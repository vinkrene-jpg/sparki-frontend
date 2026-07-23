// Centrale acceptatiestatus voor verplichte juridische documenten.
//
// Bron van waarheid: legal_acceptances (bewijs per gebruiker+document+versie)
// tegen de actieve versie per document uit legal_documents. Ontbrekend bewijs
// of een ingetrokken akkoord telt als NIET geaccepteerd (fail-closed). Een
// nieuwe gepubliceerde documentversie maakt eerdere akkoorden automatisch
// onvoldoende (versie-vergelijking, geen datavernietiging).

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, legalAcceptancesTable } from "@workspace/db";
import {
  REQUIRED_LEGAL_KINDS,
  type RequiredLegalKind,
  getActiveLegalDocument,
} from "./legal-texts";

export interface ConsentDocumentStatus {
  kind: RequiredLegalKind;
  title: string;
  requiredVersion: string;
  accepted: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
}

export interface ConsentStatus {
  complete: boolean;
  documents: ConsentDocumentStatus[];
}

// Korte cache op de actieve versies zodat de gate niet per request drie
// documentrijen leest. Nieuwe publicaties zijn binnen VERSION_CACHE_MS actief.
const VERSION_CACHE_MS = 30_000;
let versionCache:
  | { at: number; docs: Record<RequiredLegalKind, { version: string; title: string }> }
  | null = null;

export function invalidateConsentVersionCache(): void {
  versionCache = null;
}

async function getRequiredVersions(): Promise<
  Record<RequiredLegalKind, { version: string; title: string }>
> {
  const now = Date.now();
  if (versionCache && now - versionCache.at < VERSION_CACHE_MS) {
    return versionCache.docs;
  }
  const entries = await Promise.all(
    REQUIRED_LEGAL_KINDS.map(async (kind) => {
      const doc = await getActiveLegalDocument(kind);
      return [kind, { version: doc.version, title: doc.title }] as const;
    }),
  );
  const docs = Object.fromEntries(entries) as Record<
    RequiredLegalKind,
    { version: string; title: string }
  >;
  versionCache = { at: now, docs };
  return docs;
}

/** Acceptatiestatus per verplicht document voor één gebruiker (fail-closed). */
export async function getConsentStatus(clerkId: string): Promise<ConsentStatus> {
  const required = await getRequiredVersions();
  const rows = await db
    .select()
    .from(legalAcceptancesTable)
    .where(
      and(
        eq(legalAcceptancesTable.clerkId, clerkId),
        inArray(
          legalAcceptancesTable.kind,
          REQUIRED_LEGAL_KINDS as unknown as string[],
        ),
        isNull(legalAcceptancesTable.revokedAt),
      ),
    )
    .orderBy(desc(legalAcceptancesTable.acceptedAt));

  const documents: ConsentDocumentStatus[] = REQUIRED_LEGAL_KINDS.map((kind) => {
    const req = required[kind];
    const newest = rows.find((r) => r.kind === kind);
    const accepted = !!newest && newest.version === req.version;
    return {
      kind,
      title: req.title,
      requiredVersion: req.version,
      accepted,
      acceptedVersion: newest?.version ?? null,
      acceptedAt: newest ? newest.acceptedAt.toISOString() : null,
    };
  });

  return { complete: documents.every((d) => d.accepted), documents };
}

/** Client/bron van een akkoord uit het platform-header (nooit vertrouwd voor autorisatie). */
export function consentSourceFromRequest(platformHeader: string | undefined): string {
  const value = (platformHeader ?? "").toLowerCase().trim();
  if (value === "mobiel" || value === "mobile") return "mobiel";
  if (value === "pwa") return "pwa";
  if (value === "web") return "web";
  return value.length > 0 ? "onbekend" : "web";
}
