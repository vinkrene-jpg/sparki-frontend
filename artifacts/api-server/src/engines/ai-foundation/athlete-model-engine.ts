// Sparki Foundation — Athlete Model Engine.
//
// Dynamic athlete model: structured dimensions come from athlete_profiles
// (the existing hub — nothing duplicated), automatically-extensible
// dimensions live in athlete_model_extensions (key/value). What Sparki does
// not know is honestly listed in `ontbrekend`, never invented.

import { eq } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  athleteModelExtensionsTable,
  privacySettingsTable,
} from "@workspace/db";
import type { AthleteModel, AthleteModelEngine, DataSnapshot } from "./contracts";
import { engineLogger } from "./logging";

const log = engineLogger("athlete-model");

export function createAthleteModelEngine(): AthleteModelEngine {
  return {
    async build(clerkId: string, snapshot: DataSnapshot): Promise<AthleteModel> {
      const [[profile], [user], extensions] = await Promise.all([
        db
          .select()
          .from(athleteProfilesTable)
          .where(eq(athleteProfilesTable.clerkId, clerkId))
          .limit(1),
        db
          .select({ aiCoachingEnabled: privacySettingsTable.aiCoachingEnabled })
          .from(privacySettingsTable)
          .where(eq(privacySettingsTable.clerkId, clerkId))
          .limit(1),
        db
          .select()
          .from(athleteModelExtensionsTable)
          .where(eq(athleteModelExtensionsTable.clerkId, clerkId)),
      ]);

      const uitbreidingen: Record<string, unknown> = {};
      for (const ext of extensions) uitbreidingen[ext.key] = ext.value;

      const urenLaatste90d = snapshot.sessies.reduce(
        (sum, s) => (s.durationMin != null ? sum + s.durationMin : sum),
        0,
      );

      const ontbrekend: string[] = [];
      if (!profile?.goals && !profile?.developmentGoal) ontbrekend.push("doelen");
      if (!profile?.motivation) ontbrekend.push("motivatie");
      if (!profile?.experienceLevel) ontbrekend.push("ervaring");
      if (uitbreidingen["leerstijl"] == null) ontbrekend.push("leerstijl");
      if (profile?.weeklyHourTarget == null) ontbrekend.push("beschikbare uren");
      if (!profile?.loadCapacity) ontbrekend.push("belastbaarheid");
      if (!profile?.trainingPreferences) ontbrekend.push("voorkeuren");
      if (uitbreidingen["materiaal"] == null) ontbrekend.push("materiaal");
      if (uitbreidingen["communicatieniveau"] == null)
        ontbrekend.push("communicatieniveau");
      if (uitbreidingen["kennisniveau"] == null) ontbrekend.push("kennisniveau");
      if (uitbreidingen["informatievoorkeur"] == null)
        ontbrekend.push("informatievoorkeur");

      log.info(
        { clerkId, uitbreidingen: extensions.length, ontbrekend: ontbrekend.length },
        "foundation.athlete-model.build",
      );

      return {
        clerkId,
        doelen: {
          hoofddoel: profile?.goals ?? null,
          ontwikkeldoel: profile?.developmentGoal ?? null,
        },
        motivatie: profile?.motivation ?? null,
        ervaring: profile?.experienceLevel ?? null,
        leerstijl: (uitbreidingen["leerstijl"] as string | undefined) ?? null,
        trainingsgeschiedenis: {
          sessiesLaatste90d: snapshot.sessies.length,
          urenLaatste90d:
            snapshot.sessies.length > 0
              ? Math.round((urenLaatste90d / 60) * 10) / 10
              : null,
        },
        wedstrijdplanning: snapshot.wedstrijden,
        beschikbareUren: profile?.weeklyHourTarget ?? null,
        belastbaarheid: profile?.loadCapacity ?? null,
        voorkeuren: profile?.trainingPreferences ?? null,
        materiaal: (uitbreidingen["materiaal"] as string | undefined) ?? null,
        medischeBeperkingen: {
          gezondheidsstatus: profile?.healthStatus ?? "ok",
          blessurehistorie: profile?.injuryHistory ?? null,
        },
        privacy: { aiToestemming: user?.aiCoachingEnabled ?? null },
        communicatieniveau:
          (uitbreidingen["communicatieniveau"] as string | undefined) ?? null,
        kennisniveau: (uitbreidingen["kennisniveau"] as string | undefined) ?? null,
        informatievoorkeur:
          (uitbreidingen["informatievoorkeur"] as string | undefined) ?? null,
        uitbreidingen,
        ontbrekend,
      };
    },

    async setExtension(clerkId, key, value, source): Promise<void> {
      const cleanKey = key.trim();
      if (!cleanKey || cleanKey.length > 120) {
        throw new Error("Ongeldige modelsleutel");
      }
      await db
        .insert(athleteModelExtensionsTable)
        .values({ clerkId, key: cleanKey, value, source, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [
            athleteModelExtensionsTable.clerkId,
            athleteModelExtensionsTable.key,
          ],
          set: { value, source, updatedAt: new Date() },
        });
      log.info({ clerkId, key: cleanKey, source }, "foundation.athlete-model.setExtension");
    },
  };
}
