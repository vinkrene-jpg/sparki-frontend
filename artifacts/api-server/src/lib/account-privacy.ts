// Accountbeheer-engine: volledige data-export en accountverwijdering.
//
// Export: dynamisch over ALLE tabellen met een clerk-id-kolom, zodat een nieuwe
// tabel automatisch meegaat en de export nooit stilletjes onvolledig raakt.
//
// Verwijdering: hersteltermijn van 14 dagen (delete_requested_at), daarna
// definitief: connector-toegang intrekken, Clerk-account verwijderen (inclusief
// alle sessies), daarna de user_profiles-rij (alle gekoppelde data verdwijnt
// via ON DELETE CASCADE — inclusief coach-/ouder-/vriend-links). Wat NIET
// verwijderd kan of mag worden, wordt expliciet als uitzondering geregistreerd
// in het onveranderbare auditlog.

import { sql, eq, and, lt, isNotNull } from "drizzle-orm";
import {
  db,
  privacySettingsTable,
  connectorConnectionsTable,
  userProfilesTable,
} from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { deauthorizeStrava } from "./connectors/providers/strava-oauth";
import { decryptSecret } from "./token-crypto";
import { writeAudit } from "./security/audit";
import { logger } from "./logger";

export const DELETE_RECOVERY_DAYS = 14;
export const DELETE_CONFIRM_PHRASE = "VERWIJDER MIJN ACCOUNT";

// Kolomnamen die per tabel een gebruiker aanwijzen.
const CLERK_COLUMNS = [
  "clerk_id",
  "actor_clerk_id",
  "subject_clerk_id",
  "coach_clerk_id",
  "athlete_clerk_id",
  "parent_clerk_id",
  "owner_clerk_id",
  "requester_clerk_id",
  "addressee_clerk_id",
  "inviter_clerk_id",
  "invitee_clerk_id",
  "friend_clerk_id",
  "user_clerk_id",
  "created_by_clerk_id",
  "invited_by",
];

// Kolommen met gevoelige secrets die NOOIT in een export horen.
const EXPORT_EXCLUDED_COLUMNS = new Set(["access_token", "refresh_token"]);

// Niet-persoonsgebonden tabellen die we overslaan.
const EXPORT_SKIPPED_TABLES = new Set(["legal_documents", "feature_flags"]);

async function clerkColumnsByTable(): Promise<Map<string, string[]>> {
  const result = await db.execute(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = ANY(ARRAY[${sql.join(
        CLERK_COLUMNS.map((c) => sql`${c}`),
        sql`, `,
      )}]::text[])
    ORDER BY table_name, column_name
  `);
  const byTable = new Map<string, string[]>();
  for (const r of result.rows as Array<Record<string, unknown>>) {
    const table = String(r.table_name);
    const list = byTable.get(table) ?? [];
    list.push(String(r.column_name));
    byTable.set(table, list);
  }
  return byTable;
}

export interface AccountExport {
  exportedAt: string;
  clerkId: string;
  note: string;
  tables: Record<string, unknown[]>;
}

/** Volledige data-export: alle rijen in alle tabellen die deze gebruiker aanwijzen. */
export async function exportAccountData(
  clerkId: string,
): Promise<AccountExport> {
  const byTable = await clerkColumnsByTable();
  const tables: Record<string, unknown[]> = {};
  for (const [table, columns] of byTable) {
    if (EXPORT_SKIPPED_TABLES.has(table)) continue;
    const safeTable = table.replaceAll('"', "");
    const where = columns
      .map((c) => `"${c.replaceAll('"', "")}" = '${clerkId.replaceAll("'", "''")}'`)
      .join(" OR ");
    const result = await db.execute(
      sql.raw(`SELECT * FROM "${safeTable}" WHERE ${where}`),
    );
    const rows = (result.rows as Array<Record<string, unknown>>).map((row) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        clean[k] =
          EXPORT_EXCLUDED_COLUMNS.has(k) && v != null
            ? "[versleuteld — niet geëxporteerd]"
            : v;
      }
      return clean;
    });
    if (rows.length > 0) tables[table] = rows;
  }
  return {
    exportedAt: new Date().toISOString(),
    clerkId,
    note: "Volledige export van je gegevens bij Sparki. Toegangstokens van gekoppelde diensten zijn versleuteld opgeslagen en worden om veiligheidsredenen niet meegeleverd.",
    tables,
  };
}

export interface DeletionResult {
  deleted: boolean;
  exceptions: Array<{ item: string; reason: string }>;
}

/**
 * Voer de definitieve accountverwijdering uit. Registreert uitzonderingen
 * (wat bewust of noodgedwongen achterblijft) in het auditlog. De audit is een
 * verplicht onderdeel van de flow (required: true).
 */
export async function executeAccountDeletion(
  clerkId: string,
  opts: { reason: "hersteltermijn_verstreken" | "direct_verzoek" },
): Promise<DeletionResult> {
  const exceptions: Array<{ item: string; reason: string }> = [];

  // 1. Externe toegang intrekken (best-effort, provider-kant).
  try {
    const connections = await db
      .select()
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, clerkId));
    for (const conn of connections) {
      if (conn.provider === "strava" && conn.accessToken) {
        await deauthorizeStrava(decryptSecret(conn.accessToken)!);
      }
    }
  } catch (err) {
    exceptions.push({
      item: "externe_koppelingen",
      reason:
        "Intrekken bij de externe dienst is niet bevestigd; de lokale tokens zijn wel verwijderd.",
    });
    logger.warn({ err: String(err) }, "account delete: provider revoke failed");
  }

  // 2. Clerk-account verwijderen (beëindigt tegelijk alle sessies).
  if (clerkId.startsWith("user_")) {
    try {
      await clerkClient.users.deleteUser(clerkId);
    } catch (err) {
      exceptions.push({
        item: "inlogaccount",
        reason:
          "Het inlogaccount kon niet automatisch worden verwijderd en wordt handmatig opgeruimd.",
      });
      logger.warn({ err: String(err) }, "account delete: clerk delete failed");
    }
  } else {
    exceptions.push({
      item: "inlogaccount",
      reason: "Geen extern inlogaccount aanwezig (lokaal/testprofiel).",
    });
  }

  // 3. Uploads in objectopslag: de verwijzingen verdwijnen met de database-
  // verwijdering; losse bestanden zijn daarna onbereikbaar en worden periodiek
  // opgeschoond — eerlijk geregistreerd als uitzondering.
  exceptions.push({
    item: "geuploade_bestanden",
    reason:
      "Bestandsverwijzingen zijn verwijderd; losse bestanden in de opslag zijn zonder verwijzing onbereikbaar en worden periodiek opgeschoond.",
  });

  // 4. Auditlog blijft bewaard (verantwoordingsplicht): alleen pseudonieme
  // id's en gebeurtenissen, geen inhoudelijke persoonsgegevens.
  exceptions.push({
    item: "auditlog",
    reason:
      "Beveiligings-auditregels blijven bewaard als bewijs van o.a. dit verwijderverzoek; ze bevatten geen inhoudelijke persoonsgegevens.",
  });

  // 5. Audit VÓÓR de daadwerkelijke verwijdering — verplicht onderdeel.
  await writeAudit(
    {
      event: "delete_executed",
      subjectClerkId: clerkId,
      meta: { reason: opts.reason, exceptions },
    },
    { required: true },
  );

  // 6. Databaserij verwijderen — cascade ruimt alle gekoppelde data en
  // coach-/ouder-/vriend-links op.
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));

  return { deleted: true, exceptions };
}

/** Verwerk verzoeken waarvan de hersteltermijn is verstreken. */
export async function processDueAccountDeletions(
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(
    now.getTime() - DELETE_RECOVERY_DAYS * 24 * 60 * 60 * 1000,
  );
  const due = await db
    .select({ clerkId: privacySettingsTable.clerkId })
    .from(privacySettingsTable)
    .where(
      and(
        isNotNull(privacySettingsTable.deleteRequestedAt),
        lt(privacySettingsTable.deleteRequestedAt, cutoff),
      ),
    );
  let count = 0;
  for (const row of due) {
    try {
      await executeAccountDeletion(row.clerkId, {
        reason: "hersteltermijn_verstreken",
      });
      count += 1;
    } catch (err) {
      logger.error(
        { err, clerkId: row.clerkId },
        "scheduled account deletion failed",
      );
    }
  }
  return count;
}
