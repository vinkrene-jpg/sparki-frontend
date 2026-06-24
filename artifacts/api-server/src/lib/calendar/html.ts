// Small, dependency-free helpers for fetching and parsing the external calendar
// pages. We intentionally avoid adding an HTML parser: the source markup we rely
// on is regular and stable, and the parsers degrade to "no events" (an honest
// empty/failure state) rather than inventing data when a page changes shape.

const ALLOWED_HOSTS = new Set([
  "www.fietssport.nl",
  "fietssport.nl",
  "www.we-tri.nl",
  "we-tri.nl",
  "www.knwu.nl",
  "knwu.nl",
  "mijn.knwu.nl",
]);

/** SSRF guard: only ever fetch from the calendar sources we explicitly support. */
export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      ALLOWED_HOSTS.has(u.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  if (!isAllowedUrl(url)) throw new Error("url_not_allowed");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    // We follow redirects manually so every hop is re-validated against the
    // SSRF allowlist. With `redirect: "follow"`, an open redirect on an
    // otherwise-allowed host could send the request to an internal address;
    // `redirect: "manual"` lets us reject off-allowlist Location targets before
    // the next request leaves the box.
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        signal: ac.signal,
        redirect: "manual",
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; SparkiCalendar/1.0; +https://sparki.app)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "nl-NL,nl;q=0.9",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error(`http_${res.status}`);
        const next = new URL(location, current).toString();
        if (!isAllowedUrl(next)) throw new Error("url_not_allowed");
        current = next;
        continue;
      }
      if (!res.ok) throw new Error(`http_${res.status}`);
      return await res.text();
    }
    throw new Error("too_many_redirects");
  } finally {
    clearTimeout(timer);
  }
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&bull;/g, "•")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Strip tags + decode entities + collapse whitespace. */
export function clean(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

const NL_MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
  jan: 1, feb: 2, mrt: 3, maa: 3, apr: 4, jun: 6, jul: 7,
  aug: 8, sep: 9, sept: 9, okt: 10, nov: 11, dec: 12,
};

export function monthToNumber(name: string): number | null {
  return NL_MONTHS[name.toLowerCase().trim()] ?? null;
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Infer the calendar year for a day/month that has no explicit year (KNWU/
 * Fietssport list cards). Anything more than ~31 days in the past is assumed to
 * belong to next year, so a "January" entry seen in December resolves forward.
 */
export function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  const cutoff = new Date(now.getTime() - 31 * 86_400_000);
  return candidate < cutoff ? now.getFullYear() + 1 : now.getFullYear();
}

/** Parse "DD-MM-YYYY" → ISO, or null. */
export function isoFromDutchNumeric(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
}
