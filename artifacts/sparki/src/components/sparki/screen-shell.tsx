import type { ReactNode } from "react"
import { useClerk, Show } from "@clerk/react"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { CinematicScene, type SceneName } from "@/components/sparki/cinematic-scene"
import { NotificationBell } from "@/components/sparki/notification-bell"

const SECTION_SCENE: Record<string, SceneName> = {
  home: "home",
  train: "train",
  feed: "feed",
  lab: "lab",
  you: "you",
}

const ROLE_LABEL: Record<Role, string> = {
  athlete: "ATHLETE",
  coach: "COACH",
  parent: "PARENT",
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
          className="font-mono text-[10px] tracking-[0.18em] uppercase rounded-full border border-white/10 px-2.5 py-1 text-white/60 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/80"
          title="Switch role"
        >
          {ROLE_LABEL[active]}
        </button>
      ) : (
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/30">{ROLE_LABEL[active]}</span>
      )}
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: basePath || "/" })}
        className="font-mono text-[10px] text-white/20 transition-colors hover:text-white/50"
        title="Sign out"
      >
        ⏏
      </button>
    </div>
  )
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
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/30">{section.toUpperCase()}</span>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="flex flex-col items-end gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/30">{section.toUpperCase()}</span>
                <RoleSwitcher />
              </div>
            </div>
          </Show>
        </header>

        {children}
      </div>
    </main>
  )
}
