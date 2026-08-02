// DASHBOARD_01 Fase B — Ouder dashboard.
//
// Drie lagen uit BESTAANDE parent-overview-data (/api/parent/overview). De
// rechten volgen exact de bestaande ouder-toestemmingslaag (access.permissions):
// een ouder ziet alleen wat is gedeeld (DSH-09/23).
//   Laag 1 — hoe het met kind(eren) gaat: welzijnssamenvatting (gezondheid /
//            slaap / gevoel) voor zover gedeeld.
//   Laag 2 — wat vandaag speelt: de eerstvolgende geplande training/afspraak
//            (categorie planning), of een openstaand wedstrijdbesluit.
//   Laag 3 — signalen die aandacht vragen: open ziek-/blessuremeldingen,
//            herbevestiging vereist, gezondheidsstatus ≠ ok.
//
// De bestaande Kinderen-pagina (/kinderen) blijft de werkomgeving en is via de
// doorklik bereikbaar — niets weggelaten (DSH-13a).

import { useMemo } from "react"
import { useUserProfile } from "@/contexts/UserContext"
import { useSelectedChild, effectiveChildId } from "@/lib/parent-selected-child"
import {
  useParentOverview,
  type ParentOverviewChild,
} from "@/hooks/use-parent"
import {
  RoleDashboard,
  type Layer1,
  type Layer2,
  type Layer3Item,
} from "@/components/sparki/role-dashboard"

const healthLabel: Record<string, string> = {
  ok: "gezond",
  sick: "ziek",
  injured: "geblesseerd",
}

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

// Welzijn in één rustige regel — alleen uit gedeelde categorieën.
function welzijnRegel(child: ParentOverviewChild): string {
  const perm = child.access.permissions
  const wb = child.wellbeing
  const stukjes: string[] = []
  if (perm.gezondheid && child.healthStatus) {
    stukjes.push(healthLabel[child.healthStatus] ?? child.healthStatus)
  }
  if (perm.slaap && wb?.sleepHours) stukjes.push(`sliep ${wb.sleepHours} u`)
  if (perm.herstel && wb?.feelScore != null) stukjes.push(`gevoel ${wb.feelScore}/10`)
  if (stukjes.length === 0) return "Er is nu niets gedeeld om te tonen."
  return stukjes.join(" · ")
}

export function ParentDashboard() {
  const { profile } = useUserProfile()
  const { data, isLoading } = useParentOverview(
    profile?.activeRole === "parent",
  )
  const children = useMemo(() => data?.children ?? [], [data])
  const { selected } = useSelectedChild(profile?.clerkId)
  const effective = effectiveChildId(
    selected,
    children.map((c) => c.athleteClerkId),
  )
  const kind = useMemo(
    () => children.find((c) => c.athleteClerkId === effective) ?? children[0],
    [children, effective],
  )

  const laag1: Layer1 | null = useMemo(() => {
    if (children.length === 0) return null
    if (children.length > 1) {
      // Meerdere kinderen: één beeld over allemaal, mét het gekozen kind erbij.
      const aandacht = children.filter(
        (c) =>
          (c.openReports?.length ?? 0) > 0 ||
          (c.access.permissions.gezondheid && c.healthStatus && c.healthStatus !== "ok"),
      ).length
      return {
        kicker: "Je kinderen",
        value: String(children.length),
        meaning:
          aandacht > 0
            ? `${aandacht} van je kinderen vraagt vandaag aandacht.`
            : "Het gaat rustig met je kinderen.",
        detail: kind
          ? `${kind.displayName ?? "Kind"}: ${welzijnRegel(kind)}`
          : null,
      }
    }
    const c = children[0]!
    return {
      kicker: c.displayName ?? "Je kind",
      value:
        c.access.permissions.gezondheid && c.healthStatus
          ? (healthLabel[c.healthStatus] ?? c.healthStatus)
          : "In beeld",
      meaning: welzijnRegel(c),
    }
  }, [children, kind])

  const laag2: Layer2 | null = useMemo(() => {
    if (!kind) return null
    const perm = kind.access.permissions
    // Openstaand wedstrijdbesluit weegt zwaarder dan planning.
    if (perm.wedstrijd && kind.races) {
      const teBeslissen = kind.races.find((r) => !r.parentDecision)
      if (teBeslissen) {
        return {
          title: `Beslis over ${teBeslissen.name}`,
          body: `${fmtDate(teBeslissen.raceDate)} — je bevestiging is nog nodig.`,
          href: "/kinderen",
          actionLabel: "Bekijk en beslis",
          urgent: true,
        }
      }
    }
    if (perm.planning && kind.today && kind.today.length > 0) {
      const eerste = kind.today[0]!
      return {
        title: eerste.title,
        body: `Wat ${kind.displayName ?? "je kind"} vandaag doet.`,
        href: "/kinderen",
        actionLabel: "Bekijk vandaag",
      }
    }
    return null
  }, [kind])

  const laag3: { title: string; items: Layer3Item[] } | null = useMemo(() => {
    if (!kind) return null
    const items: Layer3Item[] = []
    const open = (kind.openReports ?? []).filter((r) => r.status === "open")
    for (const r of open) {
      items.push({
        key: `report-${r.id}`,
        title:
          r.kind === "ziek"
            ? "Ziekmelding staat open"
            : r.kind === "blessure"
              ? "Blessuremelding staat open"
              : "Afwezigmelding staat open",
        body: "Nog niet gezien door de sporter of trainer.",
        href: "/kinderen",
        actionLabel: "Bekijk",
      })
    }
    if (kind.access.reconfirmRequired) {
      items.push({
        key: "reconfirm",
        title: "Herbevestiging nodig",
        body: "De leeftijdscategorie is veranderd; het delen moet opnieuw bevestigd worden.",
        href: "/toestemmingen",
        actionLabel: "Naar toestemmingen",
      })
    }
    if (
      kind.access.permissions.gezondheid &&
      kind.healthStatus &&
      kind.healthStatus !== "ok"
    ) {
      items.push({
        key: "health",
        title: `Gezondheid: ${healthLabel[kind.healthStatus] ?? kind.healthStatus}`,
        body: "De sporter heeft dit zelf aangegeven.",
        href: "/kinderen",
        actionLabel: "Bekijk",
      })
    }
    if (items.length === 0) return null
    return { title: "Signalen die aandacht vragen", items }
  }, [kind])

  return (
    <RoleDashboard
      section="Ouder"
      bg="/atmosphere/samen-fietsen-terras.webp"
      loading={isLoading}
      laag1={laag1}
      laag2={laag2}
      laag3={laag3}
      werkscherm={{
        href: "/kinderen",
        label: "Naar Kinderen",
        hint: "Welzijn, berichten, toestemmingen en meldingen",
      }}
    />
  )
}
