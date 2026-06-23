// Route engine.
//
// Owns real-world route generation (OpenRouteService), routing-profile selection,
// GPX parsing/summarising of uploads, the short-lived candidate store, and the
// helpers that attach generated routes to planned workouts. Consumed by the
// routes and activity-imports routes and by the Training Plan engine.

// Routing provider + profile selection + routing types.
export * from "../../lib/routing";

// GPX parsing / track summaries for uploads.
export * from "../../lib/gpx-parse";

// Short-lived store of provider-generated candidate routes awaiting review.
export * from "../../lib/route-candidates";

// Plan ↔ route helpers (distance estimation, generate-and-save, attach).
export * from "../../lib/plan-routes";
