import type { ReactNode } from "react"
import { useClerk, Show } from "@clerk/react"
import { useUserProfile, type Role } from "@/contexts/UserContext"

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
          className="label-xs rounded-full border border-white/10 px-2.5 py-1 text-white/60 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/80"
          title="Switch role"
        >
          {ROLE_LABEL[active]}
        </button>
      ) : (
        <span className="label-xs text-white/30">{ROLE_LABEL[active]}</span>
      )}
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: basePath || "/" })}
        className="label-xs text-white/20 transition-colors hover:text-white/50"
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
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#040506] text-white">
      <div className="pointer-events-none absolute inset-0">
        <img
          src={bg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-[0.22]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#040506]/40 via-[#040506]/80 to-[#040506]" />
        <div
          className="absolute -top-1/4 left-1/2 h-[70vh] w-[130vw] -translate-x-1/2 animate-breathe-slow"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 0%, rgba(120,200,220,0.12), transparent 72%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px animate-scan"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(120,210,230,0.5), transparent)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-md flex-col gap-10 px-6 pb-32 pt-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="label-sm text-white/70">SPARKI</span>
          </div>
          <Show when="signed-in">
            <RoleSwitcher />
          </Show>
          <Show when="signed-out">
            <span className="label-sm text-white/30">{section.toUpperCase()}</span>
          </Show>
        </header>

        {children}
      </div>
    </main>
  )
}
