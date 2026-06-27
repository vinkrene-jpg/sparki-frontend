import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { uploadFile } from "@/hooks/use-input-center"
import { queryKeys } from "@/lib/query-keys"

// Sparki Photo Lab — upload a real photo, relight it into the Sparki look, and
// persist the user's explicit keep-choice. Two variants are always kept: the
// original (never overwritten) and the Sparki-styled one. If styling fails, the
// original stays usable and the failure is reported honestly.

export type StylizeResponse = {
  id: number
  originalPath: string
  styledPath: string | null
  styledDataUrl: string | null
  styleStatus: "styled" | "failed"
  failureReason?: string
}

// Large camera photos can exceed the image model's inline limit. Downscale only
// when needed (long edge > 2200px) so smaller photos stay pristine. Returns the
// original File unchanged when no resize is required or anything goes wrong.
async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  const MAX_EDGE = 2200
  try {
    const bitmap = await createImageBitmap(file)
    const longEdge = Math.max(bitmap.width, bitmap.height)
    if (longEdge <= MAX_EDGE) {
      bitmap.close()
      return file
    }
    const scale = MAX_EDGE / longEdge
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    )
    if (!blob) return file
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg" })
  } catch {
    return file
  }
}

// Upload the original to storage, then ask the backend to produce the styled
// variant. Resolves even on a styling failure (styleStatus "failed").
export function useStylizePhoto() {
  return useMutation({
    mutationFn: async (file: File): Promise<StylizeResponse> => {
      const prepared = await prepareImage(file)
      const original = await uploadFile(prepared, "image")
      return apiFetch<StylizeResponse>("/api/photo-style/stylize", {
        method: "POST",
        body: JSON.stringify({ originalPath: original.objectPath }),
      })
    },
  })
}

export type ChooseResponse = {
  id: number
  chosenVariant: "original" | "sparki_style"
  chosenPath: string
}

// Persist the user's explicit keep-choice for a session.
export function useChoosePhoto() {
  return useMutation({
    mutationFn: (input: {
      id: number
      variant: "original" | "sparki_style"
    }): Promise<ChooseResponse> =>
      apiFetch<ChooseResponse>(`/api/photo-style/${input.id}/choose`, {
        method: "POST",
        body: JSON.stringify({ variant: input.variant }),
      }),
  })
}

export type DecorResponse = { decorPhotoPath: string | null }

// Use a kept photo as the profile atmosphere image (decorates the page). The
// profile/dashboard queries are refreshed so the hero shows up immediately.
export function useSetPhotoDecor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: number
      variant: "original" | "sparki_style"
    }): Promise<DecorResponse> =>
      apiFetch<DecorResponse>(`/api/photo-style/${input.id}/use-as-decor`, {
        method: "POST",
        body: JSON.stringify({ variant: input.variant }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() })
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() })
    },
  })
}

// Remove the profile atmosphere image — the page falls back to the cinematic
// background honestly, no fake hero remains.
export function useClearPhotoDecor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<DecorResponse> =>
      apiFetch<DecorResponse>("/api/photo-style/decor/clear", {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() })
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() })
    },
  })
}
