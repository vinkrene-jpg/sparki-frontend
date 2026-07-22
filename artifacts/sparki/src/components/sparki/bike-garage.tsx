import { useRef, useState } from "react"
import {
  Bike,
  Camera,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Newspaper,
  Trophy,
  TrendingUp,
  Wrench,
  Check,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { fileToResizedPhoto } from "@/hooks/use-material"
import {
  useGarage,
  useAddBike,
  useDeleteBike,
  useUpdateBike,
  useAddBikePhoto,
  useAddComponent,
  useDeleteComponent,
  useUpdateComponent,
  useUpgradeAdvice,
  useGarageCatalog,
  useGarageDevelopments,
  useGarageUsage,
  useComponentUsage,
  useComponentEvents,
  useAddComponentEvent,
  useProTeams,
  type BikeUsage,
  type ComponentEvent,
  type GarageBike,
  type GarageBikeType,
  type GarageComponent,
  type GarageComponentCategory,
  type EquipmentSuggestion,
  type GarageSensor,
} from "@/hooks/use-garage"
import { WirelessSensorsBlock } from "@/components/sparki/wireless-sensors"

const BIKE_TYPES: { key: GarageBikeType; label: string }[] = [
  { key: "race", label: "Racefiets" },
  { key: "mtb", label: "Mountainbike" },
  { key: "gravel", label: "Gravelbike" },
  { key: "tt", label: "Tijdritfiets" },
  { key: "baan", label: "Baanfiets" },
  { key: "cyclocross", label: "Veldritfiets" },
  { key: "stads", label: "Stadsfiets" },
  { key: "anders", label: "Anders" },
]

const BIKE_TYPE_LABEL = Object.fromEntries(
  BIKE_TYPES.map((t) => [t.key, t.label]),
) as Record<GarageBikeType, string>

const BIKE_CATEGORIES: { key: GarageComponentCategory; label: string }[] = [
  { key: "groepset", label: "Groepset" },
  { key: "wielen", label: "Wielen" },
  { key: "banden", label: "Banden" },
  { key: "achterderailleur", label: "Achterderailleur" },
  { key: "voorderailleur", label: "Voorderailleur" },
  { key: "crankstel", label: "Crankstel" },
  { key: "cassette", label: "Cassette" },
  { key: "ketting", label: "Ketting" },
  { key: "remmen", label: "Remmen" },
  { key: "cockpit", label: "Stuur / cockpit" },
  { key: "zadel", label: "Zadel" },
  { key: "pedalen", label: "Pedalen" },
  { key: "onderdeel", label: "Overig onderdeel" },
]

const PERSONAL_CATEGORIES: { key: GarageComponentCategory; label: string }[] = [
  { key: "helm", label: "Helm" },
  { key: "kleding", label: "Kleding" },
  { key: "schoenen", label: "Schoenen" },
]

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  [...BIKE_CATEGORIES, ...PERSONAL_CATEGORIES].map((c) => [c.key, c.label]),
)

const SPECIALISMS: { key: string; label: string }[] = [
  { key: "klimmen", label: "Klimmen" },
  { key: "tijdrit", label: "Tijdrijden" },
  { key: "duur", label: "Duurwerk" },
  { key: "sprint", label: "Sprinten" },
]

function AssessmentLine({ component }: { component: GarageComponent }) {
  const a = component.assessment
  if (!a.known) {
    return (
      <p className="mt-1 text-[12px] leading-relaxed text-white/40">
        Nog niet in de kennisbank — {a.reason}
      </p>
    )
  }
  const e = a.entry
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span
        className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
        style={{ color: ACCENT, background: "rgba(120,210,230,0.1)" }}
      >
        {e.klasseLabel}
      </span>
      {e.aero && (
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
          Aero: {e.aero}
        </span>
      )}
      {e.gewicht && (
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
          Gewicht: {e.gewicht}
        </span>
      )}
      {e.richtprijs && (
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
          Richtprijs nieuw: €{e.richtprijs.van}–{e.richtprijs.tot}
        </span>
      )}
      <span className="w-full text-[12px] leading-relaxed text-white/45">
        {e.note}
      </span>
    </div>
  )
}

const COMPONENT_STATUS_LABEL: Record<string, string> = {
  in_gebruik: "In gebruik",
  vervangen: "Vervangen",
  defect_vermoed: "Mogelijk versleten",
  defect_vastgesteld: "Defect vastgesteld",
}

const EVENT_TYPE_OPTIONS: { key: ComponentEvent["eventType"]; label: string }[] = [
  { key: "onderhoud", label: "Onderhoud" },
  { key: "reparatie", label: "Reparatie" },
  { key: "vervanging", label: "Vervangen" },
  { key: "controle", label: "Gecontroleerd" },
  { key: "defect_vastgesteld", label: "Defect vastgesteld" },
]

function todayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Logboek + registratie van onderhoud/reparatie/vervanging per onderdeel.
function ComponentLogboek({ component }: { component: GarageComponent }) {
  const { data } = useComponentEvents(component.id)
  const { data: usageData } = useComponentUsage(component.id)
  const addEvent = useAddComponentEvent()
  const [adding, setAdding] = useState(false)
  const [eventType, setEventType] =
    useState<ComponentEvent["eventType"]>("onderhoud")
  const [eventDate, setEventDate] = useState(todayStr())
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const events = data?.events ?? []
  const usage = usageData?.usage

  return (
    <div className="mt-2 space-y-2 border-t border-white/[0.06] pt-2">
      {usage && usage.rides > 0 ? (
        <p className="text-[11px] text-white/45">
          {Math.round(usage.km)} km · {usage.hours.toFixed(1)} uur ·{" "}
          {usage.rides} ritten sinds{" "}
          {usage.basis === "montagedatum" ? "montage" : "registratie"}
          {usage.since ? ` (${usage.since})` : ""} — afgeleid uit je gekoppelde
          ritten.
        </p>
      ) : (
        <p className="text-[11px] text-white/35">
          Nog geen gekoppelde ritten voor dit onderdeel — kilometers en uren
          verschijnen zodra ritten aan deze fiets gekoppeld zijn.
        </p>
      )}

      {events.length > 0 && (
        <div className="space-y-1">
          {events.map((e) => (
            <p key={e.id} className="text-[11.5px] leading-snug text-white/55">
              <span className="text-white/75">
                {EVENT_TYPE_OPTIONS.find((o) => o.key === e.eventType)?.label ??
                  e.eventType}
              </span>{" "}
              · {e.eventDate}
              {e.kmAtEvent != null &&
                ` · ${Math.round(Number(e.kmAtEvent))} km-stand`}
              {e.note && <span className="text-white/40"> — {e.note}</span>}
            </p>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPE_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setEventType(o.key)}
                className="rounded-full border px-2.5 py-1 text-[11px]"
                style={
                  eventType === o.key
                    ? { borderColor: ACCENT, color: ACCENT, background: "rgba(120,210,230,0.08)" }
                    : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          {eventType === "vervanging" && (
            <p className="text-[11px] leading-snug text-white/45">
              Bij vervangen begint de kilometertelling van dit onderdeel opnieuw
              vanaf deze datum.
            </p>
          )}
          {eventType === "defect_vastgesteld" && (
            <p className="text-[11px] leading-snug text-amber-200/70">
              Rijd niet verder op een onderdeel dat je zelf als defect
              beoordeelt voordat het gecontroleerd of vervangen is.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/85 outline-none focus:border-cyan-300/40"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notitie (optioneel)"
              className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
            />
          </div>
          {error && <p className="text-[11.5px] text-red-300/80">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={addEvent.isPending || !eventDate}
              onClick={() => {
                setError(null)
                addEvent.mutate(
                  {
                    componentId: component.id,
                    eventType,
                    eventDate,
                    note: note.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setAdding(false)
                      setNote("")
                    },
                    onError: () => setError("Kon dit niet opslaan."),
                  },
                )
              }}
              className="rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-black disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {addEvent.isPending ? "Bezig…" : "Vastleggen"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40"
            >
              Annuleren
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 transition-colors hover:text-cyan-200"
        >
          <Wrench className="h-3 w-3" strokeWidth={1.75} />
          Onderhoud of vervanging vastleggen
        </button>
      )}
    </div>
  )
}

function ComponentRow({
  component,
  onDelete,
}: {
  component: GarageComponent
  onDelete: () => void
}) {
  const update = useUpdateComponent()
  const [open, setOpen] = useState(false)
  const statusTone =
    component.status === "defect_vastgesteld"
      ? { color: "rgb(252,165,165)", background: "rgba(252,165,165,0.1)" }
      : component.status === "defect_vermoed"
        ? { color: "rgb(253,230,138)", background: "rgba(253,230,138,0.1)" }
        : { color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 text-left"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            {CATEGORY_LABEL[component.category] ?? component.category}
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-white/85">
            {[component.brand, component.model].filter(Boolean).join(" ") ||
              "Merk en model nog onbekend"}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {component.status !== "in_gebruik" && (
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em]"
              style={statusTone}
            >
              {COMPONENT_STATUS_LABEL[component.status] ?? component.status}
            </span>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Onderdeel verwijderen"
            className="text-white/25 transition-colors hover:text-red-300/70"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {/* Herkend uit een scan of foto maar nog niet bevestigd — de renner
          bevestigt zelf; nooit stilzwijgend als vaststaand behandelen. */}
      {!component.confirmed && component.source !== "handmatig" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.05] px-2.5 py-2">
          <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-white/60">
            Herkend uit je foto's — klopt dit onderdeel?
          </p>
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: component.id, confirmed: true })}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-300/40 px-2.5 py-1 text-[11px] text-cyan-200 disabled:opacity-50"
          >
            <Check className="h-3 w-3" strokeWidth={2} />
            Klopt
          </button>
        </div>
      )}
      <AssessmentLine component={component} />
      {open && <ComponentLogboek component={component} />}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 transition-colors hover:text-white/60"
        >
          Gebruik & logboek
        </button>
      )}
    </div>
  )
}

function AddComponentForm({
  bikeId,
  categories,
  onClose,
}: {
  bikeId?: number
  categories: { key: GarageComponentCategory; label: string }[]
  onClose: () => void
}) {
  const add = useAddComponent()
  const [category, setCategory] = useState<GarageComponentCategory>(
    categories[0]!.key,
  )
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [error, setError] = useState<string | null>(null)
  // Bekende producten uit de kennisbank voor deze categorie — aantikken vult
  // merk en model in. Vrije invoer blijft altijd mogelijk.
  const catalog = useGarageCatalog(category)
  const catalogItems = catalog.data?.items ?? []

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-white/80">
          Onderdeel toevoegen
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="text-white/40"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
            style={
              category === c.key
                ? { borderColor: ACCENT, color: ACCENT, background: "rgba(120,210,230,0.08)" }
                : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
            }
          >
            {c.label}
          </button>
        ))}
      </div>
      {catalogItems.length > 0 && (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            Veelgebruikt — tik aan of typ zelf
          </p>
          <div className="flex flex-wrap gap-1.5">
            {catalogItems.map((it) => {
              const selected = brand === it.brand && model === it.model
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => {
                    setBrand(it.brand)
                    setModel(it.model)
                  }}
                  className="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                  style={
                    selected
                      ? { borderColor: ACCENT, color: ACCENT, background: "rgba(120,210,230,0.08)" }
                      : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {it.brand} {it.model}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Merk (bijv. Shimano)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model (bijv. Ultegra Di2)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
      </div>
      {error && <p className="text-[12px] text-red-300/80">{error}</p>}
      <button
        type="button"
        disabled={add.isPending}
        onClick={() => {
          setError(null)
          add.mutate(
            {
              bikeId,
              category,
              brand: brand.trim() || undefined,
              model: model.trim() || undefined,
            },
            {
              onSuccess: onClose,
              onError: () => setError("Kon het onderdeel niet opslaan."),
            },
          )
        }}
        className="rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black disabled:opacity-50"
        style={{ background: ACCENT }}
      >
        {add.isPending ? "Bezig…" : "Opslaan"}
      </button>
    </div>
  )
}

function UpgradePanel({ bike }: { bike: GarageBike }) {
  const [specialism, setSpecialism] = useState<string | null>(null)
  const { data, isLoading } = useUpgradeAdvice(bike.id, specialism)
  const advice = data?.advice

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
        <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
        Verbeteren — waar zit de grootste winst?
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SPECIALISMS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSpecialism(s.key)}
            className="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
            style={
              specialism === s.key
                ? { borderColor: ACCENT, color: ACCENT, background: "rgba(120,210,230,0.08)" }
                : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {specialism && isLoading && (
        <p className="mt-3 text-[12px] text-white/40">Bezig…</p>
      )}

      {advice && (
        <div className="mt-3 space-y-2">
          {advice.suggestions.length === 0 &&
            advice.unknown.length === 0 &&
            advice.alreadyTop.length === 0 && (
              <p className="text-[12px] leading-relaxed text-white/45">
                Er staan nog geen onderdelen op deze fiets. Voeg eerst je
                groepset, wielen of banden toe — dan kan Sparki zien waar de
                winst zit.
              </p>
            )}
          {advice.suggestions.map((s) => (
            <div
              key={s.componentId}
              className="rounded-lg border border-white/[0.06] p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-white/85">
                  {CATEGORY_LABEL[s.category] ?? s.category}
                  <span className="text-white/40">
                    {" "}
                    — nu {s.current.klasseLabel.toLowerCase()}
                  </span>
                </p>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={
                    s.gain === "groot"
                      ? { color: ACCENT, background: "rgba(120,210,230,0.12)" }
                      : { color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.06)" }
                  }
                >
                  {s.gainLabel}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50">
                {s.why}
              </p>
              {s.besteKoop && (
                <p
                  className="mt-1.5 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: ACCENT, background: "rgba(120,210,230,0.12)" }}
                >
                  Meeste winst per euro
                </p>
              )}
              {s.targets.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {s.targets.map((t) => (
                    <p
                      key={`${t.brand}-${t.model}`}
                      className="text-[12px] leading-relaxed text-white/55"
                    >
                      → {t.brand} {t.model}{" "}
                      <span className="text-white/35">
                        ({t.klasseLabel.toLowerCase()}
                        {t.richtprijs
                          ? `, richtprijs €${t.richtprijs.van}–${t.richtprijs.tot}`
                          : ""}
                        )
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
          {advice.suggestions.some((s) => s.targets.length > 0) && (
            <p className="text-[11px] leading-relaxed text-white/35">
              {advice.prijsToelichting}
            </p>
          )}
          {advice.alreadyTop.map((t) => (
            <p key={t.componentId} className="text-[12px] leading-relaxed text-white/40">
              {t.label}
            </p>
          ))}
          {advice.unknown.length > 0 && (
            <p className="text-[12px] leading-relaxed text-white/40">
              {advice.unknown.length === 1
                ? "1 onderdeel is nog niet herkend"
                : `${advice.unknown.length} onderdelen zijn nog niet herkend`}{" "}
              — vul merk en model aan, dan telt het mee in dit advies.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function BikeCard({
  bike,
  sensors,
  usage,
}: {
  bike: GarageBike
  sensors: GarageSensor[]
  usage?: BikeUsage
}) {
  const deleteBike = useDeleteBike()
  const updateBike = useUpdateBike()
  const deleteComponent = useDeleteComponent()
  const addPhoto = useAddBikePhoto()
  const fileRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          {bike.photoPaths.length > 0 ? (
            <img
              src={`/api/garage/photo/${bike.id}/0`}
              alt={bike.name}
              className="h-12 w-12 shrink-0 rounded-lg border border-white/[0.08] object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-white/30">
              <Bike className="h-5 w-5" strokeWidth={1.5} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-white/90">
              {bike.name}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              {BIKE_TYPE_LABEL[bike.bikeType] ?? bike.bikeType}
              {(bike.brand || bike.model) &&
                ` · ${[bike.brand, bike.model].filter(Boolean).join(" ")}`}
              {bike.buildYear != null && ` · ${bike.buildYear}`}
              {bike.status === "archief" && " · Archief"}
            </p>
            {usage && usage.rides > 0 ? (
              <p className="mt-0.5 text-[11px] text-white/45">
                {Math.round(usage.km)} km · {usage.hours.toFixed(1)} uur ·{" "}
                {usage.rides} ritten — uit je gekoppelde ritten
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-white/30">
                Nog geen ritten aan deze fiets gekoppeld
              </p>
            )}
            {bike.purpose && (
              <p className="mt-0.5 truncate text-[11px] text-white/40">
                {bike.purpose}
              </p>
            )}
          </div>
        </div>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-white/35 transition-transform ${expanded ? "rotate-90" : ""}`}
          strokeWidth={1.75}
        />
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {bike.photoPaths.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {bike.photoPaths.map((_, i) => (
                <img
                  key={i}
                  src={`/api/garage/photo/${bike.id}/${i}`}
                  alt={`Foto ${i + 1}`}
                  className="h-20 w-20 shrink-0 rounded-lg border border-white/[0.08] object-cover"
                />
              ))}
            </div>
          )}

          {bike.components.length > 0 ? (
            <div className="space-y-2">
              {bike.components.map((c) => (
                <ComponentRow
                  key={c.id}
                  component={c}
                  onDelete={() => deleteComponent.mutate(c.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] leading-relaxed text-white/40">
              Nog geen onderdelen vastgelegd. Begin met je groepset — dat zegt
              het meest over deze fiets.
            </p>
          )}

          {adding ? (
            <AddComponentForm
              bikeId={bike.id}
              categories={BIKE_CATEGORIES}
              onClose={() => setAdding(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/35"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Onderdeel
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    void (async () => {
                      try {
                        const p = await fileToResizedPhoto(f)
                        addPhoto.mutate({
                          bikeId: bike.id,
                          data: p.data,
                          mediaType: p.mediaType,
                        })
                      } catch {
                        /* mutation error state covers feedback */
                      }
                    })()
                  }
                  e.target.value = ""
                }}
              />
              {bike.photoPaths.length < 4 && (
                <button
                  type="button"
                  disabled={addPhoto.isPending}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/35 disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {addPhoto.isPending ? "Bezig…" : "Foto"}
                </button>
              )}
              <button
                type="button"
                disabled={updateBike.isPending}
                onClick={() =>
                  updateBike.mutate({
                    id: bike.id,
                    status: bike.status === "archief" ? "actief" : "archief",
                  })
                }
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 transition-colors hover:text-white/70 disabled:opacity-40"
              >
                {bike.status === "archief"
                  ? "Terug naar actief"
                  : "Naar archief"}
              </button>
              <button
                type="button"
                disabled={deleteBike.isPending}
                onClick={() => {
                  if (window.confirm(`"${bike.name}" en alle onderdelen verwijderen? De ritten zelf blijven bestaan; alleen de koppeling met deze fiets verdwijnt.`)) {
                    deleteBike.mutate(bike.id)
                  }
                }}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 transition-colors hover:text-red-300/70 disabled:opacity-40"
              >
                Verwijderen
              </button>
            </div>
          )}

          <WirelessSensorsBlock bikeId={bike.id} sensors={sensors} />

          <UpgradePanel bike={bike} />
        </div>
      )}
    </div>
  )
}

function AddBikeForm({
  suggestion,
  onClose,
}: {
  suggestion?: EquipmentSuggestion
  onClose: () => void
}) {
  const add = useAddBike()
  const [bikeType, setBikeType] = useState<GarageBikeType>("race")
  const [name, setName] = useState(suggestion?.name ?? "")
  const [brand, setBrand] = useState(suggestion?.brand ?? "")
  const [model, setModel] = useState(suggestion?.model ?? "")
  const [buildYear, setBuildYear] = useState("")
  const [purpose, setPurpose] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3 rounded-2xl border border-white/[0.1] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-white/85">
          {suggestion ? "Fiets overnemen" : "Fiets toevoegen"}
        </p>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="text-white/40">
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      {suggestion && (
        <p className="text-[12px] leading-relaxed text-white/45">
          Overgenomen uit je gekoppelde gegevens — controleer en vul aan.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {BIKE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setBikeType(t.key)}
            className="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
            style={
              bikeType === t.key
                ? { borderColor: ACCENT, color: ACCENT, background: "rgba(120,210,230,0.08)" }
                : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Naam (bijv. Mijn racefiets)"
        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Merk (optioneel)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model (optioneel)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={buildYear}
          onChange={(e) => setBuildYear(e.target.value)}
          inputMode="numeric"
          placeholder="Bouwjaar (optioneel)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Waarvoor gebruik je 'm? (bijv. wedstrijden)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
      </div>
      {error && <p className="text-[12px] text-red-300/80">{error}</p>}
      <button
        type="button"
        disabled={add.isPending || !name.trim()}
        onClick={() => {
          setError(null)
          add.mutate(
            {
              bikeType,
              name: name.trim(),
              brand: brand.trim() || undefined,
              model: model.trim() || undefined,
              equipmentId: suggestion?.id,
              buildYear: buildYear.trim() ? Number(buildYear) : undefined,
              purpose: purpose.trim() || undefined,
            },
            {
              onSuccess: onClose,
              onError: () => setError("Kon de fiets niet opslaan."),
            },
          )
        }}
        className="rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-black disabled:opacity-50"
        style={{ background: ACCENT }}
      >
        {add.isPending ? "Bezig…" : "Opslaan"}
      </button>
    </div>
  )
}

function Developments() {
  const { data, isLoading, isError } = useGarageDevelopments()
  const items = data?.items ?? []
  return (
    <div className="mt-6">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
        <Newspaper className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
        Nieuwe ontwikkelingen
      </p>
      {isLoading && <p className="mt-2 text-[12px] text-white/40">Bezig…</p>}
      {isError && (
        <p className="mt-2 text-[12px] text-white/40">
          Kon nieuwe ontwikkelingen nu niet laden.
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="mt-2 text-[12px] leading-relaxed text-white/40">
          Er is op dit moment geen materiaalnieuws dat bij jouw fietsen past.
          Zodra er iets relevants verschijnt, zie je het hier.
        </p>
      )}
      <div className="mt-2 space-y-2">
        {items.map((it) => (
          <a
            key={it.id}
            href={it.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-cyan-300/25"
          >
            <p className="text-[13px] font-medium leading-snug text-white/85">
              {it.title}
            </p>
            {it.summary && (
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/50">
                {it.summary}
              </p>
            )}
            <p className="mt-1 font-mono text-[10px] tracking-wide text-white/30">
              {[it.source, it.publishedAt].filter(Boolean).join(" · ")}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}

function ProTeams() {
  const { data, isLoading } = useProTeams()
  if (isLoading || !data) return null
  return (
    <div className="mt-6">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
        <Trophy className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
        Profploegen en hun materiaal
      </p>
      <div className="mt-2 space-y-2">
        {data.teams.map((t) => (
          <div
            key={t.name}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <p className="text-[13px] font-medium text-white/85">{t.name}</p>
            <p className="mt-0.5 text-[12px] text-white/50">
              {t.bike} · {t.groupset} · {t.wheels}
            </p>
            {t.matches.map((m, i) => (
              <p key={i} className="mt-1 text-[12px]" style={{ color: ACCENT }}>
                {m}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-wide text-white/25">
        {data.season} · Bron: {data.source}
      </p>
    </div>
  )
}

export function BikeGarage({ n = "" }: { n?: string } = {}) {
  const { data, isLoading, isError } = useGarage()
  const { data: usageData } = useGarageUsage()
  const deleteComponent = useDeleteComponent()
  const [showArchive, setShowArchive] = useState(false)
  const [addingBike, setAddingBike] = useState(false)
  const [adoptSuggestion, setAdoptSuggestion] =
    useState<EquipmentSuggestion | null>(null)
  const [addingGear, setAddingGear] = useState(false)

  return (
    <section>
      <SectionLabel n={n} title="Fietsengarage" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/35">
        Leg je fietsen en uitrusting vast. Per herkend onderdeel zie je een
        eerlijke beoordeling uit de kennisbank — en waar per specialisme de
        grootste winst zit. Onbekende onderdelen blijven eerlijk onbekend.
      </p>

      {isLoading && <p className="mt-4 text-[12px] text-white/40">Bezig…</p>}
      {isError && (
        <p className="mt-4 text-[12px] text-white/50">
          Kon de fietsengarage nu niet laden. Probeer het later opnieuw.
        </p>
      )}

      {data && (
        <div className="mt-4 space-y-3">
          {data.equipmentSuggestions.length > 0 && !adoptSuggestion && (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Al bekend uit je gekoppelde gegevens
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                {data.equipmentSuggestions.length === 1
                  ? "Er staat al een fiets in je gekoppelde gegevens."
                  : `Er staan al ${data.equipmentSuggestions.length} fietsen in je gekoppelde gegevens.`}{" "}
                Neem ze over — dan hoef je niets dubbel in te voeren.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.equipmentSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setAdoptSuggestion(s)}
                    className="rounded-lg border border-white/15 px-3 py-2 text-[12px] text-white/80 transition-colors hover:border-cyan-300/40"
                  >
                    {s.name} overnemen
                  </button>
                ))}
              </div>
            </div>
          )}

          {adoptSuggestion && (
            <AddBikeForm
              suggestion={adoptSuggestion}
              onClose={() => setAdoptSuggestion(null)}
            />
          )}

          {data.bikes
            .filter((b) => b.status !== "archief")
            .map((b) => (
              <BikeCard
                key={b.id}
                bike={b}
                sensors={data.sensors ?? []}
                usage={usageData?.usage[String(b.id)]}
              />
            ))}

          {data.bikes.some((b) => b.status === "archief") && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchive((v) => !v)}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition-colors hover:text-white/65"
              >
                {showArchive ? "Archief verbergen" : "Archief tonen"} (
                {data.bikes.filter((b) => b.status === "archief").length})
              </button>
              {showArchive && (
                <div className="mt-2 space-y-3">
                  {data.bikes
                    .filter((b) => b.status === "archief")
                    .map((b) => (
                      <BikeCard
                        key={b.id}
                        bike={b}
                        sensors={data.sensors ?? []}
                        usage={usageData?.usage[String(b.id)]}
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {data.bikes.length === 0 && !addingBike && !adoptSuggestion && (
            <p className="text-[13px] leading-relaxed text-white/45">
              Nog geen fietsen in je garage. Voeg je eerste fiets toe — daarna
              kan Sparki je uitrusting eerlijk beoordelen.
            </p>
          )}

          {addingBike ? (
            <AddBikeForm onClose={() => setAddingBike(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAddingBike(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/35"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Fiets toevoegen
            </button>
          )}

          <div className="mt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
              Persoonlijke uitrusting
            </p>
            {data.personalGear.length > 0 ? (
              <div className="mt-2 space-y-2">
                {data.personalGear.map((c) => (
                  <ComponentRow
                    key={c.id}
                    component={c}
                    onDelete={() => deleteComponent.mutate(c.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[12px] leading-relaxed text-white/40">
                Nog geen helm, kleding of schoenen vastgelegd.
              </p>
            )}
            {addingGear ? (
              <div className="mt-2">
                <AddComponentForm
                  categories={PERSONAL_CATEGORIES}
                  onClose={() => setAddingGear(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingGear(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/35"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Uitrusting toevoegen
              </button>
            )}
          </div>

          <div className="mt-2">
            <WirelessSensorsBlock
              bikeId={null}
              sensors={data.sensors ?? []}
              bikes={(data.bikes ?? []).map((b) => ({ id: b.id, name: b.name }))}
            />
          </div>

          <Developments />
          <ProTeams />
        </div>
      )}
    </section>
  )
}
