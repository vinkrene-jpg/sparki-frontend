// TRAINEN_DOELEN_SEIZOEN_01 F10 — doelvorm Ritme: weekbeeld.
//
// GET /api/rhythm/week — eerlijk weekbeeld voor doelvorm Ritme, zonder fasen.
//  - Volwassenen (14+): welke dagen er gefietst is + aantallen (actieve dagen,
//    weekuren-richtpunt) + gekozen proxy's.
//  - Onder de 14 (TD-15): GEEN ENKEL getal — alleen wélke dagen er gefietst
//    is, in woorden. Geen streaks, geen gemiste dagen (TD-16). De ouder ziet
//    exact hetzelfde beeld: dit endpoint is de enige bron en bouwt het
//    jeugdbeeld server-side, dus elke consument (ook de ouderomgeving) krijgt
//    dezelfde getalvrije weergave.

import { Router } from "express";
import { and, eq, gte } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  trainingSessionsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { computeAge } from "../lib/age";

const router = Router();

const DAY_NL = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
] as const;

function amsDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}

router.get("/week", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [profile] = await db
      .select({
        birthDate: athleteProfilesTable.birthDate,
        birthYear: athleteProfilesTable.birthYear,
        rhythmProxies: athleteProfilesTable.rhythmProxies,
        weeklyHourTarget: athleteProfilesTable.weeklyHourTarget,
        goalForm: athleteProfilesTable.goalForm,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Profiel niet gevonden" });
      return;
    }

    const today = amsDate(new Date());
    const weekAgo = amsDate(new Date(Date.now() - 6 * 86400000));
    const sessions = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        durationMin: trainingSessionsTable.durationMin,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, weekAgo),
        ),
      );

    const dayNames = [
      ...new Set(
        sessions.map(
          (s) => DAY_NL[new Date(`${s.sessionDate}T12:00:00Z`).getUTCDay()]!,
        ),
      ),
    ];

    const age = computeAge(profile.birthDate, profile.birthYear);
    // TD-15: onbekende leeftijd clampt naar het veiligheidsminimum — dan ook
    // het getalvrije jeugdbeeld (fail-closed, zoals overal in de jeugdlaag).
    const jeugd = age == null || age < 14;

    if (jeugd) {
      // Geen enkel getal: geen aantallen, geen uren, geen streaks. Alleen
      // wélke dagen, in woorden. De ouderomgeving consumeert ditzelfde beeld.
      res.json({
        goalForm: profile.goalForm ?? null,
        jeugd: true,
        gefietstOp: dayNames,
        proxies: profile.rhythmProxies ?? [],
        toelichting:
          dayNames.length > 0
            ? `Deze week is er gefietst op ${dayNames.join(", ")}. Lekker bezig — het gaat om het ritme, niet om cijfers.`
            : "Deze week is er nog niet gefietst. Geen probleem — kijk gewoon welke dag het komende dagen past.",
      });
      return;
    }

    const totalMin = sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
    res.json({
      goalForm: profile.goalForm ?? null,
      jeugd: false,
      gefietstOp: dayNames,
      actieveDagen: dayNames.length,
      totaalMinuten: totalMin,
      weekurenRichtpunt: profile.weeklyHourTarget ?? null,
      proxies: profile.rhythmProxies ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "rhythm.week failed");
    res.status(500).json({ error: "Kon weekbeeld niet laden" });
  }
});

export default router;
