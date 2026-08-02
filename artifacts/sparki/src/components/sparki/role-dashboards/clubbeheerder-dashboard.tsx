// DASHBOARD_01 Fase B — Clubbeheerder dashboard.
//
// Drie lagen uit BESTAANDE clubdata:
//   Laag 1 — ontwikkeling van het ledenbestand: aantal leden + trainers
//            (/api/clubs/:id → memberCounts).
//   Laag 2 — openstaande toestemmingen + verlopende VOG's (F6): het ene ding
//            dat beheer vandaag vraagt (consents zonder "granted" en members
//            met vogStatus "verlopen"/"ontbreekt", uit /api/clubs/:id/members).
//   Laag 3 — leden die dreigen af te haken (afmeldingssignaal uit dashboard).
//            "Jeugd zonder ouderkoppeling": daar is in deze frontend GEEN
//            bestaande databron voor (alleen isYouth is beschikbaar, niet de
//            koppelstatus) — die kans wordt eerlijk weggelaten (DSH-08),
//            behandeld in de clubomgeving.
//
// De clubbeheeromgeving (/club/beheer) blijft de werkomgeving; via de doorklik
// altijd bereikbaar (DSH-13a).

import { useMemo } from "react"
import { useClubDashboard, useClubMembers } from "@/hooks/use-club"
import { useActiveClub } from "./use-active-club"
import {
  RoleDashboard,
  type Layer1,
  type Layer2,
  type Layer3Item,
} from "@/components/sparki/role-dashboard"

export function ClubbeheerderDashboard() {
  const { clubId, primaryColor, isLoading: clubLoading } = useActiveClub()
  const { data: dash, isLoading: dashLoading } = useClubDashboard(clubId)
  const { data: members, isLoading: memLoading } = useClubMembers(
    clubId,
    clubId != null,
  )
  const isLoading = clubLoading || dashLoading || memLoading

  const laag1: Layer1 | null = useMemo(() => {
    if (!dash) return null
    const { members: aantal, trainers } = dash.memberCounts
    return {
      kicker: "Ledenbestand",
      value: String(aantal),
      meaning:
        aantal === 0
          ? "Nog geen leden — nodig je eerste sporters uit."
          : `${aantal} lid${aantal === 1 ? "" : "eren"}, ${trainers} trainer${trainers === 1 ? "" : "s"}.`,
      accent: primaryColor,
      detail: dash.club.location ? dash.club.location : null,
    }
  }, [dash, primaryColor])

  const laag2: Layer2 | null = useMemo(() => {
    // Openstaande toestemmingen wegen het zwaarst (acceptatiecriterium §8).
    const openConsents = (dash?.consents ?? []).filter(
      (c) => c.status !== "granted",
    ).length
    const vogAandacht = (members ?? []).filter(
      (m) => m.vogStatus === "verlopen" || m.vogStatus === "ontbreekt",
    ).length
    if (openConsents > 0) {
      return {
        title: `${openConsents} openstaande toestemming${openConsents === 1 ? "" : "en"}`,
        body:
          vogAandacht > 0
            ? `En ${vogAandacht} lid${vogAandacht === 1 ? "" : "eren"} met een VOG die aandacht vraagt.`
            : "Trainers zien pas gegevens als de toestemming rond is.",
        href: "/club/beheer",
        actionLabel: "Naar het beheer",
        urgent: true,
      }
    }
    if (vogAandacht > 0) {
      return {
        title: `${vogAandacht} VOG${vogAandacht === 1 ? "" : "'s"} vraagt aandacht`,
        body: "Een of meer verklaringen ontbreken of zijn ouder dan drie jaar.",
        href: "/club/beheer",
        actionLabel: "Bekijk in het beheer",
        urgent: true,
      }
    }
    if ((dash?.openInvitations ?? 0) > 0) {
      return {
        title: `${dash!.openInvitations} openstaande uitnodiging${dash!.openInvitations === 1 ? "" : "en"}`,
        body: "Nog niet geaccepteerd door de genodigden.",
        href: "/club/beheer",
        actionLabel: "Beheer uitnodigingen",
      }
    }
    return null
  }, [dash, members])

  const laag3: { title: string; items: Layer3Item[] } | null = useMemo(() => {
    const items: Layer3Item[] = []
    for (const [i, s] of (dash?.signals ?? []).entries()) {
      items.push({
        key: `signal-${i}`,
        title: s,
        href: "/club/beheer",
        actionLabel: "Bekijk",
      })
    }
    if (items.length === 0) return null
    return { title: "Risico's en kansen", items }
  }, [dash])

  return (
    <RoleDashboard
      section="club"
      bg="/atmosphere/samen-groepsrit-winter.webp"
      loading={isLoading}
      laag1={laag1}
      laag2={laag2}
      laag3={laag3}
      werkscherm={{
        href: "/club/beheer",
        label: "Naar clubbeheer",
        hint: "Leden, rollen, toestemmingen en documenten",
      }}
    />
  )
}
