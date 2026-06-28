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

export type WorldAthleteProfile = {
  athlete: WorldAthlete & {
    age: number | null;
    city: string | null;
    team: string | null;
    bio: string | null;
    ftp: number | null;
    traits: Record<string, unknown> | null;
  };
  relationships: { kind: string; name: string; slug: string }[];
  posts: WorldPost[];
  isFollowing: boolean;
  isFavorite: boolean;
  fictional: true;
};

export type WorldComment = {
  id: number;
  body: string;
  byMe: boolean;
  authorName: string;
  createdAt: string;
};
