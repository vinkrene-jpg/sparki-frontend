import { Link } from "wouter"
import { CalendarDays, Dumbbell, Trophy, ChevronRight } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { usePlanWindow } from "@/hooks/use-training-plan"
import { useRaces } from "@/hooks/use-races"

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

type AgendaItem = {
  date: string
  kind: "training" | "race"
  title: string
  meta: string | null
}

// Hoofdstuk Kalender — één agenda-overzicht van wat er aankomt: geplande
// trainingen en wedstrijden, uit de bestaande, echte data. Geen nieuwe
// functionaliteit; puur bundelen van wat er al is.
export default function KalenderPage() {
  const { data: workouts, isLoading: plansLoading } = usePlanWindow(4)
  const { data: races, isLoading: racesLoading } = useRaces()

  const today = new Date().toISOString().split("T")[0]!

  const items: AgendaItem[] = [
    ...(workouts ?? [])
      .filter((w) => w.scheduledDate >= today)
      .map<AgendaItem>((w) => ({
        date: w.scheduledDate,
        kind: "training",
        title: w.title,
        meta: w.targetDurationMin ? `${w.targetDurationMin} min` : null,
      })),
    ...(races ?? [])
      .filter((r) => r.raceDate >= today)
      .map<AgendaItem>((r) => ({
        date: r.raceDate,
        kind: "race",
        title: r.name,
        meta: r.location,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const loading = plansLoading || racesLoading

  return (
    <ScreenShell section="kalender">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Kalender
        </h1>
        <p className="text-sm text-white/55">
          Wat er aankomt — je geplande trainingen en wedstrijden op een rij.
        </p>
      </div>

      <section className="mt-8">
        <SectionLabel title="Aankomend" />
        {loading ? (
          <p className="mt-4 text-[13px] text-white/40">Bezig met laden…</p>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.55] p-4 backdrop-blur-md">
            <p className="text-[14px] font-medium text-white/70">
              Nog niets gepland
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">
              Er staan nog geen trainingen of wedstrijden in je agenda. Plan een
              training of voeg een wedstrijd toe.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/train"
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-[13px] font-medium text-cyan-200 transition-colors hover:bg-cyan-300/20"
              >
                Naar Trainen
              </Link>
              <Link
                href="/races"
                className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
              >
                Naar Wedstrijd
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {items.map((item, i) => {
              const Icon = item.kind === "race" ? Trophy : Dumbbell
              const href = item.kind === "race" ? "/races" : "/train"
              return (
                <Link
                  key={`${item.kind}-${item.date}-${i}`}
                  href={href}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
                    style={{ background: "rgba(120,210,230,0.08)" }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-white/90">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-white/45">
                      {formatDate(item.date)}
                      {item.meta ? ` · ${item.meta}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.75} />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionLabel title="Wedstrijdkalender" />
        <Link
          href="/races"
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <CalendarDays className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-white/90">
              Wedstrijd uit kalender importeren
            </span>
            <span className="mt-0.5 block text-[12px] text-white/45">
              Zoek en importeer races uit externe kalenders
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.75} />
        </Link>
      </section>
    </ScreenShell>
  )
}
