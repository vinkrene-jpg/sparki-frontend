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
  pulse: boolean;
  // Golf 24: kanalen, stille uren en categorieën.
  channelPush: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
  quietHoursStart: string | null; // "HH:MM" lokale tijd (Europe/Amsterdam)
  quietHoursEnd: string | null;
  catCoach: boolean;
  catClub: boolean;
  catSocial: boolean;
  catMaterial: boolean;
  catSync: boolean;
};

export const DEFAULT_PREFS: EffectivePrefs = {
  enabled: true,
  checkins: true,
  followups: true,
  training: true,
  races: true,
  profile: true,
  pulse: true,
  channelPush: true,
  channelInApp: true,
  channelEmail: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  catCoach: true,
  catClub: true,
  catSocial: true,
  catMaterial: true,
  catSync: true,
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
    pulse: row.pulse,
    channelPush: row.channelPush,
    channelInApp: row.channelInApp,
    channelEmail: row.channelEmail,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    catCoach: row.catCoach,
    catClub: row.catClub,
    catSocial: row.catSocial,
    catMaterial: row.catMaterial,
    catSync: row.catSync,
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

// ── Golf 24: categorieën, kanalen en stille uren ─────────────────────────────

// Categorie-schakelaars. Kritieke categorieën (privacy/veiligheid) zijn hier
// bewust ALTIJD aan — die kunnen nooit volledig worden uitgeschakeld.
export function allowsCategory(
  prefs: EffectivePrefs,
  category: string,
): boolean {
  switch (category) {
    case "privacy":
    case "veiligheid":
      return true; // kritiek — nooit uitschakelbaar
    case "coach":
      return prefs.catCoach;
    case "club":
      return prefs.catClub;
    case "sociaal":
      return prefs.catSocial;
    case "materiaal":
      return prefs.catMaterial;
    case "sync":
      return prefs.catSync;
    default:
      return true; // training/wedstrijd/herstel/ouder/systeem via per-type flags
  }
}

// Local minutes-of-day in Europe/Amsterdam for a moment in time.
function amsMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function parseHHMM(v: string | null): number | null {
  if (!v) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Stille uren: binnen het venster gaan push en e-mail niet uit (de in-app rij
// blijft gewoon bestaan). Een venster over middernacht ("22:00"–"07:00") werkt.
// Kritieke categorieën passeren de stille uren — check dat vóór deze functie.
export function inQuietHours(prefs: EffectivePrefs, now: Date): boolean {
  const start = parseHHMM(prefs.quietHoursStart);
  const end = parseHHMM(prefs.quietHoursEnd);
  if (start == null || end == null || start === end) return false;
  const cur = amsMinutes(now);
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // venster over middernacht
}

// Mag dit kanaal nu uit voor deze categorie? Eén centrale beslissing voor het
// afleverpad: kanaal-schakelaar + stille uren, met de kritiek-uitzondering.
export function channelAllowed(
  prefs: EffectivePrefs,
  channel: "push" | "email",
  category: string,
  now: Date,
): boolean {
  const critical = category === "privacy" || category === "veiligheid";
  const channelOn = channel === "push" ? prefs.channelPush : prefs.channelEmail;
  if (critical) {
    // Terughoudend maar nooit onbereikbaar: kritiek respecteert de
    // kanaal-schakelaar niet volledig — push blijft, e-mail volgt de schakelaar.
    if (channel === "push") return true;
    return channelOn;
  }
  if (!channelOn) return false;
  return !inQuietHours(prefs, now);
}
