// Wedstrijd-room — Phase 1 (single-user). The athlete makes a room (optionally
// tied to a race), adds media + text updates per race day, then renders a real
// montage of a day and downloads it. No mock data: every item and compilation is
// backed by real storage + a real ffmpeg render. Honest empty/failed states.

import { useEffect, useRef, useState } from "react"
import { useLocation } from "wouter"
import {
  ChevronLeft,
  Film,
  ImagePlus,
  MessageSquarePlus,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import { useRaces } from "@/hooks/use-races"
import {
  useRaceRooms,
  useRaceRoom,
  useMusicTracks,
  useCreateRoom,
  useDeleteRoom,
  useAddRoomItem,
  useDeleteRoomItem,
  useCompileDay,
  uploadRoomMedia,
  downloadCompilation,
  roomMediaUrl,
  type RaceRoom,
  type RaceRoomItem,
  type RaceRoomCompilation,
} from "@/hooks/use-race-rooms"

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

// Local-calendar YYYY-MM-DD — never toISOString(), which shifts NL local
// midnight to the previous UTC date (off-by-one race days).
function toLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function todayIso(): string {
  return toLocalIso(new Date())
}

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"

export default function WedstrijdRoomPage() {
  const [, setLocation] = useLocation()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  return (
    <ScreenShell section="wedstrijd-room" bare terug={false} bg="/atmosphere/wedstrijd-volgauto-peloton.webp">
      {selectedId == null ? (
        <RoomList
          onOpen={setSelectedId}
          onBack={() => setLocation("/races")}
        />
      ) : (
        <RoomDetail
          key={selectedId}
          roomId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      )}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}

// ── Room list + create ───────────────────────────────────────────────────────

function RoomList({
  onOpen,
  onBack,
}: {
  onOpen: (id: number) => void
  onBack: () => void
}) {
  const { data, isLoading } = useRaceRooms()
  const [showCreate, setShowCreate] = useState(false)
  const rooms = data?.rooms ?? []

  return (
    <>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={showCreate ? () => setShowCreate(false) : onBack}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Terug
          </button>
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
              WEDSTRIJD-ROOM
            </span>
            <h1 className="mt-1 font-sans text-2xl font-light tracking-tight text-white/90">
              {showCreate ? "Nieuwe room" : "Mijn rooms"}
            </h1>
          </div>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
            style={{
              borderColor: ACCENT,
              color: ACCENT,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            + Room
          </button>
        )}
      </header>

      {showCreate ? (
        <CreateRoomForm
          onCancel={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            onOpen(id)
          }}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : rooms.length > 0 ? (
        <section className="space-y-3">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => onOpen(room.id)}
              className="block w-full rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/20"
            >
              <h3 className="truncate font-sans text-[15px] font-light tracking-tight text-white/90">
                {room.title}
              </h3>
              <p className="mt-0.5 text-[12px] text-white/45">
                {formatDate(room.startDate)} · {room.days}{" "}
                {room.days === 1 ? "dag" : "dagen"}
              </p>
            </button>
          ))}
        </section>
      ) : (
        <div className={cardClass}>
          <h3 className="font-sans text-[15px] font-light text-white/90">
            Nog geen wedstrijd-room
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
            Maak een room aan om per wedstrijddag je foto's, korte clips en
            updates te verzamelen. Daarna maak je er met één druk een
            dagcompilatie van.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-3 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
            style={{
              borderColor: ACCENT,
              color: ACCENT,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            + Room maken
          </button>
        </div>
      )}
    </>
  )
}

function CreateRoomForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (id: number) => void
}) {
  const { data: races } = useRaces()
  const createRoom = useCreateRoom()
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState(todayIso())
  const [days, setDays] = useState(1)
  const [raceId, setRaceId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onPickRace = (value: string) => {
    if (value === "") {
      setRaceId(null)
      return
    }
    const id = Number(value)
    setRaceId(id)
    const race = races?.find((r) => r.id === id)
    if (race) {
      if (!title.trim()) setTitle(race.name)
      if (race.raceDate) setStartDate(race.raceDate)
    }
  }

  const submit = () => {
    setError(null)
    if (!title.trim()) {
      setError("Geef de room een titel.")
      return
    }
    if (!startDate) {
      setError("Kies een startdatum.")
      return
    }
    createRoom.mutate(
      { title: title.trim(), startDate, days, raceId },
      {
        onSuccess: (res) => onCreated(res.room.id),
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Aanmaken is mislukt."),
      },
    )
  }

  const labelClass =
    "block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40"
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-white/12 bg-[#040912]/70 px-3 py-2.5 text-[14px] text-white/90 outline-none transition-colors focus:border-cyan-300/40"

  return (
    <div className={`${cardClass} space-y-4`}>
      {races && races.length > 0 && (
        <div>
          <label className={labelClass}>Koppel aan wedstrijd (optioneel)</label>
          <select
            value={raceId ?? ""}
            onChange={(e) => onPickRace(e.target.value)}
            className={inputClass}
          >
            <option value="">Geen koppeling</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {formatDate(r.raceDate)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>Titel</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bijv. Omloop het Volk"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Startdatum</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Aantal dagen</label>
          <input
            type="number"
            min={1}
            max={14}
            value={days}
            onChange={(e) =>
              setDays(Math.min(14, Math.max(1, Number(e.target.value) || 1)))
            }
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-amber-300/80">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={createRoom.isPending}
          className="rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          style={{
            borderColor: ACCENT,
            color: ACCENT,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {createRoom.isPending ? "Bezig…" : "Room maken"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-white/80"
        >
          Annuleren
        </button>
      </div>
    </div>
  )
}

// ── Room detail ──────────────────────────────────────────────────────────────

function RoomDetail({
  roomId,
  onBack,
}: {
  roomId: number
  onBack: () => void
}) {
  const { data, isLoading } = useRaceRoom(roomId)
  const deleteRoom = useDeleteRoom()
  const [, setLocation] = useLocation()
  // Day indices are 1-based to match the backend (Dag 1..room.days).
  const [dayIndex, setDayIndex] = useState(1)

  if (isLoading || !data) {
    return (
      <>
        <DetailHeader title="Room" onBack={onBack} />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </>
    )
  }

  const { room, items, compilations } = data
  const dayItems = items.filter((i) => i.dayIndex === dayIndex)
  const dayMedia = dayItems.filter((i) => i.kind === "media")
  const dayUpdates = dayItems.filter((i) => i.kind === "update")
  const dayCompilation =
    compilations
      .filter((c) => c.dayIndex === dayIndex)
      .sort((a, b) => b.id - a.id)[0] ?? null

  const handleDelete = () => {
    if (!window.confirm("Deze room en alle media verwijderen?")) return
    deleteRoom.mutate(roomId, { onSuccess: onBack })
  }

  const dayDate = (() => {
    const d = new Date(`${room.startDate}T00:00:00`)
    d.setDate(d.getDate() + (dayIndex - 1))
    return toLocalIso(d)
  })()

  return (
    <>
      <DetailHeader title={room.title} onBack={onBack}>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-full border border-white/15 p-2 text-white/50 transition-colors hover:border-rose-300/40 hover:text-rose-300/80"
          aria-label="Room verwijderen"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </DetailHeader>

      {room.raceId != null && (
        <RoomRaceNote raceId={room.raceId} onOpenRaces={() => setLocation("/races")} />
      )}

      {/* Day tabs */}
      {room.days > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: room.days }, (_, i) => i + 1).map((i) => {
            const active = i === dayIndex
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDayIndex(i)}
                className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                style={{
                  background: active ? "rgba(120,210,230,0.16)" : "transparent",
                  color: active
                    ? "rgba(120,210,230,1)"
                    : "rgba(255,255,255,0.45)",
                  border: active
                    ? "1px solid rgba(120,210,230,0.3)"
                    : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Dag {i}
              </button>
            )
          })}
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
        {formatDate(dayDate)}
      </p>

      <DayMedia roomId={roomId} dayIndex={dayIndex} media={dayMedia} />
      <DayUpdates roomId={roomId} dayIndex={dayIndex} updates={dayUpdates} />
      <CompilePanel
        roomId={roomId}
        dayIndex={dayIndex}
        roomTitle={room.title}
        mediaCount={dayMedia.length}
        compilation={dayCompilation}
      />
    </>
  )
}

function DetailHeader({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children?: React.ReactNode
}) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Terug
        </button>
        <div className="min-w-0">
          <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
            WEDSTRIJD-ROOM
          </span>
          <h1 className="mt-1 truncate font-sans text-2xl font-light tracking-tight text-white/90">
            {title}
          </h1>
        </div>
      </div>
      {children}
    </header>
  )
}

function RoomRaceNote({
  raceId,
  onOpenRaces,
}: {
  raceId: number
  onOpenRaces: () => void
}) {
  const { data: races } = useRaces()
  const race = races?.find((r) => r.id === raceId)
  if (!race) return null
  return (
    <button
      type="button"
      onClick={onOpenRaces}
      className="block w-full rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-left text-[12px] text-cyan-100/70 transition-colors hover:border-cyan-300/30"
    >
      Gekoppeld aan{" "}
      <span className="text-cyan-200/90">{race.name}</span> ·{" "}
      {formatDate(race.raceDate)}
    </button>
  )
}

// ── Media ────────────────────────────────────────────────────────────────────

function DayMedia({
  roomId,
  dayIndex,
  media,
}: {
  roomId: number
  dayIndex: number
  media: RaceRoomItem[]
}) {
  const addItem = useAddRoomItem(roomId)
  const deleteItem = useDeleteRoomItem(roomId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const up = await uploadRoomMedia(file)
        await addItem.mutateAsync({
          kind: "media",
          dayIndex,
          objectPath: up.objectPath,
          mediaType: up.mediaType,
          durationSec: up.durationSec,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uploaden is mislukt.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <section className={`${cardClass} space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
          Foto's & clips
        </h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploaden…" : "Toevoegen"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-[12px] text-amber-300/80">{error}</p>}

      {media.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-white/50">
          Nog geen media voor deze dag. Voeg foto's of korte clips toe — die
          worden straks je dagcompilatie.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m) => (
            <div
              key={m.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/40"
            >
              {m.mediaType?.startsWith("video/") ? (
                <video
                  src={roomMediaUrl(m.objectPath ?? "")}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={roomMediaUrl(m.objectPath ?? "")}
                  alt={m.caption ?? "media"}
                  className="h-full w-full object-cover"
                />
              )}
              {m.mediaType?.startsWith("video/") && (
                <Film className="absolute left-1.5 top-1.5 h-3.5 w-3.5 text-white/80 drop-shadow" />
              )}
              <button
                type="button"
                onClick={() => deleteItem.mutate(m.id)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white/70 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Verwijderen"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Updates ──────────────────────────────────────────────────────────────────

function DayUpdates({
  roomId,
  dayIndex,
  updates,
}: {
  roomId: number
  dayIndex: number
  updates: RaceRoomItem[]
}) {
  const addItem = useAddRoomItem(roomId)
  const deleteItem = useDeleteRoomItem(roomId)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const t = text.trim()
    if (!t) return
    setError(null)
    addItem.mutate(
      { kind: "update", dayIndex, text: t },
      {
        onSuccess: () => setText(""),
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Opslaan is mislukt."),
      },
    )
  }

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
        Updates
      </h2>

      {updates.length > 0 && (
        <div className="space-y-2">
          {updates.map((u) => (
            <div
              key={u.id}
              className="group flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[13px] leading-relaxed text-white/80">
                {u.text}
              </p>
              <button
                type="button"
                onClick={() => deleteItem.mutate(u.id)}
                className="shrink-0 text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-300/80"
                aria-label="Verwijderen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Schrijf een korte update — die wordt een tekstkaart in de compilatie."
          className="w-full resize-none rounded-xl border border-white/12 bg-[#040912]/70 px-3 py-2.5 text-[14px] text-white/90 outline-none transition-colors focus:border-cyan-300/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={addItem.isPending || !text.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Plaats
        </button>
      </div>
      {error && <p className="text-[12px] text-amber-300/80">{error}</p>}
    </section>
  )
}

// ── Compile ──────────────────────────────────────────────────────────────────

function CompilePanel({
  roomId,
  dayIndex,
  roomTitle,
  mediaCount,
  compilation,
}: {
  roomId: number
  dayIndex: number
  roomTitle: string
  mediaCount: number
  compilation: RaceRoomCompilation | null
}) {
  const { data: musicData } = useMusicTracks()
  const compile = useCompileDay(roomId)
  const [musicKey, setMusicKey] = useState<string>("")
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tracks = musicData?.tracks ?? []

  // Default the music picker to the first available bed once loaded.
  useEffect(() => {
    if (musicKey === "" && tracks.length > 0) setMusicKey(tracks[0].key)
  }, [tracks, musicKey])

  const run = () => {
    setError(null)
    compile.mutate(
      { dayIndex, musicKey: musicKey || null },
      {
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Maken is mislukt."),
      },
    )
  }

  const onDownload = async () => {
    if (!compilation || compilation.status !== "ready") return
    setError(null)
    setDownloading(true)
    try {
      const safe = roomTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
      await downloadCompilation(
        roomId,
        compilation,
        `${safe || "wedstrijd-room"}-dag-${dayIndex}.mp4`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download is mislukt.")
    } finally {
      setDownloading(false)
    }
  }

  const busy = compile.isPending

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
        Dagcompilatie
      </h2>

      {tracks.length > 0 ? (
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            Muziek
          </label>
          <select
            value={musicKey}
            onChange={(e) => setMusicKey(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/12 bg-[#040912]/70 px-3 py-2.5 text-[14px] text-white/90 outline-none transition-colors focus:border-cyan-300/40"
          >
            <option value="">Geen muziek</option>
            {tracks.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} — {t.description}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-[12px] text-white/45">
          Geen muziekbedden beschikbaar — de compilatie wordt zonder muziek
          gemaakt.
        </p>
      )}

      <div className="ds-actiebalk flex flex-col gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy || mediaCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
          style={{
            borderColor: ACCENT,
            color: ACCENT,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Compilatie wordt gemaakt…
            </>
          ) : (
            <>
              <Film className="h-4 w-4" />
              Maak dagcompilatie
            </>
          )}
        </button>
      </div>

      {mediaCount === 0 && (
        <p className="text-[12px] text-white/45">
          Voeg eerst foto's of clips toe om een compilatie te kunnen maken.
        </p>
      )}

      {compilation && (
        <CompilationStatusCard
          compilation={compilation}
          onDownload={onDownload}
          downloading={downloading}
        />
      )}

      {error && <p className="text-[12px] text-amber-300/80">{error}</p>}
    </section>
  )
}

function CompilationStatusCard({
  compilation,
  onDownload,
  downloading,
}: {
  compilation: RaceRoomCompilation
  onDownload: () => void
  downloading: boolean
}) {
  if (compilation.status === "ready") {
    const dur = compilation.durationSec
      ? Math.round(Number(compilation.durationSec))
      : null
    return (
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-3">
        <p className="text-[13px] text-white/80">
          Compilatie klaar — {compilation.itemCount}{" "}
          {compilation.itemCount === 1 ? "fragment" : "fragmenten"}
          {dur != null ? ` · ${dur}s` : ""}.
        </p>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="mt-2.5 flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {downloading ? "Downloaden…" : "Download"}
        </button>
      </div>
    )
  }

  if (compilation.status === "empty") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <p className="text-[13px] text-white/65">
          {compilation.reason ??
            "Geen media gevonden voor deze dag om een compilatie van te maken."}
        </p>
      </div>
    )
  }

  if (compilation.status === "failed") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[0.05] p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/80" />
        <p className="text-[13px] text-rose-100/80">
          {compilation.reason ??
            "Het maken van de compilatie is mislukt. Probeer het opnieuw."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <Loader2 className="h-4 w-4 animate-spin text-white/50" />
      <p className="text-[13px] text-white/65">Compilatie wordt verwerkt…</p>
    </div>
  )
}
