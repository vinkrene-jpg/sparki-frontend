// Journey — de persoonlijke wieler-tijdlijn en het wedstrijddossier.
//
// De Journey is een SAMENGESTELDE weergave: alle gebeurtenissen komen live uit
// bestaande tabellen (races, training_sessions, goal_events, garage_components,
// journey_items). Er wordt niets gedupliceerd of verzonnen: een gebeurtenis
// bestaat alleen als de bronrij bestaat. Persoonlijke records worden
// deterministisch afgeleid uit de opgeslagen power bests per sessie en
// verschijnen precies één keer (de vroegste sessie die het all-time record
// zette).

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  racesTable,
  trainingSessionsTable,
  athleteGoalsTable,
  goalEventsTable,
  garageComponentsTable,
  garageBikesTable,
  journeyItemsTable,
  journeyMediaTable,
  journeyReflectionsTable,
  raceRoomsTable,
  raceRoomItemsTable,
  type Race,
  type JourneyMedia,
  type JourneyReflection,
} from "@workspace/db";

export type JourneyEventKind =
  | "wedstrijd"
  | "training"
  | "trainingskamp"
  | "record"
  | "doel_behaald"
  | "blessure_herstel"
  | "materiaalwissel"
  | "mijlpaal";

export type JourneyEvent = {
  // Stabiele sleutel "<kind>:<bron-id>" — dedupe + React keys.
  key: string;
  kind: JourneyEventKind;
  date: string; // YYYY-MM-DD
  endDate?: string | null;
  title: string;
  subtitle?: string | null;
  // Verwijzing naar de bron zodat de frontend kan doorklikken zonder dubbele
  // content: wedstrijd → dossier, training → bestaande activiteitenweergave.
  ref: { type: "race" | "session" | "goal" | "component" | "item"; id: number };
  // Kleine, eerlijke feiten uit de bronrij (nooit berekend-op-verzoek).
  facts?: Record<string, string | number | null>;
};

const PR_WINDOW_LABELS: Record<string, string> = {
  "5": "5 seconden",
  "10": "10 seconden",
  "20": "20 seconden",
  "60": "1 minuut",
  "300": "5 minuten",
  "1200": "20 minuten",
};

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Persoonlijke records: per venster de all-time beste waarde en de EERSTE
// sessie die dat record zette — zo verschijnt één record precies één keer.
export function derivePersonalRecords(
  sessions: {
    id: number;
    sessionDate: string;
    powerBests: Record<string, number> | null;
  }[],
): JourneyEvent[] {
  const best: Record<string, { watts: number; sessionId: number; date: string }> = {};
  const ordered = [...sessions].sort((a, b) =>
    a.sessionDate < b.sessionDate ? -1 : a.sessionDate > b.sessionDate ? 1 : a.id - b.id,
  );
  for (const s of ordered) {
    if (!s.powerBests) continue;
    for (const [win, watts] of Object.entries(s.powerBests)) {
      if (!Number.isFinite(watts) || watts <= 0) continue;
      const cur = best[win];
      if (!cur || watts > cur.watts) {
        best[win] = { watts, sessionId: s.id, date: s.sessionDate };
      }
    }
  }
  return Object.entries(best).map(([win, b]) => ({
    key: `record:${win}:${b.sessionId}`,
    kind: "record" as const,
    date: b.date,
    title: `Persoonlijk record — beste ${PR_WINDOW_LABELS[win] ?? `${win} s`}`,
    subtitle: `${b.watts} watt`,
    ref: { type: "session" as const, id: b.sessionId },
    facts: { watt: b.watts },
  }));
}

export type JourneyTimeline = {
  events: JourneyEvent[];
  total: number;
};

export async function composeJourney(
  clerkId: string,
  opts: { limit?: number; kinds?: JourneyEventKind[] } = {},
): Promise<JourneyTimeline> {
  const limit = Math.min(Math.max(opts.limit ?? 80, 1), 300);

  const [races, sessions, achievedEvents, components, items] =
    await Promise.all([
      db
        .select()
        .from(racesTable)
        .where(eq(racesTable.clerkId, clerkId))
        .orderBy(desc(racesTable.raceDate)),
      db
        .select({
          id: trainingSessionsTable.id,
          sessionDate: trainingSessionsTable.sessionDate,
          title: trainingSessionsTable.title,
          type: trainingSessionsTable.type,
          durationMin: trainingSessionsTable.durationMin,
          distanceKm: trainingSessionsTable.distanceKm,
          tss: trainingSessionsTable.tss,
          powerBests: trainingSessionsTable.powerBests,
        })
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, clerkId))
        .orderBy(desc(trainingSessionsTable.sessionDate)),
      db
        .select({
          id: goalEventsTable.id,
          goalId: goalEventsTable.goalId,
          createdAt: goalEventsTable.createdAt,
          note: goalEventsTable.note,
          title: athleteGoalsTable.title,
        })
        .from(goalEventsTable)
        .innerJoin(
          athleteGoalsTable,
          eq(goalEventsTable.goalId, athleteGoalsTable.id),
        )
        .where(
          and(
            eq(goalEventsTable.clerkId, clerkId),
            eq(goalEventsTable.eventType, "achieved"),
          ),
        ),
      db
        .select({
          id: garageComponentsTable.id,
          category: garageComponentsTable.category,
          brand: garageComponentsTable.brand,
          model: garageComponentsTable.model,
          createdAt: garageComponentsTable.createdAt,
          bikeName: garageBikesTable.name,
        })
        .from(garageComponentsTable)
        .leftJoin(
          garageBikesTable,
          eq(garageComponentsTable.bikeId, garageBikesTable.id),
        )
        .where(eq(garageComponentsTable.clerkId, clerkId)),
      db
        .select()
        .from(journeyItemsTable)
        .where(eq(journeyItemsTable.clerkId, clerkId)),
    ]);

  const events: JourneyEvent[] = [];

  for (const r of races) {
    const result = r.result ?? null;
    const geannuleerd = r.status === "geannuleerd";
    events.push({
      key: `wedstrijd:${r.id}`,
      kind: "wedstrijd",
      date: fmtDate(r.raceDate),
      title: r.name,
      // Geannuleerde wedstrijden blijven zichtbaar in de tijdlijn (eerlijk
      // gemarkeerd) maar dragen geen uitslag en tellen nergens als prestatie.
      subtitle: geannuleerd
        ? ["Geannuleerd", r.location].filter(Boolean).join(" · ")
        : [r.location, r.discipline].filter(Boolean).join(" · ") || null,
      ref: { type: "race", id: r.id },
      facts: {
        prioriteit: r.priority,
        uitslag: geannuleerd
          ? null
          : result?.position != null
            ? `${result.position}e${result.fieldSize ? ` van ${result.fieldSize}` : ""}`
            : result?.status === "dnf"
              ? "niet gefinisht"
              : null,
      },
    });
  }

  // Trainingen: alléén sessies die niet al als wedstrijd-activiteit gelden
  // (een sessie op een wedstrijddag hoort bij het dossier, niet dubbel los).
  const raceDates = new Set(races.map((r) => fmtDate(r.raceDate)));
  for (const s of sessions) {
    if (raceDates.has(fmtDate(s.sessionDate))) continue;
    events.push({
      key: `training:${s.id}`,
      kind: "training",
      date: fmtDate(s.sessionDate),
      title: s.title || "Training",
      subtitle:
        [
          s.durationMin ? `${s.durationMin} min` : null,
          s.distanceKm ? `${Number(s.distanceKm).toFixed(0)} km` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      ref: { type: "session", id: s.id },
      facts: { belastingsscore: s.tss ?? null },
    });
  }

  events.push(...derivePersonalRecords(sessions));

  for (const g of achievedEvents) {
    events.push({
      key: `doel_behaald:${g.id}`,
      kind: "doel_behaald",
      date: fmtDate(g.createdAt),
      title: `Doel behaald — ${g.title}`,
      subtitle: g.note ?? null,
      ref: { type: "goal", id: g.goalId },
    });
  }

  for (const c of components) {
    const what = [c.brand, c.model].filter(Boolean).join(" ") || c.category;
    events.push({
      key: `materiaalwissel:${c.id}`,
      kind: "materiaalwissel",
      date: fmtDate(c.createdAt),
      title: `Materiaal — ${what}`,
      subtitle: c.bikeName ? `Op ${c.bikeName}` : null,
      ref: { type: "component", id: c.id },
    });
  }

  for (const it of items) {
    events.push({
      key: `${it.kind}:${it.id}`,
      kind: it.kind,
      date: fmtDate(it.startDate),
      endDate: it.endDate ? fmtDate(it.endDate) : null,
      title: it.title,
      subtitle: it.description ?? null,
      ref: { type: "item", id: it.id },
    });
  }

  const filtered = opts.kinds?.length
    ? events.filter((e) => opts.kinds!.includes(e.kind))
    : events;

  filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { events: filtered.slice(0, limit), total: filtered.length };
}

// ── Wedstrijddossier ─────────────────────────────────────────────────────────

export type LinkedActivity = {
  mode: "auto" | "manual" | "none";
  session: {
    id: number;
    sessionDate: string;
    title: string | null;
    durationMin: number | null;
    distanceKm: number | null;
    avgPower: number | null;
    normalizedPower: number | null;
    avgHR: number | null;
    tss: number | null;
    powerBests: Record<string, number> | null;
  } | null;
  // Eerlijk: true wanneer een handmatig gekoppelde activiteit inmiddels is
  // verwijderd — het dossier blijft bestaan, de koppeling wordt benoemd.
  removed: boolean;
};

// Bepaal de gekoppelde activiteit voor een wedstrijd, met correctie-voorrang:
// manual > none > auto (beste match op wedstrijddatum: langste sessie).
export async function resolveLinkedActivity(
  race: Race,
  reflection: JourneyReflection | null,
): Promise<LinkedActivity> {
  const pick = (s: typeof trainingSessionsTable.$inferSelect) => ({
    id: s.id,
    sessionDate: fmtDate(s.sessionDate),
    title: s.title,
    durationMin: s.durationMin,
    distanceKm: s.distanceKm != null ? Number(s.distanceKm) : null,
    avgPower: s.avgPower,
    normalizedPower: s.normalizedPower,
    avgHR: s.avgHR,
    tss: s.tss,
    powerBests: s.powerBests,
  });

  if (reflection?.linkMode === "none") {
    return { mode: "none", session: null, removed: false };
  }
  if (reflection?.linkMode === "manual" && reflection.linkedSessionId != null) {
    const [s] = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.id, reflection.linkedSessionId),
          eq(trainingSessionsTable.clerkId, race.clerkId),
        ),
      )
      .limit(1);
    return { mode: "manual", session: s ? pick(s) : null, removed: !s };
  }
  const candidates = await db
    .select()
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, race.clerkId),
        eq(trainingSessionsTable.sessionDate, race.raceDate),
      ),
    );
  const bestMatch = candidates.sort(
    (a, b) => (b.durationMin ?? 0) - (a.durationMin ?? 0),
  )[0];
  return { mode: "auto", session: bestMatch ? pick(bestMatch) : null, removed: false };
}

export type RaceDossierMedia = {
  own: JourneyMedia[];
  // Alleen-lezen hergebruik van bestaande Wedstrijd-room media (geen kopie).
  room: { id: number; dayIndex: number; objectPath: string | null; mediaType: string | null; caption: string | null }[];
};

export async function collectRaceMedia(
  clerkId: string,
  raceId: number,
): Promise<RaceDossierMedia> {
  const own = await db
    .select()
    .from(journeyMediaTable)
    .where(
      and(
        eq(journeyMediaTable.clerkId, clerkId),
        eq(journeyMediaTable.subjectType, "race"),
        eq(journeyMediaTable.subjectId, raceId),
      ),
    )
    .orderBy(journeyMediaTable.sortIndex, journeyMediaTable.id);

  const rooms = await db
    .select({ id: raceRoomsTable.id })
    .from(raceRoomsTable)
    .where(
      and(eq(raceRoomsTable.clerkId, clerkId), eq(raceRoomsTable.raceId, raceId)),
    );
  const room =
    rooms.length === 0
      ? []
      : await db
          .select({
            id: raceRoomItemsTable.id,
            dayIndex: raceRoomItemsTable.dayIndex,
            objectPath: raceRoomItemsTable.objectPath,
            mediaType: raceRoomItemsTable.mediaType,
            caption: raceRoomItemsTable.caption,
          })
          .from(raceRoomItemsTable)
          .where(
            and(
              eq(raceRoomItemsTable.clerkId, clerkId),
              inArray(
                raceRoomItemsTable.roomId,
                rooms.map((r) => r.id),
              ),
              eq(raceRoomItemsTable.kind, "media"),
            ),
          );
  return { own, room };
}

// ── Deelkaart ────────────────────────────────────────────────────────────────
// Uitsluitend door de gebruiker geselecteerde velden en media. Server-side
// whitelist: een veld dat niet in SHARE_CARD_FIELDS staat komt er nooit in.

export const SHARE_CARD_FIELDS = [
  "naam",
  "datum",
  "locatie",
  "discipline",
  "afstand",
  "uitslag",
  "terugblik",
  "les",
] as const;
export type ShareCardField = (typeof SHARE_CARD_FIELDS)[number];

export function buildShareCard(
  race: Race,
  reflection: JourneyReflection | null,
  selectedFields: ShareCardField[],
  selectedMedia: JourneyMedia[],
): { fields: Partial<Record<ShareCardField, string>>; media: { id: number; objectPath: string; mediaType: string; caption: string | null }[] } {
  const all: Record<ShareCardField, string | null> = {
    naam: race.name,
    datum: fmtDate(race.raceDate),
    locatie: race.location,
    discipline: race.discipline,
    afstand: race.distanceKm != null ? `${Number(race.distanceKm)} km` : null,
    uitslag:
      race.result?.position != null
        ? `${race.result.position}e${race.result.fieldSize ? ` van ${race.result.fieldSize}` : ""}`
        : null,
    terugblik: reflection?.reflection ?? null,
    les: reflection?.lesson ?? null,
  };
  const fields: Partial<Record<ShareCardField, string>> = {};
  for (const f of selectedFields) {
    if (!SHARE_CARD_FIELDS.includes(f)) continue;
    const v = all[f];
    if (v != null && v !== "") fields[f] = v;
  }
  return {
    fields,
    media: selectedMedia.map((m) => ({
      id: m.id,
      objectPath: m.objectPath,
      mediaType: m.mediaType,
      caption: m.caption,
    })),
  };
}
