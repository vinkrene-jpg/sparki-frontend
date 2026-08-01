// ── Profielprivacy: per-categorie zichtbaarheid ──────────────────────────────
// Eén centrale rechtenlaag voor het bekijken van andermans profiel.
// 17 gegevenscategorieën × 6 publieksniveaus. Server-side afgedwongen;
// de UI is nooit de waarheid. Fail-closed: onbekende categorie of onbekend
// niveau ⇒ alleen_ik.

import { and, eq, or, isNull } from "drizzle-orm";
import {
  db,
  friendLinksTable,
  followLinksTable,
  profilePrivacyTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  worldBlocksTable,
} from "@workspace/db";

// Publieksniveaus, van meest open naar meest gesloten.
export const PRIVACY_AUDIENCES = [
  "iedereen",
  "sparki",
  "volgers",
  "vrienden",
  "begeleiders",
  "alleen_ik",
] as const;
export type PrivacyAudience = (typeof PRIVACY_AUDIENCES)[number];

// Relatie van de kijker t.o.v. de eigenaar.
export type ViewerRelation =
  | "self"
  | "begeleider"
  | "vriend"
  | "volger"
  | "sparki";

// De 17 gegevenscategorieën (key → Nederlands label + default-publiek).
export const PRIVACY_CATEGORIES: ReadonlyArray<{
  key: string;
  label: string;
  uitleg: string;
  standaard: PrivacyAudience;
}> = [
  { key: "profiel", label: "Profiel zichtbaar", uitleg: "Of anderen je profielpagina überhaupt kunnen openen.", standaard: "sparki" },
  { key: "profielfoto", label: "Profielfoto", uitleg: "Je foto of avatar.", standaard: "sparki" },
  { key: "naam", label: "Naam", uitleg: "Je volledige weergavenaam.", standaard: "sparki" },
  { key: "clubTeam", label: "Club en team", uitleg: "Je club-, ploeg- en categoriegegevens.", standaard: "sparki" },
  { key: "sportProfiel", label: "Sportprofiel", uitleg: "Je sport en discipline.", standaard: "sparki" },
  { key: "trainingen", label: "Trainingen", uitleg: "Je afgeronde trainingen en activiteitsoverzicht.", standaard: "vrienden" },
  { key: "wedstrijden", label: "Wedstrijden", uitleg: "Je geplande en gereden wedstrijden.", standaard: "vrienden" },
  { key: "routes", label: "Routes", uitleg: "Je gedeelde routes (altijd met veilige locatieweergave).", standaard: "vrienden" },
  { key: "prestaties", label: "Prestaties en records", uitleg: "Persoonlijke records en hoogtepunten.", standaard: "vrienden" },
  { key: "doelen", label: "Doelen", uitleg: "Je trainings- en seizoensdoelen.", standaard: "vrienden" },
  { key: "journey", label: "Journey en mijlpalen", uitleg: "Je tijdlijn met mijlpalen en terugblikken.", standaard: "vrienden" },
  { key: "materiaal", label: "Materiaal", uitleg: "Je fietsen en materiaalkeuzes.", standaard: "vrienden" },
  { key: "voeding", label: "Voeding", uitleg: "Voedingsplannen en registraties.", standaard: "alleen_ik" },
  { key: "gezondheid", label: "Gezondheid", uitleg: "Ziekte, blessures en gezondheidsstatus.", standaard: "alleen_ik" },
  { key: "herstelSlaap", label: "Herstel en slaap", uitleg: "Herstelstatus en slaapgegevens.", standaard: "alleen_ik" },
  { key: "liveLocatie", label: "Live locatie", uitleg: "Waar je nu bent tijdens een rit.", standaard: "alleen_ik" },
  { key: "startFinishLocatie", label: "Start- en finishlocatie", uitleg: "Exacte start- en eindpunten van je ritten.", standaard: "alleen_ik" },
];

export const PRIVACY_CATEGORY_KEYS = PRIVACY_CATEGORIES.map((c) => c.key);

const DEFAULTS: Record<string, PrivacyAudience> = Object.fromEntries(
  PRIVACY_CATEGORIES.map((c) => [c.key, c.standaard]),
);

function isAudience(v: unknown): v is PrivacyAudience {
  return typeof v === "string" && (PRIVACY_AUDIENCES as readonly string[]).includes(v);
}

// Welke publieksniveaus elke relatie mag zien. Zuiver en testbaar.
const RELATION_GRANTS: Record<ViewerRelation, ReadonlySet<PrivacyAudience>> = {
  self: new Set(PRIVACY_AUDIENCES),
  begeleider: new Set(["iedereen", "sparki", "volgers", "vrienden", "begeleiders"]),
  vriend: new Set(["iedereen", "sparki", "volgers", "vrienden"]),
  volger: new Set(["iedereen", "sparki", "volgers"]),
  sparki: new Set(["iedereen", "sparki"]),
};

export function allowedFor(
  relation: ViewerRelation,
  audience: PrivacyAudience,
): boolean {
  if (relation === "self") return true;
  if (audience === "alleen_ik") return false;
  return RELATION_GRANTS[relation].has(audience);
}

// Effectieve instellingen: opgeslagen keuzes over de defaults heen,
// onbekende waarden vallen fail-closed terug op de default.
export function effectiveCategories(
  stored: Record<string, string> | null | undefined,
): Record<string, PrivacyAudience> {
  const out: Record<string, PrivacyAudience> = { ...DEFAULTS };
  if (stored) {
    for (const key of PRIVACY_CATEGORY_KEYS) {
      const v = stored[key];
      if (isAudience(v)) out[key] = v;
    }
  }
  return out;
}

export async function loadPrivacyFor(
  ownerClerkId: string,
): Promise<Record<string, PrivacyAudience>> {
  const [row] = await db
    .select({ categories: profilePrivacyTable.categories })
    .from(profilePrivacyTable)
    .where(eq(profilePrivacyTable.clerkId, ownerClerkId));
  return effectiveCategories(row?.categories);
}

// Blokkade in één van beide richtingen?
export async function isBlockedBetween(
  a: string,
  b: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: worldBlocksTable.id })
    .from(worldBlocksTable)
    .where(
      or(
        and(
          eq(worldBlocksTable.blockerClerkId, a),
          eq(worldBlocksTable.blockedClerkId, b),
        ),
        and(
          eq(worldBlocksTable.blockerClerkId, b),
          eq(worldBlocksTable.blockedClerkId, a),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// Relatie van kijker t.o.v. eigenaar. Blokkade wordt hier NIET meegenomen —
// die check gebeurt apart en fail-closed vóór alles.
export async function getViewerRelation(
  viewer: string,
  owner: string,
): Promise<ViewerRelation> {
  if (viewer === owner) return "self";

  const [coach, parent, friend, follow] = await Promise.all([
    db
      .select({ status: coachAthleteLinksTable.status })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, viewer),
          eq(coachAthleteLinksTable.athleteClerkId, owner),
          eq(coachAthleteLinksTable.status, "accepted"), isNull(coachAthleteLinksTable.endedAt),
        ),
      )
      .limit(1),
    db
      .select({ status: parentAthleteLinksTable.status })
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, viewer),
          eq(parentAthleteLinksTable.athleteClerkId, owner),
          eq(parentAthleteLinksTable.status, "accepted"), isNull(parentAthleteLinksTable.endedAt),
        ),
      )
      .limit(1),
    db
      .select({ id: friendLinksTable.id })
      .from(friendLinksTable)
      .where(
        and(
          eq(friendLinksTable.status, "accepted"), isNull(friendLinksTable.endedAt),
          or(
            and(
              eq(friendLinksTable.requesterClerkId, viewer),
              eq(friendLinksTable.addresseeClerkId, owner),
            ),
            and(
              eq(friendLinksTable.requesterClerkId, owner),
              eq(friendLinksTable.addresseeClerkId, viewer),
            ),
          ),
        ),
      )
      .limit(1),
    db
      .select({ id: followLinksTable.id })
      .from(followLinksTable)
      .where(
        and(
          eq(followLinksTable.followerClerkId, viewer),
          eq(followLinksTable.followeeClerkId, owner),
        ),
      )
      .limit(1),
  ]);

  if (coach.length > 0 || parent.length > 0) return "begeleider";
  if (friend.length > 0) return "vriend";
  if (follow.length > 0) return "volger";
  return "sparki";
}

// Mag `viewer` categorie `key` van `owner` zien? (zonder blokkade-check)
export function categoryVisible(
  relation: ViewerRelation,
  categories: Record<string, PrivacyAudience>,
  key: string,
): boolean {
  const audience = categories[key] ?? "alleen_ik";
  return allowedFor(relation, audience);
}
