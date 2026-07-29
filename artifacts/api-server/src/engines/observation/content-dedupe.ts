// Inhoudelijke (strekking-)deduplicatie van observaties op de AANMAAKKANT.
//
// De presentatiekant heeft al `dedupeObservationsByText` (web, insight-grouping);
// dit is de server-side spiegel daarvan zodat de observation-engine dezelfde
// strekking niet telkens opnieuw als nieuwe rij opslaat. De heuristiek is
// bewust identiek: woord-overlap (overlap-coëfficiënt ≥ 0.6) OF ≥2 gedeelde
// getallen met overlap ≥ 0.6 — paraphrases van hetzelfde feit delen vaak weinig
// proza maar citeren dezelfde cijfers (bijv. 258W/331W).

const STOPWORDS = new Set([
  "de", "het", "een", "en", "van", "je", "jij", "jouw", "jou", "is", "zijn",
  "was", "dat", "die", "dit", "deze", "in", "op", "te", "met", "voor", "naar",
  "bij", "aan", "als", "dan", "ook", "nog", "niet", "wel", "er", "om", "uit",
  "over", "maar", "of", "dus", "per", "tot", "door", "wordt", "worden", "werd",
  "heeft", "hebben", "had", "kan", "kunnen", "zou", "meer", "minder", "the",
  "and", "your", "you",
]);

export type ContentSignature = {
  words: Set<string>;
  nums: Set<string>;
};

export function significantTokens(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u017f]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

export function significantNumbers(text: string): Set<string> {
  const out = new Set<string>();
  const re = /\d+(?:[.,]\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || "")) !== null) out.add(m[0].replace(",", "."));
  return out;
}

export function contentSignature(text: string): ContentSignature {
  return { words: significantTokens(text), nums: significantNumbers(text) };
}

export function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

export function isNearDuplicateContent(
  a: ContentSignature,
  b: ContentSignature,
  wordThreshold = 0.6,
): boolean {
  if (
    a.words.size > 0 &&
    b.words.size > 0 &&
    overlapCoefficient(a.words, b.words) >= wordThreshold
  ) {
    return true;
  }
  if (
    a.nums.size >= 2 &&
    b.nums.size >= 2 &&
    overlapCoefficient(a.nums, b.nums) >= 0.6
  ) {
    return true;
  }
  return false;
}

// Volledige inhoud van een observatie als één vergelijkbare tekst.
export function observationContentText(o: {
  title: string;
  summary?: string | null;
  observationText: string;
}): string {
  return [o.title, o.summary ?? "", o.observationText]
    .filter(Boolean)
    .join(" ");
}

// Citeert deze tekst een van de gegeven wattages als vermogenswaarde?
// Matcht "331W", "331 W", "331 watt", "331watt" — niet losse getallen zonder
// watt-eenheid, zodat een toevallig gelijk getal (bijv. 331 kcal) niet raakt.
export function citesWattValue(text: string, watts: number[]): boolean {
  if (!text || watts.length === 0) return false;
  for (const w of watts) {
    const re = new RegExp(`\\b${w}\\s*(?:w\\b|watt)`, "i");
    if (re.test(text)) return true;
  }
  return false;
}
