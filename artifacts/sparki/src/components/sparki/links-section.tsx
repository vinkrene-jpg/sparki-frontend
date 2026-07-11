import { useState } from "react"
import { Users, UserCog, X, AlertTriangle } from "lucide-react"
import { SectionLabel } from "@/components/sparki/ui"
import {
  useMyLinks,
  useRevokeLink,
  type LinkedPerson,
} from "@/hooks/use-links"

function LinkRow({
  person,
  kind,
  onRevoke,
  busy,
}: {
  person: LinkedPerson
  kind: "coach" | "parent"
  onRevoke: () => void
  busy: boolean
}) {
  const Icon = kind === "coach" ? Users : UserCog
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
        style={{
          borderColor: "rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <Icon className="h-4 w-4 text-white/55" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] tracking-tight text-white/85">
          {person.displayName ?? person.email}
        </div>
        <div className="truncate text-[12px] text-white/40">
          {kind === "coach" ? "Coach" : "Ouder"} ·{" "}
          {person.status === "accepted" ? "Gekoppeld" : "In afwachting"}
        </div>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={busy}
        aria-label="Koppeling verwijderen"
        className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-40"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function LinksSection() {
  const { data, isLoading } = useMyLinks()
  const revoke = useRevokeLink()
  const [notice, setNotice] = useState<string | null>(null)
  const coaches = data?.coaches ?? []
  const parents = data?.parents ?? []
  const hasAny = coaches.length > 0 || parents.length > 0

  const handleRevoke = (
    kind: "coach" | "parent",
    person: LinkedPerson,
  ) => {
    setNotice(null)
    const who = person.displayName ?? person.email
    const rol = kind === "coach" ? "coach" : "ouder"
    revoke.mutate(
      { kind, clerkId: person.clerkId },
      {
        onSuccess: (result) => {
          if (!result.removed || result.removed < 1) {
            setNotice(
              `De koppeling met ${who} (${rol}) was al weg — er is niets verwijderd. De lijst is opnieuw geladen.`,
            )
          }
        },
        onError: () => {
          setNotice(
            `Het verwijderen van de koppeling met ${who} (${rol}) is niet gelukt. Probeer het zo nog eens.`,
          )
        },
      },
    )
  }

  return (
    <section className="pt-2">
      <SectionLabel n="08" title="Coaches & ouders" />
      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 backdrop-blur-md">
        {isLoading ? (
          <div className="space-y-3 py-6">
            <div className="h-10 animate-pulse rounded bg-white/[0.06]" />
          </div>
        ) : !hasAny ? (
          <p className="py-6 text-center text-[13px] text-white/40">
            Je hebt nog geen gekoppelde coach of ouder.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {coaches.map((c) => (
              <LinkRow
                key={`coach-${c.clerkId}`}
                person={c}
                kind="coach"
                busy={revoke.isPending}
                onRevoke={() => handleRevoke("coach", c)}
              />
            ))}
            {parents.map((p) => (
              <LinkRow
                key={`parent-${p.clerkId}`}
                person={p}
                kind="parent"
                busy={revoke.isPending}
                onRevoke={() => handleRevoke("parent", p)}
              />
            ))}
          </div>
        )}
      </div>
      {notice && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2.5 text-[12px] leading-snug text-amber-200/90"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            strokeWidth={1.75}
          />
          <span>{notice}</span>
        </div>
      )}
      <p className="mt-2 px-1 text-[11px] leading-snug text-white/30">
        Een koppeling verwijderen stopt direct het delen van jouw gegevens met
        die persoon.
      </p>
    </section>
  )
}
