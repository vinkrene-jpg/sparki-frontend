import { Link, Redirect } from "wouter"
import { Shield, Users, CalendarDays, Trophy, MessageCircle } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { useClubMembership } from "@/hooks/use-club"
import { usePlanWindow } from "@/hooks/use-training-plan"
import { useRaces } from "@/hooks/use-races"
import { useCircleFeed } from "@/hooks/use-social"

// Hoofdstuk Club — bestaat ALLEEN bij een echte, geaccepteerde koppeling met
// een trainer die Sparki gebruikt. Alles hier is echte data: de trainer(s),
// het team, door de trainer klaargezette trainingen, wedstrijden en de
// gedeelde kring-feed. Ontbreekt iets, dan staat dat er eerlijk bij.

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })
}

export default function ClubPage() {
  const { isMember, coaches, team, isLoading } = useClubMembership()
  const { data: workouts } = usePlanWindow(3)
  const { data: races } = useRaces()
  const { data: feed } = useCircleFeed()

  if (isLoading) {
    return (
      <ScreenShell section="club">
        <p className="text-sm text-white/50">Club wordt geladen…</p>
      </ScreenShell>
    )
  }
  // Zonder geldige koppeling bestaat Club niet — terug naar start.
  if (!isMember) return <Redirect to="/" />

  const coachWorkouts = (workouts ?? []).filter((w) => w.source === "coach")
  const today = new Date().toISOString().slice(0, 10)
  const upcomingRaces = (races ?? [])
    .filter((r) => r.raceDate >= today)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    .slice(0, 4)
  const clubFeed = (feed?.items ?? [])
    .filter((i) => i.type.startsWith("friend_") || i.type === "sprint")
    .slice(0, 6)
  const color = team?.primaryColor ?? "rgba(120,210,230,1)"

  return (
    <ScreenShell section="club">
      <div className="-mt-2 flex flex-col gap-8">
        <header className="flex items-center gap-3">
          {team?.logoUrl ? (
            <img src={team.logoUrl} alt="" className="h-10 w-10 object-contain" />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{ borderColor: `${color}55`, background: `${color}14` }}
            >
              <Shield className="h-5 w-5" style={{ color }} strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-white">
              {team?.clubName || "Jouw club"}
            </h1>
            {team?.teamName && (
              <p className="text-[12px] text-white/50">{team.teamName}</p>
            )}
          </div>
        </header>

        <section aria-label="Trainer">
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
            Trainer
          </h2>
          <div className="space-y-1.5">
            {coaches.map((c) => (
              <div
                key={c.clerkId}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-3.5 py-3 backdrop-blur-md"
              >
                <Users className="h-4 w-4 text-cyan-300/80" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-white/85">
                    {c.displayName || c.email}
                  </p>
                  <p className="text-[11px] text-white/40">Gekoppeld sinds {formatDate(c.createdAt.slice(0, 10))}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Clubtrainingen">
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
            <CalendarDays className="h-3 w-3" /> Clubtrainingen
          </h2>
          {coachWorkouts.length === 0 ? (
            <p className="rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-3 text-[12px] text-white/45">
              Je trainer heeft de komende drie weken nog geen training voor je
              klaargezet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {coachWorkouts.map((w) => (
                <Link
                  key={w.id}
                  href="/train"
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-3.5 py-2.5 backdrop-blur-md transition-colors hover:border-cyan-300/25"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-white/85">{w.title}</span>
                    <span className="text-[11px] text-white/40">
                      {formatDate(w.scheduledDate)}
                      {w.targetDurationMin ? ` · ${w.targetDurationMin} min` : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Wedstrijden">
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
            <Trophy className="h-3 w-3" /> Wedstrijden & planning
          </h2>
          {upcomingRaces.length === 0 ? (
            <p className="rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-3 text-[12px] text-white/45">
              Geen aankomende wedstrijden in je kalender.{" "}
              <Link href="/races" className="text-cyan-300/80 hover:text-cyan-300">
                Naar Wedstrijd
              </Link>
            </p>
          ) : (
            <div className="space-y-1.5">
              {upcomingRaces.map((r) => (
                <Link
                  key={r.id}
                  href="/races"
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-3.5 py-2.5 backdrop-blur-md transition-colors hover:border-cyan-300/25"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-white/85">{r.name}</span>
                    <span className="text-[11px] text-white/40">
                      {formatDate(r.raceDate)}
                      {r.location ? ` · ${r.location}` : ""}
                      {r.teamName ? ` · ${r.teamName}` : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Clubfeed">
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
            <MessageCircle className="h-3 w-3" /> Clubfeed
          </h2>
          {clubFeed.length === 0 ? (
            <p className="rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-3 text-[12px] text-white/45">
              Nog geen activiteit van teamgenoten om te tonen. Berichten,
              aanwezigheid en gedeelde media verschijnen hier zodra je kring
              iets deelt via{" "}
              <Link href="/samen" className="text-cyan-300/80 hover:text-cyan-300">
                Samen
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-1.5">
              {clubFeed.map((i) => (
                <div
                  key={i.id}
                  className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-3.5 py-2.5 backdrop-blur-md"
                >
                  <p className="text-[13px] text-white/85">{i.title}</p>
                  {i.detail && (
                    <p className="mt-0.5 text-[11px] leading-snug text-white/45">{i.detail}</p>
                  )}
                </div>
              ))}
              <Link
                href="/samen"
                className="block pt-1 text-[12px] text-cyan-300/80 hover:text-cyan-300"
              >
                Alles in Samen →
              </Link>
            </div>
          )}
        </section>
      </div>
    </ScreenShell>
  )
}
