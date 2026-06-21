"use client"

import { Activity, Gauge, Bike, Sparkles, User } from "lucide-react"
import { useState } from "react"

const items = [
  { icon: Gauge, label: "Center" },
  { icon: Activity, label: "Trends" },
  { icon: Bike, label: "Train" },
  { icon: Sparkles, label: "Coach" },
  { icon: User, label: "You" },
]

export function BottomNav() {
  const [active, setActive] = useState(0)

  return (
    <nav className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-[#050608] to-transparent"
      />
      <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#050608]/80 px-6 pb-7 pt-4 backdrop-blur-xl">
        {items.map((item, i) => {
          const Icon = item.icon
          const isActive = i === active
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setActive(i)}
              className="flex flex-col items-center gap-1.5"
            >
              <Icon
                className="h-5 w-5 transition-colors"
                style={{
                  color: isActive
                    ? "var(--accent-cyan)"
                    : "rgba(255,255,255,0.4)",
                  filter: isActive
                    ? "drop-shadow(0 0 6px var(--accent-cyan))"
                    : "none",
                }}
                strokeWidth={1.75}
              />
              <span
                className="text-[9px] uppercase tracking-[0.15em]"
                style={{
                  color: isActive
                    ? "var(--accent-cyan)"
                    : "rgba(255,255,255,0.35)",
                }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
