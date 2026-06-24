// KNWU — openbare wedstrijden. The full KNWU calendar and a member's personal
// inschrijvingen live inside the mijn.knwu.nl single-page app, which exposes no
// reachable data API or login endpoint (every path returns the same empty shell).
// The only KNWU event data on a server-rendered, readable page is the short
// "Komende wedstrijden" list on www.knwu.nl/kalender. We surface exactly that —
// honestly labelled as a preview — and never fabricate the rest.

import type { CalendarEvent } from "./types";
import { clean, fetchText, inferYear, isoDate, monthToNumber } from "./html";

const LIST_URL = "https://www.knwu.nl/kalender";

const ITEM_RE =
  /<li class="list-competitions__item">([\s\S]*?)<\/li>/g;

export async function fetchKnwu(): Promise<CalendarEvent[]> {
  const html = await fetchText(LIST_URL);
  const events: CalendarEvent[] = [];
  let item: RegExpExecArray | null;

  while ((item = ITEM_RE.exec(html)) !== null) {
    const block = item[1];

    const linkM = block.match(
      /href="(https:\/\/mijn\.knwu\.nl\/calendar\/events\/(\d+))"/,
    );
    if (!linkM) continue;
    const url = linkM[1];
    const id = linkM[2];

    const titleM = block.match(
      /<div class="list-competitions__item-title">([\s\S]*?)<\/div>/,
    );
    // Strip leading emoji/medal glyphs the source prepends to titles.
    const name = titleM
      ? clean(titleM[1]).replace(/^[^\p{L}\p{N}]+/u, "").trim()
      : null;
    if (!name) continue;

    const dateM = block.match(
      /<div class="list-competitions__item-date">\s*(\d{1,2})\s*<span>([A-Za-z]+)<\/span>/,
    );
    let date: string | null = null;
    if (dateM) {
      const day = Number(dateM[1]);
      const month = monthToNumber(dateM[2]);
      if (month) date = isoDate(inferYear(month, day), month, day);
    }

    const locM = block.match(/<strong>([\s\S]*?)<\/strong>/);
    const location = locM ? clean(locM[1]) : null;

    events.push({
      source: "knwu",
      externalId: id,
      name,
      date,
      dateLabel: null,
      location,
      discipline: "Wielrennen",
      raceType: null,
      distanceKm: null,
      url,
      gpxAvailable: false,
      needsDateLookup: false,
    });
  }

  return events;
}
