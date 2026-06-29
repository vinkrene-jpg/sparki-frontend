import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW, getDevAthleteId } from "@/lib/dev";
import { apiFetch, API_BASE } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// Wedstrijd-room — Phase 1 (single-user). The athlete creates a room, adds media
// + text updates per race day, then renders a real ffmpeg montage compilation of
// a day and downloads it. Everything here is backed by real data: no mock items,
// no fake compilation — honest "empty"/"failed" states come from the engine.

export type RaceRoom = {
  id: number;
  clerkId: string;
  raceId: number | null;
  title: string;
  startDate: string;
  days: number;
  createdAt: string;
  updatedAt: string;
};

export type RaceRoomItem = {
  id: number;
  roomId: number;
  clerkId: string;
  dayIndex: number;
  kind: "media" | "update";
  objectPath: string | null;
  mediaType: string | null;
  durationSec: string | null;
  caption: string | null;
  text: string | null;
  createdAt: string;
};

export type CompilationStatus =
  | "pending"
  | "processing"
  | "ready"
  | "empty"
  | "failed";

export type RaceRoomCompilation = {
  id: number;
  roomId: number;
  clerkId: string;
  dayIndex: number | null;
  status: CompilationStatus;
  objectPath: string | null;
  musicTrack: string | null;
  itemCount: number;
  durationSec: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MusicTrack = { key: string; label: string; description: string };

export type RoomDetail = {
  room: RaceRoom;
  items: RaceRoomItem[];
  compilations: RaceRoomCompilation[];
};

// Owner-gated serving URL for a stored object (cookie sent automatically).
export function roomMediaUrl(objectPath: string): string {
  return `${API_BASE}/api/storage${objectPath}`;
}

export function useRaceRooms() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.raceRooms.list(),
    queryFn: () => apiFetch<{ rooms: RaceRoom[] }>("/api/race-rooms"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

export function useRaceRoom(id: number | null) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.raceRooms.detail(id ?? 0),
    queryFn: () => apiFetch<RoomDetail>(`/api/race-rooms/${id}`),
    enabled: (isSignedIn === true || DEV_PREVIEW) && id != null && id > 0,
    staleTime: STALE.live,
  });
}

export function useMusicTracks() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.raceRooms.music(),
    queryFn: () => apiFetch<{ tracks: MusicTrack[] }>("/api/race-rooms/music"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.flags,
  });
}

export type CreateRoomInput = {
  title: string;
  startDate: string;
  days: number;
  raceId?: number | null;
};

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) =>
      apiFetch<{ room: RaceRoom }>("/api/race-rooms", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.raceRooms.all() });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/race-rooms/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.raceRooms.all() });
    },
  });
}

export type AddItemInput =
  | {
      kind: "media";
      dayIndex: number;
      objectPath: string;
      mediaType: string;
      caption?: string | null;
      durationSec?: number | null;
    }
  | { kind: "update"; dayIndex: number; text: string };

export function useAddRoomItem(roomId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddItemInput) =>
      apiFetch<{ item: RaceRoomItem }>(`/api/race-rooms/${roomId}/items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.raceRooms.detail(roomId),
      });
    },
  });
}

export function useDeleteRoomItem(roomId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) =>
      apiFetch<{ ok: true }>(`/api/race-rooms/${roomId}/items/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.raceRooms.detail(roomId),
      });
    },
  });
}

export function useCompileDay(roomId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dayIndex: number; musicKey?: string | null }) =>
      apiFetch<{ compilation: RaceRoomCompilation }>(
        `/api/race-rooms/${roomId}/compile`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.raceRooms.detail(roomId),
      });
    },
  });
}

// Read a video file's duration client-side so the engine can trim to its real
// length. Returns null when the browser can't read it (honest fallback).
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(v.duration) ? v.duration : null);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      v.src = url;
    } catch {
      resolve(null);
    }
  });
}

// Upload one media file via the presigned-URL flow (PUT bytes directly to
// storage), returning what the add-item call needs.
export async function uploadRoomMedia(file: File): Promise<{
  objectPath: string;
  mediaType: string;
  durationSec: number | null;
}> {
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
  if (!put.ok) {
    throw new Error("Uploaden van het bestand is mislukt");
  }

  const durationSec = contentType.startsWith("video/")
    ? await readVideoDuration(file)
    : null;

  return { objectPath, mediaType: contentType, durationSec };
}

// Download a ready compilation. Uses fetch (not a plain <a>) so the dev-preview
// athlete header travels with the request and owner-gating resolves correctly in
// both dev and production.
export async function downloadCompilation(
  roomId: number,
  comp: RaceRoomCompilation,
  filename: string,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (DEV_PREVIEW) {
    const devAthlete = getDevAthleteId();
    if (devAthlete) headers["x-dev-clerk-id"] = devAthlete;
  }
  const res = await fetch(
    `${API_BASE}/api/race-rooms/${roomId}/compilations/${comp.id}/download`,
    { credentials: "include", headers },
  );
  if (!res.ok) {
    throw new Error("Download is mislukt");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
