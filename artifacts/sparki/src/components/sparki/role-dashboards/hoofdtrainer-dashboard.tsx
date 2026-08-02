// DASHBOARD_01 Fase B — Hoofdtrainer dashboard.
//
// Drie lagen uit BESTAANDE hoofdtrainer-overzichtsdata:
//   Laag 1 — ontwikkeling van zijn groepen: hoeveel groepen/teams en hoeveel
//            trainers eraan werken (/api/clubs/:id + hoofdtrainer/overview).
//   Laag 2 — wat vandaag speelt: de eerstvolgende clubtraining of -wedstrijd.
//   Laag 3 — groepen zonder trainer + achterblijvende trainers (geen
//            planactiviteit de laatste 30 dagen).
//
// De clubomgeving (/club) blijft de werkomgeving en is via de doorklik
// bereikbaar (DSH-13a).

import { useMemo } from "react"
import {
  useClubDashboard,
  useHoofdtrainerOverview,
} from "@/hooks/use-club"
import { useActiveClub } from "./use-active-club"
import {
  RoleDashboard,
  type Layer1,
  type Layer2,
  type Layer3Item,
} from "@/components/sparki/role-dashboard"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export function HoofdtrainerDashboard() {
  const { clubId, primaryColor, isLoading: clubLoading } = useActiveClub()
  const { data: dash, isLoading: dashLoading } = useClubDashboard(clubId)
  const { data: overview, isLoading: ovLoading } = useHoofdtrainerOverview(
    clubId,
    clubId != null,
  )
  const isLoading = clubLoading || dashLoading || ovLoading

  const groups = useMemo(() => dash?.groups ?? [], [dash])
  const trainers = useMemo(() => overview?.trainers ?? [], [overview])

  const laag1: Layer1 | null = useMemo(() => {
    if (!dash) return null
    const groepen = groups.length
    const teams = dash.teams.length
    if (groepen === 0 && teams === 0) return null
    const eenheden = groepen + teams
    const metTrainer = groups.filter((g) => g.trainerClerkId).length
    return {
      kicker: "Jouw groepen",
      value: String(eenheden),
      meaning:
        groepen > 0
          ? `${metTrainer} van ${groepen} groep${groepen === 1 ? "" : "en"} heeft een vaste trainer.`
          : `${teams} team${teams === 1 ? "" : "s"} onder jouw hoede.`,
      accent: primaryColor,
      detail:
        trainers.length > 0
          ? `${trainers.length} trainer${trainers.length === 1 ? "" : "s"} actief`
          : null,
    }
  }, [dash, groups, trainers, primaryColor])

  const laag2: Layer2 | null = useMemo(() => {
    if (!dash) return null
    const training = dash.upcomingTrainings[0]
    const race = dash.upcomingRaces[0]
    if (training) {
      return {
        title: training.title,
        body: `Eerstvolgende clubtraining · ${fmtDate(training.trainingDate)}.`,
        href: "/club",
        actionLabel: "Bekijk in de club",
      }
    }
    if (race) {
      return {
        title: race.name,
        body: `Eerstvolgende wedstrijd · ${fmtDate(race.raceDate)}.`,
        href: "/club",
        actionLabel: "Bekijk in de club",
      }
    }
    return null
  }, [dash])

  const laag3: { title: string; items: Layer3Item[] } | null = useMemo(() => {
    const items: Layer3Item[] = []
    for (const g of groups.filter((g) => !g.trainerClerkId)) {
      items.push({
        key: `group-${g.id}`,
        title: `${g.name} heeft geen vaste trainer`,
        body: g.level ? `Niveau ${g.level}.` : "Nog niemand toegewezen.",
        href: "/club",
        actionLabel: "Wijs een trainer toe",
      })
    }
    for (const t of trainers.filter((t) => t.trainingsLast30Days === 0)) {
      items.push({
        key: `trainer-${t.clerkId}`,
        title: `${t.displayName ?? "Een trainer"} plande niets`,
        body: "Geen trainingsactiviteit in de laatste 30 dagen.",
        href: "/club",
        actionLabel: "Bekijk",
      })
    }
    if (items.length === 0) return null
    return { title: "Groepen zonder trainer · achterblijvers", items: items.slice(0, 6) }
  }, [groups, trainers])

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
        label: "Naar de clubomgeving",
        hint: "Groepen, toewijzingen, kalender en berichten",
      }}
    />
  )
}
