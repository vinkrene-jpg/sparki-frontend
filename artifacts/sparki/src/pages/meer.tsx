import { Shield, LifeBuoy, Link2, Settings } from "lucide-react"
import { dagSfeer } from "@/lib/sfeer"
import { APP_VERSION, BUILD_SHA, IS_PRODUCTION_BUILD } from "@/lib/version"
import { useLocation } from "wouter"
import { CommercialShell } from "@/components/sparki/commercial-shell"
import { ChapterGrid } from "@/components/sparki/chapter-grid"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { useClubMembership } from "@/hooks/use-club"
import { useAdminWhoami } from "@/hooks/use-bug-reports"
import {
  ATHLETE_MEER_CHAPTERS,
  CLUB_CHAPTER,
  chaptersForRole,
} from "@/lib/chapters"

// "Meer" — de vijfde hoofdknop. Bundelt alle hoofdstukken die niet in de vier
// vaste hoofdkeuzes (Vandaag · Trainen · Routes · Wedstrijd) zitten. Er wordt
// hier niets nieuws gebouwd: elke tegel verwijst naar een bestaande pagina.
// Club verschijnt alleen bij een echte, geaccepteerde trainerkoppeling; de
// Admin-ingang alleen als de server dit account als admin bevestigt.
export default function MeerPage() {
  const [, setLocation] = useLocation()
  const { profile } = useUserProfile()
  const role = profile?.activeRole as Role | undefined
  const { isMember } = useClubMembership()
  const { data: adminWho } = useAdminWhoami()
  const isAdmin = adminWho?.isAdmin === true

  // Coach en ouder houden hun eigen (kortere) navigatie; als zij hier toch
  // belanden via een directe URL tonen we gewoon hun bestaande hoofdstukken.
  const chapters =
    role === "coach" || role === "parent"
      ? chaptersForRole(role, isMember)
      : isMember
        ? [CLUB_CHAPTER, ...ATHLETE_MEER_CHAPTERS]
        : ATHLETE_MEER_CHAPTERS

  return (
    <CommercialShell actief="/meer" sfeer={dagSfeer("meer")}>
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 lg:max-w-3xl lg:px-10">

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Meer</h1>
          <p className="mt-1 type-body text-content-secondary">
            Alle overige onderdelen van Sparki.
          </p>
        </header>

        <section className="mb-8">
          <ChapterGrid chapters={chapters} />
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4 text-content-secondary" strokeWidth={1.75} />
            <h2 className="type-title-card text-white/80">Instellingen</h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setLocation("/connect")}
              className="flex items-center gap-2.5 rounded-full border border-border px-4 py-2 type-body-sm text-content-secondary transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
            >
              <Link2 className="h-4 w-4" strokeWidth={1.75} />
              Sparki Connect — koppelingen &amp; import
            </button>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLocation("/support")}
            className="flex items-center gap-2.5 rounded-full border border-border px-4 py-2 type-body-sm text-content-secondary transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            <LifeBuoy className="h-4 w-4" strokeWidth={1.75} />
            Hulp &amp; ondersteuning
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setLocation("/admin")}
              className="flex items-center gap-2.5 rounded-full border border-border px-4 py-2 type-body-sm text-content-secondary transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
            >
              <Shield className="h-4 w-4" strokeWidth={1.75} />
              Beheer
            </button>
          )}
        </div>

        {/* Beslisblok 01: Privacy en Voorwaarden altijd bereikbaar via Meer. */}
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => setLocation("/privacy")}
            className="type-body-sm text-content-secondary underline underline-offset-2 transition-colors hover:text-accent-cyan"
          >
            Privacy
          </button>
          <button
            type="button"
            onClick={() => setLocation("/voorwaarden")}
            className="type-body-sm text-content-secondary underline underline-offset-2 transition-colors hover:text-accent-cyan"
          >
            Voorwaarden
          </button>
          <button
            type="button"
            onClick={() => setLocation("/photo-lab")}
            className="type-body-sm text-content-secondary underline underline-offset-2 transition-colors hover:text-accent-cyan"
          >
            Photo Lab
          </button>
        </div>

        {/* Eén mobiele waarheid (besluit 01-08-2026): het buildnummer is
            zichtbaar zodat op elke telefoon controleerbaar is wélke versie
            draait — PWA en mobiele browser moeten hetzelfde tonen. */}
        <p className="pt-1 type-body-sm text-content-secondary/70">
          Versie {APP_VERSION} · build {BUILD_SHA} ·{" "}
          {IS_PRODUCTION_BUILD ? "productie" : "ontwikkelomgeving"}
        </p>
      </div>
    </CommercialShell>
  )
}
