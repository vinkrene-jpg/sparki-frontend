// Wattage-lab — popup op het Belasting-tabblad waarin de atleet met eigen
// vermogensdoelen kan "knutselen": kies een duur (5 sec … FTP), draai aan het
// doelwattage en zie een eerlijk, deterministisch oordeel op basis van je
// éigen beste waarden (lib/wattage-lab). Geen verzonnen analyse: vuistregels
// worden benoemd, ontbrekende data wordt eerlijk gemeld en onmogelijke doelen
// heten gewoon onhaalbaar.
import { useMemo, useState } from "react"
import { FlaskConical, Target } from "lucide-react"
import { BeheerSheet } from "@/components/sparki/beheer-popup"
import { usePowerBests } from "@/hooks/use-power-bests"
import { useGoalPicture, useCreateGoal } from "@/hooks/use-goals"
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
  geen_basis: "border-border bg-muted text-foreground/75",
  al_bereikt: "border-emerald-300/30 bg-emerald-300/10 text-[color:var(--color-positive)]",
  binnen_bereik: "border-emerald-300/30 bg-emerald-300/10 text-[color:var(--color-positive)]",
  ambitieus: "border-amber-300/30 bg-amber-300/10 text-[color:var(--color-warning)]",
  buiten_bereik: "border-orange-300/30 bg-orange-300/10 text-[color:var(--color-warning)]",
  onhaalbaar: "border-red-300/40 bg-red-300/10 text-[color:var(--color-negative)]",
}

function datumLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${Number(d)}-${Number(m)}-${y}`
}

// Doeltitel per duur. Voor FTP bewust mét het woord "FTP": de Analyse-overlay
// (streef-FTP-lijn) herkent doelen daaraan.
function doelTitel(duurKey: LabDuurKey, duurLabel: string, watts: number): string {
  return duurKey === "ftp"
    ? `FTP naar ${watts} W`
    : `Vermogen over ${duurLabel.toLowerCase()} naar ${watts} W`
}

// Prefix waarmee we een eerder vastgelegd lab-doel voor dezelfde duur herkennen
// (dan wérken we dat doel bij in plaats van een duplicaat te maken).
function doelPrefix(duurKey: LabDuurKey, duurLabel: string): string {
  return duurKey === "ftp" ? "FTP naar " : `Vermogen over ${duurLabel.toLowerCase()} naar `
}

// Streefdatum uit de weken-schatting — als LOKALE datum (geen toISOString,
// die pakt de UTC-dag en zit rond middernacht een dag ernaast).
function streefDatum(weken: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weken * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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

  // Vastleggen als echt doel (Doelen-werkblad + Analyse-overlay + plan-input).
  const picture = useGoalPicture()
  const createGoal = useCreateGoal()
  // Per duur onthouden wat er dit bezoek is vastgelegd (voor de bevestiging).
  const [vastgelegd, setVastgelegd] = useState<Partial<Record<LabDuurKey, number>>>({})

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

  // Vastleggen: bestaand lab-doel voor deze duur bijwerken (geen duplicaten),
  // anders een nieuw doel aanmaken. Het doel telt daarna overal mee: in het
  // Doelen-werkblad, als streeflijn op Analyse (FTP) en als input voor de
  // eerstvolgende (her)berekening van het trainingsplan.
  const bestaand = useMemo(() => {
    const prefix = doelPrefix(duurKey, duur.label)
    return (picture.data?.goals ?? []).find(
      (g) => g.status === "active" && g.title.startsWith(prefix),
    )
  }, [picture.data, duurKey, duur.label])

  const kanVastleggen =
    resultaat.oordeel !== "onhaalbaar" &&
    resultaat.oordeel !== "geen_basis" &&
    resultaat.oordeel !== "al_bereikt"

  const bezig = createGoal.isPending
  const legVast = async () => {
    if (bezig) return
    const title = doelTitel(duurKey, duur.label, doel)
    try {
      // Eén pad: de server werkt atomair een bestaand lab-doel voor deze duur
      // bij (op titelprefix) of maakt het aan — dubbelkliks of een tweede
      // tabblad kunnen dus nooit een duplicaat opleveren.
      await createGoal.mutateAsync({
        title,
        description: `Vastgelegd vanuit het Wattage-lab. Oordeel bij vastleggen: ${LAB_OORDEEL_LABEL[resultaat.oordeel]}${huidig ? ` (basis: ${huidig.watts} W)` : ""}.`,
        horizon: "season" as const,
        targetDate: resultaat.weken != null ? streefDatum(resultaat.weken) : null,
        measure: duurKey === "ftp" ? "FTP (watt)" : `vermogen over ${duur.label.toLowerCase()} (watt)`,
        targetValue: `${doel} W`,
        dedupeTitlePrefix: doelPrefix(duurKey, duur.label),
      })
      setVastgelegd((v) => ({ ...v, [duurKey]: doel }))
    } catch {
      // foutmelding hieronder via mutation-state
    }
  }

  const geenEnkeleData =
    !bests.isLoading &&
    (bests.data?.sessionsWithBests ?? 0) === 0 &&
    (ftp == null || ftp <= 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-cyan-400/25 bg-card p-5 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-accent-cyan" />
          <span className="text-sm font-semibold text-foreground/85">Wattage-lab</span>
          {/* WP-K5: vast label — knutselen is verkennen, geen meting of advies. */}
          <span className="ml-auto rounded-full border border-cyan-400/25 bg-accent-cyan/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-cyan">
            Verkenning · simulatie
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
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
                    ? "border-accent-cyan/60 bg-accent-cyan/10 font-semibold text-accent-cyan"
                    : "border-border text-muted-foreground hover:border-border",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Huidige basis */}
          {huidig ? (
            <p className="text-sm text-foreground/75 tabular-nums">
              Je huidige beste over {duur.label.toLowerCase()}:{" "}
              <strong className="text-foreground">{huidig.watts} W</strong>
              {weightKg != null && weightKg > 0 && (
                <> ({Math.round((huidig.watts / weightKg) * 10) / 10} W/kg)</>
              )}{" "}
              — uit {huidig.bron}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {bests.isLoading
                ? "Beste waarden laden…"
                : `Nog geen eigen waarde voor ${duur.label.toLowerCase()}.`}
            </p>
          )}

          {/* Doelinstelling */}
          <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Doelwattage">
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                aria-label="5 watt lager"
                onClick={() => setDoel(doel - 5)}
                className="min-h-11 min-w-11 px-3 text-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
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
                className="w-24 border-x border-border bg-transparent px-2 py-2 text-center font-mono text-sm font-semibold tabular-nums text-foreground focus-visible:outline-none"
              />
              <button
                type="button"
                aria-label="5 watt hoger"
                onClick={() => setDoel(doel + 5)}
                className="min-h-11 min-w-11 px-3 text-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              >
                +
              </button>
            </div>
            <span className="text-sm text-muted-foreground">watt als doel</span>
            {resultaat.doelWkg != null && (
              <span className="text-sm tabular-nums text-muted-foreground">
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
              <p className="text-sm font-semibold text-foreground">Wat je ervoor moet doen</p>
              <ul className="mt-2 space-y-2">
                {resultaat.aanpak.map((stap) => (
                  <li key={stap} className="flex gap-2 text-sm text-foreground/75">
                    <span aria-hidden="true" className="mt-0.5 text-accent-cyan">
                      •
                    </span>
                    <span>{stap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vastleggen als doel */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void legVast()}
              disabled={!kanVastleggen || bezig}
              className={cn(
                "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60",
                kanVastleggen && !bezig
                  ? "border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20"
                  : "cursor-not-allowed border-border text-muted-foreground",
              )}
            >
              <Target className="h-4 w-4" aria-hidden="true" />
              {bezig
                ? "Vastleggen…"
                : bestaand
                  ? `Werk mijn doel bij naar ${doel} W`
                  : `Leg vast als doel: ${doelTitel(duurKey, duur.label, doel)}`}
            </button>
            {!kanVastleggen && (
              <p className="text-xs text-muted-foreground">
                {resultaat.oordeel === "al_bereikt"
                  ? "Dit kun je al — kies een hoger doel om het vast te leggen."
                  : resultaat.oordeel === "onhaalbaar"
                    ? "Een onhaalbaar doel leggen we niet vast — kies iets dat binnen je fysiologie past."
                    : "Nog geen eigen basis om een doel op te bouwen."}
              </p>
            )}
            {createGoal.isError && (
              <p className="text-xs text-[color:var(--color-negative)]">Vastleggen mislukte — probeer het opnieuw.</p>
            )}
            {vastgelegd[duurKey] != null && !bezig && (
              <p className="text-xs text-[color:var(--color-positive)]" aria-live="polite">
                Vastgelegd als doel ({vastgelegd[duurKey]} W). Het staat nu in je Doelen-werkblad
                {duurKey === "ftp" ? ", verschijnt als streeflijn op Analyse" : ""} en telt mee bij
                de eerstvolgende (her)berekening van je trainingsplan.
              </p>
            )}
            {bestaand && vastgelegd[duurKey] == null && (
              <p className="text-xs text-muted-foreground">
                Je hebt al een doel voor deze duur: “{bestaand.title}”. Vastleggen werkt dat doel
                bij in plaats van een tweede aan te maken.
              </p>
            )}
          </div>

          {/* Eerlijke verantwoording */}
          <div className="rounded-xl border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
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
