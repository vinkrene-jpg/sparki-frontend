---
name: Sparki in-app news reader + copyright attribution
description: News items open an in-app reader (never navigate the browser away); copyright handled by excerpt + source attribution, not full-text reproduction.
---

# News items must open IN-APP, never navigate away

**Rule:** Clicking a Feed news item opens an in-app overlay reader
(`components/sparki/news-reader.tsx`), it must NOT open the source in a new tab /
navigate the app away. The whole news card is the click target (stretched
absolute `<button>` overlay; title/body stay plain text so there are no nested
interactives). Only an explicit "Lees verder bij {bron}" button inside the
reader links out (`target=_blank`).

**Why:** In the installed-app/iframe context, opening an external link rips the
user out of the app. Requested fix: stay in the app, but still respect copyright.

**How to apply:** For any surface that lists third-party articles, route the
primary click to the in-app reader; reserve external navigation for one explicit,
clearly-labelled "read at source" action.

# Copyright: excerpt + attribution, never full text

The reader shows ONLY what we legitimately store on `knowledge_items`: the Sparki
Dutch `summary`, the real fetched `abstract` excerpt (shown only when it differs
from the summary), plus prominent source attribution (source name badge,
authors, date, DOI) and an ownership notice. Never reproduce the full article.

`FeedNewsItem` (api `lib/knowledge/retrieval.ts` + web `hooks/use-feed-news.ts`)
must stay in sync; both carry authors[] + doi for attribution. All fields are
real stored rows — no fabrication (data-honesty contract on the table).
