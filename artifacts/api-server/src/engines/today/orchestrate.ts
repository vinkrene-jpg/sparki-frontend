// Today Orchestrator (WP-T1) — deterministische selectie- en prioriterings-
// laag voor Vandaag. GEEN nieuw analysesysteem: alle inhoud komt uit bestaande
// engines/tabellen (state-engine, planning, wedstrijden, sessies, gezondheid);
// dit bepaalt alleen wát nu bovenaan staat en wat slim mag wisselen.
//
// Ranking (opdracht §3): urgent > openstaande actie > nieuw > relevant >
// wisselend. Urgente en openstaande zaken blijven staan; ondersteunende
// kaarten roteren op een dag-stabiele seed (geen flikkerende volgorde) en
// pauzeren na 3 getoonde dagen zonder klik (weergavehistorie).
//
// Eerlijkheid: elke slot-inhoud draagt zijn bron; ontbreekt data, dan is het
// slot null (eerlijke lege toestand) — nooit een generieke vultekst. Geen
// AI-calls in dit pad: WP-T1 is volledig deterministisch; AI-formulering via
// de centrale aiMessage-poort (met cache + fallback) is bewust uitgesteld.

import {
  db,
  athleteProfilesTable,
  userProfilesTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  racesTable,
  todayDisplayHistoryTable,
} from "@workspace/db";
import { and, eq, gte, ne, asc, desc, sql } from "drizzle-orm";
import { runStateAnalysis } from "../state";
import type { SparkiState } from "../state";
import { deriveTodayProfile, type TodayProfile } from "./profile";

/** YYYY-MM-DD van vandaag in Europe/Amsterdam (en-CA levert ISO-volgorde). */
export function amsterdamToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

export type TodaySlotName = "lead" | "support" | "insight" | "rotating";

export interface TodayAction {
  id: string;
  label: string;
  href: string;
}

export interface TodayItem {
  key: string;
  slot: TodaySlotName;
  title: string;
  body: string;
  actions: TodayAction[];
  /** Herleidbare bron van de conclusie (opdracht §8). */
  source: string;
  /** 0–100 wanneer de bron-engine confidence levert, anders null (eerlijk). */
  confidence: number | null;
  urgent: boolean;
}

export interface TodayResult {
  date: string;
  profile: TodayProfile;
  lead: TodayItem | null;
  support: TodayItem | null;
  insight: TodayItem | null;
  rotating: TodayItem | null;
  /** Afgevallen kandidaat-sleutels + reden — voedt de debugweergave (WP-T3). */
  passedOver: { key: string; reason: string }[];
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00Z`).getTime();
  const b = new Date(`${toYmd}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Dag-stabiele deterministische hash (zelfde gebruiker+dag ⇒ zelfde keuze). */
function daySeed(clerkId: string, ymd: string): number {
  let h = 0;
  const s = `${clerkId}:${ymd}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function orchestrateToday(clerkId: string): Promise<TodayResult> {
  const today = amsterdamToday();

  const [profileRows, userRows, workoutRows, raceRows, sessions, history] =
    await Promise.all([
      db
        .select()
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId))
        .limit(1),
      db
        .select({ activeRole: userProfilesTable.activeRole })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, clerkId))
        .limit(1),
      db
        .select()
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.scheduledDate, today),
            ne(plannedWorkoutsTable.status, "cancelled"),
          ),
        )
        // Deterministisch bij meerdere trainingen op één dag: laagste id wint,
        // anders kan de lead-sleutel tussen requests wisselen (flikkeren).
        .orderBy(asc(plannedWorkoutsTable.id))
        .limit(1),
      db
        .select({
          id: racesTable.id,
          name: racesTable.name,
          raceDate: racesTable.raceDate,
          priority: racesTable.priority,
        })
        .from(racesTable)
        .where(
          and(
            eq(racesTable.clerkId, clerkId),
            gte(racesTable.raceDate, today),
            ne(racesTable.status, "geannuleerd"),
          ),
        )
        .orderBy(asc(racesTable.raceDate))
        .limit(1),
      db
        .select({
          id: trainingSessionsTable.id,
          sessionDate: trainingSessionsTable.sessionDate,
          tss: trainingSessionsTable.tss,
          title: trainingSessionsTable.title,
        })
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, clerkId))
        .orderBy(desc(trainingSessionsTable.sessionDate))
        .limit(30),
      db
        .select()
        .from(todayDisplayHistoryTable)
        .where(eq(todayDisplayHistoryTable.clerkId, clerkId)),
    ]);

  const athleteProfile = profileRows[0] ?? null;
  const activeRole = userRows[0]?.activeRole ?? "athlete";
  const todayWorkout = workoutRows[0] ?? null;
  const nextRace = raceRows[0] ?? null;
  const raceDays = nextRace ? daysBetween(today, nextRace.raceDate) : null;

  // State-engine is een verrijking, geen vereiste: valt hij uit, dan blijft
  // Vandaag werken met de overige echte data (eerlijke degradatie).
  let state: SparkiState | null = null;
  try {
    state = await runStateAnalysis(clerkId);
  } catch {
    state = null;
  }

  const profile = deriveTodayProfile({
    birthDate: athleteProfile?.birthDate ?? null,
    birthYear: athleteProfile?.birthYear ?? null,
    experienceLevel: athleteProfile?.experienceLevel ?? null,
    competitionLevel: athleteProfile?.competitionLevel ?? null,
    developmentGoal: athleteProfile?.developmentGoal ?? null,
    activeRole,
    sessionCount: sessions.length,
    hasUpcomingRace: nextRace != null,
  });

  const passedOver: { key: string; reason: string }[] = [];
  const jeugd = profile.variant === "jeugd";

  // ── Lead-kandidaten in vaste prioriteitsvolgorde ──────────────────────────
  let lead: TodayItem | null = null;

  const health = athleteProfile?.healthStatus ?? "ok";
  if (health !== "ok") {
    const ziek = health === "sick";
    lead = {
      key: `lead:health:${health}`,
      slot: "lead",
      title: ziek ? "Eerst beter worden" : "Eerst herstellen",
      body: ziek
        ? "Je staat op ziek. Trainen wacht; rust is nu de snelste weg terug."
        : "Je staat op geblesseerd. Volg je herstelplan; Sparki plant niets in tot je hersteld gemeld bent.",
      actions: [
        { id: "health", label: "Bekijk je herstelstatus", href: "/vandaag?zelf=1" },
      ],
      source: "athlete_profiles.health_status",
      confidence: null,
      urgent: true,
    };
  } else if (todayWorkout) {
    const done = todayWorkout.status === "completed";
    if (!done) {
      lead = {
        key: `lead:workout_today:${todayWorkout.id}`,
        slot: "lead",
        title: jeugd ? "Dit staat er vandaag op" : "Training van vandaag",
        body: todayWorkout.title
          ? `${todayWorkout.title}${todayWorkout.targetDurationMin ? ` · ±${todayWorkout.targetDurationMin} min` : ""}`
          : "Je geplande training staat klaar.",
        actions: [
          { id: "open", label: "Bekijk de training", href: "/trainen" },
        ],
        source: "planned_workouts",
        confidence: null,
        urgent: false,
      };
    } else {
      passedOver.push({
        key: `lead:workout_today:${todayWorkout.id}`,
        reason: "training al afgerond",
      });
    }
  }

  if (!lead) {
    // Geen plan vandaag → concreet handelingsperspectief (opdracht §7),
    // opgebouwd uit uitsluitend echte feiten die we hier al hebben.
    const parts: string[] = ["Vandaag staat geen training gepland."];
    if (state && (state.band === "belastbaar" || state.band === "solide")) {
      parts.push("Je bent voldoende hersteld.");
    }
    if (nextRace && raceDays != null && raceDays <= 21) {
      parts.push(
        raceDays === 0
          ? `Vandaag is ${nextRace.name}.`
          : `Je volgende wedstrijd (${nextRace.name}) is over ${raceDays} ${raceDays === 1 ? "dag" : "dagen"}.`,
      );
    }
    parts.push(
      jeugd
        ? "Een rustige tocht kan, maar een vrije dag is net zo goed."
        : "Een gerichte prikkel kan passen, maar een bewuste hersteldag is ook verantwoord.",
    );
    lead = {
      key: "lead:no_plan_advice",
      slot: "lead",
      title: jeugd ? "Vrije dag" : "Geen training gepland",
      body: parts.join(" "),
      actions: [
        { id: "propose", label: "Laat Sparki een training voorstellen", href: "/trainen/toevoegen" },
        { id: "rest", label: "Kies bewust voor herstel", href: "/vandaag?zelf=1" },
      ],
      source: "planned_workouts + state-engine + races",
      confidence: state?.confidence ?? null,
      urgent: false,
    };
  }

  // ── Support: onderbouwing uit de state-engine (alleen met echte signalen) ─
  let support: TodayItem | null = null;
  if (state && state.why.length > 0) {
    support = {
      key: `support:state:${state.band}`,
      slot: "support",
      title: "Waarom Sparki dit zegt",
      body: state.why.map((w) => w.reading).join(" · "),
      actions: [],
      source: "state-engine (echte signalen)",
      confidence: state.confidence,
      urgent: false,
    };
  } else {
    passedOver.push({
      key: "support:state",
      reason: "state-engine leverde geen signalen — slot blijft eerlijk leeg",
    });
  }

  // ── Insight: alleen bij een echte, onderbouwde trend ──────────────────────
  let insight: TodayItem | null = null;
  if (
    state &&
    (state.movement.direction === "stijgend" ||
      state.movement.direction === "dalend") &&
    state.why.length >= 2
  ) {
    // Dedupe-principe: de statuszin staat al in de coachboodschap bovenaan —
    // het inzicht voegt het eerste echte signaal toe in plaats van herhaling.
    insight = {
      key: `insight:trend:${state.movement.direction}`,
      slot: "insight",
      title: state.movement.label,
      body: state.why[0]!.reading,
      actions: [{ id: "state", label: "Bekijk de onderbouwing", href: "/vandaag?zelf=1" }],
      source: "state-engine trend (7-daagse echte reeksen)",
      confidence: state.confidence,
      urgent: false,
    };
  } else {
    passedOver.push({
      key: "insight:trend",
      reason:
        "geen aantoonbare trend of te weinig signalen — geen 'je gaat vooruit' zonder bewijs",
    });
  }

  // ── Rotating: dag-stabiele wissel uit beschikbare, niet-uitgekeken pool ──
  const pool: TodayItem[] = [];
  const lastSession = sessions[0] ?? null;
  if (lastSession && daysBetween(lastSession.sessionDate, today) <= 3) {
    pool.push({
      key: `rotating:last_ride:${lastSession.id}`,
      slot: "rotating",
      title: "Je laatste rit",
      body: `${lastSession.title ?? "Activiteit"} (${lastSession.sessionDate})${lastSession.tss != null ? ` · belasting ${lastSession.tss}` : ""}. Bekijk wat Sparki erin zag.`,
      actions: [{ id: "open", label: "Open de analyse", href: `/activiteiten/${lastSession.id}` }],
      source: "training_sessions",
      confidence: null,
      urgent: false,
    });
  }
  if (nextRace && raceDays != null && raceDays <= 14 && !jeugd) {
    pool.push({
      key: `rotating:race_prep:${nextRace.id}`,
      slot: "rotating",
      title: "Wedstrijdvoorbereiding",
      body: `${nextRace.name} over ${raceDays} ${raceDays === 1 ? "dag" : "dagen"}. Loop je voorbereiding na.`,
      actions: [{ id: "race", label: "Open het wedstrijddossier", href: `/wedstrijden/${nextRace.id}` }],
      source: "races",
      confidence: null,
      urgent: false,
    });
  }
  pool.push({
    key: "rotating:route_suggestion",
    slot: "rotating",
    title: "Route voor als je gaat rijden",
    body: "Laat Sparki een route voorstellen die past bij je fiets en je tijd.",
    actions: [{ id: "routes", label: "Naar de routeplanner", href: "/routes" }],
    source: "route-engine (op aanvraag)",
    confidence: null,
    urgent: false,
  });

  // Weergavehistorie: pauzeer niet-urgente rotating-items die ≥3 dagen getoond
  // zijn zonder klik of afronding (aandacht-rotatieprincipe).
  const historyByKey = new Map(history.map((h) => [h.itemKey, h]));
  const fresh = pool.filter((c) => {
    const h = historyByKey.get(c.key);
    if (h && h.daysShown >= 3 && !h.clicked && !h.completed) {
      passedOver.push({ key: c.key, reason: "3 dagen getoond zonder interactie — gepauzeerd" });
      return false;
    }
    return true;
  });
  const rotating =
    fresh.length > 0 ? fresh[daySeed(clerkId, today) % fresh.length]! : null;
  if (!rotating) {
    passedOver.push({
      key: "rotating:*",
      reason: "geen verse kandidaten — slot blijft eerlijk leeg",
    });
  }

  // ── Weergavehistorie bijwerken voor wat we nu tonen ───────────────────────
  const shown = [lead, support, insight, rotating].filter(
    (i): i is TodayItem => i != null,
  );
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

  return { date: today, profile, lead, support, insight, rotating, passedOver };
}

/** Klik/afronding registreren — houdt openstaande acties eerlijk actueel. */
export async function recordTodayInteraction(
  clerkId: string,
  itemKey: string,
  action: "clicked" | "completed",
): Promise<boolean> {
  const res = await db
    .update(todayDisplayHistoryTable)
    .set(
      action === "clicked"
        ? { clicked: true, updatedAt: sql`now()` }
        : { completed: true, updatedAt: sql`now()` },
    )
    .where(
      and(
        eq(todayDisplayHistoryTable.clerkId, clerkId),
        eq(todayDisplayHistoryTable.itemKey, itemKey),
      ),
    )
    .returning({ id: todayDisplayHistoryTable.id });
  return res.length > 0;
}
