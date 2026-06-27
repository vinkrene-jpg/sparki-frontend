// Reminder preferences — read/write helpers with safe defaults.
//
// A missing row means "all on" (an athlete who never opened the settings still
// gets the helpful reminders), but the master `enabled` switch and the per-type
// flags let them turn any of it off. The delivery job consults `effectivePrefs`
// for every athlete before sending anything.

import { eq } from "drizzle-orm";
import {
  db,
  reminderPreferencesTable,
  type ReminderPreferences,
  type ReminderKind,
} from "@workspace/db";

export type EffectivePrefs = {
  enabled: boolean;
  checkins: boolean;
  followups: boolean;
  training: boolean;
  races: boolean;
  profile: boolean;
};

export const DEFAULT_PREFS: EffectivePrefs = {
  enabled: true,
  checkins: true,
  followups: true,
  training: true,
  races: true,
  profile: true,
};

function toEffective(row: ReminderPreferences | undefined): EffectivePrefs {
  if (!row) return { ...DEFAULT_PREFS };
  return {
    enabled: row.enabled,
    checkins: row.checkins,
    followups: row.followups,
    training: row.training,
    races: row.races,
    profile: row.profile,
  };
}

export async function getPrefs(clerkId: string): Promise<EffectivePrefs> {
  const [row] = await db
    .select()
    .from(reminderPreferencesTable)
    .where(eq(reminderPreferencesTable.clerkId, clerkId))
    .limit(1);
  return toEffective(row);
}

export type PrefsPatch = Partial<EffectivePrefs>;

export async function updatePrefs(
  clerkId: string,
  patch: PrefsPatch,
): Promise<EffectivePrefs> {
  const current = await getPrefs(clerkId);
  const next: EffectivePrefs = { ...current, ...patch };
  await db
    .insert(reminderPreferencesTable)
    .values({ clerkId, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: reminderPreferencesTable.clerkId,
      set: { ...next, updatedAt: new Date() },
    });
  return next;
}

// Whether a given reminder kind is allowed for these prefs (master AND per-type).
export function allows(prefs: EffectivePrefs, kind: ReminderKind): boolean {
  return prefs.enabled && prefs[kind];
}
