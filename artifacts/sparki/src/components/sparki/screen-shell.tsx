import type { ReactNode } from "react"
import { LogOut, RefreshCw } from "lucide-react"
import { useClerk, Show } from "@clerk/react"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { CinematicScene, type SceneName } from "@/components/sparki/cinematic-scene"
import { NotificationBell } from "@/components/sparki/notification-bell"
import { ProfilePromptCard } from "@/components/sparki/profile-prompt-card"
import { FollowUpPrompt } from "@/components/sparki/follow-up-prompt"

const SECTION_SCENE: Record<string, SceneName> = {
  home: "home",
  train: "train",
  feed: "feed",
  lab: "lab",
  you: "you",
}

// User-facing Dutch label for the section shown in the header. Keeps the internal
// `section` key (which drives the scene) in English while presenting plain Dutch.
const SECTION_DISPLAY: Record<string, string> = {
  home: "VANDAAG",
  train: "TRAINING",
  races: "RACES",
  feed: "NIEUWS",
  lab: "INZICHT",
  you: "PROFIEL",
  kennisbank: "KENNIS",
  coach: "COACH",
  ouder: "OUDER",
}

const ROLE_LABEL: Record<Role, string> = {
  athlete: "Sporter",
  coach: "Coach",
  parent: "Ouder",
}

function RoleSwitcher() {
  const { profile, switchRole } = useUserProfile()
  const { signOut } = useClerk()
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

  if (!profile) return null

  const roles = profile.roles as Role[]
  const active = profile.activeRole as Role

  const cycleRole = () => {
    const idx = roles.indexOf(active)
    const next = roles[(idx + 1) % roles.length]
    if (next !== active) void switchRole(next)
  }

  return (
    <div className="flex items-center gap-3">
      {roles.length > 1 ? (
        <button
          type="button"
          onClick={cycleRole}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
          title="Wissel van rol"
        >
          <RefreshCw className="h-2.5 w-2.5 opacity-70" strokeWidth={2} />
          {ROLE_LABEL[active]}
        </button>
      ) : (
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-white/40">{ROLE_LABEL[active]}</span>
      )}
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: basePath || "/" })}
        className="flex items-center gap-1 text-white/35 transition-colors hover:text-cyan-300/80"
        title="Uitloggen"
        aria-label="Uitloggen"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}

// Adaptive profile prompts only make sense for the athlete Home view. Coaches
// and parents have their own home; the prompt engine is athlete-scoped.
function HomeProfilePrompt() {
  const { profile } = useUserProfile()
  if (!profile || profile.activeRole !== "athlete") return null
  return <ProfilePromptCard />
}

export function ScreenShell({
  section,
  bg = "/concept-lab.png",
  children,
}: {
  section: string
  bg?: string
  children: ReactNode
}) {
  const scene = SECTION_SCENE[section.toLowerCase()] ?? "home"
  const sectionLabel = SECTION_DISPLAY[section.toLowerCase()] ?? section.toUpperCase()
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05070e] text-white">
      {/* Per-screen cinematic background — shared structure, scene-specific
          atmosphere. Fixed + ≤5px parallax so it sits behind the whole page. */}
      <CinematicScene scene={scene} image={bg} />

      <div className="relative z-10 mx-auto flex max-w-md flex-col gap-10 px-6 pb-32 pt-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/70">SPARKI</span>
          </div>
          <Show when="signed-out">
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/30">{sectionLabel}</span>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="flex flex-col items-end gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/30">{sectionLabel}</span>
                <RoleSwitcher />
              </div>
            </div>
          </Show>
        </header>

        {scene === "home" && <HomeProfilePrompt />}

        {children}
      </div>

      {/* Login follow-up prompt — outside the signed-in gate so it also works in
          Development Preview Mode. Renders nothing when no follow-up is due. */}
      <FollowUpPrompt />
    </main>
  )
}
