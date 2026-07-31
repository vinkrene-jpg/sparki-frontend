import { useEffect, useState } from "react"
import { IconCheck } from "@/components/ds"
import { ACCENT } from "@/components/sparki/ui"
import {
  NAV_DATA_FIELDS,
  useNavSettings,
  useSaveNavSettings,
  type NavDataField,
  type NavSettings,
} from "@/hooks/use-nav-settings"

// Nederlandse labels voor de datavelden op het navigatiescherm.
const FIELD_LABELS: Record<NavDataField, string> = {
  snelheid: "Snelheid",
  gemiddelde: "Gem. snelheid",
  afstand: "Afstand gereden",
  resterend: "Afstand te gaan",
  tijd: "Kloktijd",
  bewegingstijd: "Bewegingstijd",
  eta: "Verwachte aankomst",
  hartslag: "Hartslag",
  vermogen: "Vermogen",
  cadans: "Cadans",
  hoogte: "Hoogte",
  stijging: "Stijging",
}

// Eerlijke defaults: dit is wat het navigatiescherm nu al laat zien wanneer er
// nog niets is opgeslagen.
export const NAV_SETTINGS_DEFAULTS: NavSettings = {
  dataFields: ["snelheid", "afstand", "resterend", "tijd"],
  maxFields: 4,
  fontSize: "normaal",
  barPosition: "boven",
  headingUp: false,
  autoClimb: true,
  autoPois: true,
  autoSprint: false,
  soundCues: true,
  voiceCues: true,
}

function pill(active: boolean) {
  return `rounded-full border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
    active
      ? "border-cyan-300/50 text-cyan-300"
      : "border-white/[0.14] text-white/55 hover:border-white/30"
  }`
}

// Persistente navigatie-instellingen: welke datavelden je onderweg ziet, hoe
// groot, waar de balk staat en welke automatische lagen aanstaan. Opslag via
// /api/nav-settings zodat de keuze op elk apparaat terugkomt.
export function NavSettingsPanel() {
  const { data, isLoading, isError } = useNavSettings()
  const save = useSaveNavSettings()
  const [draft, setDraft] = useState<NavSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data === undefined) return
    // Legacy rijen missen soundCues/voiceCues; contract is "afwezig = aan",
    // dus normaliseer vóór render zodat de toggles de echte status tonen.
    const s = data.settings
    setDraft(
      s
        ? { ...s, soundCues: s.soundCues !== false, voiceCues: s.voiceCues !== false }
        : NAV_SETTINGS_DEFAULTS,
    )
  }, [data])

  if (isLoading || draft === null) {
    if (isError)
      return (
        <p className="text-[12px] text-[rgba(255,140,120,0.85)]">
          Instellingen konden niet worden geladen — probeer het later opnieuw.
        </p>
      )
    return <div className="h-40 w-full animate-pulse rounded-xl bg-white/[0.06]" />
  }

  function update(patch: Partial<NavSettings>) {
    setSaved(false)
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  function toggleField(f: NavDataField) {
    const has = draft!.dataFields.includes(f)
    const next = has
      ? draft!.dataFields.filter((x) => x !== f)
      : [...draft!.dataFields, f]
    if (next.length === 0) return // minstens één veld
    update({ dataFields: next })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          DATAVELDEN OP HET SCHERM
        </label>
        <p className="mb-2 text-[12px] leading-relaxed text-white/40">
          Kies wat je onderweg wilt zien. Sensorvelden (hartslag, vermogen,
          cadans) werken zodra de bijbehorende sensor gekoppeld is.
        </p>
        <div className="flex flex-wrap gap-2">
          {NAV_DATA_FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggleField(f)}
              className={pill(draft.dataFields.includes(f))}
            >
              {FIELD_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          MAXIMAAL TEGELIJK ZICHTBAAR
        </label>
        <div className="flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update({ maxFields: n })}
              className={pill(draft.maxFields === n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            LETTERGROOTTE
          </label>
          <div className="flex gap-2">
            {(["klein", "normaal", "groot"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update({ fontSize: s })}
                className={pill(draft.fontSize === s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            DATABALK
          </label>
          <div className="flex gap-2">
            {(["boven", "onder"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ barPosition: p })}
                className={pill(draft.barPosition === p)}
              >
                {p === "boven" ? "Bovenaan" : "Onderaan"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          KAART & AUTOMATISCHE LAGEN
        </label>
        <div className="flex flex-col gap-2">
          {(
            [
              {
                k: "headingUp" as const,
                l: "Kaart draait mee met je rijrichting",
              },
              { k: "autoClimb" as const, l: "Klimprofiel automatisch tonen" },
              {
                k: "autoPois" as const,
                l: "Stops onderweg tonen (koffie, water, pech)",
              },
              // "autoSprint" verwijderd uit de lijst: bordjes sprinten is
              // gestopt (veiligheidsrisico op openbare weg, besluit
              // 31-07-2026). De opgeslagen voorkeur blijft bestaan maar doet
              // niets meer.
              {
                k: "soundCues" as const,
                l: "Geluidssignalen bij afslagen (korte tonen)",
              },
              {
                k: "voiceCues" as const,
                l: "Gesproken aanwijzingen (bijv. \u201cover 200 meter rechtsaf\u201d)",
              },
            ] satisfies { k: keyof NavSettings; l: string }[]
          ).map(({ k, l }) => (
            <button
              key={k}
              type="button"
              role="switch"
              aria-checked={draft[k]}
              onClick={() => update({ [k]: !draft[k] } as Partial<NavSettings>)}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-3 text-left"
            >
              <span className="text-[13px] text-white/80">{l}</span>
              {/* Echte schakelaar (groter raakvlak) i.p.v. mini-pill; puur decoratief */}
              <span
                aria-hidden
                className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
                style={{
                  background: draft[k]
                    ? "rgba(120,210,230,0.35)"
                    : "rgba(255,255,255,0.08)",
                }}
              >
                <span
                  className="absolute h-5 w-5 rounded-full transition-all"
                  style={{
                    left: draft[k] ? "calc(100% - 1.5rem)" : "0.25rem",
                    background: draft[k] ? ACCENT : "rgba(255,255,255,0.4)",
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      {save.isError && (
        <p className="text-[12px] text-[rgba(255,140,120,0.85)]">
          {save.error instanceof Error
            ? save.error.message
            : "Opslaan mislukt — probeer het opnieuw."}
        </p>
      )}

      <button
        type="button"
        onClick={() =>
          save.mutate(draft, {
            onSuccess: () => setSaved(true),
          })
        }
        disabled={save.isPending}
        className="mx-auto block w-full max-w-sm rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {save.isPending ? (
          "Opslaan…"
        ) : saved ? (
          <span className="inline-flex items-center justify-center gap-1.5">
            <IconCheck className="h-4 w-4" aria-hidden />
            Opgeslagen
          </span>
        ) : (
          "Instellingen opslaan"
        )}
      </button>
    </div>
  )
}
