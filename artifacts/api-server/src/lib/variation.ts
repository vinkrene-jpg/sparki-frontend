import type { Request } from "express";

// ── Sparki presentation variation ────────────────────────────────────────────
// Deterministic, per-app-open variation of how REAL content is ordered, so the
// athlete sees a fresh-feeling screen each visit. The seed comes from the
// client's per-app-open session id (X-Sparki-Session header); when it is absent
// (e.g. server-side jobs) it falls back to the calendar day so content still
// rotates day to day. This layer ONLY reorders/rotates already-computed real
// items — it never changes a number, a conclusion, or what gets persisted.

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Numeric seed for this request: the per-app-open session id, else the day. */
export function sessionSeed(req: Request): number {
  const raw = req.get("x-sparki-session");
  if (raw && raw.trim()) return hashStr(raw.trim());
  return hashStr(new Date().toISOString().slice(0, 10));
}

/** Mulberry32 — a small deterministic PRNG seeded from an integer. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rotate an array by a seed-derived offset. Relative order is preserved (a
 * priority-sorted list stays priority-sorted) but a different item leads.
 */
export function seededRotate<T>(arr: readonly T[], seed: number): T[] {
  if (arr.length <= 1) return [...arr];
  const offset = seed % arr.length;
  return [...arr.slice(offset), ...arr.slice(0, offset)];
}

/** Deterministic Fisher–Yates shuffle from a seed. */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  const rand = rng(seed || 1);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Reorder within fixed-size windows: no item moves more than `window`
 * positions, so a relevance-ranked list keeps its most-relevant items near the
 * top while the order still feels fresh each session.
 */
export function windowedReorder<T>(
  arr: readonly T[],
  seed: number,
  window = 4,
): T[] {
  if (arr.length <= 1) return [...arr];
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += window) {
    out.push(...seededShuffle(arr.slice(i, i + window), seed + i));
  }
  return out;
}

/**
 * Partition `arr` into the given group order (by `key`), rotate within each
 * group by the seed, then concatenate — keeping high-priority groups first
 * while varying which member of each group leads. Items whose key is not in
 * `order` are appended last (also rotated).
 */
export function rotateWithinGroups<T>(
  arr: readonly T[],
  key: (item: T) => string | number,
  order: readonly (string | number)[],
  seed: number,
): T[] {
  const buckets = new Map<string | number, T[]>();
  const extras: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (order.includes(k)) {
      const b = buckets.get(k);
      if (b) b.push(item);
      else buckets.set(k, [item]);
    } else {
      extras.push(item);
    }
  }
  const out: T[] = [];
  for (const k of order) {
    const b = buckets.get(k);
    if (b) out.push(...seededRotate(b, seed));
  }
  out.push(...seededRotate(extras, seed));
  return out;
}
