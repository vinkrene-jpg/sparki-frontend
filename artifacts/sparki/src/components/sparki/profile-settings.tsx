// ── Sparki profile settings ───────────────────────────────────────────────────
// Everything the athlete can *edit* about themselves lives here, relocated out of
// the Profiel page. The Profiel page itself is now the living Sparki Core (what
// Sparki has DERIVED); these are the inputs that feed it. Rendered inside the
// "Instellingen" drill-in sheet on the Core page.
//
// App-wide `?focus=` deep-links still resolve here: each editable row keeps its
// `cfg-<token>` id + autoOpen behaviour, so a "FTP instellen" button anywhere in
// the app opens this sheet and jumps straight to the FTP editor.

import { useState, useEffect, useRef, type ReactNode } from "react"
import { trackScreen } from "@/lib/telemetry"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { PrivacySettingsSection } from "@/components/sparki/privacy-settings"
import { AccountPrivacyPanel } from "@/components/sparki/account-privacy-panel"
import { ProfilePrivacyGrid } from "@/components/sparki/profile-privacy-grid"
import { ReminderSettingsSection } from "@/components/sparki/reminder-settings"
import { ConnectionsSection } from "@/components/sparki/connections-section"
import { LinksSection } from "@/components/sparki/links-section"
import { BugReportForm } from "@/components/sparki/bug-report-form"
import { AdminPanel, TesterAccessLinks } from "@/components/sparki/admin-panel"
import { SparkiVoiceSection } from "@/components/sparki/sparki-voice"
import { FoundingSection } from "@/components/sparki/insights-section"
import {
  useAthleteExtendedProfile,
  useUpdateAthleteProfile,
} from "@/hooks/use-athlete-extended-profile"
import { useLogDailyMetrics } from "@/hooks/use-daily-metrics"
import { useConnectors, connectorSupplying } from "@/hooks/use-connectors"
import { formatLastSync } from "@/lib/connectors"
import { useLogFtp } from "@/hooks/use-ftp-history"
import { useTeamIdentity, useSaveTeamIdentity } from "@/hooks/use-social"
import { useClerk } from "@clerk/react"
import { DEVELOPMENT_GOALS } from "@/lib/core-profile"
import {
  Check,
  Pencil,
  User,
  Activity,
  Bike,
  Zap,
  Scale,
  Ruler,
  Cake,
  Target,
  HeartPulse,
  Settings,
  ChevronRight,
  Shield,
  LogOut,
  Clock,
} from "lucide-react"

type EditorProps = { autoOpen?: boolean; onSaved?: () => void }

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

/** Scrolls to + briefly highlights the section matching the active focus token. */
function FocusTarget({
  token,
  focus,
  children,
}: {
  token: string
  focus: string | null
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hl, setHl] = useState(false)
  useEffect(() => {
    if (focus === token && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" })
      setHl(true)
      const t = setTimeout(() => setHl(false), 2600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [focus, token])
  return (
    <div
      ref={ref}
      className={
        hl
          ? "rounded-2xl ring-2 ring-cyan-300/50 transition-all duration-500"
          : "rounded-2xl transition-all duration-500"
      }
    >
      {children}
    </div>
  )
}

function TeamIdentitySection() {
  const { data, isLoading } = useTeamIdentity()
  const save = useSaveTeamIdentity()
  const team = data?.team
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    clubName: "",
    teamName: "",
    category: "",
    shirtBadge: "",
    primaryColor: "#0ea5b7",
    secondaryColor: "#0b1220",
  })

  const start = () => {
    setForm({
      clubName: team?.clubName ?? "",
      teamName: team?.teamName ?? "",
      category: team?.category ?? "",
      shirtBadge: team?.shirtBadge ?? "",
      primaryColor: team?.primaryColor ?? "#0ea5b7",
      secondaryColor: team?.secondaryColor ?? "#0b1220",
    })
    setEditing(true)
  }

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = () => {
    save.mutate(
      {
        clubName: form.clubName.trim() || null,
        teamName: form.teamName.trim() || null,
        category: form.category.trim() || null,
        shirtBadge: form.shirtBadge.trim() || null,
        primaryColor: form.primaryColor || null,
        secondaryColor: form.secondaryColor || null,
        // Only keep a logo the club actually has — never a canned placeholder
        // crest pretending to be the real club logo.
        logoUrl: team?.logoUrl ?? null,
        sport: "cycling",
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  const fieldClass =
    "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

  return (
    <section>
      <SectionLabel title="Club & team" />
      {isLoading ? (
        <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              CLUB
            </label>
            <input
              value={form.clubName}
              onChange={set("clubName")}
              placeholder="bijv. WV De Sprinters"
              className={`mt-1.5 ${fieldClass}`}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                TEAM
              </label>
              <input
                value={form.teamName}
                onChange={set("teamName")}
                placeholder="bijv. Junioren A"
                className={`mt-1.5 ${fieldClass}`}
              />
            </div>
            <div className="w-32">
              <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                CATEGORIE
              </label>
              <input
                value={form.category}
                onChange={set("category")}
                placeholder="Junioren"
                className={`mt-1.5 ${fieldClass}`}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-28">
              <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                BADGE
              </label>
              <input
                value={form.shirtBadge}
                onChange={set("shirtBadge")}
                placeholder="DS"
                maxLength={4}
                className={`mt-1.5 ${fieldClass}`}
              />
            </div>
            <div className="flex flex-1 gap-3">
              <div className="flex-1">
                <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                  KLEUR 1
                </label>
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={set("primaryColor")}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04]"
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                  KLEUR 2
                </label>
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={set("secondaryColor")}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04]"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={save.isPending}
              className="rounded-xl px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
              style={{ background: ACCENT, color: "#040506" }}
            >
              {save.isPending ? "Opslaan…" : "Opslaan"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-white/[0.1] px-4 py-2 font-sans text-[13px] text-white/50"
            >
              Annuleer
            </button>
          </div>
        </div>
      ) : team && team.clubName ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: team.primaryColor
                ? `${team.primaryColor}66`
                : "rgba(255,255,255,0.15)",
              background: team.primaryColor ? `${team.primaryColor}22` : undefined,
            }}
          >
            <Shield
              className="h-5 w-5"
              style={{ color: team.primaryColor ?? ACCENT }}
              strokeWidth={1.75}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-white/90">
              {team.clubName}
            </p>
            <p className="truncate font-mono text-[10px] tracking-wide text-white/40">
              {[team.teamName, team.category].filter(Boolean).join(" · ") ||
                "Wielrennen"}
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10"
          >
            <Pencil className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 py-3.5 font-sans text-[13px] text-white/45 transition-colors hover:border-cyan-300/35 hover:text-white/65"
        >
          <Shield className="h-4 w-4" strokeWidth={1.75} />
          Voeg je club & team toe
        </button>
      )}
    </section>
  )
}

function FtpInlineEditor({ autoOpen, onSaved }: EditorProps = {}) {
  const { data: profile } = useAthleteExtendedProfile()
  const logFtp = useLogFtp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    if (autoOpen) setEditing(true)
  }, [autoOpen])

  const handleSave = () => {
    const watts = parseInt(value)
    if (!watts || watts < 50 || watts > 600) return
    logFtp.mutate(
      { ftpWatts: watts, testType: "manual" },
      {
        onSuccess: () => {
          setEditing(false)
          setValue("")
          onSaved?.()
        },
      },
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          placeholder={String(profile?.ftp ?? "280")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 rounded-lg border border-cyan-300/30 bg-white/[0.04] px-2.5 py-1.5 font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") {
              setEditing(false)
              setValue("")
            }
          }}
          min={50}
          max={600}
        />
        <span className="font-mono text-[11px] text-white/40">W</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={logFtp.isPending || !value}
          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Check className="h-3.5 w-3.5" style={{ color: "#040506" }} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex items-center gap-2"
    >
      <span className="font-mono text-[11px] tracking-wide text-white/40">
        {profile?.ftp ? `${profile.ftp}W` : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-white/20" strokeWidth={1.75} />
    </button>
  )
}

function CheckInForm({ onSaved }: EditorProps = {}) {
  const logMetrics = useLogDailyMetrics()
  const { data: connectors } = useConnectors()
  const hrvSupplier = connectorSupplying(connectors, "hrv")
  const [hrvManual, setHrvManual] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    feelScore: "3",
    sleepQuality: "3",
    fatigueScore: "5",
    hrv: "",
    notes: "",
  })

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSave = () => {
    logMetrics.mutate(
      {
        feelScore: parseInt(form.feelScore),
        sleepQuality: parseInt(form.sleepQuality),
        fatigueScore: parseInt(form.fatigueScore),
        hrv: form.hrv ? parseInt(form.hrv) : undefined,
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          setSaved(true)
          onSaved?.()
        },
      },
    )
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-3">
        <Check className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={2.5} />
        <span className="text-[13px] font-medium" style={{ color: ACCENT }}>
          Check-in gelogd voor vandaag
        </span>
      </div>
    )
  }

  const ratingButtons = (
    key: keyof typeof form,
    count: number,
    lowLabel: string,
    highLabel: string,
  ) => (
    <div>
      <div className="flex gap-1.5">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setForm((p) => ({ ...p, [key]: String(n) }))}
            className="flex flex-1 items-center justify-center rounded-lg border py-2 font-sans text-[12px] font-semibold transition-colors"
            style={{
              borderColor:
                form[key] === String(n)
                  ? "rgba(120,210,230,0.45)"
                  : "rgba(255,255,255,0.1)",
              background:
                form[key] === String(n)
                  ? "rgba(120,210,230,0.1)"
                  : "transparent",
              color: form[key] === String(n) ? ACCENT : "rgba(255,255,255,0.45)",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between px-0.5 font-mono text-[9px] tracking-[0.15em] text-white/20">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
          HOE VOEL JE JE? (1–5)
        </label>
        {ratingButtons("feelScore", 5, "slecht", "top")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
          SLAAPKWALITEIT (1–5)
        </label>
        {ratingButtons("sleepQuality", 5, "slecht", "uitstekend")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
          VERMOEIDHEID (1–10)
        </label>
        {ratingButtons("fatigueScore", 10, "fris", "uitgeput")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
          HRV (ms, optioneel)
        </label>
        {hrvSupplier && !hrvManual ? (
          <div className="flex flex-col gap-1.5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] px-3.5 py-2.5">
            <span className="text-[13px] text-white/70">
              Sparki haalt je HRV automatisch op uit {hrvSupplier.displayName}
              {formatLastSync(hrvSupplier.lastSyncAt)
                ? ` — laatste sync ${formatLastSync(hrvSupplier.lastSyncAt)}`
                : ""}
              . Je hoeft dit niet zelf in te vullen.
            </span>
            <button
              type="button"
              onClick={() => setHrvManual(true)}
              className="self-start font-sans text-[11px] font-medium text-white/45 underline underline-offset-2 transition-colors hover:text-white/70"
            >
              Toch handmatig invullen
            </button>
          </div>
        ) : (
          <input
            type="number"
            value={form.hrv}
            onChange={set("hrv")}
            placeholder="bijv. 82"
            min={20}
            max={250}
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
          />
        )}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={logMetrics.isPending}
        className="rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-40"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {logMetrics.isPending ? "Opslaan…" : "Log check-in van vandaag"}
      </button>
    </div>
  )
}

function GoalsSection({ autoOpen, onSaved }: EditorProps = {}) {
  const { data: profile } = useAthleteExtendedProfile()
  const updateProfile = useUpdateAthleteProfile()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    if (autoOpen) {
      setValue(profile?.goals ?? "")
      setEditing(true)
    }
  }, [autoOpen, profile?.goals])

  const start = () => {
    setValue(profile?.goals ?? "")
    setEditing(true)
  }

  const save = () => {
    updateProfile.mutate(
      { goals: value },
      {
        onSuccess: () => {
          setEditing(false)
          onSaved?.()
        },
      },
    )
  }

  const currentGoal = profile?.developmentGoal ?? null
  const pickGoal = (key: string) => {
    if (key === currentGoal) return
    updateProfile.mutate({ developmentGoal: key }, { onSuccess: () => onSaved?.() })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Structured long-term ambition — the reference point for all coaching. */}
      <div>
        <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
          JE LANGETERMIJNDOEL
        </label>
        <div className="mt-2 flex flex-col gap-2">
          {DEVELOPMENT_GOALS.map((g) => {
            const selected = currentGoal === g.key
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => pickGoal(g.key)}
                disabled={updateProfile.isPending}
                className="flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-60"
                style={{
                  borderColor: selected
                    ? "rgba(120,210,230,0.45)"
                    : "rgba(255,255,255,0.1)",
                  background: selected ? "rgba(120,210,230,0.08)" : "transparent",
                }}
              >
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor: selected ? ACCENT : "rgba(255,255,255,0.2)",
                    background: selected ? ACCENT : "transparent",
                  }}
                >
                  {selected && (
                    <Check className="h-2.5 w-2.5" style={{ color: "#040506" }} strokeWidth={3} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block font-sans text-[14px] font-medium"
                    style={{ color: selected ? ACCENT : "rgba(255,255,255,0.85)" }}
                  >
                    {g.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-white/45">
                    {g.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Free-text personal goal / season notes (used for "persoonlijk"). */}
      <div>
        <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
          EIGEN TOELICHTING (OPTIONEEL)
        </label>
        {editing ? (
          <div className="mt-2 flex flex-col gap-3">
            <textarea
              autoFocus
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="bijv. Piek voor Gran Fondo juni, opbouwen naar 4 W/kg"
              className="w-full resize-none rounded-xl border border-cyan-300/30 bg-white/[0.04] px-3.5 py-3 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={updateProfile.isPending}
                className="rounded-xl px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
                style={{ background: ACCENT, color: "#040506" }}
              >
                {updateProfile.isPending ? "Opslaan…" : "Opslaan"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border border-white/[0.1] px-4 py-2 font-sans text-[13px] text-white/50"
              >
                Annuleer
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-3">
            <p className="flex-1 text-pretty text-[14px] leading-relaxed text-white/60">
              {profile?.goals ?? (
                <span className="text-white/25">Nog geen toelichting</span>
              )}
            </p>
            <button
              type="button"
              onClick={start}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function WeeklyHoursInlineEditor({ autoOpen, onSaved }: EditorProps = {}) {
  const { data: profile } = useAthleteExtendedProfile()
  const updateProfile = useUpdateAthleteProfile()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    if (autoOpen) {
      setValue(profile?.weeklyHourTarget ? String(profile.weeklyHourTarget) : "")
      setEditing(true)
    }
  }, [autoOpen, profile?.weeklyHourTarget])

  const handleSave = () => {
    const hours = parseInt(value)
    if (!hours || hours < 1 || hours > 40) return
    updateProfile.mutate(
      { weeklyHourTarget: hours },
      {
        onSuccess: () => {
          setEditing(false)
          setValue("")
          onSaved?.()
        },
      },
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          placeholder={String(profile?.weeklyHourTarget ?? "8")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-lg border border-cyan-300/30 bg-white/[0.04] px-2.5 py-1.5 font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") {
              setEditing(false)
              setValue("")
            }
          }}
          min={1}
          max={40}
        />
        <span className="font-mono text-[11px] text-white/40">u/wk</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateProfile.isPending || !value}
          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Check className="h-3.5 w-3.5" style={{ color: "#040506" }} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-2">
      <span className="font-mono text-[11px] tracking-wide text-white/40">
        {profile?.weeklyHourTarget ? `${profile.weeklyHourTarget} u/wk` : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-white/20" strokeWidth={1.75} />
    </button>
  )
}

function WeightInlineEditor({ autoOpen, onSaved }: EditorProps = {}) {
  const { data: profile } = useAthleteExtendedProfile()
  const { data: connectors } = useConnectors()
  const weightSupplier = connectorSupplying(connectors, "weight")
  const updateProfile = useUpdateAthleteProfile()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    if (autoOpen) {
      setValue(profile?.weightKg ?? "")
      setEditing(true)
    }
  }, [autoOpen, profile?.weightKg])

  const handleSave = () => {
    const kg = parseFloat(value)
    if (!kg || kg < 30 || kg > 150) return
    updateProfile.mutate(
      { weightKg: String(kg) },
      {
        onSuccess: () => {
          setEditing(false)
          setValue("")
          onSaved?.()
        },
      },
    )
  }

  if (weightSupplier && !editing) {
    const lastSync = formatLastSync(weightSupplier.lastSyncAt)
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="font-mono text-[11px] tracking-wide text-white/40">
          {profile?.weightKg ? `${profile.weightKg} kg` : "Nog niet gesynct"}
        </span>
        <span className="text-[10px] text-white/30">
          Sparki haalt dit op uit {weightSupplier.displayName}
          {lastSync ? ` · ${lastSync}` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            setValue(profile?.weightKg ?? "")
            setEditing(true)
          }}
          className="mt-0.5 font-sans text-[10px] font-medium text-white/40 underline underline-offset-2 transition-colors hover:text-white/70"
        >
          Handmatig corrigeren
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          step="0.1"
          placeholder={profile?.weightKg ?? "70"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-lg border border-cyan-300/30 bg-white/[0.04] px-2.5 py-1.5 font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") {
              setEditing(false)
              setValue("")
            }
          }}
          min={30}
          max={150}
        />
        <span className="font-mono text-[11px] text-white/40">kg</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateProfile.isPending || !value}
          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Check className="h-3.5 w-3.5" style={{ color: "#040506" }} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-2">
      <span className="font-mono text-[11px] tracking-wide text-white/40">
        {profile?.weightKg ? `${profile.weightKg} kg` : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-white/20" strokeWidth={1.75} />
    </button>
  )
}

function HeightInlineEditor({ autoOpen, onSaved }: EditorProps = {}) {
  const { data: profile } = useAthleteExtendedProfile()
  const updateProfile = useUpdateAthleteProfile()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    if (autoOpen) {
      setValue(profile?.heightCm != null ? String(profile.heightCm) : "")
      setEditing(true)
    }
  }, [autoOpen, profile?.heightCm])

  const handleSave = () => {
    const cm = Math.round(parseFloat(value))
    if (!cm || cm < 100 || cm > 250) return
    updateProfile.mutate(
      { heightCm: cm },
      {
        onSuccess: () => {
          setEditing(false)
          setValue("")
          onSaved?.()
        },
      },
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          step="1"
          placeholder={profile?.heightCm != null ? String(profile.heightCm) : "175"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-lg border border-cyan-300/30 bg-white/[0.04] px-2.5 py-1.5 font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") {
              setEditing(false)
              setValue("")
            }
          }}
          min={100}
          max={250}
        />
        <span className="font-mono text-[11px] text-white/40">cm</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateProfile.isPending || !value}
          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Check className="h-3.5 w-3.5" style={{ color: "#040506" }} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-2">
      <span className="font-mono text-[11px] tracking-wide text-white/40">
        {profile?.heightCm != null ? `${profile.heightCm} cm` : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-white/20" strokeWidth={1.75} />
    </button>
  )
}

// Format an ISO date (YYYY-MM-DD) as a short Dutch date (24-09-2007). Falls back
// to the year alone when only a birth year is known (older profiles).
function formatBirth(birthDate: string | null, birthYear: number | null): string {
  if (birthDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
  }
  if (birthYear != null) return String(birthYear)
  return "Niet ingesteld"
}

function BirthYearInlineEditor({ autoOpen, onSaved }: EditorProps = {}) {
  const { data: profile } = useAthleteExtendedProfile()
  const updateProfile = useUpdateAthleteProfile()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const todayIso = new Date().toISOString().slice(0, 10)

  const initialValue = () => {
    if (profile?.birthDate) return profile.birthDate.slice(0, 10)
    // Older profiles that only stored a year — leave the day/month for the user
    // to fill so Sparki can compute the exact age.
    return ""
  }

  useEffect(() => {
    if (autoOpen) {
      setValue(initialValue())
      setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, profile?.birthDate])

  const handleSave = () => {
    // Full date of birth so age is exact (not off by up to a year). We send the
    // ISO date; the server also derives birthYear from it for backward compat.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!m) return
    const y = Number(m[1])
    if (y < 1920 || value > todayIso) return
    updateProfile.mutate(
      { birthDate: value },
      {
        onSuccess: () => {
          setEditing(false)
          setValue("")
          onSaved?.()
        },
      },
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-cyan-300/30 bg-white/[0.04] px-2.5 py-1.5 font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none [color-scheme:dark]"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") {
              setEditing(false)
              setValue("")
            }
          }}
          min="1920-01-01"
          max={todayIso}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={updateProfile.isPending || !value}
          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Check className="h-3.5 w-3.5" style={{ color: "#040506" }} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-2">
      <span className="font-mono text-[11px] tracking-wide text-white/40">
        {formatBirth(profile?.birthDate ?? null, profile?.birthYear ?? null)}
      </span>
      <Pencil className="h-3 w-3 text-white/20" strokeWidth={1.75} />
    </button>
  )
}

const DISCIPLINES = ["Weg", "MTB", "Gravel", "Veldrijden", "Baan", "Triatlon"]

function DisciplineInlineEditor({ autoOpen, onSaved }: EditorProps = {}) {
  const { data: profile } = useAthleteExtendedProfile()
  const updateProfile = useUpdateAthleteProfile()
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (autoOpen) setEditing(true)
  }, [autoOpen])

  const choose = (d: string) => {
    updateProfile.mutate(
      { discipline: d },
      {
        onSuccess: () => {
          setEditing(false)
          onSaved?.()
        },
      },
    )
  }

  if (editing) {
    return (
      <div className="flex max-w-[200px] flex-wrap justify-end gap-1.5">
        {DISCIPLINES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => choose(d)}
            disabled={updateProfile.isPending}
            className="rounded-lg border px-2.5 py-1 font-sans text-[12px] disabled:opacity-40"
            style={{
              borderColor:
                profile?.discipline === d
                  ? "rgba(120,210,230,0.45)"
                  : "rgba(255,255,255,0.12)",
              color: profile?.discipline === d ? ACCENT : "rgba(255,255,255,0.6)",
            }}
          >
            {d}
          </button>
        ))}
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-2">
      <span className="font-mono text-[11px] tracking-wide text-white/40">
        {profile?.discipline ?? "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-white/20" strokeWidth={1.75} />
    </button>
  )
}

/**
 * All editable settings for the athlete. Receives the active `?focus=` token so
 * deep-links open the right editor, and `onCompleteFix` so the missing-input
 * retry flow returns the athlete to where they came from after saving.
 */
export function ProfileSettings({
  focus,
  onCompleteFix,
}: {
  focus: string | null
  onCompleteFix: () => void
}) {
  const { data: profile, isLoading } = useAthleteExtendedProfile()
  const { signOut } = useClerk()
  const [hlToken, setHlToken] = useState<string | null>(null)
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

  useEffect(() => {
    trackScreen("settings")
  }, [])

  useEffect(() => {
    if (!focus) return undefined
    const el = document.getElementById(`cfg-${focus}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setHlToken(focus)
      const t = setTimeout(() => setHlToken(null), 2600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [focus])

  const configRows: {
    icon: typeof User
    label: string
    value?: string
    custom?: React.ReactNode
    focusToken?: string
  }[] = [
    { icon: User, label: "Profiel", value: profile?.displayName ?? "—" },
    {
      icon: Activity,
      label: "Rol",
      value: profile?.activeRole
        ? profile.activeRole.charAt(0).toUpperCase() + profile.activeRole.slice(1)
        : "Atleet",
    },
    {
      icon: Bike,
      label: "Discipline",
      focusToken: "sportProfile",
      custom: (
        <DisciplineInlineEditor
          autoOpen={focus === "sportProfile"}
          onSaved={focus === "sportProfile" ? onCompleteFix : undefined}
        />
      ),
    },
    {
      icon: Zap,
      label: "FTP",
      focusToken: "ftp",
      custom: (
        <FtpInlineEditor
          autoOpen={focus === "ftp"}
          onSaved={focus === "ftp" ? onCompleteFix : undefined}
        />
      ),
    },
    {
      icon: Clock,
      label: "Uren per week",
      focusToken: "weeklyHours",
      custom: (
        <WeeklyHoursInlineEditor
          autoOpen={focus === "weeklyHours"}
          onSaved={focus === "weeklyHours" ? onCompleteFix : undefined}
        />
      ),
    },
    {
      icon: Scale,
      label: "Gewicht",
      focusToken: "weight",
      custom: (
        <WeightInlineEditor
          autoOpen={focus === "weight"}
          onSaved={focus === "weight" ? onCompleteFix : undefined}
        />
      ),
    },
    {
      icon: Ruler,
      label: "Lengte",
      focusToken: "height",
      custom: (
        <HeightInlineEditor
          autoOpen={focus === "height"}
          onSaved={focus === "height" ? onCompleteFix : undefined}
        />
      ),
    },
    {
      icon: Cake,
      label: "Geboortedatum",
      focusToken: "birthYear",
      custom: (
        <BirthYearInlineEditor
          autoOpen={focus === "birthYear"}
          onSaved={focus === "birthYear" ? onCompleteFix : undefined}
        />
      ),
    },
    {
      icon: Target,
      label: "Doelen",
      value: profile?.goals
        ? profile.goals.slice(0, 28) + (profile.goals.length > 28 ? "…" : "")
        : "Geen doelen",
    },
    { icon: HeartPulse, label: "Gezondheid", value: "Check-in hieronder" },
    { icon: Shield, label: "Privacy", value: "Geregeld" },
    { icon: Settings, label: "Voorkeuren", value: "Standaard" },
  ]

  return (
    <div className="flex flex-col gap-9">
      {/* DOELEN */}
      <FocusTarget token="goal" focus={focus}>
        <section>
          <SectionLabel n="01" title="Doelen" />
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <GoalsSection
                autoOpen={focus === "goal"}
                onSaved={focus === "goal" ? onCompleteFix : undefined}
              />
            )}
          </div>
        </section>
      </FocusTarget>

      {/* DAGELIJKSE CHECK-IN (uitgebreid) */}
      <FocusTarget token="checkin" focus={focus}>
        <section>
          <SectionLabel n="02" title="Uitgebreide check-in" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/35">
            Wil je meer kwijt dan je dag-gevoel? Log hier slaap, vermoeidheid en HRV.
          </p>
          <div className="mt-4">
            <CheckInForm onSaved={focus === "checkin" ? onCompleteFix : undefined} />
          </div>
        </section>
      </FocusTarget>

      {/* PROFIELGEGEVENS */}
      <section>
        <SectionLabel n="03" title="Profielgegevens" />
        <div className="mt-3 flex flex-col">
          {configRows.map((row) => {
            const Icon = row.icon
            const highlighted = !!row.focusToken && hlToken === row.focusToken
            return (
              <div
                key={row.label}
                id={row.focusToken ? `cfg-${row.focusToken}` : undefined}
                className={`flex items-center gap-4 border-b border-white/[0.05] py-3.5 last:border-0 ${
                  highlighted ? "rounded-xl ring-2 ring-cyan-300/50" : ""
                }`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Icon className="h-4 w-4 text-white/55" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-[14px] tracking-tight text-white/85">
                  {row.label}
                </span>
                {row.custom ? (
                  row.custom
                ) : (
                  <span className="font-mono text-[11px] tracking-wide text-white/40">
                    {row.value}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-white/25" strokeWidth={1.75} />
              </div>
            )
          })}
        </div>
      </section>

      {/* HOE SPARKI KLINKT */}
      <section>
        <SectionLabel n="04" title="Hoe Sparki klinkt" />
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/35">
          Sparki's toon groeit mee naarmate jullie elkaar beter leren kennen
        </p>
        <SparkiVoiceSection />
      </section>

      <FoundingSection />

      <TeamIdentitySection />

      <FocusTarget token="connections" focus={focus}>
        <ConnectionsSection />
      </FocusTarget>

      <PrivacySettingsSection />
      <ProfilePrivacyGrid />
      <AccountPrivacyPanel />

      <ReminderSettingsSection />

      <LinksSection />

      <BugReportForm />

      <TesterAccessLinks />

      <AdminPanel />

      {/* UITLOGGEN */}
      <section className="pt-2">
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] py-3.5 font-sans text-[13px] text-white/35 transition-colors hover:border-white/15 hover:text-white/50"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Uitloggen
        </button>
      </section>

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER · v1.0
        </span>
      </footer>
    </div>
  )
}
