import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { PrivacySettingsSection } from "@/components/sparki/privacy-settings"
import { ConnectionsSection } from "@/components/sparki/connections-section"
import { LinksSection } from "@/components/sparki/links-section"
import { BugReportForm } from "@/components/sparki/bug-report-form"
import { AdminPanel } from "@/components/sparki/admin-panel"
import { useAthleteExtendedProfile, useUpdateAthleteProfile } from "@/hooks/use-athlete-extended-profile"
import { useLogDailyMetrics } from "@/hooks/use-daily-metrics"
import { useLogFtp } from "@/hooks/use-ftp-history"
import { useTeamIdentity, useSaveTeamIdentity } from "@/hooks/use-social"
import { useClerk } from "@clerk/react"
import {
  Check,
  Pencil,
  User,
  Activity,
  Bike,
  Zap,
  Scale,
  Target,
  HeartPulse,
  Settings,
  ChevronRight,
  Shield,
  LogOut,
} from "lucide-react"

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
        logoUrl: "/club-crest.svg",
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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function IdentityStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="font-sans text-lg font-light tabular-nums"
        style={{ color: accent ? ACCENT : "rgba(255,255,255,0.9)" }}
      >
        {value}
      </span>
      <span className="font-mono text-[9px] tracking-[0.18em] text-white/35">
        {label.toUpperCase()}
      </span>
    </div>
  )
}

function FtpInlineEditor() {
  const { data: profile } = useAthleteExtendedProfile()
  const logFtp = useLogFtp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  const handleSave = () => {
    const watts = parseInt(value)
    if (!watts || watts < 50 || watts > 600) return
    logFtp.mutate(
      { ftpWatts: watts, testType: "manual" },
      {
        onSuccess: () => {
          setEditing(false)
          setValue("")
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

function CheckInForm() {
  const logMetrics = useLogDailyMetrics()
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
      { onSuccess: () => setSaved(true) },
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
        <input
          type="number"
          value={form.hrv}
          onChange={set("hrv")}
          placeholder="bijv. 82"
          min={20}
          max={250}
          className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
        />
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

function GoalsSection() {
  const { data: profile } = useAthleteExtendedProfile()
  const updateProfile = useUpdateAthleteProfile()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  const start = () => {
    setValue(profile?.goals ?? "")
    setEditing(true)
  }

  const save = () => {
    updateProfile.mutate(
      { goals: value },
      { onSuccess: () => setEditing(false) },
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
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
    )
  }

  return (
    <div className="flex items-start gap-3">
      <p className="flex-1 text-pretty text-[14px] leading-relaxed text-white/60">
        {profile?.goals ?? (
          <span className="text-white/25">Nog geen doelen ingesteld</span>
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
  )
}

export default function YouPage() {
  const { data: profile, isLoading } = useAthleteExtendedProfile()
  const { signOut } = useClerk()
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

  const initials = (profile?.displayName ?? "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const configRows: {
    icon: typeof User
    label: string
    value?: string
    custom?: React.ReactNode
  }[] = [
    {
      icon: User,
      label: "Profiel",
      value: profile?.displayName ?? "—",
    },
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
      value: profile?.discipline ?? "Niet ingesteld",
    },
    {
      icon: Zap,
      label: "FTP",
      custom: <FtpInlineEditor />,
    },
    {
      icon: Scale,
      label: "Gewicht",
      value: profile?.weightKg ? `${profile.weightKg} kg` : "Niet ingesteld",
    },
    {
      icon: Target,
      label: "Doelen",
      value: profile?.goals
        ? profile.goals.slice(0, 28) + (profile.goals.length > 28 ? "…" : "")
        : "Geen doelen",
    },
    {
      icon: HeartPulse,
      label: "Gezondheid",
      value: "Check-in hieronder",
    },
    {
      icon: Shield,
      label: "Privacy",
      value: "Geregeld",
    },
    {
      icon: Settings,
      label: "Voorkeuren",
      value: "Standaard",
    },
  ]

  return (
    <ScreenShell section="You">
      {/* IDENTITY */}
      <section className="flex flex-col items-center">
        {isLoading ? (
          <Skeleton className="h-32 w-32 rounded-full" />
        ) : (
          <div className="relative flex items-center justify-center">
            <SparkiCore size={132} accent={ACCENT} readiness={0.87} variant="orb" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-sans text-2xl font-extralight tracking-tight">
                {initials}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
              {profile?.displayName ?? "Atleet"}
            </h1>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-white/40">
              ELITE · {(profile?.discipline ?? "Road").toUpperCase()}
            </p>
            <div className="mt-5 flex items-center gap-5">
              <IdentityStat
                label="FTP"
                value={profile?.ftp ? `${profile.ftp}W` : "—"}
              />
              <span className="h-7 w-px bg-white/[0.08]" />
              <IdentityStat
                label="W/kg"
                value={profile?.wkg ? String(profile.wkg) : "—"}
                accent
              />
              <span className="h-7 w-px bg-white/[0.08]" />
              <IdentityStat
                label="Gewicht"
                value={profile?.weightKg ? `${profile.weightKg}kg` : "—"}
              />
            </div>
          </>
        )}
      </section>

      {/* 01 DOELEN */}
      <section>
        <SectionLabel n="01" title="Doelen" />
        <div className="mt-3">
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <GoalsSection />
          )}
        </div>
      </section>

      {/* 02 DAGELIJKSE CHECK-IN */}
      <section>
        <SectionLabel n="02" title="Dagelijkse check-in" />
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/35">
          Log dagelijkse gereedheid om Sparki's adviezen te voeden
        </p>
        <div className="mt-4">
          <CheckInForm />
        </div>
      </section>

      {/* 03 INSTELLINGEN */}
      <section>
        <SectionLabel n="03" title="Instellingen" />
        <div className="mt-3 flex flex-col">
          {configRows.map((row) => {
            const Icon = row.icon
            return (
              <div
                key={row.label}
                className="flex items-center gap-4 border-b border-white/[0.05] py-3.5 last:border-0"
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

      <TeamIdentitySection />

      <ConnectionsSection />

      <PrivacySettingsSection />

      <LinksSection />

      <BugReportForm />

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
    </ScreenShell>
  )
}
