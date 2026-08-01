import { useState } from "react"
import { ChevronRight, HeartPulse, History, ShieldAlert } from "lucide-react"
import {
  useHealthOverview,
  useCreateComplaint,
  useUpdateComplaint,
  useConfirmResumption,
  useComplaintHistory,
  useSafetyInfo,
  useSaveSafetyInfo,
  type HealthComplaint,
} from "@/hooks/use-health-flow"

// Golf 26 — gezondheidsflow op het hoofdstuk Lichaam. Registratie is géén
// diagnose: de sporter beschrijft klacht, ernst en invloed op trainen; de
// server-engine bepaalt status en opbouwadvies (één waarheid). Historie is
// een bewuste stap (drill-in), noodinformatie is volledig zelfgekozen en
// standaard NIET gedeeld.

const KIND_LABEL: Record<string, string> = {
  ziekte: "Ziekte",
  blessure: "Blessure",
  pijn: "Pijnklacht",
}
const SEVERITY_LABEL: Record<string, string> = {
  licht: "Licht",
  matig: "Matig",
  ernstig: "Ernstig",
}
const IMPACT_LABEL: Record<string, string> = {
  geen: "Trainen kan gewoon",
  aangepast: "Aangepast trainen",
  niet_trainen: "Niet trainen",
}
const STATUS_LABEL: Record<string, string> = {
  actief: "Actief",
  herstellende: "Herstellende",
  hersteld: "Hersteld",
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
        active
          ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
          : "border-white/[0.12] bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
      }`}
    >
      {label}
    </button>
  )
}

function ComplaintForm({ onDone }: { onDone: () => void }) {
  const create = useCreateComplaint()
  const [kind, setKind] = useState("ziekte")
  const [severity, setSeverity] = useState("licht")
  const [impact, setImpact] = useState("aangepast")
  const [bodyLocation, setBodyLocation] = useState("")
  const [startDate, setStartDate] = useState(todayLocal())
  const [medical, setMedical] = useState(false)
  const [instruction, setInstruction] = useState("")
  const [notes, setNotes] = useState("")

  const submit = () => {
    create.mutate(
      {
        kind,
        severity,
        trainingImpact: impact,
        startDate,
        bodyLocation: bodyLocation.trim() || undefined,
        source: medical ? "medisch_bevestigd" : "zelfgerapporteerd",
        professionalInstruction: medical && instruction.trim() ? instruction.trim() : undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.7] p-4">
      <p className="text-[13px] font-medium text-white/85">Klacht doorgeven</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
        Dit is een registratie, geen diagnose. Je begeleiding wordt erop
        aangepast; bij twijfel is een arts of fysiotherapeut de juiste plek.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(KIND_LABEL).map(([v, l]) => (
          <Pill key={v} active={kind === v} label={l} onClick={() => setKind(v)} />
        ))}
      </div>
      {kind !== "ziekte" && (
        <input
          value={bodyLocation}
          onChange={(e) => setBodyLocation(e.target.value)}
          placeholder="Waar zit het? (bijv. linkerknie)"
          maxLength={120}
          className="mt-3 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
        />
      )}
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
        Hoe ernstig voelt het?
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {Object.entries(SEVERITY_LABEL).map(([v, l]) => (
          <Pill key={v} active={severity === v} label={l} onClick={() => setSeverity(v)} />
        ))}
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
        Wat betekent dit voor trainen?
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {Object.entries(IMPACT_LABEL).map(([v, l]) => (
          <Pill key={v} active={impact === v} label={l} onClick={() => setImpact(v)} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-[12px] text-white/55">Sinds</label>
        <input
          type="date"
          value={startDate}
          max={todayLocal()}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-lg border border-white/[0.12] bg-white/[0.03] px-2 py-1.5 text-[12px] text-white/80 outline-none [color-scheme:dark]"
        />
      </div>
      <label className="mt-3 flex items-start gap-2 text-[12px] text-white/60">
        <input
          type="checkbox"
          checked={medical}
          onChange={(e) => setMedical(e.target.checked)}
          className="mt-0.5"
        />
        Een arts of fysiotherapeut heeft hiernaar gekeken
      </label>
      {medical && (
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Instructie van arts/fysio (wordt letterlijk gevolgd en aan je coach getoond)"
          maxLength={2000}
          rows={2}
          className="mt-2 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
        />
      )}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Toelichting (optioneel)"
        maxLength={2000}
        rows={2}
        className="mt-2 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
      />
      {create.isError && (
        <p className="mt-2 text-[12px] text-amber-300/90">
          Opslaan lukte niet — controleer de velden en probeer opnieuw.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={create.isPending}
          onClick={submit}
          className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-1.5 text-[12px] font-medium text-cyan-200 transition-colors hover:bg-cyan-300/20 disabled:opacity-50"
        >
          {create.isPending ? "Opslaan…" : "Doorgeven"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-white/[0.12] px-4 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.05]"
        >
          Annuleren
        </button>
      </div>
    </div>
  )
}

function ComplaintCard({
  complaint,
}: {
  complaint: HealthComplaint & { updates: { id: number }[] }
}) {
  const update = useUpdateComplaint()
  const [note, setNote] = useState("")

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.7] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-white/85">
            {KIND_LABEL[complaint.kind] ?? complaint.kind}
            {complaint.bodyLocation ? ` — ${complaint.bodyLocation}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            Sinds {complaint.startDate} · {SEVERITY_LABEL[complaint.severity]} ·{" "}
            {IMPACT_LABEL[complaint.trainingImpact]}
          </p>
        </div>
        <span className="rounded-full border border-white/[0.12] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/55">
          {STATUS_LABEL[complaint.status]}
        </span>
      </div>
      {complaint.professionalInstruction && (
        <p className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-[12px] leading-relaxed text-cyan-100/90">
          Instructie arts/fysio: {complaint.professionalInstruction}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {complaint.status === "actief" && (
          <button
            type="button"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({ id: complaint.id, status: "herstellende" })
            }
            className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.07] disabled:opacity-50"
          >
            Het gaat beter
          </button>
        )}
        {complaint.trainingImpact !== "niet_trainen" && (
          <button
            type="button"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                id: complaint.id,
                trainingImpact: "niet_trainen",
                ...(complaint.status !== "actief" ? { status: "actief" } : {}),
              })
            }
            className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.07] disabled:opacity-50"
          >
            Het gaat slechter
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notitie bij het verloop…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/80 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
        />
        <button
          type="button"
          disabled={update.isPending || !note.trim()}
          onClick={() =>
            update.mutate(
              { id: complaint.id, note: note.trim() },
              { onSuccess: () => setNote("") },
            )
          }
          className="shrink-0 rounded-full border border-white/[0.12] px-3 py-1.5 text-[12px] text-white/60 hover:bg-white/[0.05] disabled:opacity-40"
        >
          Bewaar
        </button>
      </div>
      {update.isError && (
        <p className="mt-2 text-[12px] text-amber-300/90">
          Bijwerken lukte niet — probeer het zo nog eens.
        </p>
      )}
    </div>
  )
}

function HistoryPanel() {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useComplaintHistory(open)

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.7] px-4 py-3 text-left"
      >
        <History className="h-4 w-4 text-white/40" strokeWidth={1.75} />
        <span className="flex-1 text-[13px] text-white/75">
          Eerdere klachten &amp; herstelperiodes
        </span>
        <ChevronRight
          className={`h-4 w-4 text-white/25 transition-transform ${open ? "rotate-90" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.7] p-4">
          {isLoading ? (
            <p className="text-[12px] text-white/40">Historie laden…</p>
          ) : !data || data.length === 0 ? (
            <p className="text-[12px] text-white/40">
              Nog geen geregistreerde klachten — hier verschijnt later je
              hersteloverzicht.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.map((e) => (
                <li key={e.complaint.id} className="border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                  <p className="text-[13px] text-white/80">
                    {KIND_LABEL[e.complaint.kind] ?? e.complaint.kind}
                    {e.complaint.bodyLocation ? ` — ${e.complaint.bodyLocation}` : ""}
                    <span className="ml-2 text-[11px] text-white/40">
                      {STATUS_LABEL[e.complaint.status]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    Vanaf {e.complaint.startDate}
                    {e.durationDays != null ? ` · ${e.durationDays} dagen` : " · loopt nog"}
                    {" · "}
                    {e.missedWorkouts} gemist, {e.adjustedWorkouts} aangepast
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SafetyInfoEditor() {
  const { data } = useSafetyInfo()
  const save = useSaveSafetyInfo()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [share, setShare] = useState<boolean | null>(null)

  const infoText = text ?? data?.infoText ?? ""
  const shareWithContacts = share ?? data?.shareWithContacts ?? false

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.7] px-4 py-3 text-left"
      >
        <ShieldAlert className="h-4 w-4 text-white/40" strokeWidth={1.75} />
        <span className="flex-1 text-[13px] text-white/75">
          Noodinformatie (zelfgekozen)
        </span>
        <ChevronRight
          className={`h-4 w-4 text-white/25 transition-transform ${open ? "rotate-90" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.7] p-4">
          <p className="text-[11px] leading-relaxed text-white/40">
            Alleen wat jij hier zelf invult kan bij een val-alarm worden
            meegestuurd — en alléén als je dat hieronder aanzet. Standaard staat
            delen uit.
          </p>
          <textarea
            value={infoText}
            onChange={(e) => setText(e.target.value)}
            placeholder="Bijv. medicijngebruik, allergieën of bloedgroep — alleen wat je zelf kwijt wilt."
            maxLength={2000}
            rows={3}
            className="mt-2 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
          />
          <label className="mt-2 flex items-start gap-2 text-[12px] text-white/60">
            <input
              type="checkbox"
              checked={shareWithContacts}
              onChange={(e) => setShare(e.target.checked)}
              className="mt-0.5"
            />
            Deel deze informatie mee in het val-alarm naar mijn noodcontacten
          </label>
          <div className="mt-3">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate({ infoText, shareWithContacts })}
              className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-1.5 text-[12px] font-medium text-cyan-200 hover:bg-cyan-300/20 disabled:opacity-50"
            >
              {save.isPending ? "Opslaan…" : "Opslaan"}
            </button>
            {save.isSuccess && (
              <span className="ml-2 text-[12px] text-white/40">Opgeslagen.</span>
            )}
            {save.isError && (
              <span className="ml-2 text-[12px] text-amber-300/90">
                Opslaan lukte niet.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function HealthFlowSection() {
  const { data: overview, isLoading } = useHealthOverview()
  const resume = useConfirmResumption()
  const [formOpen, setFormOpen] = useState(false)

  const activeComplaints =
    overview?.complaints.filter((c) => c.status !== "hersteld") ?? []

  return (
    <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
          style={{ background: "rgba(120,210,230,0.08)" }}
        >
          <HeartPulse className="h-5 w-5 text-cyan-300/80" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-white/90">
            Gezondheid &amp; herstel
          </p>
          {isLoading ? (
            <p className="mt-0.5 text-[12px] text-white/40">Laden…</p>
          ) : overview ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
              {overview.healthStatus === "ok"
                ? activeComplaints.length > 0
                  ? "Er loopt een klacht die je trainen niet blokkeert."
                  : "Geen actieve klachten gemeld."
                : overview.healthStatus === "sick"
                  ? "Je staat ziek gemeld — trainingsdruk wordt automatisch laag gehouden."
                  : "Je staat geblesseerd gemeld — je begeleiding wordt hierop aangepast."}
            </p>
          ) : null}

          {overview?.resumption.active && overview.resumption.advice && (
            <p className="mt-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-white/65">
              Opbouw dag {overview.resumption.day} van{" "}
              {overview.resumption.windowDays}: {overview.resumption.advice}
            </p>
          )}

          {overview?.signals
            .filter((s) => s.source === "sensor_afwijking")
            .map((s) => (
              <p
                key={`${s.source}-${s.at}`}
                className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-100/90"
              >
                {s.title}: {s.detail}
              </p>
            ))}

          {activeComplaints.map((c) => (
            <ComplaintCard key={c.id} complaint={c} />
          ))}

          {formOpen ? (
            <ComplaintForm onDone={() => setFormOpen(false)} />
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.07]"
              >
                Klacht doorgeven
              </button>
              {overview?.canResume && (
                <button
                  type="button"
                  disabled={resume.isPending}
                  onClick={() => resume.mutate()}
                  className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3.5 py-1.5 text-[12px] font-medium text-cyan-200 hover:bg-cyan-300/20 disabled:opacity-50"
                >
                  {resume.isPending ? "Bevestigen…" : "Ik ben weer hersteld"}
                </button>
              )}
            </div>
          )}
          {resume.isError && (
            <p className="mt-2 text-[12px] text-amber-300/90">
              {(resume.error as Error)?.message?.includes("409") ||
              (resume.error as Error)?.message?.includes("niet trainen")
                ? "Er staat nog een actieve klacht met 'niet trainen' open — zet die eerst op 'het gaat beter'."
                : "Bevestigen lukte niet — probeer het zo nog eens."}
            </p>
          )}

          <HistoryPanel />
          <SafetyInfoEditor />
        </div>
      </div>
    </div>
  )
}
