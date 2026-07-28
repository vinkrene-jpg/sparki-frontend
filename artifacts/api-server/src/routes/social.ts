import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";
import { sessionSeed, seededRotate, windowedReorder } from "../lib/variation";
import {
  searchAthletes,
  sendFriendRequest,
  respondFriendRequest,
  listFriends,
  listFriendRequests,
  setTrainingBuddy,
  removeFriend,
  getFriendFeed,
  getCircleFeed,
  suggestJointTraining,
  createProposal,
  respondToProposal,
  listSentProposals,
  listReceivedProposals,
  getTeamIdentity,
  setTeamIdentity,
  getSocialOverview,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  listBlockedUsers,
  reportUser,
  getProfilePrivacy,
  updateProfilePrivacy,
  getPublicProfile,
  matchContacts,
} from "../engines/social";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ── Overzicht: vrienden / volgers / gevolgd ──────────────────────────────────

router.get("/overview", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const friends = await listFriends(clerkId);
    const overview = await getSocialOverview(clerkId, friends.length);
    res.json({ ...overview, friends });
  } catch (err) {
    req.log.error({ err }, "social.overview failed");
    res.status(500).json({ error: "Kon je netwerk niet laden." });
  }
});

// ── Volgen ───────────────────────────────────────────────────────────────────

router.post("/follow/:clerkId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await followUser(clerkId, String(req.params.clerkId));
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.follow failed");
    res.status(500).json({ error: "Volgen mislukt." });
  }
});

router.delete("/follow/:clerkId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const removed = await unfollowUser(clerkId, String(req.params.clerkId));
    if (!removed) {
      res.status(404).json({ error: "Je volgt deze sporter niet." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.unfollow failed");
    res.status(500).json({ error: "Ontvolgen mislukt." });
  }
});

// ── Blokkeren & rapporteren ──────────────────────────────────────────────────

router.get("/blocks", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json({ blocked: await listBlockedUsers(clerkId) });
  } catch (err) {
    req.log.error({ err }, "social.blocks.list failed");
    res.status(500).json({ error: "Kon blokkades niet laden." });
  }
});

router.post("/blocks/:clerkId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const target = String(req.params.clerkId);
  if (target === clerkId) {
    res.status(400).json({ error: "Je kunt jezelf niet blokkeren." });
    return;
  }
  try {
    await blockUser(clerkId, target);
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.blocks.create failed");
    res.status(500).json({ error: "Blokkeren mislukt." });
  }
});

router.delete("/blocks/:clerkId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const removed = await unblockUser(clerkId, String(req.params.clerkId));
    if (!removed) {
      res.status(404).json({ error: "Geen blokkade gevonden." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.blocks.remove failed");
    res.status(500).json({ error: "Deblokkeren mislukt." });
  }
});

router.post("/reports", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const target = String(body.clerkId ?? "");
  if (!target || target === clerkId) {
    res.status(400).json({ error: "Ongeldige melding." });
    return;
  }
  try {
    await reportUser(clerkId, target, body.reason ? String(body.reason) : null);
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social.reports failed");
    res.status(500).json({ error: "Melden mislukt." });
  }
});

// ── Per-categorie privacy ────────────────────────────────────────────────────

router.get("/privacy", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json(await getProfilePrivacy(clerkId));
  } catch (err) {
    req.log.error({ err }, "social.privacy.get failed");
    res.status(500).json({ error: "Kon privacy-instellingen niet laden." });
  }
});

router.put("/privacy", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates =
    body.categories && typeof body.categories === "object"
      ? (body.categories as Record<string, unknown>)
      : {};
  try {
    const result = await updateProfilePrivacy(clerkId, updates);
    if (!result.ok) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({ ok: true, categories: result.categories });
  } catch (err) {
    req.log.error({ err }, "social.privacy.put failed");
    res.status(500).json({ error: "Opslaan mislukt." });
  }
});

// ── Profielweergave ──────────────────────────────────────────────────────────

router.get("/profile/:clerkId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const profile = await getPublicProfile(clerkId, String(req.params.clerkId));
    if (!profile) {
      // Neutraal en fail-closed: bestaat-niet, geblokkeerd en afgeschermd
      // geven exact dezelfde uitkomst.
      res.status(404).json({ error: "Dit profiel is niet beschikbaar." });
      return;
    }
    res.json({ profile });
  } catch (err) {
    req.log.error({ err }, "social.profile failed");
    res.status(500).json({ error: "Kon profiel niet laden." });
  }
});

// ── Contactmatching (privacyvriendelijk, niets wordt opgeslagen) ─────────────

router.post("/contacts/match", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const hashes = Array.isArray(body.hashes)
    ? body.hashes.map((h) => String(h))
    : [];
  try {
    const result = await matchContacts(clerkId, hashes);
    if (!result.ok) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({ matches: result.matches });
  } catch (err) {
    req.log.error({ err }, "social.contacts.match failed");
    res.status(500).json({ error: "Contacten vergelijken mislukt." });
  }
});

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

// ── Unified Circle feed ──────────────────────────────────────────────────────

router.get("/circle-feed", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    // Vary the order per app-open: due follow-ups stay pinned on top (rotated so
    // a different one can lead), the rest is reordered within small windows.
    // Pure presentation — the real items and their data never change.
    const seed = sessionSeed(req);
    const all = await getCircleFeed(clerkId);
    const followUps = all.filter((i) => i.type === "follow_up");
    const rest = all.filter((i) => i.type !== "follow_up");
    res.json({
      items: [...seededRotate(followUps, seed), ...windowedReorder(rest, seed)],
    });
  } catch (err) {
    req.log.error({ err }, "social.circle-feed failed");
    res.status(500).json({ error: "Kon je overzicht niet laden." });
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
  // A club logo is either the athlete's own uploaded storage object
  // ("/objects/…") or absent. Arbitrary external URLs are not accepted.
  const rawLogo = str(body.logoUrl);
  const logoUrl =
    rawLogo === undefined
      ? undefined
      : rawLogo && rawLogo.startsWith("/objects/")
        ? rawLogo
        : null;
  const objectStorageService = new ObjectStorageService();
  try {
    if (logoUrl) {
      // Claim the uploaded logo object. Takeover is refused: the claim only
      // succeeds when the object is still unowned (fresh upload) or already
      // owned by this athlete — never when someone else owns it. A missing
      // object (no bytes uploaded) is rejected too.
      let objectFile;
      try {
        objectFile = await objectStorageService.getObjectEntityFile(logoUrl);
      } catch {
        res.status(400).json({ error: "Logo-upload niet gevonden. Upload het logo opnieuw." });
        return;
      }
      const existing = await getObjectAclPolicy(objectFile);
      if (existing?.owner && existing.owner !== clerkId) {
        res.status(403).json({ error: "Dit bestand is niet van jou." });
        return;
      }
      await objectStorageService.trySetObjectEntityAclPolicy(logoUrl, {
        owner: clerkId,
        visibility: "private",
      });
    }
    const team = await setTeamIdentity(clerkId, {
      clubName: str(body.clubName),
      teamName: str(body.teamName),
      logoUrl,
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
