import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

// Retentiecategorieën (F11 §3). Bepaalt straks de opruimtermijn; in DEEL 1 leggen
// we de categorie alleen vast (nog géén opruimjob buiten de bestaande F7-retentie).
// Bewust een kleine, betekenisvolle lijst; "algemeen" = default fallback.
// - "communicatie": bijlagen uit berichten (F7 club_message / coach_link).
// - "document":     documenten (bv. F8 clubdocumenten, trainerdocumenten).
// - "media":        beeld/afbeeldingen die bij content horen.
// - "tijdelijk":    kortstondige uploads zonder blijvende koppeling.
// De bestaande F7-waarden ("club_message", "club_document", "algemeen") blijven
// geldig zodat bestaande rijen niet breken; nieuwe bronnen kiezen bij voorkeur
// uit de generieke set hierboven.
export const fileRetentionCategories = [
  "algemeen",
  "communicatie",
  "document",
  "media",
  "tijdelijk",
  // Legacy/bronspecifiek (behouden voor bestaande rijen):
  "club_message",
  "club_document",
] as const;
export type FileRetentionCategory = (typeof fileRetentionCategories)[number];

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
    // Doorlopende versie per logische file-lijn (F11). Eerste versie = 1; een
    // "vervangen" upload verhoogt dit binnen dezelfde logicalId-keten.
    version: integer("version").notNull().default(1),
    // Logische file-id (F11 versiebeheer, generiek). Alle versies van hetzelfde
    // logische bestand delen deze waarde. Bij de eerste versie zetten we deze
    // gelijk aan de eigen id (na insert). Zo kan ELK bestand "vervangen zonder
    // historieverlies": oude versies blijven bewaard en downloadbaar voor
    // bevoegden zolang ze niet zijn ingetrokken. Onafhankelijk van F8.
    logicalId: integer("logical_id"),
    // Wijst naar de NIEUWERE file-rij die deze versie heeft vervangen (null =
    // dit is de actuele/laatste versie in de keten). Historie blijft bewaard.
    supersededById: integer("superseded_by_id"),
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
    // Snel de versiehistorie van één logisch bestand ophalen.
    index("files_logical_idx").on(t.logicalId),
    // Dedupe-zoekactie: bestaand object van DEZELFDE eigenaar op sha256+grootte.
    index("files_owner_sha_idx").on(t.ownerClerkId, t.sha256, t.sizeBytes),
  ],
);

export type FileRecord = typeof filesTable.$inferSelect;
export type InsertFileRecord = typeof filesTable.$inferInsert;
