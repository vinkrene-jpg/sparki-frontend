// Description enrichment for the Klimmenverkenner. A real description only comes
// from real sources — never fabricated:
//   1. OSM `description` tag (already localised text on the object).
//   2. Wikipedia REST summary extract (via the `wikipedia` tag, "lang:Title").
//   3. Wikidata description (short one-liner via the `wikidata` tag).
// When none exists we return null so the UI can honestly say "geen omschrijving
// beschikbaar".

import { fetchJson } from "./http";

export type ClimbDescription = {
  text: string;
  source: "osm" | "wikipedia" | "wikidata";
  sourceUrl: string | null;
} | null;

type WikiSummary = {
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};

type WikidataEntity = {
  entities?: Record<
    string,
    { descriptions?: Record<string, { value?: string }> }
  >;
};

async function fromWikipedia(tag: string): Promise<ClimbDescription> {
  // Tag form is "lang:Article Title".
  const idx = tag.indexOf(":");
  if (idx < 0) return null;
  const lang = tag.slice(0, idx).trim().toLowerCase();
  const title = tag.slice(idx + 1).trim();
  if (!lang || !title || !/^[a-z]{2,3}$/.test(lang)) return null;
  const url =
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
    encodeURIComponent(title.replace(/ /g, "_"));
  try {
    const data = await fetchJson<WikiSummary>(url, 10000);
    const extract = data.extract?.trim();
    if (!extract) return null;
    return {
      text: extract,
      source: "wikipedia",
      sourceUrl: data.content_urls?.desktop?.page ?? null,
    };
  } catch {
    return null;
  }
}

async function fromWikidata(id: string): Promise<ClimbDescription> {
  const qid = id.trim().toUpperCase();
  if (!/^Q\d+$/.test(qid)) return null;
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  try {
    const data = await fetchJson<WikidataEntity>(url, 10000);
    const entity = data.entities?.[qid];
    const desc =
      entity?.descriptions?.nl?.value ?? entity?.descriptions?.en?.value;
    const text = desc?.trim();
    if (!text) return null;
    return {
      text,
      source: "wikidata",
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    };
  } catch {
    return null;
  }
}

export async function enrichDescription(
  tags: Record<string, string>,
): Promise<ClimbDescription> {
  const osm = tags.description?.trim();
  if (osm) {
    return { text: osm, source: "osm", sourceUrl: null };
  }
  if (tags.wikipedia) {
    const wp = await fromWikipedia(tags.wikipedia);
    if (wp) return wp;
  }
  if (tags.wikidata) {
    const wd = await fromWikidata(tags.wikidata);
    if (wd) return wd;
  }
  return null;
}
