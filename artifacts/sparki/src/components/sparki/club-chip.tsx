import { Shield } from "lucide-react"
import { clubLogoSrc } from "@/lib/club-logo"
import { useTeamIdentity } from "@/hooks/use-social"

// Compact club marker reused across screens (Nieuws, Inzicht, ...) so the
// athlete's club identity is present everywhere — colours used only as a subtle
// accent; Sparki's own identity stays leading. Renders nothing without a club.
export function ClubChip({ className = "" }: { className?: string }) {
  const { data } = useTeamIdentity()
  const team = data?.team
  if (!team || !team.clubName) return null
  const color = team.primaryColor ?? "rgba(120,210,230,1)"
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${className}`}
      style={{ borderColor: `${color}55`, background: `${color}1a` }}
      title={[team.clubName, team.teamName].filter(Boolean).join(" · ")}
    >
      {team.logoUrl ? (
        <img
          src={clubLogoSrc(team.logoUrl)}
          alt=""
          className="h-3.5 w-3.5 shrink-0 object-contain"
        />
      ) : (
        <Shield className="h-3 w-3" style={{ color }} strokeWidth={2} />
      )}
      <span className="max-w-[9rem] truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">
        {team.shirtBadge || team.clubName}
      </span>
    </span>
  )
}
