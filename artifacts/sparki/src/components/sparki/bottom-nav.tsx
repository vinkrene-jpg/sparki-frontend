import { Home, Bike, Radio, FlaskConical, User } from "lucide-react"
import { Link, useLocation } from "wouter"

const items = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/train", icon: Bike, label: "Train" },
  { href: "/feed", icon: Radio, label: "Feed" },
  { href: "/lab", icon: FlaskConical, label: "Lab" },
  { href: "/you", icon: User, label: "You" },
]

export function BottomNav() {
  const [pathname] = useLocation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-[#040506] to-transparent"
      />
      <div className="mx-auto flex max-w-md items-center justify-between border-t border-white/[0.06] bg-[#040506]/85 px-7 pb-7 pt-3.5 backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5"
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className="h-5 w-5 transition-colors"
                style={{
                  color: isActive ? "var(--accent-cyan)" : "rgba(255,255,255,0.4)",
                  filter: isActive
                    ? "drop-shadow(0 0 6px var(--accent-cyan))"
                    : "none",
                }}
                strokeWidth={1.75}
              />
              <span
                className="font-mono text-[9px] uppercase tracking-[0.18em]"
                style={{
                  color: isActive ? "var(--accent-cyan)" : "rgba(255,255,255,0.35)",
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
