import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

// ── Generiek bestandsmodel (F7-voorschot op F11) ─────────────────────────────
// Eén centraal `files`-record per geüpload bestand. F7 (clubcommunicatie met
// bijlagen) gebruikt dit model direct, zodat F11 later niet hoeft te migreren:
// er is één plek waar eigenaar, type, grootte, versie, ingetrokken-status en
// retentiecategorie leven. De bytes zelf staan NOOIT in de database — alleen in
// object storage (objectPath). De database bewaart uitsluitend metadata.
//
// VEILIGHEID (bindend, F7 §3):
// - contentType is het GESNIFTE type (magic bytes), niet het door de client
//   geclaimde type. Verkleed bestand ⇒ geweigerd op inhoud, komt nooit hier.
// - Afbeeldingen zijn her-encodeerd met sharp: meegesmokkelde inhoud is weg.
// - revokedAt gezet ⇒ het bestand is ingetrokken en nergens meer downloadbaar,
//   ook niet via een oudere link (serveFile controleert dit fail-closed).
export const filesTable = pgTable(
  "files",
  {
    id: serial("id").primaryKey(),
    ownerClerkId: text("owner_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Canoniek object-storage-pad ("/objects/…"). De enige verwijzing naar de
    // bytes; het serve-pad controleert eerst de rechten en streamt daarna.
    objectPath: text("object_path").notNull(),
    // Oorspronkelijke bestandsnaam (weergave). NOOIT in een pushmelding.
    originalName: text("original_name").notNull(),
    // GESNIFT content-type op de echte inhoud (magic bytes), niet geclaimd.
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    // SHA-256 van de OPGESLAGEN (eventueel her-encodeerde) bytes.
    sha256: text("sha256"),
    // Doorlopende versie per eigenaar+objectPad-lijn (F11-voorschot). F7 zet 1.
    version: integer("version").notNull().default(1),
    // Ingetrokken: gezet ⇒ 410/404 op elk serve-pad, ook met oude link.
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByClerkId: text("revoked_by_clerk_id"),
    // Retentiecategorie: stuurt de opruimtermijn. F7-bijlagen: "club_message".
    retentionCategory: text("retention_category").notNull().default("algemeen"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("files_owner_idx").on(t.ownerClerkId),
    index("files_object_path_idx").on(t.objectPath),
  ],
);

export type FileRecord = typeof filesTable.$inferSelect;
export type InsertFileRecord = typeof filesTable.$inferInsert;
