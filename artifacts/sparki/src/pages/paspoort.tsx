import { Link } from "wouter"
import { ChevronLeft, Printer } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { useUserProfile } from "@/contexts/UserContext"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { useGoalPicture } from "@/hooks/use-goals"
import { useLoad } from "@/hooks/use-load"
import { usePowerBests } from "@/hooks/use-power-bests"
import { useRaces } from "@/hooks/use-races"
import { useGarage } from "@/hooks/use-garage"
import { useClubMembership } from "@/hooks/use-club"

// Sportpaspoort — het overkoepelende, bewust te openen overzicht van de
// sporter: profiel, doelen, kernmetingen, ontwikkeling, wedstrijdhistorie,
// materiaal en club. Alleen echte, gecontroleerde gegevens; wat ontbreekt
// wordt eerlijk weggelaten. Met een professionele print/PDF-weergave via de
// afdrukfunctie van de browser.

const DISCIPLINE_LABEL: Record<string, string> = {
  road: "Weg",
  mtb: "Mountainbike",
  gravel: "Gravel",
  track: "Baan",
  cyclocross: "Veldrijden",
  tt: "Tijdrijden",
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.06] py-2 print:border-neutral-200">
      <span className="text-[12px] text-white/45 print:text-neutral-500">{label}</span>
      <span className="text-right text-[13px] text-white/90 print:text-neutral-900">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md print:break-inside-avoid print:rounded-none print:border-0 print:border-t print:border-neutral-300 print:bg-transparent print:p-0 print:pt-3">
      <h2 className="mb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/80 print:text-neutral-600">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function PaspoortPage() {
  const { profile } = useUserProfile()
  const { data: athlete } = useAthleteExtendedProfile()
  const { data: goalPicture } = useGoalPicture()
  const { data: load } = useLoad()
  const { data: bests } = usePowerBests()
  const { data: races } = useRaces()
  const { data: garage } = useGarage()
  const { isMember, coaches, team } = useClubMembership()

  const today = new Date().toISOString().slice(0, 10)
  const pastRaces = (races ?? [])
    .filter((r) => r.raceDate < today)
    .sort((a, b) => b.raceDate.localeCompare(a.raceDate))
    .slice(0, 8)
  const chart = (load?.chartData ?? []).slice(-90)
  const goals = goalPicture?.goals ?? []
  const bikes = garage?.bikes ?? []
  const bestKeys = ["5", "60", "300", "1200"] as const
  const bestLabel: Record<string, string> = {
    "5": "5 s",
    "60": "1 min",
    "300": "5 min",
    "1200": "20 min",
  }

  return (
    <ScreenShell section="paspoort">
      {/* Printstijl: witte, professionele weergave zonder app-chrome. */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print, nav, header { display: none !important; }
          .print-root { color: #171717 !important; }
          .print-page { max-width: 100% !important; }
        }
      `}</style>
      <div className="print-root -mt-2 flex flex-col gap-5">
        <div className="no-print flex items-center justify-between">
          <Link
            href="/you"
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <ChevronLeft className="h-4 w-4" /> Terug
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-1.5 text-[13px] text-cyan-300 transition-colors hover:bg-cyan-300/20"
          >
            <Printer className="h-4 w-4" strokeWidth={1.75} />
            Afdrukken / PDF
          </button>
        </div>

        <header className="print:pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 print:text-neutral-500">
            Sportpaspoort
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white print:text-neutral-900">
            {profile?.displayName ?? "Sporter"}
          </h1>
          <p className="text-[12px] text-white/45 print:text-neutral-500">
            Opgemaakt op {fmtDate(today)}
          </p>
        </header>

        <Section title="Sportprofiel">
          {athlete?.discipline && (
            <Row label="Discipline" value={DISCIPLINE_LABEL[athlete.discipline] ?? athlete.discipline} />
          )}
          {athlete?.birthDate && <Row label="Geboortedatum" value={fmtDate(athlete.birthDate)} />}
          {athlete?.heightCm != null && <Row label="Lengte" value={`${athlete.heightCm} cm`} />}
          {athlete?.weightKg != null && <Row label="Gewicht" value={`${Number(athlete.weightKg).toLocaleString("nl-NL")} kg`} />}
          {athlete?.weeklyHourTarget != null && (
            <Row
              label="Trainingsuren per week"
              value={`${athlete.weeklyHourTarget} u${athlete.weeklyHourTargetEstimated ? " (schatting)" : ""}`}
            />
          )}
          {!athlete?.discipline && !athlete?.birthDate && athlete?.weightKg == null && (
            <p className="py-1 text-[12px] text-white/45 print:text-neutral-500">
              Nog geen profielgegevens ingevuld.
            </p>
          )}
        </Section>

        <Section title="Doelen">
          {goals.length === 0 ? (
            <p className="py-1 text-[12px] text-white/45 print:text-neutral-500">Nog geen doelen vastgelegd.</p>
          ) : (
            goals.slice(0, 5).map((g) => <Row key={g.id} label={g.horizon ?? "Doel"} value={g.title} />)
          )}
        </Section>

        <Section title="Kernmetingen">
          {athlete?.ftp != null && (
            <Row label="FTP" value={`${athlete.ftp} W${athlete.ftpEstimated ? " (schatting)" : ""}`} />
          )}
          {athlete?.wkg != null && <Row label="Vermogen per kg" value={`${athlete.wkg.toFixed(1)} W/kg`} />}
          {load && <Row label="Fitheid (CTL)" value={`${Math.round(load.ctl)}`} />}
          {load && <Row label="Vormbalans (TSB)" value={`${Math.round(load.tsb)}`} />}
          {bests &&
            bestKeys.map((k) =>
              bests.allTime[k] ? (
                <Row key={k} label={`Beste ${bestLabel[k]}`} value={`${bests.allTime[k].watts} W`} />
              ) : null,
            )}
          {athlete?.ftp == null && !load && (
            <p className="py-1 text-[12px] text-white/45 print:text-neutral-500">
              Nog geen metingen beschikbaar.
            </p>
          )}
        </Section>

        {chart.length > 1 && (
          <Section title="Trainingsontwikkeling (90 dagen)">
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                    tickFormatter={(d: string) => d.slice(5)}
                    interval="preserveStartEnd"
                    stroke="rgba(255,255,255,0.15)"
                  />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.15)" />
                  <Tooltip
                    contentStyle={{
                      background: "#0a1017",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 11,
                    }}
                  />
                  <Line type="monotone" dataKey="ctl" name="Fitheid" stroke="oklch(0.82 0.16 200)" dot={false} strokeWidth={1.6} />
                  <Line type="monotone" dataKey="atl" name="Vermoeidheid" stroke="rgba(230,160,110,0.85)" dot={false} strokeWidth={1.2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        <Section title="Wedstrijdhistorie">
          {pastRaces.length === 0 ? (
            <p className="py-1 text-[12px] text-white/45 print:text-neutral-500">
              Nog geen gereden wedstrijden in de kalender.
            </p>
          ) : (
            pastRaces.map((r) => (
              <Row key={r.id} label={fmtDate(r.raceDate)} value={`${r.name}${r.location ? ` — ${r.location}` : ""}`} />
            ))
          )}
        </Section>

        <Section title="Materiaal">
          {bikes.length === 0 ? (
            <p className="py-1 text-[12px] text-white/45 print:text-neutral-500">Nog geen fiets in de garage.</p>
          ) : (
            bikes.map((b) => (
              <Row
                key={b.id}
                label={b.name}
                value={[b.brand, b.model].filter(Boolean).join(" ") || b.bikeType}
              />
            ))
          )}
        </Section>

        <Section title="Trainer & club">
          {!isMember ? (
            <p className="py-1 text-[12px] text-white/45 print:text-neutral-500">
              Geen trainer of club gekoppeld.
            </p>
          ) : (
            <>
              {coaches.map((c) => (
                <Row key={c.clerkId} label="Trainer" value={c.displayName || c.email} />
              ))}
              {team?.clubName && <Row label="Club" value={team.clubName} />}
              {team?.teamName && <Row label="Team" value={team.teamName} />}
            </>
          )}
        </Section>
      </div>
    </ScreenShell>
  )
}
