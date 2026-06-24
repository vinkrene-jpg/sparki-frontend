// Sparki State Engine — shared types.
//
// One honest "toestand" (state) for an athlete today, derived from every REAL
// signal Sparki already gathers. This is the engine's surface-agnostic output
// contract: the field position (which drives a living Sparki Core), the short
// status / coach action, the 2–3 signals behind the position, certainty and
// honest gaps. It is not tied to any screen — Vandaag is only the first consumer;
// Training, Races, Routeplanner, Live Ride, notifications, widgets, Sparki
// Display, coach views and APIs read the same shape unchanged.
//
// Nothing is fabricated: missing signals lower certainty and are listed as
// honest gaps, never guessed. Stress has no live source, so it is never invented
// — at most it nudges via the strain proxy (HRV + feel).
//
// Internal keys stay English; every rendered string is plain Dutch.

import type { SignalKind } from "../observation/types";

// The four honest state bands, top (most loadable) → bottom (most vulnerable).
export const STATE_BANDS = [
  "belastbaar",
  "solide",
  "wisselend",
  "kwetsbaar",
] as const;
export type StateBand = (typeof STATE_BANDS)[number];

// Composite 7-day direction. "onbekend" when no real trend exists.
export type MovementDirection = "stijgend" | "stabiel" | "dalend" | "onbekend";

// One of the 2–3 signals shown behind the position ("Waarom?").
export type StateSignal = {
  kind: SignalKind;
  label: string;
  /** Plain-Dutch human reading, e.g. "Je trainde stevig en bent nog wat vermoeid". */
  reading: string;
  tone: "positive" | "concern" | "neutral";
};

// A short, deterministic coach action surfaced at level 1.
export type StateAction = {
  /** Plain-Dutch directive, e.g. "Houd het rustig vandaag". */
  label: string;
  /** Plain-Dutch one-liner: why this follows from the state. */
  reason: string;
};

export type SparkiState = {
  date: string;
  athleteName: string;

  // ── The field position (drives the Core) ────────────────────────────────────
  /**
   * 0..1 on the recovery axis. 0 = links/hersteltekort, 1 = rechts/
   * hersteloverschot. 0.5 = in balans.
   */
  x: number;
  /**
   * 0..1 on the loadability axis. 0 = boven/belastbaar (robuust),
   * 1 = onder/kwetsbaar. (Matches CoreVisualState.y: 0 = good/top.)
   */
  y: number;
  band: StateBand;

  /** 0..1 spanning — race proximity + acute load + recovery-strain proxy. */
  tension: number;
  /** 0..1 vormvervorming — how hard conflicting signals pull the Core. */
  distortion: number;
  /** Composite 7-day direction. */
  movement: { direction: MovementDirection; label: string };

  /** 0..1 certainty from real-signal coverage — never 1.0 (Sparki mag twijfelen). */
  confidence: number;
  /** Plain-Dutch: "veel data" / "genoeg data" / "weinig data". */
  confidenceLabel: string;

  // ── Level 1 ─────────────────────────────────────────────────────────────────
  /** One short status line: hoe sta ik ervoor. */
  status: string;
  /** One short coach action: iets aanpassen vandaag (null when nothing to add). */
  action: StateAction | null;
  /** Whether today's check-in is in (a consumer may surface a check-in prompt). */
  checkInDone: boolean;

  // ── Level 2 ("Waarom?") ─────────────────────────────────────────────────────
  /** The 2–3 most important signals behind the position. */
  why: StateSignal[];

  // ── Honest gaps ─────────────────────────────────────────────────────────────
  /** Channels with no data at all (lowers certainty, never faked). */
  missing: SignalKind[];
};
