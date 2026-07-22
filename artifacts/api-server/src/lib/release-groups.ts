// Releasegroepen voor gecontroleerde uitrol.
// Effectieve groep van een gebruiker = de meest permissieve van (a) de eigen
// groep en (b) de groep van clubs waar de gebruiker actief lid van is
// (pilotclubs geven hun leden pilot-toegang zonder ieder lid apart te zetten).
// Rangorde (permissief → beperkt): intern < test < pilot < productie.

import { and, eq, isNull, inArray } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  clubsTable,
  clubMembersTable,
  RELEASE_GROUPS,
  type ReleaseGroup,
} from "@workspace/db";

const RANK: Record<ReleaseGroup, number> = {
  intern: 0,
  test: 1,
  pilot: 2,
  productie: 3,
};

export function isReleaseGroup(v: unknown): v is ReleaseGroup {
  return typeof v === "string" && (RELEASE_GROUPS as readonly string[]).includes(v);
}

function normalize(v: string | null | undefined): ReleaseGroup {
  return isReleaseGroup(v) ? v : "productie";
}

/** Meest permissieve groep uit een lijst; leeg ⇒ productie (fail-closed). */
export function mostPermissive(groups: (string | null | undefined)[]): ReleaseGroup {
  let best: ReleaseGroup = "productie";
  for (const g of groups) {
    const n = normalize(g);
    if (RANK[n] < RANK[best]) best = n;
  }
  return best;
}

/** Effectieve releasegroep: eigen groep + groepen van actieve clubs. */
export async function effectiveReleaseGroup(clerkId: string): Promise<ReleaseGroup> {
  const [profile] = await db
    .select({ releaseGroup: userProfilesTable.releaseGroup })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  const memberships = await db
    .select({ clubGroup: clubsTable.releaseGroup })
    .from(clubMembersTable)
    .innerJoin(clubsTable, eq(clubsTable.id, clubMembersTable.clubId))
    .where(
      and(eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt)),
    );
  return mostPermissive([
    profile?.releaseGroup,
    ...memberships.map((m) => m.clubGroup),
  ]);
}

// ── Distributiekanaal → releasegroep (Golf 28) ───────────────────────────────
// Mobiele builds sturen hun distributiekanaal mee (header x-sparki-kanaal,
// gevuld vanuit EXPO_PUBLIC_CHANNEL in eas.json). Het kanaal werkt als PLAFOND
// op de releasegroep: een productie-storebuild gedraagt zich als "productie",
// ook als de ingelogde gebruiker in een permissievere groep zit. Onbekende
// kanaalwaarden vallen fail-closed terug op "productie". Geen header (web,
// oudere builds) betekent: geen plafond.
const CHANNEL_GROUPS: Record<string, ReleaseGroup> = {
  ontwikkeling: "intern",
  "android-intern": "intern",
  "play-gesloten": "test",
  testflight: "test",
  pilot: "pilot",
  productie: "productie",
};

export function channelCap(header: string | undefined | null): ReleaseGroup | null {
  if (!header || !header.trim()) return null;
  return CHANNEL_GROUPS[header.trim().toLowerCase()] ?? "productie";
}

/** Minst permissieve van twee groepen (plafond toepassen). */
export function leastPermissive(a: ReleaseGroup, b: ReleaseGroup): ReleaseGroup {
  return RANK[a] > RANK[b] ? a : b;
}

/** Effectieve groep inclusief kanaalplafond uit de request-header. */
export async function effectiveReleaseGroupForRequest(
  clerkId: string,
  kanaalHeader: string | undefined | null,
): Promise<ReleaseGroup> {
  const group = await effectiveReleaseGroup(clerkId);
  const cap = channelCap(kanaalHeader);
  return cap ? leastPermissive(group, cap) : group;
}

export { RELEASE_GROUPS, type ReleaseGroup };
