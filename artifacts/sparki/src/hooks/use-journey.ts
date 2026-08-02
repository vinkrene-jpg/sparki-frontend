import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch, API_BASE } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// Journey — persoonlijke tijdlijn + wedstrijddossier. Alles echt: de tijdlijn
// wordt server-side samengesteld uit bestaande data (wedstrijden, trainingen,
// records, doelen, materiaal, mijlpalen). Geen mock-content.

export type JourneyEventKind =
  | "wedstrijd"
  | "training"
  | "trainingskamp"
  | "record"
  | "doel_behaald"
  | "blessure_herstel"
  | "materiaalwissel"
  | "mijlpaal";

export type JourneyEvent = {
  key: string;
  kind: JourneyEventKind;
  date: string;
  endDate?: string | null;
  title: string;
  subtitle?: string | null;
  ref: { type: "race" | "session" | "goal" | "component" | "item"; id: number };
  facts?: Record<string, string | number | null>;
};

export type JourneyMedia = {
  id: number;
  subjectType: "race" | "session" | "item";
  subjectId: number;
  objectPath: string;
  // F11: centrale files-rij (afbeeldingen die door de veiligheidspoort zijn
  // gefinaliseerd). Aanwezig ⇒ serveren via de centrale (intrekbare) route.
  fileId?: number | null;
  mediaType: string;
  caption: string | null;
  sortIndex: number;
  visibility: "prive" | "gedeeld";
};

export type JourneyReflection = {
  id: number;
  raceId: number;
  reflection: string | null;
  lesson: string | null;
  nextAction: string | null;
  linkMode: "auto" | "manual" | "none";
  linkedSessionId: number | null;
};

export type LinkedActivity = {
  mode: "auto" | "manual" | "none";
  session: {
    id: number;
    sessionDate: string;
    title: string | null;
    durationMin: number | null;
    distanceKm: number | null;
    avgPower: number | null;
    normalizedPower: number | null;
    avgHR: number | null;
    tss: number | null;
    powerBests: Record<string, number> | null;
  } | null;
  removed: boolean;
};

export type RaceDossier = {
  race: {
    id: number;
    name: string;
    raceDate: string;
    location: string | null;
    discipline: string | null;
    priority: string | null;
    distanceKm: string | null;
    elevationM: number | null;
    courseNotes: string | null;
    goalNotes: string | null;
    result: {
      position?: number | null;
      fieldSize?: number | null;
      status?: string | null;
      notes?: string | null;
    } | null;
  };
  reflection: JourneyReflection | null;
  activity: LinkedActivity;
  media: {
    own: JourneyMedia[];
    room: {
      id: number;
      dayIndex: number;
      objectPath: string | null;
      mediaType: string | null;
      caption: string | null;
    }[];
  };
  context: unknown;
  taper: {
    id: number;
    scheduledDate: string;
    title: string;
    type: string;
    targetDurationMin: number | null;
    status: string;
    source: string;
  }[];
  shareFields: string[];
};

// F11: media met een centrale files-rij (fileId) worden via de centrale route
// geserveerd — die dwingt intrekbaarheid (410) en owner-controle af. Legacy-
// media (geen fileId) en video's lopen via het generieke object-pad.
export function journeyMediaUrl(
  media: { objectPath: string; fileId?: number | null },
): string {
  if (media.fileId != null) {
    return `${API_BASE}/api/files/${media.fileId}/download`;
  }
  return `${API_BASE}/api/storage${media.objectPath}`;
}

export function useJourney(kinds?: JourneyEventKind[]) {
  const { isSignedIn } = useUser();
  const kindsKey = kinds?.join(",") ?? "";
  return useQuery({
    queryKey: queryKeys.journey.timeline(kindsKey),
    queryFn: () =>
      apiFetch<{ events: JourneyEvent[]; total: number }>(
        `/api/journey${kindsKey ? `?kinds=${kindsKey}` : ""}`,
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.live,
  });
}

export function useRaceDossier(raceId: number | null) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.journey.dossier(raceId ?? 0),
    queryFn: () => apiFetch<RaceDossier>(`/api/journey/race/${raceId}`),
    enabled: (isSignedIn === true || DEV_PREVIEW) && raceId != null && raceId > 0,
    staleTime: STALE.live,
  });
}

export function useSaveReflection(raceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      reflection?: string | null;
      lesson?: string | null;
      nextAction?: string | null;
    }) =>
      apiFetch<{ reflection: JourneyReflection }>(
        `/api/journey/race/${raceId}/reflection`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.journey.all() });
    },
  });
}

export function useSetActivityLink(raceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { mode: "auto" | "manual" | "none"; sessionId?: number }) =>
      apiFetch<{ reflection: JourneyReflection; activity: LinkedActivity }>(
        `/api/journey/race/${raceId}/link`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.journey.all() });
    },
  });
}

export function useCreateJourneyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: "mijlpaal" | "trainingskamp" | "blessure_herstel";
      title: string;
      description?: string | null;
      startDate: string;
      endDate?: string | null;
    }) =>
      apiFetch<{ item: unknown }>("/api/journey/items", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.journey.all() });
    },
  });
}

export function useDeleteJourneyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/journey/items/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.journey.all() });
    },
  });
}

// Upload één media-bestand via de presign-flow en registreer het bij een
// Journey-onderwerp (ACL wordt server-side pas gezet ná de upload).
export async function uploadJourneyMedia(
  file: File,
  subject: { subjectType: "race" | "session" | "item"; subjectId: number },
  caption?: string,
): Promise<JourneyMedia> {
  const contentType = file.type || "application/octet-stream";
  const { uploadURL, objectPath } = await apiFetch<{
    uploadURL: string;
    objectPath: string;
  }>("/api/storage/uploads/request-url", {
    method: "POST",
    body: JSON.stringify({ name: file.name, size: file.size, contentType }),
  });
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("Uploaden van het bestand is mislukt");
  const { media } = await apiFetch<{ media: JourneyMedia }>(
    "/api/journey/media",
    {
      method: "POST",
      body: JSON.stringify({
        ...subject,
        objectPath,
        mediaType: contentType,
        caption: caption || null,
      }),
    },
  );
  return media;
}

export function useUpdateJourneyMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: number;
      caption?: string | null;
      visibility?: "prive" | "gedeeld";
    }) =>
      apiFetch<{ media: JourneyMedia }>(`/api/journey/media/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
          ...(input.visibility !== undefined
            ? { visibility: input.visibility }
            : {}),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.journey.all() });
    },
  });
}

export function useReorderJourneyMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<{ ok: boolean }>("/api/journey/media/order", {
        method: "PUT",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.journey.all() });
    },
  });
}

export function useDeleteJourneyMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/journey/media/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.journey.all() });
    },
  });
}

export function useShareCard(raceId: number) {
  return useMutation({
    mutationFn: (input: { fields: string[]; mediaIds: number[] }) =>
      apiFetch<{
        fields: Record<string, string>;
        media: { id: number; objectPath: string; mediaType: string; caption: string | null }[];
      }>(`/api/journey/race/${raceId}/share-card`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
