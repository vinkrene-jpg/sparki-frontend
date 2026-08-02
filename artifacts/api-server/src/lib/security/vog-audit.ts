// F6 — Auditlogging bij VOG.
//
// Elke wijziging aan de VOG-registratie op een clublidmaatschap levert PRECIES
// één record op in het BESTAANDE beveiligings-auditlog (security_audit_log).
// Geen nieuwe tabel, geen tweede auditsysteem, geen statusmachine, geen
// statusveld: we leggen alleen vast DÁT er een registratie is en de
// afgiftedatum (oude + nieuwe), plus een PII-arme context.
//
// Bindende regel (memory-les Sportpaspoort): waarde + gebeurtenis horen in
// DEZELFDE transactie. Deze helper schrijft dus binnen de meegegeven executor
// (`dbx`), zodat één wijziging = precies één auditrecord — nooit best-effort
// met .catch(), nooit fire-and-forget. Faalt de audit, dan faalt de wijziging.
//
// Nooit het VOG-document zelf loggen (er is er ook geen: de club vinkt aan dát
// een VOG getoond is, mét afgiftedatum).

import {
  db,
  securityAuditLogTable,
  type SecurityEventKind,
} from "@workspace/db";

// Alleen deze drie gebeurtenissen horen bij de VOG-registratie.
export type VogAuditEvent =
  | "vog_registratie_gewijzigd"
  | "vog_registratie_verwijderd"
  | "vog_registratie_gemigreerd";

// Executor: standaard de globale db, maar een transactie (tx) kan worden
// meegegeven zodat de audit in dezelfde transactie als de wijziging schrijft.
type DbExecutor = Pick<typeof db, "insert">;

export interface VogAuditInput {
  event: VogAuditEvent;
  actorClerkId: string; // wie de wijziging deed
  subjectClerkId: string; // over wie het gaat
  // PII-arme context. Alleen de rol van de actor, het clublidmaatschap + de
  // club, de oude en nieuwe afgiftedatum en een optionele toelichting. Bij een
  // gedeeltelijke wijziging alleen de gewijzigde velden meegeven.
  meta: {
    actorRol?: string | null;
    clubId: number;
    clubNaam?: string | null;
    clubMemberId: number;
    oudeAfgiftedatum?: string | null;
    nieuweAfgiftedatum?: string | null;
    toelichting?: string | null;
  } & Record<string, unknown>;
}

/**
 * Schrijf precies één VOG-auditregel. Gebruik binnen dezelfde transactie als
 * de wijziging door `dbx` op de transactie te zetten. Gooit door als de insert
 * faalt (fail-closed: geen wijziging zonder audit).
 */
export async function writeVogAudit(
  input: VogAuditInput,
  dbx: DbExecutor = db,
): Promise<void> {
  await dbx.insert(securityAuditLogTable).values({
    event: input.event as SecurityEventKind,
    actorClerkId: input.actorClerkId,
    subjectClerkId: input.subjectClerkId,
    meta: input.meta,
    ip: null,
  });
}
