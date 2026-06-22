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
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05070e] text-white">
      {/* Background — fixed so the cyclist stays visible behind the ENTIRE page
          (subtle parallax) without distorting on long scrolls. Base is a soft
          blue-black, lifted off pure #000 so it doesn't crush on OLED. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Cyclist — clearly recognizable */}
        <img
          src={bg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-[0.56]"
        />
        {/* Cinematic blue/black gradient — softened so the rider reads through
            across the whole page, not just the top. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,12,22,0.30) 0%, rgba(5,10,18,0.40) 50%, rgba(4,8,14,0.58) 100%)",
          }}
        />
        {/* Atmospheric haze around the rider — slow drift adds depth */}
        <div
          className="absolute inset-0 animate-breathe-slow"
          style={{
            background:
              "radial-gradient(58% 46% at 50% 38%, rgba(140,190,215,0.18), rgba(140,190,215,0.05) 45%, transparent 72%)",
          }}
        />
        {/* Second, lower haze so depth carries further down the page */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(52% 42% at 66% 80%, rgba(90,150,185,0.10), transparent 70%)",
          }}
        />
        {/* Top cyan breathe glow */}
        <div
          className="absolute -top-1/4 left-1/2 h-[70vh] w-[130vw] -translate-x-1/2 animate-breathe-slow"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 0%, rgba(120,200,220,0.12), transparent 72%)",
          }}
        />
        {/* Bottom vignette — keeps the navigation legible without crushing to black */}
        <div
          className="absolute inset-x-0 bottom-0 h-48"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(4,7,12,0.72))",
          }}
        />
        {/* Scan line */}
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
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/70">SPARKI</span>
          </div>
          <Show when="signed-out">
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/30">{section.toUpperCase()}</span>
          </Show>
          <Show when="signed-in">
            <div className="flex flex-col items-end gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.22em] text-white/30">{section.toUpperCase()}</span>
              <RoleSwitcher />
            </div>
          </Show>
        </header>

        {children}
      </div>
    </main>
  )
}
