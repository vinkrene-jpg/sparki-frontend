import { localISODate } from "@/lib/commercial-shell"
import { TIER_PRICING, formatEuro } from "@workspace/pricing"
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
import { Link } from "wouter"
import { trackScreen } from "@/lib/telemetry"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useBillingStatus,
  useStartTrial,
  useStartCheckout,
  useOpenPortal,
} from "@/hooks/use-billing"
import { PrivacySettingsSection } from "@/components/sparki/privacy-settings"
import { AccountPrivacyPanel } from "@/components/sparki/account-privacy-panel"
import { ProfilePrivacyGrid } from "@/components/sparki/profile-privacy-grid"
import { ReminderSettingsSection } from "@/components/sparki/reminder-settings"
import { ConnectionsSection } from "@/components/sparki/connections-section"
import { LinksSection } from "@/components/sparki/links-section"
import { BugReportForm } from "@/components/sparki/bug-report-form"
import { AdminPanel, TesterAccessLinks } from "@/components/sparki/admin-panel"
import { SparkiVoiceSection } from "@/components/sparki/sparki-voice"
import { useAiPreferences, useUpdateAiPreferences } from "@/hooks/use-ai-memory"
import { HUMOR_LEVELS, HUMOR_LEVEL_LABELS, HUMOR_LEVEL_BLURBS, type HumorLevel } from "@/lib/humor"
import { HumorLine } from "@/components/sparki/humor-line"
import { uploadFile } from "@/hooks/use-input-center"
import { clubLogoSrc } from "@/lib/club-logo"
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
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
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
          ? "rounded-2xl ring-2 ring-ring/50 transition-all duration-500"
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
    logoUrl: null as string | null,
  })
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const start = () => {
    setForm({
      clubName: team?.clubName ?? "",
      teamName: team?.teamName ?? "",
      category: team?.category ?? "",
      shirtBadge: team?.shirtBadge ?? "",
      primaryColor: team?.primaryColor ?? "#0ea5b7",
      secondaryColor: team?.secondaryColor ?? "#0b1220",
      logoUrl: team?.logoUrl ?? null,
    })
    setLogoError(null)
    setEditing(true)
  }

  // Upload the club's own logo file (presign → PUT → path saved on submit).
  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setLogoError("Kies een afbeelding (PNG, JPG of WebP).")
      return
    }
    setLogoBusy(true)
    setLogoError(null)
    try {
      const uploaded = await uploadFile(file, "image")
      setForm((p) => ({ ...p, logoUrl: uploaded.objectPath }))
    } catch {
      setLogoError("Uploaden van het logo is mislukt. Probeer het opnieuw.")
    } finally {
      setLogoBusy(false)
    }
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
        // Only a logo the club actually has: the athlete's own uploaded file
        // (or nothing). Never a canned placeholder crest.
        logoUrl: form.logoUrl,
        sport: "cycling",
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  const fieldClass =
    "w-full rounded-xl border border-border bg-muted px-3.5 py-2.5 font-sans text-[14px] text-foreground/90 placeholder:text-muted-foreground focus:border-accent-cyan focus:outline-none"

  return (
    <section>
      <SectionLabel title="Club & team" />
      {isLoading ? (
        <div className="mt-3 h-16 animate-pulse rounded-2xl bg-muted" />
      ) : editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
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
              <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
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
              <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
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
              <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
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
                <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                  KLEUR 1
                </label>
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={set("primaryColor")}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-muted"
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                  KLEUR 2
                </label>
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={set("secondaryColor")}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-muted"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              CLUBLOGO
            </label>
            <div className="mt-1.5 flex items-center gap-3">
              {form.logoUrl ? (
                <img
                  src={clubLogoSrc(form.logoUrl)}
                  alt="Clublogo"
                  className="h-11 w-11 shrink-0 rounded-full border border-border bg-muted object-contain p-1"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border font-mono text-[9px] text-muted-foreground">
                  GEEN
                </span>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onLogoFile}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                aria-label="Kies een clublogo (PNG, JPEG of WEBP)"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoBusy}
                aria-label={form.logoUrl ? "Vervang het clublogo" : "Upload een clublogo"}
                className="rounded-xl border border-border px-3.5 py-2 font-sans text-[13px] text-muted-foreground disabled:opacity-40"
              >
                {logoBusy ? "Uploaden…" : form.logoUrl ? "Ander logo" : "Upload logo"}
              </button>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, logoUrl: null }))}
                  aria-label="Verwijder het clublogo"
                  className="rounded-xl border border-border px-3.5 py-2 font-sans text-[13px] text-muted-foreground"
                >
                  Verwijder
                </button>
              )}
            </div>
            <p className="mt-1.5 font-sans text-[12px] text-muted-foreground">
              Alleen met een geüpload logo verschijnt het club-embleem op je Home-scherm; zonder
              logo tonen we niets.
            </p>
            {logoError && (
              <p className="mt-1 font-sans text-[12px] text-[color:var(--color-negative)]">{logoError}</p>
            )}
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
              className="rounded-xl border border-border px-4 py-2 font-sans text-[13px] text-muted-foreground"
            >
              Annuleer
            </button>
          </div>
        </div>
      ) : team && team.clubName ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: team.primaryColor
                ? `${team.primaryColor}66`
                : "rgba(255,255,255,0.15)",
              background: team.primaryColor ? `${team.primaryColor}22` : undefined,
            }}
          >
            {team.logoUrl ? (
              <img
                src={clubLogoSrc(team.logoUrl)}
                alt="Clublogo"
                className="h-8 w-8 rounded-full object-contain"
              />
            ) : (
              <Shield
                className="h-5 w-5"
                style={{ color: team.primaryColor ?? ACCENT }}
                strokeWidth={1.75}
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground/90">
              {team.clubName}
            </p>
            <p className="truncate font-mono text-[10px] tracking-wide text-muted-foreground">
              {[team.teamName, team.category].filter(Boolean).join(" · ") ||
                "Wielrennen"}
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <div className="ds-actiebalk">
          <button
            type="button"
            onClick={start}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3.5 font-sans text-[13px] text-muted-foreground transition-colors hover:border-accent-cyan hover:text-muted-foreground"
          >
            <Shield className="h-4 w-4" strokeWidth={1.75} />
            Voeg je club & team toe
          </button>
        </div>
      )}
    </section>
  )
}

// ── Sparki-stijl: centraal instelbaar humorniveau ────────────────────────────
// "Instellingen > Sparki-stijl > Humor". Per gebruiker opgeslagen in
// ai_preferences.humor_level; werkt app-breed via de centrale humorlaag
// (lib/humor.ts) en de voice-engine op de server.
function SparkiStyleSection({ autoOpen, onSaved }: EditorProps = {}) {
  const { data, isLoading } = useAiPreferences()
  const update = useUpdateAiPreferences()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoOpen && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [autoOpen])

  const current: HumorLevel = (HUMOR_LEVELS as readonly string[]).includes(
    String(data?.preferences?.humorLevel),
  )
    ? (data!.preferences.humorLevel as HumorLevel)
    : "normaal"

  const choose = (level: HumorLevel) => {
    if (level === current) return
    update.mutate({ humorLevel: level }, { onSuccess: () => onSaved?.() })
  }

  return (
    <section ref={ref}>
      <SectionLabel n="03b" title="Sparki-stijl" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
        Hoeveel droge humor mag er zijn? Dit geldt overal in de app.
        Bij medische signalen, veiligheid, privacy en andere serieuze momenten
        blijft de toon altijd zakelijk — ongeacht deze instelling.
      </p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
            Humor
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {HUMOR_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                disabled={isLoading || update.isPending}
                onClick={() => choose(level)}
                className={`rounded-full border px-3 py-1.5 text-[12px] tracking-tight transition-colors ${
                  current === level
                    ? "border-cyan-400/60 bg-cyan-400/15 text-accent-cyan"
                    : "border-border bg-muted text-muted-foreground hover:border-border"
                }`}
              >
                {HUMOR_LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
        <p className="pl-[76px] text-[11px] leading-relaxed text-muted-foreground">
          {HUMOR_LEVEL_BLURBS[current]}
        </p>
        {update.isError ? (
          <p className="pl-[76px] text-[11px] text-[color:var(--color-negative)]">
            Opslaan is niet gelukt. Probeer het opnieuw.
          </p>
        ) : update.isSuccess && current !== "uit" ? (
          <HumorLine
            context="success_save"
            seedSalt={current}
            className="pl-[76px]"
          />
        ) : null}
      </div>
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
          className="w-24 rounded-lg border border-accent-cyan bg-muted px-2.5 py-1.5 font-sans text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none"
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
        <span className="font-mono text-[11px] text-muted-foreground">W</span>
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
      <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
        {profile?.ftp ? `${profile.ftp}W` : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
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
      <div className="flex items-center gap-2 rounded-2xl border border-accent-cyan bg-accent-cyan px-4 py-3">
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
      <div className="mt-1 flex justify-between px-0.5 font-mono text-[9px] tracking-[0.15em] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
          HOE VOEL JE JE? (1–5)
        </label>
        {ratingButtons("feelScore", 5, "slecht", "top")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
          SLAAPKWALITEIT (1–5)
        </label>
        {ratingButtons("sleepQuality", 5, "slecht", "uitstekend")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
          VERMOEIDHEID (1–10)
        </label>
        {ratingButtons("fatigueScore", 10, "fris", "uitgeput")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
          HRV (ms, optioneel)
        </label>
        {hrvSupplier && !hrvManual ? (
          <div className="flex flex-col gap-1.5 rounded-xl border border-accent-cyan bg-accent-cyan px-3.5 py-2.5">
            <span className="text-[13px] text-muted-foreground">
              Je HRV wordt automatisch opgehaald uit {hrvSupplier.displayName}
              {formatLastSync(hrvSupplier.lastSyncAt)
                ? ` — laatste sync ${formatLastSync(hrvSupplier.lastSyncAt)}`
                : ""}
              . Je hoeft dit niet zelf in te vullen.
            </span>
            <button
              type="button"
              onClick={() => setHrvManual(true)}
              className="self-start font-sans text-[11px] font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground"
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
            className="rounded-xl border border-border bg-muted px-3.5 py-2.5 font-sans text-[14px] text-foreground/90 placeholder:text-muted-foreground focus:border-accent-cyan focus:outline-none"
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
        <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
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
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
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
        <label className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
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
              className="w-full resize-none rounded-xl border border-accent-cyan bg-muted px-3.5 py-3 font-sans text-[14px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none"
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
                className="rounded-xl border border-border px-4 py-2 font-sans text-[13px] text-muted-foreground"
              >
                Annuleer
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-3">
            <p className="flex-1 text-pretty text-[14px] leading-relaxed text-muted-foreground">
              {profile?.goals ?? (
                <span className="text-muted-foreground">Nog geen toelichting</span>
              )}
            </p>
            <button
              type="button"
              onClick={start}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
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
          className="w-20 rounded-lg border border-accent-cyan bg-muted px-2.5 py-1.5 font-sans text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none"
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
        <span className="font-mono text-[11px] text-muted-foreground">u/wk</span>
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
      <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
        {profile?.weeklyHourTarget
          ? `${profile.weeklyHourTarget} u/wk${profile.weeklyHourTargetEstimated ? " (schatting)" : ""}`
          : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
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
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
          {profile?.weightKg ? `${profile.weightKg} kg` : "Nog niet gesynct"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Dit wordt opgehaald uit {weightSupplier.displayName}
          {lastSync ? ` · ${lastSync}` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            setValue(profile?.weightKg ?? "")
            setEditing(true)
          }}
          className="mt-0.5 font-sans text-[10px] font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground"
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
          className="w-20 rounded-lg border border-accent-cyan bg-muted px-2.5 py-1.5 font-sans text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none"
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
        <span className="font-mono text-[11px] text-muted-foreground">kg</span>
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
      <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
        {profile?.weightKg ? `${profile.weightKg} kg` : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
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
          className="w-20 rounded-lg border border-accent-cyan bg-muted px-2.5 py-1.5 font-sans text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none"
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
        <span className="font-mono text-[11px] text-muted-foreground">cm</span>
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
      <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
        {profile?.heightCm != null ? `${profile.heightCm} cm` : "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
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
  const todayIso = localISODate()

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
          className="rounded-lg border border-accent-cyan bg-muted px-2.5 py-1.5 font-sans text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none [color-scheme:light]"
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
      <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
        {formatBirth(profile?.birthDate ?? null, profile?.birthYear ?? null)}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
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
      <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
        {profile?.discipline ?? "Niet ingesteld"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
    </button>
  )
}

function BillingSection() {
  const { data } = useBillingStatus()
  const startTrial = useStartTrial()
  const startCheckout = useStartCheckout()
  const openPortal = useOpenPortal()

  if (!data) return null
  const { available } = data
  const tierBadge =
    data.status === "legacy_unrestricted"
      ? "Volledige toegang"
      : data.tier === "GO"
        ? "Sparki Go"
        : data.tier === "COMPLETE"
          ? "Sparki Compleet"
          : "Gratis"

  const statusLabel: Record<string, string> = {
    trialing: "Proefperiode actief",
    active: "Actief",
    grace: "Betaling mislukt — respijtperiode",
    canceled: "Opgezegd (toegang tot periode-einde)",
    expired: "Verlopen",
    blocked: "Geblokkeerd",
    free: "Gratis",
    // ABONNEMENT_01 §1.1 — eerlijke labels voor de nieuwe statussen.
    incomplete: "Betaling niet afgerond",
    paused: "Gepauzeerd",
    unknown: "Status onbekend — veilig teruggezet naar Gratis",
    legacy_unrestricted: "Volledige toegang (bestaand account)",
  }

  const btn =
    "rounded-xl border border-border bg-muted px-3 py-2 text-[12px] text-foreground/80 transition hover:bg-muted disabled:opacity-40"

  return (
    <section id="cfg-abonnement">
      <SectionLabel title="Abonnement" />
      <div className="mt-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground">
            Status:{" "}
            <span className="text-foreground/90">
              {statusLabel[data.status] ?? data.status}
            </span>
          </p>
          <span className="rounded-full border border-accent-cyan bg-accent-cyan px-2.5 py-0.5 text-[10px] font-medium text-accent-cyan">
            {tierBadge}
          </span>
        </div>
        <Link
          href="/abonnement"
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-accent-cyan bg-accent-cyan px-3 py-2 text-[12px] font-medium text-accent-cyan transition hover:bg-accent-cyan"
        >
          Bekijk lagen en prijzen
        </Link>
        {data.trialEndsAt && data.status === "trialing" && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Proef loopt tot {new Date(data.trialEndsAt).toLocaleDateString("nl-NL")}
          </p>
        )}
        {data.plannedDowngradeTier && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Wordt Sparki {data.plannedDowngradeTier} bij de volgende periode
          </p>
        )}
        <p className="mt-1 text-[11px] text-[color:var(--color-warning)]">
          Testomgeving — er wordt niets echt afgeschreven.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {available.trial && (
            <>
              <button
                className={btn}
                disabled={startTrial.isPending}
                onClick={() => startTrial.mutate("GO")}
              >
                Probeer GO gratis (7 dagen)
              </button>
              <button
                className={btn}
                disabled={startTrial.isPending}
                onClick={() => startTrial.mutate("COMPLETE")}
              >
                Probeer COMPLETE gratis (14 dagen)
              </button>
            </>
          )}
          {available.checkout && (
            <>
              <button
                className={btn}
                disabled={startCheckout.isPending}
                onClick={() => startCheckout.mutate({ tier: "GO", interval: "month" })}
              >
                Sparki GO — {formatEuro(TIER_PRICING.GO.month)}/mnd
              </button>
              <button
                className={btn}
                disabled={startCheckout.isPending}
                onClick={() =>
                  startCheckout.mutate({ tier: "COMPLETE", interval: "month" })
                }
              >
                Sparki COMPLETE — {formatEuro(TIER_PRICING.COMPLETE.month)}/mnd
              </button>
            </>
          )}
          {available.portal && (
            <button
              className={btn}
              disabled={openPortal.isPending}
              onClick={() => openPortal.mutate()}
            >
              Beheer abonnement
            </button>
          )}
        </div>
        {(startTrial.isError || startCheckout.isError || openPortal.isError) && (
          <p className="mt-2 text-[11px] text-[color:var(--color-negative)]">
            {(startTrial.error ?? startCheckout.error ?? openPortal.error)?.message ??
              "Er ging iets mis"}
          </p>
        )}
      </div>
    </section>
  )
}
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
    // Secties laden asynchroon (abonnement wacht bijv. op billing-status) en de
    // sheet animeert open — één keer scrollen mist het doel dan. Blijf ~2,5s
    // her-scrollen tot de positie stabiel is (zelfde patroon als de Kompas-
    // deep-link in you.tsx), anders "belandt" de gebruiker bovenaan de sheet.
    let lastTop: number | null = null
    let stableTicks = 0
    let highlighted = false
    const started = Date.now()
    let hlTimer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const el = document.getElementById(`cfg-${focus}`)
      if (el) {
        if (!highlighted) {
          highlighted = true
          setHlToken(focus)
          hlTimer = setTimeout(() => setHlToken(null), 2600)
        }
        const top = el.getBoundingClientRect().top
        if (lastTop === null || Math.abs(top - lastTop) > 4) {
          el.scrollIntoView({ behavior: "auto", block: "center" })
          stableTicks = 0
        } else {
          stableTicks += 1
        }
        lastTop = el.getBoundingClientRect().top
      }
      if (stableTicks >= 3 || Date.now() - started > 2500) {
        window.clearInterval(interval)
      }
    }
    const interval = window.setInterval(tick, 250)
    tick()
    return () => {
      window.clearInterval(interval)
      if (hlTimer) clearTimeout(hlTimer)
    }
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
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
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
                className={`flex items-center gap-4 border-b border-border py-3.5 last:border-0 ${
                  highlighted ? "rounded-xl ring-2 ring-ring/50" : ""
                }`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-[14px] tracking-tight text-foreground/90">
                  {row.label}
                </span>
                {row.custom ? (
                  row.custom
                ) : (
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
                    {row.value}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
            )
          })}
        </div>
      </section>

      {/* SPARKI-STIJL */}
      <FocusTarget token="humor" focus={focus}>
        <SparkiStyleSection autoOpen={focus === "humor"} onSaved={onCompleteFix} />
      </FocusTarget>

      {/* HOE SPARKI KLINKT */}
      <section>
        <SectionLabel n="04" title="Hoe de app klinkt" />
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
          Sparki's toon groeit mee naarmate jullie elkaar beter leren kennen
        </p>
        <SparkiVoiceSection />
      </section>

      <FoundingSection />

      <BillingSection />

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
      <section className="pt-2 ds-actiebalk">
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3.5 font-sans text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-muted-foreground"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Uitloggen
        </button>
      </section>

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
          SPARKI PERFORMANCE CENTER · v1.0
        </span>
      </footer>
    </div>
  )
}
