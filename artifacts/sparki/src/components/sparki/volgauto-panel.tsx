// Volgauto-paneel (Opdracht 3) — instelling "Deze route wordt gevolgd door
// een volgauto" (standaard uit) + eerlijke vergelijking tussen fietsroute en
// de aparte autoroute: gedeelde stukken, splitsingen, aansluitpunten en een
// geschatte tijdvergelijking. De fietsroute zelf verandert hier NOOIT.

import { useVolgautoPlan, useSetVolgauto } from "@/hooks/use-volgauto"

const ACCENT = "#22d3ee"

function fmtKm(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km`
}

function fmtMin(sec: number | null): string {
  if (sec == null) return "—"
  return `${Math.round(sec / 60)} min`
}

export function VolgautoPanel({
  routeId,
  bikeDistanceKm,
  bikeDurationSec,
  className,
}: {
  routeId: number
  bikeDistanceKm: number | null
  bikeDurationSec: number | null
  className?: string
}) {
  const planQuery = useVolgautoPlan(routeId)
  const setVolgauto = useSetVolgauto(routeId)
  const plan = planQuery.data ?? null
  const enabled = !!plan?.enabled

  // Geschatte tijdvergelijking: fiets uit routeduur (of 27 km/u), auto uit de
  // autoroute-duur van de routedienst (of 45 km/u). Altijd "geschat".
  const bikeEtaSec =
    bikeDurationSec ??
    (bikeDistanceKm != null ? Math.round((bikeDistanceKm / 27) * 3600) : null)
  const carEtaSec =
    plan?.carDurationSec ??
    (plan?.carDistanceKm != null
      ? Math.round((plan.carDistanceKm / 45) * 3600)
      : null)

  const sharedKm = plan?.segments
    .filter((s) => s.kind === "gedeeld")
    .reduce((a, s) => a + (s.endKm - s.startKm), 0)
  const splitCount = plan?.segments.filter((s) => s.kind === "gescheiden").length ?? 0

  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 backdrop-blur-md ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
            Volgauto
          </div>
          <div className="mt-1 text-sm text-foreground/85">
            Deze route wordt gevolgd door een volgauto
          </div>
        </div>
        <button
          type="button"
          disabled={setVolgauto.isPending || planQuery.isLoading}
          onClick={() => setVolgauto.mutate(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            enabled ? "bg-cyan-400/80" : "bg-muted"
          } ${setVolgauto.isPending ? "opacity-50" : ""}`}
          aria-pressed={enabled}
          aria-label="Volgauto aan of uit"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition-all ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {setVolgauto.isPending && (
        <p className="mt-3 text-xs text-muted-foreground">
          Autoroute wordt berekend — de fietsroute blijft ongewijzigd…
        </p>
      )}
      {setVolgauto.isError && (
        <p className="mt-3 text-xs text-[color:var(--color-negative)]">
          {(setVolgauto.error as Error)?.message ?? "Aanzetten mislukt."}
        </p>
      )}

      {enabled && plan && (
        <div className="mt-4 space-y-3 text-sm text-foreground/80">
          {plan.outdated && (
            <p className="rounded-lg bg-amber-400/10 p-2 text-xs text-[color:var(--color-warning)]">
              De route is gewijzigd sinds dit volgautoplan is berekend. Zet de
              instelling opnieuw aan om het plan te vernieuwen.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Fietsroute</div>
              <div className="font-mono">{bikeDistanceKm != null ? fmtKm(bikeDistanceKm) : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Autoroute</div>
              <div className="font-mono">{plan.carDistanceKm != null ? fmtKm(plan.carDistanceKm) : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Gedeeld</div>
              <div className="font-mono">{sharedKm != null ? fmtKm(sharedKm) : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Splitsingen</div>
              <div className="font-mono">{splitCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Fiets (geschat)</div>
              <div className="font-mono">{fmtMin(bikeEtaSec)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Auto (geschat)</div>
              <div className="font-mono">{fmtMin(carEtaSec)}</div>
            </div>
          </div>

          {plan.meetpoints.length > 0 ? (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Aansluitpunten ({plan.meetpoints.length})
              </div>
              <ul className="mt-1 space-y-1">
                {plan.meetpoints.slice(0, 8).map((m, i) => (
                  <li key={`${m.bikeKm}-${i}`} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-muted-foreground">km {m.bikeKm.toFixed(1).replace(".", ",")}</span>
                    <span>{m.name}</span>
                    {m.source === "parkeerplaats" && (
                      <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">P</span>
                    )}
                  </li>
                ))}
                {plan.meetpoints.length > 8 && (
                  <li className="text-xs text-muted-foreground">
                    … en {plan.meetpoints.length - 8} meer (zichtbaar in de app tijdens de rit)
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Geen aansluitpunten gevonden — de autoroute komt nergens dicht genoeg
              bij de fietslijn.
            </p>
          )}

          {plan.dataNotes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
          <p className="text-xs text-[color:var(--color-warning)]">{plan.disclaimer}</p>
        </div>
      )}

      {enabled && planQuery.isLoading && (
        <p className="mt-3 text-xs text-muted-foreground">Volgautoplan laden…</p>
      )}
    </div>
  )
}
