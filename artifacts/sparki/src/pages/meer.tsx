import { Shield, LifeBuoy, Link2, Settings } from "lucide-react"
import { useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
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
// vaste hoofdkeuzes (Vandaag · Trainen · Rijden · Wedstrijd) zitten. Er wordt
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
    <ScreenShell section="meer" bare>
      <h1 className="font-sans text-xl font-extralight text-white/90">Meer</h1>
      <p className="mt-1 text-[13px] text-white/40">
        Alle overige onderdelen van Sparki.
      </p>

      <div className="mt-4">
        <ChapterGrid chapters={chapters} />
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-white/45" strokeWidth={1.75} />
          <h2 className="font-sans text-[15px] font-light text-white/80">
            Instellingen
          </h2>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLocation("/connect")}
            className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <Link2 className="h-4 w-4" strokeWidth={1.75} />
            Sparki Connect — koppelingen &amp; import
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setLocation("/support")}
          className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
        >
          <LifeBuoy className="h-4 w-4" strokeWidth={1.75} />
          Help &amp; support
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <Shield className="h-4 w-4" strokeWidth={1.75} />
            Admin
          </button>
        )}
      </div>
    </ScreenShell>
  )
}
