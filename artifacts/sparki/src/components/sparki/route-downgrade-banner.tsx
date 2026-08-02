// ── ABONNEMENT_01 §1.3 — downgrade-keuzeflow voor routes ─────────────────────
// Na een downgrade naar Gratis blijven álle routes zichtbaar en herstelbaar;
// er verdwijnt nooit iets automatisch. Deze banner verschijnt alleen wanneer
// de keuze echt aan de orde is (meer routes dan de limiet) en laat de
// gebruiker zelf maximaal drie actieve routes kiezen. De rest blijft
// alleen-lezen (bewerken hoort bij Sparki Go) maar blijft gewoon te bekijken.
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { apiFetch } from "@/lib/api"
import { useRoutes } from "@/hooks/use-routes"

interface DowngradeState {
  vanToepassing: boolean
  limiet: number
  totaalRoutes: number
  gekozenRouteIds: number[]
  keuzeVereist: boolean
}

const KEY = ["routes", "downgrade-state"] as const

export function RouteDowngradeBanner() {
  const { isSignedIn } = useUser()
  const qc = useQueryClient()
  const { data: state } = useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<DowngradeState>("/api/routes/downgrade-state"),
    enabled: isSignedIn === true,
    staleTime: 60 * 1000,
  })
  const { data: routesData } = useRoutes()
  const [gekozen, setGekozen] = useState<number[] | null>(null)
  const opslaan = useMutation({
    mutationFn: (routeIds: number[]) =>
      apiFetch<DowngradeState>("/api/routes/active-selection", {
        method: "PUT",
        body: JSON.stringify({ routeIds }),
      }),
    onSuccess: (nieuw) => {
      qc.setQueryData(KEY, nieuw)
      setGekozen(null)
    },
  })

  if (!state?.vanToepassing) return null
  if (!state.keuzeVereist && state.gekozenRouteIds.length > 0) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-[12px] text-muted-foreground">
          Je account staat op Gratis. Je hebt {state.gekozenRouteIds.length} van
          maximaal {state.limiet} actieve routes gekozen; al je andere routes
          blijven zichtbaar en zijn alleen-lezen. Er is niets verwijderd.
        </p>
        <button
          className="mt-2 rounded-xl border border-border bg-muted px-3 py-1.5 text-[12px] text-foreground/80 transition hover:bg-muted"
          onClick={() => setGekozen(state.gekozenRouteIds)}
        >
          Keuze aanpassen
        </button>
        {gekozen !== null && (
          <Keuzelijst
            routes={routesData?.routes ?? []}
            limiet={state.limiet}
            gekozen={gekozen}
            setGekozen={setGekozen}
            opslaan={() => opslaan.mutate(gekozen)}
            bezig={opslaan.isPending}
            fout={opslaan.error}
          />
        )}
      </div>
    )
  }
  const selectie = gekozen ?? []
  return (
    <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-4">
      <p className="text-[13px] font-medium text-[color:var(--color-warning)]">
        Kies je {state.limiet} actieve routes
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Je account staat nu op Gratis en je hebt {state.totaalRoutes} routes.
        Al je routes blijven bewaard en zichtbaar — er wordt níéts verwijderd.
        Kies hieronder maximaal {state.limiet} routes die actief blijven; de
        rest blijft alleen-lezen tot je weer een abonnement neemt.
      </p>
      <Keuzelijst
        routes={routesData?.routes ?? []}
        limiet={state.limiet}
        gekozen={selectie}
        setGekozen={setGekozen}
        opslaan={() => opslaan.mutate(selectie)}
        bezig={opslaan.isPending}
        fout={opslaan.error}
      />
    </div>
  )
}

function Keuzelijst({
  routes,
  limiet,
  gekozen,
  setGekozen,
  opslaan,
  bezig,
  fout,
}: {
  routes: Array<{ id: number; name: string }>
  limiet: number
  gekozen: number[]
  setGekozen: (v: number[]) => void
  opslaan: () => void
  bezig: boolean
  fout: unknown
}) {
  const toggle = (id: number) => {
    if (gekozen.includes(id)) setGekozen(gekozen.filter((x) => x !== id))
    else if (gekozen.length < limiet) setGekozen([...gekozen, id])
  }
  return (
    <div className="mt-3">
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {routes.map((r) => {
          const actief = gekozen.includes(r.id)
          const vol = !actief && gekozen.length >= limiet
          return (
            <li key={r.id}>
              <button
                className={`w-full rounded-xl border px-3 py-2 text-left text-[12px] transition ${
                  actief
                    ? "border-emerald-400/40 bg-emerald-500/[0.12] text-foreground"
                    : vol
                      ? "border-border bg-muted text-muted-foreground"
                      : "border-border bg-muted text-muted-foreground hover:bg-muted"
                }`}
                disabled={vol}
                onClick={() => toggle(r.id)}
              >
                {actief ? "✓ " : ""}
                {r.name}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button
          className="rounded-xl border border-border bg-muted px-4 py-2 text-[12px] font-medium text-foreground transition hover:bg-muted disabled:opacity-40"
          disabled={bezig || gekozen.length === 0}
          onClick={opslaan}
        >
          {bezig ? "Bezig…" : `Bewaar keuze (${gekozen.length}/${limiet})`}
        </button>
        {fout != null && (
          <p className="text-[11px] text-[color:var(--color-negative)]">
            Opslaan lukte niet. Probeer het opnieuw.
          </p>
        )}
      </div>
    </div>
  )
}
