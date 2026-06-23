import { useRef, useState } from "react"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import {
  useRoutes,
  useCreateRoute,
  useDeleteRoute,
  type SparkiRoute,
} from "@/hooks/use-routes"

const SURFACE_LABEL: Record<string, string> = {
  asfalt: "Asfalt",
  gravel: "Gravel",
  mtb: "MTB",
  mixed: "Gemengd",
  unknown: "Onbekend",
}

function ElevationProfile({ profile }: { profile: number[] }) {
  if (profile.length === 0) return null
  const max = Math.max(...profile)
  const min = Math.min(...profile)
  const span = Math.max(1, max - min)
  return (
    <div className="mt-4 flex h-16 items-end gap-px">
      {profile.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{
            height: `${((p - min) / span) * 90 + 10}%`,
            background:
              "linear-gradient(180deg, rgba(120,210,230,0.55), rgba(120,210,230,0.08))",
          }}
        />
      ))}
    </div>
  )
}

function RouteCard({ route }: { route: SparkiRoute }) {
  const del = useDeleteRoute()
  const profile = route.profile ?? []
  const climbs = route.climbs ?? []
  const nav = route.nav ?? []

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.18em]"
              style={{ color: ACCENT }}
            >
              {route.status === "ready" ? "Klaar" : route.status}
            </span>
            <span className="font-mono text-[9px] uppercase text-white/25">
              · {route.source}
            </span>
          </div>
          <h3 className="mt-1 truncate font-sans text-lg font-light tracking-tight text-white/90">
            {route.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => del.mutate(route.id)}
          disabled={del.isPending}
          className="shrink-0 font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
        >
          wis
        </button>
      </div>

      {profile.length > 0 && <ElevationProfile profile={profile} />}

      <div className="mt-4 flex items-center gap-5 border-t border-white/[0.07] pt-4">
        <Stat
          label="Afstand"
          value={route.distanceKm != null ? `${route.distanceKm} km` : "—"}
        />
        <Divider />
        <Stat
          label="Hoogtemeters"
          value={route.elevationGainM != null ? `${route.elevationGainM} m` : "—"}
        />
        <Divider />
        <Stat label="Ondergrond" value={SURFACE_LABEL[route.surface] ?? route.surface} />
      </div>

      {climbs.length > 0 && (
        <div className="mt-4">
          <span className="label-xs text-white/35">KLIMMEN</span>
          <div className="mt-2 flex flex-col">
            {climbs.map((c, i) => (
              <div
                key={i}
                className="flex items-baseline gap-3 border-b border-white/[0.05] py-2 last:border-0"
              >
                <span className="flex-1 text-[13px] tracking-tight text-white/85">
                  {c.name}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-white/45">
                  {c.lengthKm} km
                </span>
                <span
                  className="font-mono text-[11px] tabular-nums"
                  style={{ color: ACCENT }}
                >
                  {c.avgGradePct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {nav.length > 0 ? (
        <div className="mt-4 flex flex-col">
          {nav.map((n, i) => (
            <div
              key={i}
              className="flex items-baseline gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
            >
              <span className="w-12 font-mono text-[11px] tabular-nums text-cyan-300/70">
                {n.km}
              </span>
              <span className="w-20 text-[13px] tracking-tight text-white/85">
                {n.dir}
              </span>
              <span className="flex-1 text-[12px] text-white/40">{n.note}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-white/30">
          Stap-voor-stap navigatie nog niet beschikbaar voor deze route
        </p>
      )}
    </div>
  )
}

export function RoutePanel() {
  const { data, isLoading } = useRoutes()
  const create = useCreateRoute()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const routes = data?.routes ?? []

  async function onFile(file: File) {
    setError(null)
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("Alleen GPX-bestanden worden ondersteund")
      return
    }
    if (file.size > 11 * 1024 * 1024) {
      setError("Bestand te groot (max 11 MB)")
      return
    }
    const content = await file.text()
    create.mutate(
      { content, name: file.name.replace(/\.gpx$/i, "") },
      { onError: () => setError("Route kon niet worden verwerkt") },
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel n="03" title="Route & navigatie" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={create.isPending}
          className="font-mono text-[10px] uppercase tracking-[0.18em] transition disabled:opacity-50"
          style={{ color: ACCENT }}
        >
          {create.isPending ? "verwerken…" : "+ gpx-route"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ""
        }}
      />

      <p className="mt-2 text-[12px] leading-relaxed text-white/35">
        Upload een GPX-bestand voor een echt hoogteprofiel, afstand, hoogtemeters
        en gedetecteerde klimmen.
      </p>

      {error && (
        <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <div className="h-40 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : routes.length > 0 ? (
          routes.map((r) => <RouteCard key={r.id} route={r} />)
        ) : (
          <p className="text-[12px] text-white/30">Nog geen routes opgeslagen</p>
        )}
      </div>
    </section>
  )
}
