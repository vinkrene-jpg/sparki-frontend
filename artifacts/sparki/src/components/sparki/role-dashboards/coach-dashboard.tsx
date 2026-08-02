// DASHBOARD_01 Fase B — Zelfstandige trainer (coach) dashboard.
//
// Drie lagen uit BESTAANDE cockpit-data (/api/coach/dashboard):
//   Laag 1 — hoeveel sporters + hoe de groep ervoor staat (readiness-verdeling
//            over de gekoppelde sporters).
//   Laag 2 — wie vandaag aandacht nodig heeft (de sporter met de hoogste
//            prioriteit / het scherpste topsignaal uit de signaal-engine).
//   Laag 3 — sporters die (mogelijk) afhaken: langste tijd zonder beoordeling /
//            geen recente activiteit. Openstaande facturen: er is GEEN
//            trainer-factuurbron in deze frontend, dus die kans wordt eerlijk
//            weggelaten (geen verzonnen laag).
//
// Het heringedeelde cockpit (F9) blijft de werkomgeving; dit dashboard verwijst
// ernaar door via de doorklik en de laag-2/laag-3-acties.

import { useMemo } from "react"
import {
  useCoachDashboard,
  type DashboardAthlete,
} from "@/hooks/use-coach-cockpit"
import {
  RoleDashboard,
  type Layer1,
  type Layer2,
  type Layer3Item,
} from "@/components/sparki/role-dashboard"

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 3600 * 1000))
}

export function CoachDashboard() {
  const { data, isLoading } = useCoachDashboard()
  const athletes = useMemo(() => data?.athletes ?? [], [data])

  // Alleen sporters die iets delen tellen mee voor het beeld (rechten volgen de
  // bestaande deel-instelling — DSH-09/23).
  const gedeeld = athletes.filter((a) => a.sharing !== "none")

  const laag1: Layer1 | null = useMemo(() => {
    if (athletes.length === 0) return null
    const fris = gedeeld.filter((a) => a.readiness?.label === "fresh").length
    const vermoeid = gedeeld.filter((a) => a.readiness?.label === "tired").length
    const aandacht = gedeeld.filter((a) => (a.openSignals ?? 0) > 0).length
    // Eén regel duiding — hoe staat de groep ervoor, in één blik.
    let meaning: string
    if (gedeeld.length === 0) {
      meaning = "Nog geen van je sporters deelt gegevens — je ziet alleen de koppeling."
    } else if (vermoeid > 0) {
      meaning = `${vermoeid} vermoeid, ${fris} fris. ${aandacht} vraagt vandaag aandacht.`
    } else if (aandacht > 0) {
      meaning = `De groep staat er goed voor; ${aandacht} sporter${aandacht === 1 ? "" : "s"} vraagt vandaag aandacht.`
    } else {
      meaning = "De groep staat er rustig voor — niets dat nu aandacht vraagt."
    }
    return {
      kicker: "Jouw sporters",
      value: String(athletes.length),
      meaning,
      detail:
        gedeeld.length > 0
          ? `${gedeeld.length} deelt gegevens · ${fris} fris · ${vermoeid} vermoeid`
          : null,
    }
  }, [athletes, gedeeld])

  const laag2: Layer2 | null = useMemo(() => {
    // Wie vraagt vandaag aandacht: hoogste prioriteit (1 = nu) met een topsignaal.
    const kandidaten = gedeeld
      .filter((a) => a.topSignal != null)
      .sort((x, y) => (x.priority ?? 9) - (y.priority ?? 9))
    const eerste = kandidaten[0]
    if (!eerste) return null
    const naam = eerste.displayName ?? "Een sporter"
    return {
      title: `${naam} vraagt aandacht`,
      body:
        eerste.topSignal?.title ??
        "Er staat een besluit klaar in het cockpit.",
      href: `/coach/athletes/${eerste.athleteClerkId}/cockpit`,
      actionLabel: "Open het cockpit",
      urgent: eerste.priority === 1,
    }
  }, [gedeeld])

  const laag3: { title: string; items: Layer3Item[] } | null = useMemo(() => {
    // Afhakers: directe koppelingen (schrijfbaar) met lang geen activiteit én
    // geen recente beoordeling. Openstaande facturen: geen bron → weggelaten.
    const risico = gedeeld
      .filter((a) => a.relation !== "team")
      .map((a) => {
        const stil = daysSince(a.lastActivity?.sessionDate)
        return { a, stil }
      })
      .filter(({ stil }) => stil != null && stil >= 14)
      .sort((x, y) => (y.stil ?? 0) - (x.stil ?? 0))
      .slice(0, 4)
    if (risico.length === 0) return null
    const items: Layer3Item[] = risico.map(({ a, stil }) => ({
      key: a.athleteClerkId,
      title: a.displayName ?? "Sporter",
      body: `${stil} dagen geen activiteit — mogelijk aan het afhaken.`,
      href: `/coach/athletes/${a.athleteClerkId}/cockpit`,
      actionLabel: "Bekijk",
    }))
    return { title: "Risico's en kansen", items }
  }, [gedeeld])

  return (
    <RoleDashboard
      section="Coach"
      bg="/atmosphere/samen-renners-gesprek.webp"
      loading={isLoading}
      laag1={laag1}
      laag2={laag2}
      laag3={laag3}
      werkscherm={{
        href: "/coach",
        label: "Naar je trainerswerkomgeving",
        hint: "Alle sporters, planning en berichten",
      }}
    />
  )
}
