import { useState } from "react"
import { Link } from "wouter"
import { HeartPulse, Moon, Smile, CalendarDays, Users, X } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useParentAthletes,
  useEndParentLink,
  type ParentAthlete,
} from "@/hooks/use-parent"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

const healthLabel: Record<string, string> = {
  ok: "Gezond",
  sick: "Ziek",
  injured: "Geblesseerd",
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      <Icon className="h-4 w-4 text-white/45" strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-white/35">
          {label}
        </div>
        <div className="text-[13px] text-white/80">{value}</div>
      </div>
    </div>
  )
}

function AthleteCard({
  a,
  onEndLink,
  ending,
}: {
  a: ParentAthlete
  onEndLink: () => void
  ending: boolean
}) {
  const wb = a.wellbeing
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-[15px] tracking-tight text-white/90">
          {a.displayName ?? "Atleet"}
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px]"
          style={{
            color:
              a.healthStatus && a.healthStatus !== "ok"
                ? "oklch(0.75 0.17 40)"
                : "oklch(0.82 0.16 150)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          {healthLabel[a.healthStatus ?? "ok"] ?? a.healthStatus}
        </span>
        <button
          type="button"
          onClick={onEndLink}
          disabled={ending}
          aria-label="Koppeling met atleet beëindigen"
          title="Koppeling beëindigen"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {a.sharing === "none" ? (
        <p className="mt-3 text-[12px] text-white/35">
          Deze atleet deelt momenteel geen gegevens.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat
              icon={Moon}
              label="Slaap"
              value={wb?.sleepHours ? `${wb.sleepHours} u` : "—"}
            />
            <Stat
              icon={HeartPulse}
              label="Vermoeidheid"
              value={wb?.fatigueScore != null ? `${wb.fatigueScore}/10` : "—"}
            />
            <Stat
              icon={Smile}
              label="Gevoel"
              value={wb?.feelScore != null ? `${wb.feelScore}/10` : "—"}
            />
          </div>

          {a.sharing === "summary" && a.schedule && a.schedule.length > 0 && (
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/35">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                Komende sessies
              </div>
              <ul className="space-y-1.5">
                {a.schedule.slice(0, 3).map((s, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-[12px] text-white/60"
                  >
                    <span className="truncate">{s.title}</span>
                    <span className="ml-2 shrink-0 text-white/35">
                      {fmtDate(s.scheduledDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {a.parentConsentStatus === "pending" && (
        <p className="mt-3 text-[11px] text-white/35">
          Ouderlijke toestemming in behandeling.
        </p>
      )}
    </div>
  )
}

export function ParentHome() {
  const { data, isLoading } = useParentAthletes()
  const endLink = useEndParentLink()
  const [pendingEnd, setPendingEnd] = useState<string | null>(null)
  const athletes = data?.athletes ?? []

  function handleEndLink(a: ParentAthlete) {
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
    <ScreenShell section="Ouder" bg="/concept-lab.png">
      <div className="space-y-5">
        <div>
          <SectionLabel n="01" title="Welzijn & veiligheid" />
          <p className="mt-2 text-[13px] text-white/45">
            Rust, herstel en welzijn van je kind. Prestatiedata wordt niet
            gedeeld — alleen veiligheids- en welzijnssignalen.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl bg-white/[0.05]"
              />
            ))}
          </div>
        ) : athletes.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <Users
              className="mx-auto mb-3 h-7 w-7 text-white/30"
              strokeWidth={1.5}
            />
            <p className="text-[14px] text-white/60">
              Nog geen atleet gekoppeld
            </p>
            <Link
              href="/invitations"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: ACCENT }}
            >
              Uitnodiging versturen
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
      </div>
    </ScreenShell>
  )
}
