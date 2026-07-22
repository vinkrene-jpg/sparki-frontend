import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import {
  Shield,
  ChevronLeft,
  Menu,
  Sparkles,
  Home,
  Dumbbell,
  Trophy,
  Radio,
  User,
  Users,
  Activity,
  Globe,
  HeartPulse,
  Wrench,
  Map as MapIcon,
  CalendarDays,
  BookOpen,
  Film,
  type LucideIcon,
} from "lucide-react"
import { Link } from "wouter"
import { Show } from "@clerk/react"
import { useUserProfile } from "@/contexts/UserContext"
import { useTeamIdentity } from "@/hooks/use-social"
import { CinematicScene, type SceneName } from "@/components/sparki/cinematic-scene"
import { NotificationBell } from "@/components/sparki/notification-bell"
import { ProfilePromptCard } from "@/components/sparki/profile-prompt-card"
import { CoachInputNeeds } from "@/components/sparki/coach-input-actions"
import { ConnectorRecoveryNudge } from "@/components/sparki/connector-recovery-nudge"
import { FollowUpPrompt } from "@/components/sparki/follow-up-prompt"
import { CoachAnalysisCard } from "@/components/sparki/coach/coach-analysis-card"
import { CoachDecisionCard } from "@/components/sparki/coach-decision-card"
import { OntwikkelprioriteitHomeCard } from "@/components/sparki/ontwikkelprioriteit-home-card"
import { SparkiChatOverlay } from "@/components/sparki/sparki-chat-overlay"
import { MainMenu } from "@/components/sparki/main-menu"
import { useCoachDecision } from "@/contexts/CoachDecisionContext"
import { useHomeView } from "@/contexts/HomeViewContext"
import { startTelemetry, trackScreen } from "@/lib/telemetry"
import { screenForSection } from "@/lib/tracked-screens"

// Sparki's daily coach analysis ("Sparki Vandaag") is the hero of the Vandaag
// home ONLY. On other chapters (Training, Inzicht, Races, …) it duplicated
// Vandaag and blurred each chapter's own identity, so every chapter now leads
// with its own content. The card itself is athlete-only and is already
// suppressed on the coach/parent homes.
const COACH_CARD_SECTIONS = new Set(["home"])

const SECTION_SCENE: Record<string, SceneName> = {
  start: "home",
  club: "feed",
  paspoort: "you",
  home: "home",
  train: "train",
  feed: "feed",
  lab: "lab",
  you: "you",
  samen: "feed",
  activiteiten: "feed",
  wereld: "feed",
  lichaam: "you",
  mechanieker: "you",
  routes: "train",
  kalender: "train",
}

// User-facing Dutch label for the section shown in the header. Keeps the internal
// `section` key (which drives the scene) in English while presenting plain Dutch.
const SECTION_DISPLAY: Record<string, string> = {
  start: "START",
  club: "CLUB",
  paspoort: "SPORTPASPOORT",
  home: "VANDAAG",
  train: "TRAINING",
  races: "RACES",
  feed: "NIEUWS",
  lab: "INZICHT",
  you: "PROFIEL",
  samen: "SAMEN",
  activiteiten: "ACTIVITEITEN",
  wereld: "WERELD",
  lichaam: "LICHAAM",
  mechanieker: "MECHANIEKER",
  routes: "NAVIGATIE-TRAINING",
  kalender: "KALENDER",
  kennisbank: "KENNIS",
  coach: "COACH",
  ouder: "OUDER",
  "wedstrijd-room": "WEDSTRIJD-ROOM",
}

// Per-chapter icon so the header badge makes it instantly recognisable which
// chapter you're in. Falls back to the Sparki spark for unmapped sections.
const SECTION_ICON: Record<string, LucideIcon> = {
  start: Home,
  club: Users,
  paspoort: User,
  home: Home,
  train: Dumbbell,
  races: Trophy,
  feed: Radio,
  lab: Activity,
  you: User,
  samen: Users,
  activiteiten: Activity,
  wereld: Globe,
  lichaam: HeartPulse,
  mechanieker: Wrench,
  routes: MapIcon,
  kalender: CalendarDays,
  kennisbank: BookOpen,
  coach: Users,
  ouder: Users,
  "wedstrijd-room": Film,
}

// Subtle club crest shown on the home header when the athlete has set a club
// identity. Colours come from the saved team identity; falls back to the cyan
// accent. Renders nothing when no club is set.
function ClubCrest() {
  const { data } = useTeamIdentity()
  const team = data?.team
  if (!team || !team.clubName) return null
  const color = team.primaryColor ?? "rgba(120,210,230,1)"
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"
      style={{
        borderColor: `${color}55`,
        background: `${color}1a`,
      }}
      title={[team.clubName, team.teamName].filter(Boolean).join(" · ")}
    >
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          className="h-3.5 w-3.5 shrink-0 object-contain"
        />
      ) : (
        <Shield className="h-3 w-3" style={{ color }} strokeWidth={2} />
      )}
      <span className="max-w-[8rem] truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">
        {team.shirtBadge || team.clubName}
      </span>
    </span>
  )
}

// Adaptive profile prompts only make sense for the athlete Home view. Coaches
// and parents have their own home; the prompt engine is athlete-scoped.
function HomeProfilePrompt() {
  const { profile } = useUserProfile()
  if (!profile || profile.activeRole !== "athlete") return null
  return <ProfilePromptCard />
}

// Persoonlijke context in het midden van de bovenbalk: dagdeel-groet + voornaam
// voor ingelogde gebruikers, anders de datum. Bewust klein en rustig — de balk
// mag de aandacht nooit opeisen.
function HeaderContext({ displayName }: { displayName: string | null }) {
  const firstName = displayName?.trim().split(/\s+/)[0] ?? null
  if (firstName) {
    // Alleen de voornaam — de pagina zelf begroet al ("Goedemorgen, …"),
    // dus de balk blijft stil en dubbelt de groet niet.
    return <span className="truncate text-[13px] text-white/80">{firstName}</span>
  }
  const now = new Date()
  const label = now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })
  return <span className="truncate text-[13px] text-white/60">{label.charAt(0).toUpperCase() + label.slice(1)}</span>
}

export function ScreenShell({
  section,
  bg = "/concept-lab.png",
  bare = false,
  children,
}: {
  section: string
  bg?: string
  // When true, suppress every injected coaching surface (home prompts, coach
  // cards, coach-decision card and the follow-up prompt). Used by standalone
  // moments like the head-tester welcome that own their full content and must
  // not be smothered by the shared home chrome.
  bare?: boolean
  children: ReactNode
}) {
  const sectionKey = section.toLowerCase()

  // Real usage telemetry: start the background flush/heartbeat loops once, and
  // record a screen view whenever a route-reachable section renders. Sub-surfaces
  // (coach/routes/voeding/connect/instellingen) call trackScreen themselves.
  useEffect(() => {
    startTelemetry()
  }, [])
  useEffect(() => {
    const screen = screenForSection(sectionKey)
    if (screen) trackScreen(screen)
  }, [sectionKey])

  const scene = SECTION_SCENE[sectionKey] ?? "home"
  const isHome = sectionKey === "home"
  const showCoachCard = COACH_CARD_SECTIONS.has(sectionKey)
  const sectionLabel = SECTION_DISPLAY[section.toLowerCase()] ?? section.toUpperCase()
  const SectionIcon = SECTION_ICON[section.toLowerCase()] ?? Sparkles
  const coachDecision = useCoachDecision()
  // Vandaag's two surfaces (see HomeViewContext). On the calm State Card surface
  // the dashboard/coach cards are suppressed; on the full analysis surface a top
  // "Terug" returns to the State Card. Null outside Vandaag → unchanged elsewhere.
  const homeView = useHomeView()
  const stateSurface = isHome && homeView?.view === "state"
  const fullSurface = isHome && homeView?.view === "full"

  // The full Vandaag analysis surface IS the "Coach" screen for coverage: it's
  // where Sparki's full coaching read is shown. Tracked only when actually open.
  useEffect(() => {
    if (fullSurface) trackScreen("coach")
  }, [fullSurface])
  const { profile } = useUserProfile()
  const [chatOpen, setChatOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05070e] text-white">
      {/* Per-screen cinematic background — shared structure, scene-specific
          atmosphere. Fixed + ≤5px parallax so it sits behind the whole page. */}
      <CinematicScene scene={scene} image={bg} />

      <div className="relative z-10 mx-auto flex max-w-md flex-col gap-10 px-6 pb-32 pt-12">
        {/* Rustige premium bovenbalk — drie zones, geen knoppengordijn.
            Links alleen het merk, midden de persoonlijke context, rechts
            maximaal drie stille iconen (meldingen · Vraag Sparki · menu).
            Alles wat context is (hoofdstuk, rol, club, tester) verhuist naar
            de subtiele regel eronder; acties zoals feedback leven in het menu. */}
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <span className="flex items-center gap-2" aria-label="Sparki">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/70">SPARKI</span>
          </span>
          <div className="flex min-w-0 justify-center">
            <HeaderContext displayName={profile?.displayName ?? null} />
          </div>
          <div className="flex items-center gap-3.5">
            <Show when="signed-in">
              <NotificationBell />
            </Show>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Menu openen"
              title="Menu"
              className="text-white/60 transition-colors hover:text-cyan-300"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {/* Subtiele paginaregel onder de balk: alleen hoofdstuktitel links en
            eventueel het clubembleem. Rolwissel, testerbadge en Vraag Sparki
            verhuisden naar het hoofdmenu — de balk blijft rustig. */}
        <div className="-mt-6 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-white/50">
            <SectionIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="font-mono text-[10px] tracking-[0.28em] uppercase">{sectionLabel}</span>
          </span>
          {(isHome || sectionKey === "start") && <ClubCrest />}
        </div>

        {/* Top-anchored Terug from the full analysis back to the State Card. */}
        {fullSurface && (
          <button
            type="button"
            onClick={() => homeView!.setView("state")}
            className="flex items-center gap-1.5 self-start rounded-full border border-white/15 px-3 py-1.5 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <ChevronLeft className="h-4 w-4" />
            Terug naar Sparki
          </button>
        )}

        {!bare && isHome && !stateSurface && <HomeProfilePrompt />}
        {!bare && isHome && !stateSurface && <ConnectorRecoveryNudge />}
        {!bare && isHome && !stateSurface && <CoachInputNeeds />}

        {!bare && showCoachCard && !stateSurface && (
          <CoachAnalysisCard variant={isHome ? "hero" : "card"} />
        )}

        {/* Adaptive Coach Engine output — the engine's decision (onderwerp /
            advies / vraag / prioriteit) for today, surfaced on every home
            day-type. Driven by the CoachDecision context from the dispatcher. */}
        {!bare && isHome && !stateSurface && coachDecision && (
          <CoachDecisionCard decision={coachDecision} />
        )}

        {/* Ontwikkelprioriteit — the single biggest long-term limiter + next
            action, reusing the Core engine verbatim. Glanceable here where
            athletes start their day; taps through to the full Ontwikkelkompas. */}
        {!bare && isHome && !stateSurface && <OntwikkelprioriteitHomeCard />}

        {children}
      </div>

      {/* Login follow-up prompt — outside the signed-in gate so it also works in
          Development Preview Mode. Renders nothing when no follow-up is due.
          Suppressed on the Circle route ("samen"), where the Circle feed is the
          calm home for follow-ups — so we never double-ask the same question. */}
      {!bare && section.toLowerCase() !== "samen" && !stateSurface && <FollowUpPrompt />}

      {/* App-wide chat window — opened from the chat icon on the right of the
          header. Chat + menu staan bewust buiten de signed-in gate: alle
          ScreenShell-routes zijn al beschermd, en zo blijven ze ook werken in
          Development Preview Mode (waar geen Clerk-sessie bestaat). */}
      <SparkiChatOverlay open={chatOpen} onClose={() => setChatOpen(false)} />
      <MainMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenChat={() => setChatOpen(true)}
      />
    </main>
  )
}
