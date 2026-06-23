// Knowledge engine.
//
// Owns retrieval of coaching literature/news for retrieval-augmented coaching and
// the personalised news feed, plus the admin library scan/ingest. Consumed by the
// ai (brief/ask), feed and knowledge routes and by the knowledge-scan job.

// Retrieval + personalised news + prompt formatting.
export * from "../../lib/knowledge/retrieval";

// Library scan/ingest + counts (admin).
export * from "../../lib/knowledge/scan";
