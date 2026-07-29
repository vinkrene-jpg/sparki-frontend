import { useMemo, useState } from "react"
import { Link } from "wouter"
import {
  useGarage,
  useTestEstimate,
  useCompareTestRides,
  type GarageComponentCategory,
  type UpgradeEstimate,
} from "@/hooks/use-garage"
import { useSessions } from "@/hooks/use-sessions"

// Vergelijkingstest — twee echte ritten met opstelling A vs B, plus een
// modelschatting vooraf voor een geplande upgrade. Eerlijkheidsregels:
// de schatting is expliciet "modelschatting — geen meting", en de test is
// alleen zinvol op dezelfde dag / gelijke omstandigheden (staat in de UI).

const CATEGORY_OPTIONS: { value: GarageComponentCategory; label: string }[] = [
  { value: "wielen", label: "Wielen" },
  { value: "banden", label: "Banden" },
  { value: "helm", label: "Helm" },
  { value: "kleding", label: "Kleding" },
  { value: "cockpit", label: "Stuur / cockpit" },
  { value: "groepset", label: "Groepset" },
  { value: "crankstel", label: "Crankstel" },
  { value: "cassette", label: "Cassette" },
  { value: "zadel", label: "Zadel" },
  { value: "pedalen", label: "Pedalen" },
  { value: "schoenen", label: "Schoenen" },
  { value: "anders", label: "Anders" },
]

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#070d16]/80 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-400/40 focus:outline-none"

function EstimateCard({ estimate }: { estimate: UpgradeEstimate }) {
  if (!estimate.known) {
    return (
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100/90">
        {estimate.reason}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="mb-2 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-cyan-200">
        Modelschatting — geen meting
      </div>
      <div className="text-sm text-white">
        {estimate.planned.brand} {estimate.planned.model}{" "}
        <span className="text-white/50">· klasse {estimate.planned.klasseLabel}</span>
      </div>
      {estimate.current && (
        <div className="mt-1 text-xs text-white/55">
          Nu: {estimate.current.brand ?? "?"} {estimate.current.model ?? ""}
          {estimate.current.klasseLabel
            ? ` · klasse ${estimate.current.klasseLabel}`
            : " · niet in de kennisbank"}
        </div>
      )}
      <p className="mt-2 text-sm text-white/75">{estimate.verwachting}</p>
      {estimate.planned.note && (
        <p className="mt-1 text-xs text-white/50">{estimate.planned.note}</p>
      )}
      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">
          Voorgestelde test: {estimate.testMode.title}
        </div>
        <p className="mt-1 text-sm text-white/75">{estimate.testMode.protocol}</p>
        <p className="mt-1 text-xs text-white/55">{estimate.testMode.meting}</p>
      </div>
      <p className="mt-3 text-xs text-white/50">{estimate.sameDayRule}</p>
    </div>
  )
}

export function MaterialTest() {
  const { data: garage } = useGarage()
  const { data: sessions } = useSessions(30)
  const estimateMutation = useTestEstimate()

  const [category, setCategory] = useState<GarageComponentCategory>("wielen")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [currentComponentId, setCurrentComponentId] = useState<number | null>(null)
  const [rideA, setRideA] = useState<number | null>(null)
  const [rideB, setRideB] = useState<number | null>(null)

  const compare = useCompareTestRides(rideA, rideB)

  const currentOptions = useMemo(() => {
    const comps = (garage?.bikes ?? []).flatMap((b) => b.components ?? [])
    const loose = garage?.personalGear ?? []
    return [...comps, ...loose].filter((c) => c.category === category)
  }, [garage, category])

  const rides = sessions ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Vergelijkingstest</h2>
        <p className="mt-1 text-sm text-white/55">
          Test een upgrade: twee ritten op dezelfde route — één met je huidige
          opstelling, één met de nieuwe. Sparki zet de metingen naast elkaar.
        </p>
        <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
          Let op: een vergelijkingstest is alleen zinvol op dezelfde dag, op
          dezelfde route en bij gelijke omstandigheden (wind, temperatuur, vorm
          van de dag). Anders vergelijk je het weer en je benen — niet je
          materiaal.
        </p>
      </div>

      {/* Modelschatting vooraf */}
      <div className="rounded-xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <h3 className="text-sm font-semibold text-white">
          Van plan iets te kopen? Vraag eerst een modelschatting
        </h3>
        <p className="mt-1 text-xs text-white/55">
          Vul merk en type van de geplande upgrade in. De klasse wordt
          vergeleken met je huidige uitrusting en de best passende test
          voorgesteld — een schatting op klasse-niveau, geen meting.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            className={inputCls}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as GarageComponentCategory)
              setCurrentComponentId(null)
              estimateMutation.reset()
            }}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={currentComponentId ?? ""}
            onChange={(e) =>
              setCurrentComponentId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Huidig onderdeel (optioneel)</option>
            {currentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.brand, c.model].filter(Boolean).join(" ") || "Zonder naam"}
              </option>
            ))}
          </select>
          <input
            className={inputCls}
            placeholder="Merk (bijv. Zipp)"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            maxLength={80}
          />
          <input
            className={inputCls}
            placeholder="Type (bijv. 404 Firecrest)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            maxLength={120}
          />
        </div>
        <button
          type="button"
          disabled={estimateMutation.isPending || (!brand.trim() && !model.trim())}
          onClick={() =>
            estimateMutation.mutate({
              category,
              brand: brand.trim(),
              model: model.trim(),
              ...(currentComponentId != null
                ? { currentComponentId }
                : {}),
            })
          }
          className="mt-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
        >
          {estimateMutation.isPending ? "Bezig…" : "Geef modelschatting"}
        </button>
        {estimateMutation.isError && (
          <p className="mt-2 text-sm text-amber-200/90">
            {estimateMutation.error instanceof Error
              ? estimateMutation.error.message
              : "Kon de modelschatting niet opstellen"}
          </p>
        )}
        {estimateMutation.data && (
          <div className="mt-3">
            <EstimateCard estimate={estimateMutation.data.estimate} />
          </div>
        )}
      </div>

      {/* Rit-vergelijking */}
      <div className="rounded-xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <h3 className="text-sm font-semibold text-white">Vergelijk twee ritten</h3>
        <p className="mt-1 text-xs text-white/55">
          Kies rit A (huidige opstelling) en rit B (nieuwe opstelling). Sparki
          zet de metingen naast elkaar en benoemt wat de vergelijking
          vertroebelt.
        </p>
        {rides.length < 2 ? (
          <div className="mt-3 flex flex-col items-start gap-2">
            <p className="text-sm text-white/60">
              Hiervoor zijn minstens twee opgeslagen ritten nodig. Rij of
              importeer eerst je beide testritten — daarna kun je ze hier
              vergelijken.
            </p>
            <Link
              href="/activiteiten"
              className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
            >
              Naar mijn activiteiten
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([
                ["A — huidige opstelling", rideA, setRideA],
                ["B — nieuwe opstelling", rideB, setRideB],
              ] as const).map(([label, value, setValue]) => (
                <label key={label} className="flex flex-col gap-1 text-xs text-white/55">
                  Rit {label}
                  <select
                    className={inputCls}
                    value={value ?? ""}
                    onChange={(e) =>
                      setValue(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">Kies een rit…</option>
                    {rides.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sessionDate} — {s.title ?? "Rit"}
                        {s.distanceKm ? ` · ${s.distanceKm} km` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {rideA != null && rideA === rideB && (
              <p className="mt-2 text-sm text-amber-200/90">
                Kies twee verschillende ritten.
              </p>
            )}
            {compare.isLoading && (
              <p className="mt-3 text-sm text-white/60">Vergelijking wordt opgesteld…</p>
            )}
            {compare.isError && (
              <p className="mt-3 text-sm text-amber-200/90">
                Kon de ritten niet vergelijken.
              </p>
            )}
            {compare.data && (
              <div className="mt-4">
                {compare.data.comparison.warnings.length > 0 && (
                  <ul className="mb-3 flex flex-col gap-1.5">
                    {compare.data.comparison.warnings.map((w) => (
                      <li
                        key={w}
                        className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/90"
                      >
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs text-white/55">
                        <th className="px-3 py-2 font-medium">Meting</th>
                        <th className="px-3 py-2 font-medium">A</th>
                        <th className="px-3 py-2 font-medium">B</th>
                        <th className="px-3 py-2 font-medium">Verschil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compare.data.comparison.metrics.map((m) => (
                        <tr key={m.key} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-2 text-white/70">{m.label}</td>
                          <td className="px-3 py-2 text-white">
                            {m.a != null ? `${m.a} ${m.unit}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-white">
                            {m.b != null ? `${m.b} ${m.unit}` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {m.delta != null ? (
                              <span
                                className={
                                  m.delta === 0
                                    ? "text-white/60"
                                    : "text-cyan-200"
                                }
                              >
                                {m.delta > 0 ? "+" : ""}
                                {m.delta} {m.unit}
                              </span>
                            ) : (
                              <span className="text-white/40">niet gemeten</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {compare.data.comparison.verdict ? (
                  <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-sm text-white/85">
                    {compare.data.comparison.verdict}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-white/55">
                    Deze twee ritten zijn niet schoon genoeg om een conclusie
                    over materiaal te trekken — zie de kanttekeningen hierboven.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
