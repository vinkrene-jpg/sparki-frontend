import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

export type MaterialKind = "material" | "nutrition"
export type MaterialConfidence = "unknown" | "low" | "medium" | "high"
export type MaterialStatus = "analyzed" | "needs_more"

export type MaterialCategory = {
  key: string
  label: string
  prompt: string
  kind: MaterialKind
}

export type MaterialAdvice = {
  summary: string
  pros: string[]
  cons: string[]
  risks: string[]
  alternatives: string[]
}

export type MaterialCostEstimate = {
  diy: {
    materials: string[]
    costRange: string
    difficulty: string
    timeEstimate: string
  } | null
  professional: {
    laborCost: string
    totalCost: string
  } | null
  confidence: MaterialConfidence
  note: string | null
}

export type MaterialAnalysis = {
  id: number
  clerkId: string
  category: string
  userNote: string | null
  status: MaterialStatus
  photoPaths: string[]
  detectedItem: string | null
  confidence: MaterialConfidence
  followUpQuestion: string | null
  advice: MaterialAdvice | null
  costEstimate: MaterialCostEstimate | null
  createdAt: string
  updatedAt: string
}

export type PhotoPayload = { data: string; mediaType: string }

export function useMaterialCategories() {
  return useQuery({
    queryKey: queryKeys.material.categories(),
    queryFn: () =>
      apiFetch<{ categories: MaterialCategory[] }>("/api/material/categories"),
    staleTime: 30 * 60_000,
  })
}

export function useMaterialAnalyses() {
  return useQuery({
    queryKey: queryKeys.material.list(),
    queryFn: () =>
      apiFetch<{ analyses: MaterialAnalysis[] }>("/api/material"),
    staleTime: 60_000,
  })
}

export function useAnalyzeMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      category: string
      userNote?: string | null
      photos: PhotoPayload[]
    }) =>
      apiFetch<{ analysis: MaterialAnalysis }>("/api/material/analyze", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.material.list() })
    },
  })
}

export function useAddMaterialPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: number; photo: PhotoPayload }) =>
      apiFetch<{ analysis: MaterialAnalysis }>(
        `/api/material/${input.id}/photo`,
        {
          method: "POST",
          body: JSON.stringify({ photos: [input.photo] }),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.material.list() })
    },
  })
}

// Read an image file and downscale it client-side to keep the upload small and
// to stay within Sparki's vision input limits. Returns raw base64 + media type.
export async function fileToResizedPhoto(
  file: File,
  maxEdge = 1536,
): Promise<PhotoPayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Kon de foto niet lezen"))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("Kon de foto niet openen"))
    el.src = dataUrl
  })

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Kon de foto niet verwerken")
  ctx.drawImage(img, 0, 0, w, h)

  const out = canvas.toDataURL("image/jpeg", 0.85)
  const base64 = out.split(",")[1] ?? ""
  return { data: base64, mediaType: "image/jpeg" }
}
