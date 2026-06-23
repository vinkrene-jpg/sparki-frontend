import type { KnowledgeDiscipline } from "@workspace/db";

// Topic = a discipline plus the real search query used against the scientific
// APIs / news feeds. Queries are intentionally cycling/endurance-leaning so the
// library stays relevant to Sparki's athletes, while still covering the broad
// sport-science fields the product taxonomy lists.

export type KnowledgeTopic = {
  discipline: KnowledgeDiscipline;
  // Free-text query (used by Europe PMC, Crossref, OpenAlex, Semantic Scholar).
  query: string;
  // arXiv category hint (only some disciplines map cleanly to arXiv).
  arxiv?: string;
};

export const KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  {
    discipline: "sportwetenschap",
    query: "sports science endurance cycling performance training",
  },
  {
    discipline: "inspanningsfysiologie",
    query: "exercise physiology VO2max lactate threshold endurance cyclists",
  },
  {
    discipline: "fysiologie",
    query: "physiology endurance athletes cardiovascular adaptation",
  },
  {
    discipline: "voedingsleer",
    query: "sports nutrition carbohydrate fueling endurance performance",
  },
  {
    discipline: "sportpsychologie",
    query: "sport psychology motivation mental fatigue athletes performance",
  },
  {
    discipline: "psychologie",
    query: "psychology stress recovery sleep wellbeing athletes",
  },
];

// Curated, reputable sport / equipment / tech news feeds (RSS). These are the
// real, publicly-published feeds — items keep their original article URL.
export type NewsFeed = {
  url: string;
  source: string;
  // Default discipline tag for this feed (the AI tagger can refine/add).
  discipline: KnowledgeDiscipline;
};

export const NEWS_FEEDS: NewsFeed[] = [
  {
    url: "https://www.cyclingnews.com/rss/",
    source: "Cyclingnews",
    discipline: "sportnieuws",
  },
  {
    url: "https://velo.outsideonline.com/feed/",
    source: "Velo",
    discipline: "sportnieuws",
  },
  {
    url: "https://www.bikeradar.com/feed/",
    source: "BikeRadar",
    discipline: "materiaal",
  },
];
