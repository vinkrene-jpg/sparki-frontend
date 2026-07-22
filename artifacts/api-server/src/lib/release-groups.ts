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

export { RELEASE_GROUPS, type ReleaseGroup };
