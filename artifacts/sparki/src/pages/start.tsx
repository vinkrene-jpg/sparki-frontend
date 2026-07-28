import { useEffect, useMemo, useState } from "react"
import { Link } from "wouter"
import { ArrowRight, Compass, Users, Wrench } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ChapterGrid } from "@/components/sparki/chapter-grid"
import { Bike3D } from "@/components/sparki/bike-3d"
import { useUserProfile } from "@/contexts/UserContext"
import { useSparkiState, type StateBand } from "@/hooks/use-sparki-state"
import { buildHerstelPresentatie } from "@/lib/commercial-shell"
import { useSessions } from "@/hooks/use-sessions"
import { useCircleFeed } from "@/hooks/use-social"
import { useClubMembership, useMyClubs } from "@/hooks/use-club"
import { useGarage } from "@/hooks/use-garage"
import { useBikeScanView, frameImageUrl } from "@/hooks/use-bike-scan"

const BAND_COLOR: Record<StateBand, string> = {
  belastbaar: "rgba(120,230,190,0.9)",
  solide: "rgba(120,210,230,0.9)",
  wisselend: "rgba(230,200,120,0.9)",
  kwetsbaar: "rgba(230,140,120,0.9)",
}

function formatSessionDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })
}

// Hoofdstatus — de actuele toestand uit de State Engine, in één rustige regel.
// Geen duplicatie met Vandaag: hier alleen de kern (band + beweging), de
// volledige uitleg, metingen en acties leven in het hoofdstuk Vandaag.
function StatusLine() {
  const { data: state } = useSparkiState()
  if (!state) return null
  const color = BAND_COLOR[state.band]
  return (
    <Link
      href="/vandaag"
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3.5 backdrop-blur-md transition-colors hover:border-cyan-300/30"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-white/90">
            {buildHerstelPresentatie(state.band, state.confidence, state.why.length).label}
            <span className="ml-2 text-[12px] font-normal text-white/45">
              {state.movement.label}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-white/50">{state.status}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
    </Link>
  )
}

// Maximaal drie aandachtspunten — de echte signalen achter de status
// (state.why), nooit meer dan drie, nooit verzonnen. Doorklik naar Vandaag.
function Aandachtspunten() {
  const { data: state } = useSparkiState()
  const signals = state?.why ?? []
  if (signals.length === 0) return null
  return (
    <div className="space-y-1.5">
      {signals.slice(0, 3).map((s, i) => (
        <Link
          key={i}
          href="/vandaag"
          className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-2.5 backdrop-blur-sm transition-colors hover:border-cyan-300/25"
        >
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-300/70" />
          <span className="text-[12.5px] leading-snug text-white/70">{s.label}</span>
        </Link>
      ))}
    </div>
  )
}

// Recente activiteit — de laatste echte ritten, compact.
function RecenteActiviteit() {
  const { data: sessions } = useSessions(3)
  if (!sessions || sessions.length === 0) return null
  return (
    <section aria-label="Recente activiteit">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
          Recente activiteit
        </h2>
        <span className="flex items-center gap-3">
          <Link href="/journey" className="text-[11px] text-cyan-300/80 hover:text-cyan-300">
            Jouw verhaal
          </Link>
          <Link href="/activiteiten" className="text-[11px] text-cyan-300/80 hover:text-cyan-300">
            Alles
          </Link>
        </span>
      </div>
      <div className="space-y-1.5">
        {sessions.slice(0, 3).map((s) => (
          <Link
            key={s.id}
            href="/activiteiten"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-2.5 backdrop-blur-sm transition-colors hover:border-cyan-300/25"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-white/85">
                {s.title || s.type}
              </span>
              <span className="text-[11px] text-white/40">
                {formatSessionDate(s.sessionDate)}
                {s.durationMin ? ` · ${s.durationMin} min` : ""}
                {s.distanceKm ? ` · ${Math.round(Number(s.distanceKm))} km` : ""}
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/30" />
          </Link>
        ))}
      </div>
    </section>
  )
}

// Snelle toegang tot Feed/Sociaal — met het meest recente echte bericht uit de
// eigen kring als voorproefje (privacy-gefilterd door de server).
function FeedSociaalToegang() {
  const { data } = useCircleFeed()
  const latest = data?.items?.[0] ?? null
  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        href="/samen"
        className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md transition-colors hover:border-cyan-300/30"
      >
        <span className="flex items-center gap-2 text-[12px] font-medium text-white/85">
          <Users className="h-3.5 w-3.5 text-cyan-300/80" strokeWidth={1.75} />
          Samen
        </span>
        <span className="line-clamp-2 text-[11px] leading-snug text-white/45">
          {latest ? latest.title : "Team, vrienden en gedeelde ritten"}
        </span>
      </Link>
      <Link
        href="/feed"
        className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md transition-colors hover:border-cyan-300/30"
      >
        <span className="flex items-center gap-2 text-[12px] font-medium text-white/85">
          <Compass className="h-3.5 w-3.5 text-cyan-300/80" strokeWidth={1.75} />
          Ontdekken
        </span>
        <span className="line-clamp-2 text-[11px] leading-snug text-white/45">
          Nieuws, renners en verhalen voor jou
        </span>
      </Link>
    </div>
  )
}

// Club — zichtbaar bij een echt clublidmaatschap óf een geaccepteerde
// koppeling met een trainer op Sparki. Zonder geldige basis bestaat dit blok niet.
function ClubToegang() {
  const { isMember, team, coaches } = useClubMembership()
  const { data: myClubs } = useMyClubs()
  const clubRow = (myClubs ?? [])[0] ?? null
  if (!clubRow && !isMember) return null
  const name =
    clubRow?.club?.name || team?.clubName || coaches[0]?.displayName || "Jouw club"
  const color =
    clubRow?.club?.primaryColor ?? team?.primaryColor ?? "rgba(120,210,230,1)"
  return (
    <Link
      href="/club"
      className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-md transition-colors hover:border-cyan-300/40"
      style={{ borderColor: `${color}44`, background: `${color}12` }}
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-white/90">{name}</span>
        <span className="text-[11px] text-white/45">
          {clubRow ? "Clubtrainingen, wedstrijden en berichten" : "Trainer, team en clubtrainingen"}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
    </Link>
  )
}

// De eigen fiets, prominent en langzaam draaiend. Alleen echte garagedata:
// zonder fiets in de garage tonen we een eerlijke uitnodiging, geen nepfiets.
// Is er een echte fietsscan, dan tonen we die ECHTE beelden (langzaam
// wisselend; bij "verminder beweging" een stilstaand beeld) i.p.v. het model.
function EigenFietsScanBeeld({ bikeId }: { bikeId: number }) {
  const { data } = useBikeScanView(bikeId)
  const [idx, setIdx] = useState(0)
  const frames = useMemo(
    () => (data?.frames ?? []).filter((f) => f.cutoutPath),
    [data],
  )
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  useEffect(() => {
    if (reduceMotion || frames.length < 2) return
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), 2600)
    return () => clearInterval(t)
  }, [reduceMotion, frames.length])
  if (frames.length === 0) return null
  const frame = frames[idx % frames.length]!
  return (
    <img
      src={frameImageUrl(frame.id, "vrijstaand")}
      alt="Jouw fiets — echte scanopname"
      className="h-[190px] w-full object-contain py-2"
      draggable={false}
    />
  )
}

function EigenFiets() {
  const { data } = useGarage()
  const bike = data?.bikes?.[0] ?? null
  const { data: scanView } = useBikeScanView(bike?.id ?? null)
  const hasScan =
    scanView != null &&
    scanView.viewMode !== "geen" &&
    scanView.frames.some((f) => f.cutoutPath)
  if (!bike) {
    return (
      <Link
        href="/mechanieker"
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#070d16]/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:border-cyan-300/30"
      >
        <Wrench className="h-4 w-4 text-cyan-300/80" strokeWidth={1.75} />
        <span className="text-[12.5px] text-white/60">
          Nog geen fiets in je garage — zet &rsquo;m erin bij Mechanieker.
        </span>
      </Link>
    )
  }
  return (
    <Link href="/mechanieker" className="block" aria-label={`${bike.name} — open Mechanieker`}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070d16]/[0.7] backdrop-blur-md">
        {hasScan ? (
          <EigenFietsScanBeeld bikeId={bike.id} />
        ) : (
          <Bike3D bike={bike} height={190} />
        )}
        <div className="pointer-events-none absolute bottom-2.5 left-4 right-4 flex items-center justify-between">
          <span className="text-[12px] font-medium text-white/80">
            {bike.name}
            {bike.brand ? <span className="ml-1.5 text-white/40">{bike.brand}</span> : null}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
            Mechanieker
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function StartPage() {
  const { profile } = useUserProfile()
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] ?? null

  return (
    <ScreenShell section="start">
      <div className="-mt-4 flex flex-col gap-5">
        {firstName && (
          <h1 className="sr-only">Start — {firstName}</h1>
        )}
        <StatusLine />
        <Aandachtspunten />

        <section aria-label="Hoofdstukken">
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
            Hoofdstukken
          </h2>
          <ChapterGrid compact />
        </section>

        <ClubToegang />
        <EigenFiets />
        <RecenteActiviteit />
      </div>
    </ScreenShell>
  )
}
