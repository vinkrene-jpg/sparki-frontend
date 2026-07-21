import { useState } from "react"
import { Bluetooth, Plus, Trash2, X, Watch, Radio } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useAddSensor,
  useUpdateSensor,
  useDeleteSensor,
  type GarageSensor,
  type GarageSensorKind,
} from "@/hooks/use-garage"

// Draadloze onderdelen per fiets — eerlijk over wat kan en niet kan.
//
// Alleen drie soorten hebben een standaard Bluetooth-profiel dat de browser
// echt kan koppelen: wattagemeter (GATT 0x1818), hartslagmeter (0x180d) en
// cadans-/snelheidssensor (0x1816). Bij het toevoegen van zo'n soort kan de
// renner het apparaat één keer echt koppelen om de apparaatnaam vast te leggen.
// Een horloge of elektronische derailleur gebruikt een eigen protocol dat de
// browser NIET kan uitlezen — die worden alleen geregistreerd (merk/model,
// eventueel een batterijnotitie) en dat staat er in gewone taal bij.

const BT_SERVICE: Partial<Record<GarageSensorKind, number>> = {
  wattagemeter: 0x1818,
  hartslagmeter: 0x180d,
  cadans_snelheid: 0x1816,
}

export const SENSOR_KINDS: {
  key: GarageSensorKind
  label: string
  pairable: boolean
}[] = [
  { key: "wattagemeter", label: "Wattagemeter", pairable: true },
  { key: "hartslagmeter", label: "Hartslagmeter", pairable: true },
  { key: "cadans_snelheid", label: "Cadans-/snelheidssensor", pairable: true },
  { key: "horloge", label: "Horloge", pairable: false },
  { key: "derailleur", label: "Elektronische derailleur", pairable: false },
]

export const SENSOR_KIND_LABEL: Record<string, string> = Object.fromEntries(
  SENSOR_KINDS.map((k) => [k.key, k.label]),
)

export function bluetoothSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { bluetooth?: unknown }).bluetooth !==
      "undefined"
  )
}

// Open the browser's Bluetooth chooser filtered on the kind's real GATT
// service and return the chosen device's advertising name. Returns null when
// the rider cancels the chooser. Throws on real failures.
async function pairDeviceName(kind: GarageSensorKind): Promise<string | null> {
  const service = BT_SERVICE[kind]
  if (service == null || !bluetoothSupported()) return null
  const bt = (navigator as Navigator & { bluetooth: any }).bluetooth
  try {
    const device = await bt.requestDevice({ filters: [{ services: [service] }] })
    return (device?.name as string | undefined) ?? "Onbekend apparaat"
  } catch (err) {
    if ((err as { name?: string })?.name === "NotFoundError") return null
    throw err
  }
}

export function SensorRow({
  sensor,
  bikeName,
  onDelete,
  onDetach,
  attachOptions,
  onAttach,
}: {
  sensor: GarageSensor
  bikeName?: string | null
  onDelete: () => void
  onDetach?: () => void
  attachOptions?: { id: number; name: string }[]
  onAttach?: (bikeId: number) => void
}) {
  const [choosingBike, setChoosingBike] = useState(false)
  const Icon = sensor.pairable ? Radio : Watch
  const name =
    [sensor.brand, sensor.model].filter(Boolean).join(" ") ||
    sensor.deviceName ||
    SENSOR_KIND_LABEL[sensor.kind]
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            <Icon className="h-3 w-3" strokeWidth={1.75} style={{ color: ACCENT }} />
            {SENSOR_KIND_LABEL[sensor.kind] ?? sensor.kind}
            {bikeName && <span className="text-white/25">· {bikeName}</span>}
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-white/85">{name}</p>
          {sensor.deviceName && (
            <p className="mt-0.5 font-mono text-[10px] tracking-wide text-white/35">
              Bluetooth-naam: {sensor.deviceName}
            </p>
          )}
          {sensor.batteryNote && (
            <p className="mt-0.5 text-[12px] text-white/45">
              Batterij: {sensor.batteryNote}
            </p>
          )}
          {!sensor.pairable && (
            <p className="mt-1 text-[11px] leading-snug text-white/35">
              {sensor.kind === "horloge"
                ? "Een horloge kan de browser niet live uitlezen — dit is alleen geregistreerd."
                : "Een elektronische derailleur kan de browser niet live uitlezen — dit is alleen geregistreerd."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onAttach && attachOptions && attachOptions.length > 0 && (
            <button
              type="button"
              onClick={() => setChoosingBike((v) => !v)}
              className="font-mono text-[9px] uppercase tracking-[0.12em] transition-colors"
              style={{ color: choosingBike ? ACCENT : "rgba(255,255,255,0.4)" }}
            >
              Zet op fiets…
            </button>
          )}
          {onDetach && (
            <button
              type="button"
              onClick={onDetach}
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30 transition-colors hover:text-white/60"
            >
              Losmaken
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Draadloos onderdeel verwijderen"
            className="text-white/25 transition-colors hover:text-red-300/70"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {choosingBike && onAttach && attachOptions && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {attachOptions.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setChoosingBike(false)
                onAttach(b.id)
              }}
              className="rounded-full border border-cyan-400/30 px-3 py-1.5 text-[12px] text-cyan-200 transition hover:bg-cyan-400/10"
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddSensorForm({
  bikeId,
  onClose,
}: {
  bikeId: number | null
  onClose: () => void
}) {
  const add = useAddSensor()
  const [kind, setKind] = useState<GarageSensorKind>("wattagemeter")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [batteryNote, setBatteryNote] = useState("")
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = SENSOR_KINDS.find((k) => k.key === kind)!
  const btOk = bluetoothSupported()

  const save = () => {
    setError(null)
    add.mutate(
      {
        bikeId,
        kind,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        deviceName: deviceName ?? undefined,
        batteryNote: batteryNote.trim() || undefined,
      },
      {
        onSuccess: onClose,
        onError: () => setError("Kon het draadloze onderdeel niet opslaan."),
      },
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-white/80">
          Draadloos onderdeel toevoegen
        </p>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="text-white/40">
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SENSOR_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => {
              setKind(k.key)
              setDeviceName(null)
            }}
            className="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
            style={
              kind === k.key
                ? { borderColor: ACCENT, color: ACCENT, background: "rgba(120,210,230,0.08)" }
                : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      {meta.pairable ? (
        btOk ? (
          <div className="space-y-1.5">
            {deviceName ? (
              <p className="text-[12px] text-white/60">
                Gekoppeld apparaat: <span className="text-white/85">{deviceName}</span>
              </p>
            ) : (
              <button
                type="button"
                disabled={pairing}
                onClick={() => {
                  setPairing(true)
                  setError(null)
                  void pairDeviceName(kind)
                    .then((name) => {
                      if (name) setDeviceName(name)
                    })
                    .catch(() =>
                      setError("Kon geen verbinding maken met het apparaat."),
                    )
                    .finally(() => setPairing(false))
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-3 py-1.5 text-[11px] text-cyan-200 transition hover:bg-cyan-400/10 disabled:opacity-50"
              >
                <Bluetooth className="h-3.5 w-3.5" strokeWidth={1.75} />
                {pairing ? "Bezig…" : "Koppel via Bluetooth (optioneel)"}
              </button>
            )}
            <p className="text-[11px] leading-snug text-white/35">
              Koppelen legt de apparaatnaam vast, zodat je hem bij een rit snel
              herkent. Opslaan zonder koppelen kan ook.
            </p>
          </div>
        ) : (
          <p className="text-[11px] leading-snug text-white/45">
            Deze telefoon of browser ondersteunt geen Bluetooth-koppeling (zoals
            Safari op iPhone). Je kunt het onderdeel wel gewoon registreren.
          </p>
        )
      ) : (
        <p className="text-[11px] leading-snug text-white/45">
          {kind === "horloge"
            ? "Een horloge kan de browser niet live uitlezen — je registreert het hier alleen (merk, model, eventueel batterijnotitie)."
            : "Een elektronische derailleur kan de browser niet live uitlezen — je registreert hem hier alleen (merk, model, eventueel batterijnotitie)."}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Merk (bijv. Garmin)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model (bijv. Rally RS200)"
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
      </div>
      <input
        value={batteryNote}
        onChange={(e) => setBatteryNote(e.target.value)}
        placeholder="Batterijnotitie (optioneel, bijv. CR2032 — vervangen mrt 2026)"
        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
      />
      {error && <p className="text-[12px] text-red-300/80">{error}</p>}
      <button
        type="button"
        disabled={add.isPending}
        onClick={save}
        className="rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black disabled:opacity-50"
        style={{ background: ACCENT }}
      >
        {add.isPending ? "Bezig…" : "Opslaan"}
      </button>
    </div>
  )
}

// The per-bike (or loose, bikeId null) "Draadloze onderdelen" block.
export function WirelessSensorsBlock({
  bikeId,
  sensors,
  bikes,
}: {
  bikeId: number | null
  sensors: GarageSensor[]
  bikes?: { id: number; name: string }[]
}) {
  const del = useDeleteSensor()
  const update = useUpdateSensor()
  const [adding, setAdding] = useState(false)
  const own = sensors.filter((s) => s.bikeId === bikeId)

  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
        <Bluetooth className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
        Draadloze onderdelen
      </p>
      {own.length > 0 ? (
        <div className="mt-2 space-y-2">
          {own.map((s) => (
            <SensorRow
              key={s.id}
              sensor={s}
              onDelete={() => del.mutate(s.id)}
              onDetach={
                bikeId != null
                  ? () => update.mutate({ id: s.id, bikeId: null })
                  : undefined
              }
              attachOptions={bikeId == null ? bikes : undefined}
              onAttach={
                bikeId == null && bikes && bikes.length > 0
                  ? (targetBikeId) =>
                      update.mutate({ id: s.id, bikeId: targetBikeId })
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] leading-relaxed text-white/40">
          {bikeId != null
            ? "Nog geen draadloze onderdelen op deze fiets — bijvoorbeeld een wattagemeter of cadanssensor."
            : "Nog geen losse draadloze onderdelen — bijvoorbeeld een hartslagband of horloge."}
        </p>
      )}
      {adding ? (
        <div className="mt-2">
          <AddSensorForm bikeId={bikeId} onClose={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/35"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Draadloos onderdeel
        </button>
      )}
    </div>
  )
}
