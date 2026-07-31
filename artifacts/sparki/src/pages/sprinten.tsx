// GESTOPT — veiligheidsrisico op openbare weg (besluit 31-07-2026).
// Deze pagina is bewust NIET meer gerout in App.tsx (directe URL ⇒ NotFound)
// en de server blokkeert alle startpaden met 410. Het bestand blijft bewaard
// als herbruikbare inventaris (seizoensoverzicht/badges-weergave) voor een
// eventuele latere variant op afgesloten terrein of vooraf handmatig
// goedgekeurde trainingssegmenten. Historische gebruikersdata blijft staan.
import { useLocation } from "wouter"
import { ArrowLeft, Trophy, Zap, Share2, Check, Lock } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { FreeRideSprint } from "@/components/sparki/free-ride-sprint"
import {
  useSprintSeason,
  useShareSprint,
  type SprintBadge,
  type SprintResultRow,
  type SprintRankRow,
} from "@/hooks/use-sprints"

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-white/50">
        {label}
      </div>
    </div>
  )
}

function BadgeChip({ badge }: { badge: SprintBadge }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        badge.achieved
          ? "border-cyan-400/30 bg-cyan-400/10"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex items-center gap-2">
        {badge.achieved ? (
          <Trophy className="h-4 w-4 text-cyan-300" />
        ) : (
          <Lock className="h-4 w-4 text-white/35" />
        )}
        <span
          className={`text-sm font-semibold ${
            badge.achieved ? "text-white" : "text-white/60"
          }`}
        >
          {badge.label}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-white/55">{badge.description}</p>
      {!badge.achieved && badge.progress && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-400/70"
              style={{
                width: `${Math.min(
                  100,
                  (badge.progress.current / badge.progress.target) * 100,
                )}%`,
              }}
            />
          </div>
          <div className="mt-1 text-right text-[10px] text-white/40">
            {badge.progress.current}/{badge.progress.target}
          </div>
        </div>
      )}
    </div>
  )
}

function RecentSprint({ row }: { row: SprintResultRow }) {
  const share = useShareSprint()
  const shared = (row as SprintResultRow & { shared?: string }).shared === "true"
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-2.5 last:border-0">
      <div>
        <div className="text-sm text-white/85">{row.placeName}</div>
        <div className="text-[11px] text-white/45">
          {row.status === "cancelled"
            ? "afgebroken"
            : `+${row.totalPoints} punten`}
          {row.speedKmhPeak != null &&
            ` · piek ${Math.round(row.speedKmhPeak)} km/u`}
        </div>
      </div>
      {row.status === "scored" && (
        <button
          onClick={() => share.mutate({ id: row.id, shared: !shared })}
          disabled={share.isPending}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition ${
            shared
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
              : "border-white/12 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
          }`}
        >
          {shared ? (
            <>
              <Check className="h-3.5 w-3.5" /> Gedeeld
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" /> Deel
            </>
          )}
        </button>
      )}
    </div>
  )
}

function Ranking({
  rows,
  myRank,
}: {
  rows: SprintRankRow[]
  myRank: number | null
}) {
  return (
    <Card title="Klassement met vrienden">
      {myRank != null && (
        <p className="mb-3 text-sm text-white/60">
          Je staat {myRank}e van {rows.length}.
        </p>
      )}
      <div>
        {rows.map((r, i) => (
          <div
            key={r.clerkId}
            className={`flex items-center justify-between border-b border-white/[0.06] py-2.5 last:border-0 ${
              r.isMe ? "text-cyan-200" : "text-white/80"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="w-5 text-right font-mono text-xs text-white/40">
                {i + 1}
              </span>
              <span className="text-sm">{r.name}</span>
            </span>
            <span className="font-mono text-sm">{r.points}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/40">
        Alleen sprints die vrienden zelf hebben gedeeld tellen mee.
      </p>
    </Card>
  )
}

export default function SprintenPage() {
  const [, navigate] = useLocation()
  const { data, isLoading } = useSprintSeason()

  return (
    <ScreenShell bg="/atmosphere/samen-groepsrit-peloton.webp" section="sprinten" bare terug={false}>
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate("/you")}
          className="flex w-fit items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Terug
        </button>

        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Zap className="h-6 w-6 text-cyan-300" />
            Bordjes sprinten
          </h1>
          <p className="mt-1.5 text-sm text-white/55">
            Sprint voor elk plaatsnaambord en verzamel punten. Op een route én
            op een vrije rit.
          </p>
        </header>

        <Card title={`Seizoen ${data?.seasonYear ?? new Date().getFullYear()}`}>
          {isLoading ? (
            <p className="text-sm text-white/50">Bezig…</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="punten" value={data?.totalPoints ?? 0} />
              <Stat label="sprints" value={data?.sprintCount ?? 0} />
              <Stat label="beste" value={data?.bestSingle ?? 0} />
            </div>
          )}
        </Card>

        {data && data.ranking.length > 0 && (
          <Ranking rows={data.ranking} myRank={data.myRank} />
        )}

        <FreeRideSprint />

        {data && data.badges.length > 0 && (
          <Card title="Insignes">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.badges.map((b) => (
                <BadgeChip key={b.key} badge={b} />
              ))}
            </div>
          </Card>
        )}

        <Card title="Laatste sprints">
          {isLoading ? (
            <p className="text-sm text-white/50">Bezig…</p>
          ) : data && data.recent.length > 0 ? (
            <div>
              {data.recent.map((r) => (
                <RecentSprint key={r.id} row={r} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">
              Nog geen sprints. Start een vrije sprintrit of kies een route met
              bordjes om te beginnen.
            </p>
          )}
        </Card>
      </div>
    </ScreenShell>
  )
}
