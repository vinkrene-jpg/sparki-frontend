// Abonnement (Stripe-TESTMODUS, fase 2).
// De frontend kent hier nooit zelf rechten toe: alles wat we tonen komt uit de
// server-geresolvede status (/api/billing/status), en de knoppen roepen alleen
// server-endpoints aan die zelf flag+allowlist+sessie controleren.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

export type PaidTier = "GO" | "COMPLETE"

export type TierPrice = { month: number; year: number; trialDays: number }

export type SubscriptionChoice = {
  desiredTier: PaidTier | null
  interval: "month" | "year"
  status: string
  updatedAt: string
} | null

export type BillingStatus = {
  status: string
  tier: "FREE" | "GO" | "COMPLETE" | null
  interval: string | null
  trialEndsAt: string | null
  graceUntil: string | null
  currentPeriodEnd: string | null
  plannedDowngradeTier: string | null
  hasStripeSubscription: boolean
  // Eerlijke prijsconfig uit de server (eurocenten); enige echte prijsbron.
  pricing?: Record<PaidTier, TierPrice>
  // Vastgelegde keuze zonder betaalstap (zolang echte betaling ontbreekt).
  choice: SubscriptionChoice
  available: {
    trial: boolean
    checkout: boolean
    portal: boolean
    // Keuze vastleggen kan (testbaar pad tot aan de betaalstap).
    record_choice: boolean
    // Directe downgrade naar Gratis (rechten omlaag, geen betaling nodig).
    downgrade: boolean
    test_mode: boolean
  }
}

const KEY = ["billing", "status"] as const

export function useBillingStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<BillingStatus>("/api/billing/status"),
    staleTime: 30_000,
    retry: false,
  })
}

function redirectTo(url?: string) {
  if (url) window.location.href = url
}

export function useStartTrial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tier: "GO" | "COMPLETE") =>
      apiFetch<{ ok: boolean; ends_at: string }>("/api/billing/trial", {
        method: "POST",
        body: JSON.stringify({ tier }),
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async (args: { tier: "GO" | "COMPLETE"; interval: "month" | "year" }) => {
      const res = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify(args),
      })
      redirectTo(res.url)
      return res
    },
  })
}

export function useOpenPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ url: string }>("/api/billing/portal", {
        method: "POST",
      })
      redirectTo(res.url)
      return res
    },
  })
}

// Keuze vastleggen zonder betaalstap — het pad blijft testbaar tot aan de
// betaalstap. Kent nooit zelf rechten toe (server is de enige poort).
export function useRecordChoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { tier: PaidTier; interval: "month" | "year" }) =>
      apiFetch<{ ok: boolean; choice: SubscriptionChoice }>("/api/billing/choice", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

// Directe downgrade naar Gratis (rechten omlaag = geen betaling nodig).
export function useDowngradeToFree() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; revoked_trials: number }>("/api/billing/downgrade-to-free", {
        method: "POST",
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      void qc.invalidateQueries({ queryKey: ["entitlements", "me"] })
    },
  })
}
