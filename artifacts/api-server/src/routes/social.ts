import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  searchAthletes,
  sendFriendRequest,
  respondFriendRequest,
  listFriends,
  listFriendRequests,
  setTrainingBuddy,
  removeFriend,
  getFriendFeed,
  suggestJointTraining,
  createProposal,
  respondToProposal,
  listSentProposals,
  listReceivedProposals,
  getTeamIdentity,
  setTeamIdentity,
} from "../engines/social";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ── Friends / Circle ─────────────────────────────────────────────────────────

router.get("/friends", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json({ friends: await listFriends(clerkId) });
  } catch (err) {
    req.log.error({ err }, "social.friends.list failed");
    res.status(500).json({ error: "Kon je Circle niet laden." });
  }
});

router.get("/requests", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json({ requests: await listFriendRequests(clerkId) });
  } catch (err) {
    req.log.error({ err }, "social.requests.list failed");
    res.status(500).json({ error: "Kon verzoeken niet laden." });
  }
});

router.get("/search", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const q = String(req.query.q ?? "");
  try {
    res.json({ results: await searchAthletes(clerkId, q) });
  } catch (err) {
    req.log.error({ err }, "social.search failed");
    res.status(500).json({ error: "Zoeken mislukt." });
  }
});

router.post("/requests", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const addressee = String((req.body ?? {}).addresseeClerkId ?? "");
  if (!addressee) {
    res.status(400).json({ error: "addresseeClerkId is verplicht." });
    return;
  }
  try {
    const result = await sendFriendRequest(clerkId, addressee);
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.requests.create failed");
    res.status(500).json({ error: "Verzoek versturen mislukt." });
  }
});

router.post("/requests/:id/respond", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Ongeldig verzoek-id." });
    return;
  }
  const accept = Boolean((req.body ?? {}).accept);
  try {
    const result = await respondFriendRequest(clerkId, id, accept);
    if (!result.ok) {
      res.status(404).json({ error: result.reason });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.requests.respond failed");
    res.status(500).json({ error: "Reageren mislukt." });
  }
});

router.post("/friends/:clerkId/buddy", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const friendClerkId = String(req.params.clerkId);
  const selected = Boolean((req.body ?? {}).selected);
  try {
    const result = await setTrainingBuddy(clerkId, friendClerkId, selected);
    if (!result.ok) {
      res.status(404).json({ error: result.reason });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.friends.buddy failed");
    res.status(500).json({ error: "Bijwerken mislukt." });
  }
});

router.delete("/friends/:clerkId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const friendClerkId = String(req.params.clerkId);
  try {
    const removed = await removeFriend(clerkId, friendClerkId);
    if (!removed) {
      res.status(404).json({ error: "Geen vriend gevonden." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.friends.remove failed");
    res.status(500).json({ error: "Verwijderen mislukt." });
  }
});

// ── Friend feed ──────────────────────────────────────────────────────────────

router.get("/feed", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json({ items: await getFriendFeed(clerkId) });
  } catch (err) {
    req.log.error({ err }, "social.feed failed");
    res.status(500).json({ error: "Kon de vriendenfeed niet laden." });
  }
});

// ── Joint-training suggestion ────────────────────────────────────────────────

router.get("/suggestion", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json({ suggestion: await suggestJointTraining(clerkId) });
  } catch (err) {
    req.log.error({ err }, "social.suggestion failed");
    res.status(500).json({ error: "Kon geen voorstel maken." });
  }
});

// ── Group proposals ──────────────────────────────────────────────────────────

router.get("/proposals", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [sent, received] = await Promise.all([
      listSentProposals(clerkId),
      listReceivedProposals(clerkId),
    ]);
    res.json({ sent, received });
  } catch (err) {
    req.log.error({ err }, "social.proposals.list failed");
    res.status(500).json({ error: "Kon voorstellen niet laden." });
  }
});

router.post("/proposals", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const scheduledRaw = String(body.scheduledAt ?? "");
  const scheduledAt = new Date(scheduledRaw);
  if (!scheduledRaw || Number.isNaN(scheduledAt.getTime())) {
    res.status(400).json({ error: "Ongeldige datum/tijd." });
    return;
  }
  const trainingType = String(body.trainingType ?? "").trim();
  if (!trainingType) {
    res.status(400).json({ error: "Kies een trainingstype." });
    return;
  }
  const inviteeClerkIds = Array.isArray(body.inviteeClerkIds)
    ? body.inviteeClerkIds.map((x) => String(x))
    : [];
  const durationRaw = body.durationMin;
  const durationMin =
    durationRaw === undefined || durationRaw === null || durationRaw === ""
      ? null
      : Number(durationRaw);
  if (durationMin !== null && !Number.isFinite(durationMin)) {
    res.status(400).json({ error: "Ongeldige duur." });
    return;
  }
  try {
    const result = await createProposal(clerkId, {
      scheduledAt,
      trainingType,
      durationMin,
      area: body.area ? String(body.area) : null,
      intensity: body.intensity ? String(body.intensity) : null,
      note: body.note ? String(body.note) : null,
      inviteeClerkIds,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.status(201).json({ ok: true, id: result.id });
  } catch (err) {
    req.log.error({ err }, "social.proposals.create failed");
    res.status(500).json({ error: "Voorstel maken mislukt." });
  }
});

router.post("/proposals/:id/respond", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Ongeldig voorstel-id." });
    return;
  }
  const accept = Boolean((req.body ?? {}).accept);
  try {
    const result = await respondToProposal(clerkId, id, accept);
    if (!result.ok) {
      res.status(404).json({ error: result.reason });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.proposals.respond failed");
    res.status(500).json({ error: "Reageren mislukt." });
  }
});

// ── Club / team identity ─────────────────────────────────────────────────────

router.get("/team", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json({ team: await getTeamIdentity(clerkId) });
  } catch (err) {
    req.log.error({ err }, "social.team.get failed");
    res.status(500).json({ error: "Kon clubgegevens niet laden." });
  }
});

router.put("/team", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) =>
    v === undefined ? undefined : v === null || v === "" ? null : String(v);
  try {
    const team = await setTeamIdentity(clerkId, {
      clubName: str(body.clubName),
      teamName: str(body.teamName),
      logoUrl: str(body.logoUrl),
      primaryColor: str(body.primaryColor),
      secondaryColor: str(body.secondaryColor),
      sport: str(body.sport),
      category: str(body.category),
      shirtBadge: str(body.shirtBadge),
      role: str(body.role),
    });
    res.json({ team });
  } catch (err) {
    req.log.error({ err }, "social.team.set failed");
    res.status(500).json({ error: "Opslaan mislukt." });
  }
});

export default router;
