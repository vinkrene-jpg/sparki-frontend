// DASHBOARD_01 Fase B — Ploegleider dashboard.
//
// Drie lagen uit BESTAANDE wedstrijd-/clubdata (BUILD_03-wedstrijdlaag +
// wedstrijd-room):
//   Laag 1 — eerstvolgende wedstrijd en de bezetting: hoeveel renners
//            beschikbaar en met welke rol (selections).
//   Laag 2 — open taken voor die dag: ontbrekende koersdag-details van de
//            eerstvolgende wedstrijd (verzamelpunt/-tijd, vervoer), met de
//            wedstrijd-room als plek om de dag vast te leggen.
//   Laag 3 — onbezette rollen · materiaal niet afgevinkt: renners zonder
//            toegewezen koersrol en ontbrekende materiaalinfo.
//
// De clubomgeving (/club) en de wedstrijd-room (/wedstrijd-room) blijven de
// werkomgeving en zijn via de doorklik bereikbaar (DSH-13a).

import { useMemo } from "react"
import { useClubRaces, type ClubRaceEvent } from "@/hooks/use-club"
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

export function PloegleiderDashboard() {
  const { clubId, primaryColor, isLoading: clubLoading } = useActiveClub()
  const { data: races, isLoading: racesLoading } = useClubRaces(clubId)
  const isLoading = clubLoading || racesLoading

  const volgende = useMemo<ClubRaceEvent | null>(() => {
    const komend = (races ?? [])
      .filter((r) => daysUntil(r.raceDate) >= 0)
      .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    return komend[0] ?? null
  }, [races])

  const laag1: Layer1 | null = useMemo(() => {
    if (!volgende) return null
    const n = beschikbaar(volgende)
    const dagen = daysUntil(volgende.raceDate)
    return {
      kicker: "Eerstvolgende wedstrijd",
      value: volgende.name,
      meaning: `${n} renner${n === 1 ? "" : "s"} beschikbaar · ${
        dagen === 0 ? "vandaag" : dagen === 1 ? "morgen" : `over ${dagen} dagen`
      }.`,
      accent: primaryColor,
      detail: volgende.location ? volgende.location : null,
    }
  }, [volgende, primaryColor])

  const laag2: Layer2 | null = useMemo(() => {
    if (!volgende) return null
    const ontbreekt: string[] = []
    if (!volgende.meetPoint) ontbreekt.push("verzamelpunt")
    if (!volgende.meetTime) ontbreekt.push("verzameltijd")
    if (!volgende.transportInfo) ontbreekt.push("vervoer")
    if (ontbreekt.length === 0) {
      // Alle koersdag-details staan — dan is de dag vastleggen de open taak.
      return {
        title: `Leg de koersdag van ${volgende.name} vast`,
        body: "Verzamelpunt, tijd en vervoer zijn ingevuld — noteer het verloop in de wedstrijd-room.",
        href: "/wedstrijd-room",
        actionLabel: "Open de wedstrijd-room",
      }
    }
    return {
      title: `Vul de koersdag van ${volgende.name} aan`,
      body: `Nog te regelen: ${ontbreekt.join(", ")}.`,
      href: "/club",
      actionLabel: "Vul aan in de club",
      urgent: daysUntil(volgende.raceDate) <= 2,
    }
  }, [volgende])

  const laag3: { title: string; items: Layer3Item[] } | null = useMemo(() => {
    if (!volgende) return null
    const items: Layer3Item[] = []
    const zonderRol = volgende.selections.filter(
      (s) => s.availability === "beschikbaar" && (!s.role || s.role === "renner"),
    ).length
    if (zonderRol > 0) {
      items.push({
        key: "rollen",
        title: `${zonderRol} renner${zonderRol === 1 ? "" : "s"} zonder koersrol`,
        body: "Nog geen specifieke rol toegewezen (kopman, knecht, …).",
        href: "/club",
        actionLabel: "Wijs rollen toe",
      })
    }
    if (!volgende.materialInfo) {
      items.push({
        key: "materiaal",
        title: "Materiaal nog niet afgevinkt",
        body: "Er is nog geen materiaalinfo genoteerd voor deze wedstrijd.",
        href: "/club",
        actionLabel: "Noteer materiaal",
      })
    }
    if (items.length === 0) return null
    return { title: "Onbezette rollen · materiaal", items }
  }, [volgende])

  return (
    <RoleDashboard
      section="club"
      bg="/atmosphere/samen-groepsrit-winter.webp"
      loading={isLoading}
      laag1={laag1}
      laag2={laag2}
      laag3={laag3}
      werkscherm={{
        href: "/wedstrijd-room",
        label: "Naar de wedstrijd-room",
        hint: "Koersdag vastleggen en samenstellen",
      }}
    />
  )
}
