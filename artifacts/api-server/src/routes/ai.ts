import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  athleteDailyMetricsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

async function buildAthleteContext(clerkId: string): Promise<string> {
  const today = todayStr();

  const [[user], [athlete], allWorkouts, recentSessions, recentMetrics] =
    await Promise.all([
      db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, clerkId)),
      db
        .select()
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId)),
      db
        .select()
        .from(plannedWorkoutsTable)
        .where(eq(plannedWorkoutsTable.clerkId, clerkId))
        .orderBy(desc(plannedWorkoutsTable.scheduledDate))
        .limit(14),
      db
        .select()
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, clerkId))
        .orderBy(desc(trainingSessionsTable.sessionDate))
        .limit(7),
      db
        .select()
        .from(athleteDailyMetricsTable)
        .where(eq(athleteDailyMetricsTable.clerkId, clerkId))
        .orderBy(desc(athleteDailyMetricsTable.metricDate))
        .limit(14),
    ]);

  const todayPlan = allWorkouts.find((w) => w.scheduledDate === today) ?? null;
  const todayMetric = recentMetrics.find((m) => m.metricDate === today) ?? null;

  const parts: string[] = [];
  parts.push(`TODAY: ${today}`);
  parts.push(`ATHLETE: ${user?.displayName ?? "Unknown"}`);

  if (athlete) {
    const wkg =
      athlete.ftp && athlete.weightKg
        ? (athlete.ftp / Number(athlete.weightKg)).toFixed(2)
        : null;
    parts.push(
      `PROFILE: FTP=${athlete.ftp ?? "not set"}W${wkg ? `, ${wkg} W/kg` : ""}, Weight=${athlete.weightKg ?? "unknown"}kg, Discipline=${athlete.discipline ?? "road cycling"}`,
    );
    if (athlete.goals) parts.push(`SEASON GOALS: ${athlete.goals}`);
    if (athlete.weeklyHourTarget)
      parts.push(`TARGET WEEKLY HOURS: ${athlete.weeklyHourTarget}h`);
  }

  if (todayPlan) {
    parts.push(
      `TODAY'S PLANNED WORKOUT: ${todayPlan.title} (${todayPlan.type}, ${todayPlan.targetDurationMin ?? "?"}min, target TSS=${todayPlan.targetTSS ?? "?"}, status=${todayPlan.status})`,
    );
    if (todayPlan.description)
      parts.push(`WORKOUT DESCRIPTION: ${todayPlan.description}`);
  } else {
    parts.push(`TODAY'S PLANNED WORKOUT: None scheduled`);
  }

  if (todayMetric) {
    const fields = [
      todayMetric.hrv != null && `HRV=${todayMetric.hrv}ms`,
      todayMetric.restingHR != null &&
        `RestingHR=${todayMetric.restingHR}bpm`,
      todayMetric.sleepHours != null && `Sleep=${todayMetric.sleepHours}h`,
      todayMetric.sleepQuality != null &&
        `SleepQuality=${todayMetric.sleepQuality}/5`,
      todayMetric.fatigueScore != null &&
        `Fatigue=${todayMetric.fatigueScore}/10`,
      todayMetric.feelScore != null && `Feel=${todayMetric.feelScore}/5`,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(`TODAY'S READINESS: ${fields}`);
  } else {
    parts.push(`TODAY'S READINESS: No check-in logged yet`);
  }

  if (recentSessions.length > 0) {
    parts.push(`RECENT SESSIONS:`);
    for (const s of recentSessions) {
      const d = [
        s.sessionDate,
        s.title ?? s.type,
        s.durationMin != null && `${s.durationMin}min`,
        s.normalizedPower != null && `NP=${s.normalizedPower}W`,
        s.tss != null && `TSS=${s.tss}`,
        s.feelScore != null && `Feel=${s.feelScore}/5`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`  - ${d}`);
    }
  } else {
    parts.push(`RECENT SESSIONS: No sessions logged yet`);
  }

  if (recentMetrics.length > 1) {
    const hrvTrend = recentMetrics
      .slice()
      .reverse()
      .map((m) => m.hrv ?? "-")
      .join(", ");
    parts.push(`HRV TREND (oldest→newest): ${hrvTrend}`);
  }

  return parts.join("\n");
}

const SPARKI_SYSTEM = `You are Sparki, an expert AI performance coach specializing in competitive cycling. You have deep knowledge of training science: periodization, power-based training, TSS/CTL/ATL/TSB, heart rate variability, recovery protocols, and race preparation. You give precise, data-driven coaching advice. Always reference the athlete's actual numbers when available. Be direct and concise — no fluff, no generic advice. Speak like a knowledgeable coach who respects the athlete's intelligence.`;

// ── POST /api/ai/brief ───────────────────────────────────────────────────────
router.post("/brief", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const context = await buildAthleteContext(clerkId);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SPARKI_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Generate a daily coaching brief based on this data:\n\n${context}\n\nProvide 2-3 sentences covering: readiness assessment and today's workout guidance. Be specific to the actual numbers. If no check-in or plan exists, note what data would improve your guidance.`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response" });
      return;
    }

    res.json({ brief: block.text });
  } catch (err) {
    req.log.error({ err }, "ai.brief failed");
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// ── POST /api/ai/ask ─────────────────────────────────────────────────────────
router.post("/ask", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { question } = req.body as { question?: string };

  if (!question?.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  try {
    const context = await buildAthleteContext(clerkId);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SPARKI_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Athlete data:\n${context}\n\nQuestion: ${question.trim()}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response" });
      return;
    }

    res.json({ answer: block.text });
  } catch (err) {
    req.log.error({ err }, "ai.ask failed");
    res.status(500).json({ error: "AI service unavailable" });
  }
});

export default router;
