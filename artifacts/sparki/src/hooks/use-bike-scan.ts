import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

// Fietsscan + productbeelden — data hooks. Alles is echte gebruikersdata:
// originele opnames, vrijstaande PNG's en productbeelden met verplichte
// herkomst. viewMode komt van de server en is nooit een gesimuleerde rotatie.

export type BikeScanStep =
  | "volledig"
  | "links"
  | "voorzijde"
  | "rechts"
  | "aandrijving"
  | "wielen"
  | "cockpit"

export type BikeScanFrame = {
  id: number
  scanId: number
  bikeId: number
  step: BikeScanStep
  seq: number
  originalPath: string
  cutoutPath: string | null
  quality: {
    brightness: number
    sharpness: number
    motion: number
    coverage: number
  } | null
  approved: number
}

export type BikeScan = {
  id: number
  bikeId: number
  status: "bezig" | "afgerond" | "afgebroken"
  completedAt: string | null
}

export type BikeScanView = {
  scan: BikeScan | null
  frames: BikeScanFrame[]
  viewMode: "draai360" | "fotos" | "geen"
}

export type EquipmentAsset = {
  id: number
  componentId: number
  brand: string
  model: string
  variant: string | null
  source: "fabrikant" | "distributeur" | "catalogus" | "upload"
  sourceUrl: string | null
  license: string
  imagePath: string
  importedAt: string
}

export function frameImageUrl(frameId: number, kind: "origineel" | "vrijstaand") {
  return `/api/bike-scan/frame/${frameId}/${kind}`
}

export function assetImageUrl(assetId: number) {
  return `/api/bike-scan/assets/${assetId}/image`
}

export function useBikeScanView(bikeId: number | null) {
  return useQuery({
    queryKey: queryKeys.bikeScan.view(bikeId ?? 0),
    queryFn: () => apiFetch<BikeScanView>(`/api/bike-scan/bike/${bikeId}`),
    enabled: bikeId != null,
    staleTime: 30_000,
  })
}

export function useStartBikeScan() {
  return useMutation({
    mutationFn: (bikeId: number) =>
      apiFetch<{ scan: BikeScan; steps: BikeScanStep[] }>("/api/bike-scan/start", {
        method: "POST",
        body: JSON.stringify({ bikeId }),
      }),
  })
}

export function useUploadScanFrame() {
  return useMutation({
    mutationFn: (input: {
      scanId: number
      step: BikeScanStep
      seq: number
      data: string
      mediaType: string
      quality: {
        brightness: number
        sharpness: number
        motion: number
        coverage: number
      }
    }) => {
      const { scanId, ...rest } = input
      return apiFetch<{ frame: BikeScanFrame }>(`/api/bike-scan/${scanId}/frame`, {
        method: "POST",
        body: JSON.stringify(rest),
      })
    },
  })
}

export function useUploadScanCutout() {
  return useMutation({
    mutationFn: (input: { frameId: number; data: string }) =>
      apiFetch<{ frame: BikeScanFrame }>(
        `/api/bike-scan/frame/${input.frameId}/cutout`,
        {
          method: "POST",
          body: JSON.stringify({ data: input.data, mediaType: "image/png" }),
        },
      ),
  })
}

export function useCompleteBikeScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (scanId: number) =>
      apiFetch<{ scan: BikeScan }>(`/api/bike-scan/${scanId}/complete`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bikeScan.all() })
    },
  })
}

export function useDeleteBikeScans() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bikeId: number) =>
      apiFetch<{ ok: true }>(`/api/bike-scan/bike/${bikeId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bikeScan.all() })
    },
  })
}

export function useEquipmentAssets(componentId: number | null) {
  return useQuery({
    queryKey: queryKeys.bikeScan.assets(componentId ?? 0),
    queryFn: () =>
      apiFetch<{ assets: EquipmentAsset[] }>(
        `/api/bike-scan/assets?componentId=${componentId}`,
      ),
    enabled: componentId != null,
    staleTime: 60_000,
  })
}

export function useAddEquipmentAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      componentId: number
      brand: string
      model: string
      variant?: string
      source: EquipmentAsset["source"]
      sourceUrl?: string
      license: string
      data: string
      mediaType: string
    }) =>
      apiFetch<{ asset: EquipmentAsset }>("/api/bike-scan/assets", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bikeScan.all() })
    },
  })
}

export function useDeleteEquipmentAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/bike-scan/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bikeScan.all() })
    },
  })
}
