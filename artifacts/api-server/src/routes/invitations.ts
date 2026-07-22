import { Router } from "express";
import { randomBytes } from "node:crypto";
import { eq, and, desc, lt, isNull } from "drizzle-orm";
import {
  db,
  invitationsTable,
  userProfilesTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  clubMembersTable,
  clubAuditLogTable,
  validRoles,
  invitationRelationships,
  type Role,
  type Invitation,
  type InvitationRelationship,
} from "@workspace/db";
import { createNotification } from "../lib/notifications";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { rateLimit } from "../lib/security/rate-limit";
import { isAdmin } from "../lib/flags";
import { assignHeadTesterNumber } from "../engines/insights";
import {
  getClubContext,
  canManageClub,
  checkCapacityForNew,
  checkCapacityByClubId,
  writeClubAudit,
} from "../lib/club-permissions";

// Abort-signaal binnen de accept-transactie: club zit vol → eerlijke 409.
class ClubCapacityError extends Error {}

const router = Router();

const DEFAULT_EXPIRY_DAYS = 14;

type CreateBody = {
  relationship?: string;
  targetRole?: string;
  email?: string | null;
  expiresInDays?: number;
  clubId?: number;
};

// Clubrelaties: welke clubrol hoort bij welke uitnodiging.
const CLUB_RELATIONSHIP_ROLES: Record<string, string> = {
  club_member: "member",
  club_trainer: "trainer",
  club_admin: "admin",
  club_teammanager: "teammanager",
  club_parent: "parent",
};

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

async function loadProfile(clerkId: string) {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  return profile ?? null;
}

// Pending invitations whose expiry has passed are lazily flipped to "expired" so
// reads and accepts never operate on a stale "pending" row.
async function expirePending(): Promise<void> {
  await db
    .update(invitationsTable)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(invitationsTable.status, "pending"),
        lt(invitationsTable.expiresAt, new Date()),
      ),
    );
}

function publicView(inv: Invitation) {
  return {
    id: inv.id,
    token: inv.token,
    inviterClerkId: inv.inviterClerkId,
    createdByRole: inv.createdByRole,
    targetRole: inv.targetRole,
    relationship: inv.relationship,
    email: inv.email,
    status: inv.status,
    acceptedByClerkId: inv.acceptedByClerkId,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

// ── POST /api/invitations ────────────────────────────────────────────────────
// Create an invitation link.
//   relationship "coach_athlete"  → creator must have the coach role
//   relationship "parent_athlete" → creator must have the parent role
//   relationship "none"           → role grant, creator must be admin
router.post("/", requireAuth, rateLimit({ scope: "invitations", max: 10, windowMs: 60 * 60_000 }), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as CreateBody;

  const relationship = (body.relationship ?? "none") as InvitationRelationship;
  if (!invitationRelationships.includes(relationship)) {
    res.status(400).json({ error: "Invalid relationship" });
    return;
  }

  try {
    const profile = await loadProfile(clerkId);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const admin = isAdmin(clerkId);
    const roles = profile.roles as Role[];

    let targetRole: Role;
    let createdByRole: string;

    if (relationship === "coach_athlete") {
      if (!roles.includes("coach")) {
        res.status(403).json({ error: "Coach role required to invite athletes" });
        return;
      }
      targetRole = "athlete";
      createdByRole = "coach";
    } else if (relationship === "head_tester") {
      // Head-tester ("Hoofdtester") invites are admin-minted only. They grant the
      // athlete role and mark the accepter as the head tester on accept.
      if (!admin) {
        res
          .status(403)
          .json({ error: "Admin access required to create head-tester invitations" });
        return;
      }
      targetRole = "athlete";
      createdByRole = "admin";
    } else if (relationship in CLUB_RELATIONSHIP_ROLES) {
      // Clubuitnodiging: alleen clubbeheer (owner/admin) van de betreffende
      // club mag deze maken, en het pakket moet ruimte hebben (eerlijke
      // blokkade zonder dataverlies).
      const clubId = typeof body.clubId === "number" ? body.clubId : NaN;
      if (!Number.isFinite(clubId)) {
        res.status(400).json({ error: "Een clubuitnodiging vereist een clubId." });
        return;
      }
      const ctx = await getClubContext(clubId, clerkId);
      if (!ctx || !canManageClub(ctx)) {
        res.status(403).json({ error: "Alleen de clubbeheerder kan clubuitnodigingen maken." });
        return;
      }
      const cap = await checkCapacityForNew(
        ctx,
        relationship === "club_trainer" ? "trainer" : "member",
      );
      if (!cap.ok) {
        res.status(409).json({ error: cap.reason });
        return;
      }
      targetRole =
        relationship === "club_trainer"
          ? "coach"
          : relationship === "club_parent"
            ? "parent"
            : "athlete";
      createdByRole = ctx.membership.role;

      const clubDays =
        typeof body.expiresInDays === "number" && body.expiresInDays > 0
          ? Math.min(body.expiresInDays, 365)
          : DEFAULT_EXPIRY_DAYS;
      const [clubInv] = await db
        .insert(invitationsTable)
        .values({
          token: newToken(),
          inviterClerkId: clerkId,
          createdByRole,
          targetRole,
          relationship,
          clubId,
          email: body.email?.trim() || null,
          status: "pending",
          expiresAt: new Date(Date.now() + clubDays * 24 * 60 * 60 * 1000),
        })
        .returning();
      await writeClubAudit({
        clubId,
        actorClerkId: clerkId,
        action: "lid_uitgenodigd",
        targetType: "member",
        detail: { relationship, email: body.email?.trim() || null },
      });
      res.status(201).json(publicView(clubInv!));
      return;
    } else if (relationship === "parent_athlete") {
      if (!roles.includes("parent")) {
        res
          .status(403)
          .json({ error: "Parent role required to link a minor athlete" });
        return;
      }
      targetRole = "athlete";
      createdByRole = "parent";
    } else {
      // role-grant invite — admin only
      if (!admin) {
        res
          .status(403)
          .json({ error: "Admin access required to create role invitations" });
        return;
      }
      const requested = body.targetRole;
      if (!requested || !validRoles.includes(requested as Role)) {
        res
          .status(400)
          .json({ error: `targetRole must be one of: ${validRoles.join(", ")}` });
        return;
      }
      targetRole = requested as Role;
      createdByRole = "admin";
    }

    const days =
      typeof body.expiresInDays === "number" && body.expiresInDays > 0
        ? Math.min(body.expiresInDays, 365)
        : DEFAULT_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const [inv] = await db
      .insert(invitationsTable)
      .values({
        token: newToken(),
        inviterClerkId: clerkId,
        createdByRole,
        targetRole,
        relationship,
        email: body.email?.trim() || null,
        status: "pending",
        expiresAt,
      })
      .returning();

    res.status(201).json(publicView(inv!));
  } catch (err) {
    req.log.error({ err }, "invitations POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/invitations ─────────────────────────────────────────────────────
// Invitations created by the current user. Admins see all.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    await expirePending();
    const rows = isAdmin(clerkId)
      ? await db
          .select()
          .from(invitationsTable)
          .orderBy(desc(invitationsTable.createdAt))
      : await db
          .select()
          .from(invitationsTable)
          .where(eq(invitationsTable.inviterClerkId, clerkId))
          .orderBy(desc(invitationsTable.createdAt));
    res.json(rows.map(publicView));
  } catch (err) {
    req.log.error({ err }, "invitations GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/invitations/:token ──────────────────────────────────────────────
// Details for the accept screen.
router.get("/:token", requireAuth, async (req, res) => {
  const token = String(req.params["token"]);
  try {
    await expirePending();
    const [inv] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.token, token));
    if (!inv) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    res.json(publicView(inv));
  } catch (err) {
    req.log.error({ err }, "invitations GET by token failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/invitations/:token/accept ──────────────────────────────────────
router.post("/:token/accept", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const token = String(req.params["token"]);

  try {
    await expirePending();
    const [inv] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.token, token));

    if (!inv) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    if (inv.status !== "pending") {
      res
        .status(409)
        .json({ error: `Invitation is ${inv.status}`, status: inv.status });
      return;
    }

    const accepter = await loadProfile(clerkId);
    if (!accepter) {
      res.status(404).json({ error: "Profile not found. Sign in first." });
      return;
    }

    const relationship = inv.relationship as InvitationRelationship;

    // Self-accept makes no sense for a relationship link (you'd link to yourself).
    // "head_tester" grants a flag (not a peer link), so self-accept is allowed.
    if (
      relationship !== "none" &&
      relationship !== "head_tester" &&
      inv.inviterClerkId === clerkId
    ) {
      res
        .status(400)
        .json({ error: "You cannot accept your own relationship invitation" });
      return;
    }

    const targetRole = inv.targetRole as Role;
    const currentRoles = accepter.roles as Role[];
    const nextRoles = currentRoles.includes(targetRole)
      ? currentRoles
      : [...currentRoles, targetRole];

    // Whole acceptance is one transaction. The conditional status flip
    // (pending → accepted) is the atomic guard: if a concurrent request already
    // accepted the invite, the UPDATE matches 0 rows and we abort with 409, so a
    // token is consumed exactly once even under concurrency.
    const result = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(invitationsTable)
        .set({
          status: "accepted",
          acceptedByClerkId: clerkId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invitationsTable.id, inv.id),
            eq(invitationsTable.status, "pending"),
          ),
        )
        .returning();

      if (!claimed) return null; // lost the race — already accepted/expired/revoked

      // 1. Grant the role.
      if (nextRoles !== currentRoles) {
        await tx
          .update(userProfilesTable)
          .set({ roles: nextRoles, updatedAt: new Date() })
          .where(eq(userProfilesTable.clerkId, clerkId));
      }

      // 2. Create the relationship link (accepter is always the athlete).
      if (relationship === "coach_athlete") {
        await tx
          .insert(coachAthleteLinksTable)
          .values({
            coachClerkId: inv.inviterClerkId,
            athleteClerkId: clerkId,
            status: "accepted",
          })
          .onConflictDoUpdate({
            target: [
              coachAthleteLinksTable.coachClerkId,
              coachAthleteLinksTable.athleteClerkId,
            ],
            set: { status: "accepted" },
          });
      } else if (relationship === "parent_athlete") {
        await tx
          .insert(parentAthleteLinksTable)
          .values({
            parentClerkId: inv.inviterClerkId,
            athleteClerkId: clerkId,
            status: "accepted",
          })
          .onConflictDoUpdate({
            target: [
              parentAthleteLinksTable.parentClerkId,
              parentAthleteLinksTable.athleteClerkId,
            ],
            set: { status: "accepted" },
          });
      } else if (relationship === "head_tester") {
        // Mark the accepter as Sparki's Hoofdtester. No peer link row.
        await tx
          .update(userProfilesTable)
          .set({ isHeadTester: true, updatedAt: new Date() })
          .where(eq(userProfilesTable.clerkId, clerkId));
      } else if (relationship in CLUB_RELATIONSHIP_ROLES && inv.clubId != null) {
        // Clubuitnodiging: maak (of heractiveer) het actieve lidmaatschap met
        // de bijbehorende clubrol. Bestaand actief lidmaatschap blijft staan
        // (partiële unique index) — dan alleen de rol bijwerken als de nieuwe
        // uitnodiging een andere rol geeft.
        const clubRole = CLUB_RELATIONSHIP_ROLES[relationship]!;
        const [existing] = await tx
          .select()
          .from(clubMembersTable)
          .where(
            and(
              eq(clubMembersTable.clubId, inv.clubId),
              eq(clubMembersTable.clerkId, clerkId),
              isNull(clubMembersTable.endedAt),
            ),
          );
        if (existing) {
          if (existing.role !== clubRole) {
            await tx
              .update(clubMembersTable)
              .set({ role: clubRole, updatedAt: new Date() })
              .where(eq(clubMembersTable.id, existing.id));
          }
        } else {
          // Pakketlimieten óók bij accepteren afdwingen: een eerder gemaakte
          // uitnodiging mag een volgeraakte club niet alsnog overschrijden.
          const cap = await checkCapacityByClubId(
            inv.clubId,
            clubRole === "trainer" ? "trainer" : "member",
          );
          if (!cap.ok) throw new ClubCapacityError(cap.reason);
          await tx.insert(clubMembersTable).values({
            clubId: inv.clubId,
            clerkId,
            role: clubRole,
          });
        }
        await tx.insert(clubAuditLogTable).values({
          clubId: inv.clubId,
          actorClerkId: clerkId,
          action: "lid_toegetreden",
          targetType: "member",
          targetId: clerkId,
          detail: { relationship },
        });
      }

      return claimed;
    });

    if (!result) {
      res
        .status(409)
        .json({ error: "Invitation is no longer pending", status: "accepted" });
      return;
    }

    // Head tester: assign the sequential "Head Tester #001" badge once, after
    // the accept committed. Idempotent + atomic. Best-effort: a number-assignment
    // hiccup must not fail an otherwise-successful accept (the flag is already
    // set, and a later /me read can backfill via re-accept is not needed).
    if (relationship === "head_tester") {
      try {
        await assignHeadTesterNumber(clerkId);
      } catch (err) {
        req.log.error({ err }, "invitations accept: head-tester number failed");
      }
    }

    // Notify the inviter that their relationship link was accepted.
    if (relationship === "coach_athlete" || relationship === "parent_athlete") {
      const role = relationship === "coach_athlete" ? "coach" : "parent";
      void createNotification({
        clerkId: inv.inviterClerkId,
        type: role === "coach" ? "coach_update" : "parent_update",
        title: "Koppeling geaccepteerd",
        body: `${accepter.displayName ?? "Een atleet"} heeft je ${
          role === "coach" ? "coach" : "ouder"
        }-uitnodiging geaccepteerd.`,
        athleteClerkId: clerkId,
        actionUrl: "/",
      });
    }

    res.json({ invitation: publicView(result), roles: nextRoles });
  } catch (err) {
    if (err instanceof ClubCapacityError) {
      res.status(409).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "invitations accept failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/invitations/:id/revoke ─────────────────────────────────────────
router.post("/:id/revoke", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid invitation id" });
    return;
  }

  try {
    // Flip any logically-expired invites first so an expired one cannot be
    // revoked as if it were still active.
    await expirePending();
    const [inv] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, id));
    if (!inv) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    if (inv.inviterClerkId !== clerkId && !isAdmin(clerkId)) {
      res.status(403).json({ error: "Not allowed to revoke this invitation" });
      return;
    }
    if (inv.status !== "pending") {
      res
        .status(409)
        .json({ error: `Cannot revoke a ${inv.status} invitation` });
      return;
    }

    const [updated] = await db
      .update(invitationsTable)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(invitationsTable.id, id))
      .returning();
    res.json(publicView(updated!));
  } catch (err) {
    req.log.error({ err }, "invitations revoke failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
