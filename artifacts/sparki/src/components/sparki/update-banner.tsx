import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { BUILD_SHA, IS_PRODUCTION_BUILD } from "@/lib/version"

// Eén mobiele waarheid (besluit 01-08-2026): na een nieuwe publicatie moet
// zowel de mobiele browser als de geïnstalleerde PWA de nieuwe build tonen.
// Deze banner vergelijkt de ingebakken build-SHA met version.json op de
// server (no-store, dus nooit uit cache) en biedt bij verschil één duidelijke
// verversknop aan. Alleen actief in de productiebuild; de ontwikkelomgeving
// heeft HMR en de DEV Preview.
const CHECK_INTERVAL_MS = 15 * 60 * 1000

async function fetchServerSha(): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL || "/"
    const res = await fetch(`${base}version.json?t=${Date.now()}`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { sha?: unknown }
    return typeof data.sha === "string" && data.sha.length > 0 ? data.sha : null
  } catch {
    return null
  }
}

export function UpdateBanner() {
  const [newBuildAvailable, setNewBuildAvailable] = useState(false)

  useEffect(() => {
    if (!IS_PRODUCTION_BUILD) return
    // Zonder eigen ingebakken SHA valt er niets eerlijk te vergelijken.
    if (!BUILD_SHA || BUILD_SHA === "onbekend") return

    let cancelled = false

    const check = async () => {
      const serverSha = await fetchServerSha()
      if (cancelled || !serverSha || serverSha === "onbekend") return
      if (serverSha !== BUILD_SHA) setNewBuildAvailable(true)
    }

    void check()
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  if (!newBuildAvailable) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[90] flex items-center justify-center gap-3 border-t border-accent-cyan/30 bg-card px-4 py-3 backdrop-blur"
      role="status"
    >
      <span className="type-body-sm text-content-primary">
        Er staat een nieuwe versie klaar.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 rounded-full border border-accent-cyan/50 px-4 py-1.5 type-body-sm text-accent-cyan transition-colors hover:bg-accent-cyan/10"
      >
        <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
        Vernieuwen
      </button>
    </div>
  )
}
