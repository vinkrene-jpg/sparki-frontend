import { sql } from "drizzle-orm";
import {
  db,
  buildRatingSubjectTypes,
  buildRatingSubjectLabels,
  type BuildRatingSubjectType,
} from "@workspace/db";

// Geaggregeerde sterren-beoordelingen per onderdeel — de VASTE audit-input.
//
// Eén aggregatiefunctie voor zowel het beheeroverzicht (/api/admin/build-ratings)
// als de gezondheidscontrole, zodat audits en beheer gegarandeerd naar dezelfde
// cijfers kijken. Alleen aggregaten (gemiddelde + aantal + trend) — nooit wie
// welke score gaf (privacy).

export type BuildRatingAggregate = {
  subjectType: BuildRatingSubjectType;
  label: string;
  /** Alle beoordelingen ooit. */
  count: number;
  average: number | null;
  /** Laatste 30 dagen. */
  recentCount: number;
  recentAverage: number | null;
  /** De 30 dagen dáárvoor — voor de trend. */
  previousCount: number;
  previousAverage: number | null;
  /** Trend: recent t.o.v. de periode ervoor; null zonder beide periodes. */
  trend: "beter" | "slechter" | "gelijk" | null;
};

function round2(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export async function aggregateBuildRatings(): Promise<BuildRatingAggregate[]> {
  const res = await db.execute(sql`
    SELECT
      subject_type,
      count(*)::int AS total,
      avg(rating)::numeric(4,2) AS avg_all,
      count(*) FILTER (WHERE updated_at >= now() - interval '30 days')::int AS recent_count,
      avg(rating) FILTER (WHERE updated_at >= now() - interval '30 days')::numeric(4,2) AS recent_avg,
      count(*) FILTER (
        WHERE updated_at >= now() - interval '60 days'
          AND updated_at < now() - interval '30 days'
      )::int AS prev_count,
      avg(rating) FILTER (
        WHERE updated_at >= now() - interval '60 days'
          AND updated_at < now() - interval '30 days'
      )::numeric(4,2) AS prev_avg
    FROM build_ratings
    GROUP BY subject_type
  `);
  const byType = new Map<string, Record<string, unknown>>();
  for (const row of res.rows as Array<Record<string, unknown>>) {
    byType.set(String(row.subject_type), row);
  }
  // Alle geregistreerde typen teruggeven — óók zonder beoordelingen — zodat de
  // audit eerlijk ziet welke onderdelen nog géén feedback ontvangen.
  return buildRatingSubjectTypes.map((subjectType) => {
    const row = byType.get(subjectType);
    const recentAverage = round2(row?.recent_avg);
    const previousAverage = round2(row?.prev_avg);
    let trend: BuildRatingAggregate["trend"] = null;
    if (recentAverage != null && previousAverage != null) {
      const diff = recentAverage - previousAverage;
      trend = diff > 0.15 ? "beter" : diff < -0.15 ? "slechter" : "gelijk";
    }
    return {
      subjectType,
      label: buildRatingSubjectLabels[subjectType],
      count: Number(row?.total ?? 0),
      average: round2(row?.avg_all),
      recentCount: Number(row?.recent_count ?? 0),
      recentAverage,
      previousCount: Number(row?.prev_count ?? 0),
      previousAverage,
      trend,
    };
  });
}

// Zwak scorende onderdelen (audit-agenda): gemiddeld < 3 sterren bij ≥ 3
// beoordelingen — één drempel, gedeeld door beheer en gezondheidsrapportage.
export const WEAK_RATING_THRESHOLD = 3;
export const MIN_RATINGS_FOR_SIGNAL = 3;

export function weakComponents(
  aggregates: BuildRatingAggregate[],
): BuildRatingAggregate[] {
  return aggregates.filter(
    (a) =>
      a.count >= MIN_RATINGS_FOR_SIGNAL &&
      a.average != null &&
      a.average < WEAK_RATING_THRESHOLD,
  );
}
