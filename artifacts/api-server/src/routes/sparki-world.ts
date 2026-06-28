// Sparki World — feed & interactions API.
//
// All routes require auth (cookie-based). Real users only read the validated
// feed and interact (follow/favorite/like/comment). Every response carries
// fictional:true so the frontend can keep the "Sparki World — gesimuleerd"
// label honest and unmissable.

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getWorldFeed,
  getAthleteProfile,
  setFollow,
  unfollow,
  toggleLike,
  addComment,
  listComments,
} from "../engines/world-feed";

const router = Router();

function clerkOr401(req: Parameters<typeof getClerkUserId>[0], res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  const clerkId = getClerkUserId(req as never);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return clerkId;
}

// GET /api/world/feed?limit=
router.get("/feed", requireAuth, async (req, res) => {
  const clerkId = clerkOr401(req, res);
  if (!clerkId) return;
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50)
    : 24;
  try {
    const result = await getWorldFeed(clerkId, limit);
    res.json({ ...result, fictional: true });
  } catch (err) {
    req.log.error({ err }, "world.feed failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/world/athletes/:slug
router.get("/athletes/:slug", requireAuth, async (req, res) => {
  const clerkId = clerkOr401(req, res);
  if (!clerkId) return;
  const slug = String(req.params.slug);
  try {
    const view = await getAthleteProfile(slug, clerkId);
    if (!view) {
      res.status(404).json({ error: "Niet gevonden" });
      return;
    }
    res.json(view);
  } catch (err) {
    req.log.error({ err }, "world.athleteProfile failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/world/athletes/:id/follow   body: { favorite?: boolean }
router.post("/athletes/:id/follow", requireAuth, async (req, res) => {
  const clerkId = clerkOr401(req, res);
  if (!clerkId) return;
  const athleteId = Number(req.params.id);
  if (!Number.isInteger(athleteId)) {
    res.status(400).json({ error: "Ongeldige atleet" });
    return;
  }
  const favorite = req.body?.favorite === true;
  try {
    const result = await setFollow(clerkId, athleteId, favorite);
    if (!result) {
      res.status(404).json({ error: "Atleet niet gevonden" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "world.follow failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/world/athletes/:id/follow
router.delete("/athletes/:id/follow", requireAuth, async (req, res) => {
  const clerkId = clerkOr401(req, res);
  if (!clerkId) return;
  const athleteId = Number(req.params.id);
  if (!Number.isInteger(athleteId)) {
    res.status(400).json({ error: "Ongeldige atleet" });
    return;
  }
  try {
    await unfollow(clerkId, athleteId);
    res.json({ following: false, favorite: false });
  } catch (err) {
    req.log.error({ err }, "world.unfollow failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/world/posts/:id/like  (toggle)
router.post("/posts/:id/like", requireAuth, async (req, res) => {
  const clerkId = clerkOr401(req, res);
  if (!clerkId) return;
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) {
    res.status(400).json({ error: "Ongeldige post" });
    return;
  }
  try {
    const result = await toggleLike(clerkId, postId);
    if (!result) {
      res.status(404).json({ error: "Post niet gevonden" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "world.like failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/world/posts/:id/comments
router.get("/posts/:id/comments", requireAuth, async (req, res) => {
  const clerkId = clerkOr401(req, res);
  if (!clerkId) return;
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) {
    res.status(400).json({ error: "Ongeldige post" });
    return;
  }
  try {
    const comments = await listComments(postId, clerkId);
    res.json({ comments });
  } catch (err) {
    req.log.error({ err }, "world.listComments failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/world/posts/:id/comments  body: { body: string }
router.post("/posts/:id/comments", requireAuth, async (req, res) => {
  const clerkId = clerkOr401(req, res);
  if (!clerkId) return;
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) {
    res.status(400).json({ error: "Ongeldige post" });
    return;
  }
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (body.length < 1 || body.length > 500) {
    res.status(400).json({ error: "Reactie moet tussen 1 en 500 tekens zijn." });
    return;
  }
  try {
    const comment = await addComment(clerkId, postId, body);
    if (!comment) {
      res.status(404).json({ error: "Post niet gevonden" });
      return;
    }
    res.status(201).json({ comment });
  } catch (err) {
    req.log.error({ err }, "world.addComment failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
