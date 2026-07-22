import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

// Fietsengarage — data hooks. Beoordelingen (klasse/aero/gewicht) komen live
// van de server uit de gecureerde kennisbank; onbekende onderdelen zijn eerlijk
// "onbekend" en worden hier nooit aangevuld met verzonnen waarden.

export type GarageBikeType =
  | "race"
  | "mtb"
  | "gravel"
  | "tt"
  | "baan"
  | "cyclocross"
  | "stads"
  | "anders"

export type GarageComponentCategory =
  | "groepset"
  | "wielen"
  | "banden"
  | "achterderailleur"
  | "voorderailleur"
  | "crankstel"
  | "cassette"
  | "ketting"
  | "remmen"
  | "cockpit"
  | "zadel"
  | "pedalen"
  | "onderdeel"
  | "helm"
  | "kleding"
  | "schoenen"
  | "anders"

// Indicatieve nieuwprijs (EUR, van–tot) uit de kennisbank — altijd getoond
// als richtprijs, nooit als actuele winkelprijs.
export type PriceRange = { van: number; tot: number }

export type ComponentAssessment =
  | {
      known: true
      entry: {
        key: string
        brand: string
        model: string
        klasse: "instap" | "amateur" | "elite" | "pro"
        klasseLabel: string
        aero: "laag" | "gemiddeld" | "hoog" | null
        gewicht: "licht" | "gemiddeld" | "zwaar" | null
        richtprijs: PriceRange | null
        note: string
      }
    }
  | { known: false; reason: string }

export type CatalogItem = {
  key: string
  brand: string
  model: string
  klasse: "instap" | "amateur" | "elite" | "pro"
  klasseLabel: string
  richtprijs: PriceRange | null
}

export type GarageComponent = {
  id: number
  bikeId: number | null
  category: GarageComponentCategory
  brand: string | null
  model: string | null
  notes: string | null
  assessment: ComponentAssessment
}

export type GarageBike = {
  id: number
  bikeType: GarageBikeType
  name: string
  brand: string | null
  model: string | null
  equipmentId: number | null
  photoPaths: string[]
  notes: string | null
  components: GarageComponent[]
}

export type EquipmentSuggestion = {
  id: number
  name: string
  brand: string | null
  model: string | null
  source: string
  distanceKm: string | null
}

// Draadloze onderdelen — alleen wattagemeter/hartslagmeter/cadans-snelheid
// hebben een standaard Bluetooth-profiel dat de browser echt kan koppelen
// (pairable: true van de server). Horloge en elektronische derailleur zijn
// registratie-only; dat wordt eerlijk zo getoond.
export type GarageSensorKind =
  | "wattagemeter"
  | "hartslagmeter"
  | "cadans_snelheid"
  | "horloge"
  | "derailleur"

export type GarageSensor = {
  id: number
  bikeId: number | null
  kind: GarageSensorKind
  brand: string | null
  model: string | null
  deviceName: string | null
  batteryNote: string | null
  pairable: boolean
}

export type GarageOverview = {
  bikes: GarageBike[]
  personalGear: GarageComponent[]
  equipmentSuggestions: EquipmentSuggestion[]
  sensors: GarageSensor[]
}

export type UpgradeAdvice = {
  specialism: string
  specialismLabel: string
  suggestions: {
    componentId: number
    category: string
    current: {
      brand: string | null
      model: string | null
      klasse: string
      klasseLabel: string
    }
    gain: "groot" | "merkbaar" | "klein"
    gainLabel: string
    why: string
    targets: {
      brand: string
      model: string
      klasse: string
      klasseLabel: string
      richtprijs: PriceRange | null
    }[]
    besteKoop: boolean
  }[]
  alreadyTop: { componentId: number; category: string; label: string }[]
  unknown: {
    componentId: number
    category: string
    brand: string | null
    model: string | null
    reason: string
  }[]
  prijsToelichting: string
}

export type DevelopmentItem = {
  id: number
  title: string
  url: string
  source: string | null
  publishedAt: string | null
  summary: string | null
}

export type ProTeamMatch = {
  name: string
  bike: string
  groupset: string
  wheels: string
  matches: string[]
}

export function useGarage() {
  return useQuery({
    queryKey: queryKeys.garage.overview(),
    queryFn: () => apiFetch<GarageOverview>("/api/garage"),
    staleTime: 60_000,
  })
}

function useGarageMutation<TInput>(
  fn: (input: TInput) => Promise<unknown>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.garage.all() })
    },
  })
}

export function useAddBike() {
  return useGarageMutation(
    (input: {
      bikeType: GarageBikeType
      name: string
      brand?: string
      model?: string
      equipmentId?: number
      notes?: string
    }) =>
      apiFetch<{ bike: GarageBike }>("/api/garage/bikes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  )
}

export function useDeleteBike() {
  return useGarageMutation((id: number) =>
    apiFetch<{ ok: true }>(`/api/garage/bikes/${id}`, { method: "DELETE" }),
  )
}

export function useAddBikePhoto() {
  return useGarageMutation(
    (input: { bikeId: number; data: string; mediaType: string }) =>
      apiFetch<{ bike: GarageBike }>(`/api/garage/bikes/${input.bikeId}/photo`, {
        method: "POST",
        body: JSON.stringify({ data: input.data, mediaType: input.mediaType }),
      }),
  )
}

export function useAddComponent() {
  return useGarageMutation(
    (input: {
      bikeId?: number
      category: GarageComponentCategory
      brand?: string
      model?: string
      notes?: string
    }) =>
      apiFetch<{ component: GarageComponent }>("/api/garage/components", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  )
}

export function useDeleteComponent() {
  return useGarageMutation((id: number) =>
    apiFetch<{ ok: true }>(`/api/garage/components/${id}`, {
      method: "DELETE",
    }),
  )
}

export function useAddSensor() {
  return useGarageMutation(
    (input: {
      bikeId?: number | null
      kind: GarageSensorKind
      brand?: string
      model?: string
      deviceName?: string
      batteryNote?: string
    }) =>
      apiFetch<{ sensor: GarageSensor }>("/api/garage/sensors", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  )
}

export function useUpdateSensor() {
  return useGarageMutation(
    (input: {
      id: number
      bikeId?: number | null
      brand?: string | null
      model?: string | null
      deviceName?: string | null
      batteryNote?: string | null
    }) => {
      const { id, ...rest } = input
      return apiFetch<{ sensor: GarageSensor }>(`/api/garage/sensors/${id}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      })
    },
  )
}

export function useDeleteSensor() {
  return useGarageMutation((id: number) =>
    apiFetch<{ ok: true }>(`/api/garage/sensors/${id}`, { method: "DELETE" }),
  )
}

export function useUpgradeAdvice(bikeId: number | null, specialism: string | null) {
  return useQuery({
    queryKey: queryKeys.garage.upgrade(bikeId ?? 0, specialism ?? ""),
    queryFn: () =>
      apiFetch<{ advice: UpgradeAdvice }>(
        `/api/garage/upgrade?bikeId=${bikeId}&specialisme=${specialism}`,
      ),
    enabled: bikeId != null && !!specialism,
    staleTime: 60_000,
  })
}

export function useGarageCatalog(category: GarageComponentCategory | null) {
  return useQuery({
    queryKey: queryKeys.garage.catalog(category ?? ""),
    queryFn: () =>
      apiFetch<{ items: CatalogItem[] }>(
        `/api/garage/catalog?categorie=${category}`,
      ),
    enabled: category != null,
    staleTime: 30 * 60_000,
  })
}

export function useGarageDevelopments() {
  return useQuery({
    queryKey: queryKeys.garage.developments(),
    queryFn: () => apiFetch<{ items: DevelopmentItem[] }>("/api/garage/developments"),
    staleTime: 10 * 60_000,
  })
}

export function useProTeams() {
  return useQuery({
    queryKey: queryKeys.garage.proTeams(),
    queryFn: () =>
      apiFetch<{ season: string; source: string; teams: ProTeamMatch[] }>(
        "/api/garage/pro-teams",
      ),
    staleTime: 30 * 60_000,
  })
}

// ── Vergelijkingstest (materiaal A vs B) ────────────────────────────────────
// Modelschatting vooraf is expliciet gelabeld ("modelschatting — geen meting");
// de rit-vergelijking zet alleen ECHTE metingen naast elkaar.

export type TestMode = {
  key: "vlak-constant" | "klim" | "vlak-duur" | "beperkt-meetbaar"
  title: string
  protocol: string
  meting: string
}

export type UpgradeEstimate =
  | {
      known: true
      label: "modelschatting"
      planned: {
        brand: string
        model: string
        klasse: string
        klasseLabel: string
        aero: string | null
        gewicht: string | null
        note: string
      }
      current: {
        brand: string | null
        model: string | null
        klasseLabel: string | null
        known: boolean
      } | null
      klasseStappen: number | null
      verwachting: string
      testMode: TestMode
      sameDayRule: string
    }
  | { known: false; reason: string }

export type RideMetric = {
  key: string
  label: string
  a: number | null
  b: number | null
  delta: number | null
  unit: string
}

export type RideComparison = {
  a: { id: number; date: string; title: string | null }
  b: { id: number; date: string; title: string | null }
  metrics: RideMetric[]
  warnings: string[]
  verdict: string | null
  sameDayRule: string
}

export function useTestEstimate() {
  return useMutation({
    mutationFn: (data: {
      category: GarageComponentCategory
      brand: string
      model: string
      currentComponentId?: number
    }) =>
      apiFetch<{ estimate: UpgradeEstimate }>("/api/garage/test/estimate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  })
}

export function useCompareTestRides(a: number | null, b: number | null) {
  return useQuery({
    queryKey: queryKeys.garage.testCompare(a ?? 0, b ?? 0),
    queryFn: () =>
      apiFetch<{ comparison: RideComparison }>(
        `/api/garage/test/compare?a=${a}&b=${b}`,
      ),
    enabled: a != null && b != null && a !== b,
    staleTime: 60_000,
  })
}
