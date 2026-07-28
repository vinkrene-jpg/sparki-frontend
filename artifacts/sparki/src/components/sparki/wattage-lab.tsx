// Wattage-lab — popup op het Belasting-tabblad waarin de atleet met eigen
// vermogensdoelen kan "knutselen": kies een duur (5 sec … FTP), draai aan het
// doelwattage en zie een eerlijk, deterministisch oordeel op basis van je
// éigen beste waarden (lib/wattage-lab). Geen verzonnen analyse: vuistregels
// worden benoemd, ontbrekende data wordt eerlijk gemeld en onmogelijke doelen
// heten gewoon onhaalbaar.
import { useMemo, useState } from "react"
import { FlaskConical } from "lucide-react"
import { BeheerSheet } from "@/components/sparki/beheer-popup"
import { usePowerBests } from "@/hooks/use-power-bests"
import {
  computeWattageLab,
  LAB_DUREN,
  LAB_OORDEEL_LABEL,
  type LabDuurKey,
  type LabOordeel,
} from "@/lib/wattage-lab"
import { cn } from "@/lib/utils"

// Donkere sheet-achtergrond (BeheerSheet) — dus donkere, contrastrijke tinten.
const OORDEEL_STIJL: Record<LabOordeel, string> = {
  geen_basis: "border-white/15 bg-white/[0.05] text-white/75",
  al_bereikt: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  binnen_bereik: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  ambitieus: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  buiten_bereik: "border-orange-300/30 bg-orange-300/10 text-orange-200",
  onhaalbaar: "border-red-300/40 bg-red-300/10 text-red-200",
}

function datumLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${Number(d)}-${Number(m)}-${y}`
}

export function WattageLab({
  ftp,
  weightKg,
}: {
  ftp: number | null
  weightKg: number | null
}) {
  const [open, setOpen] = useState(false)
  const [duurKey, setDuurKey] = useState<LabDuurKey>("ftp")
  // Doel per duur onthouden zodat wisselen niet je instelling wist.
  const [doelen, setDoelen] = useState<Partial<Record<LabDuurKey, number>>>({})

  const bests = usePowerBests()
  const duur = LAB_DUREN.find((d) => d.key === duurKey)!

  // Huidige beste waarde: FTP uit het profiel, overige duren uit de échte
  // power bests van eigen ritten (all-time). Geen data = eerlijk null.
  const huidig: { watts: number; bron: string } | null = useMemo(() => {
    if (duurKey === "ftp") {
      return ftp != null && ftp > 0 ? { watts: ftp, bron: "je profiel-FTP" } : null
    }
    const entry = bests.data?.allTime?.[duurKey]
    return entry
      ? { watts: entry.watts, bron: `je beste rit (${datumLabel(entry.date)})` }
      : null
  }, [duurKey, ftp, bests.data])

  const doel = doelen[duurKey] ?? (huidig ? Math.round(huidig.watts * 1.05) : 300)
  const setDoel = (w: number) =>
    setDoelen((d) => ({ ...d, [duurKey]: Math.max(50, Math.min(3000, Math.round(w))) }))

  const resultaat = computeWattageLab({
    duur,
    doelWatts: doel,
    huidigWatts: huidig?.watts ?? null,
    weightKg,
  })

  const geenEnkeleData =
    !bests.isLoading &&
    (bests.data?.sessionsWithBests ?? 0) === 0 &&
    (ftp == null || ftp <= 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-cyan-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-cyan-600" />
          <span className="text-sm font-semibold text-slate-800">Wattage-lab</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Knutsel met je eigen doelen: wat is er nodig om je FTP, sprint of 5-minutenvermogen te
          verhogen — en wat is voor jou realistisch?
        </p>
      </button>

      <BeheerSheet open={open} onOpenChange={setOpen} titel="Wattage-lab">
        <div className="space-y-5">
          {/* Duurkeuze */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Kies een duur">
            {LAB_DUREN.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDuurKey(d.key)}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60",
                  d.key === duurKey
                    ? "border-cyan-300/60 bg-cyan-300/10 font-semibold text-cyan-200"
                    : "border-white/15 text-white/70 hover:border-white/30",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Huidige basis */}
          {huidig ? (
            <p className="text-sm text-white/75 tabular-nums">
              Je huidige beste over {duur.label.toLowerCase()}:{" "}
              <strong className="text-white">{huidig.watts} W</strong>
              {weightKg != null && weightKg > 0 && (
                <> ({Math.round((huidig.watts / weightKg) * 10) / 10} W/kg)</>
              )}{" "}
              — uit {huidig.bron}.
            </p>
          ) : (
            <p className="text-sm text-white/55">
              {bests.isLoading
                ? "Beste waarden laden…"
                : `Nog geen eigen waarde voor ${duur.label.toLowerCase()}.`}
            </p>
          )}

          {/* Doelinstelling */}
          <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Doelwattage">
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-white/15">
              <button
                type="button"
                aria-label="5 watt lager"
                onClick={() => setDoel(doel - 5)}
                className="min-h-11 min-w-11 px-3 text-lg text-white/60 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              >
                −
              </button>
              <label className="sr-only" htmlFor="wattage-doel">
                Doelwattage
              </label>
              <input
                id="wattage-doel"
                type="number"
                inputMode="numeric"
                value={doel}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) setDoel(v)
                }}
                className="w-24 border-x border-white/15 bg-transparent px-2 py-2 text-center font-mono text-sm font-semibold tabular-nums text-white focus-visible:outline-none"
              />
              <button
                type="button"
                aria-label="5 watt hoger"
                onClick={() => setDoel(doel + 5)}
                className="min-h-11 min-w-11 px-3 text-lg text-white/60 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              >
                +
              </button>
            </div>
            <span className="text-sm text-white/55">watt als doel</span>
            {resultaat.doelWkg != null && (
              <span className="text-sm tabular-nums text-white/55">
                = {String(resultaat.doelWkg).replace(".", ",")} W/kg
              </span>
            )}
          </div>

          {/* Oordeel */}
          <div
            className={cn("rounded-xl border px-4 py-3", OORDEEL_STIJL[resultaat.oordeel])}
            aria-live="polite"
          >
            <p className="text-sm font-semibold">{LAB_OORDEEL_LABEL[resultaat.oordeel]}</p>
            <p className="mt-1 text-sm">{resultaat.uitleg}</p>
            {resultaat.oordeel !== "onhaalbaar" &&
              resultaat.oordeel !== "geen_basis" &&
              resultaat.weken != null && (
                <p className="mt-1 text-xs opacity-80">
                  Schatting: ~{resultaat.weken} weken gerichte training (vuistregel, geen garantie).
                </p>
              )}
          </div>

          {/* Aanpak */}
          {resultaat.aanpak.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-white">Wat je ervoor moet doen</p>
              <ul className="mt-2 space-y-2">
                {resultaat.aanpak.map((stap) => (
                  <li key={stap} className="flex gap-2 text-sm text-white/75">
                    <span aria-hidden="true" className="mt-0.5 text-cyan-300">
                      •
                    </span>
                    <span>{stap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Eerlijke verantwoording */}
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/55">
            <p>
              Dit lab rekent met vuistregels bovenop je eigen data: je beste waarden per duur
              {duurKey === "ftp" ? " en je profiel-FTP" : ""}, en de bekende fysiologische
              plafonds per duur (wereldtop ≈ {duur.plafondWkg} W/kg over {duur.label.toLowerCase()}).
              {weightKg == null || weightKg <= 0 ? (
                <> Zonder gewicht in je profiel is de absolute grens ruim genomen — vul je gewicht in
                voor een persoonlijke W/kg-check.</>
              ) : null}{" "}
              Het is geen trainingsplan en geen garantie.
            </p>
            {geenEnkeleData && (
              <p className="mt-2">
                Er zijn nog helemaal geen vermogensgegevens (geen FTP en geen ritten met
                vermogensdata) — het lab kan pas echt iets zeggen na je eerste ritten met een
                vermogensmeter.
              </p>
            )}
          </div>
        </div>
      </BeheerSheet>
    </>
  )
}
