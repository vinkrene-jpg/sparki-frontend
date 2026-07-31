// Vandaag voor rollen (WP-T2) — aparte, deterministische Vandaag-samenstelling
// per rol: zelfstandige trainer/coach, ouder/verzorger, clubbeheerder en
// hoofdtrainer. GEEN parallel dashboard: alle inhoud komt uit bestaande
// tabellen en rechtenlagen (sharing, parent-permissions, club-permissions);
// dit bepaalt alleen wát er per rol bovenaan staat.
//
// Rechten zijn server-side leidend: elke kandidaat wordt uitsluitend uit
// gegevens gebouwd waar de rol + relatie recht op geven (directe coachlink +
// deelniveau, effectiveParentAccess per categorie, actief clublidmaatschap met
// de juiste clubrol). Ontbreekt recht of data, dan blijft het slot eerlijk
// leeg (passedOver met reden) — nooit een generieke vultekst.
//
// Wisselkaarten hergebruiken dezelfde weergavehistorie (today_display_history)
// als de atleten-Vandaag; sleutels zijn rol-geprefixt zodat rollen elkaars
// rotatie nooit beïnvloeden.

import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  racesTable,
  coachAthleteLinksTable,
  coachMessagesTable,
  coachChangeProposalsTable,
  invitationsTable,
  parentAthleteLinksTable,
  clubMembersTable,
  clubTeamsTable,
  clubTrainerAssignmentsTable,
  clubTrainingsTable,
  todayDisplayHistoryTable,
} from "@workspace/db";
import {
  and,
  eq,
  gte,
  lte,
  lt,
  ne,
  asc,
  desc,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import {
  amsterdamToday,
  daySeed,
  type TodayItem,
  type TodayResult,
} from "./orchestrate";
import { clubAssignedAthleteIds, coachSharingLevel } from "../../lib/sharing";
import { effectiveParentAccess } from "../../lib/parent-permissions";
import { activeAssignmentWindow } from "../../lib/club-permissions";

// ── Rolmodel ─────────────────────────────────────────────────────────────────

export const todayRoles = [
  "atleet",
  "trainer",
  "ouder",
  "clubbeheer",
  "hoofdtrainer",
] as const;
export type TodayRole = (typeof todayRoles)[number];

export interface RoleTodayResult extends TodayResult {
  role: TodayRole;
  /** Alle rolweergaven waar dit account daadwerkelijk recht op heeft. */
  availableRoles: TodayRole[];
}

/**
 * Welke Vandaag-rolweergaven dit account écht heeft. Bron: user_profiles.roles
 * (atleet/trainer/ouder) + actieve clublidmaatschappen (beheer → clubbeheer,
 * clubrol hoofdtrainer → hoofdtrainer). Server-side afgeleid, nooit uit de
 * request te sturen.
 */
export async function availableTodayRoles(clerkId: string): Promise<TodayRole[]> {
  const [[user], memberships] = await Promise.all([
    db
      .select({ roles: userProfilesTable.roles })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId))
      .limit(1),
    db
      .select({ role: clubMembersTable.role })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt))),
  ]);
  const roles: TodayRole[] = [];
  const userRoles = user?.roles ?? [];
  if (userRoles.includes("athlete")) roles.push("atleet");
  if (userRoles.includes("coach")) roles.push("trainer");
  if (userRoles.includes("parent")) roles.push("ouder");
  if (memberships.some((m) => m.role === "owner" || m.role === "admin"))
    roles.push("clubbeheer");
  if (memberships.some((m) => m.role === "hoofdtrainer")) roles.push("hoofdtrainer");
  return roles;
}

/** Standaard-rolweergave vanuit de accountbrede actieve rol. */
export function defaultTodayRole(activeRole: string, available: TodayRole[]): TodayRole {
  if (activeRole === "coach" && available.includes("trainer")) return "trainer";
  if (activeRole === "parent" && available.includes("ouder")) return "ouder";
  // Contractgarantie: de impliciete default is ALTIJD een beschikbare rol —
  // anders zou dezelfde weergave impliciet wél en expliciet (?rol=) 403 geven.
  if (available.includes("atleet")) return "atleet";
  return available[0] ?? "atleet";
}

// ── Gedeelde rotatie-/historielaag (zelfde regels als atleten-Vandaag) ───────

async function pickRotatingAndRecord(
  clerkId: string,
  today: string,
  pool: TodayItem[],
  shownFixed: (TodayItem | null)[],
  passedOver: { key: string; reason: string }[],
): Promise<TodayItem | null> {
  const keys = pool.map((c) => c.key);
  const history = keys.length
    ? await db
        .select()
        .from(todayDisplayHistoryTable)
        .where(
          and(
            eq(todayDisplayHistoryTable.clerkId, clerkId),
            inArray(todayDisplayHistoryTable.itemKey, keys),
          ),
        )
    : [];
  const byKey = new Map(history.map((h) => [h.itemKey, h]));
  const fresh = pool.filter((c) => {
    const h = byKey.get(c.key);
    if (h && h.daysShown >= 3 && !h.clicked && !h.completed) {
      passedOver.push({ key: c.key, reason: "3 dagen getoond zonder interactie — gepauzeerd" });
      return false;
    }
    return true;
  });
  const rotating =
    fresh.length > 0 ? fresh[daySeed(clerkId, today) % fresh.length]! : null;
  if (!rotating && pool.length > 0) {
    passedOver.push({ key: "rotating:*", reason: "geen verse kandidaten — slot blijft eerlijk leeg" });
  }

  const shown = [...shownFixed, rotating].filter((i): i is TodayItem => i != null);
  if (shown.length > 0) {
    await db
      .insert(todayDisplayHistoryTable)
      .values(
        shown.map((i) => ({
          clerkId,
          itemKey: i.key,
          slot: i.slot,
          firstShownOn: today,
          lastShownOn: today,
        })),
      )
      .onConflictDoUpdate({
        target: [todayDisplayHistoryTable.clerkId, todayDisplayHistoryTable.itemKey],
        set: {
          lastShownAt: sql`now()`,
          updatedAt: sql`now()`,
          daysShown: sql`${todayDisplayHistoryTable.daysShown} + (case when ${todayDisplayHistoryTable.lastShownOn} < ${today} then 1 else 0 end)`,
          lastShownOn: today,
          slot: sql`excluded.slot`,
        },
      });
  }
  return rotating;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00Z`).getTime();
  const b = new Date(`${toYmd}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function ymdOffset(today: string, days: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function baseProfile(activeRole: string) {
  // Rol-Vandaag draait niet om het sportersprofiel van de kijker; het
  // profielblok blijft aanwezig voor contractcompatibiliteit met de client.
  return {
    variant: "recreatief" as const,
    age: null,
    minor: false,
    activeRole,
    experienceLevel: null,
    competitionLevel: null,
    developmentGoal: null,
  };
}

// ── Trainer/coach ────────────────────────────────────────────────────────────
// Prioriteiten: sporters die aandacht vragen → gemiste trainingen → voorstellen
// om te beoordelen → feedback/berichten → wedstrijden → openstaande acties.

export async function orchestrateTrainerToday(coachId: string): Promise<RoleTodayResult> {
  const today = amsterdamToday();
  const passedOver: { key: string; reason: string }[] = [];

  const [links, assigned, available] = await Promise.all([
    db
      .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, coachId),
          eq(coachAthleteLinksTable.status, "accepted"),
        ),
      ),
    clubAssignedAthleteIds(coachId),
    availableTodayRoles(coachId),
  ]);
  const directIds = links.map((l) => l.athleteClerkId);
  const allIds = [...new Set([...directIds, ...assigned])];

  // Deelniveau per DIRECTE sporter (club-toegewezen sporters: alleen roster-
  // zichtbaarheid, geen individuele data — WP-01C). Alles hierna gebruikt
  // uitsluitend sporters die daadwerkelijk delen.
  const sharingPairs = await Promise.all(
    directIds.map(async (id) => [id, await coachSharingLevel(id)] as const),
  );
  const sharedIds = sharingPairs.filter(([, s]) => s !== "none").map(([id]) => id);

  const [profiles, missed, [unread], proposals, races, invites] = await Promise.all([
    sharedIds.length
      ? db
          .select({
            clerkId: userProfilesTable.clerkId,
            displayName: userProfilesTable.displayName,
            healthStatus: athleteProfilesTable.healthStatus,
          })
          .from(userProfilesTable)
          .leftJoin(
            athleteProfilesTable,
            eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
          )
          .where(inArray(userProfilesTable.clerkId, sharedIds))
      : Promise.resolve(
          [] as { clerkId: string; displayName: string | null; healthStatus: string | null }[],
        ),
    sharedIds.length
      ? db
          .select({
            id: plannedWorkoutsTable.id,
            clerkId: plannedWorkoutsTable.clerkId,
            title: plannedWorkoutsTable.title,
            scheduledDate: plannedWorkoutsTable.scheduledDate,
          })
          .from(plannedWorkoutsTable)
          .where(
            and(
              inArray(plannedWorkoutsTable.clerkId, sharedIds),
              gte(plannedWorkoutsTable.scheduledDate, ymdOffset(today, -3)),
              lt(plannedWorkoutsTable.scheduledDate, today),
              eq(plannedWorkoutsTable.status, "planned"),
            ),
          )
          .orderBy(desc(plannedWorkoutsTable.scheduledDate))
          .limit(10)
      : Promise.resolve([]),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(coachMessagesTable)
      .where(
        and(
          eq(coachMessagesTable.coachClerkId, coachId),
          ne(coachMessagesTable.senderClerkId, coachId),
          isNull(coachMessagesTable.readAt),
        ),
      ),
    sharedIds.length
      ? db
          .select({
            id: coachChangeProposalsTable.id,
            athleteClerkId: coachChangeProposalsTable.athleteClerkId,
          })
          .from(coachChangeProposalsTable)
          .where(
            and(
              inArray(coachChangeProposalsTable.athleteClerkId, sharedIds),
              eq(coachChangeProposalsTable.status, "open"),
            ),
          )
      : Promise.resolve([]),
    sharedIds.length
      ? db
          .select({
            id: racesTable.id,
            clerkId: racesTable.clerkId,
            name: racesTable.name,
            raceDate: racesTable.raceDate,
          })
          .from(racesTable)
          .where(
            and(
              inArray(racesTable.clerkId, sharedIds),
              gte(racesTable.raceDate, today),
              lte(racesTable.raceDate, ymdOffset(today, 14)),
              ne(racesTable.status, "geannuleerd"),
            ),
          )
          .orderBy(asc(racesTable.raceDate))
          .limit(5)
      : Promise.resolve([]),
    db
      .select({ id: invitationsTable.id, expiresAt: invitationsTable.expiresAt })
      .from(invitationsTable)
      .where(
        and(
          eq(invitationsTable.inviterClerkId, coachId),
          eq(invitationsTable.status, "pending"),
          eq(invitationsTable.relationship, "coach_athlete"),
        ),
      ),
  ]);

  const nameOf = new Map(profiles.map((p) => [p.clerkId, p.displayName ?? "Sporter"]));
  const attention = profiles.filter((p) => p.healthStatus && p.healthStatus !== "ok");

  // Lead in vaste prioriteitsvolgorde.
  let lead: TodayItem | null = null;
  if (allIds.length === 0) {
    lead = {
      key: "trainer:lead:no_athletes",
      slot: "lead",
      title: "Nog geen sporters gekoppeld",
      body: "Je trainersomgeving is klaar, maar er is nog niemand gekoppeld. Nodig een sporter uit om te starten.",
      actions: [{ id: "invite", label: "Sporter uitnodigen", href: "/invitations" }],
      source: "coach_athlete_links + clubtoewijzingen",
      confidence: null,
      urgent: false,
    };
  } else if (attention.length > 0) {
    const names = attention.map((p) => p.displayName ?? "Sporter");
    lead = {
      key: `trainer:lead:attention:${attention.map((p) => p.clerkId).sort().join(",")}`,
      slot: "lead",
      title: attention.length === 1 ? `${names[0]} vraagt aandacht` : "Sporters die aandacht vragen",
      body:
        attention.length === 1
          ? `${names[0]} staat op ${attention[0]!.healthStatus === "sick" ? "ziek" : "geblesseerd"}. Kijk mee en pas het plan zo nodig aan.`
          : `${names.slice(0, 3).join(", ")}${attention.length > 3 ? ` en ${attention.length - 3} anderen` : ""} staan op ziek of geblesseerd.`,
      actions: [{ id: "roster", label: "Open je sportersoverzicht", href: "/" }],
      source: "athlete_profiles.health_status (gedeelde, direct gekoppelde sporters)",
      confidence: null,
      urgent: true,
    };
  } else if (missed.length > 0) {
    const m = missed[0]!;
    lead = {
      key: `trainer:lead:missed:${m.id}`,
      slot: "lead",
      title: missed.length === 1 ? "Eén training niet afgerond" : `${missed.length} trainingen niet afgerond`,
      body: `${nameOf.get(m.clerkId) ?? "Een sporter"} heeft “${m.title ?? "een geplande training"}” (${m.scheduledDate}) niet afgerond${missed.length > 1 ? `; er staan er nog ${missed.length - 1} open` : ""}. Bespreek wat er speelde of pas het plan aan.`,
      actions: [
        { id: "cockpit", label: "Open de cockpit", href: `/coach/athletes/${m.clerkId}/cockpit` },
      ],
      source: "planned_workouts (afgelopen 3 dagen, status planned)",
      confidence: null,
      urgent: false,
    };
  } else if (proposals.length > 0) {
    const p = proposals[0]!;
    lead = {
      key: `trainer:lead:proposals:${proposals.length}`,
      slot: "lead",
      title: proposals.length === 1 ? "Eén voorstel wacht op je beoordeling" : `${proposals.length} voorstellen wachten op je beoordeling`,
      body: `Er zijn aanpassingen voorgesteld op basis van echte feedback of signalen. Jij beslist — er verandert niets zonder jouw akkoord.`,
      actions: [
        { id: "review", label: "Beoordeel het voorstel", href: `/coach/athletes/${p.athleteClerkId}/cockpit` },
      ],
      source: "coach_change_proposals (status open)",
      confidence: null,
      urgent: false,
    };
  } else {
    lead = {
      key: "trainer:lead:all_clear",
      slot: "lead",
      title: "Geen dringende zaken",
      body: `Bij je ${sharedIds.length === 1 ? "sporter" : `${sharedIds.length} sporters`} vraagt vandaag niets direct aandacht: geen ziekmeldingen, geen gemiste trainingen, geen open voorstellen.`,
      actions: [{ id: "roster", label: "Bekijk je sporters", href: "/" }],
      source: "health_status + planned_workouts + coach_change_proposals",
      confidence: null,
      urgent: false,
    };
  }

  // Support: ongelezen berichten/feedback van sporters.
  let support: TodayItem | null = null;
  const unreadCount = unread?.n ?? 0;
  if (unreadCount > 0) {
    support = {
      key: "trainer:support:unread_messages",
      slot: "support",
      title: unreadCount === 1 ? "Eén ongelezen bericht" : `${unreadCount} ongelezen berichten`,
      body: "Sporters hebben je iets gestuurd of feedback gegeven. Reageren houdt de samenwerking eerlijk en actueel.",
      actions: [{ id: "roster", label: "Open je sportersoverzicht", href: "/" }],
      source: "coach_messages (ongelezen, afzender = sporter)",
      confidence: null,
      urgent: false,
    };
  } else {
    passedOver.push({ key: "trainer:support:unread_messages", reason: "geen ongelezen berichten — slot blijft eerlijk leeg" });
  }

  // Insight: alleen bij een echt, telbaar feit over meerdere sporters.
  let insight: TodayItem | null = null;
  if (missed.length > 1 && lead?.key.startsWith("trainer:lead:attention")) {
    insight = {
      key: `trainer:insight:missed:${missed.length}`,
      slot: "insight",
      title: "Meerdere trainingen bleven liggen",
      body: `${missed.length} geplande trainingen van de afgelopen 3 dagen zijn niet afgerond. Dat kan toeval zijn, maar ook een signaal over de weekbelasting.`,
      actions: [{ id: "roster", label: "Bekijk per sporter", href: "/" }],
      source: "planned_workouts (afgelopen 3 dagen, status planned)",
      confidence: null,
      urgent: false,
    };
  } else {
    passedOver.push({ key: "trainer:insight", reason: "geen aantoonbaar patroon over meerdere sporters — geen inzicht zonder bewijs" });
  }

  // Rotating: wedstrijden, open uitnodigingen, groepsplanning.
  const pool: TodayItem[] = [];
  const race = races[0];
  if (race) {
    const d = daysBetween(today, race.raceDate);
    pool.push({
      key: `trainer:rotating:race:${race.id}`,
      slot: "rotating",
      title: "Wedstrijd in aantocht",
      body: `${nameOf.get(race.clerkId) ?? "Een sporter"} rijdt ${race.name} ${d === 0 ? "vandaag" : `over ${d} ${d === 1 ? "dag" : "dagen"}`}. Loop de voorbereiding samen na.`,
      actions: [{ id: "cockpit", label: "Open de cockpit", href: `/coach/athletes/${race.clerkId}/cockpit` }],
      source: "races (gedeelde, direct gekoppelde sporters)",
      confidence: null,
      urgent: false,
    });
  }
  if (invites.length > 0) {
    pool.push({
      key: `trainer:rotating:invites:${invites.length}`,
      slot: "rotating",
      title: invites.length === 1 ? "Eén uitnodiging staat nog open" : `${invites.length} uitnodigingen staan nog open`,
      body: "Nog niet geaccepteerde sporteruitnodigingen verlopen vanzelf. Controleer of een herinnering nodig is.",
      actions: [{ id: "invites", label: "Uitnodigingen beheren", href: "/invitations" }],
      source: "invitations (pending, coach_athlete)",
      confidence: null,
      urgent: false,
    });
  }
  if (sharedIds.length >= 2) {
    pool.push({
      key: "trainer:rotating:bulk_plan",
      slot: "rotating",
      title: "Groepstraining inplannen",
      body: "Je kunt dezelfde training in één keer voor meerdere gekoppelde sporters inplannen.",
      actions: [{ id: "bulk", label: "Naar het sportersoverzicht", href: "/" }],
      source: "coach-omgeving (bulk-planner)",
      confidence: null,
      urgent: false,
    });
  }

  const rotating = await pickRotatingAndRecord(coachId, today, pool, [lead, support, insight], passedOver);

  return {
    date: today,
    role: "trainer",
    availableRoles: available,
    profile: baseProfile("coach"),
    lead,
    support,
    insight,
    rotating,
    passedOver,
  };
}

// ── Ouder/verzorger ──────────────────────────────────────────────────────────
// Prioriteiten: toestemmings-/herbevestigingsacties → veiligheids-/herstel-
// context (alleen binnen toegestane categorieën) → planning van het kind.
// Nooit medische details of prestatiegegevens buiten de toegestane categorieën.

export async function orchestrateOuderToday(parentId: string): Promise<RoleTodayResult> {
  const today = amsterdamToday();
  const passedOver: { key: string; reason: string }[] = [];

  const [links, available] = await Promise.all([
    db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentId),
          eq(parentAthleteLinksTable.status, "accepted"),
        ),
      ),
    availableTodayRoles(parentId),
  ]);

  const children = await Promise.all(
    links.map(async (link) => {
      const access = await effectiveParentAccess(link);
      const [[user], [profile]] = await Promise.all([
        db
          .select({ displayName: userProfilesTable.displayName })
          .from(userProfilesTable)
          .where(eq(userProfilesTable.clerkId, link.athleteClerkId))
          .limit(1),
        db
          .select({ healthStatus: athleteProfilesTable.healthStatus })
          .from(athleteProfilesTable)
          .where(eq(athleteProfilesTable.clerkId, link.athleteClerkId))
          .limit(1),
      ]);
      return {
        clerkId: link.athleteClerkId,
        name: user?.displayName ?? "Je kind",
        access,
        // Gezondheidsstatus alléén meenemen als de categorie is toegestaan.
        healthStatus: access.permissions.gezondheid ? (profile?.healthStatus ?? "ok") : null,
      };
    }),
  );

  let lead: TodayItem | null = null;
  const reconfirm = children.filter((c) => c.access.reconfirmRequired);
  const sick = children.filter((c) => c.healthStatus && c.healthStatus !== "ok");

  if (children.length === 0) {
    lead = {
      key: "ouder:lead:no_children",
      slot: "lead",
      title: "Nog geen kind gekoppeld",
      body: "Er is nog geen sporter aan jouw ouderaccount gekoppeld. Een koppeling ontstaat alleen met uitnodiging en toestemming.",
      actions: [{ id: "invite", label: "Uitnodigingen bekijken", href: "/invitations" }],
      source: "parent_athlete_links",
      confidence: null,
      urgent: false,
    };
  } else if (reconfirm.length > 0) {
    const c = reconfirm[0]!;
    lead = {
      key: `ouder:lead:reconfirm:${c.clerkId}`,
      slot: "lead",
      title: "Toestemming opnieuw bevestigen",
      body: `De leeftijdscategorie van ${c.name} is veranderd. Tot de toestemming opnieuw is bevestigd, zie je alleen het veiligheidsminimum.`,
      actions: [{ id: "consent", label: "Bekijk wat er nodig is", href: "/vandaag" }],
      source: "parent-rechtenlaag (effectiveParentAccess)",
      confidence: null,
      urgent: true,
    };
  } else if (sick.length > 0) {
    const c = sick[0]!;
    lead = {
      key: `ouder:lead:health:${c.clerkId}:${c.healthStatus}`,
      slot: "lead",
      title: `${c.name} is ${c.healthStatus === "sick" ? "ziek gemeld" : "geblesseerd gemeld"}`,
      body: `Er worden geen trainingen ingepland tot ${c.name} hersteld gemeld is. Je ziet dit omdat gezondheid tot het veiligheidsminimum hoort.`,
      actions: [{ id: "overview", label: "Bekijk de context", href: "/vandaag" }],
      source: "athlete_profiles.health_status (categorie gezondheid toegestaan)",
      confidence: null,
      urgent: true,
    };
  } else {
    // Planning van vandaag — alleen voor kinderen met de categorie planning.
    const planningIds = children
      .filter((c) => c.access.permissions.planning)
      .map((c) => c.clerkId);
    const todayWorkouts = planningIds.length
      ? await db
          .select({
            clerkId: plannedWorkoutsTable.clerkId,
            title: plannedWorkoutsTable.title,
          })
          .from(plannedWorkoutsTable)
          .where(
            and(
              inArray(plannedWorkoutsTable.clerkId, planningIds),
              eq(plannedWorkoutsTable.scheduledDate, today),
              ne(plannedWorkoutsTable.status, "cancelled"),
            ),
          )
          .orderBy(asc(plannedWorkoutsTable.id))
      : [];
    if (todayWorkouts.length > 0) {
      const nameOf = new Map(children.map((c) => [c.clerkId, c.name]));
      lead = {
        key: `ouder:lead:planning:${today}`,
        slot: "lead",
        title: "Dit staat er vandaag op",
        body: todayWorkouts
          .map((w) => `${nameOf.get(w.clerkId) ?? "Je kind"}: ${w.title ?? "training"}`)
          .join(" · "),
        actions: [{ id: "overview", label: "Bekijk de planning", href: "/vandaag" }],
        source: "planned_workouts (categorie planning toegestaan)",
        confidence: null,
        urgent: false,
      };
    } else {
      lead = {
        key: "ouder:lead:all_clear",
        slot: "lead",
        title: "Alles rustig",
        body:
          planningIds.length > 0
            ? "Geen ziekmeldingen en vandaag geen geplande training. Er is niets dat jouw aandacht vraagt."
            : "Geen ziekmeldingen. De planning is niet met jou gedeeld; je ziet het veiligheidsminimum.",
        actions: [],
        source: "health_status + planned_workouts (binnen toegestane categorieën)",
        confidence: null,
        urgent: false,
      };
      if (planningIds.length === 0 && children.length > 0) {
        passedOver.push({ key: "ouder:lead:planning", reason: "categorie planning niet toegestaan — fail-closed" });
      }
    }
  }

  // Support: herstel-context (veiligheidscategorie) — alleen als er iets echts is.
  let support: TodayItem | null = null;
  const herstelKids = children.filter((c) => c.access.permissions.herstel);
  if (herstelKids.length > 0 && sick.length === 0 && children.length > 0) {
    passedOver.push({ key: "ouder:support:herstel", reason: "geen actueel herstel-signaal — slot blijft eerlijk leeg" });
  } else if (herstelKids.length === 0 && children.length > 0) {
    passedOver.push({ key: "ouder:support:herstel", reason: "categorie herstel niet toegestaan — fail-closed" });
  }

  passedOver.push({ key: "ouder:insight", reason: "ouder-Vandaag toont geen prestatie-inzichten — bewust buiten de ouderrechten" });

  // Rotating: aankomende wedstrijd (alleen categorie wedstrijd).
  const pool: TodayItem[] = [];
  const wedstrijdIds = children
    .filter((c) => c.access.permissions.wedstrijd)
    .map((c) => c.clerkId);
  if (wedstrijdIds.length > 0) {
    const upcoming = await db
      .select({ clerkId: racesTable.clerkId, name: racesTable.name, raceDate: racesTable.raceDate })
      .from(racesTable)
      .where(
        and(
          inArray(racesTable.clerkId, wedstrijdIds),
          gte(racesTable.raceDate, today),
          lte(racesTable.raceDate, ymdOffset(today, 14)),
          ne(racesTable.status, "geannuleerd"),
        ),
      )
      .orderBy(asc(racesTable.raceDate))
      .limit(1);
    const r = upcoming[0];
    if (r) {
      const nameOf = new Map(children.map((c) => [c.clerkId, c.name]));
      const d = daysBetween(today, r.raceDate);
      pool.push({
        key: `ouder:rotating:race:${r.clerkId}:${r.raceDate}`,
        slot: "rotating",
        title: "Wedstrijd in aantocht",
        body: `${nameOf.get(r.clerkId) ?? "Je kind"} rijdt ${r.name} ${d === 0 ? "vandaag" : `over ${d} ${d === 1 ? "dag" : "dagen"}`}.`,
        actions: [{ id: "overview", label: "Bekijk de details", href: "/vandaag" }],
        source: "races (categorie wedstrijd toegestaan)",
        confidence: null,
        urgent: false,
      });
    }
  }

  const rotating = await pickRotatingAndRecord(parentId, today, pool, [lead, support, null], passedOver);

  return {
    date: today,
    role: "ouder",
    availableRoles: available,
    profile: baseProfile("parent"),
    lead,
    support,
    insight: null,
    rotating,
    passedOver,
  };
}

// ── Clubbeheerder ────────────────────────────────────────────────────────────
// Operationeel: open uitnodigingen, teams zonder trainer, ledenstand, beheer.

export async function orchestrateClubbeheerToday(clerkId: string): Promise<RoleTodayResult> {
  const today = amsterdamToday();
  const passedOver: { key: string; reason: string }[] = [];

  const [memberships, available] = await Promise.all([
    db
      .select({ clubId: clubMembersTable.clubId, role: clubMembersTable.role })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt))),
    availableTodayRoles(clerkId),
  ]);
  const managed = memberships.filter((m) => m.role === "owner" || m.role === "admin");
  if (managed.length === 0) {
    // Route hoort dit al te weigeren; dubbel slot op de engine-laag.
    throw Object.assign(new Error("Geen beheerrol in een club"), { status: 403 });
  }
  const clubIds = managed.map((m) => m.clubId);

  const [members, teams, assignments, openClubInvites, upcomingTrainings] = await Promise.all([
    db
      .select({ clubId: clubMembersTable.clubId, role: clubMembersTable.role })
      .from(clubMembersTable)
      .where(and(inArray(clubMembersTable.clubId, clubIds), isNull(clubMembersTable.endedAt))),
    db
      .select({ id: clubTeamsTable.id, clubId: clubTeamsTable.clubId, name: clubTeamsTable.name })
      .from(clubTeamsTable)
      .where(inArray(clubTeamsTable.clubId, clubIds)),
    db
      .select({ teamId: clubTrainerAssignmentsTable.teamId })
      .from(clubTrainerAssignmentsTable)
      .where(and(inArray(clubTrainerAssignmentsTable.clubId, clubIds), activeAssignmentWindow())),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(invitationsTable)
      .where(
        and(
          inArray(invitationsTable.clubId, clubIds),
          eq(invitationsTable.status, "pending"),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(clubTrainingsTable)
      .where(
        and(
          inArray(clubTrainingsTable.clubId, clubIds),
          gte(clubTrainingsTable.trainingDate, today),
          lte(clubTrainingsTable.trainingDate, ymdOffset(today, 7)),
          eq(clubTrainingsTable.status, "gepland"),
        ),
      ),
  ]);

  const coveredTeamIds = new Set(assignments.map((a) => a.teamId).filter((t) => t != null));
  const teamsWithoutTrainer = teams.filter((t) => !coveredTeamIds.has(t.id));
  const memberCount = members.length;
  const trainerCount = members.filter((m) =>
    ["trainer", "hoofdtrainer"].includes(m.role),
  ).length;
  const inviteCount = openClubInvites[0]?.n ?? 0;
  const trainingCount = upcomingTrainings[0]?.n ?? 0;

  let lead: TodayItem | null;
  if (teamsWithoutTrainer.length > 0) {
    lead = {
      key: `clubbeheer:lead:teams_without_trainer:${teamsWithoutTrainer.map((t) => t.id).sort().join(",")}`,
      slot: "lead",
      title:
        teamsWithoutTrainer.length === 1
          ? `Team “${teamsWithoutTrainer[0]!.name}” heeft geen trainer`
          : `${teamsWithoutTrainer.length} teams hebben geen trainer`,
      body: "Zonder actieve trainerstoewijzing blijft een team zonder aanspreekpunt. Wijs een trainer toe of beëindig het team bewust.",
      actions: [{ id: "beheer", label: "Naar clubbeheer", href: "/club/beheer" }],
      source: "club_teams + club_trainer_assignments (actief venster)",
      confidence: null,
      urgent: false,
    };
  } else if (inviteCount > 0) {
    lead = {
      key: `clubbeheer:lead:invites:${inviteCount}`,
      slot: "lead",
      title: inviteCount === 1 ? "Eén clubuitnodiging staat open" : `${inviteCount} clubuitnodigingen staan open`,
      body: "Open uitnodigingen verlopen vanzelf. Controleer of een herinnering of intrekking nodig is.",
      actions: [{ id: "beheer", label: "Naar clubbeheer", href: "/club/beheer" }],
      source: "invitations (pending, club)",
      confidence: null,
      urgent: false,
    };
  } else {
    lead = {
      key: "clubbeheer:lead:all_clear",
      slot: "lead",
      title: "Clubzaken op orde",
      body: `Alle teams hebben een trainer en er staan geen uitnodigingen open. ${memberCount} actieve leden, ${trainerCount} met een trainersrol.`,
      actions: [{ id: "beheer", label: "Naar clubbeheer", href: "/club/beheer" }],
      source: "club_members + club_teams + invitations",
      confidence: null,
      urgent: false,
    };
  }

  const support: TodayItem = {
    key: `clubbeheer:support:counts:${memberCount}:${trainerCount}`,
    slot: "support",
    title: "Ledenstand",
    body: `${memberCount} actieve leden, waarvan ${trainerCount} met een trainersrol${clubIds.length > 1 ? `, over ${clubIds.length} clubs` : ""}.`,
    actions: [],
    source: "club_members (actieve lidmaatschappen)",
    confidence: null,
    urgent: false,
  };

  passedOver.push({ key: "clubbeheer:insight", reason: "geen afgeleide trends op clubniveau — alleen telbare operationele feiten" });

  const pool: TodayItem[] = [];
  if (trainingCount > 0) {
    pool.push({
      key: `clubbeheer:rotating:trainings:${trainingCount}`,
      slot: "rotating",
      title: "Clubtrainingen deze week",
      body: `Er ${trainingCount === 1 ? "staat 1 clubtraining" : `staan ${trainingCount} clubtrainingen`} gepland in de komende 7 dagen.`,
      actions: [{ id: "beheer", label: "Bekijk de planning", href: "/club/beheer" }],
      source: "club_trainings (komende 7 dagen, gepland)",
      confidence: null,
      urgent: false,
    });
  }
  pool.push({
    key: "clubbeheer:rotating:rights_check",
    slot: "rotating",
    title: "Rollen en rechten nalopen",
    body: "Kloppen de clubrollen nog? Beëindigde vrijwilligers of trainers horen geen actieve rechten meer te hebben.",
    actions: [{ id: "beheer", label: "Naar ledenbeheer", href: "/club/beheer" }],
    source: "club_members (beheeractie)",
    confidence: null,
    urgent: false,
  });

  const rotating = await pickRotatingAndRecord(clerkId, today, pool, [lead, support, null], passedOver);

  return {
    date: today,
    role: "clubbeheer",
    availableRoles: available,
    profile: baseProfile("athlete"),
    lead,
    support,
    insight: null,
    rotating,
    passedOver,
  };
}

// ── Hoofdtrainer ─────────────────────────────────────────────────────────────
// Organisatorisch teamoverzicht: toewijzingen, trainersinzet, te beoordelen
// clubtrainingen. GEEN individuele sportersdata — dat vereist een directe
// coachkoppeling (memory: hoofdtrainer-rol geeft die nooit automatisch).

export async function orchestrateHoofdtrainerToday(clerkId: string): Promise<RoleTodayResult> {
  const today = amsterdamToday();
  const passedOver: { key: string; reason: string }[] = [];

  const [memberships, available] = await Promise.all([
    db
      .select({ clubId: clubMembersTable.clubId, role: clubMembersTable.role })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt))),
    availableTodayRoles(clerkId),
  ]);
  const htClubs = memberships.filter((m) => m.role === "hoofdtrainer").map((m) => m.clubId);
  if (htClubs.length === 0) {
    throw Object.assign(new Error("Geen hoofdtrainersrol in een club"), { status: 403 });
  }

  const [teams, assignments, recentTrainings, upcomingByOthers] = await Promise.all([
    db
      .select({ id: clubTeamsTable.id, name: clubTeamsTable.name })
      .from(clubTeamsTable)
      .where(inArray(clubTeamsTable.clubId, htClubs)),
    db
      .select({
        teamId: clubTrainerAssignmentsTable.teamId,
        trainerClerkId: clubTrainerAssignmentsTable.trainerClerkId,
      })
      .from(clubTrainerAssignmentsTable)
      .where(and(inArray(clubTrainerAssignmentsTable.clubId, htClubs), activeAssignmentWindow())),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(clubTrainingsTable)
      .where(
        and(
          inArray(clubTrainingsTable.clubId, htClubs),
          gte(clubTrainingsTable.trainingDate, ymdOffset(today, -30)),
          lt(clubTrainingsTable.trainingDate, today),
          ne(clubTrainingsTable.status, "geannuleerd"),
        ),
      ),
    db
      .select({
        id: clubTrainingsTable.id,
        title: clubTrainingsTable.title,
        trainingDate: clubTrainingsTable.trainingDate,
      })
      .from(clubTrainingsTable)
      .where(
        and(
          inArray(clubTrainingsTable.clubId, htClubs),
          gte(clubTrainingsTable.trainingDate, today),
          lte(clubTrainingsTable.trainingDate, ymdOffset(today, 7)),
          eq(clubTrainingsTable.status, "gepland"),
          ne(clubTrainingsTable.createdByClerkId, clerkId),
        ),
      )
      .orderBy(asc(clubTrainingsTable.trainingDate))
      .limit(5),
  ]);

  const coveredTeamIds = new Set(assignments.map((a) => a.teamId).filter((t) => t != null));
  const teamsWithoutTrainer = teams.filter((t) => !coveredTeamIds.has(t.id));
  const trainerCount = new Set(assignments.map((a) => a.trainerClerkId)).size;

  let lead: TodayItem | null;
  if (teamsWithoutTrainer.length > 0) {
    lead = {
      key: `hoofdtrainer:lead:unassigned:${teamsWithoutTrainer.map((t) => t.id).sort().join(",")}`,
      slot: "lead",
      title:
        teamsWithoutTrainer.length === 1
          ? `Team “${teamsWithoutTrainer[0]!.name}” is niet toegewezen`
          : `${teamsWithoutTrainer.length} teams zonder trainerstoewijzing`,
      body: "Als hoofdtrainer verdeel jij de teams. Zonder toewijzing ziet geen trainer deze sporters.",
      actions: [{ id: "verdeel", label: "Toewijzing regelen", href: "/club/beheer" }],
      source: "club_teams + club_trainer_assignments (actief venster)",
      confidence: null,
      urgent: false,
    };
  } else if (upcomingByOthers.length > 0) {
    const t = upcomingByOthers[0]!;
    lead = {
      key: `hoofdtrainer:lead:review:${t.id}`,
      slot: "lead",
      title: "Trainingen van je trainers deze week",
      body: `${upcomingByOthers.length === 1 ? "Eén clubtraining staat" : `${upcomingByOthers.length} clubtrainingen staan`} gepland door je trainers, te beginnen met “${t.title}” op ${t.trainingDate}. Kijk mee — wijzigingen aan andermans training worden altijd gelogd.`,
      actions: [{ id: "planning", label: "Bekijk de planning", href: "/club/beheer" }],
      source: "club_trainings (komende 7 dagen, door anderen aangemaakt)",
      confidence: null,
      urgent: false,
    };
  } else {
    lead = {
      key: "hoofdtrainer:lead:all_clear",
      slot: "lead",
      title: "Teamorganisatie op orde",
      body: `Alle ${teams.length === 1 ? "team is" : `${teams.length} teams zijn`} toegewezen aan in totaal ${trainerCount} trainer${trainerCount === 1 ? "" : "s"}. Er wacht niets op jouw beoordeling.`,
      actions: [{ id: "overview", label: "Bekijk het trainersoverzicht", href: "/club/beheer" }],
      source: "club_teams + club_trainer_assignments",
      confidence: null,
      urgent: false,
    };
  }

  const support: TodayItem = {
    key: `hoofdtrainer:support:activity:${recentTrainings[0]?.n ?? 0}`,
    slot: "support",
    title: "Trainingsactiviteit (30 dagen)",
    body: `${recentTrainings[0]?.n ?? 0} clubtrainingen in de afgelopen 30 dagen, verzorgd door ${trainerCount} actieve trainer${trainerCount === 1 ? "" : "s"}.`,
    actions: [],
    source: "club_trainings (30 dagen) + toewijzingen",
    confidence: null,
    urgent: false,
  };

  passedOver.push({
    key: "hoofdtrainer:insight",
    reason: "individuele belasting/afwijkingen vereisen een directe coachkoppeling — organisatorisch overzicht toont die bewust niet",
  });

  const pool: TodayItem[] = [
    {
      key: "hoofdtrainer:rotating:verdeling_check",
      slot: "rotating",
      title: "Klopt de teamindeling nog?",
      body: "Seizoensdoelen en groei veranderen; loop periodiek na of de team- en groepsindeling nog past.",
      actions: [{ id: "verdeel", label: "Naar de indeling", href: "/club/beheer" }],
      source: "club-organisatie (beheeractie)",
      confidence: null,
      urgent: false,
    },
  ];

  const rotating = await pickRotatingAndRecord(clerkId, today, pool, [lead, support, null], passedOver);

  return {
    date: today,
    role: "hoofdtrainer",
    availableRoles: available,
    profile: baseProfile("coach"),
    lead,
    support,
    insight: null,
    rotating,
    passedOver,
  };
}

/** Centrale dispatch: gevraagde/afgeleide rol → juiste orchestrator. */
export async function orchestrateTodayForRole(
  clerkId: string,
  role: Exclude<TodayRole, "atleet">,
): Promise<RoleTodayResult> {
  switch (role) {
    case "trainer":
      return orchestrateTrainerToday(clerkId);
    case "ouder":
      return orchestrateOuderToday(clerkId);
    case "clubbeheer":
      return orchestrateClubbeheerToday(clerkId);
    case "hoofdtrainer":
      return orchestrateHoofdtrainerToday(clerkId);
  }
}
