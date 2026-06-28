// Sparki World — frontend types. Mirror the API responses from
// `artifacts/api-server/src/engines/world-feed`. Everything here describes
// transparently-fictional content: every athlete is a "Virtual Athlete" and
// every payload carries `fictional: true`.

export type WorldAthlete = {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string | null;
  discipline: string | null;
  level: string | null;
  archetype: string | null;
  nationality: string | null;
  followerScore: number;
  influenceCategory: string | null;
  role: string | null;
  cohort: string | null;
};

export type WorldPost = {
  id: number;
  kind: string;
  caption: string;
  mediaUrl: string | null;
  publishedAt: string | null;
  athlete: WorldAthlete;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isFollowing: boolean;
  isFavorite: boolean;
  fictional: true;
};

export type WorldFeedResponse = {
  items: WorldPost[];
  personalized: boolean;
  fictional: true;
};

export type WorldCareerEntry = {
  seasonYear: number;
  ageThatYear: number;
  phase: string;
  level: string | null;
  team: string | null;
  ftp: number | null;
  kind: string;
  title: string;
  summary: string | null;
};

export type WorldAthleteProfile = {
  athlete: WorldAthlete & {
    age: number | null;
    city: string | null;
    team: string | null;
    bio: string | null;
    ftp: number | null;
    careerPhase: string | null;
    traits: Record<string, unknown> | null;
  };
  relationships: { kind: string; name: string; slug: string }[];
  career: WorldCareerEntry[];
  posts: WorldPost[];
  isFollowing: boolean;
  isFavorite: boolean;
  fictional: true;
};

export type WorldSuggestedAthlete = {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string | null;
  discipline: string | null;
  level: string | null;
  archetype: string | null;
  nationality: string | null;
  role: string | null;
  cohort: string | null;
  followerScore: number;
  influenceCategory: string | null;
  reason: string;
  fictional: true;
};

export type WorldSuggestionsResponse = {
  items: WorldSuggestedAthlete[];
  fictional: true;
};

export type WorldSavedResponse = {
  items: WorldPost[];
  fictional: true;
};

export type WorldComment = {
  id: number;
  body: string;
  byMe: boolean;
  authorName: string;
  createdAt: string;
};
