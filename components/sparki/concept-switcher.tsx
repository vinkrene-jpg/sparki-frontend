"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const concepts = [
  { href: "/lab", label: "LAB", index: "A" },
  { href: "/pitwall", label: "PITWALL", index: "B" },
  { href: "/future", label: "FUTURE", index: "C" },
]

export function ConceptSwitcher({ accent = "rgba(255,255,255,0.9)" }: { accent?: string }) {
  const pathname = usePathname()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <nav
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-xl"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
      >
        {concepts.map((c) => {
          const active = pathname === c.href
          return (
            <Link
              key={c.href}
              href={c.href}
              className="relative flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors"
              style={{
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
              }}
            >
              <span
                className="font-mono text-[10px] tracking-widest"
                style={{ color: active ? accent : "rgba(255,255,255,0.35)" }}
              >
                {c.index}
              </span>
              <span
                className="font-mono text-[10px] font-medium tracking-[0.2em]"
                style={{ color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)" }}
              >
                {c.label}
              </span>
              {active ? (
                <span
                  className="absolute -top-px left-1/2 h-px w-6 -translate-x-1/2"
                  style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                />
              ) : null}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
