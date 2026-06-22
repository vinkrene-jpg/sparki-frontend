import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { useAthleteExtendedProfile, useUpdateAthleteProfile } from "@/hooks/use-athlete-extended-profile"
import { useLogDailyMetrics } from "@/hooks/use-daily-metrics"
import { useLogFtp } from "@/hooks/use-ftp-history"
import { useClerk } from "@clerk/react"
import { Check, Pencil } from "lucide-react"

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
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-sans text-lg font-light tabular-nums"
        style={{
          color: accent ? ACCENT : "rgba(255,255,255,0.9)",
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      >
        {value}
      </span>
      <span className="label-xs text-white/35">{label.toUpperCase()}</span>
    </div>
  )
}

function FtpEditor() {
  const { data: profile } = useAthleteExtendedProfile()
  const logFtp = useLogFtp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  const handleSave = () => {
    const watts = parseInt(value)
    if (!watts || watts < 50 || watts > 600) return
    logFtp.mutate(
      { ftpWatts: watts, testType: "manual" },
      { onSuccess: () => { setEditing(false); setValue("") } },
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-3">
        <input
          autoFocus
          type="number"
          placeholder={String(profile?.ftp ?? "e.g. 280")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-xl border border-cyan-300/30 bg-white/[0.04] px-3 py-2 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") { setEditing(false); setValue("") }
          }}
          min={50}
          max={600}
        />
        <span className="label-sm text-white/40">W</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={logFtp.isPending || !value}
          className="flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Check className="h-4 w-4" style={{ color: "#040506" }} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setValue("") }}
          className="label-xs text-white/30"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="font-sans text-4xl font-extralight tabular-nums"
        style={{ color: ACCENT, fontVariantNumeric: "tabular-nums lining-nums" }}
      >
        {profile?.ftp ?? "—"}
      </span>
      <span className="label-sm text-white/40">W</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-colors hover:border-cyan-300/30"
      >
        <Pencil className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
      </button>
    </div>
  )
}

function GoalsEditor() {
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
          placeholder="e.g. Peak for Gran Fondo June, build to 4W/kg, top 10 Cat 3 race"
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
            {updateProfile.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl border border-white/[0.1] px-4 py-2 font-sans text-[13px] text-white/50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <p className="flex-1 text-pretty text-[14px] leading-relaxed text-white/60">
        {profile?.goals ?? (
          <span className="text-white/25">No goals set yet</span>
        )}
      </p>
      <button
        type="button"
        onClick={start}
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-colors hover:border-cyan-300/30"
      >
        <Pencil className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
      </button>
    </div>
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
      {
        onSuccess: () => setSaved(true),
      },
    )
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-3">
        <Check className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={2.5} />
        <span className="text-[13px] font-medium" style={{ color: ACCENT }}>
          Check-in logged for today
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
      <div className="mt-1 flex justify-between px-0.5 label-xs text-white/20">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="label-xs text-white/40">HOW DO YOU FEEL? (1–5)</label>
        {ratingButtons("feelScore", 5, "terrible", "great")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="label-xs text-white/40">SLEEP QUALITY (1–5)</label>
        {ratingButtons("sleepQuality", 5, "poor", "excellent")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="label-xs text-white/40">FATIGUE LEVEL (1–10)</label>
        {ratingButtons("fatigueScore", 10, "fresh", "exhausted")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="label-xs text-white/40">HRV (ms, optional)</label>
        <input
          type="number"
          value={form.hrv}
          onChange={set("hrv")}
          placeholder="e.g. 82"
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
        {logMetrics.isPending ? "Saving…" : "Log today's check-in"}
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

  return (
    <ScreenShell section="You">
      {/* IDENTITY */}
      <section className="flex flex-col items-center">
        {isLoading ? (
          <Skeleton className="h-32 w-32 rounded-full" />
        ) : (
          <div className="relative flex items-center justify-center">
            <SparkiCore size={132} accent={ACCENT} readiness={0.85} variant="orb" />
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
            <h1 className="mt-4 font-sans text-3xl font-extralight leading-tight tracking-tight">
              {profile?.displayName ?? "Athlete"}
            </h1>
            <p className="mt-1.5 font-mono text-[11px] tracking-[0.2em] text-white/40">
              {profile?.activeRole?.toUpperCase() ?? "ATHLETE"} ·{" "}
              {(profile?.discipline ?? "Cyclist").toUpperCase()}
            </p>
            <div className="mt-5 flex items-center gap-5">
              <IdentityStat
                label="FTP"
                value={profile?.ftp ? `${profile.ftp}W` : "—"}
                accent
              />
              <span className="h-7 w-px bg-white/[0.08]" />
              <IdentityStat
                label="W/kg"
                value={profile?.wkg ? String(profile.wkg) : "—"}
              />
              <span className="h-7 w-px bg-white/[0.08]" />
              <IdentityStat
                label="Weight"
                value={
                  profile?.weightKg ? `${profile.weightKg}kg` : "—"
                }
              />
            </div>
          </>
        )}
      </section>

      {/* FTP */}
      <section>
        <SectionLabel n="01" title="FTP" />
        <div className="mt-4">
          {isLoading ? (
            <Skeleton className="h-12 w-40" />
          ) : (
            <FtpEditor />
          )}
          {profile?.zones && (
            <p className="mt-3 text-[12px] leading-relaxed text-white/30">
              Zone 4 (Threshold):{" "}
              {profile.zones[3]?.min}–{profile.zones[3]?.max}W ·
              Zone 2 (Endurance):{" "}
              {profile.zones[1]?.min}–{profile.zones[1]?.max}W
            </p>
          )}
        </div>
      </section>

      {/* SEASON GOALS */}
      <section>
        <SectionLabel n="02" title="Season goals" />
        <div className="mt-3">
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <GoalsEditor />
          )}
        </div>
      </section>

      {/* DAILY CHECK-IN */}
      <section>
        <SectionLabel n="03" title="Today's check-in" />
        <p className="mt-2 text-[12px] leading-relaxed text-white/35">
          Log daily readiness to power Sparki's coaching insights
        </p>
        <div className="mt-4">
          <CheckInForm />
        </div>
      </section>

      {/* SIGN OUT */}
      <section className="pt-2">
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="w-full rounded-2xl border border-white/[0.08] py-3.5 font-sans text-[13px] text-white/35 transition-colors hover:border-white/15 hover:text-white/50"
        >
          Sign out
        </button>
      </section>

      <footer className="pt-2 text-center">
        <span className="label-xs text-white/15">SPARKI AI PERFORMANCE CENTER</span>
      </footer>
    </ScreenShell>
  )
}
