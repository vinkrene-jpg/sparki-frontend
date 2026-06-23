// Sparki Voice & Personality Engine — HTTP surface.
//
// GET /api/voice — everything the Profiel "Hoe Sparki klinkt" panel needs, built
// from the athlete's REAL trust profile and REAL memories. The five styles are
// each rendered (so the athlete can see them) but flagged `unlocked` per their
// current trust tier — Sparki only actually speaks the unlocked ones. The memory
// hook and open-loop are omitted honestly when there is nothing real to point at.

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { listContextMemories } from "../engines/context-memory";
import {
  computeTrust,
  composeVoice,
  isToneUnlocked,
  memoryTopic,
  voiceTones,
  TONE_LABELS,
  TIER_LABELS,
  TIER_BLURB,
  type VoiceTone,
} from "../engines/voice";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const trust = await computeTrust(clerkId);

    // The five styles, each demonstrated on a neutral "good form" moment so the
    // athlete hears the difference. `forceTone` renders even locked styles; the
    // `unlocked` flag tells the UI which ones Sparki actually uses for them now.
    const styles = voiceTones.map((tone: VoiceTone) => {
      const line = composeVoice(
        { event: "good_form", tone, trust: trust.tier, sport: "general", seed: 0 },
        true,
      );
      return {
        tone,
        label: TONE_LABELS[tone],
        line: line?.text ?? "",
        unlocked: isToneUnlocked(tone, trust.tier),
      };
    });

    // Relational memory hook — only if the athlete actually told Sparki something
    // worth circling back to. Uses their most recent enabled, non-private memory.
    const memories = await listContextMemories(clerkId);
    const recall = memories.find((m) => m.enabled);
    const memoryHook = recall
      ? composeVoice({
          event: "memory_followup",
          trust: trust.tier,
          memory: memoryTopic(recall.kind),
          tone: "curious",
          seed: 0,
        })
      : null;

    // Open loop — Sparki only teases a pattern when there is real data to chew on.
    const hasEvidence =
      trust.signals.metricsLogged >= 3 || trust.signals.memoriesShared >= 2;
    const openLoop = composeVoice({
      event: "pattern_found",
      trust: trust.tier,
      tone: "curious",
      evidence: hasEvidence,
      seed: 0,
    });

    // Empathy-first example — a fall always leads with a wellbeing check.
    const empathy = composeVoice({ event: "fall", trust: trust.tier, seed: 0 });

    res.json({
      trust: {
        score: Math.round(trust.score * 100) / 100,
        tier: trust.tier,
        tierLabel: TIER_LABELS[trust.tier],
        tierBlurb: TIER_BLURB[trust.tier],
        signals: trust.signals,
      },
      styles,
      memoryHook: memoryHook?.text ?? null,
      openLoop: openLoop?.text ?? null,
      empathy: empathy?.text ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "voice.profile failed");
    res.status(500).json({ error: "Kon Sparki's stem niet laden." });
  }
});

export default router;
