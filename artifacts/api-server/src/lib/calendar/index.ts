// Calendar source registry + dispatch. Each source is fetched + parsed on first
// use and cached in memory for a short window so browsing the importer doesn't
// hammer the external sites. Failures propagate to the route, which turns them
// into an honest "kon de kalender niet ophalen" state — never fabricated events.

import type {
  CalendarEvent,
  CalendarEventDetail,
  CalendarSearchResult,
  CalendarSourceId,
  CalendarSourceInfo,
} from "./types";
import { fetchFietssport, resolveFietssportEvent } from "./fietssport";
import { fetchWetri } from "./wetri";
import { fetchKnwu } from "./knwu";

export const CALENDAR_SOURCES: CalendarSourceInfo[] = [
  {
    id: "fietssport",
    label: "Fietssport-toertochten",
    description: "Toertochten voor racefiets, MTB en gravel (NTFU).",
    sportTypes: ["cycling", "toer", "racefiets", "mtb", "gravel", "recreatief"],
    status: "ok",
    note: null,
  },
  {
    id: "wetri",
    label: "We-Tri",
    description:
      "Triatlon, duatlon, aquatlon en run & bike in Nederland en België.",
    sportTypes: ["triathlon", "triatlon", "duathlon", "duatlon", "aquathlon"],
    status: "ok",
    note: null,
  },
  {
    id: "knwu",
    label: "KNWU (openbaar)",
    description: "De eerstvolgende KNWU-wedstrijden van de openbare site.",
    sportTypes: ["cycling", "weg", "veld", "baan", "mtb", "wielrennen"],
    status: "limited",
    note: "De openbare KNWU-site toont alleen de eerstvolgende wedstrijden. Je volledige wedstrijdkalender en je eigen inschrijvingen vind je in MijnKNWU.",
  },
];

const FETCHERS: Record<CalendarSourceId, () => Promise<CalendarEvent[]>> = {
  fietssport: fetchFietssport,
  wetri: fetchWetri,
  knwu: fetchKnwu,
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<CalendarSourceId, { at: number; events: CalendarEvent[] }>();

async function getEvents(source: CalendarSourceId): Promise<CalendarEvent[]> {
  const cached = cache.get(source);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.events;
  const events = await FETCHERS[source]();
  cache.set(source, { at: Date.now(), events });
  return events;
}

export interface CalendarSearchOptions {
  q?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export function sourceInfo(source: CalendarSourceId): CalendarSourceInfo {
  return CALENDAR_SOURCES.find((s) => s.id === source)!;
}

/** Fetch (cached) + filter. Throws if the source can't be read — route handles. */
export async function searchCalendar(
  source: CalendarSourceId,
  opts: CalendarSearchOptions,
): Promise<CalendarSearchResult> {
  const info = sourceInfo(source);
  let events = await getEvents(source);

  if (opts.q) {
    const q = opts.q.toLowerCase();
    events = events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.location ?? "").toLowerCase().includes(q),
    );
  }
  if (opts.type) {
    const t = opts.type.toLowerCase();
    events = events.filter(
      (e) =>
        (e.raceType ?? "").toLowerCase().includes(t) ||
        (e.discipline ?? "").toLowerCase().includes(t),
    );
  }
  if (opts.from) events = events.filter((e) => !e.date || e.date >= opts.from!);
  if (opts.to) events = events.filter((e) => !e.date || e.date <= opts.to!);

  const limit = Math.min(Math.max(opts.limit ?? 80, 1), 200);

  return {
    source,
    status: info.status,
    note: info.note,
    events: events.slice(0, limit),
    fetchedAt: new Date().toISOString(),
    error: null,
  };
}

export async function resolveEvent(
  source: CalendarSourceId,
  url: string,
): Promise<CalendarEventDetail> {
  if (source === "fietssport") return resolveFietssportEvent(url);
  return { date: null, gpxAvailable: false, location: null };
}
