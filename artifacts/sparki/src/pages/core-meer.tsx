// Meer (/meer) in de commerciële schil — Core-afbouwwave 1.
// Gegroepeerde, rustige lijst op het centrale designsysteem (donker, premium).
// Vaste groepsvolgorde (harde eis): 1 Profiel & account; 2 Veelgebruikt;
// 3 Sport & materiaal; 4 Koppelingen & gegevens; 5 Ondersteuning & kennis;
// 6 Beheer, instellingen & privacy. Alle bestaande bestemmingen bereikbaar;
// rolgedrag identiek aan pages/meer.tsx; club- en admin-condities identiek.

import { dagSfeer } from "@/lib/sfeer"
import { Link } from "wouter"
import { CommercialShell } from "@/components/sparki/commercial-shell"
import { IconChevron } from "@/components/ds"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { useClubMembership } from "@/hooks/use-club"
import { useAdminWhoami } from "@/hooks/use-bug-reports"
import { bouwMeerGroepen } from "@/lib/core-meer"
import { cn } from "@/lib/utils"
import {
  Home,
  Dumbbell,
  Trophy,
  HeartPulse,
  Wrench,
  Map,
  Users,
  User,
  CalendarDays,
  Building2,
  UserPlus,
  Radio,
  Compass,
  Activity,
  BookOpen,
  IdCard,
  Mountain,
  Music,
  Link2,
  LifeBuoy,
  Shield,
  type LucideIcon,
} from "lucide-react"

// Icoon-lookup uit chapters.ts. Connect, Support en Admin hebben daar geen
// icoon-definitie (losse knoppen in de oude pagina) — we kennen ze hier toe.
const ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": Home,
  "/train": Dumbbell,
  "/races": Trophy,
  "/activiteiten": Activity,
  "/lichaam": HeartPulse,
  "/mechanieker": Wrench,
  "/route": Map,
  "/samen": Users,
  "/you": User,
  "/kalender": CalendarDays,
  "/club": Building2,
  "/invitations": UserPlus,
  "/feed": Radio,
  "/paspoort": IdCard,
  "/kennis": BookOpen,
  "/klimmen": Mountain,
  "/geluid": Music,
  "/": Compass, // Startoverzicht — Compass voor Ontdekken, Home voor /vandaag
  "/connect": Link2,
  "/support": LifeBuoy,
  "/admin": Shield,
}

// Startoverzicht (/) krijgt Home-icoon (niet Compass — dat is voor /feed).
ICON_MAP["/"] = Home

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"

export default function CoreMeerPage() {
  const { profile } = useUserProfile()
  const role = (profile?.activeRole as Role | undefined) ?? "athlete"
  const { isMember } = useClubMembership()
  const { data: adminWho } = useAdminWhoami()
  const isAdmin = adminWho?.isAdmin === true

  const groepen = bouwMeerGroepen({
    role: role === "coach" ? "coach" : role === "parent" ? "parent" : "athlete",
    isClubMember: isMember,
    isAdmin,
  })

  return (
    <CommercialShell actief="/meer" sfeer={dagSfeer("meer")}>
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 lg:max-w-3xl lg:px-10">
        <h1 className="type-display">Meer</h1>
        <p className="type-body mt-1 text-content-secondary">
          Alle overige onderdelen van Sparki.
        </p>

        <div className="mt-8 space-y-8">
          {groepen
            .filter((g) => g.items.length > 0)
            .map((groep) => (
              <section key={groep.titel} aria-labelledby={`groep-${groep.titel}`}>
                <h2
                  id={`groep-${groep.titel}`}
                  className="type-title-card text-foreground/90"
                >
                  {groep.titel}
                </h2>
                <div className="mt-3 space-y-2">
                  {groep.items.map((item) => {
                    const Icon = ICON_MAP[item.href] ?? Compass
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border hover:bg-surface-strong",
                          FOCUS_RING,
                        )}
                      >
                        <Icon
                          className="h-5 w-5 shrink-0 text-accent-cyan"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="type-action font-semibold text-foreground/90">
                            {item.label}
                          </p>
                          <p className="type-body-sm text-content-secondary">
                            {item.hint}
                          </p>
                        </div>
                        <IconChevron
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
      </div>
    </CommercialShell>
  )
}
