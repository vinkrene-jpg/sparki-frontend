// DASHBOARD_01 Fase C — de kaart-landing (DSH-10/11).
//
// Gratis en Go landen na login op de KAART met een onderblad. Het onderblad
// toont UITSLUITEND laag 2 ("wat je vandaag doet") — NIET het hele dashboard:
//   • Gratis  → zoeken + bewaarde routes (bestaande routebibliotheek-ingang).
//   • Go      → het routevoorstel van vandaag mét de reden erbij (bestaande
//                geplande-training-bron + de gekoppelde route).
//
// De kaart zelf is de routeplanner: het onderblad zet dus altijd één tik door
// naar /routes (dé routeplanner met de volledige zweefkaart). Zo blijft dit
// scherm eerlijk "de kaart", en verdubbelt het de routeplanner niet.
//
// Alles hier komt uit bestaande hooks — geen nieuwe datastromen, geen verzonnen
// inhoud. Bij ontbrekende data een eerlijke lege toestand, nooit een vulkaart.

import { useLocation } from "wouter"
import { CommercialShell } from "@/components/sparki/commercial-shell"
import { RouteMap } from "@/components/sparki/route-map"
import { useRoutes, type SparkiRoute } from "@/hooks/use-routes"
import { useTodayWorkout } from "@/hooks/use-today-workout"
import { useWorkoutRoutes } from "@/hooks/use-routes"
import { DsButton, DsCard, DsCardTitel, DsState, IconChevron } from "@/components/ds"
import type { Package } from "@/hooks/use-package"

// Eerlijke kaartachtergrond: teken de meest recente bewaarde route met echte
// geometrie. Is die er niet, dan een rustige lege kaart (geen verzonnen lijn).
function eersteRouteMetGeometrie(
  routes: ReadonlyArray<SparkiRoute> | undefined,
): SparkiRoute | null {
  if (!routes) return null
  return routes.find((r) => (r.geometry?.length ?? 0) > 1) ?? null
}

// ── Onderblad: Gratis — zoeken + bewaarde routes ────────────────────────────
function OnderbladGratis() {
  const [, navigate] = useLocation()
  const { data, isLoading, isError } = useRoutes()
  const routes = data?.routes ?? []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="type-title-card text-foreground/90">Wat wil je vandaag rijden?</h2>
        <p className="type-body mt-1 text-content-secondary">
          Zoek een route of pak er een uit je bewaarde routes.
        </p>
      </div>

      {/* Zoeken → de routeplanner (Maken). Eén tik naar de volledige kaart. */}
      <DsButton variant="primair" onClick={() => navigate("/routes?view=maken")}>
        Route zoeken op de kaart
      </DsButton>

      {/* Bewaarde routes — compacte lijst, doorklik naar de bibliotheek. */}
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="type-title-card text-foreground/90">Bewaarde routes</h3>
          {routes.length > 0 && (
            <DsButton variant="tekst" onClick={() => navigate("/routes?view=bewaard")}>
              Alle bekijken
              <IconChevron aria-hidden="true" />
            </DsButton>
          )}
        </div>
        {isLoading ? (
          <div
            className="mt-3 h-16 rounded-card border border-border bg-surface motion-safe:animate-pulse"
            aria-hidden="true"
          />
        ) : isError ? (
          <DsState
            className="mt-3"
            soort="nietBeschikbaar"
            titel="Je bewaarde routes konden niet worden geladen."
          />
        ) : routes.length === 0 ? (
          <DsState
            className="mt-3"
            soort="leeg"
            titel="Je hebt nog geen routes bewaard."
            actie={{
              label: "Maak je eerste route",
              onClick: () => navigate("/routes?view=maken"),
            }}
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {routes.slice(0, 3).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/routes?view=bewaard&route=${r.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
                >
                  <span className="min-w-0">
                    <span className="type-body block truncate font-medium text-foreground/90">
                      {r.name}
                    </span>
                    {r.distanceKm != null && (
                      <span className="num type-body-sm text-content-secondary">
                        {Math.round(r.distanceKm)} km
                      </span>
                    )}
                  </span>
                  <IconChevron aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Onderblad: Go — routevoorstel van vandaag mét reden ─────────────────────
function OnderbladGo() {
  const [, navigate] = useLocation()
  const workout = useTodayWorkout()
  const w = workout.isError ? null : workout.data
  const routes = useWorkoutRoutes(w?.id)
  const linked = routes.data?.routes?.[0] ?? null

  // De reden: het doel van de training van vandaag (bestaande bron), of — bij
  // een gekoppelde route — de rationale van die route.
  const reden =
    w?.structure?.rationale?.supportsGoal ??
    w?.planDetails?.goal ??
    linked?.rationale ??
    null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="type-title-card text-foreground/90">Jouw rit van vandaag</h2>
        <p className="type-body mt-1 text-content-secondary">
          Een voorstel op basis van je training van vandaag.
        </p>
      </div>

      {workout.isLoading ? (
        <div
          className="h-24 rounded-card border border-border bg-surface motion-safe:animate-pulse"
          aria-hidden="true"
        />
      ) : !w ? (
        <DsState
          soort="leeg"
          titel="Geen training gepland voor vandaag."
          actie={{ label: "Plan zelf een route", onClick: () => navigate("/routes?view=maken") }}
        />
      ) : (
        <DsCard>
          <DsCardTitel>{w.title}</DsCardTitel>
          {reden && (
            <p className="type-body mt-2 text-content-secondary">
              <span className="font-medium text-foreground/90">Waarom deze rit:</span> {reden}
            </p>
          )}
          {linked ? (
            <p className="num type-body-sm mt-2 text-content-secondary">
              Route: {linked.name}
              {linked.distanceKm != null ? ` · ${Math.round(linked.distanceKm)} km` : ""}
            </p>
          ) : (
            <p className="type-body-sm mt-2 text-content-secondary">
              Nog geen route gekoppeld — stel er een voor op de kaart.
            </p>
          )}
          <div className="mt-4">
            <DsButton
              variant="primair"
              onClick={() =>
                navigate(
                  linked
                    ? `/routes?view=bewaard&route=${linked.id}`
                    : "/routes?view=maken",
                )
              }
            >
              {linked ? "Route bekijken" : "Route voorstellen"}
            </DsButton>
          </div>
        </DsCard>
      )}
    </div>
  )
}

// ── De kaart-landing zelf ────────────────────────────────────────────────────
export function KaartLanding({ pkg }: { pkg: Package }) {
  const { data } = useRoutes()
  const achtergrondRoute = eersteRouteMetGeometrie(data?.routes)

  return (
    <CommercialShell actief="/routes">
      <div className="relative">
        {/* Kaart als achtergrond van de landing — echte route-geometrie of een
            rustige lege kaart (nooit een verzonnen lijn). Vaste hoogte zodat de
            Leaflet-container een echte hoogte heeft (inline height wint van CSS). */}
        <div className="relative w-full overflow-hidden">
          <RouteMap
            geometry={achtergrondRoute?.geometry ?? []}
            climbs={achtergrondRoute?.climbs ?? []}
            className="w-full !rounded-none !border-0"
            height={320}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-app"
          />
        </div>

        {/* Onderblad — zweeft over de kaart, toont ALLEEN laag 2. */}
        <section
          aria-label="Wat je vandaag doet"
          data-testid="kaart-onderblad"
          data-pakket={pkg}
          className="relative z-10 -mt-8 rounded-t-3xl border-t border-border bg-app px-5 pb-10 pt-6 lg:mx-auto lg:max-w-2xl lg:rounded-3xl lg:border lg:px-8"
        >
          {/* Greep — visuele hint dat dit een onderblad is. */}
          <div
            aria-hidden="true"
            className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted"
          />
          {pkg === "go" ? <OnderbladGo /> : <OnderbladGratis />}
        </section>
      </div>
    </CommercialShell>
  )
}
