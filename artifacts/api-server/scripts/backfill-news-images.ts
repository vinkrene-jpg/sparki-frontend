// Eenmalige/herbruikbare backfill: haalt de nieuwsfeeds opnieuw op en vult
// image_url in voor bestaande rijen die nog geen artikelfoto hebben.
// Geen AI-verrijking (maxNew: 0) — alleen de heal-pass. Draai via:
//   pnpm --filter @workspace/api-server exec tsx scripts/backfill-news-images.ts
import { runKnowledgeScan } from "../src/lib/knowledge/scan";

const result = await runKnowledgeScan({
  researchProviders: [],
  perNewsFeed: 12,
  maxNew: 0,
});
console.log(JSON.stringify(result, null, 2));
process.exit(0);
