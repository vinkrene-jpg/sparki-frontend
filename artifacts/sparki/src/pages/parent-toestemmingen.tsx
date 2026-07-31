// WP-R1 — Toestemmingen: privacy en delen per kind.
//
// Hergebruikt de bestaande toestemmingslaag: per kind de gedeelde
// gegevenscategorieën (PermissionsPanel uit de ouder-home) + eerlijke uitleg
// van de leeftijdsregels. Wijzigen kan alleen wanneer de server dat toestaat
// (kind < 16); daarboven is dit alleen-lezen — precies zoals de rechtenlaag
// het afdwingt.
import { ShieldCheck, Users, UserPlus } from "lucide-react"
import { Link } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import { useParentOverview } from "@/hooks/use-parent"
import { PermissionsPanel } from "@/components/sparki/parent-home"
import {
  useSelectedChild,
  effectiveChildId,
} from "@/lib/parent-selected-child"

const tierUitleg: Record<string, string> = {
  u16: "Je kind is jonger dan 16: jij beheert als ouder/verzorger wat er gedeeld wordt.",
  "16_17": "Je kind is 16 of 17: je kind beheert zelf wat er gedeeld wordt; jij kijkt mee (alleen-lezen).",
  adult: "Je kind is 18 of ouder: de koppeling staat op het veiligheidsminimum tot je kind als volwassene opnieuw bevestigt.",
  unknown: "De leeftijd is onbekend: de koppeling staat op het veiligheidsminimum.",
}

export default function ParentToestemmingenPage() {
  const { profile } = useUserProfile()
  const { data, isLoading, isError, refetch } = useParentOverview(
    profile?.activeRole === "parent",
  )
  const { selected, setSelected } = useSelectedChild(profile?.clerkId)

  if (profile && profile.activeRole !== "parent") {
    return (
      <ScreenShell section="Ouder">
        <p className="text-[14px] text-white/60">
          Deze pagina hoort bij de ouderomgeving.
        </p>
      </ScreenShell>
    )
  }

  const children = data?.children ?? []
  const effective = effectiveChildId(selected, children.map((c) => c.athleteClerkId))
  const child = children.find((c) => c.athleteClerkId === effective) ?? null

  return (
    <ScreenShell section="Ouder" bg="/atmosphere/samen-fietsen-terras.webp">
      <div className="space-y-5">
        <div>
          <SectionLabel n="01" title="Toestemmingen & privacy" />
          <p className="mt-2 text-[13px] text-white/45">
            Per kind bepaal je (of bekijk je) welke gegevenscategorieën met jou
            gedeeld worden. De regels volgen de leeftijd van je kind.
          </p>
        </div>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" />
        ) : isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-5 text-center">
            <p className="text-[13px] text-red-300/90">
              Toestemmingen konden niet geladen worden.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-full border border-white/[0.14] px-4 py-1.5 text-[13px] text-white/75"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : children.length === 0 ? (
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md"
            data-testid="toestemmingen-leeg"
          >
            <Users className="mx-auto mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">Nog geen kind gekoppeld</p>
            <Link
              href="/invitations"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: ACCENT }}
            >
              <UserPlus className="h-4 w-4" />
              Uitnodiging versturen
            </Link>
          </div>
        ) : (
          <>
            {children.length > 1 && (
              <div className="flex flex-wrap gap-2" data-testid="kindkiezer">
                {children.map((c) => {
                  const active = c.athleteClerkId === effective
                  return (
                    <button
                      key={c.athleteClerkId}
                      type="button"
                      onClick={() => setSelected(c.athleteClerkId)}
                      className="rounded-full border px-3.5 py-1.5 text-[13px] transition-colors"
                      style={
                        active
                          ? { borderColor: "rgba(120,210,230,0.4)", color: ACCENT, background: "rgba(120,210,230,0.10)" }
                          : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)" }
                      }
                    >
                      {c.displayName ?? "Sporter"}
                    </button>
                  )
                })}
              </div>
            )}
            {child && (
              <div
                className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
                data-testid={`toestemmingen-${child.athleteClerkId}`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-white/40" strokeWidth={1.75} />
                  <span className="text-[15px] text-white/90">
                    {child.displayName ?? "Sporter"}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-white/45">
                  {tierUitleg[child.access.tier] ?? tierUitleg.unknown}
                </p>
                {child.access.reconfirmRequired && (
                  <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[12px] text-amber-200/90">
                    De leeftijdscategorie is veranderd — je kind moet opnieuw
                    bevestigen wat er gedeeld wordt.
                  </p>
                )}
                <PermissionsPanel child={child} />
              </div>
            )}
          </>
        )}
      </div>
    </ScreenShell>
  )
}
