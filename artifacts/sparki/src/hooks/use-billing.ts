// Abonnement (Stripe-TESTMODUS, fase 2).
// De frontend kent hier nooit zelf rechten toe: alles wat we tonen komt uit de
// server-geresolvede status (/api/billing/status), en de knoppen roepen alleen
// server-endpoints aan die zelf flag+allowlist+sessie controleren.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

export type BillingStatus = {
  status: string
  tier: "FREE" | "GO" | "COMPLETE"
  interval: string | null
  trialEndsAt: string | null
  graceUntil: string | null
  currentPeriodEnd: string | null
  plannedDowngradeTier: string | null
  hasStripeSubscription: boolean
  available: {
    trial: boolean
    checkout: boolean
    portal: boolean
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
