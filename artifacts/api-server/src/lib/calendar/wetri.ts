// We-Tri — we-tri.nl/competition. Aggregated triathlon/duathlon/aquathlon/run&bike
// calendar for NL & BE. The page is server-rendered as a table; each <tr> in the
// <tbody> carries a date (DD-MM-YYYY), a name+detail link, a type and a location.

import type { CalendarEvent } from "./types";
import { clean, fetchText, isoFromDutchNumeric } from "./html";

const LIST_URL = "https://www.we-tri.nl/competition";

const ROW_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/g;

function mapDiscipline(typeLabel: string | null): string | null {
  if (!typeLabel) return null;
  const t = typeLabel.toLowerCase();
  if (t.includes("triathlon")) return "Triatlon";
  if (t.includes("duathlon")) return "Duatlon";
  if (t.includes("aquathlon")) return "Aquatlon";
  if (t.includes("run") && t.includes("bike")) return "Run & Bike";
  if (t.includes("hardloop")) return "Hardlopen";
  if (t.includes("wieler")) return "Wielrennen";
  return typeLabel;
}

export async function fetchWetri(): Promise<CalendarEvent[]> {
  const html = await fetchText(LIST_URL);
  const bodyStart = html.indexOf("<tbody");
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html;

  const events: CalendarEvent[] = [];
  let row: RegExpExecArray | null;

  while ((row = ROW_RE.exec(body)) !== null) {
    const cells = row[1];

    const dateM = cells.match(/<td class="p-4">\s*(\d{2}-\d{2}-\d{4})\s*<\/td>/);
    const date = dateM ? isoFromDutchNumeric(dateM[1]) : null;
    if (!date) continue; // header / non-event rows

    const linkM = cells.match(
      /href="(https:\/\/www\.we-tri\.nl\/competition\/(\d+)\/[^"]*\/details)"[^>]*>([\s\S]*?)<\/a>/,
    );
    if (!linkM) continue;
    const url = linkM[1];
    const id = linkM[2];
    const name = clean(linkM[3]);
    if (!name) continue;

    const hiddenCells = [
      ...cells.matchAll(
        /<td class="p-4 hidden md:table-cell">([\s\S]*?)<\/td>/g,
      ),
    ].map((m) => clean(m[1]));
    const typeLabel = hiddenCells[0] || null;
    const location = hiddenCells[1] || null;

    events.push({
      source: "wetri",
      externalId: id,
      name,
      date,
      dateLabel: null,
      location,
      discipline: mapDiscipline(typeLabel),
      raceType: typeLabel,
      distanceKm: null,
      url,
      gpxAvailable: false,
      needsDateLookup: false,
    });
  }

  return events;
}
