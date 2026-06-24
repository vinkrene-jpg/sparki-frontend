// Fietssport (NTFU) toertochten — fietssport.nl/toertochten.
// The list page is fully server-rendered: events grouped under <h3 class="h1">
// month headers, each card an <a href="/toertochten/{id}/{slug}"> with title,
// "Plaats • Type" and one or more distances. The exact date is not reliably on
// the card (it shows relative labels like "Morgen"), so it is resolved on demand
// from the detail page <title> via resolveFietssportEvent().

import type { CalendarEvent, CalendarEventDetail } from "./types";
import {
  clean,
  fetchText,
  inferYear,
  isoDate,
  monthToNumber,
} from "./html";

const LIST_URL = "https://www.fietssport.nl/toertochten";

// Matches either a month header OR a full event card, in document order, so we
// can attach the current month group to each card we encounter.
const TOKEN_RE =
  /<h3 class="h1[^"]*">\s*([A-Za-z]+)\s*<\/h3>|<a href="(\/toertochten\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/article>/g;

function mapDiscipline(typeLabel: string | null): string | null {
  if (!typeLabel) return null;
  const t = typeLabel.toLowerCase();
  if (t.includes("mountainbike") || t.includes("mtb")) return "MTB";
  if (t.includes("gravel")) return "Gravel";
  if (t.includes("race")) return "Racefiets";
  if (t.includes("recreatief")) return "Toertocht";
  return typeLabel;
}

export async function fetchFietssport(): Promise<CalendarEvent[]> {
  const html = await fetchText(LIST_URL);
  const events: CalendarEvent[] = [];
  let currentMonth: number | null = null;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(html)) !== null) {
    const monthHeader = match[1];
    if (monthHeader) {
      currentMonth = monthToNumber(monthHeader);
      continue;
    }

    const href = match[2];
    const id = match[3];
    const inner = match[4] ?? "";

    const nameM = inner.match(/<h4 class="tour-card-title">([\s\S]*?)<\/h4>/);
    const name = nameM ? clean(nameM[1]) : null;
    if (!name) continue;

    const locTypeM = inner.match(/<p class="d-block mb-0">([\s\S]*?)<\/p>/);
    let location: string | null = null;
    let typeLabel: string | null = null;
    if (locTypeM) {
      const parts = clean(locTypeM[1]).split("•").map((p) => p.trim());
      location = parts[0] || null;
      typeLabel = parts[1] || null;
    }

    const distances = [...inner.matchAll(/data-afstand="(\d+)"/g)].map((m) =>
      Number(m[1]),
    );
    const distanceKm = distances.length ? Math.max(...distances) : null;

    const dayLabelM = inner.match(/<h5 class="mb-1[^"]*">([\s\S]*?)<\/h5>/);
    const dayLabel = dayLabelM ? clean(dayLabelM[1]) : null;

    // If the card shows a bare day number and we know the month group, we can
    // build an approximate date; otherwise keep the label and resolve on select.
    let date: string | null = null;
    if (currentMonth && dayLabel && /^\d{1,2}$/.test(dayLabel)) {
      const day = Number(dayLabel);
      date = isoDate(inferYear(currentMonth, day), currentMonth, day);
    }

    events.push({
      source: "fietssport",
      externalId: id,
      name,
      date,
      dateLabel: date ? null : dayLabel,
      location,
      discipline: mapDiscipline(typeLabel),
      raceType: typeLabel,
      distanceKm,
      url: `https://www.fietssport.nl${href}`,
      gpxAvailable: false,
      needsDateLookup: date === null,
    });
  }

  return events;
}

/** Resolve exact date + GPX availability from an event's detail page. */
export async function resolveFietssportEvent(
  url: string,
): Promise<CalendarEventDetail> {
  const html = await fetchText(url);
  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  let date: string | null = null;
  if (titleM) {
    const dm = clean(titleM[1]).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (dm) {
      const month = monthToNumber(dm[2]);
      if (month) date = isoDate(Number(dm[3]), month, Number(dm[1]));
    }
  }
  return {
    date,
    gpxAvailable: /gpx/i.test(html),
    location: null,
  };
}
