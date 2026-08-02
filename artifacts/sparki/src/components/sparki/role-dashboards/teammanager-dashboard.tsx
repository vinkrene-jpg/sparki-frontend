// DASHBOARD_01 Fase B — Teammanager dashboard.
//
// Drie lagen uit BESTAANDE club-/wedstrijddata (BUILD_03-wedstrijdlaag):
//   Laag 1 — stand van het team: aantal teams onder beheer + aankomende
//            wedstrijden (/api/clubs/:id, /api/clubs/:id/races).
//   Laag 2 — wat er deze week speelt: de eerstvolgende wedstrijd of training
//            binnen zeven dagen.
//   Laag 3 — onderbezette wedstrijden: aankomende wedstrijden met weinig
//            beschikbare renners (selections met availability).
//
// De clubomgeving (/club) met selecties & kalender blijft de werkomgeving en is
// via de doorklik bereikbaar (DSH-13a).

import { useMemo } from "react"
import {
  useClubDashboard,
  useClubRaces,
  useClubTrainings,
  type ClubRaceEvent,
} from "@/hooks/use-club"
import { useActiveClub } from "./use-active-club"
import {
  RoleDashboard,
  type Layer1,
  type Layer2,
  type Layer3Item,
} from "@/components/sparki/role-dashboard"

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function daysUntil(iso: string): number {
  const t = Date.parse(`${iso}T12:00:00`)
  return Math.ceil((t - Date.now()) / (24 * 3600 * 1000))
}

function beschikbaar(r: ClubRaceEvent): number {
  return r.selections.filter((s) => s.availability === "beschikbaar").length
}

export function TeammanagerDashboard() {
  const { clubId, primaryColor, isLoading: clubLoading } = useActiveClub()
  const { data: dash, isLoading: dashLoading } = useClubDashboard(clubId)
  const { data: races, isLoading: racesLoading } = useClubRaces(clubId)
  const { data: trainings } = useClubTrainings(clubId)
  const isLoading = clubLoading || dashLoading || racesLoading

  const komend = useMemo(
    () =>
      (races ?? [])
        .filter((r) => daysUntil(r.raceDate) >= 0)
        .sort((a, b) => a.raceDate.localeCompare(b.raceDate)),
    [races],
  )

  const laag1: Layer1 | null = useMemo(() => {
    if (!dash) return null
    const teams = dash.teams.length
    if (teams === 0 && komend.length === 0) return null
    return {
      kicker: "Jouw team",
      value: teams > 0 ? `${teams} team${teams === 1 ? "" : "s"}` : "Team",
      meaning:
        komend.length > 0
          ? `${komend.length} wedstrijd${komend.length === 1 ? "" : "en"} op de kalender.`
          : "Geen wedstrijden gepland — het is rustig.",
      accent: primaryColor,
      detail:
        dash.upcomingTrainings.length > 0
          ? `${dash.upcomingTrainings.length} training${dash.upcomingTrainings.length === 1 ? "" : "en"} gepland`
          : null,
    }
  }, [dash, komend, primaryColor])

  const laag2: Layer2 | null = useMemo(() => {
    const dezeWeekRace = komend.find((r) => daysUntil(r.raceDate) <= 7)
    if (dezeWeekRace) {
      return {
        title: dezeWeekRace.name,
        body: `Deze week · ${fmtDate(dezeWeekRace.raceDate)}${
          dezeWeekRace.location ? ` · ${dezeWeekRace.location}` : ""
        }.`,
        href: "/club",
        actionLabel: "Bekijk selectie",
        urgent: daysUntil(dezeWeekRace.raceDate) <= 2,
      }
    }
    const training = (trainings ?? []).find(
      (t) => daysUntil(t.trainingDate) >= 0 && daysUntil(t.trainingDate) <= 7,
    )
    if (training) {
      return {
        title: training.title,
        body: `Deze week · ${fmtDate(training.trainingDate)}.`,
        href: "/club",
        actionLabel: "Bekijk in de club",
      }
    }
    return null
  }, [komend, trainings])

  const laag3: { title: string; items: Layer3Item[] } | null = useMemo(() => {
    const onderbezet = komend
      .filter((r) => beschikbaar(r) < 3)
      .slice(0, 5)
      .map<Layer3Item>((r) => ({
        key: `race-${r.id}`,
        title: r.name,
        body: `${beschikbaar(r)} renner${beschikbaar(r) === 1 ? "" : "s"} beschikbaar · ${fmtDate(r.raceDate)}.`,
        href: "/club",
        actionLabel: "Bekijk selectie",
      }))
    if (onderbezet.length === 0) return null
    return { title: "Onderbezette wedstrijden", items: onderbezet }
  }, [komend])

  return (
    <RoleDashboard
      section="club"
      bg="/atmosphere/samen-groepsrit-winter.webp"
      loading={isLoading}
      laag1={laag1}
      laag2={laag2}
      laag3={laag3}
      werkscherm={{
        href: "/club",
        label: "Naar selecties & kalender",
        hint: "Team, wedstrijden en beschikbaarheid",
      }}
    />
  )
}
