import type { ReactNode } from "react"

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
          <span className="label-sm text-white/30">{section.toUpperCase()}</span>
        </header>

        {children}
      </div>
    </main>
  )
}
