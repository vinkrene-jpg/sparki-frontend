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
    <section className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
      <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-accent-cyan">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-foreground/30 px-4 py-3 text-center">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
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
          : "border-border bg-foreground/20"
      }`}
    >
      <div className="flex items-center gap-2">
        {badge.achieved ? (
          <Trophy className="h-4 w-4 text-accent-cyan" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
        <span
          className={`text-sm font-semibold ${
            badge.achieved ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {badge.label}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{badge.description}</p>
      {!badge.achieved && badge.progress && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
          <div className="mt-1 text-right text-[10px] text-muted-foreground">
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
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <div>
        <div className="text-sm text-foreground/85">{row.placeName}</div>
        <div className="text-[11px] text-muted-foreground">
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
              ? "border-cyan-400/30 bg-cyan-400/10 text-accent-cyan"
              : "border-border bg-muted text-muted-foreground hover:bg-muted"
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
        <p className="mb-3 text-sm text-muted-foreground">
          Je staat {myRank}e van {rows.length}.
        </p>
      )}
      <div>
        {rows.map((r, i) => (
          <div
            key={r.clerkId}
            className={`flex items-center justify-between border-b border-border py-2.5 last:border-0 ${
              r.isMe ? "text-accent-cyan" : "text-foreground/80"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="w-5 text-right font-mono text-xs text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-sm">{r.name}</span>
            </span>
            <span className="font-mono text-sm">{r.points}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
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
          className="flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Terug
        </button>

        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Zap className="h-6 w-6 text-accent-cyan" />
            Bordjes sprinten
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sprint voor elk plaatsnaambord en verzamel punten. Op een route én
            op een vrije rit.
          </p>
        </header>

        <Card title={`Seizoen ${data?.seasonYear ?? new Date().getFullYear()}`}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Bezig…</p>
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
            <p className="text-sm text-muted-foreground">Bezig…</p>
          ) : data && data.recent.length > 0 ? (
            <div>
              {data.recent.map((r) => (
                <RecentSprint key={r.id} row={r} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nog geen sprints. Start een vrije sprintrit of kies een route met
              bordjes om te beginnen.
            </p>
          )}
        </Card>
      </div>
    </ScreenShell>
  )
}
