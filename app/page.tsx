import Link from "next/link"
import { readiness } from "@/lib/sparki-data"

const concepts = [
  {
    href: "/lab",
    index: "A",
    title: "Performance Laboratory",
    desc: "Scientific. Technical. Elite.",
    accent: "oklch(0.82 0.16 200)",
  },
  {
    href: "/pitwall",
    index: "B",
    title: "Formula One Pitwall",
    desc: "Engineering. Telemetry. Real-time.",
    accent: "oklch(0.78 0.18 55)",
  },
  {
    href: "/future",
    index: "C",
    title: "Future Human Performance",
    desc: "Minimal. Futuristic. Alive.",
    accent: "oklch(0.9 0.06 200)",
  },
]

export default function Page() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#020203] text-white">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[60vh] w-[120vw] -translate-x-1/2 animate-breathe-slow"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 0%, rgba(120,200,220,0.14), transparent 70%)",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-7 pb-10 pt-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/70">
              SPARKI
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.25em] text-white/30">
            AI PERFORMANCE CENTER
          </span>
        </div>

        <div className="mt-20">
          <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-300/80">
            SYSTEM {readiness.state} · {readiness.score}
          </p>
          <h1 className="mt-4 text-balance font-sans text-5xl font-extralight leading-[1.05] tracking-tight">
            Enter your
            <br />
            performance
            <br />
            <span className="text-white/40">laboratory.</span>
          </h1>
          <p className="mt-5 max-w-xs text-pretty text-sm leading-relaxed text-white/45">
            One athlete. One dataset. Three radically different ways to feel it.
            Choose your interface.
          </p>
        </div>

        <nav className="mt-auto flex flex-col gap-3 pt-16">
          {concepts.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
            >
              <span
                className="font-mono text-2xl font-light"
                style={{ color: c.accent }}
              >
                {c.index}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium tracking-tight text-white/90">
                  {c.title}
                </span>
                <span className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                  {c.desc}
                </span>
              </span>
              <span
                className="ml-auto h-8 w-8 shrink-0 rounded-full border border-white/10 transition-all group-hover:scale-110"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${c.accent}, transparent 70%)`,
                }}
              />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
