// Dependency-free HTTP helpers for the Klimmenverkenner (climb explorer).
// Every external fetch goes through a strict SSRF host-allowlist and re-checks
// each redirect hop, exactly like the calendar importer. The sources are all
// public, key-less, ODbL/CC data:
//   - OpenStreetMap Overpass API — the catalogue of named cols/passes/peaks.
//   - Wikipedia REST + Wikidata EntityData — real descriptions where they exist.
// Nothing here fabricates data: on a failed/blocked fetch we throw an honest
// error the callers turn into a plain-Dutch "bron onbereikbaar" state.

const ALLOWED_HOSTS = new Set([
  "overpass-api.de",
  "overpass.kumi.systems",
  "www.wikidata.org",
  "nominatim.openstreetmap.org",
]);

// Wikipedia has one host per language (nl.wikipedia.org, en.wikipedia.org, …).
// We allow any *.wikipedia.org host rather than enumerating every language.
function isWikipediaHost(host: string): boolean {
  return host === "wikipedia.org" || host.endsWith(".wikipedia.org");
}

/** SSRF guard: only ever fetch from the climb sources we explicitly support. */
export function isAllowedClimbUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.has(host) || isWikipediaHost(host);
  } catch {
    return false;
  }
}

const UA =
  "Mozilla/5.0 (compatible; SparkiKlimmen/1.0; +https://sparki.app)";

async function fetchAllowed(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  if (!isAllowedClimbUrl(url)) throw new Error("url_not_allowed");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        ...init,
        signal: ac.signal,
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error(`http_${res.status}`);
        const next = new URL(location, current).toString();
        if (!isAllowedClimbUrl(next)) throw new Error("url_not_allowed");
        current = next;
        continue;
      }
      if (!res.ok) throw new Error(`http_${res.status}`);
      return res;
    }
    throw new Error("too_many_redirects");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  timeoutMs = 15000,
): Promise<T> {
  const res = await fetchAllowed(
    url,
    { headers: { "user-agent": UA, accept: "application/json" } },
    timeoutMs,
  );
  return (await res.json()) as T;
}

export async function postForm<T = unknown>(
  url: string,
  body: string,
  timeoutMs = 30000,
): Promise<T> {
  const res = await fetchAllowed(
    url,
    {
      method: "POST",
      headers: {
        "user-agent": UA,
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
    timeoutMs,
  );
  return (await res.json()) as T;
}
