// SPARKI_BUILD_01 F3 — rolgestuurd startpunt per server-side rolwaarde (BB-08).
//
// /rol-start/:rol toont voor élke werkelijk bestaande rolwaarde een eigen
// startpunt: de echte, werkende ingangen van die rol, en — zolang de
// rolomgeving dun is — de eerlijke lege toestand (wat ontbreekt · wie het
// oplost · één vervolgstap). Een rolwaarde die server-side niet bestaat,
// krijgt géén verzonnen scherm maar de eerlijke melding daarvan. Nooit een
// terugval op de sporterweergave.
import { Link, useLocation, useParams } from "wouter"
import { ArrowRight, CircleAlert } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { roleStartFor } from "@/lib/role-start"
import { useUserProfile } from "@/contexts/UserContext"
import { useMyClubs } from "@/hooks/use-club"

export default function RolStartPage() {
  const params = useParams<{ rol: string }>()
  // Fallback op het pad: in Development Preview Mode rendert deze pagina
  // buiten een <Route>, waardoor useParams leeg blijft.
  const [location] = useLocation()
  const rol =
    params.rol ?? decodeURIComponent(location.split("/rol-start/")[1]?.split(/[/?#]/)[0] ?? "")
  const start = roleStartFor(rol)

  // F-P0-03 — rolbezit-poort (fail-closed). Het startscherm van een rol is
  // alleen zichtbaar voor wie die rol werkelijk bezit: globale rollen uit het
  // server-side profiel, clubrollen uit actieve club_members-lidmaatschappen.
  // Zonder bezit tonen we een eerlijke geen-toegang-toestand die géén
  // rolstructuur of navigatielabels lekt.
  // Vers autorisatiebesluit per bezoek: geen stale cache voor deze poort
  // (staleTime 0 + refetchOnMount "always"), en een lopende her-fetch of
  // fetch-fout telt als "nog niet bewezen bezit" — dus geen toegang tonen.
  const { profile, isLoading: profileLoading } = useUserProfile()
  const clubsQuery = useMyClubs({ authzFresh: true })
  const ownedRoles = new Set<string>([
    ...(profile?.roles ?? []),
    ...(clubsQuery.data ?? [])
      .map((row) => row?.membership?.role as string | undefined)
      .filter((r): r is string => typeof r === "string"),
  ])
  const ownershipLoading = profileLoading || clubsQuery.isFetching

  if (start && ownershipLoading) {
    return (
      <ScreenShell section="Startpunt">
        <p className="text-sm text-white/40" data-testid="rolstart-laden">
          Startpunt wordt geladen…
        </p>
      </ScreenShell>
    )
  }

  if (start && !ownedRoles.has(start.role)) {
    return (
      <ScreenShell section="Geen toegang">
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"
          data-testid="rolstart-geen-toegang"
        >
          <p className="text-sm text-white/70">
            Dit startscherm hoort bij een rol die niet aan jouw account is
            gekoppeld. Er wordt daarom niets van getoond.
          </p>
          <p className="mt-2 text-sm text-white/40">
            Denk je dat dit een fout is? De clubbeheerder of jouw trainer ziet
            welke rol er werkelijk aan jouw account hangt.
          </p>
        </div>
      </ScreenShell>
    )
  }

  if (!start) {
    return (
      <ScreenShell section="Onbekende rol">
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"
          data-testid="rolstart-onbekend"
        >
          <p className="text-sm text-white/70">
            De rol "{params.rol}" bestaat niet in Sparki. Er is daarom ook geen
            startscherm voor — er wordt niets nagebootst.
          </p>
          <p className="mt-2 text-sm text-white/40">
            Denk je dat dit een fout is? De clubbeheerder ziet jouw werkelijke
            rol in het clubbeheer.
          </p>
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell section={start.label}>
      <div className="space-y-4" data-testid={`rolstart-${start.role}`}>
        {start.functies.length > 0 && (
          <section>
            <SectionLabel title="Jouw ingangen" />
            <div className="mt-2 space-y-2">
              {start.functies.map((f) => (
                <Link
                  key={f.href}
                  href={f.href}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md transition-colors hover:border-cyan-300/30"
                  data-testid={`rolstart-functie-${f.href}`}
                >
                  <span className="text-sm text-white/80">{f.label}</span>
                  <ArrowRight className="h-4 w-4 text-white/30" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {start.leeg && (
          <section
            className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"
            data-testid="rolstart-leeg"
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-sm text-white/75">{start.leeg.ontbreekt}</p>
                <p className="text-sm text-white/45">{start.leeg.wieLostOp}</p>
                <Link
                  href={start.leeg.vervolgstap.href}
                  className="inline-flex items-center gap-1.5 text-sm text-cyan-300/90 hover:text-cyan-200"
                >
                  {start.leeg.vervolgstap.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </ScreenShell>
  )
}
