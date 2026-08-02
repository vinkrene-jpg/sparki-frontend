// SPARKI_BUILD_01 F3 — rolgestuurd startpunt per server-side rolwaarde (BB-08).
//
// /rol-start/:rol toont voor élke werkelijk bestaande rolwaarde een eigen
// startpunt: de echte, werkende ingangen van die rol, en — zolang de
// rolomgeving dun is — de eerlijke lege toestand (wat ontbreekt · wie het
// oplost · één vervolgstap). Een rolwaarde die server-side niet bestaat,
// krijgt géén verzonnen scherm maar de eerlijke melding daarvan. Nooit een
// terugval op de sporterweergave.
import type { FC } from "react"
import { Link, useLocation, useParams } from "wouter"
import { ArrowRight, CircleAlert } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { roleStartFor } from "@/lib/role-start"
import { useUserProfile } from "@/contexts/UserContext"
import { useMyClubs } from "@/hooks/use-club"
// DASHBOARD_01 Fase B (DSH-13a) — voor clubrollen met een drie-lagen dashboard
// is DAT hun eerste scherm; het vervangt de oude ingangenlijst. Rollen zonder
// dashboard (mechanieker/soigneur/medical/assistent/…) houden hun bestaande
// rolstart hieronder.
import { HoofdtrainerDashboard } from "@/components/sparki/role-dashboards/hoofdtrainer-dashboard"
import { ClubbeheerderDashboard } from "@/components/sparki/role-dashboards/clubbeheerder-dashboard"
import { TeammanagerDashboard } from "@/components/sparki/role-dashboards/teammanager-dashboard"
import { PloegleiderDashboard } from "@/components/sparki/role-dashboards/ploegleider-dashboard"

// Clubrolwaarde → Fase B-dashboard. owner/admin krijgen het clubbeheerder-
// dashboard (ontwikkeling ledenbestand); de overige rollen zoals in tabel §3.
const ROL_DASHBOARD: Record<string, FC> = {
  owner: ClubbeheerderDashboard,
  admin: ClubbeheerderDashboard,
  hoofdtrainer: HoofdtrainerDashboard,
  teammanager: TeammanagerDashboard,
  ploegleider: PloegleiderDashboard,
}

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
        <p className="text-sm text-muted-foreground" data-testid="rolstart-laden">
          Startpunt wordt geladen…
        </p>
      </ScreenShell>
    )
  }

  if (start && !ownedRoles.has(start.role)) {
    return (
      <ScreenShell section="Geen toegang">
        <div
          className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md"
          data-testid="rolstart-geen-toegang"
        >
          <p className="text-sm text-muted-foreground">
            Dit startscherm hoort bij een rol die niet aan jouw account is
            gekoppeld. Er wordt daarom niets van getoond.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
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
          className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md"
          data-testid="rolstart-onbekend"
        >
          <p className="text-sm text-muted-foreground">
            De rol "{params.rol}" bestaat niet in Sparki. Er is daarom ook geen
            startscherm voor — er wordt niets nagebootst.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Denk je dat dit een fout is? De clubbeheerder ziet jouw werkelijke
            rol in het clubbeheer.
          </p>
        </div>
      </ScreenShell>
    )
  }

  // DSH-13a: heeft deze rol een Fase B-dashboard, dan IS dat het startscherm
  // (na de bezit-poort hierboven). De bestaande werkschermen blijven via de
  // doorklik in het dashboard bereikbaar — niets weggelaten.
  const DashboardVoorRol = ROL_DASHBOARD[start.role]
  if (DashboardVoorRol) return <DashboardVoorRol />

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
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 backdrop-blur-md transition-colors hover:border-accent-cyan/30"
                  data-testid={`rolstart-functie-${f.href}`}
                >
                  <span className="text-sm text-foreground/80">{f.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {start.leeg && (
          <section
            className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md"
            data-testid="rolstart-leeg"
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-warning)]" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-sm text-foreground/75">{start.leeg.ontbreekt}</p>
                <p className="text-sm text-muted-foreground">{start.leeg.wieLostOp}</p>
                <Link
                  href={start.leeg.vervolgstap.href}
                  className="inline-flex items-center gap-1.5 text-sm text-accent-cyan hover:text-accent-cyan"
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
