import { useState } from "react"
import { Link } from "wouter"
import { Users, ChevronRight, CalendarDays, Activity, X } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useCoachRoster,
  useEndCoachLink,
  type RosterAthlete,
} from "@/hooks/use-coach"

const readinessLabel: Record<string, { nl: string; color: string }> = {
  fresh: { nl: "Fris", color: "oklch(0.82 0.16 150)" },
  ok: { nl: "Oké", color: ACCENT },
  tired: { nl: "Vermoeid", color: "oklch(0.75 0.17 40)" },
  unknown: { nl: "Geen data", color: "rgba(255,255,255,0.35)" },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function AthleteCard({
  a,
  onEndLink,
  ending,
}: {
  a: RosterAthlete
  onEndLink: () => void
  ending: boolean
}) {
  const r = a.readiness?.label ?? "unknown"
  const rl = readinessLabel[r]
  const canOpen = a.sharing !== "none"
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-medium text-white/80"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {(a.displayName ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] tracking-tight text-white/90">
            {a.displayName ?? "Atleet"}
          </div>
          <div className="truncate text-[12px] text-white/40">
            {a.discipline ?? "—"}
            {a.healthStatus && a.healthStatus !== "ok"
              ? ` · ${a.healthStatus === "sick" ? "ziek" : a.healthStatus === "injured" ? "geblesseerd" : a.healthStatus}`
              : ""}
          </div>
        </div>
        {a.sharing === "none" ? (
          <span className="text-[11px] text-white/30">Deelt niet</span>
        ) : (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ color: rl.color, background: "rgba(255,255,255,0.05)" }}
          >
            {rl.nl}
            {a.readiness?.score != null ? ` ${a.readiness.score}` : ""}
          </span>
        )}
      </div>

      {a.sharing !== "none" && (
        <div className="mt-3 flex items-center gap-4 text-[12px] text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
            {a.nextSession
              ? `${fmtDate(a.nextSession.scheduledDate)} · ${a.nextSession.title}`
              : "Geen geplande sessie"}
          </span>
          <span
            className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: ACCENT }}
          >
            Sparki-advies
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
          </span>
        </div>
      )}
    </>
  )

  const cardClass =
    "block rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"

  const endLinkButton = (
    <button
      type="button"
      onClick={onEndLink}
      disabled={ending}
      aria-label="Koppeling met atleet beëindigen"
      title="Koppeling beëindigen"
      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40"
    >
      <X className="h-4 w-4" strokeWidth={1.75} />
    </button>
  )

  if (!canOpen) {
    return (
      <div className={`relative ${cardClass}`}>
        {inner}
        {endLinkButton}
      </div>
    )
  }
  return (
    <div className="relative">
      <Link
        href={`/coach/athletes/${a.athleteClerkId}/plan`}
        className={`${cardClass} pr-10 transition-colors hover:border-cyan-300/25`}
      >
        {inner}
      </Link>
      {endLinkButton}
    </div>
  )
}

export function CoachHome() {
  const { data, isLoading } = useCoachRoster()
  const endLink = useEndCoachLink()
  const [pendingEnd, setPendingEnd] = useState<string | null>(null)
  const athletes = data?.athletes ?? []

  function handleEndLink(a: RosterAthlete) {
    const name = a.displayName ?? "deze atleet"
    if (
      !window.confirm(
        `Koppeling met ${name} beëindigen? Je hebt daarna geen toegang meer tot hun gegevens.`,
      )
    )
      return
    setPendingEnd(a.athleteClerkId)
    endLink.mutate(a.athleteClerkId, {
      onSettled: () => setPendingEnd(null),
    })
  }

  return (
    <ScreenShell section="Coach" bg="/concept-lab.png">
      <div className="space-y-5">
        <div>
          <SectionLabel n="01" title="Jouw atleten" />
          <p className="mt-2 text-[13px] text-white/45">
            Readiness en planning van gekoppelde atleten. Wat je ziet hangt af
            van de privacy-instelling van elke atleet.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-white/[0.05]"
              />
            ))}
          </div>
        ) : athletes.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <Users
              className="mx-auto mb-3 h-7 w-7 text-white/30"
              strokeWidth={1.5}
            />
            <p className="text-[14px] text-white/60">Nog geen atleten gekoppeld</p>
            <Link
              href="/invitations"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: ACCENT }}
            >
              Atleet uitnodigen
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {athletes.map((a) => (
              <AthleteCard
                key={a.athleteClerkId}
                a={a}
                onEndLink={() => handleEndLink(a)}
                ending={pendingEnd === a.athleteClerkId}
              />
            ))}
          </div>
        )}

        <Link
          href="/invitations"
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] py-3 text-[13px] text-white/55 transition-colors hover:border-white/15 hover:text-white/75"
        >
          <Activity className="h-4 w-4" strokeWidth={1.75} />
          Uitnodigingen beheren
        </Link>
      </div>
    </ScreenShell>
  )
}
